import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpResourceInputFromBody } from "@/lib/mcp-fixtures/api";
import { createMcpResource, listMcpResources } from "@/lib/mcp-fixtures/service";

export async function GET() {
  try {
    return NextResponse.json(await listMcpResources(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const resource = await createMcpResource(mcpResourceInputFromBody(await request.json()));
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
