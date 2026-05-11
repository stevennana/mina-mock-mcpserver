import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseDelete, handleLegacySseMessagePost } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const POST = handleLegacySseMessagePost("basic");
export const DELETE = handleLegacySseDelete("basic");
export const OPTIONS = publicCorsOptionsResponse;
