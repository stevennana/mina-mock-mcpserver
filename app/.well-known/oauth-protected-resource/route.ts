import { NextResponse } from "next/server";
import { oauthProtectedResourceMetadata } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function GET(request: Request) {
  return NextResponse.json(oauthProtectedResourceMetadata((await resolveBaseUrl(request)).baseUrl));
}
