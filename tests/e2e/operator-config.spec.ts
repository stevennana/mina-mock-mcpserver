import { expect, test } from "@playwright/test";

test("operator config health, environment-driven base URL, connection guide, and logs guidance @operator-config", async ({
  page,
  request,
  baseURL,
}) => {
  expect(baseURL).toBeTruthy();
  const expectedBaseUrl = baseURL as string;
  const forwardedConfigResponse = await request.get("/api/config", {
    headers: {
      "x-forwarded-host": "forwarded.test.example",
      "x-forwarded-proto": "https",
    },
  });
  expect(forwardedConfigResponse.status()).toBe(200);
  const forwardedConfig = await forwardedConfigResponse.json();
  expect(forwardedConfig.baseUrl).toMatchObject({
    baseUrl: "https://forwarded.test.example",
    source: "forwarded_headers",
  });
  expect(forwardedConfig.routes.mcp.noAuth).toBe("https://forwarded.test.example/mcp/none");
  expect(forwardedConfig.routes.rest.tools).toBe("https://forwarded.test.example/rest/tools");
  expect(forwardedConfig.routes.oauth.authorizationServerMetadata).toBe(
    "https://forwarded.test.example/.well-known/oauth-authorization-server",
  );

  const configMutation = await request.post("/api/config", {
    data: {
      baseUrl: "https://operator.example",
      rootPassword: "e2e-root-password",
    },
  });
  expect(configMutation.status()).toBe(405);
  await expect(configMutation.json()).resolves.toMatchObject({
    error: "config_is_read_only",
  });

  const healthResponse = await request.get("/api/health");
  expect(healthResponse.status()).toBe(200);
  await expect(healthResponse.json()).resolves.toMatchObject({
    status: "ok",
    database: {
      status: "ok",
      counts: {
        endpoints: expect.any(Number),
        enabledEndpoints: expect.any(Number),
        basicUsers: expect.any(Number),
        oauthUsers: expect.any(Number),
        oauthClients: expect.any(Number),
      },
    },
  });

  const authorizationServerResponse = await request.get("/.well-known/oauth-authorization-server");
  expect(authorizationServerResponse.status()).toBe(200);
  await expect(authorizationServerResponse.json()).resolves.toMatchObject({
    issuer: expectedBaseUrl,
    token_endpoint: `${expectedBaseUrl}/oauth/token`,
    jwks_uri: `${expectedBaseUrl}/oauth/jwks`,
  });

  const tokenResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: "default",
      client_secret: "default",
      scope: "endpoint:endpoint_default_echo",
      resource: "mcp-mock-server",
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const tokenPayload = await tokenResponse.json();
  const [, encodedClaims] = String(tokenPayload.access_token).split(".");
  const claims = JSON.parse(Buffer.from(encodedClaims ?? "", "base64url").toString("utf8"));
  expect(claims.iss).toBe(expectedBaseUrl);

  await page.goto("/config");
  await expect(page.getByRole("heading", { name: "Config", exact: true })).toBeVisible();
  await expect(page.getByText("The admin UI and mutation APIs are public")).toBeVisible();
  await expect(page.getByText("Set APP_BASE_URL before startup for a fixed public origin.")).toBeVisible();
  await expect(page.getByLabel("Database base URL override")).toHaveCount(0);
  await expect(page.getByLabel("Root password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save config" })).toHaveCount(0);
  await expect(page.getByText(`${expectedBaseUrl}/mcp/none`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${expectedBaseUrl}/mcp/basic`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${expectedBaseUrl}/mcp/oauth`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${expectedBaseUrl}/rest/tools`, { exact: true }).first()).toBeVisible();
  await expect(
    page.locator(".guide-list code").filter({ hasText: `${expectedBaseUrl}/.well-known/oauth-authorization-server` }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Inspector" })).toBeVisible();
  await expect(page.getByText("LOG_LEVEL=info npm run start:logged")).toBeVisible();
  await expect(page.getByText("trace, debug, info, warn, error")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TLS for local tests" })).toBeVisible();
  await expect(page.getByText("Nginx TLS termination is still recommended for public deployments.")).toBeVisible();
  await expect(page.getByText("HTTP or proxy TLS")).toBeVisible();
  await expect(page.getByText("npm run cert:dev")).toBeVisible();
  await expect(page.getByText("TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:tls")).toBeVisible();
  await expect(page.getByText("npm run start:tls:smoke")).toBeVisible();
  await expect(page.getByText("npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy: npm run start:tls:smoke" })).toBeVisible();

  await page.getByRole("link", { name: "Open Inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "HTTPS self-signed local flow" })).toBeVisible();
  await expect(page.getByText("npm run start:tls:smoke")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy: npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OAuth authorization-code guide" })).toBeVisible();
  await expect(page.getByText(`${expectedBaseUrl}/oauth/authorize?response_type=code`)).toBeVisible();
  await expect(page.getByText("-d 'grant_type=authorization_code'")).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy authorization URL/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Base URL diagnostics" })).toBeVisible();
  await expect(page.getByText("OAuth issuer")).toBeVisible();
  await expect(page.getByText("Selected client")).toBeVisible();
  await expect(page.getByLabel("MCP client config example")).toContainText("mcp-mock-oauth");
  await expect(page.getByLabel("REST and OAuth curl examples")).toContainText(`curl ${expectedBaseUrl}/rest/tools`);
});
