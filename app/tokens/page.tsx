import Link from "next/link";
import { TokensManager } from "@/app/tokens/tokens-manager";
import { listOAuthIssuedTokens } from "@/lib/oauth/service";

export default async function TokensPage() {
  const tokenData = await listOAuthIssuedTokens();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/oauth-clients">OAuth Clients</Link>
        <Link href="/tokens" aria-current="page">Tokens</Link>
        <Link href="/config">Config</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
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
