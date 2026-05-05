-- Add PRD-backed endpoint display title and response-case execution config.
ALTER TABLE "Endpoint" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ResponseCase" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResponseCase" ADD COLUMN "delayMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResponseCase" ADD COLUMN "errorMode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "ResponseCase" ADD COLUMN "errorStatusCode" INTEGER;
ALTER TABLE "ResponseCase" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "ResponseCase" ADD COLUMN "errorBodyJson" TEXT;

CREATE INDEX "ResponseCase_endpointId_priority_idx" ON "ResponseCase"("endpointId", "priority");
