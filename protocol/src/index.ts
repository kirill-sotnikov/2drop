import { z } from "zod";

export const VERSION = 1;
export const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const DEFAULT_MAX_FILE_BYTES = 100_000_000;
export const DEFAULT_CHUNK_BYTES = 16 * 1024;
export const BUFFER_HIGH_BYTES = 1024 * 1024;
export const BUFFER_LOW_BYTES = 256 * 1024;
export const CONNECT_TIMEOUT_MS = 30_000;
export const PROGRESS_TIMEOUT_MS = 30_000;

export function normalizeId(input: string): string | null {
  const id = input.trim().replaceAll("-", "").toUpperCase();
  return /^[2-9A-HJ-NP-Z]{8}$/.test(id) ? id : null;
}

export function formatId(id: string): string {
  return `${id.slice(0, 4)}-${id.slice(4)}`;
}

export const idSchema = z.string().regex(/^[2-9A-HJ-NP-Z]{8}$/);
const uuid = z.uuid();
const base = { v: z.literal(VERSION) };
export const resumeSchema = z.object({
  id: idSchema,
  secret: z.string().regex(/^[a-f0-9]{64}$/),
});
export const fileSchema = z.object({
  name: z.string().min(1).max(1024),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mime: z.string().max(256),
});
export type FileMetadata = z.infer<typeof fileSchema>;
export const signalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), sdp: z.string().min(1).max(48_000) }),
  z.object({ kind: z.literal("answer"), sdp: z.string().min(1).max(48_000) }),
  z.object({
    kind: z.literal("ice"),
    candidate: z.object({
      candidate: z.string().max(4096),
      sdpMid: z.string().max(256).nullable().optional(),
      sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    }),
  }),
]);
export type Signal = z.infer<typeof signalSchema>;
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("hello"),
    resume: resumeSchema.optional(),
  }),
  z.object({ ...base, type: z.literal("rotate") }),
  z.object({
    ...base,
    type: z.literal("lookup"),
    requestId: uuid,
    targetId: idSchema,
  }),
  z.object({
    ...base,
    type: z.literal("propose"),
    requestId: uuid,
    targetId: idSchema,
    file: fileSchema,
    senderName: z.string().trim().min(1).max(80),
  }),
  z.object({
    ...base,
    type: z.literal("decide"),
    transferId: uuid,
    accept: z.boolean(),
  }),
  z.object({
    ...base,
    type: z.literal("signal"),
    transferId: uuid,
    signal: signalSchema,
  }),
  z.object({ ...base, type: z.literal("cancel"), transferId: uuid }),
  z.object({ ...base, type: z.literal("complete"), transferId: uuid }),
  z.object({ ...base, type: z.literal("fail"), transferId: uuid }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const endReasonSchema = z.enum([
  "complete",
  "rejected",
  "cancelled",
  "expired",
  "disconnected",
  "busy",
  "failed",
  "rotated",
]);
export type EndReason = z.infer<typeof endReasonSchema>;
export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof iceServerSchema>;
export const transferSchema = z.object({
  id: uuid,
  senderId: idSchema,
  receiverId: idSchema,
  senderName: z.string().max(80),
  file: fileSchema,
  expiresAt: z.number(),
});
export type Transfer = z.infer<typeof transferSchema>;
export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("session"),
    id: idSchema,
    secret: z.string(),
    maxFileBytes: z.number().int().positive(),
    offerTimeoutMs: z.number().int().positive(),
    iceServers: z.array(iceServerSchema),
  }),
  z.object({
    ...base,
    type: z.literal("lookup"),
    requestId: uuid,
    targetId: idSchema,
    status: z.enum(["available", "unavailable", "busy", "self"]),
  }),
  z.object({
    ...base,
    type: z.literal("proposed"),
    requestId: uuid,
    transfer: transferSchema,
  }),
  z.object({ ...base, type: z.literal("incoming"), transfer: transferSchema }),
  z.object({
    ...base,
    type: z.literal("accepted"),
    transferId: uuid,
    iceServers: z.array(iceServerSchema),
  }),
  z.object({
    ...base,
    type: z.literal("signal"),
    transferId: uuid,
    signal: signalSchema,
  }),
  z.object({
    ...base,
    type: z.literal("ended"),
    transferId: uuid,
    reason: endReasonSchema,
  }),
  z.object({
    ...base,
    type: z.literal("error"),
    code: z.string(),
    requestId: uuid.optional(),
  }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const channelMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("start"),
    transferId: uuid,
    size: z.number().int().nonnegative(),
  }),
  z.object({ ...base, type: z.literal("end"), transferId: uuid }),
  z.object({ ...base, type: z.literal("ack"), transferId: uuid }),
]);
