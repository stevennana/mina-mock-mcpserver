"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { OAuthClientListResult, OAuthClientSummary } from "@/lib/oauth/types";

type FormState = {
  id?: string;
  clientId: string;
  displayName: string;
  enabled: boolean;
  builtIn: boolean;
  redirectUrisText: string;
  clientCredentialsTtlSeconds: number;
  allowedEndpointIds: string[];
};

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "deleting" | "error" | "success";
  message: string;
};

const DEFAULT_TTL_SECONDS = 3600;

const blankClient: FormState = {
  clientId: "",
  displayName: "",
  enabled: true,
  builtIn: false,
  redirectUrisText: "http://localhost:3000/oauth/callback",
  clientCredentialsTtlSeconds: DEFAULT_TTL_SECONDS,
  allowedEndpointIds: [],
};

function clientToForm(client: OAuthClientSummary): FormState {
  return {
    id: client.id,
    clientId: client.clientId,
    displayName: client.displayName,
    enabled: client.enabled,
    builtIn: client.builtIn,
    redirectUrisText: client.redirectUris.join("\n"),
    clientCredentialsTtlSeconds: client.clientCredentialsTtlSeconds,
    allowedEndpointIds: client.allowedEndpointIds,
  };
}

function formatTtl(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hr`;
  return `${seconds} sec`;
}

function redirectUrisFromText(value: string) {
  return value.split(/\r?\n/).map((uri) => uri.trim()).filter(Boolean);
}

function errorFor(fieldErrors: Record<string, string>, field: string) {
  return fieldErrors[field] ? <p className="field-error">{fieldErrors[field]}</p> : null;
}

export function OAuthClientsManager({ initialData }: { initialData: OAuthClientListResult }) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(blankClient);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issuedSecret, setIssuedSecret] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });

  const selectedClient = useMemo(
    () => listData.clients.find((client) => client.id === selectedId) ?? null,
    [listData.clients, selectedId],
  );
  const locked = Boolean(selectedClient?.builtIn || form.builtIn);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.clients;
    return listData.clients.filter(
      (client) =>
        client.clientId.toLowerCase().includes(normalized) ||
        client.displayName.toLowerCase().includes(normalized),
    );
  }, [listData.clients, query]);

  async function refreshList() {
    const response = await fetch("/api/oauth-clients");
    if (!response.ok) throw new Error("Unable to load OAuth clients.");
    setListData(await response.json());
  }

  function startCreate() {
    setForm(blankClient);
    setSelectedId(null);
    setIssuedSecret("");
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
  }

  function selectClient(client: OAuthClientSummary) {
    setForm(clientToForm(client));
    setSelectedId(client.id);
    setIssuedSecret("");
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
  }

  function toggleEndpoint(endpointId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      allowedEndpointIds: checked
        ? Array.from(new Set([...current.allowedEndpointIds, endpointId]))
        : current.allowedEndpointIds.filter((id) => id !== endpointId),
    }));
  }

  async function saveClient() {
    setSaveState({ status: "saving", message: "Saving OAuth client.", fieldErrors: {} });
    setIssuedSecret("");
    const target = selectedId ? `/api/oauth-clients/${selectedId}` : "/api/oauth-clients";
    const method = selectedId ? "PATCH" : "POST";
    const body = selectedId
      ? {
          displayName: form.displayName,
          enabled: form.enabled,
          redirectUris: redirectUrisFromText(form.redirectUrisText),
          clientCredentialsTtlSeconds: form.clientCredentialsTtlSeconds,
          allowedEndpointIds: form.allowedEndpointIds,
        }
      : {
          clientId: form.clientId,
          displayName: form.displayName,
          enabled: form.enabled,
          redirectUris: redirectUrisFromText(form.redirectUrisText),
          clientCredentialsTtlSeconds: form.clientCredentialsTtlSeconds,
          allowedEndpointIds: form.allowedEndpointIds,
        };

    try {
      const response = await fetch(target, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Fix the highlighted fields and save again.",
          fieldErrors: payload.fieldErrors ?? {},
        });
        return;
      }

      const client = payload.client as OAuthClientSummary;
      setForm(clientToForm(client));
      setSelectedId(client.id);
      setIssuedSecret(typeof payload.clientSecret === "string" ? payload.clientSecret : "");
      await refreshList();
      router.refresh();
      setSaveState({
        status: "success",
        message: payload.clientSecret ? "OAuth client saved. Copy the generated secret now." : "OAuth client saved.",
        fieldErrors: {},
      });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function regenerateSecret() {
    if (!selectedId) return;
    setSaveState({ status: "saving", message: "Generating new client secret.", fieldErrors: {} });
    setIssuedSecret("");
    try {
      const response = await fetch(`/api/oauth-clients/${selectedId}/secret`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Secret generation failed.",
          fieldErrors: payload.fieldErrors ?? {},
        });
        return;
      }
      const client = payload.client as OAuthClientSummary;
      setForm(clientToForm(client));
      setIssuedSecret(payload.clientSecret);
      await refreshList();
      router.refresh();
      setSaveState({ status: "success", message: "New client secret generated. Copy it now.", fieldErrors: {} });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Secret generation failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedClient() {
    if (!selectedId) return;

    setDeleteState({ status: "deleting", message: "Deleting OAuth client." });
    try {
      const response = await fetch(`/api/oauth-clients/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "OAuth client delete failed.",
        });
        return;
      }

      setForm(blankClient);
      setSelectedId(null);
      setIssuedSecret("");
      await refreshList();
      router.refresh();
      setSaveState({ status: "idle", message: "", fieldErrors: {} });
      setDeleteState({ status: "success", message: "OAuth client deleted." });
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "OAuth client delete failed." });
    }
  }

  return (
    <div className="endpoint-layout">
      <section className="endpoint-list-panel" aria-labelledby="oauth-client-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-client-list-title">Clients</h2>
            <p>{listData.total} OAuth clients, {listData.enabled} enabled</p>
          </div>
          <button className="primary-button" type="button" onClick={startCreate}>
            New OAuth client
          </button>
        </div>

        <label className="field-label" htmlFor="oauth-client-search">Search</label>
        <input
          id="oauth-client-search"
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Client ID or display name"
        />

        <div className="endpoint-table-shell" aria-live="polite">
          <table className="endpoint-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>Lock</th>
                <th>Allowed</th>
                <th>TTL</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <button className="table-link" type="button" onClick={() => selectClient(client)}>
                      {client.clientId}
                    </button>
                    <span>{client.displayName || "No display name"}</span>
                  </td>
                  <td>
                    <span className={client.enabled ? "status-pill enabled" : "status-pill"}>{client.enabled ? "Enabled" : "Disabled"}</span>
                  </td>
                  <td>
                    <span className={client.builtIn ? "status-pill danger" : "status-pill"}>
                      {client.builtIn ? "Locked" : "Editable"}
                    </span>
                  </td>
                  <td>{client.allowedEndpointIds.length}</td>
                  <td>{formatTtl(client.clientCredentialsTtlSeconds)}</td>
                </tr>
              ))}
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">No OAuth clients match this search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="endpoint-editor-panel" aria-labelledby="oauth-client-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-client-editor-title">{selectedId ? "Edit OAuth client" : "Create OAuth client"}</h2>
            <p>{locked ? "Built-in default/default client is permanent and locked." : "Client secrets are shown only when generated."}</p>
          </div>
          {locked ? <span className="status-pill danger">Locked fixture</span> : null}
        </div>

        {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

        {issuedSecret ? (
          <div className="secret-callout" aria-label="Generated client secret">
            <div>
              <strong>Generated client secret</strong>
              <code>{issuedSecret}</code>
            </div>
            <button className="secondary-button" type="button" onClick={() => void navigator.clipboard?.writeText(issuedSecret)}>
              Copy
            </button>
          </div>
        ) : null}

        <div className="editor-section">
          <h3>Client</h3>
          <div className="form-grid">
            <label className="field-block">
              <span>Client ID</span>
              <input
                className="text-input"
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                disabled={Boolean(selectedId)}
              />
              {errorFor(saveState.fieldErrors, "clientId")}
            </label>
            <label className="field-block">
              <span>Display name</span>
              <input
                className="text-input"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                disabled={locked}
              />
              {errorFor(saveState.fieldErrors, "displayName")}
            </label>
            <label className="field-block">
              <span>Client credentials TTL</span>
              <select
                className="text-input"
                value={form.clientCredentialsTtlSeconds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, clientCredentialsTtlSeconds: Number(event.target.value) }))
                }
                disabled={locked}
              >
                {listData.ttlPresets.map((preset) => (
                  <option key={preset.seconds} value={preset.seconds}>{preset.label}</option>
                ))}
              </select>
              {errorFor(saveState.fieldErrors, "clientCredentialsTtlSeconds")}
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={locked}
              />
              Enabled for OAuth client validation
            </label>
            <label className="field-block wide">
              <span>Redirect URIs</span>
              <textarea
                className="text-area short"
                value={form.redirectUrisText}
                onChange={(event) => setForm((current) => ({ ...current, redirectUrisText: event.target.value }))}
                disabled={locked}
              />
              <p className="field-hint">One absolute http or https URI per line.</p>
              {errorFor(saveState.fieldErrors, "redirectUris")}
            </label>
          </div>
        </div>

        <div className="editor-section">
          <h3>Allowed endpoints</h3>
          <div className="checkbox-grid">
            {listData.endpointOptions.map((endpoint) => (
              <label className="compact-check endpoint-check" key={endpoint.id}>
                <input
                  type="checkbox"
                  checked={form.allowedEndpointIds.includes(endpoint.id)}
                  onChange={(event) => toggleEndpoint(endpoint.id, event.target.checked)}
                  disabled={locked}
                />
                <span>
                  <strong>{endpoint.name}</strong>
                  {endpoint.title ? ` ${endpoint.title}` : ""}
                  {!endpoint.enabled ? " Disabled" : ""}
                </span>
              </label>
            ))}
          </div>
          {errorFor(saveState.fieldErrors, "allowedEndpointIds")}
        </div>

        <div className="editor-section">
          <h3>Actions</h3>
          <div className="console-actions">
            <button className="primary-button" type="button" onClick={() => void saveClient()} disabled={locked || saveState.status === "saving"}>
              Save
            </button>
            <button className="secondary-button" type="button" onClick={startCreate}>
              Clear
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void regenerateSecret()}
              disabled={!selectedId || locked || saveState.status === "saving"}
            >
              Regenerate secret
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => void deleteSelectedClient()}
              disabled={!selectedId || locked || deleteState.status === "deleting"}
            >
              Delete
            </button>
          </div>
          {deleteState.message ? <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p> : null}
          <p className="section-note">
            The built-in default/default client is visible for later OAuth runtime testing but cannot be changed, disabled, or deleted here.
          </p>
        </div>
      </section>
    </div>
  );
}
