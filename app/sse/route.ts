import { publicCorsOptionsResponse } from "@/lib/http/cors";
import { handleLegacySseGet } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const GET = handleLegacySseGet("unified");
export const OPTIONS = publicCorsOptionsResponse;
