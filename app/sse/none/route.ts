import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseGet } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const GET = handleLegacySseGet("none");
export const OPTIONS = publicCorsOptionsResponse;
