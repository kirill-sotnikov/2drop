import { z } from "zod";

export const VERSION = 2;
export const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const DEFAULT_MAX_FILE_BYTES = 100_000_000;
export const MAX_FILES_PER_TRANSFER = 100;
export const MAX_MANIFEST_BYTES = 48 * 1_024;
export const DEFAULT_CHUNK_BYTES = 16 * 1_024;
export const BUFFER_HIGH_BYTES = 1_024 * 1_024;
export const BUFFER_LOW_BYTES = 256 * 1_024;
export const CONNECT_TIMEOUT_MS = 30_000;
export const PROGRESS_TIMEOUT_MS = 30_000;

export const normalizeId = (input: string): string | null => {
  const id = input.trim().replaceAll("-", "").toUpperCase();

  return /^[2-9A-HJ-NP-Z]{8}$/u.test(id) ? id : null;
};

export const formatId = (id: string): string => {
  return `${id.slice(0, 4)}-${id.slice(4)}`;
};

export const idSchema = z.string().regex(/^[2-9A-HJ-NP-Z]{8}$/u);

const uuid = z.uuid();
const base = { v: z.literal(VERSION) };

export const resumeSchema = z.object({
  id: idSchema,
  secret: z.string().regex(/^[\da-f]{64}$/u),
});
export const fileSchema = z.object({
  name: z.string().min(1).max(1_024),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  mime: z.string().max(256),
});
export type FileMetadata = z.infer<typeof fileSchema>;
export const totalFileBytes = (files: ReadonlyArray<{ size: number }>) =>
  files.reduce((total, file) => total + file.size, 0);

export const filesSchema = z
  .array(fileSchema)
  .min(1)
  .max(MAX_FILES_PER_TRANSFER)
  .refine(
    (files) => Number.isSafeInteger(totalFileBytes(files)),
    "Invalid total size",
  )
  // A UTF-16 code unit needs at most three UTF-8 bytes; leave room for the envelope.
  .refine(
    (files) => JSON.stringify(files).length <= MAX_MANIFEST_BYTES / 3,
    "File list is too large",
  );
export const signalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), sdp: z.string().min(1).max(48_000) }),
  z.object({ kind: z.literal("answer"), sdp: z.string().min(1).max(48_000) }),
  z.object({
    kind: z.literal("ice"),
    candidate: z.object({
      candidate: z.string().max(4_096),
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
    files: filesSchema,
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
  files: filesSchema,
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
  z.object({
    ...base,
    type: z.literal("file-start"),
    transferId: uuid,
    fileIndex: z.number().int().nonnegative(),
    size: z.number().int().nonnegative(),
  }),
  z.object({
    ...base,
    type: z.literal("file-end"),
    transferId: uuid,
    fileIndex: z.number().int().nonnegative(),
  }),
]);
