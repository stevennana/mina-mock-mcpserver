import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import { callEndpointByName, callPermittedEndpointByName, listEnabledMcpTools } from "@/lib/endpoints/service";
import { publicCorsHeaders } from "@/lib/http/cors";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";
import { DEFAULT_MCP_PROTOCOL_VERSION, SUPPORTED_MCP_PROTOCOL_VERSIONS } from "@/lib/mcp/types";
import { oauthDiscoveryUrls } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export const dynamic = "force-dynamic";

function mcpResponseHeaders(headers: Record<string, string> = {}) {
  return publicCorsHeaders({
    "MCP-Protocol-Version": DEFAULT_MCP_PROTOCOL_VERSION,
    ...headers,
  });
}

function isSupportedMcpProtocolVersion(value: string) {
  return SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(value as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number]);
}

async function validateMcpHttpRequest(request: Request) {
  const protocolVersion = request.headers.get("MCP-Protocol-Version");
  if (protocolVersion && !isSupportedMcpProtocolVersion(protocolVersion)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Unsupported MCP protocol version." },
      },
      { status: 400, headers: mcpResponseHeaders() },
    );
  }

  return null;
}

function unauthorizedBasicResponse(message = "Valid Basic credentials are required.") {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: mcpResponseHeaders({
        "WWW-Authenticate": 'Basic realm="MCP Mock Server"',
      }),
    },
  );
}

async function bearerChallenge(request: Request, error?: string) {
  const { baseUrl } = await resolveBaseUrl(request);
  const challenge = [
    'Bearer realm="MCP Mock Server"',
    `resource_metadata="${oauthDiscoveryUrls(baseUrl).protectedResourceMetadata}"`,
  ];
  if (error) {
    challenge.push(`error="${error}"`);
  }
  return challenge.join(", ");
}

async function unauthorizedBearerResponse(request: Request, message = "Valid Bearer token is required.", error?: string) {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: mcpResponseHeaders({
        "WWW-Authenticate": await bearerChallenge(request, error),
      }),
    },
  );
}

async function handleMcpJsonRpcPost(
  request: Request,
  runtime: {
    endpointIds?: string[];
  } = {},
) {
  const invalidHttpRequest = await validateMcpHttpRequest(request);
  if (invalidHttpRequest) {
    return invalidHttpRequest;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400, headers: mcpResponseHeaders() },
    );
  }

  const result = await handleMcpJsonRpcMessage(
    body,
    () => listEnabledMcpTools(undefined, runtime.endpointIds ? { endpointIds: runtime.endpointIds } : undefined),
    runtime.endpointIds
      ? (name, rawArguments) => callPermittedEndpointByName(name, rawArguments, runtime.endpointIds ?? [])
      : callEndpointByName,
  );
  if (result.kind === "accepted") {
    return new Response(null, { status: 202, headers: mcpResponseHeaders() });
  }
  if (result.kind === "raw") {
    return new Response(result.body, {
      status: result.status,
      headers: mcpResponseHeaders({
        ...(result.contentType ? { "content-type": result.contentType } : {}),
        ...(result.matchedCase ? { "X-MCP-Mock-Matched-Case": result.matchedCase } : {}),
      }),
    });
  }

  return NextResponse.json(result.body, { status: result.status, headers: mcpResponseHeaders() });
}

export async function handleNoAuthMcpPost(request: Request) {
  return handleMcpJsonRpcPost(request);
}

export async function handleUnifiedMcpPost(request: Request) {
  const authorization = request.headers.get("Authorization");
  const bearer = parseBearerAuthorizationHeader(authorization);
  if (bearer.kind === "bearer" || bearer.kind === "invalid") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(authorization, request);
    if (resolution.kind !== "authenticated") {
      return unauthorizedBearerResponse(request, "Authorization header was invalid.", "invalid_token");
    }
    return handleMcpJsonRpcPost(request, { endpointIds: resolution.principal.endpointIds });
  }

  const resolution = await resolveBasicAuthorizationHeader(authorization);

  if (resolution.kind === "unauthorized") {
    return unauthorizedBasicResponse("Authorization header was invalid.");
  }
  if (resolution.kind === "authenticated" || resolution.kind === "missing") {
    return handleMcpJsonRpcPost(request);
  }

  return unauthorizedBasicResponse();
}

export async function handleStrictOAuthMcpPost(request: Request) {
  const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
  if (resolution.kind !== "authenticated") {
    return unauthorizedBearerResponse(request);
  }

  return handleMcpJsonRpcPost(request, { endpointIds: resolution.principal.endpointIds });
}

export async function handleStrictBasicMcpPost(request: Request) {
  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind !== "authenticated") {
    return unauthorizedBasicResponse();
  }

  return handleMcpJsonRpcPost(request);
}

type LegacySseMode = "none" | "basic" | "oauth" | "unified";

type LegacySseSession = {
  mode: LegacySseMode;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  runtime: { endpointIds?: string[] };
  heartbeat: ReturnType<typeof setInterval>;
};

const legacySseGlobal = globalThis as typeof globalThis & {
  __mcpMockLegacySseSessions?: Map<string, LegacySseSession>;
};
const legacySseSessions = legacySseGlobal.__mcpMockLegacySseSessions ?? new Map<string, LegacySseSession>();
legacySseGlobal.__mcpMockLegacySseSessions = legacySseSessions;

function sseEvent(event: string, data: unknown, id?: string) {
  const serialized = typeof data === "string" ? data : JSON.stringify(data);
  const dataLines = serialized.split(/\r?\n/).map((line) => `data: ${line}`);
  const lines = [...(id ? [`id: ${id}`] : []), `event: ${event}`, ...dataLines, "", ""];
  return lines.join("\n");
}

function sseComment(message: string) {
  return `: ${message}\n\n`;
}

function enqueueSse(session: LegacySseSession, payload: string) {
  try {
    session.controller.enqueue(session.encoder.encode(payload));
    return true;
  } catch {
    clearInterval(session.heartbeat);
    return false;
  }
}

function cleanupLegacySseSession(sessionId: string) {
  const session = legacySseSessions.get(sessionId);
  if (!session) return;
  clearInterval(session.heartbeat);
  legacySseSessions.delete(sessionId);
}

function sseStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    status: 200,
    headers: mcpResponseHeaders({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    }),
  });
}

function createMcpSseStream(label: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseComment(`${label} stream opened`)));
      controller.enqueue(encoder.encode(sseEvent("message", {
        jsonrpc: "2.0",
        method: "notifications/message",
        params: {
          level: "info",
          logger: "mcp-mock-server",
          data: `${label} SSE stream is open. This mock server sends request results on POST responses.`,
        },
      }, `${Date.now()}-open`)));
      controller.close();
    },
    cancel() {},
  });
}

export function handleNoAuthMcpGet() {
  return sseStreamResponse(createMcpSseStream("no-auth MCP"));
}

export function handleUnifiedMcpGet() {
  return sseStreamResponse(createMcpSseStream("unified MCP"));
}

export async function handleStrictBasicMcpGet(request: Request) {
  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind !== "authenticated") {
    return unauthorizedBasicResponse();
  }

  return sseStreamResponse(createMcpSseStream("Basic MCP"));
}

export async function handleStrictOAuthMcpGet(request: Request) {
  const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
  if (resolution.kind !== "authenticated") {
    return unauthorizedBearerResponse(request);
  }

  return sseStreamResponse(createMcpSseStream("OAuth MCP"));
}

function legacyMessagePath(request: Request, mode: LegacySseMode, sessionId: string) {
  const url = new URL(request.url);
  const path = mode === "unified" ? "/sse/message" : `/sse/${mode}/message`;
  url.pathname = path;
  url.search = new URLSearchParams({ sessionId }).toString();
  return `${url.pathname}${url.search}`;
}

async function legacyRuntimeForRequest(mode: LegacySseMode, request: Request) {
  if (mode === "basic") {
    const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
    if (resolution.kind !== "authenticated") return { response: unauthorizedBasicResponse() };
    return { runtime: {} };
  }

  if (mode === "oauth") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
    if (resolution.kind !== "authenticated") return { response: await unauthorizedBearerResponse(request) };
    return { runtime: { endpointIds: resolution.principal.endpointIds } };
  }

  if (mode === "unified") {
    const authorization = request.headers.get("Authorization");
    const bearer = parseBearerAuthorizationHeader(authorization);
    if (bearer.kind === "bearer" || bearer.kind === "invalid") {
      const resolution = await resolveOAuthBearerAuthorizationHeader(authorization, request);
      if (resolution.kind !== "authenticated") {
        return { response: await unauthorizedBearerResponse(request, "Authorization header was invalid.", "invalid_token") };
      }
      return { runtime: { endpointIds: resolution.principal.endpointIds } };
    }

    const resolution = await resolveBasicAuthorizationHeader(authorization);
    if (resolution.kind === "unauthorized") {
      return { response: unauthorizedBasicResponse("Authorization header was invalid.") };
    }
  }

  return { runtime: {} };
}

export function handleLegacySseGet(mode: LegacySseMode = "unified") {
  return async (request: Request) => {
    const runtime = await legacyRuntimeForRequest(mode, request);
    if ("response" in runtime) {
      return runtime.response;
    }

    const encoder = new TextEncoder();
    const sessionId = crypto.randomUUID();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const heartbeat = setInterval(() => {
          const session = legacySseSessions.get(sessionId);
          if (session) enqueueSse(session, sseComment("legacy SSE heartbeat"));
        }, 15_000);
        legacySseSessions.set(sessionId, {
          mode,
          controller,
          encoder,
          runtime: runtime.runtime,
          heartbeat,
        });
        controller.enqueue(encoder.encode(sseEvent("endpoint", legacyMessagePath(request, mode, sessionId))));
        controller.enqueue(encoder.encode(sseComment("legacy SSE compatibility stream")));
        request.signal.addEventListener("abort", () => cleanupLegacySseSession(sessionId), { once: true });
      },
      cancel() {
        cleanupLegacySseSession(sessionId);
      },
    });
    return sseStreamResponse(stream);
  };
}

export function handleLegacySseMessagePost(mode: LegacySseMode = "unified") {
  return async (request: Request) => {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const session = legacySseSessions.get(sessionId);
    if (!session || session.mode !== mode) {
      return NextResponse.json(
        { error: "sse_session_not_found", message: "Open the matching SSE endpoint before posting MCP messages." },
        { status: 404, headers: mcpResponseHeaders() },
      );
    }

    const response = await handleMcpJsonRpcPost(request, session.runtime);
    if (response.status !== 202) {
      enqueueSse(session, sseEvent("message", await response.text(), `${Date.now()}-${sessionId}`));
    }

    return new Response(null, { status: 202, headers: mcpResponseHeaders() });
  };
}

export function handleLegacySseDelete(mode: LegacySseMode = "unified") {
  return (request: Request) => {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const session = legacySseSessions.get(sessionId);
    if (session && session.mode === mode) {
      cleanupLegacySseSession(sessionId);
      try {
        session.controller.close();
      } catch {
        return new Response(null, { status: 204, headers: mcpResponseHeaders() });
      }
    }
    return new Response(null, { status: 204, headers: mcpResponseHeaders() });
  };
}

export function unsupportedStreamableHttpMethod() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "This MCP endpoint supports JSON-RPC POST plus lightweight SSE GET. Session termination is not implemented on Streamable HTTP routes.",
    },
    {
      status: 405,
      headers: mcpResponseHeaders({ Allow: "GET, POST, OPTIONS" }),
    },
  );
}

export function handleMcpOptions() {
  return new Response(null, {
    status: 204,
    headers: mcpResponseHeaders(),
  });
}
