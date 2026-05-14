import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("resource UI supports focused CRUD, read preview, screenshots, and accessibility checks @ui-resources", async ({ page, request }) => {
  const suffix = Date.now();
  const resourceName = `ui_resource_${suffix}`;
  const resourceUri = `mock://resources/ui-${suffix}`;

  await page.goto("/resources");
  await expect(page.getByRole("heading", { level: 1, name: "Resource management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resources" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New resource" })).toBeVisible();

  await page.getByLabel("Search").fill("no-such-resource");
  await expect(page.getByText("No resources match this search.")).toBeVisible();
  await page.getByLabel("Search").fill("");

  await page.getByRole("link", { name: "New resource" }).click();
  await expect(page.locator('.help-tooltip[data-tooltip*="application-controlled context"]').first()).toBeVisible();
  await page.getByRole("textbox", { name: /^URI/ }).fill("file:///tmp/not-allowed");
  await page.getByRole("textbox", { name: /^Name/ }).fill("bad resource");
  await page.getByRole("textbox", { name: /^Text content/ }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fix the highlighted fields and save again.")).toBeVisible();
  await expect(page.getByText("Local file URIs are not allowed.")).toBeVisible();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();

  await page.getByRole("textbox", { name: /^URI/ }).fill(resourceUri);
  await page.getByRole("textbox", { name: /^Name/ }).fill(resourceName);
  await page.getByRole("textbox", { name: /^Title/ }).fill("UI Resource");
  await page.getByRole("textbox", { name: /^MIME type/ }).fill("application/json");
  await page.getByRole("textbox", { name: /^Description/ }).fill("Direct text context resource created by UI coverage.");
  await page.getByRole("textbox", { name: /^Annotations JSON/ }).fill('{"audience":["assistant"],"priority":0.7}');
  await page.getByRole("textbox", { name: /^Text content/ }).fill('{"status":"ready","source":"ui"}');
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/resources\/mcp_resource_/);
  await expect(page.getByText("Resource saved.")).toBeVisible();

  await expect(page.getByRole("navigation", { name: "Resource workflow" })).toBeVisible();
  await expect(page.getByText(resourceUri)).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: /^Title/ }).fill("UI Resource Edited");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Resource saved.")).toBeVisible();

  await page.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page.getByRole("region", { name: "Text content" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Text content/ }).fill('{"status":"updated","source":"content-page"}');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Resource saved.")).toBeVisible();

  await page.getByRole("link", { name: "Preview", exact: true }).click();
  const previewRegion = page.getByRole("region", { name: "Resource read preview" });
  await expect(previewRegion.getByRole("region", { name: "resources/read request" })).toContainText('"method": "resources/read"');
  await expect(previewRegion.getByRole("region", { name: "resources/read request" })).toContainText(resourceUri);
  await expect(previewRegion.getByRole("region", { name: "resources/read response" })).toContainText('"contents"');
  await expect(previewRegion.getByRole("region", { name: "resources/read response" })).toContainText('"text"');
  await expect(previewRegion.getByRole("button", { name: /^Copy request/ })).toBeVisible();
  await expect(previewRegion.getByRole("button", { name: /^Copy response/ })).toBeVisible();

  await page.screenshot({ path: "test-results/ui-resources-desktop.png", fullPage: true });
  await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
  await assertAccessibleControlNames(page);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { level: 1, name: "Resource read preview" })).toBeVisible();
  await expect(previewRegion.getByRole("button", { name: /^Copy request/ })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-resources-mobile.png", fullPage: true });
  await assertAccessibleControlNames(page);

  await page.goto("/resources");
  await page.getByLabel("Search").fill(resourceName);
  await expect(page.getByRole("link", { name: resourceName })).toBeVisible();
  await expect(page.getByText("UI Resource Edited")).toBeVisible();

  await page.getByRole("link", { name: resourceName }).click();
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete resource" }).click();
  await page.getByLabel("I understand this resource will be deleted.").check();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page.waitForURL(/\/resources$/);
  await page.getByLabel("Search").fill(resourceName);
  await expect(page.getByText("No resources match this search.")).toBeVisible();

  const auditResponse = await request.get(`/api/audit?query=${resourceName}&limit=20`);
  expect(auditResponse.ok()).toBeTruthy();
  const auditPayload = await auditResponse.json();
  const eventTypes = (auditPayload.events as Array<{ eventType: string }>).map((event) => event.eventType);
  expect(eventTypes).toContain("mcp_resource.create");
  expect(eventTypes).toContain("mcp_resource.update");
  expect(eventTypes).toContain("mcp_resource.content.update");
  expect(eventTypes).toContain("mcp_resource.delete");
});

async function assertAccessibleControlNames(page: import("@playwright/test").Page) {
  const unnamedControls = await page.locator("button, input, select, textarea").evaluateAll((controls) =>
    controls
      .filter((control) => {
        const element = control as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;
        if (element.disabled || element.getAttribute("aria-hidden") === "true") return false;
        const id = element.id;
        const hasLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        const aria = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby");
        const text = element.textContent?.trim();
        const wrappedByLabel = Boolean(element.closest("label"));
        return !hasLabel && !aria && !text && !wrappedByLabel;
      })
      .map((control) => control.outerHTML),
  );
  expect(unnamedControls).toEqual([]);
}
