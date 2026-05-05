import { NextResponse } from "next/server";
import { oauthAuthorizationServerMetadata } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function GET(request: Request) {
  return NextResponse.json(oauthAuthorizationServerMetadata((await resolveBaseUrl(request)).baseUrl));
}
