import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpResourceTemplateInputFromBody } from "@/lib/mcp-fixtures/api";
import { createMcpResourceTemplate, listMcpResourceTemplates } from "@/lib/mcp-fixtures/service";

export async function GET() {
  try {
    return NextResponse.json(await listMcpResourceTemplates(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const template = await createMcpResourceTemplate(mcpResourceTemplateInputFromBody(await request.json()));
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
