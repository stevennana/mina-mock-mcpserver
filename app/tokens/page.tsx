import { AppNav } from "@/app/app-nav";
import { TokensManager } from "@/app/tokens/tokens-manager";
import { listOAuthIssuedTokens } from "@/lib/oauth/service";

export default async function TokensPage() {
  const tokenData = await listOAuthIssuedTokens();

  return (
    <main className="shell app-shell">
      <AppNav current="tokens" />
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth bearer evidence</p>
          <h1>Issued tokens</h1>
          <p className="lede compact">
            Inspect stored token claims, endpoint permissions, expiry, and revocation state without redisplaying raw access tokens.
          </p>
        </div>
        <div className="summary-strip" aria-label="Issued token counts">
          <span><strong>{tokenData.active}</strong>Active</span>
          <span><strong>{tokenData.expired}</strong>Expired</span>
          <span><strong>{tokenData.revoked}</strong>Revoked</span>
        </div>
      </header>
      <TokensManager initialData={tokenData} />
    </main>
  );
}
