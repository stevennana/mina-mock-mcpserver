import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS, OAuthUserBuiltInError, OAuthUserNotFoundError, OAuthUserValidationError } from "@/lib/oauth/types";
import type { OAuthUserCreateInput, OAuthUserUpdateInput } from "@/lib/oauth/types";

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
