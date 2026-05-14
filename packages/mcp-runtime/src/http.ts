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

export type McpCorsOptions = {
  allowedOrigins?: readonly string[] | "*";
  allowedMethods?: readonly string[];
  allowedHeaders?: readonly string[];
  exposedHeaders?: readonly string[];
  maxAgeSeconds?: number;
  allowCredentials?: boolean;
};

export type McpFetchHandlerOptions = McpRuntimeOptions & {
  context?: McpRuntimeContext | McpFetchContextFactory;
  cors?: McpCorsOptions;
};

export type McpFetchHandler = (request: Request) => Promise<Response>;

const DEFAULT_CORS_ALLOWED_METHODS = ["POST", "OPTIONS"] as const;
const DEFAULT_CORS_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "MCP-Protocol-Version",
  "MCP-Session-Id",
  "Last-Event-ID",
] as const;
const DEFAULT_CORS_EXPOSED_HEADERS = ["MCP-Protocol-Version"] as const;

function supportedProtocolVersions(options: McpRuntimeOptions) {
  return options.supportedProtocolVersions ?? SUPPORTED_MCP_PROTOCOL_VERSIONS;
}

function isSupportedProtocolVersion(value: string, options: McpRuntimeOptions) {
  return supportedProtocolVersions(options).includes(value);
}

function responseProtocolVersion(request: Request, options: McpRuntimeOptions) {
  const requested = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
  return requested && isSupportedProtocolVersion(requested, options)
    ? requested
    : (options.defaultProtocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION);
}

function corsHeaderValues(options: McpCorsOptions, request?: Request): Record<string, string> {
  const allowedOrigin = allowedCorsOrigin(options, request);
  if (!allowedOrigin) return {};

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": (options.allowedMethods ?? DEFAULT_CORS_ALLOWED_METHODS).join(", "),
    "Access-Control-Allow-Headers": (options.allowedHeaders ?? DEFAULT_CORS_ALLOWED_HEADERS).join(", "),
    "Access-Control-Expose-Headers": (options.exposedHeaders ?? DEFAULT_CORS_EXPOSED_HEADERS).join(", "),
    ...(options.maxAgeSeconds !== undefined ? { "Access-Control-Max-Age": String(options.maxAgeSeconds) } : {}),
    ...(options.allowCredentials ? { "Access-Control-Allow-Credentials": "true" } : {}),
  };
}

function allowedCorsOrigin(options: McpCorsOptions, request?: Request): string | null {
  const allowedOrigins = options.allowedOrigins ?? [];
  const requestOrigin = request?.headers.get("origin") ?? null;

  if (allowedOrigins === "*") {
    if (options.allowCredentials && requestOrigin) return requestOrigin;
    return "*";
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
  if (!requestOrigin && allowedOrigins.length === 1) return allowedOrigins[0] ?? null;
  return null;
}

export function createMcpCorsHeaders(options: McpCorsOptions, request?: Request): Headers {
  return new Headers(corsHeaderValues(options, request));
}

export function createMcpOptionsResponse(options: McpCorsOptions, request?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: createMcpCorsHeaders(options, request),
  });
}

function responseHeaders(
  request: Request,
  options: McpRuntimeOptions,
  headers?: HeadersInit,
  cors?: McpCorsOptions,
) {
  const result = new Headers(headers);
  result.set(MCP_PROTOCOL_VERSION_HEADER, responseProtocolVersion(request, options));
  if (cors) {
    createMcpCorsHeaders(cors, request).forEach((value, key) => result.set(key, value));
  }
  return result;
}

function jsonResponse(request: Request, options: McpRuntimeOptions, body: unknown, status: number, cors?: McpCorsOptions) {
  const headers = responseHeaders(request, options, {
    "content-type": "application/json; charset=utf-8",
  }, cors);
  return new Response(JSON.stringify(body), { status, headers });
}

function acceptedResponse(request: Request, options: McpRuntimeOptions, cors?: McpCorsOptions) {
  return new Response(null, {
    status: 202,
    headers: responseHeaders(request, options, undefined, cors),
  });
}

function rawResponse(
  request: Request,
  options: McpRuntimeOptions,
  result: Extract<McpJsonRpcMessageResult, { kind: "raw" }>,
  cors?: McpCorsOptions,
) {
  const headers = responseHeaders(request, options, result.headers, cors);
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
  const { context, cors, ...runtimeOptions } = options;

  return async (request) => {
    if (request.method === "OPTIONS" && cors) {
      return createMcpOptionsResponse(cors, request);
    }

    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: responseHeaders(request, runtimeOptions, {
          allow: "POST",
        }, cors),
      });
    }

    const protocolVersion = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
    if (protocolVersion && !isSupportedProtocolVersion(protocolVersion, runtimeOptions)) {
      return jsonResponse(
        request,
        runtimeOptions,
        createMcpInvalidRequestError(null, "Unsupported MCP protocol version."),
        400,
        cors,
      );
    }

    const parsed = await parseJsonBody(request);
    if (parsed.kind === "error") {
      return jsonResponse(request, runtimeOptions, parsed.body, 400, cors);
    }

    const requestContext = await resolveContext(request, context);
    const result = await handleMcpJsonRpcMessage(parsed.body, provider, {
      ...runtimeOptions,
      ...(requestContext ? { context: requestContext } : {}),
    });

    if (result.kind === "accepted") {
      return acceptedResponse(request, runtimeOptions, cors);
    }
    if (result.kind === "raw") {
      return rawResponse(request, runtimeOptions, result, cors);
    }

    return jsonResponse(request, runtimeOptions, result.body, result.status, cors);
  };
}
