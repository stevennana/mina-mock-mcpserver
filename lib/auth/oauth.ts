import { createPublicKey, createVerify } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/db/client";
import { resolveBaseUrl } from "@/lib/operator/config";
import {
  DEFAULT_OAUTH_PRIVATE_KEY_PEM,
  OAUTH_JWT_ALGORITHM,
  OAUTH_JWT_KEY_ID,
} from "@/lib/oauth/types";
import type { OAuthAccessTokenClaims } from "@/lib/oauth/types";

export type ParsedBearerAuthorization =
  | { kind: "missing" }
  | { kind: "bearer"; token: string }
  | { kind: "invalid"; reason: "malformed" }
  | { kind: "unsupported"; scheme: string };

export type OAuthBearerPrincipal = {
  subject: string;
  clientId: string;
  grantType: OAuthAccessTokenClaims["grant_type"];
  jti: string;
  resource: string;
  endpointIds: string[];
  resourceIds: string[];
  promptIds: string[];
};

export type OAuthBearerAuthorizationResolution =
  | { kind: "missing" }
  | { kind: "authenticated"; principal: OAuthBearerPrincipal }
  | { kind: "unauthorized"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodeJwtPart(part: string) {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function oauthJwtPublicKey() {
  return createPublicKey(process.env.OAUTH_JWT_PRIVATE_KEY_PEM || DEFAULT_OAUTH_PRIVATE_KEY_PEM);
}

function verifyJwtSignature(signingInput: string, signature: string) {
  try {
    return createVerify("RSA-SHA256").update(signingInput).end().verify(oauthJwtPublicKey(), signature, "base64url");
  } catch {
    return false;
  }
}

function parseClaims(value: unknown): OAuthAccessTokenClaims | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.iss !== "string" ||
    typeof value.aud !== "string" ||
    typeof value.resource !== "string" ||
    typeof value.sub !== "string" ||
    typeof value.client_id !== "string" ||
    (value.grant_type !== "authorization_code" && value.grant_type !== "client_credentials") ||
    typeof value.iat !== "number" ||
    typeof value.exp !== "number" ||
    typeof value.jti !== "string" ||
    typeof value.scope !== "string" ||
    !Array.isArray(value.endpoint_permissions) ||
    !value.endpoint_permissions.every((endpointId) => typeof endpointId === "string") ||
    !Array.isArray(value.resource_permissions) ||
    !value.resource_permissions.every((resourceId) => typeof resourceId === "string") ||
    !Array.isArray(value.prompt_permissions) ||
    !value.prompt_permissions.every((promptId) => typeof promptId === "string")
  ) {
    return null;
  }

  return value as OAuthAccessTokenClaims;
}

function parseBearerJwt(token: string): OAuthAccessTokenClaims | null {
  const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const header = decodeJwtPart(encodedHeader);
  if (!isRecord(header) || header.alg !== OAUTH_JWT_ALGORITHM || header.kid !== OAUTH_JWT_KEY_ID) {
    return null;
  }

  if (!verifyJwtSignature(`${encodedHeader}.${encodedPayload}`, signature)) {
    return null;
  }

  return parseClaims(decodeJwtPart(encodedPayload));
}

function parseStoredEndpointPermissions(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((endpointId) => typeof endpointId === "string")
      ? Array.from(new Set(parsed)).sort()
      : null;
  } catch {
    return null;
  }
}

function parseStoredStringPermissions(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
      ? Array.from(new Set(parsed)).sort()
      : null;
  } catch {
    return null;
  }
}

export function parseBearerAuthorizationHeader(header: string | null): ParsedBearerAuthorization {
  if (!header) {
    return { kind: "missing" };
  }

  const match = header.match(/^(\S+)\s+(\S+)$/);
  if (!match) {
    return { kind: "invalid", reason: "malformed" };
  }

  const [, scheme, token] = match;
  if (scheme.toLowerCase() !== "bearer") {
    return { kind: "unsupported", scheme };
  }

  return token ? { kind: "bearer", token } : { kind: "invalid", reason: "malformed" };
}

export async function resolveOAuthBearerAuthorizationHeader(
  header: string | null,
  request: Request | string,
  client: PrismaClient = createPrismaClient(),
  now: Date = new Date(),
): Promise<OAuthBearerAuthorizationResolution> {
  const parsed = parseBearerAuthorizationHeader(header);
  if (parsed.kind === "missing") {
    return { kind: "missing" };
  }
  if (parsed.kind === "invalid" || parsed.kind === "unsupported") {
    return { kind: "unauthorized", reason: parsed.kind };
  }

  const claims = parseBearerJwt(parsed.token);
  if (!claims) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const issuer =
    typeof request === "string"
      ? (await resolveBaseUrl(new Request(request), client)).baseUrl
      : (await resolveBaseUrl(request, client)).baseUrl;
  if (claims.iss !== issuer) {
    return { kind: "unauthorized", reason: "invalid_issuer" };
  }
  if (claims.aud !== claims.resource || !claims.resource) {
    return { kind: "unauthorized", reason: "invalid_audience" };
  }
  if (claims.exp <= nowSeconds) {
    return { kind: "unauthorized", reason: "expired" };
  }

  const storedToken = await client.oAuthIssuedToken.findUnique({
    where: { jti: claims.jti },
    include: { oauthClient: true, oauthUser: true },
  });
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt.getTime() <= now.getTime()) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }
  if (
    storedToken.issuer !== claims.iss ||
    storedToken.resource !== claims.resource ||
    storedToken.grantType !== claims.grant_type ||
    storedToken.oauthClient.clientId !== claims.client_id ||
    !storedToken.oauthClient.enabled
  ) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }
  if (storedToken.oauthUser && (!storedToken.oauthUser.enabled || storedToken.oauthUser.id !== claims.sub)) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }
  if (!storedToken.oauthUser && claims.sub !== `client:${claims.client_id}`) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }

  const storedEndpointIds = parseStoredEndpointPermissions(storedToken.endpointPermissionsJson);
  const storedResourceIds = parseStoredStringPermissions(storedToken.resourcePermissionsJson);
  const storedPromptIds = parseStoredStringPermissions(storedToken.promptPermissionsJson);
  const claimEndpointIds = Array.from(new Set(claims.endpoint_permissions)).sort();
  const claimResourceIds = Array.from(new Set(claims.resource_permissions)).sort();
  const claimPromptIds = Array.from(new Set(claims.prompt_permissions)).sort();
  if (
    !storedEndpointIds ||
    !storedResourceIds ||
    !storedPromptIds ||
    JSON.stringify(storedEndpointIds) !== JSON.stringify(claimEndpointIds) ||
    JSON.stringify(storedResourceIds) !== JSON.stringify(claimResourceIds) ||
    JSON.stringify(storedPromptIds) !== JSON.stringify(claimPromptIds)
  ) {
    return { kind: "unauthorized", reason: "invalid_token" };
  }

  return {
    kind: "authenticated",
    principal: {
      subject: claims.sub,
      clientId: claims.client_id,
      grantType: claims.grant_type,
      jti: claims.jti,
      resource: claims.resource,
      endpointIds: claimEndpointIds,
      resourceIds: claimResourceIds,
      promptIds: claimPromptIds,
    },
  };
}
