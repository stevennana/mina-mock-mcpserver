import { expect, test } from "@playwright/test";

test.afterEach(async ({ request }) => {
  await request.post("/api/config", {
    data: {
      baseUrl: "",
      rootPassword: "e2e-root-password",
    },
  });
});

test("operator config health, base URL override, connection guide, and logs guidance @operator-config", async ({ page, request }) => {
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

  const invalidSave = await request.post("/api/config", {
    data: {
      baseUrl: "https://operator.example",
      rootPassword: "wrong-password",
    },
  });
  expect(invalidSave.status()).toBe(403);

  const invalidUrlSave = await request.post("/api/config", {
    data: {
      baseUrl: "https://root:secret@operator.example",
      rootPassword: "e2e-root-password",
    },
  });
  expect(invalidUrlSave.status()).toBe(400);

  const auditResponse = await request.get("/api/audit");
  expect(auditResponse.status()).toBe(200);
  const auditPayload = await auditResponse.json();
  const validationAudit = auditPayload.events.find(
    (event: { eventType: string; outcome: string; metadata: { reason?: string }; metadataJson?: string }) =>
      event.eventType === "system.config.base_url" &&
      event.outcome === "failure" &&
      event.metadata.reason === "validation_failed",
  );
  expect(validationAudit).toBeTruthy();
  expect(JSON.stringify(validationAudit)).not.toContain("secret");

  const save = await request.post("/api/config", {
    data: {
      baseUrl: "https://operator.example/",
      rootPassword: "e2e-root-password",
    },
  });
  expect(save.status()).toBe(200);
  const saved = await save.json();
  expect(saved.config.baseUrl).toMatchObject({
    baseUrl: "https://operator.example",
    source: "database",
    databaseOverride: "https://operator.example",
  });
  expect(saved.config.routes.mcp.oauth).toBe("https://operator.example/mcp/oauth");

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
    issuer: "https://operator.example",
    token_endpoint: "https://operator.example/oauth/token",
    jwks_uri: "https://operator.example/oauth/jwks",
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
  expect(claims.iss).toBe("https://operator.example");

  await page.goto("/config");
  await expect(page.getByRole("heading", { name: "Config", exact: true })).toBeVisible();
  await expect(page.getByText("The admin UI and mutation APIs are public")).toBeVisible();
  await expect(page.getByText("https://operator.example/mcp/none", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("https://operator.example/mcp/basic", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("https://operator.example/mcp/oauth", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("https://operator.example/rest/tools", { exact: true }).first()).toBeVisible();
  await expect(
    page.locator(".guide-list code").filter({ hasText: "https://operator.example/.well-known/oauth-authorization-server" }),
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
  await expect(page.getByLabel("MCP client config example")).toContainText("mcp-mock-oauth");
  await expect(page.getByLabel("REST and OAuth curl examples")).toContainText("curl https://operator.example/rest/tools");
  await page.goto("/config");

  await page.getByLabel("Database base URL override").fill("https://ui-operator.example");
  await page.getByLabel("Root password").fill("e2e-root-password");
  await page.getByRole("button", { name: "Save config" }).click();
  await expect(page.getByText("Base URL override saved.")).toBeVisible();
  await expect(page.getByText("https://ui-operator.example/mcp/none", { exact: true }).first()).toBeVisible();

  const clear = await request.post("/api/config", { data: { baseUrl: "", rootPassword: "e2e-root-password" } });
  expect(clear.status()).toBe(200);
});
