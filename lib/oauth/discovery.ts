import { createPublicKey } from "node:crypto";
import {
  DEFAULT_OAUTH_ISSUER,
  DEFAULT_OAUTH_PRIVATE_KEY_PEM,
  OAUTH_JWT_ALGORITHM,
  OAUTH_JWT_KEY_ID,
} from "@/lib/oauth/types";

const ENDPOINT_SCOPE_PATTERN = "endpoint:<endpoint_id>";
const SUPPORTED_GRANT_TYPES = ["authorization_code", "client_credentials"] as const;
const SUPPORTED_RESPONSE_TYPES = ["code"] as const;
const SUPPORTED_CLIENT_AUTH_METHODS = ["client_secret_post"] as const;

function configuredBaseUrl() {
  return process.env.APP_BASE_URL || "";
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "") || DEFAULT_OAUTH_ISSUER;
}

function absoluteUrl(baseUrl: string, path: string) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

export function resolveOAuthIssuer(requestUrl?: string) {
  if (configuredBaseUrl()) {
    return normalizeBaseUrl(configuredBaseUrl());
  }
  if (requestUrl) {
    return normalizeBaseUrl(new URL(requestUrl).origin);
  }
  return DEFAULT_OAUTH_ISSUER;
}

export function oauthDiscoveryUrls(baseUrl: string) {
  return {
    issuer: normalizeBaseUrl(baseUrl),
    authorizationEndpoint: absoluteUrl(baseUrl, "/oauth/authorize"),
    tokenEndpoint: absoluteUrl(baseUrl, "/oauth/token"),
    jwksUri: absoluteUrl(baseUrl, "/oauth/jwks"),
    protectedResourceMetadata: absoluteUrl(baseUrl, "/.well-known/oauth-protected-resource"),
    authorizationServerMetadata: absoluteUrl(baseUrl, "/.well-known/oauth-authorization-server"),
    openidConfiguration: absoluteUrl(baseUrl, "/.well-known/openid-configuration"),
  };
}

export function oauthAuthorizationServerMetadata(baseUrl: string) {
  const urls = oauthDiscoveryUrls(baseUrl);
  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorizationEndpoint,
    token_endpoint: urls.tokenEndpoint,
    jwks_uri: urls.jwksUri,
    response_types_supported: [...SUPPORTED_RESPONSE_TYPES],
    grant_types_supported: [...SUPPORTED_GRANT_TYPES],
    token_endpoint_auth_methods_supported: [...SUPPORTED_CLIENT_AUTH_METHODS],
    scopes_supported: [ENDPOINT_SCOPE_PATTERN],
    code_challenge_methods_supported: [],
  };
}

export function oauthProtectedResourceMetadata(baseUrl: string) {
  const urls = oauthDiscoveryUrls(baseUrl);
  return {
    resource: "mcp-mock-server",
    authorization_servers: [urls.authorizationServerMetadata],
    bearer_methods_supported: ["header"],
    scopes_supported: [ENDPOINT_SCOPE_PATTERN],
  };
}

export function openIdConfigurationMetadata(baseUrl: string) {
  const authorizationServer = oauthAuthorizationServerMetadata(baseUrl);
  return {
    ...authorizationServer,
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: [],
    claims_supported: ["iss", "aud", "sub", "client_id", "grant_type", "iat", "exp", "jti", "scope"],
  };
}

export function oauthJsonWebKeySet() {
  const jwk = createPublicKey(process.env.OAUTH_JWT_PRIVATE_KEY_PEM || DEFAULT_OAUTH_PRIVATE_KEY_PEM).export({
    format: "jwk",
  });

  return {
    keys: [
      {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        kid: OAUTH_JWT_KEY_ID,
        alg: OAUTH_JWT_ALGORITHM,
        use: "sig",
        key_ops: ["verify"],
      },
    ],
  };
}
