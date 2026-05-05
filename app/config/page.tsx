import Link from "next/link";
import { headers } from "next/headers";
import { ConfigManager } from "@/app/config/config-manager";
import { getPublicOperatorConfig } from "@/lib/operator/config";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const request = new Request(`${protocol}://${host}/config`, { headers: requestHeaders });
  const config = await getPublicOperatorConfig(request);

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/oauth-clients">OAuth Clients</Link>
        <Link href="/config" aria-current="page">Config</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>

      <section className="page-header" aria-labelledby="config-title">
        <div>
          <p className="eyebrow">Connection guide</p>
          <h1 id="config-title">Config</h1>
          <p className="lede compact">
            Runtime URLs for MCP clients, REST clients, OAuth discovery, health, public config, and operator logs.
          </p>
        </div>
      </section>

      <ConfigManager initialConfig={config} />
    </main>
  );
}
