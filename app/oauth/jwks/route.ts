import { NextResponse } from "next/server";
import { oauthJsonWebKeySet } from "@/lib/oauth/discovery";

export async function GET() {
  return NextResponse.json(oauthJsonWebKeySet());
}
