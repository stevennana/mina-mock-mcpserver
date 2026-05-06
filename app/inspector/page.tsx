import { AppNav } from "@/app/app-nav";
import { headers } from "next/headers";
import { getPublicOperatorConfig } from "@/lib/operator/config";

export const dynamic = "force-dynamic";

export default async function InspectorPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const request = new Request(`${protocol}://${host}/inspector`, { headers: requestHeaders });
  const config = await getPublicOperatorConfig(request);

  return (
    <main className="shell app-shell">
      <AppNav current="inspector" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Protocol verification</p>
          <h1>Inspector</h1>
          <p className="lede compact">
            Run MCP Inspector and the project local smoke client against this mock server without mixing setup tasks into Config.
          </p>
        </div>
      </header>

      <div className="focused-layout">
        <section className="panel guide-panel" aria-labelledby="local-inspector-title">
          <h2 id="local-inspector-title">Standalone Inspector UI</h2>
          <p className="section-note">
            Launch a separate local browser page. Use its Mock Server scenario to verify REST, MCP, Basic, OAuth bearer, token revocation, audit evidence, and reset guards through UI, or use generic mode for any MCP endpoint.
          </p>
          <pre className="json-panel" aria-label="Standalone inspector UI command">npm run inspector:ui</pre>
        </section>

        <section className="panel guide-panel" aria-labelledby="mock-inspector-title">
          <h2 id="mock-inspector-title">Mock Server full smoke inspector</h2>
          <p className="section-note">
            This project-specific command verifies admin APIs, REST, MCP no-auth, Basic, OAuth bearer, token revocation, audit evidence, and reset guards.
          </p>
          <pre className="json-panel" aria-label="Local inspector command">npm run inspector:mock</pre>
        </section>

        <section className="panel guide-panel" aria-labelledby="upstream-title">
          <h2 id="upstream-title">Upstream MCP Inspector targets</h2>
          <div className="guide-list">
            <div>
              <span>No-auth Streamable HTTP</span>
              <code>npm run inspector:mcp:none</code>
            </div>
            <div>
              <span>Basic Auth Streamable HTTP</span>
              <code>npm run inspector:mcp:basic</code>
            </div>
            <div>
              <span>OAuth Bearer Streamable HTTP</span>
              <code>npm run inspector:mcp:oauth</code>
            </div>
          </div>
        </section>

        <section className="panel guide-panel" aria-labelledby="targets-title">
          <h2 id="targets-title">Current connection targets</h2>
          <div className="guide-list">
            <div><span>MCP unified</span><code>{config.routes.mcp.unified}</code></div>
            <div><span>MCP no auth</span><code>{config.routes.mcp.noAuth}</code></div>
            <div><span>MCP Basic</span><code>{config.routes.mcp.basic}</code></div>
            <div><span>MCP OAuth bearer</span><code>{config.routes.mcp.oauth}</code></div>
            <div><span>REST tools</span><code>{config.routes.rest.tools}</code></div>
            <div><span>OAuth authorization metadata</span><code>{config.routes.oauth.authorizationServerMetadata}</code></div>
            <div><span>OAuth protected resource metadata</span><code>{config.routes.oauth.protectedResourceMetadata}</code></div>
            <div><span>JWKS</span><code>{config.routes.oauth.jwksUri}</code></div>
          </div>
        </section>

        <section className="panel guide-panel" aria-labelledby="oauth-title">
          <h2 id="oauth-title">OAuth bearer preparation</h2>
          <ol className="step-list">
            <li>Create or open an OAuth client and allow the endpoints that should be callable.</li>
            <li>Use authorization code or client credentials to issue a token from <code>/oauth/token</code>.</li>
            <li>Pass the token to MCP Inspector as an Authorization bearer header for the OAuth target.</li>
            <li>Use Tokens to inspect claims and revoke the token, then rerun the same call to confirm 401 behavior.</li>
          </ol>
        </section>

        <section className="panel guide-panel" aria-labelledby="examples-title">
          <h2 id="examples-title">Client and curl examples</h2>
          <pre className="json-panel" aria-label="MCP client config example">{JSON.stringify(config.examples.mcpClient, null, 2)}</pre>
          <pre className="json-panel" aria-label="REST and OAuth curl examples">{Object.values(config.examples.curl).join("\n\n")}</pre>
        </section>
      </div>
    </main>
  );
}
