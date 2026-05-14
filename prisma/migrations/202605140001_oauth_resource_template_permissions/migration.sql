ALTER TABLE "OAuthIssuedToken" ADD COLUMN "resourceTemplatePermissionsJson" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "OAuthClientAllowedResourceTemplate" (
    "oauthClientId" TEXT NOT NULL,
    "resourceTemplateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthClientAllowedResourceTemplate_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthClientAllowedResourceTemplate_resourceTemplateId_fkey" FOREIGN KEY ("resourceTemplateId") REFERENCES "McpResourceTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("oauthClientId", "resourceTemplateId")
);

CREATE TABLE "OAuthAuthorizationCodeResourceTemplate" (
    "authorizationCodeId" TEXT NOT NULL,
    "resourceTemplateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAuthorizationCodeResourceTemplate_authorizationCodeId_fkey" FOREIGN KEY ("authorizationCodeId") REFERENCES "OAuthAuthorizationCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAuthorizationCodeResourceTemplate_resourceTemplateId_fkey" FOREIGN KEY ("resourceTemplateId") REFERENCES "McpResourceTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("authorizationCodeId", "resourceTemplateId")
);

CREATE INDEX "OAuthClientAllowedResourceTemplate_resourceTemplateId_idx" ON "OAuthClientAllowedResourceTemplate"("resourceTemplateId");
CREATE INDEX "OAuthAuthorizationCodeResourceTemplate_resourceTemplateId_idx" ON "OAuthAuthorizationCodeResourceTemplate"("resourceTemplateId");

INSERT OR IGNORE INTO "OAuthClientAllowedResourceTemplate" ("oauthClientId", "resourceTemplateId")
SELECT "OAuthClient"."id", "McpResourceTemplate"."id"
FROM "OAuthClient"
JOIN "McpResourceTemplate" ON "McpResourceTemplate"."enabled" = 1
WHERE "OAuthClient"."builtIn" = 1;
