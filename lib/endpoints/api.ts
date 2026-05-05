import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { EndpointDeleteAuthorizationError, EndpointNotFoundError, EndpointValidationError } from "@/lib/endpoints/types";
import type { EndpointDeleteInput, EndpointInput } from "@/lib/endpoints/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function endpointInputFromBody(body: unknown): EndpointInput {
  const record = asRecord(body);
  const parameters = Array.isArray(record.parameters) ? record.parameters.map(asRecord) : [];
  const responseCases = Array.isArray(record.responseCases) ? record.responseCases.map(asRecord) : [];

  return {
    name: asString(record.name),
    title: asString(record.title),
    description: asString(record.description),
    enabled: asBoolean(record.enabled, true),
    deleteCode: nullableString(record.deleteCode),
    defaultResponseJson: asString(record.defaultResponseJson, "{}"),
    failureMode: asString(record.failureMode, "none") as EndpointInput["failureMode"],
    failureStatusCode: nullableNumber(record.failureStatusCode),
    failureDelayMs: asNumber(record.failureDelayMs),
    failureMessage: nullableString(record.failureMessage),
    malformedResponseJson: nullableString(record.malformedResponseJson),
    parameters: parameters.map((parameter) => ({
      name: asString(parameter.name),
      label: asString(parameter.label),
      description: asString(parameter.description),
      type: asString(parameter.type, "string") as EndpointInput["parameters"][number]["type"],
      required: asBoolean(parameter.required),
      defaultValueJson: nullableString(parameter.defaultValueJson),
    })),
    responseCases: responseCases.map((responseCase) => ({
      name: asString(responseCase.name),
      priority: asNumber(responseCase.priority),
      matchArgsJson: asString(responseCase.matchArgsJson, "{}"),
      responseJson: asString(responseCase.responseJson, "{}"),
      statusCode: asNumber(responseCase.statusCode, 200),
      delayMs: asNumber(responseCase.delayMs),
      errorMode: asString(responseCase.errorMode, "none") as EndpointInput["responseCases"][number]["errorMode"],
      errorStatusCode: nullableNumber(responseCase.errorStatusCode),
      errorMessage: nullableString(responseCase.errorMessage),
      errorBodyJson: nullableString(responseCase.errorBodyJson),
      isDefault: asBoolean(responseCase.isDefault),
    })),
  };
}

export function endpointDeleteInputFromBody(body: unknown): EndpointDeleteInput {
  const record = asRecord(body);
  return {
    deleteCode: nullableString(record.deleteCode),
    rootPassword: nullableString(record.rootPassword),
  };
}

export function endpointErrorResponse(error: unknown) {
  if (error instanceof EndpointValidationError) {
    return NextResponse.json({ error: "validation_failed", fieldErrors: error.fieldErrors }, { status: 400 });
  }

  if (error instanceof EndpointDeleteAuthorizationError) {
    if (error.reason === "protected_default") {
      return NextResponse.json(
        { error: "protected_default", message: "Built-in endpoint defaults cannot be deleted through this action." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "delete_confirmation_failed", message: "Enter the endpoint delete code or root password to delete." },
      { status: 403 },
    );
  }

  if (error instanceof EndpointNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "validation_failed", fieldErrors: { name: "Endpoint name must be unique." } },
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
