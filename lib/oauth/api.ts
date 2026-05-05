import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS,
  OAuthClientBuiltInError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
  OAuthIssuedTokenNotFoundError,
  OAuthTokenError,
  OAuthUserBuiltInError,
  OAuthUserNotFoundError,
  OAuthUserValidationError,
} from "@/lib/oauth/types";
import type {
  OAuthClientCreateInput,
  OAuthClientUpdateInput,
  OAuthIssuedTokenListFilters,
  OAuthTokenExchangeInput,
  OAuthUserCreateInput,
  OAuthUserUpdateInput,
} from "@/lib/oauth/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function oauthUserCreateInputFromBody(body: unknown): OAuthUserCreateInput {
  const record = asRecord(body);
  return {
    username: asString(record.username),
    password: asString(record.password),
    enabled: asBoolean(record.enabled, true),
    accessTokenTtlSeconds: asNumber(record.accessTokenTtlSeconds, DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS),
  };
}

export function oauthUserUpdateInputFromBody(body: unknown): OAuthUserUpdateInput {
  const record = asRecord(body);
  return {
    password: typeof record.password === "string" && record.password ? record.password : null,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    accessTokenTtlSeconds: typeof record.accessTokenTtlSeconds === "number" ? record.accessTokenTtlSeconds : undefined,
  };
}

export function oauthUserErrorResponse(error: unknown) {
  if (error instanceof OAuthUserValidationError) {
    return NextResponse.json({ error: "validation_failed", fieldErrors: error.fieldErrors }, { status: 400 });
  }

  if (error instanceof OAuthUserBuiltInError) {
    return NextResponse.json(
      { error: "protected_builtin", message: "Built-in default/default OAuth user is locked." },
      { status: 409 },
    );
  }

  if (error instanceof OAuthUserNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "validation_failed", fieldErrors: { username: "OAuth username must be unique." } },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  console.error(error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export function oauthClientCreateInputFromBody(body: unknown): OAuthClientCreateInput {
  const record = asRecord(body);
  return {
    clientId: asString(record.clientId),
    displayName: asString(record.displayName),
    enabled: asBoolean(record.enabled, true),
    redirectUris: asStringArray(record.redirectUris),
    clientCredentialsTtlSeconds: asNumber(
      record.clientCredentialsTtlSeconds,
      DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS,
    ),
    allowedEndpointIds: asStringArray(record.allowedEndpointIds),
  };
}

export function oauthClientUpdateInputFromBody(body: unknown): OAuthClientUpdateInput {
  const record = asRecord(body);
  return {
    displayName: typeof record.displayName === "string" ? record.displayName : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    redirectUris: Array.isArray(record.redirectUris) ? asStringArray(record.redirectUris) : undefined,
    clientCredentialsTtlSeconds:
      typeof record.clientCredentialsTtlSeconds === "number" ? record.clientCredentialsTtlSeconds : undefined,
    allowedEndpointIds: Array.isArray(record.allowedEndpointIds) ? asStringArray(record.allowedEndpointIds) : undefined,
  };
}

export function oauthClientErrorResponse(error: unknown) {
  if (error instanceof OAuthClientValidationError) {
    return NextResponse.json({ error: "validation_failed", fieldErrors: error.fieldErrors }, { status: 400 });
  }

  if (error instanceof OAuthClientBuiltInError) {
    return NextResponse.json(
      { error: "protected_builtin", message: "Built-in default/default OAuth client is locked." },
      { status: 409 },
    );
  }

  if (error instanceof OAuthClientNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "validation_failed", fieldErrors: { clientId: "OAuth client ID must be unique." } },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  console.error(error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export function oauthTokenInputFromFormData(formData: FormData, issuer?: string): OAuthTokenExchangeInput {
  return {
    grantType: String(formData.get("grant_type") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
    redirectUri: String(formData.get("redirect_uri") ?? "").trim(),
    clientId: String(formData.get("client_id") ?? "").trim(),
    clientSecret: String(formData.get("client_secret") ?? ""),
    scope: String(formData.get("scope") ?? "").trim(),
    resource: String(formData.get("resource") ?? "").trim(),
    issuer,
  };
}

export function oauthTokenErrorResponse(error: unknown) {
  if (error instanceof OAuthTokenError) {
    return NextResponse.json(
      { error: error.code, error_description: error.message },
      {
        status: error.status,
        headers: error.code === "invalid_client" ? { "WWW-Authenticate": 'Basic realm="oauth-token"' } : undefined,
      },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

export function oauthIssuedTokenFiltersFromUrl(url: string): OAuthIssuedTokenListFilters {
  const searchParams = new URL(url).searchParams;
  const status = searchParams.get("status") ?? "all";
  const grantType = searchParams.get("grantType") ?? "all";
  return {
    status: status === "active" || status === "expired" || status === "revoked" ? status : "all",
    grantType:
      grantType === "authorization_code" || grantType === "client_credentials" ? grantType : "all",
    subject: searchParams.get("subject") ?? "",
    client: searchParams.get("client") ?? "",
  };
}

export function oauthIssuedTokenErrorResponse(error: unknown) {
  if (error instanceof OAuthIssuedTokenNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  console.error(error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
