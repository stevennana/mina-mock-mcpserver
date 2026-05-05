import { expect, test } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

test("issued token UI inspects metadata and revocation changes OAuth runtime 401 @token-revocation", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const endpointId = `endpoint_token_revoke_${suffix}`;
  const endpointName = `token-revoke-${suffix}`;
  const clientId = `token-revoker-${suffix}`;
  const prisma = createPrismaClient();

  try {
    await prisma.endpoint.create({
      data: {
        id: endpointId,
        name: endpointName,
        title: "Token Revocation E2E",
        description: "Allowed before token UI revocation.",
        defaultResponseJson: JSON.stringify({ tokenRevocation: "allowed" }),
        responseCases: {
          create: {
            id: `${endpointId}_default`,
            name: "Default",
            responseJson: JSON.stringify({ tokenRevocation: "allowed" }),
            isDefault: true,
          },
        },
      },
    });

    const createClientResponse = await request.post("/api/oauth-clients", {
      data: {
        clientId,
        displayName: "Token Revocation E2E",
        enabled: true,
        redirectUris: ["http://localhost:3000/oauth/callback"],
        clientCredentialsTtlSeconds: 900,
        allowedEndpointIds: [endpointId],
      },
    });
    expect(createClientResponse.status()).toBe(201);
    const createdClient = await createClientResponse.json();

    const tokenResponse = await request.post("/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: createdClient.clientSecret,
        resource: "https://resource.example/token-revocation",
      },
    });
    expect(tokenResponse.status()).toBe(200);
    const tokenPayload = await tokenResponse.json();
    const accessToken = tokenPayload.access_token as string;
    const claims = decodeJwt(accessToken);
    const bearer = `Bearer ${accessToken}`;

    const beforeRevoke = await request.post(`/rest/tools/${endpointName}/call`, {
      headers: { Authorization: bearer },
      data: { arguments: {} },
    });
    expect(beforeRevoke.status()).toBe(200);
    expect(await beforeRevoke.json()).toEqual({ tokenRevocation: "allowed" });

    await page.goto("/tokens");
    await expect(page.getByRole("heading", { name: "Issued tokens" })).toBeVisible();
    await expect(page.getByText("Raw access token values are not stored or redisplayed here.")).toBeVisible();
    await page.getByRole("textbox", { name: "Client" }).fill(clientId);
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText("1 shown")).toBeVisible();
    const tokenRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: claims.jti }) });
    await expect(page.getByRole("button", { name: claims.jti })).toBeVisible();
    await expect(tokenRow.getByRole("cell", { name: clientId, exact: true })).toBeVisible();
    await expect(tokenRow.getByRole("cell", { name: "client_credentials", exact: true })).toBeVisible();
    await expect(page.getByText(accessToken)).toHaveCount(0);

    await page.getByRole("button", { name: claims.jti }).click();
    await expect(page.getByText('"endpoint_permissions"')).toBeVisible();
    await expect(page.getByText(endpointId, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Revoke token" }).click();
    await expect(page.getByText("Subsequent bearer calls now fail with 401.")).toBeVisible();
    await expect(page.locator(".endpoint-editor-panel .status-pill.danger").getByText("revoked", { exact: true })).toBeVisible();

    const revokedCall = await request.post(`/rest/tools/${endpointName}/call`, {
      headers: { Authorization: bearer },
      data: { arguments: {} },
    });
    expect(revokedCall.status()).toBe(401);

    await page.getByLabel("Status").selectOption("revoked");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("button", { name: claims.jti })).toBeVisible();

    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("button", { name: claims.jti })).toHaveCount(0);
  } finally {
    await prisma.$disconnect();
  }
});
