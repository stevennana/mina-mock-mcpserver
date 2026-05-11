"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CopyButton } from "@/app/copy-button";

type PublicOperatorConfig = {
  baseUrl: {
    baseUrl: string;
    source: string;
    appBaseUrl: string | null;
  };
  tls: {
    enabled: boolean;
    mode: string;
    recommendedPublicMode: string;
    certFileConfigured: boolean;
    keyFileConfigured: boolean;
    caFileConfigured: boolean;
    command: string;
    loggedCommand: string;
  };
  health: {
    status: string;
    runtime: { runtimeState: string; logLevel: string };
    database: {
      status: string;
      counts: {
        endpoints: number;
        enabledEndpoints: number;
        basicUsers: number;
        oauthUsers: number;
        oauthClients: number;
        issuedTokens: number;
      } | null;
    };
  };
  publicAdminWarning: string;
  routes: {
    ui: string;
    health: string;
    publicConfig: string;
    mcp: {
      unified: string;
      noAuth: string;
      basic: string;
      oauth: string;
      sseUnified: string;
      sseNoAuth: string;
      sseBasic: string;
      sseOAuth: string;
    };
    rest: { tools: string; callTemplate: string };
    oauth: {
      issuer: string;
      authorizationEndpoint: string;
      tokenEndpoint: string;
      jwksUri: string;
      protectedResourceMetadata: string;
      authorizationServerMetadata: string;
      openidConfiguration: string;
    };
  };
  examples: {
    mcpClient: Record<string, unknown>;
    curl: Record<string, string>;
    logging: { command: string; levels: string[]; directory: string };
    tls: { devCertCommand: string; command: string; loggedCommand: string; smokeCommand: string; inspectorCommand: string };
  };
};

function sourceLabel(source: string) {
  return source.replace(/_/g, " ");
}

export function ConfigManager({ initialConfig }: { initialConfig: PublicOperatorConfig }) {
  const healthCounts = initialConfig.health.database.counts;
  const routeRows = useMemo(
    () => [
      ["MCP unified", initialConfig.routes.mcp.unified],
      ["MCP no auth", initialConfig.routes.mcp.noAuth],
      ["MCP Basic", initialConfig.routes.mcp.basic],
      ["MCP OAuth bearer", initialConfig.routes.mcp.oauth],
      ["SSE no auth", initialConfig.routes.mcp.sseNoAuth],
      ["SSE Basic", initialConfig.routes.mcp.sseBasic],
      ["SSE OAuth bearer", initialConfig.routes.mcp.sseOAuth],
      ["REST tools", initialConfig.routes.rest.tools],
      ["REST call", initialConfig.routes.rest.callTemplate],
      ["OAuth protected resource", initialConfig.routes.oauth.protectedResourceMetadata],
      ["OAuth authorization server", initialConfig.routes.oauth.authorizationServerMetadata],
      ["OpenID configuration", initialConfig.routes.oauth.openidConfiguration],
      ["OAuth JWKS", initialConfig.routes.oauth.jwksUri],
    ],
    [initialConfig],
  );

  return (
    <div className="config-stack">
      <section className="warning-callout" role="note">
        {initialConfig.publicAdminWarning}
      </section>

      <section className="summary-strip" aria-label="Operator health summary">
        <span>
          Runtime
          <strong>{initialConfig.health.runtime.runtimeState}</strong>
        </span>
        <span>
          Database
          <strong>{initialConfig.health.database.status}</strong>
        </span>
        <span>
          Log level
          <strong>{initialConfig.health.runtime.logLevel}</strong>
        </span>
      </section>

      <section className="panel guide-panel" aria-labelledby="base-url-title">
        <div className="section-heading-row">
          <div>
            <h2 id="base-url-title">Base URL</h2>
            <p>Effective source: {sourceLabel(initialConfig.baseUrl.source)}</p>
          </div>
          <code className="inline-code">{initialConfig.baseUrl.baseUrl}</code>
        </div>
        {initialConfig.baseUrl.appBaseUrl ? (
          <p className="field-hint">APP_BASE_URL is set and controls generated MCP, REST, OAuth discovery, and curl URLs.</p>
        ) : (
          <p className="field-hint">
            Set APP_BASE_URL before startup for a fixed public origin. Without it, this page uses trusted forwarded headers, Host,
            then the local fallback.
          </p>
        )}
      </section>

      <section className="panel guide-panel" aria-labelledby="routes-title">
        <h2 id="routes-title">Connection URLs</h2>
        <div className="guide-list">
          {routeRows.map(([label, url]) => (
            <div key={label}>
              <span>{label}</span>
              <div className="copy-row">
                <code>{url}</code>
                <CopyButton value={url} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel guide-panel" aria-labelledby="verify-title">
        <div className="section-heading-row">
          <div>
            <h2 id="verify-title">Verification hub</h2>
            <p>Client config, curl examples, and OAuth preparation steps now live in the focused Inspector flow.</p>
          </div>
          <Link className="secondary-button button-link" href="/inspector">
            Open Inspector
          </Link>
        </div>
      </section>

      <section className="panel guide-panel" aria-labelledby="logs-title">
        <h2 id="logs-title">Operator logs</h2>
        <dl className="detail-grid">
          <div>
            <dt>Command</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.logging.command}</code>
              <CopyButton value={initialConfig.examples.logging.command} />
            </dd>
          </div>
          <div>
            <dt>Directory</dt>
            <dd>{initialConfig.examples.logging.directory}</dd>
          </div>
          <div>
            <dt>Levels</dt>
            <dd>{initialConfig.examples.logging.levels.join(", ")}</dd>
          </div>
          {healthCounts ? (
            <div>
              <dt>Runtime counts</dt>
              <dd>
                {healthCounts.enabledEndpoints}/{healthCounts.endpoints} tools enabled, {healthCounts.oauthClients} OAuth clients,{" "}
                {healthCounts.issuedTokens} issued tokens
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="panel guide-panel" aria-labelledby="tls-title">
        <div className="section-heading-row">
          <div>
            <h2 id="tls-title">TLS for local tests</h2>
            <p>Nginx TLS termination is still recommended for public deployments. Built-in HTTPS is for local client tests.</p>
          </div>
          <strong className={initialConfig.tls.enabled ? "status-pill enabled" : "status-pill"}>
            {initialConfig.tls.enabled ? "app HTTPS configured" : "HTTP or proxy TLS"}
          </strong>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Generate localhost cert</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.tls.devCertCommand}</code>
              <CopyButton value={initialConfig.examples.tls.devCertCommand} />
            </dd>
          </div>
          <div>
            <dt>Start HTTPS</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.tls.command}</code>
              <CopyButton value={initialConfig.examples.tls.command} />
            </dd>
          </div>
          <div>
            <dt>Start HTTPS with logs</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.tls.loggedCommand}</code>
              <CopyButton value={initialConfig.examples.tls.loggedCommand} />
            </dd>
          </div>
          <div>
            <dt>TLS smoke</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.tls.smokeCommand}</code>
              <CopyButton value={initialConfig.examples.tls.smokeCommand} />
            </dd>
          </div>
          <div>
            <dt>HTTPS inspector</dt>
            <dd className="copy-row">
              <code>{initialConfig.examples.tls.inspectorCommand}</code>
              <CopyButton value={initialConfig.examples.tls.inspectorCommand} />
            </dd>
          </div>
          <div>
            <dt>Configured inputs</dt>
            <dd>
              cert {initialConfig.tls.certFileConfigured ? "set" : "missing"}, key{" "}
              {initialConfig.tls.keyFileConfigured ? "set" : "missing"}
              {initialConfig.tls.caFileConfigured ? ", CA set" : ""}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
