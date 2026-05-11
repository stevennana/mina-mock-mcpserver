import { oauthIssuedTokenErrorResponse } from "@/lib/oauth/api";
import { getOAuthIssuedTokenDetail } from "@/lib/oauth/service";

export async function GET(_request: Request, { params }: { params: Promise<{ jti: string }> }) {
  const { jti } = await params;
  try {
    return Response.json(await getOAuthIssuedTokenDetail(jti), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return oauthIssuedTokenErrorResponse(error);
  }
}
