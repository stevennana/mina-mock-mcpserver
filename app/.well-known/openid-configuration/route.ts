import { NextResponse } from "next/server";
import { openIdConfigurationMetadata } from "@/lib/oauth/discovery";
import { resolveBaseUrl } from "@/lib/operator/config";

export async function GET(request: Request) {
  return NextResponse.json(openIdConfigurationMetadata((await resolveBaseUrl(request)).baseUrl));
}
