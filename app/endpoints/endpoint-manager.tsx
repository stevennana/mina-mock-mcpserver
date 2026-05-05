"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { generateMcpInputSchema } from "@/lib/endpoints/schema";
import type { EndpointDetail, EndpointInput, EndpointListResult, EndpointSummary } from "@/lib/endpoints/types";

type EndpointFormState = EndpointInput & { id?: string };

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "confirming" | "deleting" | "error" | "success";
  message: string;
};

type AuthMode = "none" | "basic" | "oauth";

const blankEndpoint: EndpointFormState = {
  name: "",
  title: "",
  description: "",
  enabled: true,
  deleteCode: "",
  defaultResponseJson: '{\n  "ok": true\n}',
  failureMode: "none",
  failureStatusCode: null,
  failureDelayMs: 0,
  failureMessage: "",
  malformedResponseJson: "",
  parameters: [],
  responseCases: [
    {
      name: "default",
      priority: 0,
      matchArgsJson: "{}",
      responseJson: '{\n  "ok": true\n}',
      statusCode: 200,
      delayMs: 0,
      errorMode: "none",
      errorStatusCode: null,
      errorMessage: "",
      errorBodyJson: "",
      isDefault: true,
    },
  ],
};

function detailToForm(endpoint: EndpointDetail): EndpointFormState {
  return {
    id: endpoint.id,
    name: endpoint.name,
    title: endpoint.title,
    description: endpoint.description,
    enabled: endpoint.enabled,
    deleteCode: endpoint.deleteCode ?? "",
    defaultResponseJson: endpoint.defaultResponseJson,
    failureMode: endpoint.failureMode,
    failureStatusCode: endpoint.failureStatusCode,
    failureDelayMs: endpoint.failureDelayMs,
    failureMessage: endpoint.failureMessage ?? "",
    malformedResponseJson: endpoint.malformedResponseJson ?? "",
    parameters: endpoint.parameters.map((parameter) => ({
      name: parameter.name,
      label: parameter.label ?? "",
      description: parameter.description,
      type: parameter.type,
      required: parameter.required,
      defaultValueJson: parameter.defaultValueJson ?? "",
    })),
    responseCases: endpoint.responseCases.map((responseCase) => ({
      name: responseCase.name,
      priority: responseCase.priority,
      matchArgsJson: responseCase.matchArgsJson,
      responseJson: responseCase.responseJson,
      statusCode: responseCase.statusCode,
      delayMs: responseCase.delayMs,
      errorMode: responseCase.errorMode,
      errorStatusCode: responseCase.errorStatusCode,
      errorMessage: responseCase.errorMessage ?? "",
      errorBodyJson: responseCase.errorBodyJson ?? "",
      isDefault: responseCase.isDefault,
    })),
  };
}

function errorFor(fieldErrors: Record<string, string>, field: string) {
  return fieldErrors[field] ? <p className="field-error">{fieldErrors[field]}</p> : null;
}

export function EndpointManager({ initialData }: { initialData: EndpointListResult }) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<EndpointFormState>(blankEndpoint);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingEndpoint, setLoadingEndpoint] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState("");
  const [rootPasswordConfirm, setRootPasswordConfirm] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [oauthToken, setOauthToken] = useState("");
  const [argumentsJson, setArgumentsJson] = useState("{}");

  const filteredEndpoints = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.endpoints;
    return listData.endpoints.filter((endpoint) => {
      return (
        endpoint.name.toLowerCase().includes(normalized) ||
        endpoint.title.toLowerCase().includes(normalized) ||
        endpoint.description.toLowerCase().includes(normalized)
      );
    });
  }, [listData.endpoints, query]);

  async function refreshList() {
    const response = await fetch("/api/endpoints");
    if (!response.ok) throw new Error("Unable to load endpoints.");
    setListData(await response.json());
  }

  async function selectEndpoint(endpoint: EndpointSummary) {
    setLoadingEndpoint(true);
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
    setDeleteCodeConfirm("");
    setRootPasswordConfirm("");
    try {
      const response = await fetch(`/api/endpoints/${endpoint.id}`);
      if (!response.ok) throw new Error("Unable to load endpoint.");
      const payload = (await response.json()) as { endpoint: EndpointDetail };
      setForm(detailToForm(payload.endpoint));
      setSelectedId(endpoint.id);
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Load failed.", fieldErrors: {} });
    } finally {
      setLoadingEndpoint(false);
    }
  }

  function startCreate() {
    setForm(blankEndpoint);
    setSelectedId(null);
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
    setDeleteCodeConfirm("");
    setRootPasswordConfirm("");
  }

  async function saveEndpoint() {
    setSaveState({ status: "saving", message: "Saving endpoint.", fieldErrors: {} });
    const target = selectedId ? `/api/endpoints/${selectedId}` : "/api/endpoints";
    const method = selectedId ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({
          status: "error",
          message: "Fix the highlighted fields and save again.",
          fieldErrors: payload.fieldErrors ?? {},
        });
        return;
      }

      const endpoint = payload.endpoint as EndpointDetail;
      setForm(detailToForm(endpoint));
      setSelectedId(endpoint.id);
      await refreshList();
      router.refresh();
      setSaveState({ status: "success", message: "Endpoint saved.", fieldErrors: {} });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedEndpoint() {
    if (!selectedId) return;

    setDeleteState({ status: "deleting", message: "Deleting endpoint." });
    try {
      const response = await fetch(`/api/endpoints/${selectedId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deleteCode: deleteCodeConfirm,
          rootPassword: rootPasswordConfirm,
        }),
      });
      const payload = await response.json();
      setDeleteCodeConfirm("");
      setRootPasswordConfirm("");

      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Endpoint delete failed.",
        });
        return;
      }

      setForm(blankEndpoint);
      setSelectedId(null);
      await refreshList();
      router.refresh();
      setSaveState({ status: "success", message: "Endpoint deleted.", fieldErrors: {} });
      setDeleteState({ status: "success", message: "Endpoint deleted." });
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "Endpoint delete failed." });
    }
  }

  function updateForm<K extends keyof EndpointFormState>(key: K, value: EndpointFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateParameter(index: number, patch: Partial<EndpointFormState["parameters"][number]>) {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index ? { ...parameter, ...patch } : parameter,
      ),
    }));
  }

  function updateResponseCase(index: number, patch: Partial<EndpointFormState["responseCases"][number]>) {
    setForm((current) => ({
      ...current,
      responseCases: current.responseCases.map((responseCase, responseCaseIndex) =>
        responseCaseIndex === index ? { ...responseCase, ...patch } : responseCase,
      ),
    }));
  }

  function setDefaultCase(index: number) {
    setForm((current) => ({
      ...current,
      responseCases: current.responseCases.map((responseCase, responseCaseIndex) => ({
        ...responseCase,
        isDefault: responseCaseIndex === index,
      })),
    }));
  }

  const fieldErrors = saveState.fieldErrors;
  const inputSchema = useMemo(() => {
    try {
      return generateMcpInputSchema(form);
    } catch {
      return generateMcpInputSchema({ parameters: form.parameters.map((parameter) => ({ ...parameter, defaultValueJson: null })) });
    }
  }, [form]);
  const schemaPreviewJson = JSON.stringify(inputSchema, null, 2);
  const argumentsError = useMemo(() => {
    try {
      const parsed = JSON.parse(argumentsJson);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        return "Arguments must be a JSON object.";
      }
      return "";
    } catch {
      return "Arguments must be valid JSON before runtime calls can be enabled.";
    }
  }, [argumentsJson]);
  const parsedArguments = useMemo(() => {
    if (argumentsError) return {};
    return JSON.parse(argumentsJson) as Record<string, unknown>;
  }, [argumentsError, argumentsJson]);
  const rawRequestPreview = JSON.stringify(
    {
      route: authMode === "none" ? "/mcp/none" : authMode === "basic" ? "/mcp/basic" : "/mcp/oauth",
      method: "tools/call",
      authMode,
      jsonrpc: "2.0",
      id: "preview-only",
      params: {
        name: form.name || "unsaved_endpoint",
        arguments: parsedArguments,
      },
      runtimeStatus: "disabled until MCP/REST runtime tasks land",
    },
    null,
    2,
  );

  return (
    <div className="endpoint-layout">
      <section className="endpoint-list-panel" aria-labelledby="endpoint-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="endpoint-list-title">Endpoint catalog</h2>
            <p>{listData.total} persisted endpoints, {listData.enabled} enabled</p>
          </div>
          <button className="primary-button" type="button" onClick={startCreate}>
            New endpoint
          </button>
        </div>

        <label className="field-label" htmlFor="endpoint-search">Search</label>
        <input
          id="endpoint-search"
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, title, or description"
        />

        <div className="endpoint-table-shell" aria-live="polite">
          <table className="endpoint-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Shape</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredEndpoints.map((endpoint) => (
                <tr key={endpoint.id}>
                  <td>
                    <button className="table-link" type="button" onClick={() => void selectEndpoint(endpoint)}>
                      {endpoint.name}
                    </button>
                    <span>{endpoint.title || "Untitled endpoint"}</span>
                  </td>
                  <td>
                    <span className={endpoint.enabled ? "status-pill enabled" : "status-pill"}>{endpoint.enabled ? "Enabled" : "Disabled"}</span>
                  </td>
                  <td>{endpoint.parameterCount} params / {endpoint.responseCaseCount} cases</td>
                  <td>{new Date(endpoint.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {filteredEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">No endpoints match this search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="endpoint-editor-panel" aria-labelledby="endpoint-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="endpoint-editor-title">{selectedId ? "Edit endpoint" : "Create endpoint"}</h2>
            <p>{loadingEndpoint ? "Loading selected endpoint." : "Persisted through the endpoint API."}</p>
          </div>
          <button className="primary-button" type="button" onClick={() => void saveEndpoint()} disabled={saveState.status === "saving"}>
            {saveState.status === "saving" ? "Saving" : "Save"}
          </button>
        </div>

        {saveState.message ? (
          <p className={`form-message ${saveState.status}`}>{saveState.message}</p>
        ) : null}

        <div className="form-grid">
          <label className="field-block">
            <span>Name</span>
            <input className="text-input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            {errorFor(fieldErrors, "name")}
          </label>
          <label className="field-block">
            <span>Title</span>
            <input className="text-input" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            {errorFor(fieldErrors, "title")}
          </label>
          <label className="field-block wide">
            <span>Description</span>
            <textarea className="text-area short" value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            {errorFor(fieldErrors, "description")}
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} />
            <span>Enabled in runtime catalogs</span>
          </label>
          <label className="field-block">
            <span>Delete code</span>
            <input className="text-input" value={form.deleteCode ?? ""} onChange={(event) => updateForm("deleteCode", event.target.value)} />
            {errorFor(fieldErrors, "deleteCode")}
          </label>
        </div>

        <EditorSection title="Parameters">
          {errorFor(fieldErrors, "parameters")}
          <div className="stack">
            {form.parameters.map((parameter, index) => (
              <div className="parameter-editor" key={`parameter-${index}`}>
                <input aria-label={`Parameter ${index + 1} name`} className="text-input" placeholder="name" value={parameter.name} onChange={(event) => updateParameter(index, { name: event.target.value })} />
                <select aria-label={`Parameter ${index + 1} type`} className="text-input" value={parameter.type} onChange={(event) => updateParameter(index, { type: event.target.value as EndpointInput["parameters"][number]["type"] })}>
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
                <label className="compact-check">
                  <input type="checkbox" checked={parameter.required} onChange={(event) => updateParameter(index, { required: event.target.checked })} />
                  Required
                </label>
                <input aria-label={`Parameter ${index + 1} label`} className="text-input" placeholder="label" value={parameter.label ?? ""} onChange={(event) => updateParameter(index, { label: event.target.value })} />
                <input aria-label={`Parameter ${index + 1} description`} className="text-input parameter-description" placeholder="description" value={parameter.description ?? ""} onChange={(event) => updateParameter(index, { description: event.target.value })} />
                <input aria-label={`Parameter ${index + 1} default JSON`} className="text-input" placeholder="default JSON" value={parameter.defaultValueJson ?? ""} onChange={(event) => updateParameter(index, { defaultValueJson: event.target.value })} />
                <button className="secondary-button" type="button" onClick={() => updateForm("parameters", form.parameters.filter((_, parameterIndex) => parameterIndex !== index))}>Remove</button>
                {errorFor(fieldErrors, `parameters.${index}.name`)}
                {errorFor(fieldErrors, `parameters.${index}.defaultValueJson`)}
              </div>
            ))}
          </div>
          <button className="secondary-button" type="button" disabled={form.parameters.length >= 3} onClick={() => updateForm("parameters", [...form.parameters, { name: "", label: "", description: "", type: "string", required: false, defaultValueJson: "" }])}>
            Add parameter
          </button>
        </EditorSection>

        <EditorSection title="Generated MCP inputSchema">
          <p className="section-note">Generated by the endpoint domain schema service from the current parameter definition.</p>
          <pre className="json-panel schema-preview" aria-label="Generated MCP input schema">{schemaPreviewJson}</pre>
        </EditorSection>

        <EditorSection title="Default response">
          <label className="field-block">
            <span>Default response JSON</span>
            <textarea className="text-area" value={form.defaultResponseJson} onChange={(event) => updateForm("defaultResponseJson", event.target.value)} />
            {errorFor(fieldErrors, "defaultResponseJson")}
          </label>
        </EditorSection>

        <EditorSection title="Response cases">
          {errorFor(fieldErrors, "responseCases")}
          {errorFor(fieldErrors, "responseCases.default")}
          <div className="stack">
            {form.responseCases.map((responseCase, index) => (
              <div className="case-editor" key={`case-${index}`}>
                <div className="case-grid">
                  <label className="field-block">
                    <span>Case name</span>
                    <input className="text-input" value={responseCase.name} onChange={(event) => updateResponseCase(index, { name: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.name`)}
                  </label>
                  <label className="field-block">
                    <span>Priority</span>
                    <input className="text-input" type="number" value={responseCase.priority} onChange={(event) => updateResponseCase(index, { priority: Number(event.target.value) })} />
                  </label>
                  <label className="toggle-row">
                    <input type="radio" name="default-response-case" checked={responseCase.isDefault} onChange={() => setDefaultCase(index)} />
                    <span>Default case</span>
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field-block">
                    <span>Match args JSON</span>
                    <textarea className="text-area" value={responseCase.matchArgsJson} onChange={(event) => updateResponseCase(index, { matchArgsJson: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.matchArgsJson`)}
                  </label>
                  <label className="field-block">
                    <span>Response JSON</span>
                    <textarea className="text-area" value={responseCase.responseJson} onChange={(event) => updateResponseCase(index, { responseJson: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.responseJson`)}
                  </label>
                  <label className="field-block">
                    <span>Status code</span>
                    <input className="text-input" type="number" value={responseCase.statusCode} onChange={(event) => updateResponseCase(index, { statusCode: Number(event.target.value) })} />
                    {errorFor(fieldErrors, `responseCases.${index}.statusCode`)}
                  </label>
                  <label className="field-block">
                    <span>Delay ms</span>
                    <input className="text-input" type="number" value={responseCase.delayMs} onChange={(event) => updateResponseCase(index, { delayMs: Number(event.target.value) })} />
                    {errorFor(fieldErrors, `responseCases.${index}.delayMs`)}
                  </label>
                  <label className="field-block">
                    <span>Error mode</span>
                    <select className="text-input" value={responseCase.errorMode} onChange={(event) => updateResponseCase(index, { errorMode: event.target.value as EndpointInput["responseCases"][number]["errorMode"] })}>
                      <option value="none">none</option>
                      <option value="error">error</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Error status</span>
                    <input className="text-input" type="number" value={responseCase.errorStatusCode ?? ""} onChange={(event) => updateResponseCase(index, { errorStatusCode: event.target.value ? Number(event.target.value) : null })} />
                    {errorFor(fieldErrors, `responseCases.${index}.errorStatusCode`)}
                  </label>
                  <label className="field-block wide">
                    <span>Error message</span>
                    <input className="text-input" value={responseCase.errorMessage ?? ""} onChange={(event) => updateResponseCase(index, { errorMessage: event.target.value })} />
                  </label>
                  <label className="field-block wide">
                    <span>Error body JSON</span>
                    <textarea className="text-area short" value={responseCase.errorBodyJson ?? ""} onChange={(event) => updateResponseCase(index, { errorBodyJson: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.errorBodyJson`)}
                  </label>
                </div>
                <button className="secondary-button" type="button" disabled={form.responseCases.length === 1} onClick={() => updateForm("responseCases", form.responseCases.filter((_, responseCaseIndex) => responseCaseIndex !== index))}>
                  Remove case
                </button>
              </div>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={() => updateForm("responseCases", [...form.responseCases, { name: `case-${form.responseCases.length + 1}`, priority: form.responseCases.length + 1, matchArgsJson: "{}", responseJson: '{\n  "ok": true\n}', statusCode: 200, delayMs: 0, errorMode: "none", errorStatusCode: null, errorMessage: "", errorBodyJson: "", isDefault: false }])}>
            Add response case
          </button>
        </EditorSection>

        <EditorSection title="Failure simulation">
          <div className="form-grid">
            <label className="field-block">
              <span>Failure mode</span>
              <select aria-label="Failure mode" className="text-input" value={form.failureMode} onChange={(event) => updateForm("failureMode", event.target.value as EndpointInput["failureMode"])}>
                <option value="none">none</option>
                <option value="delay">delay</option>
                <option value="error">error</option>
                <option value="malformed">malformed</option>
              </select>
              {errorFor(fieldErrors, "failureMode")}
            </label>
            <label className="field-block">
              <span>Failure status</span>
              <input aria-label="Failure status" className="text-input" type="number" value={form.failureStatusCode ?? ""} onChange={(event) => updateForm("failureStatusCode", event.target.value ? Number(event.target.value) : null)} />
              {errorFor(fieldErrors, "failureStatusCode")}
            </label>
            <label className="field-block">
              <span>Failure delay ms</span>
              <input aria-label="Failure delay ms" className="text-input" type="number" value={form.failureDelayMs} onChange={(event) => updateForm("failureDelayMs", Number(event.target.value))} />
              {errorFor(fieldErrors, "failureDelayMs")}
            </label>
            <label className="field-block wide">
              <span>Failure message</span>
              <input aria-label="Failure message" className="text-input" value={form.failureMessage ?? ""} onChange={(event) => updateForm("failureMessage", event.target.value)} />
            </label>
            <label className="field-block wide">
              <span>Malformed response JSON</span>
              <textarea className="text-area short" value={form.malformedResponseJson ?? ""} onChange={(event) => updateForm("malformedResponseJson", event.target.value)} />
              {errorFor(fieldErrors, "malformedResponseJson")}
            </label>
          </div>
        </EditorSection>

        {selectedId ? (
          <EditorSection title="Delete endpoint">
            <p className="section-note">Enter this endpoint's 8-digit delete code or the root password override. Secrets are not written to audit events.</p>
            {deleteState.message ? (
              <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p>
            ) : null}
            {["confirming", "deleting", "error"].includes(deleteState.status) ? (
              <div className="delete-confirmation">
                <label className="field-block">
                  <span>Delete code</span>
                  <input
                    className="text-input"
                    inputMode="numeric"
                    value={deleteCodeConfirm}
                    onChange={(event) => setDeleteCodeConfirm(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field-block">
                  <span>Root password override</span>
                  <input
                    className="text-input"
                    type="password"
                    value={rootPasswordConfirm}
                    onChange={(event) => setRootPasswordConfirm(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <div className="console-actions">
                  <button className="danger-button" type="button" onClick={() => void deleteSelectedEndpoint()} disabled={deleteState.status === "deleting"}>
                    {deleteState.status === "deleting" ? "Deleting" : "Confirm delete"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setDeleteState({ status: "idle", message: "" })}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="danger-button" type="button" onClick={() => setDeleteState({ status: "confirming", message: "" })}>
                Delete endpoint
              </button>
            )}
          </EditorSection>
        ) : null}

        <EditorSection title="Endpoint test console">
          <div className="console-shell">
            <div className="console-controls" aria-label="Console controls">
              <label className="field-block">
                <span>Auth mode</span>
                <select className="text-input" value={authMode} onChange={(event) => setAuthMode(event.target.value as AuthMode)}>
                  <option value="none">No auth</option>
                  <option value="basic">Basic</option>
                  <option value="oauth">OAuth bearer</option>
                </select>
              </label>
              <label className="field-block">
                <span>Basic username</span>
                <input className="text-input" value={basicUsername} onChange={(event) => setBasicUsername(event.target.value)} placeholder="default" autoComplete="username" />
              </label>
              <label className="field-block">
                <span>Basic password</span>
                <input className="text-input" type="password" value={basicPassword} onChange={(event) => setBasicPassword(event.target.value)} placeholder="default" autoComplete="current-password" />
              </label>
              <label className="field-block wide">
                <span>OAuth bearer token</span>
                <input className="text-input" value={oauthToken} onChange={(event) => setOauthToken(event.target.value)} placeholder="Token issuance lands in the OAuth runtime tasks." />
              </label>
              <label className="field-block wide">
                <span>Arguments JSON</span>
                <textarea className="text-area console-arguments" value={argumentsJson} onChange={(event) => setArgumentsJson(event.target.value)} />
                {argumentsError ? <p className="field-error">{argumentsError}</p> : <p className="field-hint">Validated locally for JSON syntax only. No tool call is sent in this task.</p>}
              </label>
              <div className="console-actions">
                <button className="secondary-button" type="button" disabled>MCP call unavailable until task 008</button>
                <button className="secondary-button" type="button" disabled>REST call unavailable until task 012</button>
              </div>
            </div>

            <div className="console-evidence-grid" aria-label="Console evidence">
              <EvidencePanel title="Raw request" value={rawRequestPreview} />
              <EvidencePanel title="Raw response" value={"No response yet. Runtime execution is intentionally disabled in this UI shell."} />
              <EvidencePanel title="Matched case" value={"Pending runtime matcher execution."} compact />
              <EvidencePanel title="Principal" value={authMode === "none" ? "anonymous preview" : "Pending auth runtime validation."} compact />
              <EvidencePanel title="Elapsed time" value={"-- ms"} compact />
            </div>
          </div>
        </EditorSection>
      </section>
    </div>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="editor-section" aria-label={title}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function EvidencePanel({ title, value, compact = false }: { title: string; value: string; compact?: boolean }) {
  return (
    <section className={compact ? "evidence-panel compact" : "evidence-panel"} aria-label={title}>
      <h4>{title}</h4>
      <pre>{value}</pre>
    </section>
  );
}
