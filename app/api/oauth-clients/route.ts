import { NextResponse } from "next/server";
import { oauthClientCreateInputFromBody, oauthClientErrorResponse } from "@/lib/oauth/api";
import { createOAuthClient, listOAuthClients } from "@/lib/oauth/service";

export async function GET() {
  try {
    return NextResponse.json(await listOAuthClients());
  } catch (error) {
    return oauthClientErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const result = await createOAuthClient(oauthClientCreateInputFromBody(await request.json()));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return oauthClientErrorResponse(error);
  }
}
