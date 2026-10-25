import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { type ClientState, DropClient, initialState } from "../src/lib/client";

test("server cancellation wins when RTC failure is delivered first", () => {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();

  const stub = (name: string, value: unknown) => {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));

    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  };

  const sockets: { current?: Socket } = {};

  class Socket {
    static OPEN = 1;

    readyState = 1;

    onopen: (() => void) | null = null;

    onclose: (() => void) | null = null;

    onmessage: ((event: { data: string }) => void) | null = null;

    onerror: (() => void) | null = null;

    constructor() {
      sockets.current = this;
    }

    send() {}

    close() {
      this.onclose?.();
    }

    receive(data: unknown) {
      this.onmessage?.({ data: JSON.stringify(data) });
    }
  }
  stub("WebSocket", Socket);
  stub("location", { protocol: "http:", hostname: "localhost" });

  stub("RTCPeerConnection", function () {
    throw new Error("Channel failed");
  });

  let state: ClientState = initialState;

  const client = new DropClient((next) => {
    state = next;
  });

  try {
    client.connect();

    const socket = sockets.current;

    assert(socket);
    socket.onopen?.();

    socket.receive({
      v: 1,
      type: "session",
      id: "ABCDEFGH",
      secret: "a".repeat(64),
      maxFileBytes: 1_000,
      offerTimeoutMs: 1_000,
      iceServers: [],
    });

    const id = randomUUID();

    socket.receive({
      v: 1,
      type: "incoming",
      transfer: {
        id,
        senderId: "JKLMNPQR",
        receiverId: "ABCDEFGH",
        senderName: "Test",
        file: { name: "file", size: 1, mime: "" },
        expiresAt: Date.now() + 1_000,
      },
    });

    socket.receive({
      v: 1,
      type: "accepted",
      transferId: id,
      iceServers: [],
    });

    assert.equal(state.transfer?.phase, "ended");
    assert.notEqual(state.transfer?.message, "Передача отменена.");

    socket.receive({
      v: 1,
      type: "ended",
      transferId: id,
      reason: "cancelled",
    });

    assert.equal(state.transfer?.message, "Передача отменена.");

    const pending = randomUUID();

    socket.receive({
      v: 1,
      type: "incoming",
      transfer: {
        id: pending,
        senderId: "JKLMNPQR",
        receiverId: "ABCDEFGH",
        senderName: "Test",
        file: { name: "file", size: 1, mime: "" },
        expiresAt: Date.now() + 1_000,
      },
    });

    client.cancel();
    assert.equal(state.transfer?.phase, "cancelling");

    socket.receive({
      v: 1,
      type: "accepted",
      transferId: pending,
      iceServers: [],
    });

    assert.equal(
      state.transfer?.phase,
      "cancelling",
      "cancelled offer must not start WebRTC",
    );

    socket.receive({
      v: 1,
      type: "ended",
      transferId: pending,
      reason: "cancelled",
    });

    assert.equal(state.transfer?.phase, "ended");
    assert.equal(state.transfer?.message, "Передача отменена.");

    socket.receive({
      v: 1,
      type: "ended",
      transferId: randomUUID(),
      reason: "expired",
    });

    assert.equal(state.transfer?.message, "Передача отменена.");
  } finally {
    client.dispose();

    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
