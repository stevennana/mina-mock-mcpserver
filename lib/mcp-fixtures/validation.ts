import type {
  McpCompletionCandidateInput,
  McpPromptInput,
  McpPromptMessageInput,
  McpResourceInput,
  McpResourceTemplateInput,
} from "@/lib/mcp-fixtures/types";
import { McpFixtureValidationError } from "@/lib/mcp-fixtures/types";

const namePattern = /^[A-Za-z0-9_-]{1,64}$/;
const argumentNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const uriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const mimeTypePattern = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(?:;[A-Za-z0-9_.+-]+=[A-Za-z0-9_.+-]+)*$/;
const placeholderPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const roles = new Set(["user", "assistant"]);

function addError(errors: Record<string, string>, field: string, message: string) {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function parseJson(errors: Record<string, string>, field: string, value: string | null | undefined, expectedObject = false) {
  if (!value) return;
  try {
    const parsed = JSON.parse(value);
    if (expectedObject && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) {
      addError(errors, field, "Must be a JSON object.");
    }
  } catch {
    addError(errors, field, "Must be valid JSON.");
  }
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function validateName(errors: Record<string, string>, field: string, value: string) {
  if (!namePattern.test(value)) {
    addError(errors, field, "Use 1-64 letters, numbers, underscores, or hyphens.");
  }
}

function validateArgumentName(errors: Record<string, string>, field: string, value: string) {
  if (!argumentNamePattern.test(value)) {
    addError(errors, field, "Use a valid argument name.");
  }
}

function validateUri(errors: Record<string, string>, field: string, value: string) {
  if (!uriSchemePattern.test(value) || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
    addError(errors, field, "Use an absolute MCP resource URI with a scheme.");
    return;
  }

  const protocol = value.slice(0, value.indexOf(":")).toLowerCase();
  if (protocol === "file") {
    addError(errors, field, "Local file URIs are not allowed.");
  }
}

function validateMimeType(errors: Record<string, string>, field: string, value: string) {
  if (!mimeTypePattern.test(value) || value.length > 120) {
    addError(errors, field, "Use a MIME type such as text/plain or application/json.");
  }
}

function validateTextOrBlob(
  errors: Record<string, string>,
  textField: string,
  textValue: string | null | undefined,
  blobField: string,
  blobValue: string | null | undefined,
) {
  const hasText = Boolean(textValue);
  const hasBlob = Boolean(blobValue);
  if (hasText === hasBlob) {
    addError(errors, textField, "Provide exactly one text or blob content value.");
    addError(errors, blobField, "Provide exactly one text or blob content value.");
  }
}

function templatePlaceholders(value: string) {
  const placeholders = new Set<string>();
  for (const match of value.matchAll(placeholderPattern)) {
    placeholders.add(match[1] ?? "");
  }
  return placeholders;
}

function validateCandidates(
  errors: Record<string, string>,
  candidates: McpCompletionCandidateInput[],
  argumentNames: Set<string>,
) {
  if (candidates.length > 100) {
    addError(errors, "completionCandidates", "Use no more than 100 completion candidates.");
  }

  const keys = new Set<string>();
  candidates.forEach((candidate, index) => {
    const prefix = `completionCandidates.${index}`;
    if (!argumentNames.has(candidate.argumentName)) {
      addError(errors, `${prefix}.argumentName`, "Choose an existing argument.");
    }
    if (!candidate.value || candidate.value.length > 200) {
      addError(errors, `${prefix}.value`, "Use a value from 1 to 200 characters.");
    }
    if ((candidate.label ?? "").length > 120) {
      addError(errors, `${prefix}.label`, "Use 120 characters or fewer.");
    }
    const key = `${candidate.argumentName}\u0000${candidate.value}`;
    if (keys.has(key)) {
      addError(errors, `${prefix}.value`, "Completion candidates must be unique per argument.");
    }
    keys.add(key);
  });
}

export function normalizeMcpResourceInput(input: McpResourceInput): McpResourceInput {
  return {
    ...input,
    uri: input.uri.trim(),
    name: input.name.trim(),
    title: input.title?.trim() ?? "",
    description: input.description?.trim() ?? "",
    mimeType: input.mimeType.trim().toLowerCase(),
    annotationsJson: normalizeOptional(input.annotationsJson),
    textContent: normalizeOptional(input.textContent),
    blobContentBase64: normalizeOptional(input.blobContentBase64),
  } as McpResourceInput;
}

export function validateMcpResourceInput(rawInput: McpResourceInput): McpResourceInput {
  const input = normalizeMcpResourceInput(rawInput);
  const errors: Record<string, string> = {};

  validateUri(errors, "uri", input.uri);
  validateName(errors, "name", input.name);
  validateMimeType(errors, "mimeType", input.mimeType);
  validateTextOrBlob(errors, "textContent", input.textContent, "blobContentBase64", input.blobContentBase64);
  parseJson(errors, "annotationsJson", input.annotationsJson, true);

  if (Object.keys(errors).length > 0) {
    throw new McpFixtureValidationError(errors);
  }
  return input;
}

export function normalizeMcpResourceTemplateInput(input: McpResourceTemplateInput): McpResourceTemplateInput {
  return {
    ...input,
    uriTemplate: input.uriTemplate.trim(),
    name: input.name.trim(),
    title: input.title?.trim() ?? "",
    description: input.description?.trim() ?? "",
    mimeType: input.mimeType.trim().toLowerCase(),
    annotationsJson: normalizeOptional(input.annotationsJson),
    textTemplate: normalizeOptional(input.textTemplate),
    blobTemplateBase64: normalizeOptional(input.blobTemplateBase64),
    arguments: input.arguments.map((argument) => ({
      ...argument,
      name: argument.name.trim(),
      description: argument.description?.trim() ?? "",
      required: argument.required ?? true,
      sampleValueJson: normalizeOptional(argument.sampleValueJson),
    })),
    completionCandidates: input.completionCandidates.map((candidate) => ({
      argumentName: candidate.argumentName.trim(),
      value: candidate.value.trim(),
      label: candidate.label?.trim() ?? "",
    })),
  } as McpResourceTemplateInput;
}

export function validateMcpResourceTemplateInput(rawInput: McpResourceTemplateInput): McpResourceTemplateInput {
  const input = normalizeMcpResourceTemplateInput(rawInput);
  const errors: Record<string, string> = {};

  validateUri(errors, "uriTemplate", input.uriTemplate.replace(placeholderPattern, "sample"));
  validateName(errors, "name", input.name);
  validateMimeType(errors, "mimeType", input.mimeType);
  validateTextOrBlob(errors, "textTemplate", input.textTemplate, "blobTemplateBase64", input.blobTemplateBase64);
  parseJson(errors, "annotationsJson", input.annotationsJson, true);

  const placeholders = templatePlaceholders(input.uriTemplate);
  const argumentNames = new Set<string>();
  input.arguments.forEach((argument, index) => {
    const prefix = `arguments.${index}`;
    validateArgumentName(errors, `${prefix}.name`, argument.name);
    if (argumentNames.has(argument.name)) {
      addError(errors, `${prefix}.name`, "Argument names must be unique.");
    }
    argumentNames.add(argument.name);
    if (!placeholders.has(argument.name)) {
      addError(errors, `${prefix}.name`, "Resource template arguments must appear in the URI template.");
    }
    parseJson(errors, `${prefix}.sampleValueJson`, argument.sampleValueJson);
  });
  for (const placeholder of placeholders) {
    if (!argumentNames.has(placeholder)) {
      addError(errors, "uriTemplate", "Every URI template placeholder needs a matching argument.");
    }
  }
  validateCandidates(errors, input.completionCandidates, argumentNames);

  if (Object.keys(errors).length > 0) {
    throw new McpFixtureValidationError(errors);
  }
  return input;
}

export function normalizeMcpPromptInput(input: McpPromptInput): McpPromptInput {
  return {
    ...input,
    name: input.name.trim(),
    title: input.title?.trim() ?? "",
    description: input.description?.trim() ?? "",
    arguments: input.arguments.map((argument) => ({
      ...argument,
      name: argument.name.trim(),
      title: argument.title?.trim() ?? "",
      description: argument.description?.trim() ?? "",
    })),
    messages: input.messages.map((message) => ({
      ...message,
      textTemplate: normalizeOptional(message.textTemplate),
      resourceUri: normalizeOptional(message.resourceUri),
      resourceMimeType: normalizeOptional(message.resourceMimeType)?.toLowerCase() ?? null,
    })),
    completionCandidates: input.completionCandidates.map((candidate) => ({
      argumentName: candidate.argumentName.trim(),
      value: candidate.value.trim(),
      label: candidate.label?.trim() ?? "",
    })),
  };
}

function validatePromptMessage(errors: Record<string, string>, message: McpPromptMessageInput, index: number) {
  const prefix = `messages.${index}`;
  if (!roles.has(message.role)) {
    addError(errors, `${prefix}.role`, "Choose a supported prompt message role.");
  }
  if (!message.textTemplate && !message.resourceUri) {
    addError(errors, `${prefix}.content`, "Add text or an embedded resource URI.");
  }
  if (message.resourceUri) {
    validateUri(errors, `${prefix}.resourceUri`, message.resourceUri);
  }
  if (message.resourceMimeType) {
    validateMimeType(errors, `${prefix}.resourceMimeType`, message.resourceMimeType);
  }
}

export function validateMcpPromptInput(rawInput: McpPromptInput): McpPromptInput {
  const input = normalizeMcpPromptInput(rawInput);
  const errors: Record<string, string> = {};

  validateName(errors, "name", input.name);
  if (input.messages.length === 0) {
    addError(errors, "messages", "Add at least one prompt message.");
  }

  const argumentNames = new Set<string>();
  input.arguments.forEach((argument, index) => {
    const prefix = `arguments.${index}`;
    validateArgumentName(errors, `${prefix}.name`, argument.name);
    if (argumentNames.has(argument.name)) {
      addError(errors, `${prefix}.name`, "Argument names must be unique.");
    }
    argumentNames.add(argument.name);
  });
  input.messages.forEach((message, index) => validatePromptMessage(errors, message, index));
  validateCandidates(errors, input.completionCandidates, argumentNames);

  if (Object.keys(errors).length > 0) {
    throw new McpFixtureValidationError(errors);
  }
  return input;
}
