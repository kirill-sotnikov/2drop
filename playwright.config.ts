import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
    },
  },
  webServer: [
    {
      command: "yarn workspace service start",
      url: "http://127.0.0.1:3101/health",
      env: {
        PORT: "3101",
        HOST: "127.0.0.1",
        ALLOWED_ORIGINS: "http://127.0.0.1:3100",
        ICE_SERVERS_JSON: "[]",
        TURN_URLS: "",
        TURN_SECRET: "",
      },
    },
    {
      command: "yarn workspace web dev --port 3100 --hostname 127.0.0.1",
      url: "http://127.0.0.1:3100",
      env: { NEXT_PUBLIC_SIGNALING_URL: "ws://127.0.0.1:3101/ws" },
    },
  ],
});
