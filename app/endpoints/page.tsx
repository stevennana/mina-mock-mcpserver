import Link from "next/link";
import { EndpointManager } from "@/app/endpoints/endpoint-manager";
import { listEndpoints } from "@/lib/endpoints/service";

export default async function EndpointsPage() {
  const endpointData = await listEndpoints();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints" aria-current="page">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Public endpoint setup</p>
          <h1>Endpoint management</h1>
          <p className="lede compact">
            Create and edit persisted mock tool definitions for later MCP and REST runtime slices.
          </p>
        </div>
        <div className="summary-strip" aria-label="Endpoint counts">
          <span><strong>{endpointData.total}</strong>Total</span>
          <span><strong>{endpointData.enabled}</strong>Enabled</span>
          <span><strong>{endpointData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <EndpointManager initialData={endpointData} />
    </main>
  );
}
