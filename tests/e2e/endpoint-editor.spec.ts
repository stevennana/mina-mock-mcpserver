import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("endpoint editor supports persisted create, edit, search, screenshots, and responsive checks @ui-endpoint-editor", async ({ page }) => {
  const endpointName = `ui_endpoint_${Date.now()}`;
  await page.goto("/endpoints");

  await expect(page.getByRole("heading", { name: "Endpoint management" })).toBeVisible();
  await expect(page.getByText("persisted endpoints")).toBeVisible();
  await expect(page.getByRole("link", { name: "New endpoint" })).toBeVisible();

  await page.getByLabel("Search").fill("no-such-endpoint");
  await expect(page.getByText("No endpoints match this search.")).toBeVisible();
  await page.getByLabel("Search").fill("");

  await page.getByRole("link", { name: "New endpoint" }).click();
  await expect(page.locator('.help-tooltip[data-tooltip*="MCP tools/call"]').first()).toBeVisible();
  await page.getByRole("textbox", { name: /^Name/ }).fill("bad name");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fix the highlighted fields and save again.")).toBeVisible();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();

  await page.getByRole("textbox", { name: /^Name/ }).fill(endpointName);
  await page.getByRole("textbox", { name: /^Title/ }).fill("UI Endpoint");
  await page.getByRole("textbox", { name: /^Description/ }).fill("Created by the tagged endpoint editor flow.");
  await page.getByRole("textbox", { name: /^Delete code/ }).fill("87654321");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/endpoints\/endpoint_/);

  await page.getByRole("link", { name: "Parameters", exact: true }).click();
  await page.getByRole("button", { name: "Add parameter" }).click();
  await expect(page.getByText("Parameter rows define the MCP tool input schema.")).toBeVisible();
  await page.getByLabel("Parameter 1 name").fill("city");
  await page.getByLabel("Parameter 1 type").selectOption("string");
  await page.getByLabel("Parameter 1 label").fill("City");
  await page.getByLabel("Parameter 1 description").fill("City to match against exact response cases.");
  await page.getByLabel("Parameter 1 default JSON").fill('"Seoul"');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Endpoint saved.")).toBeVisible();

  await page.getByRole("link", { name: "Responses", exact: true }).click();
  await page.getByRole("button", { name: "Add response case" }).click();
  await page.getByLabel("Match args JSON").nth(1).fill('{"city":"Seoul"}');
  await page.getByLabel("Response JSON").nth(1).fill('{"forecast":"clear"}');
  await page.getByLabel("Error message").nth(1).fill("Case-level error text");
  await page.getByLabel("Error body JSON").nth(1).fill('{"error":"case failure"}');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Endpoint saved.")).toBeVisible();

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(endpointName);
  await expect(page.getByRole("link", { name: endpointName })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
  await page.getByRole("link", { name: endpointName }).click();
  await page.getByRole("link", { name: "Failure", exact: true }).click();
  await expect(page.getByRole("region", { name: "Failure simulation" }).getByLabel("Failure mode", { exact: true })).toBeVisible();
  await expect(page.locator('.help-tooltip[data-tooltip*="Endpoint-wide failure behavior"]').first()).toBeVisible();
  await page.screenshot({ path: "test-results/ui-endpoint-editor-desktop.png", fullPage: true });

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: /^Title/ }).fill("UI Endpoint Edited");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Endpoint saved.")).toBeVisible();
  await page.getByRole("link", { name: "Failure", exact: true }).click();
  await page.getByLabel("Failure mode", { exact: true }).selectOption("error");
  await page.getByLabel("Failure status", { exact: true }).fill("503");
  await page.getByLabel("Failure message", { exact: true }).fill("Forced outage");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Endpoint saved.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { level: 1, name: "Failure simulation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-endpoint-editor-mobile.png", fullPage: true });

  await page.goto("/");
  await expect(page.getByText("Persisted endpoints")).toBeVisible();
  await expect(page.getByText("Enabled tools")).toBeVisible();
});
