import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("resource template UI supports focused CRUD, previews, screenshots, and accessibility checks @ui-resource-templates", async ({ page }) => {
  const suffix = Date.now();
  const templateName = `ui_template_${suffix}`;
  const templateUri = `resource://mock/tool/{name}`;

  await page.goto("/resource-templates");
  await expect(page.getByRole("heading", { level: 1, name: "Resource template management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resource Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New template" })).toBeVisible();

  await page.getByLabel("Search").fill("no-such-template");
  await expect(page.getByText("No resource templates match this search.")).toBeVisible();
  await page.getByLabel("Search").fill("");

  await page.getByRole("link", { name: "New template" }).click();
  await expect(page.locator('.help-tooltip[data-tooltip*="resources/templates/list"]').first()).toBeVisible();
  await page.getByRole("textbox", { name: /^URI template/ }).fill("resource://mock/tool/{missing}");
  await page.getByRole("textbox", { name: /^Name/ }).first().fill("bad template");
  await page.getByRole("textbox", { name: /^Text template/ }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fix the highlighted fields and save again.")).toBeVisible();
  await expect(page.getByText("Every URI template placeholder needs a matching argument.")).toBeVisible();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();

  await page.getByRole("textbox", { name: /^URI template/ }).fill(templateUri);
  await page.getByRole("textbox", { name: /^Name/ }).first().fill(templateName);
  await page.getByRole("textbox", { name: /^Title/ }).fill("UI Resource Template");
  await page.getByRole("textbox", { name: /^MIME type/ }).fill("application/json");
  await page.getByRole("textbox", { name: /^Description/ }).first().fill("Parameterized resource template created by UI coverage.");
  await page.getByRole("textbox", { name: /^Annotations JSON/ }).fill('{"audience":["assistant"]}');
  await page.getByRole("textbox", { name: /^Sample JSON/ }).fill('"weather"');
  await page.getByRole("textbox", { name: /^Text template/ }).fill('{"tool":"{name}","preview":true}');
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/resource-templates\/mcp_resource_template_/);
  await expect(page.getByText("Resource template saved.")).toBeVisible();

  await expect(page.getByRole("navigation", { name: "Resource template workflow" })).toBeVisible();
  await expect(page.getByText(templateUri)).toBeVisible();
  await expect(page.getByText("resource://mock/tool/weather")).toBeVisible();

  await page.getByRole("link", { name: "Arguments", exact: true }).click();
  await page.getByRole("textbox", { name: /^Sample JSON/ }).fill('"search"');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Resource template saved.")).toBeVisible();
  await expect(page.getByText("resource://mock/tool/search")).toBeVisible();

  await page.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page.locator(".editor-section").filter({ has: page.getByRole("heading", { name: "Rendered mock content" }) })).toBeVisible();
  await page.getByRole("textbox", { name: /^Text template/ }).fill('{"tool":"{name}","source":"content-page"}');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Resource template saved.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Rendered content" })).toContainText('"search"');

  await page.getByRole("link", { name: "Completion", exact: true }).click();
  await page.getByRole("textbox", { name: /^Value/ }).fill("search");
  await page.getByRole("textbox", { name: /^Label/ }).fill("Search tool");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Resource template saved.")).toBeVisible();

  await page.getByRole("link", { name: "Preview", exact: true }).click();
  const previewRegion = page.locator(".editor-section").filter({ has: page.getByRole("heading", { name: "Template console preview" }) });
  await expect(previewRegion.getByRole("region", { name: "resources/templates/list response" })).toContainText('"uriTemplate"');
  await expect(previewRegion.getByRole("region", { name: "resources/read request" })).toContainText("resource://mock/tool/search");
  await expect(previewRegion.getByRole("region", { name: "resources/read response" })).toContainText("source");
  await expect(previewRegion.getByRole("region", { name: "completion/complete request" })).toContainText('"completion/complete"');
  await expect(previewRegion.getByRole("region", { name: "completion/complete response" })).toContainText("search");

  await page.screenshot({ path: "test-results/ui-resource-templates-desktop.png", fullPage: true });
  await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
  await assertAccessibleControlNames(page);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { level: 1, name: "Template console preview" })).toBeVisible();
  await expect(previewRegion.getByRole("button", { name: /^Copy templates\/list/ })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-resource-templates-mobile.png", fullPage: true });
  await assertAccessibleControlNames(page);

  await page.goto("/resource-templates");
  await page.getByLabel("Search").fill(templateName);
  await expect(page.getByRole("link", { name: templateName })).toBeVisible();
  await expect(page.getByText("UI Resource Template")).toBeVisible();

  await page.getByRole("link", { name: templateName }).click();
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete resource template" }).click();
  await page.getByLabel("I understand this resource template will be deleted.").check();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page.waitForURL(/\/resource-templates$/);
  await page.getByLabel("Search").fill(templateName);
  await expect(page.getByText("No resource templates match this search.")).toBeVisible();
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
