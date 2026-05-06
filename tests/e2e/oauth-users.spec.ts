import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("OAuth users management UI protects default, validates TTLs, and manages editable users @ui-oauth-users", async ({
  page,
  request,
}) => {
  const username = `ui_oauth_${Date.now()}`;

  await page.goto("/oauth-users");
  await expect(page.getByRole("heading", { name: "OAuth users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "default" })).toBeVisible();
  await expect(page.getByText("Locked")).toBeVisible();
  await expect(page.getByLabel("Search")).toBeVisible();

  await page.getByRole("link", { name: "default" }).click();
  await expect(page.getByLabel("Authorization-code token TTL")).toBeVisible();
  await expect(page.getByText("Locked fixture")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();

  const lockedResponse = await request.patch("/api/oauth-users/oauth_user_default", {
    data: { enabled: false, password: "weakened", accessTokenTtlSeconds: 86400 },
  });
  expect(lockedResponse.status()).toBe(409);

  const invalidTtl = await request.post("/api/oauth-users", {
    data: {
      username: `bad_ttl_${Date.now()}`,
      password: "secret-one",
      enabled: true,
      accessTokenTtlSeconds: 0,
    },
  });
  expect(invalidTtl.status()).toBe(400);

  await page.goto("/oauth-users");
  await page.getByRole("link", { name: "New OAuth user" }).click();
  await page.getByLabel("Username").fill("bad username");
  await page.getByLabel("Password").fill("secret-one");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Use 1-64 letters")).toBeVisible();

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("secret-one");
  await page.getByLabel("Authorization-code token TTL").selectOption("900");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/oauth-users\/oauth_user_/);

  await page.goto("/oauth-users");
  await page.getByLabel("Search").fill(username);
  await expect(page.getByRole("link", { name: username })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-oauth-users-desktop.png", fullPage: true });

  await page.getByRole("link", { name: username }).click();
  await page.getByLabel("New password").fill("secret-two");
  await page.getByLabel("Authorization-code token TTL").selectOption("86400");
  await page.getByLabel("Enabled for OAuth login verification").uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("OAuth user saved.")).toBeVisible();
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Authorization-code token TTL")).toHaveValue("86400");

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "OAuth user detail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-oauth-users-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/oauth-users$/);
  await expect(page.getByRole("link", { name: username })).toHaveCount(0);
});
