import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import { callEndpointByName, callPermittedEndpointByName, listEnabledMcpTools } from "@/lib/endpoints/service";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";
import { DEFAULT_MCP_PROTOCOL_VERSION, SUPPORTED_MCP_PROTOCOL_VERSIONS } from "@/lib/mcp/types";
import { oauthDiscoveryUrls } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export const dynamic = "force-dynamic";

const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Protocol-Version",
    "MCP-Session-Id",
  ].join(", "),
  "Access-Control-Expose-Headers": [
    "MCP-Protocol-Version",
    "MCP-Session-Id",
    "WWW-Authenticate",
    "X-MCP-Mock-Matched-Case",
    "X-MCP-Mock-Malformed-Mode",
  ].join(", "),
  "Access-Control-Max-Age": "86400",
};

function mcpResponseHeaders(headers: Record<string, string> = {}) {
  return {
    ...MCP_CORS_HEADERS,
    "MCP-Protocol-Version": DEFAULT_MCP_PROTOCOL_VERSION,
    ...headers,
  };
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

export function unsupportedStreamableHttpMethod() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "This MVP MCP endpoint supports JSON-RPC over HTTP POST only; SSE streams and session termination are not implemented.",
    },
    {
      status: 405,
      headers: mcpResponseHeaders({ Allow: "POST, OPTIONS" }),
    },
  );
}

export function handleMcpOptions() {
  return new Response(null, {
    status: 204,
    headers: mcpResponseHeaders(),
  });
}
