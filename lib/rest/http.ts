import { NextResponse } from "next/server";
import { resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { listEnabledRestTools } from "@/lib/endpoints/service";

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

export function unsupportedRestToolsMethod() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "This REST endpoint supports tool metadata listing with GET only.",
    },
    {
      status: 405,
      headers: { Allow: "GET" },
    },
  );
}
