import { NextResponse } from "next/server";
import { oauthTokenErrorResponse, oauthTokenInputFromFormData } from "@/lib/oauth/api";
import { resolveOAuthIssuer } from "@/lib/oauth/discovery";
import { exchangeOAuthToken } from "@/lib/oauth/service";

export async function POST(request: Request) {
  try {
    const issuer = resolveOAuthIssuer(request.url);
    const result = await exchangeOAuthToken(oauthTokenInputFromFormData(await request.formData(), issuer));
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    return oauthTokenErrorResponse(error);
  }
}
