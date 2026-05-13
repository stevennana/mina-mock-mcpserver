import { NextResponse } from "next/server";
import { mcpFixtureErrorResponse, mcpPromptInputFromBody } from "@/lib/mcp-fixtures/api";
import { createMcpPrompt, listMcpPrompts } from "@/lib/mcp-fixtures/service";
import { notifyLegacySsePromptListChanged } from "@/lib/mcp/sse-notifications";

export async function GET() {
  try {
    return NextResponse.json(await listMcpPrompts(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const prompt = await createMcpPrompt(mcpPromptInputFromBody(await request.json()));
    if (prompt.enabled) {
      notifyLegacySsePromptListChanged(prompt.id);
    }
    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    return mcpFixtureErrorResponse(error);
  }
}
