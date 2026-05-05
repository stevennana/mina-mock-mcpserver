import assert from "node:assert/strict";
import { createPublicKey, createSign, createVerify } from "node:crypto";
import test from "node:test";
import {
  oauthAuthorizationServerMetadata,
  oauthJsonWebKeySet,
  oauthProtectedResourceMetadata,
  openIdConfigurationMetadata,
  resolveOAuthIssuer,
} from "@/lib/oauth/discovery";
import { DEFAULT_OAUTH_PRIVATE_KEY_PEM, OAUTH_JWT_KEY_ID } from "@/lib/oauth/types";

test("OAuth discovery metadata advertises only implemented grant and endpoint behavior", () => {
  const baseUrl = "https://mock.example";
  const authorizationServer = oauthAuthorizationServerMetadata(baseUrl);
  const protectedResource = oauthProtectedResourceMetadata(baseUrl);
  const openid = openIdConfigurationMetadata(baseUrl);

  assert.equal(authorizationServer.issuer, baseUrl);
  assert.equal(authorizationServer.authorization_endpoint, `${baseUrl}/oauth/authorize`);
  assert.equal(authorizationServer.token_endpoint, `${baseUrl}/oauth/token`);
  assert.equal(authorizationServer.jwks_uri, `${baseUrl}/oauth/jwks`);
  assert.deepEqual(authorizationServer.grant_types_supported, ["authorization_code", "client_credentials"]);
  assert.deepEqual(authorizationServer.response_types_supported, ["code"]);
  assert.deepEqual(authorizationServer.token_endpoint_auth_methods_supported, ["client_secret_post"]);
  assert.deepEqual(authorizationServer.scopes_supported, ["endpoint:<endpoint_id>"]);
  assert.equal("revocation_endpoint" in authorizationServer, false);
  assert.equal(authorizationServer.grant_types_supported.includes("refresh_token" as never), false);

  assert.deepEqual(protectedResource.authorization_servers, [`${baseUrl}/.well-known/oauth-authorization-server`]);
  assert.equal("mcp_endpoint" in protectedResource, false);
  assert.equal(openid.issuer, authorizationServer.issuer);
  assert.equal(openid.token_endpoint, authorizationServer.token_endpoint);
  assert.deepEqual(openid.id_token_signing_alg_values_supported, []);
});

test("OAuth issuer resolution respects configured base URL before request origin", () => {
  const previousIssuer = process.env.OAUTH_ISSUER;
  const previousBaseUrl = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://configured.example/";
  delete process.env.OAUTH_ISSUER;

  try {
    assert.equal(resolveOAuthIssuer("http://127.0.0.1:3100/oauth/token"), "https://configured.example");
    process.env.OAUTH_ISSUER = "https://issuer.example/";
    assert.equal(resolveOAuthIssuer("http://127.0.0.1:3100/oauth/token"), "https://issuer.example");
  } finally {
    if (previousIssuer === undefined) {
      delete process.env.OAUTH_ISSUER;
    } else {
      process.env.OAUTH_ISSUER = previousIssuer;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previousBaseUrl;
    }
  }
});

test("OAuth JWKS exposes the public RS256 key without private material", () => {
  const jwks = oauthJsonWebKeySet();
  assert.equal(jwks.keys.length, 1);
  const [key] = jwks.keys;
  assert.equal(key.kid, OAUTH_JWT_KEY_ID);
  assert.equal(key.alg, "RS256");
  assert.equal(key.use, "sig");
  assert.equal("d" in key, false);
  assert.equal("p" in key, false);
  assert.equal("q" in key, false);

  const message = "jwks-verification-sample";
  const signature = createSign("RSA-SHA256").update(message).end().sign(DEFAULT_OAUTH_PRIVATE_KEY_PEM, "base64url");
  const publicKey = createPublicKey({ key, format: "jwk" });
  const verified = createVerify("RSA-SHA256").update(message).end().verify(publicKey, signature, "base64url");
  assert.equal(verified, true);
});
