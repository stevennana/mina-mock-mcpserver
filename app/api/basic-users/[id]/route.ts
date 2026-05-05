import { NextResponse } from "next/server";
import { basicUserErrorResponse, basicUserUpdateInputFromBody } from "@/lib/basic-auth/api";
import { deleteBasicUser, updateBasicUser } from "@/lib/basic-auth/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await updateBasicUser(id, basicUserUpdateInputFromBody(await request.json()));
    return NextResponse.json({ user });
  } catch (error) {
    return basicUserErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await deleteBasicUser(id);
    return NextResponse.json({ user });
  } catch (error) {
    return basicUserErrorResponse(error);
  }
}
