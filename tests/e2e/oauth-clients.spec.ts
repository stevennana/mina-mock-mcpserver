import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("OAuth clients management UI protects default, shows secrets once, and persists allowed endpoints @ui-oauth-clients", async ({
  page,
  request,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const clientId = `ui-client-${Date.now()}`;

  await page.goto("/oauth-clients");
  await expect(page.getByRole("heading", { name: "OAuth clients" })).toBeVisible();
  await expect(page.getByRole("button", { name: "default" })).toBeVisible();
  await expect(page.getByText("Locked")).toBeVisible();
  await expect(page.getByLabel("Search")).toBeVisible();
  await expect(page.getByLabel("Client credentials TTL")).toBeVisible();

  await page.getByRole("button", { name: "default" }).click();
  await expect(page.getByText("Locked fixture")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Regenerate secret" })).toBeDisabled();

  const lockedResponse = await request.patch("/api/oauth-clients/oauth_client_default", {
    data: { enabled: false, allowedEndpointIds: [] },
  });
  expect(lockedResponse.status()).toBe(409);

  const invalidEndpoint = await request.post("/api/oauth-clients", {
    data: {
      clientId: `bad-client-${Date.now()}`,
      displayName: "Bad Client",
      enabled: true,
      redirectUris: ["http://localhost:3000/callback"],
      clientCredentialsTtlSeconds: 3600,
      allowedEndpointIds: ["missing_endpoint"],
    },
  });
  expect(invalidEndpoint.status()).toBe(400);

  await page.getByRole("button", { name: "New OAuth client" }).click();
  await page.getByLabel("Client ID").fill("bad client");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Use 1-96 letters")).toBeVisible();

  await page.getByLabel("Client ID").fill(clientId);
  await page.getByLabel("Display name").fill("UI OAuth Client");
  await page.getByLabel("Redirect URIs").fill(`http://localhost:3000/oauth/callback\n${new URL("/callback", baseURL).toString()}`);
  await page.getByLabel("Client credentials TTL").selectOption("900");
  await page.getByLabel(/echo/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("OAuth client saved. Copy the generated secret now.")).toBeVisible();
  const generatedSecret = page.getByLabel("Generated client secret").locator("code");
  await expect(generatedSecret).toContainText("mcp_mock_");
  const firstSecret = await generatedSecret.innerText();
  await expect(page.getByRole("button", { name: clientId })).toBeVisible();

  const listResponse = await request.get("/api/oauth-clients");
  expect(await listResponse.text()).not.toContain(firstSecret);

  await page.getByLabel("Search").fill(clientId);
  await expect(page.getByRole("button", { name: clientId })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-oauth-clients-desktop.png", fullPage: true });

  await page.getByRole("button", { name: clientId }).click();
  await expect(page.getByLabel("Generated client secret")).toHaveCount(0);
  await page.getByLabel("Client credentials TTL").selectOption("86400");
  await page.getByLabel("Enabled for OAuth client validation").uncheck();
  await page.getByLabel(/echo/).uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("OAuth client saved.")).toBeVisible();
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(page.getByText("24 hr")).toBeVisible();

  await page.getByRole("button", { name: "Regenerate secret" }).click();
  await expect(page.getByText("New client secret generated. Copy it now.")).toBeVisible();
  await expect(generatedSecret).toContainText("mcp_mock_");

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "OAuth clients" })).toBeVisible();
  await expect(page.getByLabel("Search")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-oauth-clients-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("OAuth client deleted.")).toBeVisible();
  await expect(page.getByRole("button", { name: clientId })).toHaveCount(0);
});
