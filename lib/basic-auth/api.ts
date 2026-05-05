import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { BasicUserBuiltInError, BasicUserNotFoundError, BasicUserValidationError } from "@/lib/basic-auth/types";
import type { BasicUserCreateInput, BasicUserUpdateInput } from "@/lib/basic-auth/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function basicUserCreateInputFromBody(body: unknown): BasicUserCreateInput {
  const record = asRecord(body);
  return {
    username: asString(record.username),
    password: asString(record.password),
    enabled: asBoolean(record.enabled, true),
  };
}

export function basicUserUpdateInputFromBody(body: unknown): BasicUserUpdateInput {
  const record = asRecord(body);
  return {
    password: typeof record.password === "string" && record.password ? record.password : null,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
  };
}

export function basicUserErrorResponse(error: unknown) {
  if (error instanceof BasicUserValidationError) {
    return NextResponse.json({ error: "validation_failed", fieldErrors: error.fieldErrors }, { status: 400 });
  }

  if (error instanceof BasicUserBuiltInError) {
    return NextResponse.json(
      { error: "protected_builtin", message: "Built-in default/default Basic user is locked." },
      { status: 409 },
    );
  }

  if (error instanceof BasicUserNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "validation_failed", fieldErrors: { username: "Basic username must be unique." } },
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
