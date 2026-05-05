import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import { callEndpointByName, callPermittedEndpointByName, listEnabledMcpTools } from "@/lib/endpoints/service";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";

export const dynamic = "force-dynamic";

function unauthorizedBasicResponse(message = "Valid Basic credentials are required.") {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="MCP Mock Server"',
      },
    },
  );
}

function unauthorizedBearerResponse(message = "Valid Bearer token is required.") {
  return NextResponse.json(
    {
      error: "unauthorized",
      message,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="MCP Mock Server"',
      },
    },
  );
}

async function handleMcpJsonRpcPost(
  request: Request,
  runtime: {
    endpointIds?: string[];
  } = {},
) {
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
      { status: 400 },
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
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(result.body, { status: result.status });
}

export async function handleNoAuthMcpPost(request: Request) {
  return handleMcpJsonRpcPost(request);
}

export async function handleUnifiedMcpPost(request: Request) {
  const authorization = request.headers.get("Authorization");
  const bearer = parseBearerAuthorizationHeader(authorization);
  if (bearer.kind === "bearer" || bearer.kind === "invalid") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(authorization, request.url);
    if (resolution.kind !== "authenticated") {
      return unauthorizedBearerResponse("Authorization header was invalid.");
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
  const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request.url);
  if (resolution.kind !== "authenticated") {
    return unauthorizedBearerResponse();
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
      headers: { Allow: "POST" },
    },
  );
}
