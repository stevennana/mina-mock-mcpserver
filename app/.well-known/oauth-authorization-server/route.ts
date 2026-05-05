import { NextResponse } from "next/server";
import { oauthAuthorizationServerMetadata, resolveOAuthIssuer } from "@/lib/oauth/discovery";

export async function GET(request: Request) {
  return NextResponse.json(oauthAuthorizationServerMetadata(resolveOAuthIssuer(request.url)));
}
