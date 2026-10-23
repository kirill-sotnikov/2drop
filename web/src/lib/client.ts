import {
  CONNECT_TIMEOUT_MS,
  DEFAULT_MAX_FILE_BYTES,
  resumeSchema,
  serverMessageSchema,
  VERSION,
  type ClientMessage,
  type EndReason,
  type IceServer,
  type ServerMessage,
  type Signal,
  type Transfer,
} from "protocol";
import { FileChannel } from "./file-channel";

export type TransferView = {
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
  message?: string;
};

export type ClientState = {
  connection: "connecting" | "online" | "reconnecting" | "error";
  id: string | null;
  maxFileBytes: number;
  transfer: TransferView | null;
  received: { url: string; file: File; canShare: boolean } | null;
  error: string | null;
};

export const initialState: ClientState = {
  connection: "connecting",
  id: null,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  transfer: null,
  received: null,
  error: null,
};

export const reasonText: Record<EndReason, string> = {
  complete: "Файл получен получателем.",
  rejected: "Получатель отклонил передачу.",
  cancelled: "Передача отменена.",
  expired: "Время ожидания истекло.",
  disconnected: "Соединение потеряно. Повторите передачу с начала.",
  busy: "Участник занят другой передачей.",
  failed: "Не удалось передать файл. Повторите попытку.",
  rotated: "ID обновлён. Откройте новое приглашение.",
};

const errors: Record<string, string> = {
  unavailable: "Получатель недоступен.",
  busy: "Участник занят другой передачей.",
  self: "Укажите ID другого устройства.",
  rate_limited: "Слишком много запросов. Подождите минуту.",
  file_too_large: "Файл превышает допустимый размер.",
  capacity: "Сервис занят. Повторите попытку позже.",
  session_in_use:
    "Эта сессия уже открыта. Ожидаем отключения предыдущего соединения.",
};

type LookupStatus = "available" | "unavailable" | "busy" | "self";
type Active = {
  transfer: Transfer;
  file?: File;
  peer?: RTCPeerConnection;
  channel?: FileChannel;
  ice: RTCIceCandidateInit[];
  signalChain: Promise<void>;
  cancelling?: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

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
    file: File;
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
        error: "Не настроен защищённый адрес signaling-сервера.",
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
        error: "Некорректный адрес signaling-сервера.",
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
        this.patch({ error: "Сервер прислал некорректное сообщение." });
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
        Math.min(10_000, 1000 * 2 ** Math.min(this.attempts++, 4)),
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
        reject(new Error("Получатель не ответил. Повторите проверку."));
      }, 8000);
      this.lookups.set(requestId, { resolve, reject, timer });
      if (!this.send({ v: VERSION, type: "lookup", requestId, targetId })) {
        clearTimeout(timer);
        this.lookups.delete(requestId);
        reject(new Error("Нет соединения с сервером."));
      }
    });

  propose = (targetId: string, file: File, senderName: string) => {
    if (this.active || this.pendingOffer) return;
    if (file.size > this.state.maxFileBytes) {
      this.patch({ error: errors.file_too_large });
      return;
    }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      this.pendingOffer = undefined;
      this.patch({
        error: "Сервер не подтвердил предложение. Переподключаемся.",
      });
      this.socket?.close();
    }, 8000);
    this.pendingOffer = { requestId, file, timer };
    this.patch({ error: null, transfer: null });
    if (
      !this.send({
        v: VERSION,
        type: "propose",
        requestId,
        targetId,
        file: { name: file.name, size: file.size, mime: file.type },
        senderName: senderName.trim() || "Отправитель",
      })
    ) {
      clearTimeout(timer);
      this.pendingOffer = undefined;
      this.patch({ error: "Нет соединения с сервером." });
    }
  };

  decide = (accept: boolean) => {
    if (!this.active || this.state.transfer?.phase !== "incoming") return;
    if (accept) {
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
      this.view({ phase: "cancelling", message: "Отменяем передачу…" });
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
      }, 5000);
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
          this.patch({ error: errors.session_in_use });
          this.socket?.close();
        }
        return;
      }
      const lookup = message.requestId
        ? this.lookups.get(message.requestId)
        : undefined;
      const text =
        errors[message.code] || "Запрос отклонён сервером. Повторите попытку.";
      if (lookup) {
        clearTimeout(lookup.timer);
        this.lookups.delete(message.requestId!);
        lookup.reject(new Error(text));
      }
      if (message.requestId === this.pendingOffer?.requestId) {
        clearTimeout(this.pendingOffer!.timer);
        this.pendingOffer = undefined;
      }
      this.patch({ error: text });
    } else if (message.type === "lookup") {
      const lookup = this.lookups.get(message.requestId);
      if (lookup) {
        clearTimeout(lookup.timer);
        this.lookups.delete(message.requestId);
        lookup.resolve(message.status);
      }
    } else if (message.type === "incoming" || message.type === "proposed") {
      let file: File | undefined;
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
        file = this.pendingOffer.file;
        clearTimeout(this.pendingOffer.timer);
        this.pendingOffer = undefined;
      }
      this.active = {
        transfer: message.transfer,
        file,
        ice: [],
        signalChain: Promise.resolve(),
      };
      this.patch({
        error: null,
        transfer: {
          transfer: message.transfer,
          direction: file ? "send" : "receive",
          phase: file ? "offering" : "incoming",
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
        this.fail("Ваш браузер не смог создать WebRTC-соединение.");
      }
    } else if (
      message.type === "signal" &&
      message.transferId === this.active?.transfer.id
    ) {
      const active = this.active;
      active.signalChain = active.signalChain
        .then(() => this.handleSignal(active, message.signal))
        .catch(() => {
          if (this.active === active)
            this.fail("Не удалось установить соединение между устройствами.");
        });
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
          message: reasonText[message.reason],
          ...(message.reason === "complete"
            ? { bytes: this.state.transfer.transfer.file.size }
            : {}),
        });
      }
    }
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
      if (this.active === active)
        this.fail(
          "Не удалось соединить устройства. Проверьте сеть и настройки TURN.",
        );
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
        this.fail("Соединение потеряно. Повторите передачу с начала.");
    };
    if (active.file) {
      this.attachChannel(
        active,
        peer.createDataChannel("file", { ordered: true }),
      );
      active.signalChain = active.signalChain
        .then(async () => {
          const offer = await peer.createOffer();
          if (this.active !== active || active.cancelling) return;
          await peer.setLocalDescription(offer);
          this.send({
            v: VERSION,
            type: "signal",
            transferId: active.transfer.id,
            signal: { kind: "offer", sdp: offer.sdp! },
          });
        })
        .catch(() => {
          if (this.active === active)
            this.fail("Не удалось создать предложение WebRTC.");
        });
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
          this.fail("Некорректный файловый канал.");
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
    if ((signal.kind === "offer") === Boolean(active.file))
      throw new Error("Wrong signaling role");
    await peer.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
    for (const candidate of active.ice.splice(0))
      await peer.addIceCandidate(candidate);
    if (signal.kind === "offer") {
      const answer = await peer.createAnswer();
      if (this.active !== active || active.cancelling) return;
      await peer.setLocalDescription(answer);
      this.send({
        v: VERSION,
        type: "signal",
        transferId: active.transfer.id,
        signal: { kind: "answer", sdp: answer.sdp! },
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
      active.transfer.file,
      this.state.maxFileBytes,
      () => active.peer?.sctp?.maxMessageSize ?? 0,
      active.file,
      {
        progress: (bytes) => {
          if (this.active !== active) return;
          if (
            Date.now() - this.lastPaint > 80 ||
            bytes === active.transfer.file.size
          ) {
            this.lastPaint = Date.now();
            this.view({ bytes });
          }
        },
        received: (blob) => {
          if (this.active !== active) return;
          this.discardReceived();
          const file = new File([blob], active.transfer.file.name, {
            type: blob.type,
          });
          let canShare = false;
          try {
            canShare = navigator.canShare?.({ files: [file] }) ?? false;
          } catch {
            /* Download remains available. */
          }
          this.patch({
            received: { file, url: URL.createObjectURL(blob), canShare },
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
  private fail(message: string) {
    if (this.active)
      this.send({
        v: VERSION,
        type: "fail",
        transferId: this.active.transfer.id,
      });
    this.finishLocal("failed", message);
  }
  private finishLocal(reason: EndReason, message = reasonText[reason]) {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    clearTimeout(active.timer);
    active.channel?.dispose();
    if (active.peer) {
      active.peer.onicecandidate =
        active.peer.onconnectionstatechange =
        active.peer.ondatachannel =
          null;
      active.peer.close();
    }
    active.file = undefined;
    active.ice = [];
    this.view({
      phase: reason === "complete" ? "complete" : "ended",
      message,
      ...(reason === "complete" ? { bytes: active.transfer.file.size } : {}),
    });
  }
  private clearRequests() {
    if (this.pendingOffer) clearTimeout(this.pendingOffer.timer);
    this.pendingOffer = undefined;
    for (const lookup of this.lookups.values()) {
      clearTimeout(lookup.timer);
      lookup.reject(new Error("Соединение потеряно."));
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
      this.socket.onopen =
        this.socket.onclose =
        this.socket.onmessage =
        this.socket.onerror =
          null;
      this.socket.close();
    }
  };
}
