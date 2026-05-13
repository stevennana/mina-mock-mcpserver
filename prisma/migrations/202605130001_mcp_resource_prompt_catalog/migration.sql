-- MCP resource, resource template, prompt, and completion fixture persistence.
CREATE TABLE "McpResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uri" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "protectedDefault" BOOLEAN NOT NULL DEFAULT false,
    "textContent" TEXT,
    "blobContentBase64" TEXT,
    "annotationsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "McpResourceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uriTemplate" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "protectedDefault" BOOLEAN NOT NULL DEFAULT false,
    "textTemplate" TEXT,
    "blobTemplateBase64" TEXT,
    "annotationsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "McpResourceTemplateArgument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceTemplateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sampleValueJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpResourceTemplateArgument_resourceTemplateId_fkey" FOREIGN KEY ("resourceTemplateId") REFERENCES "McpResourceTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "McpPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "protectedDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "McpPromptArgument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpPromptArgument_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "McpPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "McpPromptMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "textTemplate" TEXT,
    "resourceUri" TEXT,
    "resourceMimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpPromptMessage_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "McpPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "McpCompletionCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL,
    "resourceTemplateId" TEXT,
    "promptId" TEXT,
    "argumentName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpCompletionCandidate_resourceTemplateId_fkey" FOREIGN KEY ("resourceTemplateId") REFERENCES "McpResourceTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McpCompletionCandidate_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "McpPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "McpResource_uri_key" ON "McpResource"("uri");
CREATE INDEX "McpResource_enabled_uri_idx" ON "McpResource"("enabled", "uri");
CREATE UNIQUE INDEX "McpResourceTemplate_uriTemplate_key" ON "McpResourceTemplate"("uriTemplate");
CREATE UNIQUE INDEX "McpResourceTemplate_name_key" ON "McpResourceTemplate"("name");
CREATE INDEX "McpResourceTemplate_enabled_name_idx" ON "McpResourceTemplate"("enabled", "name");
CREATE UNIQUE INDEX "McpResourceTemplateArgument_resourceTemplateId_position_key" ON "McpResourceTemplateArgument"("resourceTemplateId", "position");
CREATE UNIQUE INDEX "McpResourceTemplateArgument_resourceTemplateId_name_key" ON "McpResourceTemplateArgument"("resourceTemplateId", "name");
CREATE INDEX "McpResourceTemplateArgument_resourceTemplateId_idx" ON "McpResourceTemplateArgument"("resourceTemplateId");
CREATE UNIQUE INDEX "McpPrompt_name_key" ON "McpPrompt"("name");
CREATE INDEX "McpPrompt_enabled_name_idx" ON "McpPrompt"("enabled", "name");
CREATE UNIQUE INDEX "McpPromptArgument_promptId_position_key" ON "McpPromptArgument"("promptId", "position");
CREATE UNIQUE INDEX "McpPromptArgument_promptId_name_key" ON "McpPromptArgument"("promptId", "name");
CREATE INDEX "McpPromptArgument_promptId_idx" ON "McpPromptArgument"("promptId");
CREATE UNIQUE INDEX "McpPromptMessage_promptId_position_key" ON "McpPromptMessage"("promptId", "position");
CREATE INDEX "McpPromptMessage_promptId_idx" ON "McpPromptMessage"("promptId");
CREATE UNIQUE INDEX "McpCompletionCandidate_resourceTemplateId_argumentName_value_key" ON "McpCompletionCandidate"("resourceTemplateId", "argumentName", "value");
CREATE UNIQUE INDEX "McpCompletionCandidate_promptId_argumentName_value_key" ON "McpCompletionCandidate"("promptId", "argumentName", "value");
CREATE INDEX "McpCompletionCandidate_ownerType_argumentName_idx" ON "McpCompletionCandidate"("ownerType", "argumentName");
CREATE INDEX "McpCompletionCandidate_resourceTemplateId_idx" ON "McpCompletionCandidate"("resourceTemplateId");
CREATE INDEX "McpCompletionCandidate_promptId_idx" ON "McpCompletionCandidate"("promptId");
