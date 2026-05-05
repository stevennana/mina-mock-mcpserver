import { NextResponse } from "next/server";
import { openIdConfigurationMetadata, resolveOAuthIssuer } from "@/lib/oauth/discovery";

export async function GET(request: Request) {
  return NextResponse.json(openIdConfigurationMetadata(resolveOAuthIssuer(request.url)));
}
