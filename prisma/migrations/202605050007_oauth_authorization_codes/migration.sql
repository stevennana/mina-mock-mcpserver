CREATE TABLE "OAuthAuthorizationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "oauthUserId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "state" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAuthorizationCode_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAuthorizationCode_oauthUserId_fkey" FOREIGN KEY ("oauthUserId") REFERENCES "OAuthUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OAuthAuthorizationCodeEndpoint" (
    "authorizationCodeId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("authorizationCodeId", "endpointId"),
    CONSTRAINT "OAuthAuthorizationCodeEndpoint_authorizationCodeId_fkey" FOREIGN KEY ("authorizationCodeId") REFERENCES "OAuthAuthorizationCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAuthorizationCodeEndpoint_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthAuthorizationCode_code_key" ON "OAuthAuthorizationCode"("code");
CREATE INDEX "OAuthAuthorizationCode_code_idx" ON "OAuthAuthorizationCode"("code");
CREATE INDEX "OAuthAuthorizationCode_oauthClientId_oauthUserId_idx" ON "OAuthAuthorizationCode"("oauthClientId", "oauthUserId");
CREATE INDEX "OAuthAuthorizationCode_expiresAt_idx" ON "OAuthAuthorizationCode"("expiresAt");
CREATE INDEX "OAuthAuthorizationCodeEndpoint_endpointId_idx" ON "OAuthAuthorizationCodeEndpoint"("endpointId");
