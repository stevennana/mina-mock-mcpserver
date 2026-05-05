import { oauthClientErrorResponse } from "@/lib/oauth/api";
import { regenerateOAuthClientSecret } from "@/lib/oauth/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await regenerateOAuthClientSecret(id);
    return Response.json(result);
  } catch (error) {
    return oauthClientErrorResponse(error);
  }
}
