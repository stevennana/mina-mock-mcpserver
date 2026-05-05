import { NextResponse } from "next/server";
import { oauthIssuedTokenErrorResponse, oauthIssuedTokenFiltersFromUrl } from "@/lib/oauth/api";
import { listOAuthIssuedTokens } from "@/lib/oauth/service";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listOAuthIssuedTokens(oauthIssuedTokenFiltersFromUrl(request.url)));
  } catch (error) {
    return oauthIssuedTokenErrorResponse(error);
  }
}
