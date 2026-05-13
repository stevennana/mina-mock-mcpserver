import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpResourceTemplateInputFromBody } from "@/lib/mcp-fixtures/api";
import { deleteMcpResourceTemplate, getMcpResourceTemplate, updateMcpResourceTemplate } from "@/lib/mcp-fixtures/service";
import { notifyLegacySseResourceListChanged } from "@/lib/mcp/sse-notifications";

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
    const previous = await getMcpResourceTemplate(id);
    const template = await updateMcpResourceTemplate(id, mcpResourceTemplateInputFromBody(await request.json()));
    if (previous?.enabled || template.enabled) {
      notifyLegacySseResourceListChanged();
    }
    return NextResponse.json({ template });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const template = await deleteMcpResourceTemplate(id);
    if (template.enabled) {
      notifyLegacySseResourceListChanged();
    }
    return NextResponse.json({ template });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
