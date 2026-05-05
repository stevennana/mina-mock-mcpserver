import { NextResponse } from "next/server";
import { oauthUserCreateInputFromBody, oauthUserErrorResponse } from "@/lib/oauth/api";
import { createOAuthUser, listOAuthUsers } from "@/lib/oauth/service";

export async function GET() {
  try {
    return NextResponse.json(await listOAuthUsers());
  } catch (error) {
    return oauthUserErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await createOAuthUser(oauthUserCreateInputFromBody(await request.json()));
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return oauthUserErrorResponse(error);
  }
}
