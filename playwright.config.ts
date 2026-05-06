import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_URL = "file:./data/e2e-runtime.sqlite";
process.env.DATABASE_URL = E2E_DATABASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  workers: 1,
  webServer: {
    command: "node --import tsx scripts/e2e-prepare.mjs && npm run dev",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      ROOT_PASSWORD: "e2e-root-password",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
