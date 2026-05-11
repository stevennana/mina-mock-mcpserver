import { NextResponse } from "next/server";
import { getPublicOperatorConfig } from "@/lib/operator/config";

export async function GET(request: Request) {
  return NextResponse.json(await getPublicOperatorConfig(request));
}

export async function POST() {
  return NextResponse.json(
    {
      error: "config_is_read_only",
      message: "Operator config is read-only at runtime. Set APP_BASE_URL and ROOT_PASSWORD with environment variables before starting the service.",
    },
    { status: 405, headers: { allow: "GET" } },
  );
}
