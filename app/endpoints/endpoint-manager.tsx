"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatShortDate } from "@/lib/date-format";
import { generateMcpInputSchema } from "@/lib/endpoints/schema";
import type { EndpointDetail, EndpointInput, EndpointListResult } from "@/lib/endpoints/types";

type EndpointFormState = EndpointInput & { id?: string };

export type EndpointView =
  | "catalog"
  | "create"
  | "overview"
  | "edit"
  | "parameters"
  | "responses"
  | "failure"
  | "console"
  | "delete";

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

type ConsoleState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  rawRequest: string;
  rawResponse: string;
  matchedCase: string;
  principal: string;
  elapsedMs: string;
};

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

function FieldLabel({ children, help }: { children: ReactNode; help: string }) {
  return (
    <span className="field-label-row">
      {children}
      <HelpTooltip text={help} />
    </span>
  );
}

export function EndpointManager({
  initialData,
  initialDetail = null,
  view = "catalog",
}: {
  initialData: EndpointListResult;
  initialDetail?: EndpointDetail | null;
  view?: EndpointView;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<EndpointFormState>(initialDetail ? detailToForm(initialDetail) : blankEndpoint);
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState("");
  const [rootPasswordConfirm, setRootPasswordConfirm] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [oauthToken, setOauthToken] = useState("");
  const [argumentsJson, setArgumentsJson] = useState("{}");
  const [consoleState, setConsoleState] = useState<ConsoleState>({
    status: "idle",
    message: "",
    rawRequest: "",
    rawResponse: "No response yet. Run a REST call to collect raw HTTP evidence.",
    matchedCase: "Not run",
    principal: "anonymous preview",
    elapsedMs: "-- ms",
  });

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
      if (!selectedId) {
        router.push(`/endpoints/${endpoint.id}`);
      }
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
      router.push("/endpoints");
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
      route: `/rest/tools/${form.name || "unsaved_endpoint"}/call`,
      method: "POST",
      authMode,
      headers: {
        "Content-Type": "application/json",
        ...(authMode === "basic" ? { Authorization: "Basic <redacted>" } : {}),
        ...(authMode === "oauth" ? { Authorization: "Bearer <deferred>" } : {}),
      },
      body: {
        arguments: parsedArguments,
      },
      runtimeStatus: authMode === "oauth" ? "OAuth REST execution is deferred." : "ready",
    },
    null,
    2,
  );
  const rawRequestEvidence = consoleState.rawRequest || rawRequestPreview;
  const malformedModeLabels: Record<string, string> = {
    invalid_json: "invalid JSON",
    wrong_content_type: "wrong content type",
    empty_body: "empty body",
  };
  const malformedModeLabel = malformedModeLabels[form.failureMode] ?? "";
  const isMalformedMode = Boolean(malformedModeLabel);
  const canSave = ["create", "edit", "parameters", "responses", "failure"].includes(view);
  const pageTitleByView: Record<EndpointView, string> = {
    catalog: "Endpoint catalog",
    create: "Create endpoint",
    overview: "Endpoint overview",
    edit: "Edit endpoint",
    parameters: "Parameters and schema",
    responses: "Responses",
    failure: "Failure simulation",
    console: "Endpoint console",
    delete: "Delete endpoint",
  };

  function safePrettyJson(text: string) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  async function runRestCall() {
    if (argumentsError) {
      setConsoleState((current) => ({
        ...current,
        status: "error",
        message: argumentsError,
      }));
      return;
    }
    if (authMode === "oauth") {
      setConsoleState((current) => ({
        ...current,
        status: "error",
        message: "OAuth REST execution is deferred to the OAuth permission task.",
      }));
      return;
    }

    const route = `/rest/tools/${encodeURIComponent(form.name || "unsaved_endpoint")}/call`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authMode === "basic") {
      headers.Authorization = `Basic ${btoa(`${basicUsername}:${basicPassword}`)}`;
    }
    const requestEvidence = JSON.stringify(
      {
        route,
        method: "POST",
        authMode,
        headers: {
          "Content-Type": "application/json",
          ...(headers.Authorization ? { Authorization: "Basic <redacted>" } : {}),
        },
        body: { arguments: parsedArguments },
      },
      null,
      2,
    );

    setConsoleState({
      status: "running",
      message: "Running REST call.",
      rawRequest: requestEvidence,
      rawResponse: "Waiting for response.",
      matchedCase: "Pending",
      principal: "Pending",
      elapsedMs: "-- ms",
    });

    const startedAt = performance.now();
    try {
      const response = await fetch(route, {
        method: "POST",
        headers,
        body: JSON.stringify({ arguments: parsedArguments }),
      });
      const elapsedMs = `${Math.round(performance.now() - startedAt)} ms`;
      const responseText = await response.text();
      const matchedCase = response.headers.get("X-MCP-Mock-Matched-Case") ?? "No match";
      const principal = response.headers.get("X-MCP-Mock-Principal") ?? (authMode === "none" ? "anonymous" : "unauthenticated");
      setConsoleState({
        status: response.ok ? "success" : "error",
        message: response.ok ? "REST call completed." : `REST call returned HTTP ${response.status}.`,
        rawRequest: requestEvidence,
        rawResponse: [
          `HTTP ${response.status}`,
          `content-type: ${response.headers.get("content-type") ?? ""}`,
          `www-authenticate: ${response.headers.get("www-authenticate") ?? ""}`,
          `x-mcp-mock-matched-case: ${response.headers.get("X-MCP-Mock-Matched-Case") ?? ""}`,
          `x-mcp-mock-principal: ${response.headers.get("X-MCP-Mock-Principal") ?? ""}`,
          `x-mcp-mock-malformed-mode: ${response.headers.get("X-MCP-Mock-Malformed-Mode") ?? ""}`,
          "",
          safePrettyJson(responseText),
        ].join("\n"),
        matchedCase,
        principal,
        elapsedMs,
      });
    } catch (error) {
      setConsoleState({
        status: "error",
        message: error instanceof Error ? error.message : "REST call failed.",
        rawRequest: requestEvidence,
        rawResponse: "No HTTP response was received.",
        matchedCase: "No match",
        principal: "unknown",
        elapsedMs: `${Math.round(performance.now() - startedAt)} ms`,
      });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
      <section className="endpoint-list-panel" aria-labelledby="endpoint-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="endpoint-list-title">Endpoint catalog</h2>
            <p>{listData.total} persisted endpoints, {listData.enabled} enabled</p>
          </div>
          <Link className="primary-button button-link" href="/endpoints/new">
            New endpoint
          </Link>
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
                    <Link className="table-link" href={`/endpoints/${endpoint.id}`}>
                      {endpoint.name}
                    </Link>
                    <span>{endpoint.title || "Untitled endpoint"}</span>
                  </td>
                  <td>
                    <span className={endpoint.enabled ? "status-pill enabled" : "status-pill"}>{endpoint.enabled ? "Enabled" : "Disabled"}</span>
                  </td>
                  <td>{endpoint.parameterCount} params / {endpoint.responseCaseCount} cases</td>
                  <td>{formatShortDate(endpoint.updatedAt)}</td>
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
      ) : null}

      {view !== "catalog" ? (
      <section className="endpoint-editor-panel" aria-labelledby="endpoint-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="endpoint-editor-title">{pageTitleByView[view]}</h2>
            <p>Persisted through the endpoint API.</p>
          </div>
          {canSave ? (
          <button className="primary-button" type="button" onClick={() => void saveEndpoint()} disabled={saveState.status === "saving"}>
            {saveState.status === "saving" ? "Saving" : "Save"}
          </button>
          ) : null}
        </div>

        {selectedId ? <EndpointSubNav endpointId={selectedId} current={view} /> : null}

        {saveState.message ? (
          <p className={`form-message ${saveState.status}`}>{saveState.message}</p>
        ) : null}
        {isMalformedMode ? (
          <p className="warning-callout" role="alert">
            Malformed response mode is intentionally protocol-breaking. Saving this endpoint will make only this endpoint return {malformedModeLabel} responses after a tool call matches.
          </p>
        ) : null}

        {view === "overview" ? (
          <div className="editor-section">
            <h3>Runtime summary</h3>
            <dl className="detail-grid">
              <div><dt>Name</dt><dd>{form.name}</dd></div>
              <div><dt>Status</dt><dd>{form.enabled ? "Enabled" : "Disabled"}</dd></div>
              <div><dt>Parameters</dt><dd>{form.parameters.length}</dd></div>
              <div><dt>Response cases</dt><dd>{form.responseCases.length}</dd></div>
              <div><dt>Failure mode</dt><dd>{form.failureMode}</dd></div>
              <div><dt>Delete code</dt><dd>{form.deleteCode ? "Configured" : "Not set"}</dd></div>
            </dl>
            <div className="quick-action-grid">
              <Link className="secondary-button button-link" href={`/endpoints/${selectedId}/parameters`}>Configure parameters</Link>
              <Link className="secondary-button button-link" href={`/endpoints/${selectedId}/responses`}>Configure responses</Link>
              <Link className="secondary-button button-link" href={`/endpoints/${selectedId}/console`}>Open console</Link>
            </div>
          </div>
        ) : null}

        {["create", "edit"].includes(view) ? (
        <div className="form-grid">
          <label className="field-block">
            <FieldLabel help="The stable tool name clients use in MCP tools/call and REST URLs. Keep it URL-safe and unique.">Name</FieldLabel>
            <input className="text-input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            {errorFor(fieldErrors, "name")}
          </label>
          <label className="field-block">
            <FieldLabel help="Human-readable label shown in the admin UI and client tool metadata.">Title</FieldLabel>
            <input className="text-input" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            {errorFor(fieldErrors, "title")}
          </label>
          <label className="field-block wide">
            <FieldLabel help="Client-facing tool description. MCP clients use this to explain what the tool is for.">Description</FieldLabel>
            <textarea className="text-area short" value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
            {errorFor(fieldErrors, "description")}
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} />
            <span className="field-label-row">Enabled in runtime catalogs <HelpTooltip text="When enabled, this tool appears in MCP tools/list and REST tool lists. Disabled tools stay configured but cannot be called." /></span>
          </label>
          <label className="field-block">
            <FieldLabel help="Eight-digit endpoint-specific code accepted by the protected delete flow. Root password can still override it.">Delete code</FieldLabel>
            <input className="text-input" value={form.deleteCode ?? ""} onChange={(event) => updateForm("deleteCode", event.target.value)} />
            {errorFor(fieldErrors, "deleteCode")}
          </label>
        </div>
        ) : null}

        {view === "parameters" ? (
        <>
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
          <p className="section-note">
            Parameter rows define the MCP tool input schema. Name and type become JSON Schema properties; required controls whether clients must send the argument.
          </p>
        </EditorSection>

        <EditorSection title="Generated MCP inputSchema">
          <p className="section-note">Generated by the endpoint domain schema service from the current parameter definition.</p>
          <pre className="json-panel schema-preview" aria-label="Generated MCP input schema">{schemaPreviewJson}</pre>
        </EditorSection>
        </>
        ) : null}

        {view === "responses" ? (
        <>
        <EditorSection title="Default response">
          <label className="field-block">
            <FieldLabel help="Fallback JSON body returned when no response case matches the supplied tool arguments.">Default response JSON</FieldLabel>
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
                    <FieldLabel help="Internal label for this response case, useful when reading console evidence and audit logs.">Case name</FieldLabel>
                    <input className="text-input" value={responseCase.name} onChange={(event) => updateResponseCase(index, { name: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.name`)}
                  </label>
                  <label className="field-block">
                    <FieldLabel help="Higher priority cases win first when multiple exact-match argument patterns could apply.">Priority</FieldLabel>
                    <input className="text-input" type="number" value={responseCase.priority} onChange={(event) => updateResponseCase(index, { priority: Number(event.target.value) })} />
                  </label>
                  <label className="toggle-row">
                    <input type="radio" name="default-response-case" checked={responseCase.isDefault} onChange={() => setDefaultCase(index)} />
                    <span className="field-label-row">Default case <HelpTooltip text="Marks this case as the fallback when no exact argument match is found." /></span>
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field-block">
                    <FieldLabel help="Exact JSON argument pattern that triggers this case, for example {&quot;city&quot;:&quot;Seoul&quot;}.">Match args JSON</FieldLabel>
                    <textarea className="text-area" value={responseCase.matchArgsJson} onChange={(event) => updateResponseCase(index, { matchArgsJson: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.matchArgsJson`)}
                  </label>
                  <label className="field-block">
                    <FieldLabel help="JSON body returned to REST clients and mapped into MCP structuredContent for successful tool calls.">Response JSON</FieldLabel>
                    <textarea className="text-area" value={responseCase.responseJson} onChange={(event) => updateResponseCase(index, { responseJson: event.target.value })} />
                    {errorFor(fieldErrors, `responseCases.${index}.responseJson`)}
                  </label>
                  <label className="field-block">
                    <FieldLabel help="HTTP status for REST calls. MCP success responses still use JSON-RPC result formatting.">Status code</FieldLabel>
                    <input className="text-input" type="number" value={responseCase.statusCode} onChange={(event) => updateResponseCase(index, { statusCode: Number(event.target.value) })} />
                    {errorFor(fieldErrors, `responseCases.${index}.statusCode`)}
                  </label>
                  <label className="field-block">
                    <FieldLabel help="Artificial delay added before returning this case, useful for timeout and retry tests.">Delay ms</FieldLabel>
                    <input className="text-input" type="number" value={responseCase.delayMs} onChange={(event) => updateResponseCase(index, { delayMs: Number(event.target.value) })} />
                    {errorFor(fieldErrors, `responseCases.${index}.delayMs`)}
                  </label>
                  <label className="field-block">
                    <FieldLabel help="Turns a matching case into a REST error or MCP protocol/tool error instead of a normal success body.">Error mode</FieldLabel>
                    <select className="text-input" value={responseCase.errorMode} onChange={(event) => updateResponseCase(index, { errorMode: event.target.value as EndpointInput["responseCases"][number]["errorMode"] })}>
                      <option value="none">none</option>
                      <option value="error">error</option>
                      <option value="protocol_error">protocol_error</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <FieldLabel help="HTTP status used when this case simulates an error.">Error status</FieldLabel>
                    <input className="text-input" type="number" value={responseCase.errorStatusCode ?? ""} onChange={(event) => updateResponseCase(index, { errorStatusCode: event.target.value ? Number(event.target.value) : null })} />
                    {errorFor(fieldErrors, `responseCases.${index}.errorStatusCode`)}
                  </label>
                  <label className="field-block wide">
                    <FieldLabel help="Human-readable error message returned in configured failure responses.">Error message</FieldLabel>
                    <input className="text-input" value={responseCase.errorMessage ?? ""} onChange={(event) => updateResponseCase(index, { errorMessage: event.target.value })} />
                  </label>
                  <label className="field-block wide">
                    <FieldLabel help="Optional JSON error body for REST failure evidence.">Error body JSON</FieldLabel>
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
        </>
        ) : null}

        {view === "failure" ? (
        <EditorSection title="Failure simulation">
          <div className="form-grid">
            <label className="field-block">
              <FieldLabel help="Endpoint-wide failure behavior applied before normal response case matching. Use it to test client error handling.">Failure mode</FieldLabel>
              <select aria-label="Failure mode" className="text-input" value={form.failureMode} onChange={(event) => updateForm("failureMode", event.target.value as EndpointInput["failureMode"])}>
                <option value="none">none</option>
                <option value="delay">delay</option>
                <option value="error">error</option>
                <option value="invalid_json">invalid_json</option>
                <option value="wrong_content_type">wrong_content_type</option>
                <option value="empty_body">empty_body</option>
              </select>
              {errorFor(fieldErrors, "failureMode")}
            </label>
            <label className="field-block">
              <FieldLabel help="HTTP status returned when endpoint-wide error mode is active.">Failure status</FieldLabel>
              <input aria-label="Failure status" className="text-input" type="number" value={form.failureStatusCode ?? ""} onChange={(event) => updateForm("failureStatusCode", event.target.value ? Number(event.target.value) : null)} />
              {errorFor(fieldErrors, "failureStatusCode")}
            </label>
            <label className="field-block">
              <FieldLabel help="Endpoint-wide artificial delay before the response is returned.">Failure delay ms</FieldLabel>
              <input aria-label="Failure delay ms" className="text-input" type="number" value={form.failureDelayMs} onChange={(event) => updateForm("failureDelayMs", Number(event.target.value))} />
              {errorFor(fieldErrors, "failureDelayMs")}
            </label>
            <div className="field-block">
              <FieldLabel help="Sets a 30 second endpoint delay quickly for timeout and cancellation checks.">Timeout shortcut</FieldLabel>
              <button className="secondary-button" type="button" onClick={() => setForm((current) => ({ ...current, failureMode: "delay", failureDelayMs: 30_000 }))}>
                Set 30s delay
              </button>
            </div>
            <label className="field-block wide">
              <FieldLabel help="Message included in endpoint-wide error responses.">Failure message</FieldLabel>
              <input aria-label="Failure message" className="text-input" value={form.failureMessage ?? ""} onChange={(event) => updateForm("failureMessage", event.target.value)} />
            </label>
            <label className="field-block wide">
              <FieldLabel help="Optional raw body for wrong_content_type mode. invalid_json and empty_body use fixed malformed evidence.">Malformed response JSON</FieldLabel>
              <textarea className="text-area short" value={form.malformedResponseJson ?? ""} onChange={(event) => updateForm("malformedResponseJson", event.target.value)} />
              <p className="field-hint">Optional body used by wrong_content_type; invalid_json and empty_body use fixed malformed evidence.</p>
              {errorFor(fieldErrors, "malformedResponseJson")}
            </label>
          </div>
        </EditorSection>
        ) : null}

        {selectedId && view === "delete" ? (
          <EditorSection title="Delete endpoint">
            <p className="section-note">Enter this endpoint's 8-digit delete code or the root password override. Secrets are not written to audit events.</p>
            {deleteState.message ? (
              <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p>
            ) : null}
            {["confirming", "deleting", "error"].includes(deleteState.status) ? (
              <div className="delete-confirmation">
                <label className="field-block">
                  <FieldLabel help="Endpoint-specific delete code. Use this for normal protected deletion without exposing the root password.">Delete code</FieldLabel>
                  <input
                    className="text-input"
                    inputMode="numeric"
                    value={deleteCodeConfirm}
                    onChange={(event) => setDeleteCodeConfirm(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field-block">
                  <FieldLabel help="Root password can override the endpoint delete code for operator recovery. It is not written to audit metadata.">Root password override</FieldLabel>
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

        {view === "console" ? (
        <EditorSection title="Endpoint test console">
          <div className="console-shell">
            <div className="console-controls" aria-label="Console controls">
              {isMalformedMode ? (
                <p className="warning-callout" role="alert">
                  Running the console will show the raw {malformedModeLabel} HTTP response. JSON parsing may fail by design.
                </p>
              ) : null}
              <label className="field-block">
                <FieldLabel help="Select how the console calls this tool through REST. OAuth bearer requires a token issued with permission for this endpoint.">Auth mode</FieldLabel>
                <select className="text-input" value={authMode} onChange={(event) => setAuthMode(event.target.value as AuthMode)}>
                  <option value="none">No auth</option>
                  <option value="basic">Basic</option>
                  <option value="oauth">OAuth bearer</option>
                </select>
              </label>
              <label className="field-block">
                <FieldLabel help="Username for REST Basic Auth calls. The seeded test user is default.">Basic username</FieldLabel>
                <input className="text-input" value={basicUsername} onChange={(event) => setBasicUsername(event.target.value)} placeholder="default" autoComplete="username" />
              </label>
              <label className="field-block">
                <FieldLabel help="Password for REST Basic Auth calls. It is only used for this browser action.">Basic password</FieldLabel>
                <input className="text-input" type="password" value={basicPassword} onChange={(event) => setBasicPassword(event.target.value)} placeholder="default" autoComplete="current-password" />
              </label>
              <label className="field-block wide">
                <FieldLabel help="Access token sent as Authorization: Bearer. It must include permission for this endpoint.">OAuth bearer token</FieldLabel>
                <input className="text-input" value={oauthToken} onChange={(event) => setOauthToken(event.target.value)} placeholder="Paste an issued OAuth access token." />
              </label>
              <label className="field-block wide">
                <FieldLabel help="JSON arguments sent to the tool call. These should match the generated MCP inputSchema.">Arguments JSON</FieldLabel>
                <textarea className="text-area console-arguments" value={argumentsJson} onChange={(event) => setArgumentsJson(event.target.value)} />
                {argumentsError ? <p className="field-error">{argumentsError}</p> : <p className="field-hint">Validated locally before REST execution.</p>}
              </label>
              <div className="console-actions">
                <button className="secondary-button" type="button" disabled>Use REST execution from this console</button>
                <button className="secondary-button" type="button" onClick={() => void runRestCall()} disabled={consoleState.status === "running" || authMode === "oauth" || Boolean(argumentsError)}>
                  {consoleState.status === "running" ? "Running REST call" : "Run REST call"}
                </button>
              </div>
              {consoleState.message ? <p className={`form-message ${consoleState.status}`}>{consoleState.message}</p> : null}
            </div>

            <div className="console-evidence-grid" aria-label="Console evidence">
              <EvidencePanel title="Raw request" value={rawRequestEvidence} />
              <EvidencePanel title="Raw response" value={consoleState.rawResponse} />
              <EvidencePanel title="Matched case" value={consoleState.matchedCase} compact />
              <EvidencePanel title="Principal" value={consoleState.principal} compact />
              <EvidencePanel title="Elapsed time" value={consoleState.elapsedMs} compact />
            </div>
          </div>
        </EditorSection>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function EndpointSubNav({ endpointId, current }: { endpointId: string; current: EndpointView }) {
  const items: Array<[EndpointView, string, string]> = [
    ["overview", "Overview", `/endpoints/${endpointId}`],
    ["edit", "Edit", `/endpoints/${endpointId}/edit`],
    ["parameters", "Parameters", `/endpoints/${endpointId}/parameters`],
    ["responses", "Responses", `/endpoints/${endpointId}/responses`],
    ["failure", "Failure", `/endpoints/${endpointId}/failure`],
    ["console", "Console", `/endpoints/${endpointId}/console`],
    ["delete", "Delete", `/endpoints/${endpointId}/delete`],
  ];
  return (
    <nav className="sub-nav" aria-label="Endpoint workflow">
      {items.map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
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
