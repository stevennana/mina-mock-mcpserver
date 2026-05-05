import { NextResponse } from "next/server";
import { getOperatorHealth } from "@/lib/operator/config";
import { operatorLog } from "@/lib/operator/logger";

export async function GET() {
  const health = await getOperatorHealth();
  operatorLog("debug", "health check completed", { status: health.status });
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
