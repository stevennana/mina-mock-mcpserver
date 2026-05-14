import {
  createMcpErrorResponse,
  createMcpInvalidRequestError,
  handleMcpJsonRpcMessage,
  type McpJsonRpcMessageResult,
} from "./core.js";
import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  type McpRuntimeContext,
  type McpRuntimeOptions,
  type McpRuntimeProvider,
} from "./types.js";

export const MCP_PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";

export type McpFetchContextFactory = (request: Request) => McpRuntimeContext | Promise<McpRuntimeContext>;

export type McpFetchHandlerOptions = McpRuntimeOptions & {
  context?: McpRuntimeContext | McpFetchContextFactory;
};

export type McpFetchHandler = (request: Request) => Promise<Response>;

function isSupportedProtocolVersion(value: string) {
  return SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(value as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number]);
}

function responseProtocolVersion(request: Request, options: McpRuntimeOptions) {
  const requested = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
  return requested && isSupportedProtocolVersion(requested)
    ? requested
    : (options.defaultProtocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION);
}

function responseHeaders(request: Request, options: McpRuntimeOptions, headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set(MCP_PROTOCOL_VERSION_HEADER, responseProtocolVersion(request, options));
  return result;
}

function jsonResponse(request: Request, options: McpRuntimeOptions, body: unknown, status: number) {
  const headers = responseHeaders(request, options, {
    "content-type": "application/json; charset=utf-8",
  });
  return new Response(JSON.stringify(body), { status, headers });
}

function acceptedResponse(request: Request, options: McpRuntimeOptions) {
  return new Response(null, {
    status: 202,
    headers: responseHeaders(request, options),
  });
}

function rawResponse(request: Request, options: McpRuntimeOptions, result: Extract<McpJsonRpcMessageResult, { kind: "raw" }>) {
  const headers = responseHeaders(request, options, result.headers);
  if (result.contentType) {
    headers.set("content-type", result.contentType);
  }

  return new Response(result.body, {
    status: result.status,
    headers,
  });
}

async function resolveContext(
  request: Request,
  context: McpFetchHandlerOptions["context"],
): Promise<McpRuntimeContext | undefined> {
  if (!context) return undefined;
  if (typeof context === "function") return context(request);
  return context;
}

async function parseJsonBody(request: Request) {
  try {
    return { kind: "success" as const, body: await request.json() };
  } catch {
    return {
      kind: "error" as const,
      body: createMcpErrorResponse(null, -32700, "Parse error"),
    };
  }
}

export function createMcpFetchHandler(provider: McpRuntimeProvider, options: McpFetchHandlerOptions = {}): McpFetchHandler {
  const { context, ...runtimeOptions } = options;

  return async (request) => {
    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: responseHeaders(request, runtimeOptions, {
          allow: "POST",
        }),
      });
    }

    const protocolVersion = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
    if (protocolVersion && !isSupportedProtocolVersion(protocolVersion)) {
      return jsonResponse(
        request,
        runtimeOptions,
        createMcpInvalidRequestError(null, "Unsupported MCP protocol version."),
        400,
      );
    }

    const parsed = await parseJsonBody(request);
    if (parsed.kind === "error") {
      return jsonResponse(request, runtimeOptions, parsed.body, 400);
    }

    const requestContext = await resolveContext(request, context);
    const result = await handleMcpJsonRpcMessage(parsed.body, provider, {
      ...runtimeOptions,
      ...(requestContext ? { context: requestContext } : {}),
    });

    if (result.kind === "accepted") {
      return acceptedResponse(request, runtimeOptions);
    }
    if (result.kind === "raw") {
      return rawResponse(request, runtimeOptions, result);
    }

    return jsonResponse(request, runtimeOptions, result.body, result.status);
  };
}
