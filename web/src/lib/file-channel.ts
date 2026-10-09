import {
  BUFFER_HIGH_BYTES,
  BUFFER_LOW_BYTES,
  channelMessageSchema,
  DEFAULT_CHUNK_BYTES,
  PROGRESS_TIMEOUT_MS,
  VERSION,
  type FileMetadata,
} from "protocol";

// Kept separate from WebRTC so byte limits and completion can be tested without a browser.
export class ReceiveBuffer {
  private parts: ArrayBuffer[] = [];
  bytes = 0;
  private started = false;
  private ended = false;
  constructor(
    private file: FileMetadata,
    private limit: number,
  ) {
    if (file.size > limit) throw new Error("Файл превышает допустимый размер.");
  }
  start(size: number) {
    if (this.started || this.ended || size !== this.file.size)
      throw new Error("Некорректное начало передачи.");
    this.started = true;
  }
  append(part: ArrayBuffer) {
    if (
      !this.started ||
      this.ended ||
      !part.byteLength ||
      this.bytes + part.byteLength > Math.min(this.file.size, this.limit)
    ) {
      throw new Error("Некорректный объём полученных данных.");
    }
    this.bytes += part.byteLength;
    this.parts.push(part);
  }
  finish() {
    if (!this.started || this.ended || this.bytes !== this.file.size)
      throw new Error("Файл получен не полностью.");
    this.ended = true;
    try {
      return new Blob(this.parts, {
        type: this.file.mime || "application/octet-stream",
      });
    } finally {
      this.parts = [];
    }
  }
  clear() {
    this.parts = [];
    this.ended = true;
  }
}

export class FileChannel {
  private abort = new AbortController();
  private receiver?: ReceiveBuffer;
  private timer: ReturnType<typeof setInterval>;
  private lastProgress = Date.now();
  private done = false;
  private sentEnd = false;
  constructor(
    private channel: RTCDataChannel,
    private id: string,
    private metadata: FileMetadata,
    private maxFileBytes: number,
    private maxMessageSize: () => number,
    private outgoing: File | undefined,
    private callbacks: {
      progress: (bytes: number) => void;
      received: (blob: Blob) => void;
      acknowledged: () => void;
      failed: (message: string) => void;
    },
  ) {
    if (!outgoing) this.receiver = new ReceiveBuffer(metadata, maxFileBytes);
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = BUFFER_LOW_BYTES;
    channel.onopen = () => {
      this.touch();
      if (outgoing)
        void this.sendFile().catch((error: unknown) => this.fail(error));
    };
    channel.onmessage = (event: MessageEvent) => {
      try {
        this.receive(event.data);
      } catch (error) {
        this.fail(error);
      }
    };
    channel.onerror = () => this.fail(new Error("Ошибка канала передачи."));
    channel.onclose = () => {
      if (!this.done && !this.abort.signal.aborted)
        this.fail(new Error("Канал закрыт. Повторите передачу с начала."));
    };
    this.timer = setInterval(() => {
      if (!this.done && Date.now() - this.lastProgress > PROGRESS_TIMEOUT_MS)
        this.fail(new Error("Передача остановилась. Повторите попытку."));
    }, 1000);
  }
  private touch() {
    this.lastProgress = Date.now();
  }
  private control(type: "start" | "end" | "ack") {
    this.channel.send(
      JSON.stringify({
        v: VERSION,
        type,
        transferId: this.id,
        ...(type === "start" ? { size: this.metadata.size } : {}),
      }),
    );
  }
  private async drain() {
    if (this.abort.signal.aborted) throw new Error("Передача отменена.");
    if (this.channel.readyState !== "open")
      throw new Error("Канал недоступен.");
    if (this.channel.bufferedAmount <= BUFFER_HIGH_BYTES) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.channel.removeEventListener("bufferedamountlow", low);
        this.channel.removeEventListener("close", closed);
        this.abort.signal.removeEventListener("abort", closed);
      };
      const low = () => {
        cleanup();
        resolve();
      };
      const closed = () => {
        cleanup();
        reject(new Error("Передача прервана."));
      };
      this.channel.addEventListener("bufferedamountlow", low);
      this.channel.addEventListener("close", closed);
      this.abort.signal.addEventListener("abort", closed);
      if (this.channel.bufferedAmount <= BUFFER_LOW_BYTES) low();
    });
  }
  private async sendFile() {
    const file = this.outgoing!;
    if (file.size !== this.metadata.size || file.size > this.maxFileBytes)
      throw new Error("Некорректный размер файла.");
    const negotiated = this.maxMessageSize();
    const chunk = Math.min(
      DEFAULT_CHUNK_BYTES,
      negotiated > 0 ? negotiated : DEFAULT_CHUNK_BYTES,
    );
    this.control("start");
    for (let offset = 0; offset < file.size;) {
      await this.drain();
      const bytes = await file.slice(offset, offset + chunk).arrayBuffer();
      if (this.abort.signal.aborted) return;
      this.channel.send(bytes);
      offset += bytes.byteLength;
      this.touch();
      this.callbacks.progress(offset);
    }
    await this.drain();
    this.sentEnd = true;
    this.control("end");
  }
  private receive(data: unknown) {
    if (this.done || this.abort.signal.aborted) return;
    if (data instanceof ArrayBuffer) {
      if (!this.receiver) throw new Error("Неожиданные бинарные данные.");
      this.receiver.append(data);
      this.touch();
      this.callbacks.progress(this.receiver.bytes);
      return;
    }
    if (typeof data !== "string" || data.length > 2048)
      throw new Error("Некорректное сообщение канала.");
    const message = channelMessageSchema.parse(JSON.parse(data));
    if (message.transferId !== this.id)
      throw new Error("Данные другой передачи.");
    if (message.type === "start" && this.receiver)
      this.receiver.start(message.size);
    else if (message.type === "end" && this.receiver) {
      const blob = this.receiver.finish();
      this.callbacks.received(blob);
      this.control("ack");
      this.done = true;
    } else if (message.type === "ack" && this.outgoing && this.sentEnd) {
      this.done = true;
      this.callbacks.acknowledged();
    } else throw new Error("Нарушен порядок передачи.");
    this.touch();
  }
  private fail(error: unknown) {
    if (this.done || this.abort.signal.aborted) return;
    this.done = true;
    try {
      this.callbacks.failed(
        error instanceof Error ? error.message : "Ошибка передачи.",
      );
    } finally {
      this.dispose();
    }
  }
  stop() {
    this.abort.abort();
    clearInterval(this.timer);
    this.receiver?.clear();
    this.outgoing = undefined;
    this.channel.onopen =
      this.channel.onmessage =
      this.channel.onerror =
      this.channel.onclose =
        null;
  }
  dispose() {
    this.stop();
    this.channel.close();
  }
}
