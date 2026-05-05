import Link from "next/link";
import { OAuthUsersManager } from "@/app/oauth-users/oauth-users-manager";
import { listOAuthUsers } from "@/lib/oauth/service";

export default async function OAuthUsersPage() {
  const userData = await listOAuthUsers();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users" aria-current="page">OAuth Users</Link>
        <Link href="/oauth-clients">OAuth Clients</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth login identities</p>
          <h1>OAuth users</h1>
          <p className="lede compact">
            Manage public login fixtures and token TTL presets for the mock OAuth authorization-code runtime.
          </p>
        </div>
        <div className="summary-strip" aria-label="OAuth user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <OAuthUsersManager initialData={userData} />
    </main>
  );
}
