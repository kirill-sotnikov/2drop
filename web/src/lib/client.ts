import {
  type ClientMessage,
  CONNECT_TIMEOUT_MS,
  DEFAULT_MAX_FILE_BYTES,
  type EndReason,
  filesSchema,
  type IceServer,
  resumeSchema,
  type ServerMessage,
  serverMessageSchema,
  type Signal,
  totalFileBytes,
  type Transfer,
  VERSION,
} from "protocol";
import { FileChannel } from "./file-channel";
import { type ErrorKey, type StatusKey, UiError } from "./ui-error";

export interface TransferView {
  transfer: Transfer;
  direction: "send" | "receive";
  phase:
    | "offering"
    | "incoming"
    | "connecting"
    | "transferring"
    | "cancelling"
    | "complete"
    | "ended";
  bytes: number;
  message?: StatusKey;
}

export interface ClientState {
  connection: "connecting" | "online" | "reconnecting" | "error";
  id: string | null;
  maxFileBytes: number;
  transfer: TransferView | null;
  received: { url: string; file: File; files: Transfer["files"] } | null;
  error: ErrorKey | null;
}

export const initialState: ClientState = {
  connection: "connecting",
  id: null,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  transfer: null,
  received: null,
  error: null,
};

const reasonKey: Record<EndReason, StatusKey> = {
  complete: "fileSent",
  rejected: "errors.rejected",
  cancelled: "errors.cancelled",
  expired: "errors.expired",
  disconnected: "errors.disconnected",
  busy: "errors.busy",
  failed: "errors.failed",
  rotated: "errors.rotated",
};

const errors = new Map<string, ErrorKey>(
  Object.entries({
    unavailable: "recipientUnavailable",
    busy: "errors.busy",
    self: "errors.self",
    rate_limited: "errors.rateLimited",
    file_too_large: "errors.fileTooLarge",
    capacity: "errors.capacity",
    session_in_use: "errors.sessionInUse",
  }),
);

type LookupStatus = "available" | "unavailable" | "busy" | "self";

interface Active {
  transfer: Transfer;
  files?: File[];
  peer?: RTCPeerConnection;
  channel?: FileChannel;
  ice: RTCIceCandidateInit[];
  signalChain: Promise<void>;
  cancelling?: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const STORAGE_KEY = "2drop.session.v1";

export class DropClient {
  private state: ClientState = { ...initialState };

  private socket?: WebSocket;

  private stopped = false;

  private retry?: ReturnType<typeof setTimeout>;

  private helloTimer?: ReturnType<typeof setTimeout>;

  private attempts = 0;

  private active?: Active;

  private pendingOffer?: {
    requestId: string;
    files: File[];
    timer: ReturnType<typeof setTimeout>;
  };

  private lookups = new Map<
    string,
    {
      resolve: (status: LookupStatus) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private lastPaint = 0;

  constructor(private update: (state: ClientState) => void) {}

  private patch(patch: Partial<ClientState>) {
    this.state = { ...this.state, ...patch };
    this.update(this.state);
  }

  private view(patch: Partial<TransferView>) {
    if (this.state.transfer)
      this.patch({ transfer: { ...this.state.transfer, ...patch } });
  }

  private stored() {
    try {
      const result = resumeSchema.safeParse(
        JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null"),
      );

      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  private save(value?: { id: string; secret: string }) {
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* The session still works when browser storage is disabled. */
    }
  }

  connect = () => {
    if (this.stopped) return;

    const configured = process.env.NEXT_PUBLIC_SIGNALING_URL;

    if (!configured && location.protocol === "https:") {
      this.patch({
        connection: "error",
        error: "errors.missingSecureSignaling",
      });

      return;
    }

    const url =
      configured ||
      `ws://${location.hostname.includes(":") ? `[${location.hostname}]` : location.hostname}:3001/ws`;

    let socket: WebSocket;

    try {
      socket = new WebSocket(url);
    } catch {
      this.patch({
        connection: "error",
        error: "errors.invalidSignaling",
      });

      return;
    }

    this.socket = socket;
    this.patch({ connection: this.state.id ? "reconnecting" : "connecting" });
    this.helloTimer = setTimeout(() => socket.close(), 10_000);

    socket.onopen = () =>
      this.send({ v: VERSION, type: "hello", resume: this.stored() });

    socket.onmessage = (event: MessageEvent) => {
      if (this.stopped || socket !== this.socket) return;

      try {
        const parsed = serverMessageSchema.parse(JSON.parse(event.data));

        this.handle(parsed);
      } catch {
        this.patch({ error: "errors.invalidServerMessage" });
        socket.close();
      }
    };

    socket.onerror = () => {
      /* onclose owns retries. */
    };

    socket.onclose = () => {
      if (this.stopped || socket !== this.socket) return;
      clearTimeout(this.helloTimer);
      this.finishLocal("disconnected");
      this.clearRequests();
      this.patch({ connection: "reconnecting" });

      this.retry = setTimeout(
        this.connect,
        Math.min(10_000, 1_000 * 2 ** Math.min(this.attempts++, 4)),
      );
    };
  };

  private send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));

    return true;
  }

  lookup = (targetId: string): Promise<LookupStatus> =>
    new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timer = setTimeout(() => {
        this.lookups.delete(requestId);
        reject(new UiError("errors.lookupTimeout"));
      }, 8_000);

      this.lookups.set(requestId, { resolve, reject, timer });

      if (!this.send({ v: VERSION, type: "lookup", requestId, targetId })) {
        clearTimeout(timer);
        this.lookups.delete(requestId);
        reject(new UiError("errors.offline"));
      }
    });

  propose = (targetId: string, files: File[], senderName: string) => {
    if (this.active || this.pendingOffer) return;

    const metadata = files.map((file) => ({
      name: file.name,
      size: file.size,
      mime: file.type,
    }));

    if (!filesSchema.safeParse(metadata).success) {
      this.patch({ error: "errors.invalidFiles" });

      return;
    }

    if (totalFileBytes(files) > this.state.maxFileBytes) {
      this.patch({ error: "errors.fileTooLarge" });

      return;
    }

    const requestId = crypto.randomUUID();

    const timer = setTimeout(() => {
      this.pendingOffer = undefined;

      this.patch({
        error: "errors.offerTimeout",
      });

      this.socket?.close();
    }, 8_000);

    this.pendingOffer = { requestId, files: [...files], timer };
    this.patch({ error: null, transfer: null });

    if (
      !this.send({
        v: VERSION,
        type: "propose",
        requestId,
        targetId,
        files: metadata,
        senderName: senderName.trim() || this.state.id || "2drop",
      })
    ) {
      clearTimeout(timer);
      this.pendingOffer = undefined;
      this.patch({ error: "errors.offline" });
    }
  };

  decide = (accept: boolean) => {
    if (!this.active || this.state.transfer?.phase !== "incoming") return;

    if (accept) {
      if (
        totalFileBytes(this.active.transfer.files) > this.state.maxFileBytes
      ) {
        this.patch({ error: "errors.fileTooLarge" });

        return;
      }

      this.discardReceived();
      this.view({ phase: "connecting" });
    }

    this.send({
      v: VERSION,
      type: "decide",
      transferId: this.active.transfer.id,
      accept,
    });
  };

  cancel = () => {
    if (this.active) {
      const active = this.active;

      if (active.cancelling) return;
      active.cancelling = true;
      active.channel?.stop();
      clearTimeout(active.timer);

      this.view({
        phase: "cancelling",
        message: "transferProgress.cancelling",
      });

      if (
        !this.send({
          v: VERSION,
          type: "cancel",
          transferId: active.transfer.id,
        })
      ) {
        this.finishLocal("cancelled");

        return;
      }

      // Stop reading immediately, but keep RTC open until the server has decided
      // cancellation. Closing it earlier could race the other peer's failure report.
      active.timer = setTimeout(() => {
        if (this.active !== active) return;
        this.finishLocal("cancelled");
        this.socket?.close();
      }, 5_000);
    } else if (this.pendingOffer) {
      this.socket?.close();
    }
  };

  rotate = () => {
    this.send({ v: VERSION, type: "rotate" });
  };

  clearError = () => this.patch({ error: null });

  discardReceived = () => {
    if (this.state.received) URL.revokeObjectURL(this.state.received.url);
    this.patch({ received: null });
  };

  private handleError(message: Extract<ServerMessage, { type: "error" }>) {
    if (message.code === "unknown_transfer" && !this.active) return;

    if (message.code === "invalid_resume") {
      this.save();
      this.send({ v: VERSION, type: "hello" });

      return;
    }

    if (message.code === "session_in_use") {
      // Duplicating a tab can copy sessionStorage. Give reloads time to release
      // their socket, then create an independent session without taking ownership.
      if (this.attempts >= 2) {
        this.save();
        this.send({ v: VERSION, type: "hello" });
      } else {
        this.patch({ error: "errors.sessionInUse" });
        this.socket?.close();
      }

      return;
    }

    const lookup = message.requestId
      ? this.lookups.get(message.requestId)
      : undefined;

    const text = errors.get(message.code) || "errors.requestRejected";

    if (lookup && message.requestId) {
      clearTimeout(lookup.timer);
      this.lookups.delete(message.requestId);
      lookup.reject(new UiError(text));
    }

    if (
      this.pendingOffer &&
      message.requestId === this.pendingOffer.requestId
    ) {
      clearTimeout(this.pendingOffer.timer);
      this.pendingOffer = undefined;
    }

    this.patch({ error: text });
  }

  private handle(message: ServerMessage) {
    if (message.type === "session") {
      clearTimeout(this.helloTimer);
      this.attempts = 0;
      this.save({ id: message.id, secret: message.secret });

      this.patch({
        connection: "online",
        id: message.id,
        maxFileBytes: message.maxFileBytes,
        error: null,
      });
    } else if (message.type === "error") {
      this.handleError(message);
    } else if (message.type === "lookup") {
      const lookup = this.lookups.get(message.requestId);

      if (lookup) {
        clearTimeout(lookup.timer);
        this.lookups.delete(message.requestId);
        lookup.resolve(message.status);
      }
    } else if (message.type === "incoming" || message.type === "proposed") {
      let files: File[] | undefined;

      if (message.type === "incoming") {
        if (this.active || this.pendingOffer) {
          this.send({
            v: VERSION,
            type: "decide",
            transferId: message.transfer.id,
            accept: false,
          });

          return;
        }
      } else {
        if (this.pendingOffer?.requestId !== message.requestId) {
          this.send({
            v: VERSION,
            type: "cancel",
            transferId: message.transfer.id,
          });

          return;
        }

        files = this.pendingOffer.files;
        clearTimeout(this.pendingOffer.timer);
        this.pendingOffer = undefined;
      }

      this.active = {
        transfer: message.transfer,
        files,
        ice: [],
        signalChain: Promise.resolve(),
      };

      this.patch({
        error: null,
        transfer: {
          transfer: message.transfer,
          direction: files ? "send" : "receive",
          phase: files ? "offering" : "incoming",
          bytes: 0,
        },
      });
    } else if (
      message.type === "accepted" &&
      message.transferId === this.active?.transfer.id
    ) {
      if (this.active.cancelling) return;

      try {
        this.startPeer(this.active, message.iceServers);
      } catch {
        this.fail("errors.peerCreationFailed");
      }
    } else if (
      message.type === "signal" &&
      message.transferId === this.active?.transfer.id
    ) {
      const active = this.active;

      this.queueSignal(
        active,
        () => this.handleSignal(active, message.signal),
        "errors.signalFailed",
      );
    } else if (
      message.type === "ended" &&
      message.transferId === this.state.transfer?.transfer.id
    ) {
      if (this.active) this.finishLocal(message.reason);
      else if (
        this.state.transfer.phase === "ended" &&
        message.reason !== "failed"
      ) {
        // RTC can report channel closure before the signaling cancellation arrives.
        // The server's terminal decision still belongs to this transfer.
        this.view({
          phase: message.reason === "complete" ? "complete" : "ended",
          message: reasonKey[message.reason],
          ...(message.reason === "complete"
            ? { bytes: totalFileBytes(this.state.transfer.transfer.files) }
            : {}),
        });
      }
    }
  }

  private queueSignal(
    active: Active,
    action: () => Promise<void>,
    failure: ErrorKey,
  ) {
    const previous = active.signalChain;

    active.signalChain = (async () => {
      try {
        await previous;
        await action();
      } catch {
        if (this.active === active) this.fail(failure);
      }
    })();
  }

  private startPeer(active: Active, iceServers: IceServer[]) {
    if (active.peer) return;
    this.view({ phase: "connecting" });

    const peer = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy:
        process.env.NEXT_PUBLIC_ICE_TRANSPORT_POLICY === "relay"
          ? "relay"
          : "all",
    });

    active.peer = peer;

    active.timer = setTimeout(() => {
      if (this.active === active) this.fail("errors.peerTimeout");
    }, CONNECT_TIMEOUT_MS);

    peer.onicecandidate = (event) => {
      if (event.candidate && this.active === active && !active.cancelling)
        this.send({
          v: VERSION,
          type: "signal",
          transferId: active.transfer.id,
          signal: {
            kind: "ice",
            candidate: event.candidate.toJSON() as RTCIceCandidateInit & {
              candidate: string;
            },
          },
        });
    };

    peer.onconnectionstatechange = () => {
      if (
        this.active === active &&
        !active.cancelling &&
        ["failed", "disconnected"].includes(peer.connectionState)
      )
        this.fail("errors.peerDisconnected");
    };

    if (active.files) {
      this.attachChannel(
        active,
        peer.createDataChannel("file", { ordered: true }),
      );

      this.queueSignal(
        active,
        async () => {
          const offer = await peer.createOffer();

          if (this.active !== active || active.cancelling) return;
          if (!offer.sdp) throw new Error("Missing offer SDP");
          await peer.setLocalDescription(offer);

          this.send({
            v: VERSION,
            type: "signal",
            transferId: active.transfer.id,
            signal: { kind: "offer", sdp: offer.sdp },
          });
        },
        "errors.offerFailed",
      );
    } else
      peer.ondatachannel = (event) => {
        if (
          active.channel ||
          event.channel.label !== "file" ||
          !event.channel.ordered ||
          event.channel.maxRetransmits !== null ||
          event.channel.maxPacketLifeTime !== null
        ) {
          event.channel.close();
          this.fail("errors.invalidChannel");

          return;
        }

        this.attachChannel(active, event.channel);
      };
  }

  private async handleSignal(active: Active, signal: Signal) {
    if (this.active !== active || !active.peer || active.cancelling) return;

    const peer = active.peer;

    if (signal.kind === "ice") {
      if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
      else active.ice.push(signal.candidate);

      return;
    }

    if ((signal.kind === "offer") === Boolean(active.files))
      throw new Error("Wrong signaling role");
    await peer.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
    for (const candidate of active.ice.splice(0))
      await peer.addIceCandidate(candidate);

    if (signal.kind === "offer") {
      const answer = await peer.createAnswer();

      if (this.active !== active || active.cancelling) return;
      if (!answer.sdp) throw new Error("Missing answer SDP");
      await peer.setLocalDescription(answer);

      this.send({
        v: VERSION,
        type: "signal",
        transferId: active.transfer.id,
        signal: { kind: "answer", sdp: answer.sdp },
      });
    }
  }

  private attachChannel(active: Active, channel: RTCDataChannel) {
    channel.addEventListener(
      "open",
      () => {
        if (this.active !== active) return;
        clearTimeout(active.timer);
        this.view({ phase: "transferring" });
      },
      { once: true },
    );

    active.channel = new FileChannel(
      channel,
      active.transfer.id,
      active.transfer.files,
      this.state.maxFileBytes,
      () => active.peer?.sctp?.maxMessageSize ?? 0,
      active.files,
      {
        progress: (bytes) => {
          if (this.active !== active) return;

          if (
            Date.now() - this.lastPaint > 80 ||
            bytes === totalFileBytes(active.transfer.files)
          ) {
            this.lastPaint = Date.now();
            this.view({ bytes });
          }
        },
        received: (blob) => {
          if (this.active !== active) return;
          this.discardReceived();

          const firstName = active.transfer.files[0].name;
          const extensionIndex = firstName.lastIndexOf(".");

          const downloadName =
            active.transfer.files.length > 1
              ? `${extensionIndex > 0 ? firstName.slice(0, extensionIndex) : firstName}.zip`
              : firstName;

          const file = new File([blob], downloadName, {
            type: blob.type,
          });

          this.patch({
            received: {
              file,
              url: URL.createObjectURL(blob),
              files: active.transfer.files,
            },
          });

          // FileChannel sends ack after this callback. Delay signaling completion until then.
          queueMicrotask(() => {
            if (this.active === active) {
              this.send({
                v: VERSION,
                type: "complete",
                transferId: active.transfer.id,
              });

              this.finishLocal("complete");
            }
          });
        },
        acknowledged: () => {
          if (this.active === active) this.finishLocal("complete");
        },
        failed: (message) => {
          if (this.active === active) this.fail(message);
        },
      },
    );
  }

  private fail(message: ErrorKey) {
    if (this.active)
      this.send({
        v: VERSION,
        type: "fail",
        transferId: this.active.transfer.id,
      });
    this.finishLocal("failed", message);
  }

  private finishLocal(reason: EndReason, message = reasonKey[reason]) {
    const active = this.active;

    if (!active) return;
    this.active = undefined;
    clearTimeout(active.timer);
    active.channel?.dispose();

    if (active.peer) {
      active.peer.onicecandidate = null;
      active.peer.onconnectionstatechange = null;
      active.peer.ondatachannel = null;

      active.peer.close();
    }

    active.files = undefined;
    active.ice = [];

    this.view({
      phase: reason === "complete" ? "complete" : "ended",
      message,
      ...(reason === "complete"
        ? { bytes: totalFileBytes(active.transfer.files) }
        : {}),
    });
  }

  private clearRequests() {
    if (this.pendingOffer) clearTimeout(this.pendingOffer.timer);
    this.pendingOffer = undefined;

    for (const lookup of this.lookups.values()) {
      clearTimeout(lookup.timer);
      lookup.reject(new UiError("errors.connectionLost"));
    }

    this.lookups.clear();
  }

  dispose = () => {
    this.stopped = true;
    clearTimeout(this.retry);
    clearTimeout(this.helloTimer);
    this.finishLocal("disconnected");
    this.clearRequests();
    this.discardReceived();

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;

      this.socket.close();
    }
  };
}
