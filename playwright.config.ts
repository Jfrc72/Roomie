import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
loadEnvFile(existsSync(".env") ? ".env" : ".env.example");
const baseURL = process.env.APP_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
