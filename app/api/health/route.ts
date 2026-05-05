import { NextResponse } from "next/server";
import { getBootstrapStatus } from "@/lib/bootstrap-status";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    database: getBootstrapStatus().runtimeState,
    time: new Date().toISOString(),
  });
}
