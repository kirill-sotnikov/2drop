import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { type Logger } from "pino";
import {
  type ClientMessage,
  clientMessageSchema,
  type EndReason,
  type IceServer,
  ID_ALPHABET,
  type ServerMessage,
  type Transfer,
  VERSION,
} from "protocol";
import { WebSocket, WebSocketServer } from "ws";
import { type ServiceConfig } from "./config.js";
import { createLogger, logEvent } from "./logger.js";
import { createMetrics } from "./metrics.js";

interface Session {
  id: string;
  telemetryId: string;
  secret: string;
  socket?: WebSocket;
  expiresAt: number;
}

type PendingTransfer = Transfer & {
  accepted: boolean;
  offered: boolean;
  answered: boolean;
  requestId: string;
  senderSessionId: string;
  receiverSessionId: string;
  acceptedAt?: number;
};

interface Connection {
  id: string;
  ip: string;
  alive: boolean;
  session?: Session;
  authenticated: boolean;
  openedAt: number;
  startedAt: number;
  messageContext?: {
    messageType: string;
    requestId?: string;
    transferId?: string;
  };
}

const publicTransfer = (transfer: PendingTransfer): Transfer => ({
  id: transfer.id,
  senderId: transfer.senderId,
  receiverId: transfer.receiverId,
  senderName: transfer.senderName,
  file: transfer.file,
  expiresAt: transfer.expiresAt,
});

// Windows persist across reconnects and are periodically discarded to bound memory.
class RateLimits {
  private windows = new Map<string, { count: number; until: number }>();

  allow(key: string, limit: number, ms = 60_000) {
    const now = Date.now();

    let window = this.windows.get(key);

    if (!window || window.until <= now) {
      if (!window && this.windows.size >= 20_000) return false;
      window = { count: 0, until: now + ms };
      this.windows.set(key, window);
    }

    return ++window.count <= limit;
  }

  sweep() {
    for (const [key, window] of this.windows)
      if (window.until <= Date.now()) this.windows.delete(key);
  }
}

export const makeTurnCredentials = (
  secret: string,
  sessionId: string,
  ttlSeconds: number,
  now = Date.now(),
) => {
  const username = `${Math.floor(now / 1_000) + ttlSeconds}:${sessionId}`;

  return {
    username,
    credential: createHmac("sha1", secret).update(username).digest("base64"),
  };
};

export const createSignalingServer = (
  config: ServiceConfig,
  generateId = () =>
    Array.from(
      { length: 8 },
      () => ID_ALPHABET[randomInt(ID_ALPHABET.length)],
    ).join(""),
  logger: Logger = createLogger(config),
) => {
  const sessions = new Map<string, Session>();
  const connections = new Map<WebSocket, Connection>();
  const transfers = new Map<string, PendingTransfer>();
  const limits = new RateLimits();

  const metrics = createMetrics({
    connections: () => connections.size,
    sessions: () => sessions.size,
    transfers: () => {
      let accepted = 0;

      for (const transfer of transfers.values())
        if (transfer.accepted) accepted++;

      return { pending: transfers.size - accepted, accepted };
    },
  });

  const connectionFields = (socket: WebSocket) => {
    const connection = connections.get(socket);

    return {
      connectionId: connection?.id,
      sessionId: connection?.session?.telemetryId,
      ...connection?.messageContext,
    };
  };

  const serveMetrics = async (response: ServerResponse) => {
    try {
      const body = await metrics.registry.metrics();

      response.writeHead(200, { "Content-Type": metrics.registry.contentType });
      response.end(body);
    } catch (error_) {
      logEvent(logger, "error", "metrics.error", { err: error_ as Error });
      response.writeHead(500);
      response.end();
    }
  };

  const http = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");

    if (request.method === "GET" && request.url === "/metrics") {
      const expected = Buffer.from(`Bearer ${config.metricsToken}`);
      const received = Buffer.from(request.headers.authorization ?? "");

      if (
        config.metricsToken &&
        (received.length !== expected.length ||
          !timingSafeEqual(received, expected))
      ) {
        response.writeHead(401, { "WWW-Authenticate": "Bearer" });
        response.end();

        return;
      }

      void serveMetrics(response);
    } else if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
    } else {
      response.writeHead(404);
      response.end();
    }
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1_024,
    perMessageDeflate: false,
  });

  const send = (socket: WebSocket | undefined, message: ServerMessage) => {
    if (socket?.readyState !== WebSocket.OPEN) return;

    if (socket.bufferedAmount > 256 * 1_024) {
      logEvent(logger, "warn", "connection.terminated", {
        ...connectionFields(socket),
        reason: "backpressure",
      });

      socket.terminate();

      return;
    }

    socket.send(JSON.stringify(message));
  };

  const error = (socket: WebSocket, code: string, requestId?: string) => {
    metrics.protocolErrors.inc({ code });

    logEvent(
      logger,
      code === "rate_limited" || code === "capacity" ? "warn" : "info",
      "protocol.rejected",
      {
        ...connectionFields(socket),
        code,
        ...(requestId ? { requestId } : {}),
      },
    );

    send(socket, {
      v: VERSION,
      type: "error",
      code,
      ...(requestId ? { requestId } : {}),
    });
  };

  const finish = (
    transfer: PendingTransfer,
    reason: EndReason,
    socket?: WebSocket,
  ) => {
    if (!transfers.delete(transfer.id)) return;

    const stage = transfer.accepted ? "accepted" : "pending";

    const durationSeconds =
      transfer.acceptedAt === undefined
        ? undefined
        : (performance.now() - transfer.acceptedAt) / 1_000;

    metrics.transfersEnded.inc({ reason, stage });
    if (durationSeconds !== undefined)
      metrics.transferDuration.observe({ reason }, durationSeconds);

    logEvent(logger, reason === "failed" ? "warn" : "info", "transfer.ended", {
      ...(socket ? connectionFields(socket) : {}),
      transferId: transfer.id,
      requestId: transfer.requestId,
      senderSessionId: transfer.senderSessionId,
      receiverSessionId: transfer.receiverSessionId,
      reason,
      stage,
      durationSeconds,
    });

    for (const id of [transfer.senderId, transfer.receiverId]) {
      send(sessions.get(id)?.socket, {
        v: VERSION,
        type: "ended",
        transferId: transfer.id,
        reason,
      });
    }
  };

  const endFor = (session: Session, reason: EndReason) => {
    for (const transfer of transfers.values()) {
      if ([transfer.senderId, transfer.receiverId].includes(session.id))
        finish(transfer, reason);
    }
  };

  const busy = (id: string) => {
    return [...transfers.values()].some(
      (transfer) =>
        transfer.accepted &&
        [transfer.senderId, transfer.receiverId].includes(id),
    );
  };

  const newSession = (socket: WebSocket): Session | undefined => {
    if (sessions.size >= config.maxSessions) {
      error(socket, "capacity");

      return undefined;
    }

    let id = "";

    for (let index = 0; index < 100; index++) {
      id = generateId();
      if (!sessions.has(id)) break;
      id = "";
    }

    if (!id) {
      error(socket, "capacity");

      return undefined;
    }

    const session = {
      id,
      telemetryId: randomUUID(),
      secret: randomBytes(32).toString("hex"),
      socket,
      expiresAt: Infinity,
    };

    sessions.set(id, session);

    logEvent(logger, "info", "session.created", {
      connectionId: connections.get(socket)?.id,
      sessionId: session.telemetryId,
    });

    return session;
  };

  const iceServers = (id: string): IceServer[] => {
    return [
      ...config.iceServers,
      ...(config.turnUrls.length
        ? [
            {
              urls: config.turnUrls,
              ...makeTurnCredentials(
                config.turnSecret,
                id,
                config.turnTtlSeconds,
              ),
            },
          ]
        : []),
    ];
  };

  const announce = (session: Session) => {
    send(session.socket, {
      v: VERSION,
      type: "session",
      id: session.id,
      secret: session.secret,
      maxFileBytes: config.maxFileBytes,
      offerTimeoutMs: config.offerTimeoutMs,
      iceServers: iceServers(session.id),
    });
  };

  const handleHello = (
    socket: WebSocket,
    connection: Connection,
    message: Extract<ClientMessage, { type: "hello" }>,
  ) => {
    if (connection.authenticated) {
      error(socket, "already_authenticated");

      return;
    }

    let resumedSession: Session | undefined;

    if (message.resume) {
      resumedSession = sessions.get(message.resume.id);

      if (
        !resumedSession ||
        resumedSession.expiresAt <= Date.now() ||
        !timingSafeEqual(
          Buffer.from(resumedSession.secret, "hex"),
          Buffer.from(message.resume.secret, "hex"),
        )
      ) {
        error(socket, "invalid_resume");

        return;
      }

      if (
        resumedSession.socket &&
        resumedSession.socket.readyState === WebSocket.OPEN
      ) {
        error(socket, "session_in_use");

        return;
      }

      resumedSession.socket = socket;
      resumedSession.expiresAt = Infinity;

      logEvent(logger, "info", "session.resumed", {
        connectionId: connection.id,
        sessionId: resumedSession.telemetryId,
      });
    } else resumedSession = newSession(socket);
    if (!resumedSession) return;
    connection.authenticated = true;
    connection.session = resumedSession;
    announce(resumedSession);
  };

  const handleOffer = (
    socket: WebSocket,
    connection: Connection,
    session: Session,
    message: Extract<ClientMessage, { type: "lookup" | "propose" }>,
  ) => {
    const requestId = message.requestId;

    if (
      !limits.allow(
        `${connection.ip}:${message.type}`,
        message.type === "lookup" ? 60 : 20,
      )
    ) {
      error(socket, "rate_limited", requestId);

      return;
    }

    const target = sessions.get(message.targetId);

    const status =
      message.targetId === session.id
        ? "self"
        : target?.socket?.readyState === WebSocket.OPEN
          ? busy(target.id)
            ? "busy"
            : "available"
          : "unavailable";

    if (message.type === "lookup") {
      send(socket, {
        v: VERSION,
        type: "lookup",
        requestId: message.requestId,
        targetId: message.targetId,
        status,
      });

      return;
    }

    if (status !== "available" || !target) {
      error(socket, status, requestId);

      return;
    }

    if (message.file.size > config.maxFileBytes) {
      error(socket, "file_too_large", requestId);

      return;
    }

    if (
      busy(session.id) ||
      [...transfers.values()].some(
        (transfer) => transfer.senderId === session.id,
      ) ||
      [...transfers.values()].filter(
        (transfer) => transfer.receiverId === target.id,
      ).length >= 8
    ) {
      error(socket, "busy", requestId);

      return;
    }

    const proposedTransfer: PendingTransfer = {
      id: randomUUID(),
      senderId: session.id,
      receiverId: target.id,
      senderName: message.senderName,
      file: message.file,
      expiresAt: Date.now() + config.offerTimeoutMs,
      accepted: false,
      offered: false,
      answered: false,
      requestId,
      senderSessionId: session.telemetryId,
      receiverSessionId: target.telemetryId,
    };

    transfers.set(proposedTransfer.id, proposedTransfer);
    metrics.transfersProposed.inc();

    logEvent(logger, "info", "transfer.proposed", {
      ...connectionFields(socket),
      transferId: proposedTransfer.id,
      senderSessionId: session.telemetryId,
      receiverSessionId: target.telemetryId,
    });

    send(socket, {
      v: VERSION,
      type: "proposed",
      requestId: message.requestId,
      transfer: publicTransfer(proposedTransfer),
    });

    send(target.socket, {
      v: VERSION,
      type: "incoming",
      transfer: publicTransfer(proposedTransfer),
    });
  };

  const handleDecision = (
    socket: WebSocket,
    session: Session,
    transfer: PendingTransfer,
    message: Extract<ClientMessage, { type: "decide" }>,
  ) => {
    if (session.id !== transfer.receiverId || transfer.accepted) {
      error(socket, "invalid_state");

      return;
    }

    if (!message.accept) {
      finish(transfer, "rejected", socket);

      return;
    }

    if (busy(transfer.senderId) || busy(transfer.receiverId)) {
      finish(transfer, "busy", socket);

      return;
    }

    transfer.accepted = true;
    transfer.acceptedAt = performance.now();
    transfer.expiresAt = Date.now() + config.transferTimeoutMs;
    metrics.transfersAccepted.inc();

    logEvent(logger, "info", "transfer.accepted", {
      ...connectionFields(socket),
      transferId: transfer.id,
      requestId: transfer.requestId,
      senderSessionId: transfer.senderSessionId,
      receiverSessionId: transfer.receiverSessionId,
    });

    // A participant owns one file channel; remove all competing offers involving either participant.
    for (const other of transfers.values()) {
      if (
        other.id !== transfer.id &&
        [other.senderId, other.receiverId].some((id) =>
          [transfer.senderId, transfer.receiverId].includes(id),
        )
      )
        finish(other, "busy");
    }

    for (const id of [transfer.senderId, transfer.receiverId])
      send(sessions.get(id)?.socket, {
        v: VERSION,
        type: "accepted",
        transferId: transfer.id,
        iceServers: iceServers(id),
      });
  };

  const handle = (
    socket: WebSocket,
    connection: Connection,
    message: ClientMessage,
  ) => {
    const requestId = "requestId" in message ? message.requestId : undefined;

    if (message.type === "hello") {
      handleHello(socket, connection, message);

      return;
    }

    const session = connection.session;

    if (!session || session.socket !== socket) {
      error(socket, "unauthorized", requestId);

      return;
    }

    if (message.type === "rotate") {
      if (busy(session.id)) {
        error(socket, "busy");

        return;
      }

      // Allocate first so capacity errors cannot orphan the current owner.
      const replacement = newSession(socket);

      if (!replacement) return;
      endFor(session, "rotated");
      sessions.delete(session.id);
      connection.session = replacement;

      logEvent(logger, "info", "session.rotated", {
        ...connectionFields(socket),
        previousSessionId: session.telemetryId,
      });

      announce(replacement);

      return;
    }

    if (message.type === "lookup" || message.type === "propose") {
      handleOffer(socket, connection, session, message);

      return;
    }

    const transfer = transfers.get(message.transferId);

    if (
      !transfer ||
      ![transfer.senderId, transfer.receiverId].includes(session.id)
    ) {
      error(socket, "unknown_transfer");

      return;
    }

    if (transfer.expiresAt <= Date.now()) {
      finish(transfer, "expired", socket);

      return;
    }

    if (message.type === "cancel" || message.type === "fail") {
      finish(
        transfer,
        message.type === "cancel" ? "cancelled" : "failed",
        socket,
      );

      return;
    }

    if (message.type === "decide") {
      handleDecision(socket, session, transfer, message);

      return;
    }

    if (!transfer.accepted) {
      error(socket, "consent_required");

      return;
    }

    if (message.type === "complete") {
      if (session.id !== transfer.receiverId) {
        error(socket, "unauthorized");

        return;
      }

      finish(transfer, "complete", socket);

      return;
    }

    if (message.type === "signal") {
      const signal = message.signal;

      if (signal.kind === "offer") {
        if (session.id !== transfer.senderId || transfer.offered) {
          error(socket, "invalid_state");

          return;
        }

        transfer.offered = true;
      } else if (signal.kind === "answer") {
        if (
          session.id !== transfer.receiverId ||
          !transfer.offered ||
          transfer.answered
        ) {
          error(socket, "invalid_state");

          return;
        }

        transfer.answered = true;
      }

      const other =
        session.id === transfer.senderId
          ? transfer.receiverId
          : transfer.senderId;

      send(sessions.get(other)?.socket, {
        v: VERSION,
        type: "signal",
        transferId: transfer.id,
        signal,
      });
    }
  };

  http.on("upgrade", (request, socket, head) => {
    const ip = request.socket.remoteAddress ?? "unknown";
    const connectionId = randomUUID();

    // Only trust the socket address; forwarded headers require a separately trusted proxy policy.
    if (
      request.url !== "/ws" ||
      !request.headers.origin ||
      !config.allowedOrigins.includes(request.headers.origin)
    ) {
      metrics.connectionRejections.inc({ reason: "origin_or_path" });

      logEvent(logger, "warn", "connection.rejected", {
        connectionId,
        reason: "origin_or_path",
      });

      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");

      return;
    }

    const atCapacity =
      connections.size >= config.maxConnections ||
      [...connections.values()].filter((connection) => connection.ip === ip)
        .length >= config.maxConnectionsPerIp;

    if (atCapacity || !limits.allow(`${ip}:connect`, 60)) {
      const reason = atCapacity ? "capacity" : "rate_limited";

      metrics.connectionRejections.inc({ reason });
      logEvent(logger, "warn", "connection.rejected", { connectionId, reason });
      socket.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");

      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, ip, connectionId),
    );
  });

  wss.on(
    "connection",
    (socket: WebSocket, ip: string, connectionId: string) => {
      const connection: Connection = {
        id: connectionId,
        ip,
        alive: true,
        authenticated: false,
        openedAt: Date.now(),
        startedAt: performance.now(),
      };

      connections.set(socket, connection);
      metrics.connections.inc();
      logEvent(logger, "info", "connection.opened", { connectionId });

      socket.on("pong", () => {
        connection.alive = true;
      });

      socket.on("error", (socketError) => {
        metrics.websocketErrors.inc();

        logEvent(logger, "error", "websocket.error", {
          ...connectionFields(socket),
          err: socketError,
        });

        socket.terminate();
      });

      socket.on("message", (raw, isBinary) => {
        if (!limits.allow(`${ip}:message`, 600)) {
          metrics.messages.inc({ type: "rate_limited" });
          error(socket, "rate_limited");
          socket.close(1_008);

          return;
        }

        if (isBinary) {
          metrics.messages.inc({ type: "invalid" });
          error(socket, "invalid_message");

          return;
        }

        let input: unknown;

        try {
          input = JSON.parse(raw.toString());
        } catch {
          metrics.messages.inc({ type: "invalid" });
          error(socket, "invalid_message");

          return;
        }

        const parsed = clientMessageSchema.safeParse(input);

        if (!parsed.success) {
          metrics.messages.inc({ type: "invalid" });
          error(socket, "invalid_message");

          return;
        }

        const message = parsed.data;

        metrics.messages.inc({ type: message.type });

        connection.messageContext = {
          messageType: message.type,
          ...("requestId" in message ? { requestId: message.requestId } : {}),
          ...("transferId" in message
            ? { transferId: message.transferId }
            : {}),
        };

        try {
          handle(socket, connection, message);
        } finally {
          connection.messageContext = undefined;
        }
      });

      socket.on("close", (code) => {
        const durationSeconds =
          (performance.now() - connection.startedAt) / 1_000;

        metrics.connectionDuration.observe(durationSeconds);

        logEvent(logger, "info", "connection.closed", {
          ...connectionFields(socket),
          code: String(code),
          durationSeconds,
        });

        connections.delete(socket);

        const session = connection.session;

        if (session?.socket !== socket) return;
        session.socket = undefined;
        session.expiresAt = Date.now() + config.reconnectMs;
        endFor(session, "disconnected");
      });
    },
  );

  const sweep = () => {
    for (const [id, session] of sessions)
      if (session.expiresAt <= Date.now()) {
        sessions.delete(id);

        logEvent(logger, "info", "session.expired", {
          sessionId: session.telemetryId,
        });
      }

    for (const transfer of transfers.values())
      if (transfer.expiresAt <= Date.now()) finish(transfer, "expired");
    limits.sweep();
  };

  const maintenance = setInterval(() => {
    for (const [socket, connection] of connections) {
      if (
        !connection.alive ||
        (!connection.authenticated && Date.now() - connection.openedAt > 5_000)
      ) {
        logEvent(logger, "warn", "connection.terminated", {
          ...connectionFields(socket),
          reason: connection.alive ? "hello_timeout" : "heartbeat_timeout",
        });

        socket.terminate();
        continue;
      }

      connection.alive = false;
      socket.ping();
    }

    sweep();
  }, config.heartbeatMs);

  const expiry = setInterval(
    sweep,
    Math.min(1_000, config.offerTimeoutMs, config.reconnectMs),
  );

  return {
    http,
    async listen() {
      await new Promise<void>((resolve, reject) => {
        http.once("error", reject);

        http.listen(config.port, config.host, () => {
          http.off("error", reject);
          resolve();
        });
      });

      const address = http.address();

      logEvent(logger, "info", "server.listening", {
        host: config.host,
        port:
          address && typeof address !== "string" ? address.port : config.port,
      });

      return http.address();
    },
    async close() {
      clearInterval(maintenance);
      clearInterval(expiry);
      for (const socket of connections.keys()) socket.terminate();

      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });

      if (http.listening)
        await new Promise<void>((resolve, reject) => {
          http.close((closeError) => {
            if (closeError) reject(closeError);
            else resolve();
          });
        });
    },
  };
};
