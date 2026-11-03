import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { BUFFER_HIGH_BYTES, totalFileBytes, VERSION } from "protocol";
import { archiveNames } from "../src/lib/archive-names";
import { FileChannel, ReceiveBuffer } from "../src/lib/file-channel";

test("receiver preserves arbitrary bytes and Unicode metadata; handles empty file", async () => {
  const original = Uint8Array.from(
    { length: 50_003 },
    (_, index) => index % 256,
  );

  const receiver = new ReceiveBuffer(
    [
      {
        name: "документ 📦.bin",
        size: original.length,
        mime: "application/octet-stream",
      },
    ],
    100_000,
  );

  receiver.start(original.length);
  receiver.startFile(0, original.length);
  for (let offset = 0; offset < original.length; offset += 16_384)
    receiver.append(original.slice(offset, offset + 16_384).buffer);

  receiver.endFile(0);

  const actual = await receiver.finish().arrayBuffer();

  const sha = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");

  assert.equal(sha(new Uint8Array(actual)), sha(original));
  assert.throws(() => receiver.finish());

  const empty = new ReceiveBuffer([{ name: "empty", size: 0, mime: "" }], 1);

  empty.start(0);
  empty.startFile(0, 0);
  empty.endFile(0);
  assert.equal(empty.finish().size, 0);
});

test("receiver refuses oversized, incomplete, out of order, repeated and cancelled data", () => {
  const file = { name: "file", size: 3, mime: "" };

  assert.throws(() => new ReceiveBuffer([file], 2));

  const buffer = new ReceiveBuffer([file], 3);

  assert.throws(() => buffer.append(new ArrayBuffer(1)));
  assert.throws(() => buffer.start(2));
  buffer.start(3);
  buffer.startFile(0, 3);
  assert.throws(() => buffer.start(3));
  assert.throws(() => buffer.append(new ArrayBuffer(4)));
  buffer.append(new ArrayBuffer(2));
  assert.throws(() => buffer.finish());
  buffer.clear();
  assert.throws(() => buffer.append(new ArrayBuffer(1)));
  assert.throws(() => buffer.finish());
});

test("seven received files become one uncompressed ZIP with exact bytes, empty entries and distinct names", async () => {
  const names = [
    "фото 📦.bin",
    "same.txt",
    "same.txt",
    "same (1).txt",
    "EMPTY",
    "empty",
    "../unsafe.txt",
  ];

  const payloads = names.map((_, index) =>
    new Uint8Array(index === 4 ? 0 : 40_003 + index).fill(index),
  );

  const files = names.map((name, index) => ({
    name,
    size: payloads[index].length,
    mime: "",
  }));

  const total = totalFileBytes(files);
  const receiver = new ReceiveBuffer(files, total);

  receiver.start(total);

  for (const [index, payload] of payloads.entries()) {
    receiver.startFile(index, payload.length);
    for (let offset = 0; offset < payload.length; offset += 16_384)
      receiver.append(payload.slice(offset, offset + 16_384).buffer);
    receiver.endFile(index);
  }

  const blob = receiver.finish();

  assert.equal(blob.type, "application/zip");

  const zip = new Uint8Array(await blob.arrayBuffer());
  const extracted = unzipSync(zip);
  const expectedNames = archiveNames(names);

  assert.equal(Object.keys(extracted).length, 7);
  for (const [index, name] of expectedNames.entries())
    assert.deepEqual(extracted[name], payloads[index]);

  // Every central-directory entry must use STORE (method 0), not DEFLATE.
  const directory = new DataView(zip.buffer);
  const end = zip.length - 22;

  assert.equal(directory.getUint32(end, true), 0x06_05_4b_50);

  let directoryOffset = directory.getUint32(end + 16, true);

  for (const file of files) {
    assert.equal(directory.getUint32(directoryOffset, true), 0x02_01_4b_50);
    assert.equal(directory.getUint16(directoryOffset + 10, true), 0);
    assert.equal(directory.getUint32(directoryOffset + 24, true), file.size);

    directoryOffset +=
      46 +
      directory.getUint16(directoryOffset + 28, true) +
      directory.getUint16(directoryOffset + 30, true) +
      directory.getUint16(directoryOffset + 32, true);
  }
});

test("batch receiver enforces total limits, individual boundaries, complete manifests and cancellation", () => {
  const files = [
    { name: "first", size: 2, mime: "" },
    { name: "second", size: 2, mime: "" },
  ];

  assert.throws(() => new ReceiveBuffer(files, 3));

  const receiver = new ReceiveBuffer(files, 4);

  receiver.start(4);
  assert.throws(() => receiver.startFile(1, 2));
  receiver.startFile(0, 2);
  assert.throws(() => receiver.startFile(0, 2));
  assert.throws(() => receiver.append(new ArrayBuffer(3)));
  receiver.append(new ArrayBuffer(2));
  assert.throws(() => receiver.endFile(1));
  receiver.endFile(0);
  assert.throws(() => receiver.endFile(0));
  assert.throws(() => receiver.finish());
  receiver.startFile(1, 2);
  receiver.append(new ArrayBuffer(1));
  assert.throws(() => receiver.endFile(1));
  receiver.clear();
  assert.throws(() => receiver.finish());
  assert.throws(() => receiver.append(new ArrayBuffer(1)));
});

test("archive names stay flat, unique and safe after Unicode normalization", () => {
  const names = archiveNames([
    "../a.txt",
    "..\\a.txt",
    "CON",
    "e\u0301.txt",
    "é.txt",
    "photo.jpg",
    "PHOTO.JPG",
    "photo (1).jpg",
  ]);

  assert.equal(
    new Set(names.map((name) => name.toLowerCase())).size,
    names.length,
  );

  for (const name of names)
    assert(
      !name.includes("/") && !name.includes("\\") && !name.startsWith("."),
    );
  assert.equal(names[2], "_CON");
});

class Channel extends EventTarget {
  readyState = "connecting";

  bufferedAmount = 0;

  bufferedAmountLowThreshold = 0;

  binaryType = "blob";

  sent: Array<string | ArrayBuffer> = [];

  onopen: (() => void) | null = null;

  onmessage: ((event: { data: unknown }) => void) | null = null;

  onerror: (() => void) | null = null;

  onclose: (() => void) | null = null;

  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }

  open() {
    this.readyState = "open";
    this.onopen?.();
  }

  close() {
    this.readyState = "closed";
    this.onclose?.();
    this.dispatchEvent(new Event("close"));
  }
}

const tick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 15);
  });

test("sender reads only on open, chunks to negotiated size and waits for receiver acknowledgement", async () => {
  const channel = new Channel();
  const id = randomUUID();
  const file = new File([new Uint8Array(5_000)], "file.bin");

  let acknowledged = false;

  const engine = new FileChannel(
    channel as unknown as RTCDataChannel,
    id,
    [{ name: file.name, size: file.size, mime: file.type }],
    10_000,
    () => 2_048,
    [file],
    {
      progress: () => {},
      received: () => assert.fail("sender cannot receive a file"),
      acknowledged: () => {
        acknowledged = true;
      },
      failed: (message) => assert.fail(message),
    },
  );

  assert.equal(channel.sent.length, 0);
  channel.open();
  await tick();

  assert.deepEqual(
    channel.sent
      .filter((part) => part instanceof ArrayBuffer)
      .map((part) => part.byteLength),
    [2_048, 2_048, 904],
  );

  assert.equal(acknowledged, false);

  channel.onmessage?.({
    data: JSON.stringify({ v: VERSION, type: "ack", transferId: id }),
  });

  assert.equal(acknowledged, true);
  engine.dispose();
});

test("backpressure blocks reads and cancellation clears a blocked send", async () => {
  const channel = new Channel();
  const file = new File([new Uint8Array(100)], "file.bin");

  channel.bufferedAmount = BUFFER_HIGH_BYTES + 1;

  const engine = new FileChannel(
    channel as unknown as RTCDataChannel,
    randomUUID(),
    [{ name: file.name, size: file.size, mime: file.type }],
    1_000,
    () => 0,
    [file],
    {
      progress: () => assert.fail("must not read ahead"),
      received: () => {},
      acknowledged: () => {},
      failed: () => assert.fail("cancellation must not report failure"),
    },
  );

  channel.open();
  await tick();
  assert.equal(channel.sent.length, 1);
  engine.stop();
  await tick();
  assert.equal(channel.sent.length, 1);

  assert.equal(
    channel.readyState,
    "open",
    "wait for signaling cancellation before closing RTC",
  );

  engine.dispose();
  assert.equal(channel.readyState, "closed");
});

test("receiver sends ack only after successful Blob assembly, rejects foreign transfer", () => {
  const channel = new Channel();
  const id = randomUUID();

  let received = false;

  const engine = new FileChannel(
    channel as unknown as RTCDataChannel,
    id,
    [{ name: "empty", size: 0, mime: "" }],
    1_000,
    () => 0,
    undefined,
    {
      progress: () => {},
      received: (blob) => {
        assert.equal(blob.size, 0);
        received = true;
      },
      acknowledged: () => assert.fail("receiver ack callback"),
      failed: (message) => assert.fail(message),
    },
  );

  channel.open();

  channel.onmessage?.({
    data: JSON.stringify({
      v: VERSION,
      type: "start",
      transferId: id,
      size: 0,
    }),
  });

  assert.equal(received, false);
  for (const type of ["file-start", "file-end"])
    channel.onmessage?.({
      data: JSON.stringify({
        v: VERSION,
        type,
        transferId: id,
        fileIndex: 0,
        size: 0,
      }),
    });

  channel.onmessage?.({
    data: JSON.stringify({ v: VERSION, type: "end", transferId: id }),
  });

  assert.equal(received, true);
  assert.equal(JSON.parse(channel.sent[0] as string).type, "ack");
  engine.dispose();

  const bad = new Channel();

  let failed = false;

  const other = new FileChannel(
    bad as unknown as RTCDataChannel,
    id,
    [{ name: "empty", size: 0, mime: "" }],
    1_000,
    () => 0,
    undefined,
    {
      progress: () => {},
      received: () => assert.fail(),
      acknowledged: () => {},
      failed: () => {
        failed = true;
      },
    },
  );

  bad.onmessage?.({
    data: JSON.stringify({
      v: VERSION,
      type: "start",
      transferId: randomUUID(),
      size: 0,
    }),
  });

  assert.equal(failed, true);
  other.dispose();
});
