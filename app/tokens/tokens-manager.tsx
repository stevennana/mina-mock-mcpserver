"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/date-format";
import type { OAuthIssuedTokenDetail, OAuthIssuedTokenListResult, OAuthIssuedTokenSummary } from "@/lib/oauth/types";

type LoadState = {
  status: "idle" | "loading" | "error" | "success";
  message: string;
};

function formatDate(value: string | null) {
  return formatDateTime(value);
}

function statusClass(status: OAuthIssuedTokenSummary["status"]) {
  if (status === "active") return "status-pill enabled";
  if (status === "revoked") return "status-pill danger";
  return "status-pill";
}

function queryString(filters: { status: string; subject: string; client: string; grantType: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }
  return params.toString();
}

export function TokensManager({ initialData }: { initialData: OAuthIssuedTokenListResult }) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [filters, setFilters] = useState({ status: "all", subject: "", client: "", grantType: "all" });
  const [selectedJti, setSelectedJti] = useState<string | null>(initialData.tokens[0]?.jti ?? null);
  const [detail, setDetail] = useState<OAuthIssuedTokenDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle", message: "" });
  const [revokeState, setRevokeState] = useState<LoadState>({ status: "idle", message: "" });

  const selectedSummary = useMemo(
    () => listData.tokens.find((token) => token.jti === selectedJti) ?? null,
    [listData.tokens, selectedJti],
  );
  const activeDetail = detail?.jti === selectedJti ? detail : null;

  async function refreshList(nextFilters = filters) {
    const search = queryString(nextFilters);
    const response = await fetch(`/api/oauth/tokens${search ? `?${search}` : ""}`);
    if (!response.ok) throw new Error("Unable to load issued tokens.");
    const payload = (await response.json()) as OAuthIssuedTokenListResult;
    setListData(payload);
    if (selectedJti && !payload.tokens.some((token) => token.jti === selectedJti)) {
      setSelectedJti(payload.tokens[0]?.jti ?? null);
      setDetail(null);
    }
    return payload;
  }

  async function applyFilters() {
    setLoadState({ status: "loading", message: "Loading issued tokens." });
    try {
      await refreshList();
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
      await refreshList();
      router.refresh();
      setRevokeState({ status: "success", message: "Token revoked. Subsequent bearer calls now fail with 401." });
    } catch (error) {
      setRevokeState({ status: "error", message: error instanceof Error ? error.message : "Token revoke failed." });
    }
  }

  const displayDetail = activeDetail ?? selectedSummary;

  return (
    <div className="endpoint-layout">
      <section className="endpoint-list-panel" aria-labelledby="token-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="token-list-title">Tokens</h2>
            <p>{listData.tokens.length} shown, {listData.total} total issued</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void refreshList()}>
            Refresh
          </button>
        </div>

        <div className="token-filter-grid">
          <label className="field-block">
            <span>Status</span>
            <select
              className="text-input"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>
          <label className="field-block">
            <span>Grant</span>
            <select
              className="text-input"
              value={filters.grantType}
              onChange={(event) => setFilters((current) => ({ ...current, grantType: event.target.value }))}
            >
              <option value="all">All grants</option>
              <option value="authorization_code">authorization_code</option>
              <option value="client_credentials">client_credentials</option>
            </select>
          </label>
          <label className="field-block">
            <span>Subject</span>
            <input
              className="text-input"
              value={filters.subject}
              onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
              placeholder="User ID, username, or client subject"
            />
          </label>
          <label className="field-block">
            <span>Client</span>
            <input
              className="text-input"
              value={filters.client}
              onChange={(event) => setFilters((current) => ({ ...current, client: event.target.value }))}
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
              setFilters(next);
              void refreshList(next);
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
                    <button className="table-link" type="button" onClick={() => void selectToken(token)}>
                      {token.jti}
                    </button>
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
              <h3>endpoint_permissions</h3>
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
    </div>
  );
}
