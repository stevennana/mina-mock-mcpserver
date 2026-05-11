import { NextResponse } from "next/server";
import { listAuditEvents, type AuditOutcome } from "@/lib/audit/service";
import { endpointErrorResponse } from "@/lib/endpoints/api";

function stringParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function outcomeParam(url: URL): AuditOutcome | "all" {
  const value = url.searchParams.get("outcome");
  return value === "success" || value === "failure" ? value : "all";
}

function limitParam(url: URL) {
  const value = Number(url.searchParams.get("limit") ?? "");
  return Number.isFinite(value) ? value : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await listAuditEvents({
        eventType: stringParam(url, "eventType"),
        outcome: outcomeParam(url),
        subject: stringParam(url, "subject"),
        query: stringParam(url, "query"),
        cursor: stringParam(url, "cursor"),
        limit: limitParam(url),
      }),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return endpointErrorResponse(error);
  }
}
