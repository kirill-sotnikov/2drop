import { z } from "zod";
import { DEFAULT_MAX_FILE_BYTES, iceServerSchema } from "protocol";

const positive = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const schema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:8081,http://127.0.0.1:8081"),
  MAX_FILE_BYTES: positive(DEFAULT_MAX_FILE_BYTES),
  RECONNECT_MS: positive(120_000),
  OFFER_TIMEOUT_MS: positive(60_000),
  TRANSFER_TIMEOUT_MS: positive(1_800_000),
  HEARTBEAT_MS: positive(15_000),
  MAX_CONNECTIONS: positive(2000),
  MAX_CONNECTIONS_PER_IP: positive(20),
  MAX_SESSIONS: positive(4000),
  ICE_SERVERS_JSON: z.string().default("[]"),
  TURN_URLS: z.string().default(""),
  TURN_SECRET: z.string().default(""),
  TURN_TTL_SECONDS: positive(3600),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = schema.parse(env);
  const iceServers = z
    .array(iceServerSchema)
    .parse(JSON.parse(config.ICE_SERVERS_JSON));
  const turnUrls = config.TURN_URLS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (Boolean(turnUrls.length) !== Boolean(config.TURN_SECRET)) {
    throw new Error("TURN_URLS and TURN_SECRET must be configured together");
  }
  if (
    turnUrls.length &&
    config.TURN_TTL_SECONDS * 1000 <= config.TRANSFER_TIMEOUT_MS
  ) {
    throw new Error("TURN_TTL_SECONDS must exceed TRANSFER_TIMEOUT_MS");
  }
  return {
    port: config.PORT,
    host: config.HOST,
    allowedOrigins: config.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    maxFileBytes: config.MAX_FILE_BYTES,
    reconnectMs: config.RECONNECT_MS,
    offerTimeoutMs: config.OFFER_TIMEOUT_MS,
    transferTimeoutMs: config.TRANSFER_TIMEOUT_MS,
    heartbeatMs: config.HEARTBEAT_MS,
    maxConnections: config.MAX_CONNECTIONS,
    maxConnectionsPerIp: config.MAX_CONNECTIONS_PER_IP,
    maxSessions: config.MAX_SESSIONS,
    iceServers,
    turnUrls,
    turnSecret: config.TURN_SECRET,
    turnTtlSeconds: config.TURN_TTL_SECONDS,
  };
}
export type ServiceConfig = ReturnType<typeof readConfig>;
