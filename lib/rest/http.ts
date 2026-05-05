import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import {
  callEndpointByName,
  callPermittedEndpointByName,
  listEnabledRestTools,
  resolvePermittedEndpointByName,
} from "@/lib/endpoints/service";
import { restToolCallResponseFromEndpointCall } from "@/lib/rest/tools";
import type { RestToolCallResponse } from "@/lib/rest/tools";

export const dynamic = "force-dynamic";

function unauthorizedRestResponse(message = "Authorization header was invalid.") {
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

function unauthorizedBearerRestResponse(message = "Authorization header was invalid.") {
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

export async function handleRestToolsGet(request: Request) {
  const bearer = parseBearerAuthorizationHeader(request.headers.get("Authorization"));
  if (bearer.kind === "bearer" || bearer.kind === "invalid") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
    if (resolution.kind !== "authenticated") {
      return unauthorizedBearerRestResponse();
    }
    return NextResponse.json(await listEnabledRestTools(undefined, { endpointIds: resolution.principal.endpointIds }));
  }

  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind === "unauthorized") {
    return unauthorizedRestResponse();
  }

  return NextResponse.json(await listEnabledRestTools());
}

function principalForResolution(resolution: Awaited<ReturnType<typeof resolveBasicAuthorizationHeader>>) {
  return resolution.kind === "authenticated" ? `basic:${resolution.principal.username}` : "anonymous";
}

function bearerPrincipal(clientId: string) {
  return `oauth:${clientId}`;
}

function argumentsFromBody(body: unknown) {
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "arguments" in body) {
    return (body as { arguments?: unknown }).arguments ?? {};
  }
  return body;
}

function restToolCallHttpResponse(response: RestToolCallResponse, principal: string) {
  const headers = {
    "X-MCP-Mock-Principal": principal,
    ...(response.matchedCase ? { "X-MCP-Mock-Matched-Case": response.matchedCase } : {}),
  };
  if (response.malformed) {
    return new Response(typeof response.body === "string" ? response.body : JSON.stringify(response.body), {
      status: response.status,
      headers: {
        ...headers,
        "X-MCP-Mock-Malformed-Mode": response.malformed.mode,
        ...(response.malformed.contentType ? { "content-type": response.malformed.contentType } : {}),
      },
    });
  }

  return NextResponse.json(response.body, {
    status: response.status,
    headers,
  });
}

export async function handleRestToolCallPost(request: Request, name: string) {
  const bearer = parseBearerAuthorizationHeader(request.headers.get("Authorization"));
  if (bearer.kind === "bearer" || bearer.kind === "invalid") {
    const resolution = await resolveOAuthBearerAuthorizationHeader(request.headers.get("Authorization"), request);
    if (resolution.kind !== "authenticated") {
      return unauthorizedBearerRestResponse();
    }

    const permission = await resolvePermittedEndpointByName(name, resolution.principal.endpointIds);
    if (permission.kind === "forbidden") {
      return NextResponse.json(
        {
          error: "forbidden",
          message: permission.message,
          tool: name,
        },
        {
          status: 403,
          headers: { "X-MCP-Mock-Principal": bearerPrincipal(resolution.principal.clientId) },
        },
      );
    }
    if (permission.kind === "not_found" || permission.kind === "disabled") {
      const response = restToolCallResponseFromEndpointCall(permission);
      return NextResponse.json(response.body, {
        status: response.status,
        headers: { "X-MCP-Mock-Principal": bearerPrincipal(resolution.principal.clientId) },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "invalid_json",
          message: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    const authorizedCallResult = await callPermittedEndpointByName(
      name,
      argumentsFromBody(body),
      resolution.principal.endpointIds,
    );
    const response = restToolCallResponseFromEndpointCall(authorizedCallResult);
    return restToolCallHttpResponse(response, bearerPrincipal(resolution.principal.clientId));
  }

  const authorization = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (authorization.kind === "unauthorized") {
    return unauthorizedRestResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const callResult = await callEndpointByName(name, argumentsFromBody(body));
  const response = restToolCallResponseFromEndpointCall(callResult);
  return restToolCallHttpResponse(response, principalForResolution(authorization));
}

export function unsupportedRestToolsMethod() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "This REST endpoint supports tool metadata listing with GET and tool calls with POST only.",
    },
    {
      status: 405,
      headers: { Allow: "GET, POST" },
    },
  );
}
