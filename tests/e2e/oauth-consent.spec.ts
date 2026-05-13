import { expect, test } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

test("OAuth authorization login and consent creates an endpoint-bound code @oauth-consent", async ({
  page,
  request,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const clientId = `consent-client-${Date.now()}`;
  const redirectUri = new URL("/oauth/callback", baseURL).toString();
  const createResponse = await request.post("/api/oauth-clients", {
    data: {
      clientId,
      displayName: "Consent E2E Client",
      enabled: true,
      redirectUris: [redirectUri],
      clientCredentialsTtlSeconds: 3600,
      allowedEndpointIds: ["endpoint_default_echo"],
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  const oauthClientId = created.client.id as string;

  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    resource: "https://resource.example/e2e",
    state: "state-e2e",
  });

  await page.goto(`/oauth/authorize?${authorizeParams.toString()}`);
  await expect(page.getByRole("heading", { name: "Sign in for consent" })).toBeVisible();
  await expect(page.getByText("Consent E2E Client")).toBeVisible();
  await expect(page.getByText(redirectUri)).toBeVisible();

  await page.getByLabel("Username").fill("default");
  await page.getByLabel("Password").fill("default");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Approve MCP access" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Tools" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Resources" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Prompts" })).toBeVisible();
  await expect(page.getByText("default")).toBeVisible();
  await expect(page.getByText("https://resource.example/e2e")).toBeVisible();
  await expect(page.getByLabel(/echo/)).toBeChecked();
  await page.screenshot({ path: "test-results/oauth-consent-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "Approve MCP access" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/oauth-consent-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Approve selected permissions" }).click();
  await page.waitForURL(/\/oauth\/callback\?code=.*state=state-e2e/);
  const callbackUrl = new URL(page.url());
  const code = callbackUrl.searchParams.get("code");
  expect(code).toBeTruthy();

  const prisma = createPrismaClient();
  try {
    const storedCode = await prisma.oAuthAuthorizationCode.findUniqueOrThrow({
      where: { code: code ?? "" },
      include: { selectedEndpoints: true, selectedResources: true, selectedPrompts: true },
    });
    expect(storedCode.oauthClientId).toBe(oauthClientId);
    expect(storedCode.redirectUri).toBe(redirectUri);
    expect(storedCode.resource).toBe("https://resource.example/e2e");
    expect(storedCode.state).toBe("state-e2e");
    expect(storedCode.usedAt).toBeNull();
    expect(storedCode.selectedEndpoints.map((endpoint) => endpoint.endpointId)).toEqual(["endpoint_default_echo"]);
    expect(storedCode.selectedResources).toEqual([]);
    expect(storedCode.selectedPrompts).toEqual([]);
  } finally {
    await prisma.$disconnect();
  }

  const deleteResponse = await request.delete(`/api/oauth-clients/${oauthClientId}`);
  expect(deleteResponse.status()).toBe(200);
});

test("OAuth authorize and login invalid paths fail deterministically @oauth-consent", async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  await page.goto(
    `/oauth/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: "missing-client",
      redirect_uri: new URL("/oauth/callback", baseURL).toString(),
    }).toString()}`,
  );
  await expect(page.getByRole("heading", { name: "Authorization request failed" })).toBeVisible();
  await expect(page.getByText("invalid_client")).toBeVisible();

  await page.goto(
    `/oauth/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: "default",
      redirect_uri: new URL("/unregistered", baseURL).toString(),
    }).toString()}`,
  );
  await expect(page.getByRole("heading", { name: "Authorization request failed" })).toBeVisible();
  await expect(page.getByText("invalid_redirect_uri")).toBeVisible();

  await page.goto(
    `/oauth/login?${new URLSearchParams({
      response_type: "code",
      client_id: "default",
      redirect_uri: "http://localhost:3000/oauth/callback",
      resource: "mcp-mock-server",
    }).toString()}`,
  );
  await page.getByLabel("Username").fill("default");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("OAuth username or password is invalid.")).toBeVisible();
});
