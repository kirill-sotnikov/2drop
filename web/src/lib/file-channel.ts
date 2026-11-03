import { Zip, ZipPassThrough } from "fflate";
import {
  BUFFER_HIGH_BYTES,
  BUFFER_LOW_BYTES,
  channelMessageSchema,
  DEFAULT_CHUNK_BYTES,
  type FileMetadata,
  filesSchema,
  PROGRESS_TIMEOUT_MS,
  totalFileBytes,
  VERSION,
} from "protocol";
import { archiveNames } from "./archive-names";

// Kept separate from WebRTC so byte limits and completion can be tested without a browser.
export class ReceiveBuffer {
  private parts: ArrayBuffer[] = [];

  bytes = 0;

  private started = false;

  private ended = false;

  private fileIndex = 0;

  private fileBytes = 0;

  private inFile = false;

  private zip?: Zip;

  private entry?: ZipPassThrough;

  private zipEnded = false;

  private names: string[];

  constructor(
    private files: FileMetadata[],
    private limit: number,
  ) {
    filesSchema.parse(files);
    if (totalFileBytes(files) > limit)
      throw new Error("Файлы превышают допустимый общий размер.");
    this.names = archiveNames(files.map((file) => file.name));

    if (files.length > 1) {
      this.zip = new Zip((error, data, final) => {
        if (error) throw error;
        this.parts.push(data.slice().buffer);
        if (final) this.zipEnded = true;
      });
    }
  }

  start(size: number) {
    if (this.started || this.ended || size !== totalFileBytes(this.files))
      throw new Error("Некорректное начало передачи.");
    this.started = true;
  }

  startFile(index: number, size: number) {
    if (
      !this.started ||
      this.ended ||
      this.inFile ||
      index !== this.fileIndex ||
      size !== this.files[index]?.size
    )
      throw new Error("Нарушен порядок файлов.");
    this.inFile = true;
    this.fileBytes = 0;

    if (this.zip) {
      this.entry = new ZipPassThrough(this.names[index]);
      this.zip.add(this.entry);
    }
  }

  endFile(index: number) {
    if (
      !this.inFile ||
      this.ended ||
      index !== this.fileIndex ||
      this.fileBytes !== this.files[index]?.size
    )
      throw new Error("Файл получен не полностью.");
    this.entry?.push(new Uint8Array(0), true);
    this.entry = undefined;
    this.inFile = false;
    this.fileIndex++;
  }

  append(part: ArrayBuffer) {
    if (
      !this.started ||
      this.ended ||
      !this.inFile ||
      !part.byteLength ||
      this.fileBytes + part.byteLength > this.files[this.fileIndex].size ||
      this.bytes + part.byteLength > this.limit
    ) {
      throw new Error("Некорректный объём полученных данных.");
    }

    this.bytes += part.byteLength;
    this.fileBytes += part.byteLength;
    if (this.entry) this.entry.push(new Uint8Array(part));
    else this.parts.push(part);
  }

  finish() {
    if (
      !this.started ||
      this.ended ||
      this.inFile ||
      this.fileIndex !== this.files.length ||
      this.bytes !== totalFileBytes(this.files)
    )
      throw new Error("Подборка получена не полностью.");
    this.ended = true;

    try {
      this.zip?.end();
      if (this.zip && !this.zipEnded)
        throw new Error("Не удалось собрать архив.");

      return new Blob(this.parts, {
        type: this.zip
          ? "application/zip"
          : this.files[0].mime || "application/octet-stream",
      });
    } finally {
      this.parts = [];
      this.zip = undefined;
      this.entry = undefined;
    }
  }

  clear() {
    this.parts = [];
    this.ended = true;
    this.zip?.terminate();
    this.zip = undefined;
    this.entry = undefined;
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
    private metadata: FileMetadata[],
    private maxFileBytes: number,
    private maxMessageSize: () => number,
    private outgoing: File[] | undefined,
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
    }, 1_000);
  }

  private touch() {
    this.lastProgress = Date.now();
  }

  private control(
    type: "start" | "end" | "ack" | "file-start" | "file-end",
    details: { size?: number; fileIndex?: number } = {},
  ) {
    this.channel.send(
      JSON.stringify({
        v: VERSION,
        type,
        transferId: this.id,
        ...details,
      }),
    );
  }

  private async drain() {
    if (this.abort.signal.aborted) throw new Error("Передача отменена.");
    if (this.channel.readyState !== "open")
      throw new Error("Канал недоступен.");
    if (this.channel.bufferedAmount <= BUFFER_HIGH_BYTES) return;

    await new Promise<void>((resolve, reject) => {
      const handlers = {
        cleanup: () => {
          this.channel.removeEventListener("bufferedamountlow", handlers.low);
          this.channel.removeEventListener("close", handlers.closed);
          this.abort.signal.removeEventListener("abort", handlers.closed);
        },
        low: () => {
          handlers.cleanup();
          resolve();
        },
        closed: () => {
          handlers.cleanup();
          reject(new Error("Передача прервана."));
        },
      };

      this.channel.addEventListener("bufferedamountlow", handlers.low);
      this.channel.addEventListener("close", handlers.closed);
      this.abort.signal.addEventListener("abort", handlers.closed);
      if (this.channel.bufferedAmount <= BUFFER_LOW_BYTES) handlers.low();
    });
  }

  private async sendFile() {
    const files = this.outgoing;

    if (!files) throw new Error("Нет файлов для отправки.");

    if (
      files.length !== this.metadata.length ||
      totalFileBytes(files) > this.maxFileBytes ||
      files.some(
        (file, index) =>
          file.size !== this.metadata[index].size ||
          file.name !== this.metadata[index].name ||
          file.type !== this.metadata[index].mime,
      )
    )
      throw new Error("Список файлов изменился.");

    const negotiated = this.maxMessageSize();

    const chunk = Math.min(
      DEFAULT_CHUNK_BYTES,
      negotiated > 0 ? negotiated : DEFAULT_CHUNK_BYTES,
    );

    this.control("start", { size: totalFileBytes(this.metadata) });

    let sent = 0;

    for (const [fileIndex, file] of files.entries()) {
      await this.drain();
      this.control("file-start", { fileIndex, size: file.size });

      for (let offset = 0; offset < file.size;) {
        await this.drain();

        const bytes = await file.slice(offset, offset + chunk).arrayBuffer();

        if (this.abort.signal.aborted) return;
        if (!bytes.byteLength) throw new Error("Не удалось прочитать файл.");
        this.channel.send(bytes);
        offset += bytes.byteLength;
        sent += bytes.byteLength;
        this.touch();
        this.callbacks.progress(sent);
      }

      await this.drain();
      this.control("file-end", { fileIndex });
      this.touch();
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

    if (typeof data !== "string" || data.length > 2_048)
      throw new Error("Некорректное сообщение канала.");

    const message = channelMessageSchema.parse(JSON.parse(data));

    if (message.transferId !== this.id)
      throw new Error("Данные другой передачи.");
    if (message.type === "start" && this.receiver)
      this.receiver.start(message.size);
    else if (message.type === "file-start" && this.receiver)
      this.receiver.startFile(message.fileIndex, message.size);
    else if (message.type === "file-end" && this.receiver)
      this.receiver.endFile(message.fileIndex);
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

    this.channel.onopen = null;
    this.channel.onmessage = null;
    this.channel.onerror = null;
    this.channel.onclose = null;
  }

  dispose() {
    this.stop();
    this.channel.close();
  }
}
