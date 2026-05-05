import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("endpoint schema preview and console shell stay stable on desktop and mobile @ui-endpoint-console", async ({ page }) => {
  const endpointName = `console_endpoint_${Date.now()}`;

  await page.goto("/endpoints");
  await page.getByRole("button", { name: "New endpoint" }).click();
  await page.getByRole("textbox", { name: /^Name/ }).fill(endpointName);
  await page.getByRole("textbox", { name: /^Title/ }).fill("Console Endpoint");
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter 1 name").fill("city");
  await page.getByLabel("Parameter 1 type").selectOption("string");
  await page.getByLabel("Parameter 1 label").fill("City");
  await page.getByLabel("Parameter 1 description").fill("City name for schema preview.");

  const schemaRegion = page.getByRole("region", { name: "Generated MCP inputSchema" });
  await expect(schemaRegion.getByLabel("Generated MCP input schema")).toContainText('"city"');
  await expect(schemaRegion.getByLabel("Generated MCP input schema")).toContainText('"required"');

  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter 2 name").fill("includeHumidity");
  await page.getByLabel("Parameter 2 type").selectOption("boolean");
  await expect(schemaRegion.getByLabel("Generated MCP input schema")).toContainText('"includeHumidity"');

  const consoleRegion = page.getByRole("region", { name: "Endpoint test console" });
  await expect(consoleRegion.getByLabel("Auth mode")).toBeVisible();
  await expect(consoleRegion.getByLabel("Basic username")).toBeVisible();
  await expect(consoleRegion.getByLabel("Basic password")).toBeVisible();
  await expect(consoleRegion.getByLabel("OAuth bearer token")).toBeVisible();
  await expect(consoleRegion.getByLabel("Arguments JSON")).toBeVisible();
  await expect(consoleRegion.getByRole("button", { name: /MCP call unavailable/ })).toBeDisabled();
  await expect(consoleRegion.getByRole("button", { name: "Run REST call" })).toBeEnabled();
  await expect(consoleRegion.getByRole("region", { name: "Raw request" })).toContainText(endpointName);
  await expect(consoleRegion.getByRole("region", { name: "Raw response" })).toContainText("Run a REST call");
  await expect(consoleRegion.getByRole("region", { name: "Matched case" })).toContainText("Not run");
  await expect(consoleRegion.getByRole("region", { name: "Principal" })).toContainText("anonymous preview");
  await expect(consoleRegion.getByRole("region", { name: "Elapsed time" })).toContainText("-- ms");

  await consoleRegion.getByLabel("Arguments JSON").fill("{ bad");
  await expect(consoleRegion.getByText("Arguments must be valid JSON")).toBeVisible();

  await consoleRegion.getByLabel("Arguments JSON").fill('{"city":"Seoul","includeHumidity":true}');
  await expect(consoleRegion.getByText("Validated locally before REST execution.")).toBeVisible();
  await expect(consoleRegion.getByRole("region", { name: "Raw request" })).toContainText('"includeHumidity": true');

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-endpoint-console-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "Endpoint management" })).toBeVisible();
  await expect(schemaRegion.getByLabel("Generated MCP input schema")).toBeVisible();
  await expect(consoleRegion.getByLabel("Arguments JSON")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-endpoint-console-mobile.png", fullPage: true });
});
