import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("Basic users management UI protects default and manages editable users @ui-basic-users", async ({ page, request }) => {
  const username = `ui_basic_${Date.now()}`;

  await page.goto("/basic-users");
  await expect(page.getByRole("heading", { name: "Basic Auth users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "default" })).toBeVisible();
  await expect(page.getByText("Locked")).toBeVisible();

  await page.getByRole("link", { name: "default" }).click();
  await expect(page.getByText("Locked fixture")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();

  const lockedResponse = await request.patch("/api/basic-users/basic_user_default", {
    data: { enabled: false, password: "weakened" },
  });
  expect(lockedResponse.status()).toBe(409);

  await page.goto("/basic-users");
  await page.getByRole("link", { name: "New Basic user" }).click();
  await page.getByLabel("Username").fill("bad username");
  await page.getByLabel("Password").fill("secret-one");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("secret-one");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Basic user saved.")).toBeVisible();

  await page.goto("/basic-users");
  await page.getByLabel("Search").fill(username);
  await expect(page.getByRole("link", { name: username })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-basic-users-desktop.png", fullPage: true });

  await page.getByRole("link", { name: username }).click();
  await page.getByLabel("New password").fill("secret-two");
  await page.getByLabel("Enabled for Basic credential verification").uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Basic user saved.")).toBeVisible();
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "Basic user detail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-basic-users-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/basic-users$/);
  await expect(page.getByRole("link", { name: username })).toHaveCount(0);
});
