import { NextResponse } from "next/server";
import { oauthTokenErrorResponse, oauthTokenInputFromFormData } from "@/lib/oauth/api";
import { exchangeOAuthAuthorizationCode } from "@/lib/oauth/service";

export async function POST(request: Request) {
  try {
    const issuer = new URL(request.url).origin;
    const result = await exchangeOAuthAuthorizationCode(oauthTokenInputFromFormData(await request.formData(), issuer));
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    return oauthTokenErrorResponse(error);
  }
}
