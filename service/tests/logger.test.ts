import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../src/config.js";
import { createLogger, logEvent } from "../src/logger.js";

test("logger respects levels and retains diagnostic error stacks", () => {
  const lines: string[] = [];

  const logger = createLogger(readConfig({ LOG_LEVEL: "warn" }), {
    write(line) {
      lines.push(line);
    },
  });

  logEvent(logger, "info", "connection.opened", { connectionId: "connection" });
  logEvent(logger, "error", "server.error", { err: new Error("test failure") });
  assert.equal(lines.length, 1);

  const entry = JSON.parse(lines[0]) as {
    level: string;
    err: { type: string; message: string; stack: string };
  };

  assert.equal(entry.level, "error");
  assert.equal(entry.err.type, "Error");
  assert.equal(entry.err.message, "test failure");
  assert.match(entry.err.stack, /logger\.test\.ts/u);
  assert.throws(() => readConfig({ LOG_LEVEL: "typo" }));
});

test("logger redacts sensitive fields as defense in depth", () => {
  const lines: string[] = [];

  const logger = createLogger(readConfig({}), {
    write(line) {
      lines.push(line);
    },
  });

  logger.info({
    secret: "private-secret",
    credential: "private-credential",
    authorization: "private-authorization",
    resume: { id: "private-resume" },
    file: { name: "private-file" },
    senderName: "private-name",
    sdp: "private-sdp",
    candidate: "private-candidate",
    headers: { authorization: "private-header" },
    connectionId: "visible-connection",
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes("private-"), false);
  assert.equal(lines[0].includes("visible-connection"), true);
});
