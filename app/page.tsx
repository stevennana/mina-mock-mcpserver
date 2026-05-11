import { getBootstrapStatus } from "@/lib/bootstrap-status";
import { listEndpoints } from "@/lib/endpoints/service";
import Link from "next/link";
import { AppNav } from "@/app/app-nav";
import { MetricGrid, MetricTile, PageHeader, PageShell } from "@/app/ui/primitives";

export const dynamic = "force-dynamic";

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
    <PageShell>
      <AppNav current="dashboard" />
      <PageHeader
        eyebrow="Public test bench"
        title="MCP Mock Server"
        description={
          <>
            Public remote MCP mock server for testing no-auth, Basic Auth, mock OAuth bearer tokens,
            endpoint permissions, and tool-call failure modes. Use the <Link href="/config">connection guide</Link> for
            MCP, OAuth discovery metadata, and JWKS URLs.
          </>
        }
      />

      <MetricGrid>
        <MetricTile label="Runtime state" value={status.runtimeState} />
        <MetricTile label="Log level" value={status.logLevel} />
        <MetricTile label="Health route" value="/api/health" />
        <MetricTile label="Persisted endpoints" value={endpointData.total} />
        <MetricTile label="Enabled tools" value={endpointData.enabled} />
        <MetricTile label="Disabled tools" value={endpointData.disabled} />
      </MetricGrid>

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
    </PageShell>
  );
}
