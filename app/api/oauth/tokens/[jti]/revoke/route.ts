import { publicCorsHeaders, publicCorsOptionsResponse } from "@/lib/http/cors";
import { oauthIssuedTokenErrorResponse } from "@/lib/oauth/api";
import { revokeOAuthIssuedToken } from "@/lib/oauth/service";

export async function POST(_request: Request, { params }: { params: Promise<{ jti: string }> }) {
  const { jti } = await params;
  try {
    return Response.json(await revokeOAuthIssuedToken(jti), { headers: publicCorsHeaders() });
  } catch (error) {
    return oauthIssuedTokenErrorResponse(error);
  }
}

export const OPTIONS = publicCorsOptionsResponse;
