import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import {
  type ClientMessage,
  clientMessageSchema,
  filesSchema,
  MAX_FILES_PER_TRANSFER,
  normalizeId,
  type ServerMessage,
  type Transfer,
  VERSION,
} from "protocol";
import { WebSocket } from "ws";
import { readConfig } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import { createSignalingServer, makeTurnCredentials } from "../src/server.js";

type OfType<T extends ServerMessage["type"]> = Extract<
  ServerMessage,
  { type: T }
>;

class Client {
  socket: WebSocket;

  private messages: ServerMessage[] = [];

  private listeners = new Set<() => void>();

  constructor(url: string) {
    this.socket = new WebSocket(url, { origin: "https://2drop.test" });

    this.socket.on("message", (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const notify of this.listeners) notify();
    });

    this.socket.on("error", () => {});
  }

  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }

  next<T extends ServerMessage["type"]>(type: T): Promise<OfType<T>> {
    return new Promise((resolve, reject) => {
      const deadline: { timer?: ReturnType<typeof setTimeout> } = {};

      const check = () => {
        const index = this.messages.findIndex(
          (message) => message.type === type,
        );

        if (index < 0) return;
        clearTimeout(deadline.timer);
        this.listeners.delete(check);
        resolve(this.messages.splice(index, 1)[0] as OfType<T>);
      };

      deadline.timer = setTimeout(() => {
        this.listeners.delete(check);

        reject(
          new Error(
            `Timed out waiting for ${type}; queued ${JSON.stringify(this.messages)}`,
          ),
        );
      }, 2_000);

      this.listeners.add(check);
      check();
    });
  }

  async hello(resume?: { id: string; secret: string }) {
    this.send({ v: VERSION, type: "hello", resume });

    return this.next("session");
  }

  async disconnect() {
    const closed = once(this.socket, "close");

    this.socket.close();
    await closed;
  }
}

const setup = async (
  testContext: TestContext,
  overrides: Parameters<typeof readConfig>[0] = {},
  generateId?: () => string,
) => {
  const config = readConfig({
    PORT: "0",
    HOST: "127.0.0.1",
    ALLOWED_ORIGINS: "https://2drop.test",
    HEARTBEAT_MS: "60000",
    ...overrides,
  });

  const logs: Array<Record<string, unknown>> = [];

  const logger = createLogger(config, {
    write(line) {
      logs.push(JSON.parse(line) as Record<string, unknown>);
    },
  });

  const server = createSignalingServer(config, generateId, logger);
  const address = await server.listen();

  assert(address && typeof address !== "string");

  const origin = `http://127.0.0.1:${address.port}`;

  testContext.after(() => server.close());

  const client = async () => {
    const connection = new Client(origin.replace("http", "ws") + "/ws");

    await once(connection.socket, "open");

    return connection;
  };

  return { server, origin, client, logs };
};

const offer = async (
  sender: Client,
  receiver: Client,
  receiverId: string,
): Promise<Transfer> => {
  sender.send({
    v: VERSION,
    type: "propose",
    requestId: randomUUID(),
    targetId: receiverId,
    senderName: "Тест",
    files: [{ name: "файл.bin", size: 7, mime: "application/octet-stream" }],
  });

  const message = await sender.next("proposed");

  assert.equal(
    (await receiver.next("incoming")).transfer.id,
    message.transfer.id,
  );

  return message.transfer;
};

test("ID normalization and runtime protocol validation", () => {
  assert.equal(normalizeId("  k7m4-p9rx  "), "K7M4P9RX");
  for (const invalid of [
    "K7M4 P9RX",
    "K7M4P9R0",
    "K7M4P9RI",
    "K7M4P9R",
    "<script>",
  ])
    assert.equal(normalizeId(invalid), null);

  assert.equal(
    clientMessageSchema.safeParse({ v: VERSION + 1, type: "hello" }).success,
    false,
  );

  assert.equal(
    clientMessageSchema.safeParse({
      v: VERSION,
      type: "propose",
      files: [{ size: -1 }],
    }).success,
    false,
  );
});

test("file manifests reject empty lists, excessive counts, unsafe totals and oversized metadata", () => {
  const file = { name: "file", size: 1, mime: "" };

  assert.equal(filesSchema.safeParse([]).success, false);

  assert.equal(
    filesSchema.safeParse(
      Array.from({ length: MAX_FILES_PER_TRANSFER + 1 }, () => file),
    ).success,
    false,
  );

  assert.equal(
    filesSchema.safeParse([{ ...file, size: Number.MAX_SAFE_INTEGER }, file])
      .success,
    false,
  );

  assert.equal(
    filesSchema.safeParse(
      Array.from({ length: MAX_FILES_PER_TRANSFER }, () => ({
        ...file,
        name: "x".repeat(1_024),
      })),
    ).success,
    false,
  );
});

test("a batch is offered and accepted as one transfer and the server enforces its combined size", async (testContext) => {
  const { client } = await setup(testContext, { MAX_FILE_BYTES: "7" });
  const sender = await client();
  const receiver = await client();

  await sender.hello();

  const session = await receiver.hello();

  const propose = (sizes: number[]) =>
    sender.send({
      v: VERSION,
      type: "propose",
      requestId: randomUUID(),
      targetId: session.id,
      senderName: "Test",
      files: sizes.map((size, index) => ({
        name: `file-${index}`,
        size,
        mime: "",
      })),
    });

  propose([4, 4]);
  assert.equal((await sender.next("error")).code, "file_too_large");
  propose([0, 3, 4]);

  const { transfer } = await sender.next("proposed");

  assert.deepEqual(
    (await receiver.next("incoming")).transfer.files,
    transfer.files,
  );

  assert.deepEqual(
    transfer.files.map((file) => file.size),
    [0, 3, 4],
  );

  sender.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });

  assert.equal((await sender.next("error")).code, "consent_required");

  receiver.send({
    v: VERSION,
    type: "decide",
    transferId: transfer.id,
    accept: true,
  });

  assert.equal((await sender.next("accepted")).transferId, transfer.id);
  await receiver.next("accepted");
  sender.send({ v: VERSION, type: "cancel", transferId: transfer.id });
  assert.equal((await receiver.next("ended")).reason, "cancelled");
});

test("health, unknown routes, and disallowed WebSocket origins", async (testContext) => {
  const { origin } = await setup(testContext);
  const response = await fetch(origin + "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });

  assert.equal(
    (await fetch(origin + "/health", { method: "POST" })).status,
    404,
  );

  assert.equal((await fetch(origin + "/other")).status, 404);

  const ws = new WebSocket(origin.replace("http", "ws") + "/ws", {
    origin: "https://attacker.test",
  });

  const [error] = await once(ws, "error");

  assert.match(String(error), /403/u);
});

test("metrics expose process state, isolate server registries, and support bearer authentication", async (testContext) => {
  const first = await setup(testContext, {
    METRICS_TOKEN: "metrics-test-token",
  });

  const second = await setup(testContext);

  for (const authorization of [
    undefined,
    "Bearer wrong",
    "Basic metrics-test-token",
  ]) {
    const unauthorized = await fetch(first.origin + "/metrics", {
      headers: authorization ? { Authorization: authorization } : {},
    });

    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("www-authenticate"), "Bearer");
    assert.equal(await unauthorized.text(), "");
  }

  const owner = await first.client();

  await owner.hello();

  const response = await fetch(first.origin + "/metrics", {
    headers: { Authorization: "Bearer metrics-test-token" },
  });

  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/plain/u);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(body, /signaling_connections\{service="signaling"\} 1/u);
  assert.match(body, /signaling_sessions\{service="signaling"\} 1/u);
  assert.match(body, /process_resident_memory_bytes\{service="signaling"\} /u);
  assert.match(body, /nodejs_eventloop_lag_seconds\{service="signaling"\} /u);

  const otherBody = await (await fetch(second.origin + "/metrics")).text();

  assert.match(
    otherBody,
    /signaling_connections_total\{service="signaling"\} 0/u,
  );

  assert.match(otherBody, /signaling_sessions\{service="signaling"\} 0/u);
  assert.equal((await fetch(first.origin + "/health")).status, 200);

  assert.equal(
    (await fetch(first.origin + "/metrics", { method: "POST" })).status,
    404,
  );
});

test("transfer metrics and structured logs correlate events without recording payloads or secrets", async (testContext) => {
  const { client, origin, logs } = await setup(testContext, {
    TURN_URLS: "turn:turn.test:3478",
    TURN_SECRET: "private-turn-secret",
    APP_VERSION: "test-release",
    NODE_ENV: "test",
  });

  const sender = await client();
  const receiver = await client();
  const senderSession = await sender.hello();
  const receiverSession = await receiver.hello();
  const requestId = randomUUID();

  sender.send({
    v: VERSION,
    type: "propose",
    requestId,
    targetId: receiverSession.id,
    senderName: "private-sender-name",
    files: [{ name: "private-file-name.txt", size: 7, mime: "private-mime" }],
  });

  const { transfer } = await sender.next("proposed");

  await receiver.next("incoming");

  assert.deepEqual(
    new Set(Object.keys(transfer)),
    new Set([
      "expiresAt",
      "files",
      "id",
      "receiverId",
      "senderId",
      "senderName",
    ]),
  );

  const scrape = async () => (await fetch(origin + "/metrics")).text();

  assert.match(
    await scrape(),
    /signaling_transfers\{stage="pending",service="signaling"\} 1/u,
  );

  receiver.send({
    v: VERSION,
    type: "decide",
    transferId: transfer.id,
    accept: true,
  });

  await sender.next("accepted");
  await receiver.next("accepted");

  assert.match(
    await scrape(),
    /signaling_transfers\{stage="accepted",service="signaling"\} 1/u,
  );

  sender.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "private-sdp" },
  });

  await receiver.next("signal");

  sender.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "ice", candidate: { candidate: "private-ice-candidate" } },
  });

  await receiver.next("signal");
  receiver.send({ v: VERSION, type: "complete", transferId: transfer.id });
  await sender.next("ended");
  await receiver.next("ended");

  // A repeated terminal message is a protocol error, never a second completion.
  receiver.send({ v: VERSION, type: "complete", transferId: transfer.id });
  assert.equal((await receiver.next("error")).code, "unknown_transfer");

  sender.socket.send(
    JSON.stringify({ v: VERSION, type: "private-unknown-message" }),
  );

  assert.equal((await sender.next("error")).code, "invalid_message");

  const body = await scrape();

  assert.match(
    body,
    /signaling_transfers_proposed_total\{service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfers_accepted_total\{service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfers_ended_total\{reason="complete",stage="accepted",service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfer_duration_seconds_count\{service="signaling",reason="complete"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfers\{stage="accepted",service="signaling"\} 0/u,
  );

  assert.match(
    body,
    /signaling_transfers\{stage="pending",service="signaling"\} 0/u,
  );

  assert.match(
    body,
    /signaling_messages_received_total\{type="invalid",service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_protocol_errors_total\{code="unknown_transfer",service="signaling"\} 1/u,
  );

  assert.equal(body.includes("private-unknown-message"), false);
  assert.equal(body.includes(transfer.id), false);
  assert.equal(body.includes(requestId), false);

  const lifecycle = logs.filter(
    (entry) =>
      entry.transferId === transfer.id &&
      String(entry.event).startsWith("transfer."),
  );

  assert.deepEqual(
    lifecycle.map((entry) => entry.event),
    ["transfer.proposed", "transfer.accepted", "transfer.ended"],
  );

  for (const entry of lifecycle) {
    assert.equal(entry.requestId, requestId);
    assert.equal(entry.senderSessionId, lifecycle[0].senderSessionId);
    assert.equal(entry.receiverSessionId, lifecycle[0].receiverSessionId);
  }

  assert.equal(lifecycle[0].sessionId, lifecycle[0].senderSessionId);
  assert.equal(lifecycle[1].sessionId, lifecycle[0].receiverSessionId);

  assert.equal(
    lifecycle[0].connectionId,
    logs.find((entry) => entry.sessionId === lifecycle[0].senderSessionId)
      ?.connectionId,
  );

  for (const entry of logs) {
    assert.match(String(entry.eventId), /^[\da-f-]{36}$/u);
    assert.equal(entry.service, "signaling");
    assert.equal(entry.environment, "test");
    assert.equal(entry.version, "test-release");
    assert.equal(Number.isNaN(Date.parse(String(entry.time))), false);
  }

  assert.equal(new Set(logs.map((entry) => entry.eventId)).size, logs.length);

  const output = JSON.stringify(logs);

  for (const value of [
    senderSession.id,
    senderSession.secret,
    receiverSession.id,
    receiverSession.secret,
    "private-turn-secret",
    "private-sender-name",
    "private-file-name.txt",
    "private-mime",
    "private-sdp",
    "private-ice-candidate",
    "private-unknown-message",
    senderSession.iceServers[0]?.credential,
  ]) {
    assert(value);

    assert.equal(
      output.includes(value),
      false,
      `Unexpected sensitive value in logs: ${value}`,
    );
  }
});

test("rejected offers and disconnected transfers have separate outcomes and durations", async (testContext) => {
  const { client, origin } = await setup(testContext);
  const sender = await client();
  const receiver = await client();

  await sender.hello();

  const session = await receiver.hello();
  const rejected = await offer(sender, receiver, session.id);

  receiver.send({
    v: VERSION,
    type: "decide",
    transferId: rejected.id,
    accept: false,
  });

  await sender.next("ended");
  await receiver.next("ended");

  const accepted = await offer(sender, receiver, session.id);

  receiver.send({
    v: VERSION,
    type: "decide",
    transferId: accepted.id,
    accept: true,
  });

  await sender.next("accepted");
  await receiver.next("accepted");
  await receiver.disconnect();
  assert.equal((await sender.next("ended")).reason, "disconnected");

  const body = await (await fetch(origin + "/metrics")).text();

  assert.match(
    body,
    /signaling_transfers_ended_total\{reason="rejected",stage="pending",service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfers_ended_total\{reason="disconnected",stage="accepted",service="signaling"\} 1/u,
  );

  assert.match(
    body,
    /signaling_transfer_duration_seconds_count\{service="signaling",reason="disconnected"\} 1/u,
  );

  assert.doesNotMatch(
    body,
    /signaling_transfer_duration_seconds_count\{[^\n]*reason="rejected"/u,
  );

  assert.match(body, /signaling_connections\{service="signaling"\} 1/u);
  assert.match(body, /signaling_sessions\{service="signaling"\} 2/u);

  assert.match(
    body,
    /signaling_connection_duration_seconds_count\{service="signaling"\} 1/u,
  );
});

test("session secrets, collision handling, exclusive ownership, recovery and expiry", async (testContext) => {
  let generation = 0;

  const { client } = await setup(testContext, { RECONNECT_MS: "40" }, () => {
    const id = ["ABCDEFGH", "ABCDEFGH", "JKLMNPQR", "STUVWXYZ"][generation++];

    assert(id);

    return id;
  });

  const owner = await client();
  const session = await owner.hello();
  const stranger = await client();

  stranger.send({
    v: VERSION,
    type: "hello",
    resume: { id: session.id, secret: "a".repeat(64) },
  });

  assert.equal((await stranger.next("error")).code, "invalid_resume");

  stranger.send({
    v: VERSION,
    type: "hello",
    resume: { id: session.id, secret: session.secret },
  });

  assert.equal((await stranger.next("error")).code, "session_in_use");

  const other = await stranger.hello();

  assert.notEqual(other.id, session.id);
  await owner.disconnect();

  const restored = await client();

  assert.equal((await restored.hello(session)).id, session.id);
  await restored.disconnect();

  await new Promise((resolve) => {
    setTimeout(resolve, 80);
  });

  const late = await client();

  late.send({
    v: VERSION,
    type: "hello",
    resume: { id: session.id, secret: session.secret },
  });

  assert.equal((await late.next("error")).code, "invalid_resume");
});

test("lookup marks disconnected sessions unavailable and rejects self", async (testContext) => {
  const { client } = await setup(testContext);
  const a = await client();
  const b = await client();
  const sa = await a.hello();
  const sb = await b.hello();

  a.send({
    v: VERSION,
    type: "lookup",
    requestId: randomUUID(),
    targetId: sa.id,
  });

  assert.equal((await a.next("lookup")).status, "self");
  await b.disconnect();

  a.send({
    v: VERSION,
    type: "lookup",
    requestId: randomUUID(),
    targetId: sb.id,
  });

  assert.equal((await a.next("lookup")).status, "unavailable");
});

test("consent, participant and role checks; accepted signaling and receiver completion", async (testContext) => {
  const { client } = await setup(testContext);

  const a = await client();
  const b = await client();
  const attacker = await client();

  await a.hello();

  const sb = await b.hello();

  await attacker.hello();

  const transfer = await offer(a, b, sb.id);

  a.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });

  assert.equal((await a.next("error")).code, "consent_required");

  attacker.send({
    v: VERSION,
    type: "decide",
    transferId: transfer.id,
    accept: true,
  });

  assert.equal((await attacker.next("error")).code, "unknown_transfer");
  a.send({ v: VERSION, type: "decide", transferId: transfer.id, accept: true });
  assert.equal((await a.next("error")).code, "invalid_state");
  b.send({ v: VERSION, type: "decide", transferId: transfer.id, accept: true });
  await a.next("accepted");
  await b.next("accepted");

  b.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });

  assert.equal((await b.next("error")).code, "invalid_state");

  a.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });

  assert.equal((await b.next("signal")).signal.kind, "offer");

  b.send({
    v: VERSION,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "answer", sdp: "v=0" },
  });

  assert.equal((await a.next("signal")).signal.kind, "answer");
  a.send({ v: VERSION, type: "complete", transferId: transfer.id });
  assert.equal((await a.next("error")).code, "unauthorized");
  b.send({ v: VERSION, type: "complete", transferId: transfer.id });
  assert.equal((await a.next("ended")).reason, "complete");
  assert.equal((await b.next("ended")).reason, "complete");
  b.send({ v: VERSION, type: "decide", transferId: transfer.id, accept: true });
  assert.equal((await b.next("error")).code, "unknown_transfer");
});

test("only one accepted file; competing offers end; rejection permits a new offer", async (testContext) => {
  const { client } = await setup(testContext);

  const a = await client();
  const b = await client();
  const thirdClient = await client();

  await a.hello();

  const sb = await b.hello();

  await thirdClient.hello();

  const first = await offer(a, b, sb.id);
  const second = await offer(thirdClient, b, sb.id);

  b.send({ v: VERSION, type: "decide", transferId: first.id, accept: true });
  await b.next("accepted");
  assert.equal((await thirdClient.next("ended")).reason, "busy");
  assert.equal((await b.next("ended")).transferId, second.id);
  a.send({ v: VERSION, type: "cancel", transferId: first.id });
  await a.next("ended");
  await b.next("ended");

  const next = await offer(thirdClient, b, sb.id);

  b.send({ v: VERSION, type: "decide", transferId: next.id, accept: false });
  assert.equal((await thirdClient.next("ended")).reason, "rejected");
  await b.next("ended");
  await offer(a, b, sb.id);
});

test("offer expiry and refresh invalidate invitations", async (testContext) => {
  const { client } = await setup(testContext, { OFFER_TIMEOUT_MS: "40" });

  const a = await client();
  const b = await client();

  await a.hello();

  const sb = await b.hello();

  await offer(a, b, sb.id);
  assert.equal((await a.next("ended")).reason, "expired");
  await b.next("ended");
  await offer(a, b, sb.id);
  b.send({ v: VERSION, type: "rotate" });

  const changed = await b.next("session");

  assert.notEqual(changed.id, sb.id);
  assert.equal((await a.next("ended")).reason, "rotated");

  a.send({
    v: VERSION,
    type: "lookup",
    requestId: randomUUID(),
    targetId: sb.id,
  });

  assert.equal((await a.next("lookup")).status, "unavailable");
});

test("disconnect aborts accepted transfer; file size and lookup rate limits enforced", async (testContext) => {
  const { client } = await setup(testContext, { MAX_FILE_BYTES: "7" });

  const a = await client();
  const b = await client();

  await a.hello();

  const sb = await b.hello();

  a.send({
    v: VERSION,
    type: "propose",
    requestId: randomUUID(),
    targetId: sb.id,
    senderName: "a",
    files: [{ name: "large", size: 8, mime: "" }],
  });

  assert.equal((await a.next("error")).code, "file_too_large");

  const transfer = await offer(a, b, sb.id);

  b.send({ v: VERSION, type: "decide", transferId: transfer.id, accept: true });
  await a.next("accepted");
  await b.disconnect();
  assert.equal((await a.next("ended")).reason, "disconnected");
  for (let index = 0; index < 61; index++)
    a.send({
      v: VERSION,
      type: "lookup",
      requestId: randomUUID(),
      targetId: sb.id,
    });
  assert.equal((await a.next("error")).code, "rate_limited");
});

test("temporary TURN credentials match coturn shared-secret HMAC", () => {
  const result = makeTurnCredentials(
    "test-secret",
    "ABCDEFGH",
    3_600,
    1_000_000,
  );

  assert.equal(result.username, "4600:ABCDEFGH");

  assert.equal(
    result.credential,
    createHmac("sha1", "test-secret").update(result.username).digest("base64"),
  );

  assert.throws(() => readConfig({ TURN_URLS: "turn:example.org" }));
});

test("restarting signaling invalidates previous session credentials", async (testContext) => {
  const first = await setup(testContext);
  const owner = await first.client();
  const session = await owner.hello();

  await first.server.close();

  const second = await setup(testContext);
  const restored = await second.client();

  restored.send({
    v: VERSION,
    type: "hello",
    resume: { id: session.id, secret: session.secret },
  });

  assert.equal((await restored.next("error")).code, "invalid_resume");

  const fresh = await restored.hello();

  assert.notEqual(fresh.id, session.id);
});
