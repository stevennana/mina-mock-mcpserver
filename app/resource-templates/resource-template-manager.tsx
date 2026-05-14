"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, FileText, ListPlus, Play, Plus, Save, Trash2 } from "lucide-react";
import { CopyButton } from "@/app/copy-button";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatShortDate } from "@/lib/date-format";
import { renderValidatedTemplate } from "@/lib/mcp-fixtures/template-render";
import type {
  McpFixtureListResult,
  McpResourceTemplateDetail,
  McpResourceTemplateInput,
  McpResourceTemplateSummary,
} from "@/lib/mcp-fixtures/types";

type ResourceTemplateFormState = McpResourceTemplateInput & { id?: string };

export type ResourceTemplateView =
  | "catalog"
  | "create"
  | "overview"
  | "edit"
  | "arguments"
  | "content"
  | "completion"
  | "console"
  | "delete";

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "confirming" | "deleting" | "error";
  message: string;
};

const blankTemplate: ResourceTemplateFormState = {
  uriTemplate: "resource://mock/tool/{name}",
  name: "",
  title: "",
  description: "",
  mimeType: "text/plain",
  enabled: true,
  annotationsJson: "",
  textTemplate: "Rendered mock content for {name}.",
  blobTemplateBase64: null,
  arguments: [{ name: "name", description: "Mock tool or resource name.", required: true, sampleValueJson: "\"echo\"" }],
  completionCandidates: [{ argumentName: "name", value: "echo", label: "Echo tool" }],
};

const RESOURCE_TEMPLATE_FLASH_KEY = "mcp-mock-resource-template-flash";

function detailToForm(template: McpResourceTemplateDetail): ResourceTemplateFormState {
  return {
    id: template.id,
    uriTemplate: template.uriTemplate,
    name: template.name,
    title: template.title,
    description: template.description,
    mimeType: template.mimeType,
    enabled: template.enabled,
    annotationsJson: template.annotationsJson ?? "",
    textTemplate: template.textTemplate ?? "",
    blobTemplateBase64: template.blobTemplateBase64 ?? null,
    arguments: template.arguments.map((argument) => ({
      name: argument.name,
      description: argument.description,
      required: argument.required,
      sampleValueJson: argument.sampleValueJson ?? "",
    })),
    completionCandidates: template.completionCandidates.map((candidate) => ({
      argumentName: candidate.argumentName,
      value: candidate.value,
      label: candidate.label,
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

function buildTemplateListResponse(template: ResourceTemplateFormState) {
  return {
    jsonrpc: "2.0",
    id: "list-resource-templates",
    result: {
      resourceTemplates: [
        {
          uriTemplate: template.uriTemplate || "resource://mock/tool/{name}",
          name: template.name || "mock_template",
          title: template.title || undefined,
          description: template.description || undefined,
          mimeType: template.mimeType,
        },
      ],
    },
  };
}

function buildReadRequest(renderedUri: string) {
  return {
    jsonrpc: "2.0",
    id: "read-rendered-resource",
    method: "resources/read",
    params: { uri: renderedUri || "resource://mock/tool/echo" },
  };
}

function buildReadResponse(template: ResourceTemplateFormState, renderedUri: string, renderedContent: string) {
  return {
    jsonrpc: "2.0",
    id: "read-rendered-resource",
    result: {
      contents: [{ uri: renderedUri || "resource://mock/tool/echo", mimeType: template.mimeType, text: renderedContent }],
    },
  };
}

function buildCompletionPreview(template: ResourceTemplateFormState) {
  const argumentName = template.arguments[0]?.name ?? "name";
  const firstCandidate = template.completionCandidates.find((candidate) => candidate.argumentName === argumentName);
  const prefix = firstCandidate?.value.slice(0, 1) ?? "";
  const values = template.completionCandidates
    .filter((candidate) => candidate.argumentName === argumentName && candidate.value.startsWith(prefix))
    .slice(0, 100)
    .map((candidate) => ({ value: candidate.value, label: candidate.label || undefined }));

  return {
    request: {
      jsonrpc: "2.0",
      id: "complete-resource-template",
      method: "completion/complete",
      params: {
        ref: { type: "ref/resource", uri: template.uriTemplate || "resource://mock/tool/{name}" },
        argument: { name: argumentName, value: prefix },
      },
    },
    response: {
      jsonrpc: "2.0",
      id: "complete-resource-template",
      result: { completion: { values, total: values.length, hasMore: false } },
    },
  };
}

export function ResourceTemplateManager({
  initialData,
  initialDetail = null,
  view = "catalog",
}: {
  initialData: McpFixtureListResult<McpResourceTemplateSummary>;
  initialDetail?: McpResourceTemplateDetail | null;
  view?: ResourceTemplateView;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ResourceTemplateFormState>(initialDetail ? detailToForm(initialDetail) : blankTemplate);
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    const rawFlash = window.sessionStorage.getItem(RESOURCE_TEMPLATE_FLASH_KEY);
    if (!rawFlash) return;
    try {
      const flash = JSON.parse(rawFlash) as { id?: string; message?: string };
      if (flash.id === selectedId && typeof flash.message === "string") {
        setSaveState({ status: "success", message: flash.message, fieldErrors: {} });
        window.sessionStorage.removeItem(RESOURCE_TEMPLATE_FLASH_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(RESOURCE_TEMPLATE_FLASH_KEY);
    }
  }, [selectedId]);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.items;
    return listData.items.filter((template) =>
      [template.name, template.uriTemplate, template.title, template.description].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [listData.items, query]);

  const renderedUri = renderValidatedTemplate(form.uriTemplate, form.arguments, { encodeValues: true });
  const renderedContent = renderValidatedTemplate(form.textTemplate ?? "", form.arguments);
  const completionPreview = buildCompletionPreview(form);
  const listPreview = JSON.stringify(buildTemplateListResponse(form), null, 2);
  const readRequestPreview = JSON.stringify(buildReadRequest(renderedUri.value), null, 2);
  const readResponsePreview = JSON.stringify(buildReadResponse(form, renderedUri.value, renderedContent.value), null, 2);
  const completionRequestPreview = JSON.stringify(completionPreview.request, null, 2);
  const completionResponsePreview = JSON.stringify(completionPreview.response, null, 2);
  const canSave = ["create", "edit", "arguments", "content", "completion"].includes(view);
  const fieldErrors = saveState.fieldErrors;
  const pageTitleByView: Record<ResourceTemplateView, string> = {
    catalog: "Resource template catalog",
    create: "Create resource template",
    overview: "Resource template overview",
    edit: "Edit template metadata",
    arguments: "URI-template arguments",
    content: "Rendered mock content",
    completion: "Completion candidates",
    console: "Template console preview",
    delete: "Delete resource template",
  };

  async function refreshList() {
    const response = await fetch("/api/resource-templates");
    if (!response.ok) throw new Error("Unable to load resource templates.");
    setListData(await response.json());
  }

  function updateForm<K extends keyof ResourceTemplateFormState>(key: K, value: ResourceTemplateFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveTemplate() {
    setSaveState({ status: "saving", message: "Saving resource template.", fieldErrors: {} });
    const isCreate = !selectedId;
    const target = selectedId ? `/api/resource-templates/${selectedId}` : "/api/resource-templates";
    const method = selectedId ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, blobTemplateBase64: null }),
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

      const template = payload.template as McpResourceTemplateDetail;
      setForm(detailToForm(template));
      setSelectedId(template.id);
      await refreshList();
      router.refresh();
      const successState: SaveState = { status: "success", message: "Resource template saved.", fieldErrors: {} };
      if (isCreate) {
        window.sessionStorage.setItem(RESOURCE_TEMPLATE_FLASH_KEY, JSON.stringify({ id: template.id, message: successState.message }));
        router.push(`/resource-templates/${template.id}`);
      }
      setSaveState(successState);
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedTemplate() {
    if (!selectedId) return;
    setDeleteState({ status: "deleting", message: "Deleting resource template." });
    try {
      const response = await fetch(`/api/resource-templates/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Resource template delete failed.",
        });
        return;
      }
      setForm(blankTemplate);
      setSelectedId(null);
      setDeleteConfirm(false);
      await refreshList();
      router.refresh();
      router.push("/resource-templates");
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "Resource template delete failed." });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
        <section className="endpoint-list-panel" aria-labelledby="resource-template-list-title">
          <div className="section-heading-row">
            <div>
              <h2 id="resource-template-list-title">Resource template catalog</h2>
              <p>{listData.total} templates, {listData.enabled} enabled</p>
            </div>
            <Link className="primary-button button-link" href="/resource-templates/new">
              <Plus className="button-icon" aria-hidden="true" />
              New template
            </Link>
          </div>

          <label className="field-label" htmlFor="resource-template-search">Search</label>
          <input
            id="resource-template-search"
            className="text-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="URI template, name, title, or description"
          />

          <div className="endpoint-table-shell" aria-live="polite">
            <table className="endpoint-table resource-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Arguments</th>
                  <th>Completion</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <Link className="table-link" href={`/resource-templates/${template.id}`}>
                        {template.name}
                      </Link>
                      <span>{template.title || "Untitled template"}</span>
                      <span>{template.uriTemplate}</span>
                    </td>
                    <td>
                      <span className={template.enabled ? "status-pill enabled" : "status-pill"}>{template.enabled ? "Enabled" : "Disabled"}</span>
                    </td>
                    <td>{template.argumentCount}</td>
                    <td>{template.completionCandidateCount}</td>
                    <td>{formatShortDate(template.updatedAt)}</td>
                  </tr>
                ))}
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">No resource templates match this search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view !== "catalog" ? (
        <section className="endpoint-editor-panel" aria-labelledby="resource-template-editor-title">
          <div className="section-heading-row">
            <div>
              <h2 id="resource-template-editor-title">{pageTitleByView[view]}</h2>
              <p>Parameterized MCP context discovered through resources/templates/list.</p>
            </div>
            {canSave ? (
              <button className="primary-button" type="button" onClick={() => void saveTemplate()} disabled={saveState.status === "saving"}>
                <Save className="button-icon" aria-hidden="true" />
                {saveState.status === "saving" ? "Saving" : "Save"}
              </button>
            ) : null}
          </div>

          {selectedId ? <ResourceTemplateSubNav templateId={selectedId} current={view} /> : null}
          {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

          {view === "overview" ? (
            <EditorSection title="Runtime summary">
              <dl className="detail-grid">
                <div><dt>URI template</dt><dd>{form.uriTemplate}</dd></div>
                <div><dt>Rendered sample URI</dt><dd>{renderedUri.value}</dd></div>
                <div><dt>Name</dt><dd>{form.name}</dd></div>
                <div><dt>Status</dt><dd>{form.enabled ? "Enabled" : "Disabled"}</dd></div>
                <div><dt>Arguments</dt><dd>{form.arguments.length}</dd></div>
                <div><dt>Completion candidates</dt><dd>{form.completionCandidates.length}</dd></div>
              </dl>
              <div className="quick-action-grid">
                <Link className="secondary-button button-link" href={`/resource-templates/${selectedId}/edit`}>Edit metadata</Link>
                <Link className="secondary-button button-link" href={`/resource-templates/${selectedId}/arguments`}>Edit arguments</Link>
                <Link className="secondary-button button-link" href={`/resource-templates/${selectedId}/content`}>Edit content</Link>
                <Link className="secondary-button button-link" href={`/resource-templates/${selectedId}/completion`}>Edit completion</Link>
                <Link className="secondary-button button-link" href={`/resource-templates/${selectedId}/console`}>Preview protocol</Link>
              </div>
            </EditorSection>
          ) : null}

          {["create", "edit"].includes(view) ? (
            <div className="form-grid">
              <label className="field-block wide">
                <FieldLabel help="URI template exposed to clients through resources/templates/list. Placeholders such as {name} must have matching argument rows.">URI template</FieldLabel>
                <input className="text-input" value={form.uriTemplate} onChange={(event) => updateForm("uriTemplate", event.target.value)} placeholder="resource://mock/tool/{name}" />
                {errorFor(fieldErrors, "uriTemplate")}
              </label>
              <label className="field-block">
                <FieldLabel help="Short client-facing identifier for this resource template. Use letters, numbers, underscores, or hyphens.">Name</FieldLabel>
                <input className="text-input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
                {errorFor(fieldErrors, "name")}
              </label>
              <label className="field-block">
                <FieldLabel help="Human-readable label shown in the admin UI and MCP resource-template metadata.">Title</FieldLabel>
                <input className="text-input" value={form.title ?? ""} onChange={(event) => updateForm("title", event.target.value)} />
                {errorFor(fieldErrors, "title")}
              </label>
              <label className="field-block">
                <FieldLabel help="MIME type returned with the rendered resources/read content preview.">MIME type</FieldLabel>
                <input className="text-input" value={form.mimeType} onChange={(event) => updateForm("mimeType", event.target.value)} />
                {errorFor(fieldErrors, "mimeType")}
              </label>
              <label className="field-block wide">
                <FieldLabel help="Client-facing description that explains how clients should use this parameterized context.">Description</FieldLabel>
                <textarea className="text-area short" value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} />
                {errorFor(fieldErrors, "description")}
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} />
                <span className="field-label-row">Enabled in template catalogs <HelpTooltip text="Enabled templates appear in MCP resources/templates/list and can render matching resource URIs. Disabled templates remain editable." /></span>
              </label>
              <label className="field-block wide">
                <FieldLabel help="Optional MCP annotations JSON object. This is metadata only and never fetches external content.">Annotations JSON</FieldLabel>
                <textarea className="text-area short" value={form.annotationsJson ?? ""} onChange={(event) => updateForm("annotationsJson", event.target.value)} />
                {errorFor(fieldErrors, "annotationsJson")}
              </label>
            </div>
          ) : null}

          {view === "arguments" || view === "create" ? (
            <EditorSection title="URI-template arguments">
              <div className="stack">
                {form.arguments.map((argument, index) => (
                  <div className="parameter-editor template-argument-editor" key={`${argument.name}-${index}`}>
                    <label className="field-block">
                      <FieldLabel help="Argument name must match a {placeholder} in the URI template.">Name</FieldLabel>
                      <input className="text-input" value={argument.name} onChange={(event) => updateArgument(index, "name", event.target.value)} />
                      {errorFor(fieldErrors, `arguments.${index}.name`)}
                    </label>
                    <label className="toggle-row">
                      <input type="checkbox" checked={argument.required ?? true} onChange={(event) => updateArgument(index, "required", event.target.checked)} />
                      <span>Required</span>
                    </label>
                    <label className="field-block">
                      <FieldLabel help='Sample JSON value used only to render this admin preview, for example "echo".'>Sample JSON</FieldLabel>
                      <input className="text-input" value={argument.sampleValueJson ?? ""} onChange={(event) => updateArgument(index, "sampleValueJson", event.target.value)} />
                      {errorFor(fieldErrors, `arguments.${index}.sampleValueJson`)}
                    </label>
                    <label className="field-block parameter-description">
                      <FieldLabel help="Description shown to client developers inspecting this template.">Description</FieldLabel>
                      <input className="text-input" value={argument.description ?? ""} onChange={(event) => updateArgument(index, "description", event.target.value)} />
                    </label>
                    <button className="secondary-button" type="button" onClick={() => removeArgument(index)} disabled={form.arguments.length <= 1}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="console-actions">
                <button className="secondary-button" type="button" onClick={addArgument}>
                  <ListPlus className="button-icon" aria-hidden="true" />
                  Add argument
                </button>
              </div>
              <p className="section-note">Rendered sample URI: <code>{renderedUri.value}</code></p>
              {renderedUri.errors.map((error) => <p className="field-error" key={error}>{error}</p>)}
            </EditorSection>
          ) : null}

          {view === "content" || view === "create" ? (
            <EditorSection title="Rendered mock content">
              <label className="field-block">
                <FieldLabel help="Text template returned by the resources/read preview after sample argument substitution. No external URI or network fetch is performed.">Text template</FieldLabel>
                <textarea className="text-area resource-content-area" value={form.textTemplate ?? ""} onChange={(event) => updateForm("textTemplate", event.target.value)} />
                {errorFor(fieldErrors, "textTemplate")}
              </label>
              {errorFor(fieldErrors, "blobTemplateBase64")}
              <div className="console-evidence-grid" aria-label="Rendered template evidence">
                <EvidencePanel title="Rendered URI" value={renderedUri.value} compact />
                <EvidencePanel title="Rendered content" value={renderedContent.value} compact />
              </div>
              {renderedContent.errors.map((error) => <p className="field-error" key={error}>{error}</p>)}
            </EditorSection>
          ) : null}

          {view === "completion" ? (
            <EditorSection title="Completion candidates">
              <div className="stack">
                {form.completionCandidates.map((candidate, index) => (
                  <div className="case-editor completion-candidate-editor" key={`${candidate.argumentName}-${candidate.value}-${index}`}>
                    <label className="field-block">
                      <FieldLabel help="Existing template argument this completion value belongs to.">Argument</FieldLabel>
                      <select className="text-input" value={candidate.argumentName} onChange={(event) => updateCandidate(index, "argumentName", event.target.value)}>
                        {form.arguments.map((argument) => <option key={argument.name} value={argument.name}>{argument.name}</option>)}
                      </select>
                      {errorFor(fieldErrors, `completionCandidates.${index}.argumentName`)}
                    </label>
                    <label className="field-block">
                      <FieldLabel help="Candidate value later returned by completion/complete prefix matching.">Value</FieldLabel>
                      <input className="text-input" value={candidate.value} onChange={(event) => updateCandidate(index, "value", event.target.value)} />
                      {errorFor(fieldErrors, `completionCandidates.${index}.value`)}
                    </label>
                    <label className="field-block">
                      <FieldLabel help="Optional display label for the candidate.">Label</FieldLabel>
                      <input className="text-input" value={candidate.label ?? ""} onChange={(event) => updateCandidate(index, "label", event.target.value)} />
                      {errorFor(fieldErrors, `completionCandidates.${index}.label`)}
                    </label>
                    <button className="secondary-button" type="button" onClick={() => removeCandidate(index)}>Remove</button>
                  </div>
                ))}
                {form.completionCandidates.length === 0 ? <p className="section-note">No completion candidates configured.</p> : null}
              </div>
              {errorFor(fieldErrors, "completionCandidates")}
              <div className="console-actions">
                <button className="secondary-button" type="button" onClick={addCandidate}>
                  <ListPlus className="button-icon" aria-hidden="true" />
                  Add candidate
                </button>
              </div>
            </EditorSection>
          ) : null}

          {view === "console" ? (
            <EditorSection title="Template console preview">
              <div className="console-shell">
                <p className="section-note">Preview the MCP shapes served by resources/templates/list, resources/read, and completion/complete.</p>
                <div className="console-actions">
                  <CopyButton value={listPreview} label="Copy templates/list" />
                  <CopyButton value={readRequestPreview} label="Copy read request" />
                  <CopyButton value={completionRequestPreview} label="Copy completion request" />
                </div>
                <div className="console-evidence-grid" aria-label="Resource template protocol evidence">
                  <EvidencePanel title="resources/templates/list response" value={listPreview} />
                  <EvidencePanel title="resources/read request" value={readRequestPreview} />
                  <EvidencePanel title="resources/read response" value={readResponsePreview} />
                  <EvidencePanel title="completion/complete request" value={completionRequestPreview} />
                  <EvidencePanel title="completion/complete response" value={completionResponsePreview} />
                  <EvidencePanel title="Runtime availability" value={form.enabled ? "Enabled template. Runtime handlers pending tasks 031 and 032." : "Disabled template. Preview only."} compact />
                </div>
              </div>
            </EditorSection>
          ) : null}

          {selectedId && view === "delete" ? (
            <EditorSection title="Delete resource template">
              <p className="section-note">Delete removes this parameterized resource descriptor, its arguments, and its completion candidates.</p>
              {deleteState.message ? <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p> : null}
              {deleteState.status === "confirming" || deleteState.status === "deleting" || deleteState.status === "error" ? (
                <div className="delete-confirmation">
                  <label className="toggle-row">
                    <input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />
                    <span>I understand this resource template will be deleted.</span>
                  </label>
                  <div className="console-actions">
                    <button className="danger-button" type="button" onClick={() => void deleteSelectedTemplate()} disabled={!deleteConfirm || deleteState.status === "deleting"}>
                      <Trash2 className="button-icon" aria-hidden="true" />
                      {deleteState.status === "deleting" ? "Deleting" : "Confirm delete"}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setDeleteState({ status: "idle", message: "" })}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="danger-button" type="button" onClick={() => setDeleteState({ status: "confirming", message: "" })}>
                  <Trash2 className="button-icon" aria-hidden="true" />
                  Delete resource template
                </button>
              )}
            </EditorSection>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  function updateArgument<K extends keyof ResourceTemplateFormState["arguments"][number]>(index: number, key: K, value: ResourceTemplateFormState["arguments"][number][K]) {
    setForm((current) => ({
      ...current,
      arguments: current.arguments.map((argument, itemIndex) => (itemIndex === index ? { ...argument, [key]: value } : argument)),
    }));
  }

  function addArgument() {
    setForm((current) => ({
      ...current,
      arguments: [...current.arguments, { name: `arg${current.arguments.length + 1}`, description: "", required: true, sampleValueJson: "\"sample\"" }],
    }));
  }

  function removeArgument(index: number) {
    setForm((current) => {
      const removed = current.arguments[index]?.name;
      const nextArguments = current.arguments.filter((_argument, itemIndex) => itemIndex !== index);
      return {
        ...current,
        arguments: nextArguments,
        completionCandidates: current.completionCandidates.filter((candidate) => candidate.argumentName !== removed),
      };
    });
  }

  function updateCandidate<K extends keyof ResourceTemplateFormState["completionCandidates"][number]>(index: number, key: K, value: ResourceTemplateFormState["completionCandidates"][number][K]) {
    setForm((current) => ({
      ...current,
      completionCandidates: current.completionCandidates.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, [key]: value } : candidate)),
    }));
  }

  function addCandidate() {
    setForm((current) => ({
      ...current,
      completionCandidates: [
        ...current.completionCandidates,
        { argumentName: current.arguments[0]?.name ?? "", value: "sample", label: "Sample" },
      ],
    }));
  }

  function removeCandidate(index: number) {
    setForm((current) => ({
      ...current,
      completionCandidates: current.completionCandidates.filter((_candidate, itemIndex) => itemIndex !== index),
    }));
  }
}

function ResourceTemplateSubNav({ templateId, current }: { templateId: string; current: ResourceTemplateView }) {
  const items: Array<[ResourceTemplateView, string, string, ReactNode]> = [
    ["overview", "Overview", `/resource-templates/${templateId}`, <FileText className="button-icon" aria-hidden="true" key="overview" />],
    ["edit", "Edit", `/resource-templates/${templateId}/edit`, <Save className="button-icon" aria-hidden="true" key="edit" />],
    ["arguments", "Arguments", `/resource-templates/${templateId}/arguments`, <ListPlus className="button-icon" aria-hidden="true" key="arguments" />],
    ["content", "Content", `/resource-templates/${templateId}/content`, <Check className="button-icon" aria-hidden="true" key="content" />],
    ["completion", "Completion", `/resource-templates/${templateId}/completion`, <ListPlus className="button-icon" aria-hidden="true" key="completion" />],
    ["console", "Preview", `/resource-templates/${templateId}/console`, <Play className="button-icon" aria-hidden="true" key="console" />],
    ["delete", "Delete", `/resource-templates/${templateId}/delete`, <Trash2 className="button-icon" aria-hidden="true" key="delete" />],
  ];
  return (
    <nav className="sub-nav" aria-label="Resource template workflow">
      {items.map(([key, label, href, icon]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined}>
          {icon}
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
