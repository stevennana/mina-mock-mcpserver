import { expect, test } from "@playwright/test";

test("foundation dashboard renders planned MCP mock server surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1159, height: 802 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MCP Mock Server" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Build tools/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Verify protocol/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Prepare OAuth/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary groups" }).getByRole("link", { name: "Tools" }).click();
  await expect(page).toHaveURL("/endpoints");
  await page.getByRole("navigation", { name: "Primary groups" }).getByRole("link", { name: "Auth" }).click();
  await expect(page).toHaveURL("/basic-users");
  await page.getByRole("navigation", { name: "Primary groups" }).getByRole("link", { name: "Operations" }).click();
  await expect(page).toHaveURL("/config");
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
