-- Endpoint catalog persistence foundation.
CREATE TABLE "Endpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "protectedDefault" BOOLEAN NOT NULL DEFAULT false,
  "deleteCode" TEXT,
  "defaultResponseJson" TEXT NOT NULL DEFAULT '{}',
  "failureMode" TEXT NOT NULL DEFAULT 'none',
  "failureStatusCode" INTEGER,
  "failureDelayMs" INTEGER NOT NULL DEFAULT 0,
  "failureMessage" TEXT,
  "malformedResponseJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EndpointParam" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "endpointId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT,
  "description" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'string',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "defaultValueJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EndpointParam_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResponseCase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "endpointId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "matchArgsJson" TEXT NOT NULL DEFAULT '{}',
  "responseJson" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 200,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ResponseCase_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Endpoint_name_key" ON "Endpoint"("name");
CREATE UNIQUE INDEX "EndpointParam_endpointId_position_key" ON "EndpointParam"("endpointId", "position");
CREATE UNIQUE INDEX "EndpointParam_endpointId_name_key" ON "EndpointParam"("endpointId", "name");
CREATE INDEX "EndpointParam_endpointId_idx" ON "EndpointParam"("endpointId");
CREATE UNIQUE INDEX "ResponseCase_endpointId_name_key" ON "ResponseCase"("endpointId", "name");
CREATE INDEX "ResponseCase_endpointId_idx" ON "ResponseCase"("endpointId");
