import { NextResponse } from "next/server";
import { oauthProtectedResourceMetadata, resolveOAuthIssuer } from "@/lib/oauth/discovery";

export async function GET(request: Request) {
  return NextResponse.json(oauthProtectedResourceMetadata(resolveOAuthIssuer(request.url)));
}
