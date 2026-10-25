import { readConfig } from "./config.js";
import { createLogger, logEvent } from "./logger.js";
import { createSignalingServer } from "./server.js";

const config = readConfig();
const logger = createLogger(config);
const server = createSignalingServer(config, undefined, logger);

try {
  await server.listen();

  if (!config.iceServers.length && !config.turnUrls.length) {
    logEvent(logger, "warn", "server.ice_unconfigured");
  }

  let stopping = false;

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logEvent(logger, "info", "server.stopping", { signal });

    try {
      await server.close();
      logEvent(logger, "info", "server.stopped");
      process.exitCode = 0;
    } catch (error) {
      logEvent(logger, "fatal", "server.error", { err: error as Error });
      process.exitCode = 1;
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
} catch (error) {
  logEvent(logger, "fatal", "server.error", { err: error as Error });
  await server.close();
  process.exitCode = 1;
}
