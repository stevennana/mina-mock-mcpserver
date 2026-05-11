import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseDelete, handleLegacySseMessagePost } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const POST = handleLegacySseMessagePost("none");
export const DELETE = handleLegacySseDelete("none");
export const OPTIONS = publicCorsOptionsResponse;
