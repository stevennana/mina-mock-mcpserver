import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpResourceTemplateInputFromBody } from "@/lib/mcp-fixtures/api";
import { deleteMcpResourceTemplate, getMcpResourceTemplate, updateMcpResourceTemplate } from "@/lib/mcp-fixtures/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const template = await getMcpResourceTemplate(id);
    if (!template) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ template }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const template = await updateMcpResourceTemplate(id, mcpResourceTemplateInputFromBody(await request.json()));
    return NextResponse.json({ template });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const template = await deleteMcpResourceTemplate(id);
    return NextResponse.json({ template });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
