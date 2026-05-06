import { headers } from "next/headers";
import { AppNav } from "@/app/app-nav";
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
      <AppNav current="config" />

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
