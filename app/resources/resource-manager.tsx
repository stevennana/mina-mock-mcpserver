"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Play, Plus, Save, Trash2 } from "lucide-react";
import { CopyButton } from "@/app/copy-button";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatShortDate } from "@/lib/date-format";
import type { McpFixtureListResult, McpResourceDetail, McpResourceInput, McpResourceSummary } from "@/lib/mcp-fixtures/types";

type ResourceFormState = McpResourceInput & { id?: string };

export type ResourceView = "catalog" | "create" | "overview" | "edit" | "content" | "console" | "delete";

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "confirming" | "deleting" | "error" | "success";
  message: string;
};

const blankResource: ResourceFormState = {
  uri: "",
  name: "",
  title: "",
  description: "",
  mimeType: "text/plain",
  enabled: true,
  textContent: "Context for MCP clients.",
  blobContentBase64: null,
  annotationsJson: "",
};

const RESOURCE_FLASH_KEY = "mcp-mock-resource-flash";

function detailToForm(resource: McpResourceDetail): ResourceFormState {
  return {
    id: resource.id,
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
    enabled: resource.enabled,
    textContent: resource.textContent ?? "",
    blobContentBase64: resource.blobContentBase64 ?? null,
    annotationsJson: resource.annotationsJson ?? "",
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

function resourceReadRequest(uri: string) {
  return {
    jsonrpc: "2.0",
    id: "read-resource",
    method: "resources/read",
    params: {
      uri: uri || "mock://resources/example",
    },
  };
}

function resourceReadResponse(resource: ResourceFormState) {
  const content = resource.blobContentBase64
    ? { uri: resource.uri || "mock://resources/example", mimeType: resource.mimeType, blob: resource.blobContentBase64 }
    : { uri: resource.uri || "mock://resources/example", mimeType: resource.mimeType, text: resource.textContent ?? "" };
  return {
    jsonrpc: "2.0",
    id: "read-resource",
    result: {
      contents: [content],
    },
  };
}

export function ResourceManager({
  initialData,
  initialDetail = null,
  view = "catalog",
}: {
  initialData: McpFixtureListResult<McpResourceSummary>;
  initialDetail?: McpResourceDetail | null;
  view?: ResourceView;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ResourceFormState>(initialDetail ? detailToForm(initialDetail) : blankResource);
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    const rawFlash = window.sessionStorage.getItem(RESOURCE_FLASH_KEY);
    if (!rawFlash) return;
    try {
      const flash = JSON.parse(rawFlash) as { id?: string; message?: string };
      if (flash.id === selectedId && typeof flash.message === "string") {
        setSaveState({ status: "success", message: flash.message, fieldErrors: {} });
        window.sessionStorage.removeItem(RESOURCE_FLASH_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(RESOURCE_FLASH_KEY);
    }
  }, [selectedId]);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.items;
    return listData.items.filter((resource) => {
      return (
        resource.name.toLowerCase().includes(normalized) ||
        resource.uri.toLowerCase().includes(normalized) ||
        resource.title.toLowerCase().includes(normalized) ||
        resource.description.toLowerCase().includes(normalized)
      );
    });
  }, [listData.items, query]);

  const requestPreview = JSON.stringify(resourceReadRequest(form.uri), null, 2);
  const responsePreview = JSON.stringify(resourceReadResponse(form), null, 2);
  const canSave = ["create", "edit", "content"].includes(view);
  const fieldErrors = saveState.fieldErrors;
  const pageTitleByView: Record<ResourceView, string> = {
    catalog: "Resource catalog",
    create: "Create resource",
    overview: "Resource overview",
    edit: "Edit resource metadata",
    content: "Resource content",
    console: "Resource read preview",
    delete: "Delete resource",
  };

  async function refreshList() {
    const response = await fetch("/api/resources");
    if (!response.ok) throw new Error("Unable to load resources.");
    setListData(await response.json());
  }

  function updateForm<K extends keyof ResourceFormState>(key: K, value: ResourceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveResource() {
    setSaveState({ status: "saving", message: "Saving resource.", fieldErrors: {} });
    const isCreate = !selectedId;
    const target = selectedId ? `/api/resources/${selectedId}` : "/api/resources";
    const method = selectedId ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, blobContentBase64: null }),
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

      const resource = payload.resource as McpResourceDetail;
      setForm(detailToForm(resource));
      setSelectedId(resource.id);
      await refreshList();
      router.refresh();
      const successState: SaveState = { status: "success", message: "Resource saved.", fieldErrors: {} };
      if (isCreate) {
        window.sessionStorage.setItem(RESOURCE_FLASH_KEY, JSON.stringify({ id: resource.id, message: successState.message }));
        router.push(`/resources/${resource.id}`);
      }
      setSaveState(successState);
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedResource() {
    if (!selectedId) return;
    setDeleteState({ status: "deleting", message: "Deleting resource." });
    try {
      const response = await fetch(`/api/resources/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Resource delete failed.",
        });
        return;
      }
      setForm(blankResource);
      setSelectedId(null);
      setDeleteConfirm(false);
      await refreshList();
      router.refresh();
      router.push("/resources");
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "Resource delete failed." });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
        <section className="endpoint-list-panel" aria-labelledby="resource-list-title">
          <div className="section-heading-row">
            <div>
              <h2 id="resource-list-title">Resource catalog</h2>
              <p>{listData.total} direct resources, {listData.enabled} enabled</p>
            </div>
            <Link className="primary-button button-link" href="/resources/new">
              <Plus className="button-icon" aria-hidden="true" />
              New resource
            </Link>
          </div>

          <label className="field-label" htmlFor="resource-search">Search</label>
          <input
            id="resource-search"
            className="text-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="URI, name, title, or description"
          />

          <div className="endpoint-table-shell" aria-live="polite">
            <table className="endpoint-table resource-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Status</th>
                  <th>MIME type</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((resource) => (
                  <tr key={resource.id}>
                    <td>
                      <Link className="table-link" href={`/resources/${resource.id}`}>
                        {resource.name}
                      </Link>
                      <span>{resource.title || "Untitled resource"}</span>
                      <span>{resource.uri}</span>
                    </td>
                    <td>
                      <span className={resource.enabled ? "status-pill enabled" : "status-pill"}>{resource.enabled ? "Enabled" : "Disabled"}</span>
                    </td>
                    <td>{resource.mimeType}</td>
                    <td>{formatShortDate(resource.updatedAt)}</td>
                  </tr>
                ))}
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">No resources match this search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view !== "catalog" ? (
        <section className="endpoint-editor-panel" aria-labelledby="resource-editor-title">
          <div className="section-heading-row">
            <div>
              <h2 id="resource-editor-title">{pageTitleByView[view]}</h2>
              <p>Direct, read-only application-controlled context for MCP clients.</p>
            </div>
            {canSave ? (
              <button className="primary-button" type="button" onClick={() => void saveResource()} disabled={saveState.status === "saving"}>
                <Save className="button-icon" aria-hidden="true" />
                {saveState.status === "saving" ? "Saving" : "Save"}
              </button>
            ) : null}
          </div>

          {selectedId ? <ResourceSubNav resourceId={selectedId} current={view} /> : null}

          {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

          {view === "overview" ? (
            <div className="editor-section">
              <h3>Runtime summary</h3>
              <dl className="detail-grid">
                <div><dt>URI</dt><dd>{form.uri}</dd></div>
                <div><dt>Name</dt><dd>{form.name}</dd></div>
                <div><dt>Status</dt><dd>{form.enabled ? "Enabled" : "Disabled"}</dd></div>
                <div><dt>MIME type</dt><dd>{form.mimeType}</dd></div>
                <div><dt>Content kind</dt><dd>{form.blobContentBase64 ? "Blob" : "Text"}</dd></div>
                <div><dt>Protected default</dt><dd>{initialDetail?.protectedDefault ? "Yes" : "No"}</dd></div>
              </dl>
              <div className="quick-action-grid">
                <Link className="secondary-button button-link" href={`/resources/${selectedId}/edit`}>Edit metadata</Link>
                <Link className="secondary-button button-link" href={`/resources/${selectedId}/content`}>Edit content</Link>
                <Link className="secondary-button button-link" href={`/resources/${selectedId}/console`}>Preview read</Link>
              </div>
            </div>
          ) : null}

          {["create", "edit"].includes(view) ? (
            <div className="form-grid">
              <label className="field-block wide">
                <FieldLabel help="Stable absolute MCP resource URI used by clients in resources/read. Resources are application-controlled context, not files from this server.">URI</FieldLabel>
                <input className="text-input" value={form.uri} onChange={(event) => updateForm("uri", event.target.value)} placeholder="mock://resources/customer-notes" />
                {errorFor(fieldErrors, "uri")}
              </label>
              <label className="field-block">
                <FieldLabel help="Short client-facing identifier for this context resource. Use letters, numbers, underscores, or hyphens.">Name</FieldLabel>
                <input className="text-input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
                {errorFor(fieldErrors, "name")}
              </label>
              <label className="field-block">
                <FieldLabel help="Human-readable label shown in the admin UI and MCP resource metadata.">Title</FieldLabel>
                <input className="text-input" value={form.title ?? ""} onChange={(event) => updateForm("title", event.target.value)} />
                {errorFor(fieldErrors, "title")}
              </label>
              <label className="field-block">
                <FieldLabel help="MIME type returned with resources/read content. Use text/plain or application/json for text resources.">MIME type</FieldLabel>
                <input className="text-input" value={form.mimeType} onChange={(event) => updateForm("mimeType", event.target.value)} />
                {errorFor(fieldErrors, "mimeType")}
              </label>
              <label className="field-block wide">
                <FieldLabel help="Client-facing description that explains when this context resource is useful.">Description</FieldLabel>
                <textarea className="text-area short" value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} />
                {errorFor(fieldErrors, "description")}
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} />
                <span className="field-label-row">Enabled in resource catalogs <HelpTooltip text="Enabled resources appear in future MCP resources/list runtime handlers. Disabled resources stay editable but should not be readable by clients." /></span>
              </label>
              <label className="field-block wide">
                <FieldLabel help="Optional MCP annotations JSON object, such as audience or priority. Content stays app-controlled and read-only to clients.">Annotations JSON</FieldLabel>
                <textarea className="text-area short" value={form.annotationsJson ?? ""} onChange={(event) => updateForm("annotationsJson", event.target.value)} />
                {errorFor(fieldErrors, "annotationsJson")}
              </label>
              {view === "create" ? (
                <label className="field-block wide">
                  <FieldLabel help="Text returned by resources/read. This task intentionally supports direct text resources and does not add file upload or filesystem browsing.">Text content</FieldLabel>
                  <textarea className="text-area" value={form.textContent ?? ""} onChange={(event) => updateForm("textContent", event.target.value)} />
                  {errorFor(fieldErrors, "textContent")}
                </label>
              ) : null}
            </div>
          ) : null}

          {view === "content" ? (
            <EditorSection title="Text content">
              <label className="field-block">
                <FieldLabel help="Read-only context body returned by resources/read. Keep secrets out of mock resource content because this public admin UI is intentionally open.">Text content</FieldLabel>
                <textarea className="text-area resource-content-area" value={form.textContent ?? ""} onChange={(event) => updateForm("textContent", event.target.value)} />
                {errorFor(fieldErrors, "textContent")}
              </label>
              {errorFor(fieldErrors, "blobContentBase64")}
              <p className="section-note">Direct text resources only. File upload, filesystem browsing, and URI templates are outside this task.</p>
            </EditorSection>
          ) : null}

          {view === "console" ? (
            <EditorSection title="Resource read preview">
              <div className="console-shell">
                <p className="section-note">
                  This previews the exact JSON-RPC shape for `resources/read`; runtime MCP handlers are delivered in a later task.
                </p>
                <div className="console-actions">
                  <CopyButton value={requestPreview} label="Copy request" />
                  <CopyButton value={responsePreview} label="Copy response" />
                </div>
                <div className="console-evidence-grid" aria-label="Resource read evidence">
                  <EvidencePanel title="resources/read request" value={requestPreview} />
                  <EvidencePanel title="resources/read response" value={responsePreview} />
                  <EvidencePanel title="Runtime availability" value={form.enabled ? "Enabled resource. Runtime handler pending task 031." : "Disabled resource. Preview only."} compact />
                </div>
              </div>
            </EditorSection>
          ) : null}

          {selectedId && view === "delete" ? (
            <EditorSection title="Delete resource">
              <p className="section-note">Delete removes this direct resource from the admin catalog. Submitted content is not written into audit metadata.</p>
              {deleteState.message ? <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p> : null}
              {deleteState.status === "confirming" || deleteState.status === "deleting" || deleteState.status === "error" ? (
                <div className="delete-confirmation">
                  <label className="toggle-row">
                    <input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />
                    <span>I understand this resource will be deleted.</span>
                  </label>
                  <div className="console-actions">
                    <button className="danger-button" type="button" onClick={() => void deleteSelectedResource()} disabled={!deleteConfirm || deleteState.status === "deleting"}>
                      <Trash2 className="button-icon" aria-hidden="true" />
                      {deleteState.status === "deleting" ? "Deleting" : "Confirm delete"}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setDeleteState({ status: "idle", message: "" })}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="danger-button" type="button" onClick={() => setDeleteState({ status: "confirming", message: "" })}>
                  <Trash2 className="button-icon" aria-hidden="true" />
                  Delete resource
                </button>
              )}
            </EditorSection>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ResourceSubNav({ resourceId, current }: { resourceId: string; current: ResourceView }) {
  const items: Array<[ResourceView, string, string, ReactNode]> = [
    ["overview", "Overview", `/resources/${resourceId}`, <FileText className="button-icon" aria-hidden="true" key="overview" />],
    ["edit", "Edit", `/resources/${resourceId}/edit`, <Save className="button-icon" aria-hidden="true" key="edit" />],
    ["content", "Content", `/resources/${resourceId}/content`, <Check className="button-icon" aria-hidden="true" key="content" />],
    ["console", "Preview", `/resources/${resourceId}/console`, <Play className="button-icon" aria-hidden="true" key="console" />],
    ["delete", "Delete", `/resources/${resourceId}/delete`, <Trash2 className="button-icon" aria-hidden="true" key="delete" />],
  ];
  return (
    <nav className="sub-nav" aria-label="Resource workflow">
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
