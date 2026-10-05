import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env");

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60000,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    baseURL: process.env.APP_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
