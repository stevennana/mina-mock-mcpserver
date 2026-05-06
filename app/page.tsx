import { getBootstrapStatus } from "@/lib/bootstrap-status";
import { listEndpoints } from "@/lib/endpoints/service";
import Link from "next/link";
import { AppNav } from "@/app/app-nav";

const workflows = [
  { href: "/endpoints", title: "Build tools", description: "Create endpoints, configure schema, responses, failure modes, and console calls." },
  { href: "/inspector", title: "Verify protocol", description: "Run MCP Inspector and local smoke checks against no-auth, Basic, and OAuth routes." },
  { href: "/oauth-clients", title: "Prepare OAuth", description: "Manage clients, users, token permissions, and issued-token revocation evidence." },
  { href: "/config", title: "Connect clients", description: "Confirm base URL, health, MCP routes, OAuth metadata, JWKS, and operator logs." },
];

export default async function Home() {
  const status = getBootstrapStatus();
  const endpointData = await listEndpoints();

  return (
    <main className="shell app-shell">
      <AppNav current="dashboard" />
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Public test bench</p>
        <h1 id="page-title">MCP Mock Server</h1>
        <p className="lede">
          Public remote MCP mock server for testing no-auth, Basic Auth, mock OAuth bearer tokens,
          endpoint permissions, and tool-call failure modes.
        </p>
        <p className="lede compact">
          Use the <Link href="/config">connection guide</Link> for MCP, OAuth discovery metadata, and JWKS URLs.
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

      <section className="workflow-grid" aria-labelledby="workflow-title">
        <h2 id="workflow-title">Workflows</h2>
        <div>
          {workflows.map((workflow) => (
            <Link className="workflow-card" href={workflow.href} key={workflow.href}>
              <strong>{workflow.title}</strong>
              <span>{workflow.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
