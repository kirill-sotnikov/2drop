import { readConfig } from "./config.js";
import { createSignalingServer } from "./server.js";

const config = readConfig();
const server = createSignalingServer(config);

await server.listen();

console.info(
  JSON.stringify({ event: "listening", host: config.host, port: config.port }),
);

if (!config.iceServers.length && !config.turnUrls.length) {
  console.info(
    JSON.stringify({
      event: "ice_unconfigured",
      message: "Local prototype only; configure STUN/TURN before public use.",
    }),
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await server.close();
    process.exitCode = 0;
  });
}
