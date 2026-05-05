import { expect, test } from "@playwright/test";

test("foundation dashboard renders planned MCP mock server surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MCP Mock Server" })).toBeVisible();
  await expect(page.getByText("MCP JSON-RPC runtime")).toBeVisible();
  await expect(page.getByText("OAuth consent and token runtime")).toBeVisible();
});

test("health endpoint reports ok status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: "ok", database: "prepared" });
});
