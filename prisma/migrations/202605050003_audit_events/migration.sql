CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "outcome" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'public',
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX "AuditEvent_subjectType_subjectId_idx" ON "AuditEvent"("subjectType", "subjectId");
