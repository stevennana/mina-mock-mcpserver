import Link from "next/link";
import { OAuthClientsManager } from "@/app/oauth-clients/oauth-clients-manager";
import { listOAuthClients } from "@/lib/oauth/service";

export default async function OAuthClientsPage() {
  const clientData = await listOAuthClients();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/oauth-clients" aria-current="page">OAuth Clients</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth relying parties</p>
          <h1>OAuth clients</h1>
          <p className="lede compact">
            Manage mock OAuth clients, redirect URIs, generated secrets, and maximum endpoint permissions.
          </p>
        </div>
        <div className="summary-strip" aria-label="OAuth client counts">
          <span><strong>{clientData.total}</strong>Total</span>
          <span><strong>{clientData.enabled}</strong>Enabled</span>
          <span><strong>{clientData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <OAuthClientsManager initialData={clientData} />
    </main>
  );
}
