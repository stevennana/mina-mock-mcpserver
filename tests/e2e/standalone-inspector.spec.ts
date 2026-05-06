import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const INSPECTOR_PORT = 3211;
const INSPECTOR_URL = `http://127.0.0.1:${INSPECTOR_PORT}`;

let inspector: ChildProcessWithoutNullStreams;

test.beforeAll(async () => {
  inspector = spawn("node", ["scripts/standalone-inspector-server.mjs", "--port", String(INSPECTOR_PORT)], {
    cwd: process.cwd(),
    env: process.env,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Standalone inspector did not start in time.")), 10_000);
    inspector.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Standalone MCP Inspector UI running")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    inspector.stderr.on("data", (chunk) => {
      const text = String(chunk);
      if (text.includes("EADDRINUSE")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
    inspector.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Standalone inspector exited before test start with code ${code ?? "unknown"}.`));
    });
  });
});

test.afterAll(() => {
  inspector?.kill();
});

test("standalone inspector UI runs Mock Server scenario and generic MCP inspection @ui-standalone-inspector", async ({ page, baseURL }) => {
  await page.goto(INSPECTOR_URL);

  await expect(page.getByRole("heading", { name: "MCP Inspector" })).toBeVisible();
  await expect(page.getByText("Allow self-signed HTTPS for this run").first()).toBeVisible();
  await page.getByLabel("Mock Server base URL").fill(baseURL ?? "http://127.0.0.1:3101");
  await page.locator("#mock-form").getByLabel("Allow self-signed HTTPS for this run").check();
  await page.getByRole("button", { name: "Run Mock Server scenario" }).click();

  const scenarioResults = page.locator("#mock-results");
  await expect(scenarioResults.getByText("Health and route config")).toBeVisible({ timeout: 20_000 });
  await expect(scenarioResults.getByText("OAuth Bearer runtime")).toBeVisible();
  await expect(scenarioResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(scenarioResults.getByText("delete temporary records")).toBeVisible();

  await page.getByLabel("MCP endpoint URL").fill(`${baseURL}/mcp/none`);
  await page.locator("#inspect-form").getByLabel("Allow self-signed HTTPS for this run").check();
  await page.getByLabel("Optional tool name").fill("echo");
  await page.getByLabel("Optional tool arguments JSON").fill('{"message":"hello"}');
  await page.getByRole("button", { name: "Run generic inspection" }).click();

  const genericResults = page.locator("#results");
  await expect(genericResults.getByText("MCP initialize")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.getByText("MCP tools/call")).toBeVisible();
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(genericResults.getByText("self-signed allowed")).toBeVisible();
});
