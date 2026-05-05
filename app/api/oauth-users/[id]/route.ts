import { NextResponse } from "next/server";
import { oauthUserErrorResponse, oauthUserUpdateInputFromBody } from "@/lib/oauth/api";
import { deleteOAuthUser, updateOAuthUser } from "@/lib/oauth/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await updateOAuthUser(id, oauthUserUpdateInputFromBody(await request.json()));
    return NextResponse.json({ user });
  } catch (error) {
    return oauthUserErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await deleteOAuthUser(id);
    return NextResponse.json({ user });
  } catch (error) {
    return oauthUserErrorResponse(error);
  }
}
