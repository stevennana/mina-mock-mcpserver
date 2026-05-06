"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CopyButton } from "@/app/copy-button";

type PublicOperatorConfig = {
  baseUrl: {
    baseUrl: string;
    source: string;
    databaseOverride: string | null;
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
    mcp: { unified: string; noAuth: string; basic: string; oauth: string };
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

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
};

function sourceLabel(source: string) {
  return source.replace(/_/g, " ");
}

export function ConfigManager({ initialConfig }: { initialConfig: PublicOperatorConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [baseUrl, setBaseUrl] = useState(initialConfig.baseUrl.databaseOverride ?? "");
  const [rootPassword, setRootPassword] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });

  const healthCounts = config.health.database.counts;
  const routeRows = useMemo(
    () => [
      ["MCP unified", config.routes.mcp.unified],
      ["MCP no auth", config.routes.mcp.noAuth],
      ["MCP Basic", config.routes.mcp.basic],
      ["MCP OAuth bearer", config.routes.mcp.oauth],
      ["REST tools", config.routes.rest.tools],
      ["REST call", config.routes.rest.callTemplate],
      ["OAuth protected resource", config.routes.oauth.protectedResourceMetadata],
      ["OAuth authorization server", config.routes.oauth.authorizationServerMetadata],
      ["OpenID configuration", config.routes.oauth.openidConfiguration],
      ["OAuth JWKS", config.routes.oauth.jwksUri],
    ],
    [config],
  );

  async function submitConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ status: "saving", message: "Saving base URL override.", fieldErrors: {} });
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl, rootPassword }),
    });
    const payload = await response.json();
    setRootPassword("");

    if (!response.ok) {
      setSaveState({
        status: "error",
        message: typeof payload.message === "string" ? payload.message : "Config save failed.",
        fieldErrors: payload.fieldErrors ?? {},
      });
      return;
    }

    setConfig(payload.config);
    setBaseUrl(payload.config.baseUrl.databaseOverride ?? "");
    setSaveState({ status: "success", message: "Base URL override saved.", fieldErrors: {} });
  }

  return (
    <div className="config-stack">
      <section className="warning-callout" role="note">
        {config.publicAdminWarning}
      </section>

      <section className="summary-strip" aria-label="Operator health summary">
        <span>
          Runtime
          <strong>{config.health.runtime.runtimeState}</strong>
        </span>
        <span>
          Database
          <strong>{config.health.database.status}</strong>
        </span>
        <span>
          Log level
          <strong>{config.health.runtime.logLevel}</strong>
        </span>
      </section>

      <section className="panel guide-panel" aria-labelledby="base-url-title">
        <div className="section-heading-row">
          <div>
            <h2 id="base-url-title">Base URL</h2>
            <p>Effective source: {sourceLabel(config.baseUrl.source)}</p>
          </div>
          <code className="inline-code">{config.baseUrl.baseUrl}</code>
        </div>
        {config.baseUrl.appBaseUrl ? (
          <p className="field-hint">APP_BASE_URL is set, so it takes precedence over the saved database override.</p>
        ) : null}
        <form className="form-grid config-form" onSubmit={(event) => void submitConfig(event)}>
          {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}
          <label className="field-block wide">
            <span>Database base URL override</span>
            <input
              className="text-input"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://mock.example.com"
              aria-describedby="base-url-hint"
            />
            <p className="field-hint" id="base-url-hint">Leave blank and save to clear the database override.</p>
            {saveState.fieldErrors.baseUrl ? <p className="field-error">{saveState.fieldErrors.baseUrl}</p> : null}
          </label>
          <label className="field-block">
            <span>Root password</span>
            <input
              className="text-input"
              type="password"
              value={rootPassword}
              onChange={(event) => setRootPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="field-block">
            <span>Action</span>
            <button className="primary-button" type="submit" disabled={saveState.status === "saving"}>
              Save config
            </button>
          </div>
        </form>
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
              <code>{config.examples.logging.command}</code>
              <CopyButton value={config.examples.logging.command} />
            </dd>
          </div>
          <div>
            <dt>Directory</dt>
            <dd>{config.examples.logging.directory}</dd>
          </div>
          <div>
            <dt>Levels</dt>
            <dd>{config.examples.logging.levels.join(", ")}</dd>
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
          <strong className={config.tls.enabled ? "status-pill enabled" : "status-pill"}>
            {config.tls.enabled ? "app HTTPS configured" : "HTTP or proxy TLS"}
          </strong>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Generate localhost cert</dt>
            <dd className="copy-row">
              <code>{config.examples.tls.devCertCommand}</code>
              <CopyButton value={config.examples.tls.devCertCommand} />
            </dd>
          </div>
          <div>
            <dt>Start HTTPS</dt>
            <dd className="copy-row">
              <code>{config.examples.tls.command}</code>
              <CopyButton value={config.examples.tls.command} />
            </dd>
          </div>
          <div>
            <dt>Start HTTPS with logs</dt>
            <dd className="copy-row">
              <code>{config.examples.tls.loggedCommand}</code>
              <CopyButton value={config.examples.tls.loggedCommand} />
            </dd>
          </div>
          <div>
            <dt>TLS smoke</dt>
            <dd className="copy-row">
              <code>{config.examples.tls.smokeCommand}</code>
              <CopyButton value={config.examples.tls.smokeCommand} />
            </dd>
          </div>
          <div>
            <dt>HTTPS inspector</dt>
            <dd className="copy-row">
              <code>{config.examples.tls.inspectorCommand}</code>
              <CopyButton value={config.examples.tls.inspectorCommand} />
            </dd>
          </div>
          <div>
            <dt>Configured inputs</dt>
            <dd>
              cert {config.tls.certFileConfigured ? "set" : "missing"}, key {config.tls.keyFileConfigured ? "set" : "missing"}
              {config.tls.caFileConfigured ? ", CA set" : ""}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
