import { getBootstrapStatus } from "@/lib/bootstrap-status";
import { listEndpoints } from "@/lib/endpoints/service";
import Link from "next/link";

const plannedSurfaces = [
  "Endpoint and tool management",
  "MCP JSON-RPC runtime",
  "REST mock API",
  "Basic Auth management",
  "OAuth consent and token runtime",
  "Failure simulation and audit",
  "Operator configuration and startup proof",
];

export default async function Home() {
  const status = getBootstrapStatus();
  const endpointData = await listEndpoints();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/" aria-current="page">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Public test bench</p>
        <h1 id="page-title">MCP Mock Server</h1>
        <p className="lede">
          Public remote MCP mock server for testing no-auth, Basic Auth, mock OAuth bearer tokens,
          endpoint permissions, and tool-call failure modes.
        </p>
      </section>

      <section className="status-grid" aria-label="Bootstrap status">
        <div>
          <span>Runtime state</span>
          <strong>{status.runtimeState}</strong>
        </div>
        <div>
          <span>Log level</span>
          <strong>{status.logLevel}</strong>
        </div>
        <div>
          <span>Health route</span>
          <strong>/api/health</strong>
        </div>
        <div>
          <span>Persisted endpoints</span>
          <strong>{endpointData.total}</strong>
        </div>
        <div>
          <span>Enabled tools</span>
          <strong>{endpointData.enabled}</strong>
        </div>
        <div>
          <span>Disabled tools</span>
          <strong>{endpointData.disabled}</strong>
        </div>
      </section>

      <section className="panel" aria-labelledby="queue-title">
        <h2 id="queue-title">Queued feature fronts</h2>
        <ul>
          {plannedSurfaces.map((surface) => (
            <li key={surface}>{surface}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
