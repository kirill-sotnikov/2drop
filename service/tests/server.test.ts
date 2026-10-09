import assert from "node:assert/strict";
import { once } from "node:events";
import { createHmac, randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import { WebSocket } from "ws";
import {
  VERSION,
  clientMessageSchema,
  normalizeId,
  type ClientMessage,
  type ServerMessage,
  type Transfer,
} from "protocol";
import { readConfig } from "../src/config.js";
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
      const timeout = setTimeout(() => {
        this.listeners.delete(check);
        reject(
          new Error(
            `Timed out waiting for ${type}; queued ${JSON.stringify(this.messages)}`,
          ),
        );
      }, 2000);
      const check = () => {
        const i = this.messages.findIndex((m) => m.type === type);
        if (i < 0) return;
        clearTimeout(timeout);
        this.listeners.delete(check);
        resolve(this.messages.splice(i, 1)[0] as OfType<T>);
      };
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
async function setup(
  t: TestContext,
  overrides: Parameters<typeof readConfig>[0] = {},
  generateId?: () => string,
) {
  const config = readConfig({
    PORT: "0",
    HOST: "127.0.0.1",
    ALLOWED_ORIGINS: "https://2drop.test",
    HEARTBEAT_MS: "60000",
    ...overrides,
  });
  const server = createSignalingServer(config, generateId);
  const address = await server.listen();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  t.after(() => server.close());
  async function client() {
    const connection = new Client(origin.replace("http", "ws") + "/ws");
    await once(connection.socket, "open");
    return connection;
  }
  return { server, origin, client };
}
async function offer(
  sender: Client,
  receiver: Client,
  receiverId: string,
): Promise<Transfer> {
  sender.send({
    v: VERSION,
    type: "propose",
    requestId: randomUUID(),
    targetId: receiverId,
    senderName: "Тест",
    file: { name: "файл.bin", size: 7, mime: "application/octet-stream" },
  });
  const message = await sender.next("proposed");
  assert.equal(
    (await receiver.next("incoming")).transfer.id,
    message.transfer.id,
  );
  return message.transfer;
}

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
    clientMessageSchema.safeParse({ v: 2, type: "hello" }).success,
    false,
  );
  assert.equal(
    clientMessageSchema.safeParse({ v: 1, type: "propose", file: { size: -1 } })
      .success,
    false,
  );
});
test("health, unknown routes, and disallowed WebSocket origins", async (t) => {
  const { origin } = await setup(t);
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
  assert.match(String(error), /403/);
});
test("session secrets, collision handling, exclusive ownership, recovery and expiry", async (t) => {
  let generation = 0;
  const { client } = await setup(
    t,
    { RECONNECT_MS: "40" },
    () => ["ABCDEFGH", "ABCDEFGH", "JKLMNPQR", "STUVWXYZ"][generation++]!,
  );
  const owner = await client();
  const session = await owner.hello();
  const stranger = await client();
  stranger.send({
    v: 1,
    type: "hello",
    resume: { id: session.id, secret: "a".repeat(64) },
  });
  assert.equal((await stranger.next("error")).code, "invalid_resume");
  stranger.send({
    v: 1,
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
  await new Promise((resolve) => setTimeout(resolve, 80));
  const late = await client();
  late.send({
    v: 1,
    type: "hello",
    resume: { id: session.id, secret: session.secret },
  });
  assert.equal((await late.next("error")).code, "invalid_resume");
});
test("lookup marks disconnected sessions unavailable and rejects self", async (t) => {
  const { client } = await setup(t);
  const a = await client();
  const b = await client();
  const sa = await a.hello();
  const sb = await b.hello();
  a.send({ v: 1, type: "lookup", requestId: randomUUID(), targetId: sa.id });
  assert.equal((await a.next("lookup")).status, "self");
  await b.disconnect();
  a.send({ v: 1, type: "lookup", requestId: randomUUID(), targetId: sb.id });
  assert.equal((await a.next("lookup")).status, "unavailable");
});
test("consent, participant and role checks; accepted signaling and receiver completion", async (t) => {
  const { client } = await setup(t);
  const a = await client(),
    b = await client(),
    attacker = await client();
  await a.hello();
  const sb = await b.hello();
  await attacker.hello();
  const transfer = await offer(a, b, sb.id);
  a.send({
    v: 1,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });
  assert.equal((await a.next("error")).code, "consent_required");
  attacker.send({
    v: 1,
    type: "decide",
    transferId: transfer.id,
    accept: true,
  });
  assert.equal((await attacker.next("error")).code, "unknown_transfer");
  a.send({ v: 1, type: "decide", transferId: transfer.id, accept: true });
  assert.equal((await a.next("error")).code, "invalid_state");
  b.send({ v: 1, type: "decide", transferId: transfer.id, accept: true });
  await a.next("accepted");
  await b.next("accepted");
  b.send({
    v: 1,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });
  assert.equal((await b.next("error")).code, "invalid_state");
  a.send({
    v: 1,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "offer", sdp: "v=0" },
  });
  assert.equal((await b.next("signal")).signal.kind, "offer");
  b.send({
    v: 1,
    type: "signal",
    transferId: transfer.id,
    signal: { kind: "answer", sdp: "v=0" },
  });
  assert.equal((await a.next("signal")).signal.kind, "answer");
  a.send({ v: 1, type: "complete", transferId: transfer.id });
  assert.equal((await a.next("error")).code, "unauthorized");
  b.send({ v: 1, type: "complete", transferId: transfer.id });
  assert.equal((await a.next("ended")).reason, "complete");
  assert.equal((await b.next("ended")).reason, "complete");
  b.send({ v: 1, type: "decide", transferId: transfer.id, accept: true });
  assert.equal((await b.next("error")).code, "unknown_transfer");
});
test("only one accepted file; competing offers end; rejection permits a new offer", async (t) => {
  const { client } = await setup(t);
  const a = await client(),
    b = await client(),
    c = await client();
  await a.hello();
  const sb = await b.hello();
  await c.hello();
  const first = await offer(a, b, sb.id);
  const second = await offer(c, b, sb.id);
  b.send({ v: 1, type: "decide", transferId: first.id, accept: true });
  await b.next("accepted");
  assert.equal((await c.next("ended")).reason, "busy");
  assert.equal((await b.next("ended")).transferId, second.id);
  a.send({ v: 1, type: "cancel", transferId: first.id });
  await a.next("ended");
  await b.next("ended");
  const next = await offer(c, b, sb.id);
  b.send({ v: 1, type: "decide", transferId: next.id, accept: false });
  assert.equal((await c.next("ended")).reason, "rejected");
  await b.next("ended");
  await offer(a, b, sb.id);
});
test("offer expiry and refresh invalidate invitations", async (t) => {
  const { client } = await setup(t, { OFFER_TIMEOUT_MS: "40" });
  const a = await client(),
    b = await client();
  await a.hello();
  const sb = await b.hello();
  await offer(a, b, sb.id);
  assert.equal((await a.next("ended")).reason, "expired");
  await b.next("ended");
  await offer(a, b, sb.id);
  b.send({ v: 1, type: "rotate" });
  const changed = await b.next("session");
  assert.notEqual(changed.id, sb.id);
  assert.equal((await a.next("ended")).reason, "rotated");
  a.send({ v: 1, type: "lookup", requestId: randomUUID(), targetId: sb.id });
  assert.equal((await a.next("lookup")).status, "unavailable");
});
test("disconnect aborts accepted transfer; file size and lookup rate limits enforced", async (t) => {
  const { client } = await setup(t, { MAX_FILE_BYTES: "7" });
  const a = await client(),
    b = await client();
  await a.hello();
  const sb = await b.hello();
  a.send({
    v: 1,
    type: "propose",
    requestId: randomUUID(),
    targetId: sb.id,
    senderName: "a",
    file: { name: "large", size: 8, mime: "" },
  });
  assert.equal((await a.next("error")).code, "file_too_large");
  const transfer = await offer(a, b, sb.id);
  b.send({ v: 1, type: "decide", transferId: transfer.id, accept: true });
  await a.next("accepted");
  await b.disconnect();
  assert.equal((await a.next("ended")).reason, "disconnected");
  for (let i = 0; i < 61; i++)
    a.send({ v: 1, type: "lookup", requestId: randomUUID(), targetId: sb.id });
  assert.equal((await a.next("error")).code, "rate_limited");
});
test("temporary TURN credentials match coturn shared-secret HMAC", () => {
  const result = makeTurnCredentials(
    "test-secret",
    "ABCDEFGH",
    3600,
    1_000_000,
  );
  assert.equal(result.username, "4600:ABCDEFGH");
  assert.equal(
    result.credential,
    createHmac("sha1", "test-secret").update(result.username).digest("base64"),
  );
  assert.throws(() => readConfig({ TURN_URLS: "turn:example.org" }));
});

test("restarting signaling invalidates previous session credentials", async (t) => {
  const first = await setup(t);
  const owner = await first.client();
  const session = await owner.hello();
  await first.server.close();
  const second = await setup(t);
  const restored = await second.client();
  restored.send({
    v: 1,
    type: "hello",
    resume: { id: session.id, secret: session.secret },
  });
  assert.equal((await restored.next("error")).code, "invalid_resume");
  const fresh = await restored.hello();
  assert.notEqual(fresh.id, session.id);
});
