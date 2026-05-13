import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpResourceInputFromBody } from "@/lib/mcp-fixtures/api";
import { deleteMcpResource, getMcpResource, updateMcpResource } from "@/lib/mcp-fixtures/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const resource = await getMcpResource(id);
    if (!resource) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ resource }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const resource = await updateMcpResource(id, mcpResourceInputFromBody(await request.json()));
    return NextResponse.json({ resource });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const resource = await deleteMcpResource(id);
    return NextResponse.json({ resource });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
