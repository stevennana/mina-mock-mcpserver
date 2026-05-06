import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_URL = "file:./data/e2e-runtime.sqlite";
const E2E_PORT = Number(process.env.E2E_PORT ?? 3101);
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
process.env.DATABASE_URL = E2E_DATABASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  workers: 1,
  webServer: {
    command: `node --import tsx scripts/e2e-prepare.mjs && npx next dev --hostname 127.0.0.1 --port ${E2E_PORT}`,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      ROOT_PASSWORD: "e2e-root-password",
    },
    url: E2E_BASE_URL,
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
