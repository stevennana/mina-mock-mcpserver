import { NextResponse } from "next/server";
import { basicUserCreateInputFromBody, basicUserErrorResponse } from "@/lib/basic-auth/api";
import { createBasicUser, listBasicUsers } from "@/lib/basic-auth/service";

export async function GET() {
  try {
    return NextResponse.json(await listBasicUsers(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return basicUserErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await createBasicUser(basicUserCreateInputFromBody(await request.json()));
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return basicUserErrorResponse(error);
  }
}
