import { NextResponse } from "next/server";
import { publicCorsHeaders, publicCorsOptionsResponse } from "@/lib/http/cors";
import { oauthProtectedResourceMetadata } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function GET(request: Request) {
  return NextResponse.json(oauthProtectedResourceMetadata((await resolveBaseUrl(request)).baseUrl), {
    headers: publicCorsHeaders(),
  });
}

export const OPTIONS = publicCorsOptionsResponse;
