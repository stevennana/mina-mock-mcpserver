import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  type JsonValue,
  type McpJsonRpcErrorResponse,
  type McpJsonRpcId,
  type McpJsonRpcMessage,
  type McpJsonRpcResponse,
  type McpJsonRpcSuccessResponse,
  type McpProviderError,
  type McpRuntimeContext,
  type McpRuntimeOptions,
  type McpRuntimeProvider,
  type McpServerCapabilities,
  type McpServerInfo,
} from "./types.js";

const DEFAULT_SERVER_INFO: McpServerInfo = {
  name: "mcp-runtime",
  version: "0.1.0",
};

export type McpJsonRpcAcceptedResult = {
  kind: "accepted";
};

export type McpJsonRpcMessageResult<TResult = unknown> =
  | {
      kind: "json";
      status: number;
      body: McpJsonRpcResponse<TResult>;
    }
  | McpJsonRpcAcceptedResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonData(data: Record<string, JsonValue> | undefined) {
  return data && Object.keys(data).length > 0 ? data : undefined;
}

function idFromMessage(message: unknown): McpJsonRpcId {
  if (!isRecord(message)) return null;
  return typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;
}

function hasValidJsonRpcId(message: Record<string, unknown>) {
  return !("id" in message) || typeof message.id === "string" || typeof message.id === "number" || message.id === null;
}

export function createMcpSuccessResponse<TResult>(
  id: McpJsonRpcId,
  result: TResult,
): McpJsonRpcSuccessResponse<TResult> {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

export function createMcpErrorResponse(
  id: McpJsonRpcId,
  code: number,
  message: string,
  data?: Record<string, JsonValue>,
): McpJsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(jsonData(data) ? { data: jsonData(data) } : {}),
    },
  };
}

export function createMcpInvalidRequestError(id: McpJsonRpcId = null, message = "Invalid Request") {
  return createMcpErrorResponse(id, -32600, message);
}

export function createMcpMethodNotFoundError(id: McpJsonRpcId, method?: string) {
  return createMcpErrorResponse(id, -32601, "Method not found", method ? { method } : undefined);
}

export function createMcpInvalidParamsError(
  id: McpJsonRpcId,
  message = "Invalid params",
  data?: Record<string, JsonValue>,
) {
  return createMcpErrorResponse(id, -32602, message, data);
}

export function createMcpProtocolError(id: McpJsonRpcId, message: string, data?: Record<string, JsonValue>) {
  return createMcpErrorResponse(id, -32000, message, { error: "protocol_error", ...(data ?? {}) });
}

export function createMcpNotFoundError(
  id: McpJsonRpcId,
  message = "Not found",
  data?: Record<string, JsonValue>,
) {
  return createMcpErrorResponse(id, -32002, message, data);
}

export function createMcpForbiddenError(
  id: McpJsonRpcId,
  message = "Forbidden",
  data?: Record<string, JsonValue>,
) {
  return createMcpErrorResponse(id, -32003, message, { error: "forbidden", ...(data ?? {}) });
}

export function createMcpErrorResponseFromProviderError(
  id: McpJsonRpcId,
  providerError: McpProviderError,
): McpJsonRpcErrorResponse {
  if (providerError.kind === "not_found") {
    return createMcpNotFoundError(id, providerError.message ?? "Not found", { error: "not_found" });
  }

  if (providerError.kind === "forbidden") {
    return createMcpForbiddenError(id, providerError.message, { message: providerError.message });
  }

  if (providerError.kind === "invalid_params") {
    return createMcpInvalidParamsError(id, providerError.message, providerError.data);
  }

  return createMcpProtocolError(id, providerError.message, providerError.data);
}

export function createMcpJsonResult<TResult>(
  id: McpJsonRpcId,
  result: TResult,
  status = 200,
): McpJsonRpcMessageResult<TResult> {
  return {
    kind: "json",
    status,
    body: createMcpSuccessResponse(id, result),
  };
}

export function createMcpJsonErrorResult(
  body: McpJsonRpcErrorResponse,
  status = 200,
): McpJsonRpcMessageResult<never> {
  return {
    kind: "json",
    status,
    body,
  };
}

export function deriveMcpCapabilities(provider: McpRuntimeProvider): McpServerCapabilities {
  return {
    ...(provider.tools ? { tools: { listChanged: false } } : {}),
    resources: {
      subscribe: Boolean(provider.subscriptions),
      listChanged: true,
    },
    ...(provider.prompts ? { prompts: { listChanged: true } } : {}),
    ...(provider.completion?.complete || provider.prompts?.complete ? { completions: {} } : {}),
  };
}

function isJsonRpcMessage(message: unknown): message is McpJsonRpcMessage {
  return isRecord(message) && message.jsonrpc === "2.0" && typeof message.method === "string";
}

function isRequest(message: McpJsonRpcMessage): message is McpJsonRpcMessage & { id: McpJsonRpcId } {
  return "id" in message;
}

function requestedProtocolVersion(params: unknown, options: McpRuntimeOptions) {
  const supportedProtocolVersions = options.supportedProtocolVersions ?? SUPPORTED_MCP_PROTOCOL_VERSIONS;
  const defaultProtocolVersion = options.defaultProtocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION;

  if (!isRecord(params) || typeof params.protocolVersion !== "string") {
    return defaultProtocolVersion;
  }

  return supportedProtocolVersions.includes(params.protocolVersion) ? params.protocolVersion : defaultProtocolVersion;
}

function validateInitializeParams(params: unknown) {
  return params === undefined || isRecord(params);
}

export async function handleMcpJsonRpcMessage(
  message: unknown,
  provider: McpRuntimeProvider,
  options: McpRuntimeOptions & { context?: McpRuntimeContext } = {},
): Promise<McpJsonRpcMessageResult> {
  if (Array.isArray(message)) {
    return createMcpJsonErrorResult(createMcpInvalidRequestError(null, "Batch requests are not supported"), 400);
  }

  if (!isJsonRpcMessage(message)) {
    return createMcpJsonErrorResult(createMcpInvalidRequestError(idFromMessage(message)), 400);
  }

  if (!hasValidJsonRpcId(message)) {
    return createMcpJsonErrorResult(createMcpInvalidRequestError(null), 400);
  }

  if (!isRequest(message)) {
    return { kind: "accepted" };
  }

  if (message.method === "initialize") {
    if (!validateInitializeParams(message.params)) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    return createMcpJsonResult(message.id, {
      protocolVersion: requestedProtocolVersion(message.params, options),
      capabilities: deriveMcpCapabilities(provider),
      serverInfo: provider.serverInfo ?? options.serverInfo ?? DEFAULT_SERVER_INFO,
    });
  }

  return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
}
