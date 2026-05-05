import type {
  CaseErrorMode,
  EndpointInput,
  EndpointParamType,
  FailureMode,
  ResponseCaseInput,
} from "@/lib/endpoints/types";
import { EndpointValidationError } from "@/lib/endpoints/types";

const endpointNamePattern = /^[A-Za-z0-9_-]{1,64}$/;
const paramNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const paramTypes = new Set<EndpointParamType>(["string", "number", "boolean"]);
const failureModes = new Set<FailureMode>(["none", "delay", "error", "invalid_json", "wrong_content_type", "empty_body"]);
const caseErrorModes = new Set<CaseErrorMode>(["none", "error", "protocol_error"]);

function addError(errors: Record<string, string>, field: string, message: string) {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function parseJson(errors: Record<string, string>, field: string, value: string, expectedObject = false) {
  try {
    const parsed = JSON.parse(value);
    if (expectedObject && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) {
      addError(errors, field, "Must be a JSON object.");
    }
  } catch {
    addError(errors, field, "Must be valid JSON.");
  }
}

function validateStatus(errors: Record<string, string>, field: string, value: number | null | undefined) {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 100 || value > 599) {
    addError(errors, field, "Must be an HTTP status code from 100 to 599.");
  }
}

function validateDelay(errors: Record<string, string>, field: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 30_000) {
    addError(errors, field, "Must be a whole number from 0 to 30000.");
  }
}

export function normalizeEndpointInput(input: EndpointInput): EndpointInput {
  return {
    ...input,
    name: input.name.trim(),
    title: input.title?.trim() ?? "",
    description: input.description?.trim() ?? "",
    deleteCode: input.deleteCode?.trim() ? input.deleteCode.trim() : null,
    failureStatusCode: input.failureStatusCode ?? null,
    failureMessage: input.failureMessage?.trim() ? input.failureMessage.trim() : null,
    malformedResponseJson: input.malformedResponseJson?.trim() ? input.malformedResponseJson.trim() : null,
    parameters: input.parameters.map((parameter) => ({
      ...parameter,
      name: parameter.name.trim(),
      label: parameter.label?.trim() ?? "",
      description: parameter.description?.trim() ?? "",
      defaultValueJson: parameter.defaultValueJson?.trim() ? parameter.defaultValueJson.trim() : null,
    })),
    responseCases: input.responseCases.map((responseCase) => ({
      ...responseCase,
      name: responseCase.name.trim(),
      errorStatusCode: responseCase.errorStatusCode ?? null,
      errorMessage: responseCase.errorMessage?.trim() ? responseCase.errorMessage.trim() : null,
      errorBodyJson: responseCase.errorBodyJson?.trim() ? responseCase.errorBodyJson.trim() : null,
    })),
  };
}

export function validateEndpointInput(rawInput: EndpointInput): EndpointInput {
  const input = normalizeEndpointInput(rawInput);
  const errors: Record<string, string> = {};

  if (!endpointNamePattern.test(input.name)) {
    addError(errors, "name", "Use 1-64 letters, numbers, underscores, or hyphens.");
  }
  if ((input.title ?? "").length > 80) {
    addError(errors, "title", "Use 80 characters or fewer.");
  }
  if ((input.description ?? "").length > 500) {
    addError(errors, "description", "Use 500 characters or fewer.");
  }
  if (input.deleteCode && !/^\d{8}$/.test(input.deleteCode)) {
    addError(errors, "deleteCode", "Use exactly 8 digits.");
  }

  parseJson(errors, "defaultResponseJson", input.defaultResponseJson);

  if (!failureModes.has(input.failureMode)) {
    addError(errors, "failureMode", "Choose a supported failure mode.");
  }
  validateStatus(errors, "failureStatusCode", input.failureStatusCode);
  validateDelay(errors, "failureDelayMs", input.failureDelayMs);
  if (input.failureMode === "error" && input.failureStatusCode == null) {
    addError(errors, "failureStatusCode", "Required when forced error mode is selected.");
  }
  if (input.malformedResponseJson) {
    parseJson(errors, "malformedResponseJson", input.malformedResponseJson);
  }

  validateParameters(errors, input);
  validateResponseCases(errors, input.responseCases);

  if (Object.keys(errors).length > 0) {
    throw new EndpointValidationError(errors);
  }

  return input;
}

function validateParameters(errors: Record<string, string>, input: EndpointInput) {
  if (input.parameters.length > 3) {
    addError(errors, "parameters", "Use no more than three parameters.");
  }

  const names = new Set<string>();
  input.parameters.forEach((parameter, index) => {
    const prefix = `parameters.${index}`;
    if (!paramNamePattern.test(parameter.name)) {
      addError(errors, `${prefix}.name`, "Use a valid parameter name.");
    }
    if (names.has(parameter.name)) {
      addError(errors, `${prefix}.name`, "Parameter names must be unique.");
    }
    names.add(parameter.name);
    if (!paramTypes.has(parameter.type)) {
      addError(errors, `${prefix}.type`, "Choose string, number, or boolean.");
    }
    if (parameter.defaultValueJson) {
      parseJson(errors, `${prefix}.defaultValueJson`, parameter.defaultValueJson);
    }
  });
}

function validateResponseCases(errors: Record<string, string>, responseCases: ResponseCaseInput[]) {
  if (responseCases.length === 0) {
    addError(errors, "responseCases", "Add at least one response case.");
  }

  const names = new Set<string>();
  let defaultCount = 0;

  responseCases.forEach((responseCase, index) => {
    const prefix = `responseCases.${index}`;
    if (!responseCase.name || responseCase.name.length > 64) {
      addError(errors, `${prefix}.name`, "Use a case name from 1 to 64 characters.");
    }
    if (names.has(responseCase.name)) {
      addError(errors, `${prefix}.name`, "Response case names must be unique.");
    }
    names.add(responseCase.name);
    if (!Number.isInteger(responseCase.priority)) {
      addError(errors, `${prefix}.priority`, "Priority must be a whole number.");
    }
    parseJson(errors, `${prefix}.matchArgsJson`, responseCase.matchArgsJson, true);
    parseJson(errors, `${prefix}.responseJson`, responseCase.responseJson);
    validateStatus(errors, `${prefix}.statusCode`, responseCase.statusCode);
    validateDelay(errors, `${prefix}.delayMs`, responseCase.delayMs);
    if (!caseErrorModes.has(responseCase.errorMode)) {
      addError(errors, `${prefix}.errorMode`, "Choose a supported case error mode.");
    }
    validateStatus(errors, `${prefix}.errorStatusCode`, responseCase.errorStatusCode);
    if (responseCase.errorBodyJson) {
      parseJson(errors, `${prefix}.errorBodyJson`, responseCase.errorBodyJson);
    }
    if (responseCase.isDefault) {
      defaultCount += 1;
    }
  });

  if (defaultCount !== 1) {
    addError(errors, "responseCases.default", "Choose exactly one default response case.");
  }
}
