import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function createEndpoint(page: Page, name: string, deleteCode: string) {
  await page.goto("/endpoints");
  await page.getByRole("button", { name: "New endpoint" }).click();
  await page.getByRole("textbox", { name: /^Name/ }).fill(name);
  await page.getByRole("textbox", { name: /^Title/ }).fill(name);
  await page.getByRole("textbox", { name: /^Description/ }).fill(`Endpoint delete audit coverage for ${name}.`);
  await page.getByRole("textbox", { name: /^Delete code/ }).fill(deleteCode);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Endpoint saved.")).toBeVisible();
  await expect(page.getByRole("button", { name })).toBeVisible();
}

test("endpoint delete requires confirmation and writes non-secret audit evidence @endpoint-delete-audit", async ({ page }) => {
  const codeDeletedName = `delete_code_${Date.now()}`;
  const rootDeletedName = `root_delete_${Date.now()}`;

  await createEndpoint(page, codeDeletedName, "87654321");
  await page.getByRole("button", { name: "Delete endpoint" }).click();
  await page.getByLabel("Delete code").last().fill("11111111");
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Enter the endpoint delete code or root password to delete.")).toBeVisible();
  await expect(page.getByRole("button", { name: codeDeletedName })).toBeVisible();

  await page.goto("/audit");
  const failedDeleteRow = page.getByRole("row").filter({ hasText: codeDeletedName }).first();
  await expect(failedDeleteRow).toBeVisible();
  await expect(failedDeleteRow).toContainText("invalid_confirmation");
  await expect(page.getByText("11111111")).toHaveCount(0);

  await page.goto("/endpoints");
  await page.getByRole("button", { name: codeDeletedName }).click();
  await page.getByRole("button", { name: "Delete endpoint" }).click();
  await page.getByLabel("Delete code").last().fill("87654321");
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Endpoint deleted.")).toBeVisible();
  await page.getByLabel("Search").fill(codeDeletedName);
  await expect(page.getByText("No endpoints match this search.")).toBeVisible();

  await createEndpoint(page, rootDeletedName, "22222222");
  await page.getByRole("button", { name: "Delete endpoint" }).click();
  await page.getByLabel("Root password override").fill("e2e-root-password");
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Endpoint deleted.")).toBeVisible();
  await page.getByLabel("Search").fill(rootDeletedName);
  await expect(page.getByText("No endpoints match this search.")).toBeVisible();

  await page.goto("/audit");
  const codeSuccessRow = page.getByRole("row").filter({ hasText: codeDeletedName }).filter({ hasText: "delete_code" }).first();
  const rootSuccessRow = page.getByRole("row").filter({ hasText: rootDeletedName }).filter({ hasText: "root_password" }).first();
  await expect(codeSuccessRow).toBeVisible();
  await expect(rootSuccessRow).toBeVisible();
  await expect(page.getByText("87654321")).toHaveCount(0);
  await expect(page.getByText("e2e-root-password")).toHaveCount(0);
});
