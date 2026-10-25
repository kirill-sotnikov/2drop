import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { type DestinationStream, type Logger, pino } from "pino";
import { type ServiceConfig } from "./config.js";

type EventName =
  | "server.listening"
  | "server.ice_unconfigured"
  | "server.stopping"
  | "server.stopped"
  | "server.error"
  | "metrics.error"
  | "connection.opened"
  | "connection.closed"
  | "connection.rejected"
  | "connection.terminated"
  | "websocket.error"
  | "session.created"
  | "session.resumed"
  | "session.rotated"
  | "session.expired"
  | "protocol.rejected"
  | "transfer.proposed"
  | "transfer.accepted"
  | "transfer.ended";

// Only operational metadata belongs here, never protocol payloads or public codes.
interface EventFields {
  connectionId?: string;
  sessionId?: string;
  previousSessionId?: string;
  senderSessionId?: string;
  receiverSessionId?: string;
  transferId?: string;
  requestId?: string;
  messageType?: string;
  reason?: string;
  stage?: string;
  durationSeconds?: number;
  code?: string;
  host?: string;
  port?: number;
  signal?: string;
  err?: Error;
}

export const createLogger = (
  config: ServiceConfig,
  destination?: DestinationStream,
): Logger => {
  return pino(
    {
      level: config.logLevel,
      base: {
        pid: process.pid,
        hostname: hostname(),
        service: "signaling",
        environment: config.environment,
        version: config.appVersion,
        instanceId: randomUUID(),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: {
        paths: [
          "secret",
          "credential",
          "authorization",
          "resume",
          "file",
          "senderName",
          "sdp",
          "candidate",
          "*.secret",
          "*.credential",
          "*.authorization",
        ],
        remove: true,
      },
    },
    destination,
  );
};

export const logEvent = (
  logger: Logger,
  level: "debug" | "info" | "warn" | "error" | "fatal",
  event: EventName,
  fields: EventFields = {},
) => {
  logger[level]({ ...fields, event, eventId: randomUUID() });
};
