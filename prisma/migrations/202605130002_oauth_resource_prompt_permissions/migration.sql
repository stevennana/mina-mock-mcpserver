ALTER TABLE "OAuthIssuedToken" ADD COLUMN "resourcePermissionsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OAuthIssuedToken" ADD COLUMN "promptPermissionsJson" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "OAuthClientAllowedResource" (
    "oauthClientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("oauthClientId", "resourceId"),
    CONSTRAINT "OAuthClientAllowedResource_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthClientAllowedResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "McpResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OAuthClientAllowedPrompt" (
    "oauthClientId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("oauthClientId", "promptId"),
    CONSTRAINT "OAuthClientAllowedPrompt_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthClientAllowedPrompt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "McpPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OAuthAuthorizationCodeResource" (
    "authorizationCodeId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("authorizationCodeId", "resourceId"),
    CONSTRAINT "OAuthAuthorizationCodeResource_authorizationCodeId_fkey" FOREIGN KEY ("authorizationCodeId") REFERENCES "OAuthAuthorizationCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAuthorizationCodeResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "McpResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OAuthAuthorizationCodePrompt" (
    "authorizationCodeId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("authorizationCodeId", "promptId"),
    CONSTRAINT "OAuthAuthorizationCodePrompt_authorizationCodeId_fkey" FOREIGN KEY ("authorizationCodeId") REFERENCES "OAuthAuthorizationCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAuthorizationCodePrompt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "McpPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OAuthClientAllowedResource_resourceId_idx" ON "OAuthClientAllowedResource"("resourceId");
CREATE INDEX "OAuthClientAllowedPrompt_promptId_idx" ON "OAuthClientAllowedPrompt"("promptId");
CREATE INDEX "OAuthAuthorizationCodeResource_resourceId_idx" ON "OAuthAuthorizationCodeResource"("resourceId");
CREATE INDEX "OAuthAuthorizationCodePrompt_promptId_idx" ON "OAuthAuthorizationCodePrompt"("promptId");

INSERT OR IGNORE INTO "OAuthClientAllowedResource" ("oauthClientId", "resourceId")
SELECT "OAuthClient"."id", "McpResource"."id"
FROM "OAuthClient"
CROSS JOIN "McpResource"
WHERE "McpResource"."enabled" = 1;

INSERT OR IGNORE INTO "OAuthClientAllowedPrompt" ("oauthClientId", "promptId")
SELECT "OAuthClient"."id", "McpPrompt"."id"
FROM "OAuthClient"
CROSS JOIN "McpPrompt"
WHERE "McpPrompt"."enabled" = 1;
