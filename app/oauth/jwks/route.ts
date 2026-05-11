import { NextResponse } from "next/server";
import { publicCorsHeaders, publicCorsOptionsResponse } from "@/lib/http/cors";
import { oauthJsonWebKeySet } from "@/lib/oauth/discovery";

export async function GET() {
  return NextResponse.json(oauthJsonWebKeySet(), { headers: publicCorsHeaders() });
}

export const OPTIONS = publicCorsOptionsResponse;
