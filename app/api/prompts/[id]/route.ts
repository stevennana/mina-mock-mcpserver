import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpPromptInputFromBody } from "@/lib/mcp-fixtures/api";
import { deleteMcpPrompt, getMcpPrompt, updateMcpPrompt } from "@/lib/mcp-fixtures/service";
import { notifyLegacySsePromptListChanged } from "@/lib/mcp/sse-notifications";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const prompt = await getMcpPrompt(id);
    if (!prompt) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ prompt }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const previous = await getMcpPrompt(id);
    const prompt = await updateMcpPrompt(id, mcpPromptInputFromBody(await request.json()));
    if (previous?.enabled || prompt.enabled) {
      notifyLegacySsePromptListChanged(prompt.id);
    }
    return NextResponse.json({ prompt });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const prompt = await deleteMcpPrompt(id);
    if (prompt.enabled) {
      notifyLegacySsePromptListChanged(prompt.id);
    }
    return NextResponse.json({ prompt });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
