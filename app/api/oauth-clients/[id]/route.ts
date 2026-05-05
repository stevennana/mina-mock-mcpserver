import { oauthClientErrorResponse, oauthClientUpdateInputFromBody } from "@/lib/oauth/api";
import { deleteOAuthClient, updateOAuthClient } from "@/lib/oauth/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const client = await updateOAuthClient(id, oauthClientUpdateInputFromBody(await request.json()));
    return Response.json({ client });
  } catch (error) {
    return oauthClientErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const client = await deleteOAuthClient(id);
    return Response.json({ client });
  } catch (error) {
    return oauthClientErrorResponse(error);
  }
}
