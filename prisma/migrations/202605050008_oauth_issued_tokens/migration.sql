CREATE TABLE "OAuthIssuedToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jti" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "oauthUserId" TEXT NOT NULL,
    "grantType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "endpointPermissionsJson" TEXT NOT NULL DEFAULT '[]',
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthIssuedToken_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthIssuedToken_oauthUserId_fkey" FOREIGN KEY ("oauthUserId") REFERENCES "OAuthUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthIssuedToken_jti_key" ON "OAuthIssuedToken"("jti");
CREATE INDEX "OAuthIssuedToken_jti_idx" ON "OAuthIssuedToken"("jti");
CREATE INDEX "OAuthIssuedToken_oauthClientId_oauthUserId_idx" ON "OAuthIssuedToken"("oauthClientId", "oauthUserId");
CREATE INDEX "OAuthIssuedToken_expiresAt_idx" ON "OAuthIssuedToken"("expiresAt");
CREATE INDEX "OAuthIssuedToken_revokedAt_idx" ON "OAuthIssuedToken"("revokedAt");
