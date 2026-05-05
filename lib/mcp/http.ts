import { NextResponse } from "next/server";
import { listEnabledMcpTools } from "@/lib/endpoints/service";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";

export const dynamic = "force-dynamic";

export async function handleNoAuthMcpPost(request: Request) {
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

  const result = await handleMcpJsonRpcMessage(body, listEnabledMcpTools);
  if (result.kind === "accepted") {
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(result.body, { status: result.status });
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
