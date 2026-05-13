import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("prompt UI supports focused CRUD, previews, screenshots, overflow, and accessibility checks @ui-prompts", async ({ page, request }) => {
  const suffix = Date.now();
  const promptName = `ui_prompt_${suffix}`;
  const disabledResourceUri = `mock://resources/disabled-${suffix}`;

  await page.goto("/prompts");
  await expect(page.getByRole("heading", { level: 1, name: "Prompt management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Prompts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New prompt" })).toBeVisible();

  await page.getByLabel("Search").fill("no-such-prompt");
  await expect(page.getByText("No prompts match this search.")).toBeVisible();
  await page.getByLabel("Search").fill("");

  await page.getByRole("link", { name: "New prompt" }).click();
  await expect(page.locator('.help-tooltip[data-tooltip*="prompts/get"]').first()).toBeVisible();
  await page.getByRole("textbox", { name: /^Name/ }).first().fill("bad prompt");
  await page.getByRole("region", { name: "Prompt messages" }).getByRole("textbox", { name: /^Text template/ }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fix the highlighted fields and save again.")).toBeVisible();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();
  await expect(page.getByText("Add text or an embedded resource URI.")).toBeVisible();

  await page.getByRole("textbox", { name: /^Name/ }).first().fill(promptName);
  await page.getByRole("textbox", { name: /^Title/ }).first().fill("UI Prompt");
  await page.getByRole("textbox", { name: /^Description/ }).first().fill("User requested prompt template created by UI coverage.");
  await page.getByRole("region", { name: "Prompt messages" }).getByRole("textbox", { name: /^Text template/ }).fill("Draft a support reply for {customer} using the embedded status.");
  await page.getByLabel(/^Embedded resource/).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/prompts\/mcp_prompt_/);
  await expect(page.getByText("Prompt saved.")).toBeVisible();

  await expect(page.getByRole("navigation", { name: "Prompt workflow" })).toBeVisible();
  await expect(page.getByText(promptName)).toBeVisible();

  await page.getByRole("link", { name: "Arguments", exact: true }).click();
  await page.getByRole("textbox", { name: /^Title/ }).fill("Customer account");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Prompt saved.")).toBeVisible();

  await page.getByRole("link", { name: "Messages", exact: true }).click();
  await page.getByRole("region", { name: "Prompt messages" }).getByRole("textbox", { name: /^Text template/ }).fill("Draft a support reply for {customer} with current server context.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Prompt saved.")).toBeVisible();

  await page.getByRole("link", { name: "Completion", exact: true }).click();
  await page.getByRole("textbox", { name: /^Value/ }).fill("globex");
  await page.getByRole("textbox", { name: /^Label/ }).fill("Globex");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Prompt saved.")).toBeVisible();

  await page.getByRole("link", { name: "Preview", exact: true }).click();
  const previewRegion = page.locator(".editor-section").filter({ has: page.getByRole("heading", { name: "Prompt console preview" }) });
  await expect(previewRegion.getByText("Required argument is missing.")).toBeVisible();
  await page.getByRole("textbox", { name: /^customer/ }).fill("Globex");
  await expect(previewRegion.getByRole("region", { name: "prompts/list response" })).toContainText('"prompts"');
  await expect(previewRegion.getByRole("region", { name: "prompts/get request" })).toContainText('"prompts/get"');
  await expect(previewRegion.getByRole("region", { name: "prompts/get response" })).toContainText("Globex");
  await expect(previewRegion.getByRole("region", { name: "prompts/get response" })).toContainText('"resource"');
  await expect(previewRegion.getByRole("region", { name: "completion/complete request" })).toContainText('"completion/complete"');
  await expect(previewRegion.getByRole("region", { name: "completion/complete response" })).toContainText("globex");

  await page.screenshot({ path: "test-results/ui-prompts-desktop.png", fullPage: true });
  await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
  await assertAccessibleControlNames(page);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { level: 1, name: "Prompt console preview" })).toBeVisible();
  await expect(previewRegion.getByRole("button", { name: /^Copy prompts\/list/ })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-prompts-mobile.png", fullPage: true });
  await assertAccessibleControlNames(page);

  const disabledResource = await request.post("/api/resources", {
    data: {
      uri: disabledResourceUri,
      name: `disabled_${suffix}`,
      title: "Disabled resource",
      description: "Disabled prompt embed guard coverage.",
      mimeType: "text/plain",
      enabled: false,
      textContent: "disabled",
    },
  });
  expect(disabledResource.ok()).toBeTruthy();
  const blockedPrompt = await request.post("/api/prompts", {
    data: {
      name: `blocked_${suffix}`,
      title: "Blocked prompt",
      description: "Should not save disabled resource embeds.",
      enabled: true,
      arguments: [{ name: "customer", title: "Customer", description: "", required: true }],
      messages: [{ role: "user", textTemplate: "Check {customer}", resourceUri: disabledResourceUri, resourceMimeType: "text/plain" }],
      completionCandidates: [],
    },
  });
  expect(blockedPrompt.status()).toBe(400);
  const blockedPayload = await blockedPrompt.json();
  expect(blockedPayload.fieldErrors["messages.0.resourceUri"]).toBe("Choose an enabled MCP resource.");

  await page.goto("/prompts");
  await page.getByLabel("Search").fill(promptName);
  await expect(page.getByRole("link", { name: promptName })).toBeVisible();
  await expect(page.getByText("UI Prompt")).toBeVisible();

  await page.getByRole("link", { name: promptName }).click();
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete prompt" }).click();
  await page.getByLabel("I understand this prompt will be deleted.").check();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page.waitForURL(/\/prompts$/);
  await page.getByLabel("Search").fill(promptName);
  await expect(page.getByText("No prompts match this search.")).toBeVisible();
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
