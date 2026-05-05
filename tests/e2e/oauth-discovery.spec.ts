import { expect, test } from "@playwright/test";
import { createPublicKey, createVerify } from "node:crypto";

function decodeJwt(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  expect(encodedHeader).toBeTruthy();
  expect(encodedPayload).toBeTruthy();
  expect(signature).toBeTruthy();
  return {
    header: JSON.parse(Buffer.from(encodedHeader ?? "", "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8")),
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature,
  };
}

test("OAuth discovery metadata and JWKS are internally consistent @oauth-discovery", async ({ page, request }) => {
  const authorizationServerResponse = await request.get("/.well-known/oauth-authorization-server");
  expect(authorizationServerResponse.status()).toBe(200);
  const authorizationServer = await authorizationServerResponse.json();
  const expectedBaseUrl = authorizationServer.issuer as string;

  const protectedResourceResponse = await request.get("/.well-known/oauth-protected-resource");
  expect(protectedResourceResponse.status()).toBe(200);
  const protectedResource = await protectedResourceResponse.json();
  expect(protectedResource).toMatchObject({
    resource: "mcp-mock-server",
    authorization_servers: [`${expectedBaseUrl}/.well-known/oauth-authorization-server`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["endpoint:<endpoint_id>"],
    mcp_endpoint: `${expectedBaseUrl}/mcp/oauth`,
  });

  expect(authorizationServer).toMatchObject({
    issuer: expectedBaseUrl,
    authorization_endpoint: `${expectedBaseUrl}/oauth/authorize`,
    token_endpoint: `${expectedBaseUrl}/oauth/token`,
    jwks_uri: `${expectedBaseUrl}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    scopes_supported: ["endpoint:<endpoint_id>"],
  });
  expect(authorizationServer.grant_types_supported).not.toContain("refresh_token");
  expect(authorizationServer).not.toHaveProperty("revocation_endpoint");
  expect(authorizationServer.code_challenge_methods_supported).toEqual([]);

  const openidResponse = await request.get("/.well-known/openid-configuration");
  expect(openidResponse.status()).toBe(200);
  const openid = await openidResponse.json();
  expect(openid.issuer).toBe(authorizationServer.issuer);
  expect(openid.authorization_endpoint).toBe(authorizationServer.authorization_endpoint);
  expect(openid.token_endpoint).toBe(authorizationServer.token_endpoint);
  expect(openid.jwks_uri).toBe(authorizationServer.jwks_uri);
  expect(openid.id_token_signing_alg_values_supported).toEqual([]);

  const jwksResponse = await request.get("/oauth/jwks");
  expect(jwksResponse.status()).toBe(200);
  const jwks = await jwksResponse.json();
  expect(jwks.keys).toHaveLength(1);
  const jwk = jwks.keys[0];
  expect(jwk).toMatchObject({ kty: "RSA", kid: "mcp-mock-dev-rs256-1", alg: "RS256", use: "sig" });
  expect(jwk).not.toHaveProperty("d");
  expect(jwk).not.toHaveProperty("p");
  expect(jwk).not.toHaveProperty("q");

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
  const decoded = decodeJwt(tokenPayload.access_token);
  expect(decoded.header).toMatchObject({ alg: "RS256", typ: "JWT", kid: jwk.kid });
  expect(decoded.payload).toMatchObject({
    iss: expectedBaseUrl,
    aud: "mcp-mock-server",
    resource: "mcp-mock-server",
    client_id: "default",
    grant_type: "client_credentials",
    endpoint_permissions: ["endpoint_default_echo"],
  });

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const verified = createVerify("RSA-SHA256")
    .update(decoded.signingInput)
    .end()
    .verify(publicKey, decoded.signature ?? "", "base64url");
  expect(verified).toBe(true);

  await page.goto("/config");
  await expect(page.getByRole("heading", { name: "Config" })).toBeVisible();
  const connectionExample = page.getByLabel("MCP OAuth connection example");
  await expect(connectionExample).toContainText("/.well-known/oauth-protected-resource");
  await expect(connectionExample).toContainText("/.well-known/oauth-authorization-server");
  await expect(connectionExample).toContainText("/.well-known/openid-configuration");
  await expect(connectionExample).toContainText("/oauth/jwks");
});
