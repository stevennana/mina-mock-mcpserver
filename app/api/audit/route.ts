import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/audit/service";
import { endpointErrorResponse } from "@/lib/endpoints/api";

export async function GET() {
  try {
    return NextResponse.json(
      { events: await listAuditEvents() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return endpointErrorResponse(error);
  }
}
