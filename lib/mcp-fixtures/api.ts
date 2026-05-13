import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { McpFixtureNotFoundError, McpFixtureValidationError } from "@/lib/mcp-fixtures/types";
import type { McpResourceInput } from "@/lib/mcp-fixtures/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function mcpResourceInputFromBody(body: unknown): McpResourceInput {
  const record = asRecord(body);
  return {
    uri: asString(record.uri),
    name: asString(record.name),
    title: asString(record.title),
    description: asString(record.description),
    mimeType: asString(record.mimeType, "text/plain"),
    enabled: asBoolean(record.enabled, true),
    textContent: nullableString(record.textContent),
    blobContentBase64: nullableString(record.blobContentBase64),
    annotationsJson: nullableString(record.annotationsJson),
  };
}

export function mcpFixtureErrorResponse(error: unknown) {
  if (error instanceof McpFixtureValidationError) {
    return NextResponse.json({ error: "validation_failed", fieldErrors: error.fieldErrors }, { status: 400 });
  }

  if (error instanceof McpFixtureNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "validation_failed", fieldErrors: { uri: "Resource URI must be unique." } },
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
