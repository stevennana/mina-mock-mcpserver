import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
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

export type AuditEventFilters = {
  eventType?: string;
  outcome?: AuditOutcome | "all";
  subject?: string;
  query?: string;
  cursor?: string;
  limit?: number;
};

export type AuditEventListResult = {
  events: AuditEventSummary[];
  total: number;
  pageSize: number;
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_AUDIT_PAGE_SIZE = 25;
const MAX_AUDIT_PAGE_SIZE = 100;

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

function auditEventWhere(filters: AuditEventFilters): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {};
  const and: Prisma.AuditEventWhereInput[] = [];
  if (filters.outcome && filters.outcome !== "all") {
    where.outcome = filters.outcome;
  }
  if (filters.eventType?.trim()) {
    where.eventType = { contains: filters.eventType.trim() };
  }
  if (filters.subject?.trim()) {
    const subject = filters.subject.trim();
    and.push({
      OR: [
        { subjectName: { contains: subject } },
        { subjectId: { contains: subject } },
        { subjectType: { contains: subject } },
      ],
    });
  }
  if (filters.query?.trim()) {
    const query = filters.query.trim();
    and.push({
      OR: [
        { eventType: { contains: query } },
        { subjectName: { contains: query } },
        { subjectId: { contains: query } },
        { subjectType: { contains: query } },
        { actorType: { contains: query } },
        { metadataJson: { contains: query } },
      ],
    });
  }
  if (and.length > 0) where.AND = and;
  return where;
}

function normalizedAuditLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return DEFAULT_AUDIT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_AUDIT_PAGE_SIZE), 1), MAX_AUDIT_PAGE_SIZE);
}

function summarizeAuditEvent(event: {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string | null;
  subjectName: string | null;
  outcome: string;
  actorType: string;
  metadataJson: string;
  createdAt: Date;
}): AuditEventSummary {
  return {
    id: event.id,
    eventType: event.eventType,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    subjectName: event.subjectName,
    outcome: event.outcome,
    actorType: event.actorType,
    metadata: parseMetadata(event.metadataJson),
    createdAt: event.createdAt.toISOString(),
  };
}

export async function listAuditEvents(
  filters: AuditEventFilters = {},
  client: PrismaClient = createPrismaClient(),
): Promise<AuditEventListResult> {
  const pageSize = normalizedAuditLimit(filters.limit);
  const where = auditEventWhere(filters);
  const events = await client.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });
  const hasMore = events.length > pageSize;
  const page = hasMore ? events.slice(0, pageSize) : events;
  const total = await client.auditEvent.count({ where });

  return {
    events: page.map(summarizeAuditEvent),
    total,
    pageSize,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    hasMore,
  };
}

export async function getAuditEvent(id: string, client: PrismaClient = createPrismaClient()): Promise<AuditEventSummary | null> {
  const event = await client.auditEvent.findUnique({ where: { id } });
  return event ? summarizeAuditEvent(event) : null;
}
