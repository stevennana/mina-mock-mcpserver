import Link from "next/link";
import { headers } from "next/headers";
import { oauthDiscoveryUrls, resolveOAuthIssuer } from "@/lib/oauth/discovery";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const urls = oauthDiscoveryUrls(resolveOAuthIssuer(`${protocol}://${host}`));
  const metadataEndpoints = [
    [".well-known/oauth-protected-resource", urls.protectedResourceMetadata],
    [".well-known/oauth-authorization-server", urls.authorizationServerMetadata],
    [".well-known/openid-configuration", urls.openidConfiguration],
    ["OAuth JWKS", urls.jwksUri],
  ] as const;

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
            Runtime URLs for MCP clients, REST clients, and OAuth discovery-aware setup.
          </p>
        </div>
      </section>

      <section className="panel guide-panel" aria-labelledby="discovery-title">
        <h2 id="discovery-title">OAuth discovery metadata</h2>
        <div className="guide-list">
          {metadataEndpoints.map(([label, url]) => (
            <div key={label}>
              <span>{label}</span>
              <code>{url}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="panel guide-panel" aria-labelledby="mcp-title">
        <h2 id="mcp-title">MCP client setup</h2>
        <pre className="json-panel" aria-label="MCP OAuth connection example">
{JSON.stringify(
  {
    mcp_url: urls.mcpOAuthEndpoint,
    oauth_protected_resource: urls.protectedResourceMetadata,
    oauth_authorization_server: urls.authorizationServerMetadata,
    openid_configuration: urls.openidConfiguration,
    jwks_uri: urls.jwksUri,
    scope_format: "endpoint:<endpoint_id>",
  },
  null,
  2,
)}
        </pre>
      </section>

      <section className="panel guide-panel" aria-labelledby="curl-title">
        <h2 id="curl-title">Metadata checks</h2>
        <pre className="json-panel" aria-label="OAuth discovery curl examples">{`curl ${urls.protectedResourceMetadata}
curl ${urls.authorizationServerMetadata}
curl ${urls.openidConfiguration}
curl ${urls.jwksUri}`}</pre>
      </section>
    </main>
  );
}
