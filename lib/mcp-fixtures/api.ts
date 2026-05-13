import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { McpFixtureNotFoundError, McpFixtureValidationError } from "@/lib/mcp-fixtures/types";
import type {
  McpCompletionCandidateInput,
  McpPromptArgumentInput,
  McpPromptInput,
  McpPromptMessageInput,
  McpResourceInput,
  McpResourceTemplateArgumentInput,
  McpResourceTemplateInput,
} from "@/lib/mcp-fixtures/types";

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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mcpResourceTemplateInputFromBody(body: unknown): McpResourceTemplateInput {
  const record = asRecord(body);
  const argumentsInput: McpResourceTemplateArgumentInput[] = asArray(record.arguments).map((value) => {
    const argument = asRecord(value);
    return {
      name: asString(argument.name),
      description: asString(argument.description),
      required: asBoolean(argument.required, true),
      sampleValueJson: nullableString(argument.sampleValueJson),
    };
  });
  const completionCandidates: McpCompletionCandidateInput[] = asArray(record.completionCandidates).map((value) => {
    const candidate = asRecord(value);
    return {
      argumentName: asString(candidate.argumentName),
      value: asString(candidate.value),
      label: asString(candidate.label),
    };
  });

  return {
    uriTemplate: asString(record.uriTemplate),
    name: asString(record.name),
    title: asString(record.title),
    description: asString(record.description),
    mimeType: asString(record.mimeType, "text/plain"),
    enabled: asBoolean(record.enabled, true),
    textTemplate: nullableString(record.textTemplate),
    blobTemplateBase64: nullableString(record.blobTemplateBase64),
    annotationsJson: nullableString(record.annotationsJson),
    arguments: argumentsInput,
    completionCandidates,
  };
}

export function mcpPromptInputFromBody(body: unknown): McpPromptInput {
  const record = asRecord(body);
  const argumentsInput: McpPromptArgumentInput[] = asArray(record.arguments).map((value) => {
    const argument = asRecord(value);
    return {
      name: asString(argument.name),
      title: asString(argument.title),
      description: asString(argument.description),
      required: asBoolean(argument.required, true),
    };
  });
  const messages: McpPromptMessageInput[] = asArray(record.messages).map((value) => {
    const message = asRecord(value);
    const role = asString(message.role, "user");
    return {
      role: role === "assistant" ? "assistant" : "user",
      textTemplate: nullableString(message.textTemplate),
      resourceUri: nullableString(message.resourceUri),
      resourceMimeType: nullableString(message.resourceMimeType),
    };
  });
  const completionCandidates: McpCompletionCandidateInput[] = asArray(record.completionCandidates).map((value) => {
    const candidate = asRecord(value);
    return {
      argumentName: asString(candidate.argumentName),
      value: asString(candidate.value),
      label: asString(candidate.label),
    };
  });

  return {
    name: asString(record.name),
    title: asString(record.title),
    description: asString(record.description),
    enabled: asBoolean(record.enabled, true),
    arguments: argumentsInput,
    messages,
    completionCandidates,
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
        {
          error: "validation_failed",
          fieldErrors: {
            uri: "Resource URI or template identity must be unique.",
            uriTemplate: "Resource URI template or name must be unique.",
            name: "Resource name or template name must be unique.",
          },
        },
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
