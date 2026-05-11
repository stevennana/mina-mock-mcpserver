import { NextResponse } from "next/server";
import { publicCorsHeaders, publicCorsOptionsResponse } from "@/lib/http/cors";
import { oauthTokenErrorResponse, oauthTokenInputFromFormData } from "@/lib/oauth/api";
import { exchangeOAuthToken } from "@/lib/oauth/service";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function POST(request: Request) {
  try {
    const issuer = (await resolveBaseUrl(request)).baseUrl;
    const result = await exchangeOAuthToken(oauthTokenInputFromFormData(await request.formData(), issuer));
    return NextResponse.json(result, {
      status: 200,
      headers: publicCorsHeaders({ "Cache-Control": "no-store", Pragma: "no-cache" }),
    });
  } catch (error) {
    return oauthTokenErrorResponse(error);
  }
}

export const OPTIONS = publicCorsOptionsResponse;
