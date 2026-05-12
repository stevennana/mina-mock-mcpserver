import { AppNav } from "@/app/app-nav";
import { headers } from "next/headers";
import { BadgeCheck, MonitorCog } from "lucide-react";
import { getPublicOperatorConfig } from "@/lib/operator/config";
import { CopyButton } from "@/app/copy-button";
import { listOAuthClients } from "@/lib/oauth/service";

export const dynamic = "force-dynamic";

export default async function InspectorPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const request = new Request(`${protocol}://${host}/inspector`, { headers: requestHeaders });
  const [config, oauthClientData] = await Promise.all([getPublicOperatorConfig(request), listOAuthClients()]);
  const oauthClient = oauthClientData.clients.find((client) => client.builtIn) ?? oauthClientData.clients[0] ?? null;
  const redirectUri = oauthClient?.redirectUris[0] ?? "";
  const authorizeUrl = oauthClient && redirectUri
    ? `${config.routes.oauth.authorizationEndpoint}?${new URLSearchParams({
      response_type: "code",
      client_id: oauthClient.clientId,
      redirect_uri: redirectUri,
      resource: config.baseUrl.baseUrl,
      state: "local-inspector-demo",
    })}`
    : "";
  const clientSecretHint = oauthClient?.builtIn ? "default" : "PASTE_CLIENT_SECRET";
  const basicAuthorizationHeader = `Authorization: Basic ${Buffer.from("default:default").toString("base64")}`;
  const inspectorUiBase = "http://localhost:6274/";
  const inspectorUrl = (transport: "streamable-http" | "sse", serverUrl: string) =>
    `${inspectorUiBase}?transport=${transport}&serverUrl=${encodeURIComponent(serverUrl)}`;
  const inspectorCliNone = `npx -y @modelcontextprotocol/inspector --cli ${config.routes.mcp.noAuth} --transport http --method tools/list`;
  const inspectorCliBasic = `npx -y @modelcontextprotocol/inspector --cli ${config.routes.mcp.basic} --transport http --method tools/list --header "${basicAuthorizationHeader}"`;
  const inspectorCliOauth = `npx -y @modelcontextprotocol/inspector --cli ${config.routes.mcp.oauth} --transport http --method tools/list --header "Authorization: Bearer PASTE_ACCESS_TOKEN"`;
  const inspectorCliSse = `npx -y @modelcontextprotocol/inspector --cli ${config.routes.mcp.sseNoAuth} --transport sse --method tools/list`;
  const tokenExchangeCurl = oauthClient && redirectUri
    ? [
      `curl -X POST ${config.routes.oauth.tokenEndpoint}`,
      "-H 'content-type: application/x-www-form-urlencoded'",
      "-d 'grant_type=authorization_code'",
      "-d 'code=PASTE_AUTHORIZATION_CODE'",
      `-d 'redirect_uri=${redirectUri}'`,
      `-d 'client_id=${oauthClient.clientId}'`,
      `-d 'client_secret=${clientSecretHint}'`,
    ].join(" \\\n  ")
    : "";
  const oauthMcpCurl = `curl -X POST ${config.routes.mcp.oauth} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: 2025-06-18' \\
  -H 'authorization: Bearer PASTE_ACCESS_TOKEN' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  const redirectOrigin = redirectUri ? new URL(redirectUri).origin : "No redirect URI configured";
  const baseOrigin = new URL(config.baseUrl.baseUrl).origin;

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
        <div className="page-header-actions inspector-quick-stats" aria-label="Inspector workflow summary">
          <span><strong>3</strong> verification modes</span>
          <span><strong>7</strong> MCP targets</span>
          <span><strong>OAuth</strong> ready</span>
        </div>
      </header>

      <div className="inspector-workbench">
        <section className="panel guide-panel inspector-command-card" aria-labelledby="local-inspector-title">
          <MonitorCog className="inspector-card-icon" aria-hidden="true" />
          <h2 id="local-inspector-title">Standalone Inspector UI</h2>
          <p className="section-note">
            Launch a separate local browser page. Use its Mock Server scenario to verify REST, MCP, Basic, OAuth bearer, token revocation, audit evidence, and reset guards through UI, or use generic mode for any MCP endpoint.
          </p>
          <div className="command-strip">
            <code>npm run inspector:ui</code>
            <CopyButton value="npm run inspector:ui" />
          </div>
        </section>

        <section className="panel guide-panel inspector-command-card" aria-labelledby="mock-inspector-title">
          <BadgeCheck className="inspector-card-icon" aria-hidden="true" />
          <h2 id="mock-inspector-title">Mock Server full smoke inspector</h2>
          <p className="section-note">
            This project-specific command verifies admin APIs, REST, MCP no-auth, Basic, OAuth bearer, token revocation, audit evidence, and reset guards.
          </p>
          <div className="command-strip">
            <code>npm run inspector:mock</code>
            <CopyButton value="npm run inspector:mock" />
          </div>
        </section>

        <section className="panel guide-panel inspector-span" aria-labelledby="tls-inspector-title">
          <h2 id="tls-inspector-title">HTTPS self-signed local flow</h2>
          <p className="section-note">
            Use app-level TLS only for local protocol/client tests. The Inspector allows self-signed certificates per run, without changing global TLS verification.
          </p>
          <div className="guide-list">
            <div>
              <span>Prove HTTPS startup</span>
              <div className="copy-row">
                <code>{config.examples.tls.smokeCommand}</code>
                <CopyButton value={config.examples.tls.smokeCommand} />
              </div>
            </div>
            <div>
              <span>Inspect HTTPS Mock Server</span>
              <div className="copy-row">
                <code>{config.examples.tls.inspectorCommand}</code>
                <CopyButton value={config.examples.tls.inspectorCommand} />
              </div>
            </div>
            <div>
              <span>Standalone UI checkbox</span>
              <code>Allow self-signed HTTPS for this run</code>
            </div>
          </div>
        </section>

        <section className="panel guide-panel inspector-span" aria-labelledby="upstream-title">
          <h2 id="upstream-title">Upstream MCP Inspector targets</h2>
          <p className="section-note">
            Start upstream Inspector with <code>npx @modelcontextprotocol/inspector</code>, then use these prefilled URLs or CLI commands. Basic and OAuth targets still need their Authorization header in Inspector.
          </p>
          <div className="guide-list">
            <div>
              <span>No-auth Streamable HTTP UI</span>
              <div className="copy-row">
                <code>{inspectorUrl("streamable-http", config.routes.mcp.noAuth)}</code>
                <CopyButton value={inspectorUrl("streamable-http", config.routes.mcp.noAuth)} />
              </div>
            </div>
            <div>
              <span>Basic Auth Streamable HTTP UI</span>
              <div className="copy-row">
                <code>{inspectorUrl("streamable-http", config.routes.mcp.basic)}</code>
                <CopyButton value={inspectorUrl("streamable-http", config.routes.mcp.basic)} />
              </div>
            </div>
            <div>
              <span>OAuth Bearer Streamable HTTP UI</span>
              <div className="copy-row">
                <code>{inspectorUrl("streamable-http", config.routes.mcp.oauth)}</code>
                <CopyButton value={inspectorUrl("streamable-http", config.routes.mcp.oauth)} />
              </div>
            </div>
            <div>
              <span>No-auth SSE UI</span>
              <div className="copy-row">
                <code>{inspectorUrl("sse", config.routes.mcp.sseNoAuth)}</code>
                <CopyButton value={inspectorUrl("sse", config.routes.mcp.sseNoAuth)} />
              </div>
            </div>
            <div>
              <span>Basic Authorization header</span>
              <div className="copy-row">
                <code>{basicAuthorizationHeader}</code>
                <CopyButton value={basicAuthorizationHeader} />
              </div>
            </div>
            <div>
              <span>No-auth Inspector CLI</span>
              <div className="copy-row">
                <code>{inspectorCliNone}</code>
                <CopyButton value={inspectorCliNone} />
              </div>
            </div>
            <div>
              <span>Basic Inspector CLI</span>
              <div className="copy-row">
                <code>{inspectorCliBasic}</code>
                <CopyButton value={inspectorCliBasic} />
              </div>
            </div>
            <div>
              <span>OAuth Inspector CLI</span>
              <div className="copy-row">
                <code>{inspectorCliOauth}</code>
                <CopyButton value={inspectorCliOauth} />
              </div>
            </div>
            <div>
              <span>SSE Inspector CLI</span>
              <div className="copy-row">
                <code>{inspectorCliSse}</code>
                <CopyButton value={inspectorCliSse} />
              </div>
            </div>
          </div>
        </section>

        <section className="panel guide-panel inspector-span" aria-labelledby="targets-title">
          <h2 id="targets-title">Current connection targets</h2>
          <div className="guide-list">
            {[
              ["MCP unified", config.routes.mcp.unified],
              ["MCP no auth", config.routes.mcp.noAuth],
              ["MCP Basic", config.routes.mcp.basic],
              ["MCP OAuth bearer", config.routes.mcp.oauth],
              ["SSE no auth", config.routes.mcp.sseNoAuth],
              ["SSE Basic", config.routes.mcp.sseBasic],
              ["SSE OAuth bearer", config.routes.mcp.sseOAuth],
              ["REST tools", config.routes.rest.tools],
              ["OAuth authorization metadata", config.routes.oauth.authorizationServerMetadata],
              ["OAuth protected resource metadata", config.routes.oauth.protectedResourceMetadata],
              ["JWKS", config.routes.oauth.jwksUri],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <div className="copy-row">
                  <code>{value}</code>
                  <CopyButton value={value} />
                </div>
              </div>
            ))}
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

        <section className="panel guide-panel inspector-span" aria-labelledby="oauth-code-title">
          <h2 id="oauth-code-title">OAuth authorization-code guide</h2>
          <p className="section-note">
            Use this when you want to verify the browser login and consent flow before pasting the Bearer token into Inspector or another MCP client.
          </p>
          {oauthClient && redirectUri ? (
            <div className="guide-list">
              <div>
                <span>1. Open authorization URL</span>
                <div className="copy-row">
                  <code>{authorizeUrl}</code>
                  <CopyButton value={authorizeUrl} label="Copy authorization URL" />
                </div>
              </div>
              <div>
                <span>2. Exchange returned code</span>
                <div className="copy-row">
                  <code>{tokenExchangeCurl}</code>
                  <CopyButton value={tokenExchangeCurl} label="Copy token exchange curl" />
                </div>
              </div>
              <div>
                <span>3. Call OAuth MCP route</span>
                <div className="copy-row">
                  <code>{oauthMcpCurl}</code>
                  <CopyButton value={oauthMcpCurl} label="Copy OAuth MCP curl" />
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-state">Create an OAuth client with at least one redirect URI before running the authorization-code flow.</p>
          )}
        </section>

        <section className="panel guide-panel" aria-labelledby="diagnostics-title">
          <h2 id="diagnostics-title">Base URL diagnostics</h2>
          <dl className="detail-grid">
            <div>
              <dt>Effective base URL</dt>
              <dd>{config.baseUrl.baseUrl}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{config.baseUrl.source}</dd>
            </div>
            <div>
              <dt>OAuth issuer</dt>
              <dd>{config.routes.oauth.issuer}</dd>
            </div>
            <div>
              <dt>Token endpoint</dt>
              <dd>{config.routes.oauth.tokenEndpoint}</dd>
            </div>
            <div>
              <dt>Selected client</dt>
              <dd>{oauthClient ? `${oauthClient.clientId} (${oauthClient.allowedEndpointIds.length} endpoints)` : "No OAuth client"}</dd>
            </div>
            <div>
              <dt>Redirect callback origin</dt>
              <dd>{redirectOrigin === baseOrigin ? "Same as base URL" : redirectOrigin}</dd>
            </div>
          </dl>
        </section>

        <section className="panel guide-panel inspector-span" aria-labelledby="examples-title">
          <h2 id="examples-title">Client and curl examples</h2>
          <pre className="json-panel" aria-label="MCP client config example">{JSON.stringify(config.examples.mcpClient, null, 2)}</pre>
          <pre className="json-panel" aria-label="REST and OAuth curl examples">{Object.values(config.examples.curl).join("\n\n")}</pre>
        </section>
      </div>
    </main>
  );
}
