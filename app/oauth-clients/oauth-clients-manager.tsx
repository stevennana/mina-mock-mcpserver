"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HelpTooltip } from "@/app/help-tooltip";
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
  allowedResourceIds: string[];
  allowedPromptIds: string[];
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
  allowedResourceIds: [],
  allowedPromptIds: [],
};

const OAUTH_CLIENT_FLASH_KEY = "mcp-mock-oauth-client-flash";

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
    allowedResourceIds: client.allowedResourceIds,
    allowedPromptIds: client.allowedPromptIds,
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

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="field-label-row">
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}

type OAuthClientView = "catalog" | "detail" | "create";

export function OAuthClientsManager({
  initialData,
  view = "catalog",
  initialSelectedId = null,
}: {
  initialData: OAuthClientListResult;
  view?: OAuthClientView;
  initialSelectedId?: string | null;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const initialClient = initialSelectedId ? initialData.clients.find((client) => client.id === initialSelectedId) ?? null : null;
  const [form, setForm] = useState<FormState>(initialClient ? clientToForm(initialClient) : blankClient);
  const [selectedId, setSelectedId] = useState<string | null>(initialClient?.id ?? null);
  const [issuedSecret, setIssuedSecret] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });

  useEffect(() => {
    if (!selectedId) return;
    const rawFlash = window.sessionStorage.getItem(OAUTH_CLIENT_FLASH_KEY);
    if (!rawFlash) return;
    try {
      const flash = JSON.parse(rawFlash) as { id?: string; message?: string; clientSecret?: string };
      if (flash.id === selectedId && typeof flash.message === "string") {
        setSaveState({ status: "success", message: flash.message, fieldErrors: {} });
        setIssuedSecret(typeof flash.clientSecret === "string" ? flash.clientSecret : "");
        window.sessionStorage.removeItem(OAUTH_CLIENT_FLASH_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(OAUTH_CLIENT_FLASH_KEY);
    }
  }, [selectedId]);

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

  function toggleEndpoint(endpointId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      allowedEndpointIds: checked
        ? Array.from(new Set([...current.allowedEndpointIds, endpointId]))
        : current.allowedEndpointIds.filter((id) => id !== endpointId),
    }));
  }

  function toggleResource(resourceId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      allowedResourceIds: checked
        ? Array.from(new Set([...current.allowedResourceIds, resourceId]))
        : current.allowedResourceIds.filter((id) => id !== resourceId),
    }));
  }

  function togglePrompt(promptId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      allowedPromptIds: checked
        ? Array.from(new Set([...current.allowedPromptIds, promptId]))
        : current.allowedPromptIds.filter((id) => id !== promptId),
    }));
  }

  async function saveClient() {
    setSaveState({ status: "saving", message: "Saving OAuth client.", fieldErrors: {} });
    setIssuedSecret("");
    const isCreate = !selectedId;
    const target = selectedId ? `/api/oauth-clients/${selectedId}` : "/api/oauth-clients";
    const method = selectedId ? "PATCH" : "POST";
    const body = selectedId
      ? {
          displayName: form.displayName,
          enabled: form.enabled,
          redirectUris: redirectUrisFromText(form.redirectUrisText),
          clientCredentialsTtlSeconds: form.clientCredentialsTtlSeconds,
          allowedEndpointIds: form.allowedEndpointIds,
          allowedResourceIds: form.allowedResourceIds,
          allowedPromptIds: form.allowedPromptIds,
        }
      : {
          clientId: form.clientId,
          displayName: form.displayName,
          enabled: form.enabled,
          redirectUris: redirectUrisFromText(form.redirectUrisText),
          clientCredentialsTtlSeconds: form.clientCredentialsTtlSeconds,
          allowedEndpointIds: form.allowedEndpointIds,
          allowedResourceIds: form.allowedResourceIds,
          allowedPromptIds: form.allowedPromptIds,
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
      const successState: SaveState = {
        status: "success",
        message: payload.clientSecret ? "OAuth client saved. Copy the generated secret now." : "OAuth client saved.",
        fieldErrors: {},
      };
      if (isCreate) {
        window.sessionStorage.setItem(
          OAUTH_CLIENT_FLASH_KEY,
          JSON.stringify({
            id: client.id,
            message: successState.message,
            clientSecret: typeof payload.clientSecret === "string" ? payload.clientSecret : "",
          }),
        );
        router.push(`/oauth-clients/${client.id}`);
      }
      setSaveState(successState);
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
      router.push("/oauth-clients");
      setSaveState({ status: "idle", message: "", fieldErrors: {} });
      setDeleteState({ status: "success", message: "OAuth client deleted." });
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "OAuth client delete failed." });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
      <section className="endpoint-list-panel" aria-labelledby="oauth-client-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-client-list-title">Clients</h2>
            <p>{listData.total} OAuth clients, {listData.enabled} enabled</p>
          </div>
          <Link className="primary-button button-link" href="/oauth-clients/new">
            New OAuth client
          </Link>
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
                <th>Allowed T/R/P</th>
                <th>TTL</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link className="table-link" href={`/oauth-clients/${client.id}`}>
                      {client.clientId}
                    </Link>
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
                  <td>{client.allowedEndpointIds.length}/{client.allowedResourceIds.length}/{client.allowedPromptIds.length}</td>
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
      ) : null}

      {view !== "catalog" ? (
      <section className="endpoint-editor-panel" aria-labelledby="oauth-client-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-client-editor-title">{selectedId ? "Edit OAuth client" : "Create OAuth client"}</h2>
            <p>{locked ? "Built-in default/default client is permanent and locked." : "Client secrets are shown only when generated."}</p>
          </div>
          {locked ? <span className="status-pill danger">Locked fixture</span> : (
            <span className={form.enabled ? "status-pill enabled" : "status-pill"}>{form.enabled ? "Enabled" : "Disabled"}</span>
          )}
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
              <FieldLabel label="Client ID" help="OAuth client identifier used in authorize and token requests." />
              <input
                className="text-input"
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                disabled={Boolean(selectedId)}
              />
              {errorFor(saveState.fieldErrors, "clientId")}
            </label>
            <label className="field-block">
              <FieldLabel label="Display name" help="Human-readable client name shown on admin and consent surfaces." />
              <input
                className="text-input"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                disabled={locked}
              />
              {errorFor(saveState.fieldErrors, "displayName")}
            </label>
            <label className="field-block">
              <FieldLabel label="Client credentials TTL" help="How long tokens from the non-interactive client_credentials grant remain valid." />
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
              <span className="field-label-row">Enabled for OAuth client validation <HelpTooltip text="Disabled clients cannot authorize users or exchange client_credentials tokens." /></span>
            </label>
            <label className="field-block wide">
              <FieldLabel label="Redirect URIs" help="Allowed callback URLs for browser authorization-code flow. The redirect_uri request parameter must match one exactly." />
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
          <h3>Allowed tools</h3>
          <p className="section-note">These tools become the maximum tool permission set this client can request or receive in tokens.</p>
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
          <h3>Allowed resources</h3>
          <p className="section-note">These direct MCP resources can appear in OAuth resources/list and resources/read results.</p>
          <div className="checkbox-grid">
            {listData.resourceOptions.map((resource) => (
              <label className="compact-check endpoint-check" key={resource.id}>
                <input
                  type="checkbox"
                  checked={form.allowedResourceIds.includes(resource.id)}
                  onChange={(event) => toggleResource(resource.id, event.target.checked)}
                  disabled={locked}
                />
                <span>
                  <strong>{resource.name}</strong>
                  {resource.title ? ` ${resource.title}` : ` ${resource.uri}`}
                  {!resource.enabled ? " Disabled" : ""}
                </span>
              </label>
            ))}
          </div>
          {errorFor(saveState.fieldErrors, "allowedResourceIds")}
        </div>

        <div className="editor-section">
          <h3>Allowed prompts</h3>
          <p className="section-note">These prompts can appear in OAuth prompts/list and prompts/get results.</p>
          <div className="checkbox-grid">
            {listData.promptOptions.map((prompt) => (
              <label className="compact-check endpoint-check" key={prompt.id}>
                <input
                  type="checkbox"
                  checked={form.allowedPromptIds.includes(prompt.id)}
                  onChange={(event) => togglePrompt(prompt.id, event.target.checked)}
                  disabled={locked}
                />
                <span>
                  <strong>{prompt.name}</strong>
                  {prompt.title ? ` ${prompt.title}` : ""}
                  {!prompt.enabled ? " Disabled" : ""}
                </span>
              </label>
            ))}
          </div>
          {errorFor(saveState.fieldErrors, "allowedPromptIds")}
        </div>

        <div className="editor-section">
          <h3>Actions</h3>
          <div className="console-actions">
            <button className="primary-button" type="button" onClick={() => void saveClient()} disabled={locked || saveState.status === "saving"}>
              Save
            </button>
            <button className="secondary-button" type="button" onClick={startCreate}>
              Reset form
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
      ) : null}
    </div>
  );
}
