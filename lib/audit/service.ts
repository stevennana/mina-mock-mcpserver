import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/db/client";

type AuditClient = Pick<PrismaClient, "auditEvent">;

export type AuditOutcome = "success" | "failure";

export type AuditEventInput = {
  eventType: string;
  subjectType: string;
  subjectId?: string | null;
  subjectName?: string | null;
  outcome: AuditOutcome;
  actorType?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditEventSummary = {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string | null;
  subjectName: string | null;
  outcome: string;
  actorType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function recordAuditEvent(input: AuditEventInput, client: AuditClient = createPrismaClient()) {
  return client.auditEvent.create({
    data: {
      id: `audit_${randomUUID()}`,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      subjectName: input.subjectName ?? null,
      outcome: input.outcome,
      actorType: input.actorType ?? "public",
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}

export async function listAuditEvents(client: PrismaClient = createPrismaClient()): Promise<AuditEventSummary[]> {
  const events = await client.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    subjectName: event.subjectName,
    outcome: event.outcome,
    actorType: event.actorType,
    metadata: parseMetadata(event.metadataJson),
    createdAt: event.createdAt.toISOString(),
  }));
}
