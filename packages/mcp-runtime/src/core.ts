import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  type JsonValue,
  type McpJsonRpcErrorResponse,
  type McpJsonRpcId,
  type McpJsonRpcMessage,
  type McpJsonRpcResponse,
  type McpJsonRpcSuccessResponse,
  type McpListInput,
  type McpCompletionInput,
  type McpOffsetPaginationInput,
  type McpOffsetPaginationResult,
  type McpPromptGetInput,
  type McpProviderError,
  type McpResourceReadInput,
  type McpSubscribeResult,
  type McpRuntimeContext,
  type McpRuntimeOptions,
  type McpRuntimeProvider,
  type McpServerCapabilities,
  type McpServerInfo,
  type McpToolCallInput,
} from "./types.js";

const DEFAULT_SERVER_INFO: McpServerInfo = {
  name: "mcp-runtime",
  version: "0.1.0",
};

export type McpJsonRpcAcceptedResult = {
  kind: "accepted";
};

export type McpRawToolCallMessageResult = {
  kind: "raw";
  status: number;
  body: string;
  contentType?: string | null;
  headers?: Record<string, string>;
};

export type McpJsonRpcMessageResult<TResult = unknown> =
  | {
      kind: "json";
      status: number;
      body: McpJsonRpcResponse<TResult>;
    }
  | McpJsonRpcAcceptedResult
  | McpRawToolCallMessageResult;

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
    ...(provider.tools?.list ? { tools: { listChanged: false } } : {}),
    ...(provider.resources
      ? {
          resources: {
            subscribe: Boolean(provider.subscriptions),
            listChanged: true,
          },
        }
      : {}),
    ...(provider.prompts?.list ? { prompts: { listChanged: true } } : {}),
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

function parseListParams(params: unknown, options: McpRuntimeOptions, context: McpRuntimeContext): McpListInput | null {
  if (params === undefined) {
    return {
      ...(options.pageSize !== undefined ? { limit: options.pageSize } : {}),
      context,
    };
  }

  if (!isRecord(params)) return null;

  const input: McpListInput = { context };
  if ("cursor" in params) {
    if (typeof params.cursor !== "string") return null;
    input.cursor = params.cursor;
  }
  if ("limit" in params) {
    if (!Number.isInteger(params.limit) || (params.limit as number) < 1) return null;
    input.limit = params.limit as number;
  } else if (options.pageSize !== undefined) {
    input.limit = options.pageSize;
  }

  return input;
}

function parseResourceReadParams(params: unknown, context: McpRuntimeContext): McpResourceReadInput | null {
  if (!isRecord(params) || typeof params.uri !== "string" || params.uri.length === 0) return null;
  return { uri: params.uri, context };
}

function parseArguments(value: unknown): Record<string, JsonValue> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  return value as Record<string, JsonValue>;
}

function parseToolCallParams(params: unknown, context: McpRuntimeContext): McpToolCallInput | null {
  if (!isRecord(params) || typeof params.name !== "string" || params.name.length === 0) return null;

  const parsedArguments = parseArguments(params.arguments);
  if (!parsedArguments) return null;

  return {
    name: params.name,
    ...(params.arguments !== undefined ? { arguments: parsedArguments } : {}),
    context,
  };
}

function parsePromptGetParams(params: unknown, context: McpRuntimeContext): McpPromptGetInput | null {
  if (!isRecord(params) || typeof params.name !== "string" || params.name.length === 0) return null;

  const parsedArguments = parseArguments(params.arguments);
  if (!parsedArguments) return null;

  return {
    name: params.name,
    ...(params.arguments !== undefined ? { arguments: parsedArguments } : {}),
    context,
  };
}

function parseCompletionParams(params: unknown, context: McpRuntimeContext): McpCompletionInput | null {
  if (!isRecord(params) || !isRecord(params.ref) || !isRecord(params.argument)) return null;
  if (typeof params.argument.name !== "string" || params.argument.name.length === 0) return null;
  if ("value" in params.argument && typeof params.argument.value !== "string") return null;

  const value = typeof params.argument.value === "string" ? params.argument.value : undefined;
  const argument: McpCompletionInput["argument"] = {
    name: params.argument.name,
    ...(value !== undefined ? { value } : {}),
  };

  if (params.ref.type === "ref/prompt" && typeof params.ref.name === "string" && params.ref.name.length > 0) {
    return {
      ref: { type: "ref/prompt", name: params.ref.name },
      argument,
      context,
    };
  }

  if (params.ref.type === "ref/resource" && typeof params.ref.uri === "string" && params.ref.uri.length > 0) {
    return {
      ref: { type: "ref/resource", uri: params.ref.uri },
      argument,
      context,
    };
  }

  return null;
}

function isProviderError(result: { kind: string }): result is McpProviderError {
  return result.kind !== "success";
}

function isSubscribeProviderError(result: McpSubscribeResult): result is McpProviderError {
  return result.kind !== "success";
}

function listResult<TItem>(id: McpJsonRpcId, key: string, items: TItem[], nextCursor?: string) {
  return createMcpJsonResult(id, {
    [key]: items,
    ...(nextCursor ? { nextCursor } : {}),
  });
}

export function createMcpOffsetCursor(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset cursor must be a non-negative integer.");
  }

  return String(offset);
}

export function parseMcpOffsetCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  if (!/^(0|[1-9]\d*)$/.test(cursor)) {
    throw new Error("Offset cursor must be a non-negative integer string.");
  }

  return Number.parseInt(cursor, 10);
}

export function paginateMcpItemsByOffset<TItem>({
  items,
  cursor,
  limit = 50,
}: McpOffsetPaginationInput<TItem>): McpOffsetPaginationResult<TItem> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Offset pagination limit must be a positive integer.");
  }

  const offset = parseMcpOffsetCursor(cursor);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;

  return {
    items: page,
    ...(nextOffset < items.length ? { nextCursor: createMcpOffsetCursor(nextOffset) } : {}),
    offset,
    limit,
  };
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

  const context = options.context ?? {};

  if (message.method === "tools/list") {
    if (!provider.tools?.list) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseListParams(message.params, options, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.tools.list(input);
    return listResult(message.id, "tools", result.items, result.nextCursor);
  }

  if (message.method === "tools/call") {
    if (!provider.tools?.call) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseToolCallParams(message.params, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.tools.call(input);
    if (result.kind === "success") {
      return createMcpJsonResult(message.id, {
        content: result.content,
        ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
      });
    }
    if (result.kind === "tool_error") {
      return createMcpJsonResult(message.id, {
        content: result.content,
        ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
        isError: true,
      });
    }
    if (result.kind === "raw") {
      return {
        kind: "raw",
        status: result.status,
        body: result.body,
        ...(result.contentType !== undefined ? { contentType: result.contentType } : {}),
        ...(result.headers ? { headers: result.headers } : {}),
      };
    }

    return createMcpJsonErrorResult(createMcpErrorResponseFromProviderError(message.id, result));
  }

  if (message.method === "resources/list") {
    if (!provider.resources?.list) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseListParams(message.params, options, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.resources.list(input);
    return listResult(message.id, "resources", result.items, result.nextCursor);
  }

  if (message.method === "resources/templates/list") {
    if (!provider.resources?.templates?.list) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseListParams(message.params, options, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.resources.templates.list(input);
    return listResult(message.id, "resourceTemplates", result.items, result.nextCursor);
  }

  if (message.method === "resources/read") {
    if (!provider.resources?.read) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseResourceReadParams(message.params, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.resources.read(input);
    if (result.kind !== "success") {
      return createMcpJsonErrorResult(createMcpErrorResponseFromProviderError(message.id, result));
    }

    return createMcpJsonResult(message.id, { contents: result.contents });
  }

  if (message.method === "resources/subscribe" || message.method === "resources/unsubscribe") {
    if (!provider.subscriptions) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseResourceReadParams(message.params, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const handler =
      message.method === "resources/subscribe" ? provider.subscriptions.subscribe : provider.subscriptions.unsubscribe;
    const result = await handler(input);
    if (isSubscribeProviderError(result)) {
      return createMcpJsonErrorResult(createMcpErrorResponseFromProviderError(message.id, result));
    }

    return createMcpJsonResult(message.id, {});
  }

  if (message.method === "prompts/list") {
    if (!provider.prompts?.list) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseListParams(message.params, options, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.prompts.list(input);
    return listResult(message.id, "prompts", result.items, result.nextCursor);
  }

  if (message.method === "prompts/get") {
    if (!provider.prompts?.get) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parsePromptGetParams(message.params, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await provider.prompts.get(input);
    if (isProviderError(result)) {
      return createMcpJsonErrorResult(createMcpErrorResponseFromProviderError(message.id, result));
    }

    return createMcpJsonResult(message.id, {
      ...(result.description ? { description: result.description } : {}),
      messages: result.messages,
    });
  }

  if (message.method === "completion/complete") {
    const handler = provider.completion?.complete ?? provider.prompts?.complete;
    if (!handler) {
      return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
    }

    const input = parseCompletionParams(message.params, context);
    if (!input) {
      return createMcpJsonErrorResult(createMcpInvalidParamsError(message.id));
    }

    const result = await handler(input);
    if (isProviderError(result)) {
      return createMcpJsonErrorResult(createMcpErrorResponseFromProviderError(message.id, result));
    }

    return createMcpJsonResult(message.id, {
      completion: {
        values: result.values,
        ...(result.total !== undefined ? { total: result.total } : {}),
        ...(result.hasMore !== undefined ? { hasMore: result.hasMore } : {}),
      },
    });
  }

  return createMcpJsonErrorResult(createMcpMethodNotFoundError(message.id, message.method));
}
