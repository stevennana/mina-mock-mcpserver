import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { callEndpointByName, listEnabledRestTools } from "@/lib/endpoints/service";
import { restToolCallResponseFromEndpointCall } from "@/lib/rest/tools";

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

export async function handleRestToolsGet(request: Request) {
  const resolution = await resolveBasicAuthorizationHeader(request.headers.get("Authorization"));
  if (resolution.kind === "unauthorized") {
    return unauthorizedRestResponse();
  }

  return NextResponse.json(await listEnabledRestTools());
}

function principalForResolution(resolution: Awaited<ReturnType<typeof resolveBasicAuthorizationHeader>>) {
  return resolution.kind === "authenticated" ? `basic:${resolution.principal.username}` : "anonymous";
}

function argumentsFromBody(body: unknown) {
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "arguments" in body) {
    return (body as { arguments?: unknown }).arguments ?? {};
  }
  return body;
}

export async function handleRestToolCallPost(request: Request, name: string) {
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
  const headers = {
    "X-MCP-Mock-Principal": principalForResolution(authorization),
    ...(response.matchedCase ? { "X-MCP-Mock-Matched-Case": response.matchedCase } : {}),
  };

  return NextResponse.json(response.body, {
    status: response.status,
    headers,
  });
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
