import { expect, test } from "@playwright/test";

test("foundation dashboard renders planned MCP mock server surfaces", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MCP Mock Server" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Build tools/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Verify protocol/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Prepare OAuth/ })).toBeVisible();
});

test("health endpoint reports ok status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    runtime: { runtimeState: "prepared" },
    database: { status: "ok" },
  });
});
