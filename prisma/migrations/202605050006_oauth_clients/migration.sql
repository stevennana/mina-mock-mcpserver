CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "secretHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrisJson" TEXT NOT NULL DEFAULT '[]',
    "clientCredentialsTtlSeconds" INTEGER NOT NULL DEFAULT 3600,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "OAuthClientAllowedEndpoint" (
    "oauthClientId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("oauthClientId", "endpointId"),
    CONSTRAINT "OAuthClientAllowedEndpoint_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthClientAllowedEndpoint_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");
CREATE INDEX "OAuthClient_builtIn_clientId_idx" ON "OAuthClient"("builtIn", "clientId");
CREATE INDEX "OAuthClientAllowedEndpoint_endpointId_idx" ON "OAuthClientAllowedEndpoint"("endpointId");
