import type { EndpointDetail, JsonValue } from "@/lib/endpoints/types";

export type EndpointRuntimeCase = EndpointDetail["responseCases"][number];
export type EndpointRuntimeParam = EndpointDetail["parameters"][number];

export type EndpointCallArguments = Record<string, JsonValue>;

export type EndpointCallSuccess = {
  kind: "matched";
  matchedCase: {
    id: string;
    name: string;
    isDefault: boolean;
  };
  body: JsonValue;
  statusCode: number;
  delayMs: number;
};

export type EndpointCallProtocolError = {
  kind: "protocol_error";
  matchedCase: {
    id: string;
    name: string;
    isDefault: boolean;
  };
  statusCode: number;
  body: JsonValue | null;
  message: string;
  delayMs: number;
};

export type EndpointCallError =
  | {
      kind: "not_found";
    }
  | {
      kind: "disabled";
    }
  | {
      kind: "forbidden";
      message: string;
    }
  | {
      kind: "invalid_arguments";
      message: string;
    }
  | {
      kind: "case_error";
      matchedCase: {
        id: string;
        name: string;
        isDefault: boolean;
      };
      statusCode: number;
      body: JsonValue | null;
      message: string;
      delayMs: number;
    }
  | EndpointCallProtocolError;

export type EndpointCallResult = EndpointCallSuccess | EndpointCallError;

export const MAX_ENDPOINT_DELAY_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: string): JsonValue {
  return JSON.parse(value) as JsonValue;
}

function argumentType(value: JsonValue): "string" | "number" | "boolean" | "object" | "array" | "null" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

function normalizeArguments(
  parameters: EndpointRuntimeParam[],
  rawArguments: unknown,
): { ok: true; value: EndpointCallArguments } | { ok: false; message: string } {
  if (!isRecord(rawArguments)) {
    return { ok: false, message: "tools/call params.arguments must be an object." };
  }

  const parameterNames = new Set(parameters.map((parameter) => parameter.name));
  for (const argName of Object.keys(rawArguments)) {
    if (!parameterNames.has(argName)) {
      return { ok: false, message: `Unexpected argument "${argName}".` };
    }
  }

  const normalized: EndpointCallArguments = {};
  for (const parameter of parameters) {
    const supplied = rawArguments[parameter.name];
    const value =
      supplied === undefined && parameter.defaultValueJson ? parseJson(parameter.defaultValueJson) : supplied;

    if (value === undefined) {
      if (parameter.required) {
        return { ok: false, message: `Missing required argument "${parameter.name}".` };
      }
      continue;
    }

    if (
      value === null ||
      Array.isArray(value) ||
      typeof value === "object" ||
      argumentType(value as JsonValue) !== parameter.type
    ) {
      return {
        ok: false,
        message: `Argument "${parameter.name}" must be ${parameter.type}.`,
      };
    }

    normalized[parameter.name] = value as JsonValue;
  }

  return { ok: true, value: normalized };
}

function sameArguments(left: EndpointCallArguments, right: EndpointCallArguments) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function boundedDelayMs(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_ENDPOINT_DELAY_MS, Math.trunc(value)));
}

function resolvedDelayMs(endpoint: EndpointDetail, responseCase: EndpointRuntimeCase) {
  if (responseCase.delayMs > 0) return boundedDelayMs(responseCase.delayMs);
  return endpoint.failureMode === "delay" ? boundedDelayMs(endpoint.failureDelayMs) : 0;
}

function endpointForcedErrorDelayMs(endpoint: EndpointDetail) {
  return boundedDelayMs(endpoint.failureDelayMs);
}

export async function applyEndpointCallDelay(
  callResult: EndpointCallResult,
  sleep: (delayMs: number) => Promise<void> = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
): Promise<EndpointCallResult> {
  if ("delayMs" in callResult && callResult.delayMs > 0) {
    await sleep(boundedDelayMs(callResult.delayMs));
  }
  return callResult;
}

export function selectEndpointResponseCase(
  endpoint: Pick<EndpointDetail, "parameters" | "responseCases">,
  rawArguments: unknown,
): { ok: true; value: EndpointRuntimeCase; arguments: EndpointCallArguments } | { ok: false; message: string } {
  const normalized = normalizeArguments(endpoint.parameters, rawArguments);
  if (!normalized.ok) return normalized;

  const defaultCase = endpoint.responseCases.find((responseCase) => responseCase.isDefault);
  const exactCases = endpoint.responseCases.filter((responseCase) => !responseCase.isDefault);
  const exactMatch = exactCases.find((responseCase) => {
    const matchArgs = parseJson(responseCase.matchArgsJson);
    return isRecord(matchArgs) && sameArguments(normalized.value, matchArgs as EndpointCallArguments);
  });

  const selected = exactMatch ?? defaultCase;
  if (!selected) {
    return { ok: false, message: "No matching response case is configured." };
  }

  return { ok: true, value: selected, arguments: normalized.value };
}

export function executeEndpointDetail(endpoint: EndpointDetail | null, rawArguments: unknown): EndpointCallResult {
  if (!endpoint) {
    return { kind: "not_found" };
  }
  if (!endpoint.enabled) {
    return { kind: "disabled" };
  }

  const selected = selectEndpointResponseCase(endpoint, rawArguments);
  if (!selected.ok) {
    return { kind: "invalid_arguments", message: selected.message };
  }

  const matchedCase = {
    id: selected.value.id,
    name: selected.value.name,
    isDefault: selected.value.isDefault,
  };

  if (endpoint.failureMode === "error") {
    return {
      kind: "protocol_error",
      matchedCase,
      statusCode: endpoint.failureStatusCode ?? 500,
      body: null,
      message: endpoint.failureMessage ?? "Endpoint forced error.",
      delayMs: endpointForcedErrorDelayMs(endpoint),
    };
  }

  if (selected.value.errorMode === "error") {
    const body = selected.value.errorBodyJson ? parseJson(selected.value.errorBodyJson) : null;
    return {
      kind: "case_error",
      matchedCase,
      statusCode: selected.value.errorStatusCode ?? selected.value.statusCode,
      body,
      message: selected.value.errorMessage ?? "Endpoint response case returned an error.",
      delayMs: resolvedDelayMs(endpoint, selected.value),
    };
  }

  if (selected.value.errorMode === "protocol_error") {
    const body = selected.value.errorBodyJson ? parseJson(selected.value.errorBodyJson) : null;
    return {
      kind: "protocol_error",
      matchedCase,
      statusCode: selected.value.errorStatusCode ?? 500,
      body,
      message: selected.value.errorMessage ?? "Endpoint response case returned a protocol error.",
      delayMs: resolvedDelayMs(endpoint, selected.value),
    };
  }

  return {
    kind: "matched",
    matchedCase,
    body: parseJson(selected.value.responseJson),
    statusCode: selected.value.statusCode,
    delayMs: resolvedDelayMs(endpoint, selected.value),
  };
}
