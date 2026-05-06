import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function createEndpoint(page: Page, name: string) {
  await page.goto("/endpoints");
  await page.getByRole("link", { name: "New endpoint" }).click();
  await page.getByRole("textbox", { name: /^Name/ }).fill(name);
  await page.getByRole("textbox", { name: /^Title/ }).fill(name);
  await page.getByRole("textbox", { name: /^Description/ }).fill(`Root reset coverage for ${name}.`);
  await page.getByRole("textbox", { name: /^Delete code/ }).fill("87654321");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/endpoints\/endpoint_/);
}

test("root reset requires password and restores deterministic endpoint defaults @root-reset", async ({ page, request }) => {
  const endpointName = `root_reset_${Date.now()}`;
  await createEndpoint(page, endpointName);

  const failedResponse = await request.post("/api/reset", {
    data: { rootPassword: "wrong-root-password", confirmation: "RESET DEFAULTS" },
  });
  expect(failedResponse.status()).toBe(403);

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(endpointName);
  await expect(page.getByRole("link", { name: endpointName })).toBeVisible();

  await page.goto("/reset");
  await expect(page.getByRole("heading", { name: "Reset defaults" })).toBeVisible();
  await page.getByLabel("Root password").fill("e2e-root-password");
  await page.getByLabel("Confirmation text").fill("not the phrase");
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByText("Enter the root password and exact confirmation text to reset defaults.")).toBeVisible();

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(endpointName);
  await expect(page.getByRole("link", { name: endpointName })).toBeVisible();

  await page.goto("/reset");
  await page.getByLabel("Root password").fill("e2e-root-password");
  await page.getByLabel("Confirmation text").fill("RESET DEFAULTS");
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByText("Defaults restored. Seeded endpoints: 1.")).toBeVisible();

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(endpointName);
  await expect(page.getByText("No endpoints match this search.")).toBeVisible();
  await page.getByLabel("Search").fill("echo");
  await expect(page.getByRole("link", { name: "echo" })).toBeVisible();

  await page.goto("/audit");
  await expect(page.getByRole("row").filter({ hasText: "system.reset" }).filter({ hasText: "failure" }).first()).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "system.reset" }).filter({ hasText: "success" }).first()).toBeVisible();
  await expect(page.getByText("e2e-root-password")).toHaveCount(0);
  await expect(page.getByText("wrong-root-password")).toHaveCount(0);
});
