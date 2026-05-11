import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseDelete, handleLegacySseMessagePost } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const POST = handleLegacySseMessagePost("unified");
export const DELETE = handleLegacySseDelete("unified");
export const OPTIONS = publicCorsOptionsResponse;
