import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const INSPECTOR_PORT = 3211;
const INSPECTOR_URL = `http://127.0.0.1:${INSPECTOR_PORT}`;

let inspector: ChildProcessWithoutNullStreams;

test.setTimeout(60_000);

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

  await expect(page.locator("h1", { hasText: "MCP Inspector" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mock Server scenario/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Generic MCP target/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /OAuth popup flow/ })).toBeVisible();
  await expect(page.locator(".product-brand-icon svg")).toBeVisible();
  await expect(page.locator(".side-nav-icon")).toHaveCount(4);
  await page.getByRole("link", { name: /Mock Server scenario/ }).click();
  await expect(page).toHaveURL(`${INSPECTOR_URL}/mock`);
  await expect(page.locator("h1", { hasText: "Mock Server scenario" })).toBeVisible();
  await expect(page.getByText("Allow self-signed HTTPS for this run").first()).toBeVisible();
  await page.getByLabel("Mock Server base URL").fill(baseURL ?? "http://127.0.0.1:3101");
  await page.locator("#mock-form").getByLabel("Allow self-signed HTTPS for this run").check();
  await page.getByRole("button", { name: "Run Mock Server scenario" }).click();

  const scenarioResults = page.locator("#mock-results");
  await expect(scenarioResults.getByText("Scenario progress")).toBeVisible();
  await expect(scenarioResults.getByText("Health and route config")).toBeVisible();
  await expect(scenarioResults.getByText("Health and route config")).toBeVisible({ timeout: 20_000 });
  await expect(scenarioResults.getByText("OAuth Bearer runtime")).toBeVisible();
  await expect(scenarioResults.getByText("Resources, prompts, completion, and SSE")).toBeVisible();
  await expect(scenarioResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible({ timeout: 30_000 });
  await expect(scenarioResults.getByText("12 of 12 steps complete.")).toBeVisible();
  await expect(scenarioResults.getByText("delete temporary records")).toBeVisible();
  await expect(scenarioResults.getByRole("heading", { name: "Step logs" })).toBeVisible();
  await expect(scenarioResults.locator(".step-card").first()).toBeVisible();
  await expect(scenarioResults.locator('.help-tooltip[title*="Runs the core MCP handshake"]')).toBeVisible();
  expect(await scenarioResults.getByRole("button", { name: "Send to Generic MCP target" }).count()).toBe(12);

  await scenarioResults.locator(".step-card").filter({ hasText: "MCP initialize" }).getByRole("button", { name: "Send to Generic MCP target" }).click();
  await expect(page).toHaveURL(`${INSPECTOR_URL}/generic`);
  await expect(page.locator("h1", { hasText: "Generic MCP target" })).toBeVisible();
  await expect(page.getByLabel("MCP endpoint URL")).toHaveValue(`${baseURL}/mcp/none`);
  await expect(page.getByLabel("Authorization helper")).toHaveValue("none");
  await expect(page.locator("#route-preset-note")).toContainText("no-auth MCP route");
  await expect(page.locator("#auth-mode-note")).toContainText("Sends no Authorization header");
  await expect(page.locator('#inspect-form .help-tooltip[title*="JSON-RPC MCP messages"]')).toBeVisible();
  await expect(page.getByLabel("Optional tool name")).toHaveValue("echo");
  await expect(page.getByLabel("Optional tool arguments JSON")).toHaveValue('{"message":"hello"}');
  await expect(page.getByLabel("MCP method preset")).toHaveValue("tools");
  await expect(page.locator("#method-preset-note")).toContainText("tools/list");
  await page.getByRole("button", { name: "Copy target config JSON" }).click();
  await expect(page.getByText(/Target config (copied|prepared) without passwords or bearer tokens/)).toBeVisible();
  await expect(page.getByLabel("Target config JSON")).toHaveValue(new RegExp(`${baseURL?.replaceAll(".", "\\.")}/mcp/none`));
  await page.getByLabel("Target config JSON").fill(JSON.stringify({
    mcpUrl: `${baseURL}/mcp/none`,
    authMode: "none",
    toolName: "echo",
    toolArgsJson: "{\"message\":\"hello\"}",
  }));
  await page.getByRole("button", { name: "Import target config JSON" }).click();
  await expect(page.getByText("Target config imported.")).toBeVisible();
  await page.locator("#inspect-form").getByLabel("Allow self-signed HTTPS for this run").check();
  await page.getByLabel("Authorization helper").selectOption("bearer");
  await expect(page.getByRole("textbox", { name: "Bearer token" })).toBeVisible();
  await page.getByRole("textbox", { name: "Bearer token" }).fill("local-test-token");
  await page.getByLabel("Extra headers JSON").fill('{"X-Local-Test":"not-persisted"}');
  await page.getByLabel("Optional tool name").fill("echo");
  await page.getByLabel("Optional tool arguments JSON").fill('{"message":"hello"}');
  await page.getByRole("button", { name: "Run generic inspection" }).click();

  const genericResults = page.locator("#results");
  await expect(genericResults.getByText("MCP initialize")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.getByText("MCP tools/call")).toBeVisible();
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(page.locator("#request-history").getByText("Pass · echo")).toBeVisible();
  await expect(genericResults.getByText("self-signed allowed")).toBeVisible();
  await genericResults.locator("details.step").first().click();
  await expect(genericResults.getByText("<redacted>").first()).toBeVisible();
  await expect(genericResults).not.toContainText("local-test-token");

  await page.getByLabel("Authorization helper").selectOption("none");
  await page.getByLabel("MCP method preset").selectOption("resourcesRead");
  await expect(page.getByLabel("Method params JSON")).toHaveValue('{"uri":"mock://resources/server-status"}');
  await page.getByRole("button", { name: "Run generic inspection" }).click();
  await expect(genericResults.getByText("MCP resources/read")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(page.locator("#request-history").getByText("Pass · resourcesRead")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Mock Server base URL")).toHaveValue(baseURL ?? "http://127.0.0.1:3101");
  await expect(page.getByLabel("MCP endpoint URL")).toHaveValue(`${baseURL}/mcp/none`);
  await expect(page.locator("#inspect-form").getByLabel("Allow self-signed HTTPS for this run")).toBeChecked();
  await expect(page.getByLabel("Authorization helper")).toHaveValue("none");
  await expect(page.getByRole("textbox", { name: "Bearer token" })).not.toBeVisible();
  await expect(page.getByLabel("Optional tool name")).toHaveValue("echo");
  await expect(page.getByLabel("MCP method preset")).toHaveValue("resourcesRead");
  await expect(page.getByLabel("Extra headers JSON")).toHaveValue("");
  await expect(page.getByLabel("Optional tool arguments JSON")).toHaveValue("{}");

  await page.getByLabel("Mock route preset").selectOption("basic");
  await expect(page.getByLabel("MCP endpoint URL")).toHaveValue(`${baseURL}/mcp/basic`);
  await expect(page.getByLabel("Authorization helper")).toHaveValue("basic");
  await expect(page.locator("#route-preset-note")).toContainText("strict Basic MCP route");
  await expect(page.locator("#auth-mode-note")).toContainText("Authorization: Basic");
  await expect(page.getByRole("textbox", { name: "Basic username" })).toHaveValue("default");
  await expect(page.getByLabel("Basic password", { exact: true })).toHaveValue("default");
  await expect(page.getByRole("textbox", { name: "Basic username" })).toBeVisible();
  await page.getByLabel("MCP method preset").selectOption("tools");
  await page.getByLabel("Optional tool arguments JSON").fill('{"message":"hello"}');
  await page.getByRole("button", { name: "Run generic inspection" }).click();
  await expect(genericResults.getByText("MCP tools/call")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(genericResults).not.toContainText("default:default");

  await page.getByLabel("Mock route preset").selectOption("oauth");
  await expect(page.getByLabel("MCP endpoint URL")).toHaveValue(`${baseURL}/mcp/oauth`);
  await expect(page.getByLabel("Authorization helper")).toHaveValue("bearer");
  await expect(page.getByLabel("Mock OAuth client id")).toHaveValue("default");
  await expect(page.getByLabel("Mock OAuth client secret")).toHaveValue("default");
  await page.getByRole("button", { name: "Issue Mock OAuth token" }).click();
  await expect(page.getByText("Token issued and filled.")).toBeVisible({ timeout: 10_000 });
  const issuedToken = await page.getByRole("textbox", { name: "Bearer token" }).inputValue();
  expect(issuedToken).toMatch(/^ey/);
  await page.getByRole("button", { name: "Run generic inspection" }).click();
  await expect(genericResults.getByText("MCP tools/call")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(genericResults).not.toContainText(issuedToken);
});

test("standalone inspector popup OAuth flow fills Generic MCP target @ui-standalone-inspector", async ({ page, baseURL }) => {
  await page.goto(`${INSPECTOR_URL}/oauth`);
  await expect(page.locator("h1", { hasText: "OAuth popup flow" })).toBeVisible();
  await expect(page.getByText("Final handoff: token is sent to Generic MCP Target")).toBeVisible();
  await page.getByRole("link", { name: "Generic Target" }).click();
  await expect(page).toHaveURL(`${INSPECTOR_URL}/generic`);
  await page.getByRole("link", { name: "OAuth Popup" }).click();
  await expect(page).toHaveURL(`${INSPECTOR_URL}/oauth`);
  await page.getByLabel("Mock Server base URL").fill(baseURL ?? "http://127.0.0.1:3101");

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Start popup OAuth flow" }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Sign in for consent" })).toBeVisible();
  await popup.getByLabel("Username").fill("default");
  await popup.getByLabel("Password").fill("default");
  await popup.getByRole("button", { name: "Continue" }).click();
  await expect(popup.getByRole("heading", { name: "Approve MCP access" })).toBeVisible();
  await expect(popup.getByLabel(/echo/)).toBeChecked();
  await popup.getByRole("button", { name: "Approve selected permissions" }).click();

  await expect(page.locator("#oauth-popup-results").getByText("Token", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#oauth-popup-results").getByText("Issued")).toBeVisible();
  await expect(page.locator("#oauth-popup-results").getByText("authorization_code", { exact: true })).toBeVisible();
  await expect(page.locator("#oauth-popup-results")).not.toContainText(/eyJ/);

  await page.getByRole("button", { name: "Send token to Generic MCP target" }).click();
  await expect(page).toHaveURL(`${INSPECTOR_URL}/generic`);
  await expect(page.getByLabel("MCP endpoint URL")).toHaveValue(`${baseURL}/mcp/oauth`);
  await expect(page.getByLabel("Authorization helper")).toHaveValue("bearer");
  const bearerToken = await page.getByRole("textbox", { name: "Bearer token" }).inputValue();
  expect(bearerToken).toMatch(/^ey/);
  await page.getByRole("button", { name: "Run generic inspection" }).click();

  const genericResults = page.locator("#results");
  await expect(genericResults.getByText("MCP tools/call")).toBeVisible({ timeout: 10_000 });
  await expect(genericResults.locator(".summary div").filter({ hasText: "Fail" }).getByText("0")).toBeVisible();
  await expect(genericResults).not.toContainText(bearerToken);
});
