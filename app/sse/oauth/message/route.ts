import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseDelete, handleLegacySseMessagePost } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const POST = handleLegacySseMessagePost("oauth");
export const DELETE = handleLegacySseDelete("oauth");
export const OPTIONS = publicCorsOptionsResponse;
