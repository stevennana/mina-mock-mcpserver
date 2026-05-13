"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatDateTime } from "@/lib/date-format";
import type { OAuthIssuedTokenDetail, OAuthIssuedTokenListResult, OAuthIssuedTokenSummary } from "@/lib/oauth/types";

type LoadState = {
  status: "idle" | "loading" | "error" | "success";
  message: string;
};

type TokenFilters = {
  status: string;
  subject: string;
  client: string;
  grantType: string;
};

function formatDate(value: string | null) {
  return formatDateTime(value);
}

function statusClass(status: OAuthIssuedTokenSummary["status"]) {
  if (status === "active") return "status-pill enabled";
  if (status === "revoked") return "status-pill danger";
  return "status-pill";
}

function queryString(filters: TokenFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }
  return params.toString();
}

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="field-label-row">
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}

export function TokensManager({
  initialData,
  initialDetail = null,
  initialUpdatedAt,
  view = "catalog",
}: {
  initialData: OAuthIssuedTokenListResult;
  initialDetail?: OAuthIssuedTokenDetail | null;
  initialUpdatedAt: string;
  view?: "catalog" | "detail";
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [filters, setFilters] = useState({ status: "all", subject: "", client: "", grantType: "all" });
  const filtersRef = useRef<TokenFilters>(filters);
  const [selectedJti, setSelectedJti] = useState<string | null>(initialDetail?.jti ?? null);
  const [detail, setDetail] = useState<OAuthIssuedTokenDetail | null>(initialDetail);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle", message: "" });
  const [revokeState, setRevokeState] = useState<LoadState>({ status: "idle", message: "" });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialUpdatedAt);
  const refreshSequenceRef = useRef(0);
  const initialRefreshDoneRef = useRef(false);

  const selectedSummary = useMemo(
    () => listData.tokens.find((token) => token.jti === selectedJti) ?? null,
    [listData.tokens, selectedJti],
  );
  const activeDetail = detail?.jti === selectedJti ? detail : null;

  const refreshList = useCallback(
    async (nextFilters: TokenFilters = filtersRef.current, options: { silent?: boolean } = {}) => {
      const requestId = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = requestId;
      if (!options.silent) {
        setLoadState({ status: "loading", message: "Loading issued tokens." });
      }
      const search = queryString(nextFilters);
      const response = await fetch(`/api/oauth/tokens${search ? `?${search}` : ""}`);
      if (!response.ok) throw new Error("Unable to load issued tokens.");
      const payload = (await response.json()) as OAuthIssuedTokenListResult;
      if (refreshSequenceRef.current === requestId) {
        setListData(payload);
        setLastUpdatedAt(new Date().toISOString());
        if (!options.silent) {
          setLoadState({ status: "success", message: "Token list refreshed." });
        }
      }
      return payload;
    },
    [],
  );

  useEffect(() => {
    if (view !== "catalog" || initialRefreshDoneRef.current) return;
    initialRefreshDoneRef.current = true;
    void refreshList(filtersRef.current, { silent: true }).catch(() => {
      setLoadState({ status: "error", message: "Initial token refresh failed." });
    });
  }, [refreshList, view]);

  function updateFilters(nextFilters: TokenFilters) {
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }

  async function applyFilters() {
    setLoadState({ status: "loading", message: "Loading issued tokens." });
    try {
      await refreshList(filtersRef.current);
      router.refresh();
      setLoadState({ status: "success", message: "Filters applied." });
    } catch (error) {
      setLoadState({ status: "error", message: error instanceof Error ? error.message : "Token load failed." });
    }
  }

  async function selectToken(token: OAuthIssuedTokenSummary) {
    setSelectedJti(token.jti);
    setDetail(null);
    setRevokeState({ status: "idle", message: "" });
    setLoadState({ status: "loading", message: "Loading token detail." });
    try {
      const response = await fetch(`/api/oauth/tokens/${encodeURIComponent(token.jti)}`);
      if (!response.ok) throw new Error("Unable to load token detail.");
      setDetail(await response.json());
      setLoadState({ status: "success", message: "Token detail loaded." });
    } catch (error) {
      setLoadState({ status: "error", message: error instanceof Error ? error.message : "Token detail failed." });
    }
  }

  async function revokeSelected() {
    if (!selectedJti) return;
    setRevokeState({ status: "loading", message: "Revoking token." });
    try {
      const response = await fetch(`/api/oauth/tokens/${encodeURIComponent(selectedJti)}/revoke`, { method: "POST" });
      if (!response.ok) throw new Error("Token revoke failed.");
      setDetail(await response.json());
      await refreshList(filtersRef.current, { silent: true });
      router.refresh();
      setRevokeState({ status: "success", message: "Token revoked. Subsequent bearer calls now fail with 401." });
    } catch (error) {
      setRevokeState({ status: "error", message: error instanceof Error ? error.message : "Token revoke failed." });
    }
  }

  const displayDetail = activeDetail ?? selectedSummary;

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
      <section className="endpoint-list-panel" aria-labelledby="token-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="token-list-title">Tokens</h2>
            <p>{listData.tokens.length} shown, {listData.total} total issued</p>
            <p className="auto-refresh-note">Refreshes once when this page opens. Last updated {formatDateTime(lastUpdatedAt)}.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refreshList().catch((error) => {
              setLoadState({ status: "error", message: error instanceof Error ? error.message : "Token refresh failed." });
            })}
            disabled={loadState.status === "loading"}
          >
            {loadState.status === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="token-filter-grid">
          <label className="field-block">
            <FieldLabel label="Status" help="Filter tokens by whether they can still authenticate runtime calls." />
            <select
              className="text-input"
              value={filters.status}
              onChange={(event) => updateFilters({ ...filtersRef.current, status: event.target.value })}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>
          <label className="field-block">
            <FieldLabel label="Grant" help="OAuth flow that created the token: browser authorization_code or non-interactive client_credentials." />
            <select
              className="text-input"
              value={filters.grantType}
              onChange={(event) => updateFilters({ ...filtersRef.current, grantType: event.target.value })}
            >
              <option value="all">All grants</option>
              <option value="authorization_code">authorization_code</option>
              <option value="client_credentials">client_credentials</option>
            </select>
          </label>
          <label className="field-block">
            <FieldLabel label="Subject" help="User or client subject encoded into the token claims." />
            <input
              className="text-input"
              value={filters.subject}
              onChange={(event) => updateFilters({ ...filtersRef.current, subject: event.target.value })}
              placeholder="User ID, username, or client subject"
            />
          </label>
          <label className="field-block">
            <FieldLabel label="Client" help="OAuth client ID associated with the token." />
            <input
              className="text-input"
              value={filters.client}
              onChange={(event) => updateFilters({ ...filtersRef.current, client: event.target.value })}
              placeholder="Client ID"
            />
          </label>
        </div>
        <div className="console-actions filter-actions">
          <button className="primary-button" type="button" onClick={() => void applyFilters()}>
            Apply filters
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const next = { status: "all", subject: "", client: "", grantType: "all" };
              updateFilters(next);
              void refreshList(next).catch((error) => {
                setLoadState({ status: "error", message: error instanceof Error ? error.message : "Token refresh failed." });
              });
            }}
          >
            Clear
          </button>
        </div>
        {loadState.message ? <p className={`form-message ${loadState.status}`}>{loadState.message}</p> : null}

        <div className="endpoint-table-shell" aria-live="polite">
          <table className="endpoint-table token-table">
            <thead>
              <tr>
                <th>JTI</th>
                <th>Status</th>
                <th>Subject</th>
                <th>Client</th>
                <th>Grant</th>
                <th>Expires</th>
                <th>Endpoints</th>
              </tr>
            </thead>
            <tbody>
              {listData.tokens.map((token) => (
                <tr key={token.jti}>
                  <td>
                    <Link className="table-link" href={`/tokens/${encodeURIComponent(token.jti)}`}>
                      {token.jti}
                    </Link>
                    <span>{formatDate(token.issuedAt)}</span>
                  </td>
                  <td><span className={statusClass(token.status)}>{token.status}</span></td>
                  <td>
                    {token.subject}
                    {token.username ? <span>{token.username}</span> : null}
                  </td>
                  <td>{token.clientId}</td>
                  <td>{token.grantType}</td>
                  <td>{formatDate(token.expiresAt)}</td>
                  <td>{token.endpointPermissionCount}</td>
                </tr>
              ))}
              {listData.tokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">No issued tokens match these filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {view === "detail" ? (
      <section className="endpoint-editor-panel" aria-labelledby="token-detail-title">
        <div className="section-heading-row">
          <div>
            <h2 id="token-detail-title">Token detail</h2>
            <p>Raw access token values are not stored or redisplayed here.</p>
          </div>
          {displayDetail ? <span className={statusClass(displayDetail.status)}>{displayDetail.status}</span> : null}
        </div>

        {displayDetail ? (
          <>
            <div className="editor-section">
              <h3>Summary</h3>
              <dl className="detail-grid">
                <div><dt>JTI</dt><dd>{displayDetail.jti}</dd></div>
                <div><dt>Subject</dt><dd>{displayDetail.subject}</dd></div>
                <div><dt>Client</dt><dd>{displayDetail.clientId}</dd></div>
                <div><dt>Grant</dt><dd>{displayDetail.grantType}</dd></div>
                <div><dt>Issued</dt><dd>{formatDate(displayDetail.issuedAt)}</dd></div>
                <div><dt>Expires</dt><dd>{formatDate(displayDetail.expiresAt)}</dd></div>
                <div><dt>Revoked</dt><dd>{formatDate(displayDetail.revokedAt)}</dd></div>
                <div><dt>Endpoint count</dt><dd>{displayDetail.endpointPermissionCount}</dd></div>
                <div><dt>Resource count</dt><dd>{displayDetail.resourcePermissionCount}</dd></div>
                <div><dt>Prompt count</dt><dd>{displayDetail.promptPermissionCount}</dd></div>
              </dl>
            </div>

            <div className="editor-section">
              <h3>Claims</h3>
              {activeDetail ? (
                <pre className="json-panel">{JSON.stringify(activeDetail.claims, null, 2)}</pre>
              ) : (
                <button className="secondary-button" type="button" onClick={() => selectedSummary && void selectToken(selectedSummary)}>
                  Load claims
                </button>
              )}
            </div>

            <div className="editor-section">
              <h3>tool permissions</h3>
              {activeDetail ? (
                <div className="permission-list">
                  {activeDetail.endpoint_permissions.map((endpoint) => (
                    <div key={endpoint.id}>
                      <strong>{endpoint.id}</strong>
                      <span>{endpoint.name ?? "Missing endpoint"}{endpoint.title ? ` ${endpoint.title}` : ""}</span>
                      <span className={endpoint.enabled === false ? "status-pill danger" : "status-pill enabled"}>
                        {endpoint.enabled === false ? "Disabled" : endpoint.enabled === null ? "Historical" : "Enabled"}
                      </span>
                    </div>
                  ))}
                  {activeDetail.endpoint_permissions.length === 0 ? <p className="section-note">No endpoint permissions stored.</p> : null}
                </div>
              ) : (
                <p className="section-note">Load claims to inspect endpoint permission metadata.</p>
              )}
            </div>

            <div className="editor-section">
              <h3>resource_permissions</h3>
              {activeDetail ? (
                <div className="permission-list">
                  {activeDetail.resource_permissions.map((resource) => (
                    <div key={resource.id}>
                      <strong>{resource.id}</strong>
                      <span>{resource.name ?? "Missing resource"}{resource.title ? ` ${resource.title}` : ""}{resource.uri ? ` ${resource.uri}` : ""}</span>
                      <span className={resource.enabled === false ? "status-pill danger" : "status-pill enabled"}>
                        {resource.enabled === false ? "Disabled" : resource.enabled === null ? "Historical" : "Enabled"}
                      </span>
                    </div>
                  ))}
                  {activeDetail.resource_permissions.length === 0 ? <p className="section-note">No resource permissions stored.</p> : null}
                </div>
              ) : (
                <p className="section-note">Load claims to inspect resource permission metadata.</p>
              )}
            </div>

            <div className="editor-section">
              <h3>prompt_permissions</h3>
              {activeDetail ? (
                <div className="permission-list">
                  {activeDetail.prompt_permissions.map((prompt) => (
                    <div key={prompt.id}>
                      <strong>{prompt.id}</strong>
                      <span>{prompt.name ?? "Missing prompt"}{prompt.title ? ` ${prompt.title}` : ""}</span>
                      <span className={prompt.enabled === false ? "status-pill danger" : "status-pill enabled"}>
                        {prompt.enabled === false ? "Disabled" : prompt.enabled === null ? "Historical" : "Enabled"}
                      </span>
                    </div>
                  ))}
                  {activeDetail.prompt_permissions.length === 0 ? <p className="section-note">No prompt permissions stored.</p> : null}
                </div>
              ) : (
                <p className="section-note">Load claims to inspect prompt permission metadata.</p>
              )}
            </div>

            <div className="editor-section">
              <h3>Actions</h3>
              <div className="console-actions">
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void revokeSelected()}
                  disabled={displayDetail.status === "revoked" || revokeState.status === "loading"}
                >
                  Revoke token
                </button>
              </div>
              {revokeState.message ? <p className={`form-message ${revokeState.status}`}>{revokeState.message}</p> : null}
            </div>
          </>
        ) : (
          <p className="section-note">Issue an OAuth access token, then return here to inspect it.</p>
        )}
      </section>
      ) : null}
    </div>
  );
}
