import { NextResponse } from "next/server";
import { oauthTokenErrorResponse, oauthTokenInputFromFormData } from "@/lib/oauth/api";
import { exchangeOAuthToken } from "@/lib/oauth/service";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function POST(request: Request) {
  try {
    const issuer = (await resolveBaseUrl(request)).baseUrl;
    const result = await exchangeOAuthToken(oauthTokenInputFromFormData(await request.formData(), issuer));
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    return oauthTokenErrorResponse(error);
  }
}
