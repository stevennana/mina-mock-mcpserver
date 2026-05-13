"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { FileText, ListPlus, MessageSquareText, Play, Plus, Save, Trash2 } from "lucide-react";
import { CopyButton } from "@/app/copy-button";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatShortDate } from "@/lib/date-format";
import type {
  McpFixtureListResult,
  McpPromptDetail,
  McpPromptInput,
  McpPromptSummary,
  McpResourceDetail,
} from "@/lib/mcp-fixtures/types";

type PromptFormState = McpPromptInput & { id?: string };
type SampleArguments = Record<string, string>;

export type PromptView = "catalog" | "create" | "overview" | "edit" | "arguments" | "messages" | "completion" | "console" | "delete";

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "confirming" | "deleting" | "error";
  message: string;
};

const blankPrompt: PromptFormState = {
  name: "",
  title: "",
  description: "",
  enabled: true,
  arguments: [{ name: "customer", title: "Customer", description: "Customer or account name.", required: true }],
  messages: [{ role: "user", textTemplate: "Write a concise support reply for {customer}.", resourceUri: null, resourceMimeType: null }],
  completionCandidates: [{ argumentName: "customer", value: "acme", label: "Acme" }],
};

const PROMPT_FLASH_KEY = "mcp-mock-prompt-flash";

function detailToForm(prompt: McpPromptDetail): PromptFormState {
  return {
    id: prompt.id,
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    enabled: prompt.enabled,
    arguments: prompt.arguments.map((argument) => ({
      name: argument.name,
      title: argument.title,
      description: argument.description,
      required: argument.required,
    })),
    messages: prompt.messages.map((message) => ({
      role: message.role,
      textTemplate: message.textTemplate ?? "",
      resourceUri: message.resourceUri ?? null,
      resourceMimeType: message.resourceMimeType ?? null,
    })),
    completionCandidates: prompt.completionCandidates.map((candidate) => ({
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

function renderTextTemplate(template: string, sampleArguments: SampleArguments) {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => sampleArguments[name] ?? "");
}

function buildSampleArguments(prompt: PromptFormState) {
  return Object.fromEntries(prompt.arguments.map((argument) => [argument.name, ""]));
}

function validateSampleArguments(prompt: PromptFormState, sampleArguments: SampleArguments) {
  const errors: Record<string, string> = {};
  prompt.arguments.forEach((argument) => {
    if (argument.required && !sampleArguments[argument.name]?.trim()) {
      errors[argument.name] = "Required argument is missing.";
    }
  });
  return errors;
}

function resourceByUri(resources: McpResourceDetail[]) {
  return new Map(resources.map((resource) => [resource.uri, resource]));
}

function buildListResponse(prompt: PromptFormState) {
  return {
    jsonrpc: "2.0",
    id: "list-prompts",
    result: {
      prompts: [
        {
          name: prompt.name || "mock_prompt",
          title: prompt.title || undefined,
          description: prompt.description || undefined,
          arguments: prompt.arguments.map((argument) => ({
            name: argument.name,
            title: argument.title || undefined,
            description: argument.description || undefined,
            required: argument.required,
          })),
        },
      ],
    },
  };
}

function buildGetRequest(prompt: PromptFormState, sampleArguments: SampleArguments) {
  return {
    jsonrpc: "2.0",
    id: "get-prompt",
    method: "prompts/get",
    params: {
      name: prompt.name || "mock_prompt",
      arguments: Object.fromEntries(Object.entries(sampleArguments).filter((entry) => entry[1].trim())),
    },
  };
}

function buildGetResponse(prompt: PromptFormState, resources: McpResourceDetail[], sampleArguments: SampleArguments) {
  const resourcesByUri = resourceByUri(resources);
  return {
    jsonrpc: "2.0",
    id: "get-prompt",
    result: {
      description: prompt.description || undefined,
      messages: prompt.messages.map((message) => {
        const content: Array<Record<string, string>> = [];
        if (message.textTemplate) {
          content.push({ type: "text", text: renderTextTemplate(message.textTemplate, sampleArguments) });
        }
        if (message.resourceUri) {
          const resource = resourcesByUri.get(message.resourceUri);
          if (resource) {
            content.push({
              type: "resource",
              uri: resource.uri,
              mimeType: message.resourceMimeType || resource.mimeType,
              text: resource.textContent ?? "",
            });
          }
        }
        return { role: message.role, content };
      }),
    },
  };
}

function buildCompletionPreview(prompt: PromptFormState) {
  const argumentName = prompt.arguments[0]?.name ?? "customer";
  const firstCandidate = prompt.completionCandidates.find((candidate) => candidate.argumentName === argumentName);
  const prefix = firstCandidate?.value.slice(0, 1) ?? "";
  const values = prompt.completionCandidates
    .filter((candidate) => candidate.argumentName === argumentName && candidate.value.startsWith(prefix))
    .slice(0, 100)
    .map((candidate) => ({ value: candidate.value, label: candidate.label || undefined }));

  return {
    request: {
      jsonrpc: "2.0",
      id: "complete-prompt",
      method: "completion/complete",
      params: {
        ref: { type: "ref/prompt", name: prompt.name || "mock_prompt" },
        argument: { name: argumentName, value: prefix },
      },
    },
    response: {
      jsonrpc: "2.0",
      id: "complete-prompt",
      result: { completion: { values, total: values.length, hasMore: false } },
    },
  };
}

export function PromptManager({
  initialData,
  initialDetail = null,
  enabledResources,
  view = "catalog",
}: {
  initialData: McpFixtureListResult<McpPromptSummary>;
  initialDetail?: McpPromptDetail | null;
  enabledResources: McpResourceDetail[];
  view?: PromptView;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PromptFormState>(initialDetail ? detailToForm(initialDetail) : blankPrompt);
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? null);
  const [sampleArguments, setSampleArguments] = useState<SampleArguments>(() => buildSampleArguments(initialDetail ? detailToForm(initialDetail) : blankPrompt));
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    setSampleArguments((current) => {
      const next = buildSampleArguments(form);
      for (const key of Object.keys(next)) {
        next[key] = current[key] ?? "";
      }
      return next;
    });
  }, [form.arguments]);

  useEffect(() => {
    if (!selectedId) return;
    const rawFlash = window.sessionStorage.getItem(PROMPT_FLASH_KEY);
    if (!rawFlash) return;
    try {
      const flash = JSON.parse(rawFlash) as { id?: string; message?: string };
      if (flash.id === selectedId && typeof flash.message === "string") {
        setSaveState({ status: "success", message: flash.message, fieldErrors: {} });
        window.sessionStorage.removeItem(PROMPT_FLASH_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(PROMPT_FLASH_KEY);
    }
  }, [selectedId]);

  const filteredPrompts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.items;
    return listData.items.filter((prompt) =>
      [prompt.name, prompt.title, prompt.description].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [listData.items, query]);

  const sampleErrors = validateSampleArguments(form, sampleArguments);
  const completionPreview = buildCompletionPreview(form);
  const listPreview = JSON.stringify(buildListResponse(form), null, 2);
  const getRequestPreview = JSON.stringify(buildGetRequest(form, sampleArguments), null, 2);
  const getResponsePreview = JSON.stringify(buildGetResponse(form, enabledResources, sampleArguments), null, 2);
  const completionRequestPreview = JSON.stringify(completionPreview.request, null, 2);
  const completionResponsePreview = JSON.stringify(completionPreview.response, null, 2);
  const canSave = ["create", "edit", "arguments", "messages", "completion"].includes(view);
  const fieldErrors = saveState.fieldErrors;
  const pageTitleByView: Record<PromptView, string> = {
    catalog: "Prompt catalog",
    create: "Create prompt",
    overview: "Prompt overview",
    edit: "Edit prompt metadata",
    arguments: "Prompt arguments",
    messages: "Prompt messages",
    completion: "Completion candidates",
    console: "Prompt console preview",
    delete: "Delete prompt",
  };

  async function refreshList() {
    const response = await fetch("/api/prompts");
    if (!response.ok) throw new Error("Unable to load prompts.");
    setListData(await response.json());
  }

  function updateForm<K extends keyof PromptFormState>(key: K, value: PromptFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePrompt() {
    setSaveState({ status: "saving", message: "Saving prompt.", fieldErrors: {} });
    const isCreate = !selectedId;
    const target = selectedId ? `/api/prompts/${selectedId}` : "/api/prompts";
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

      const prompt = payload.prompt as McpPromptDetail;
      setForm(detailToForm(prompt));
      setSelectedId(prompt.id);
      await refreshList();
      router.refresh();
      const successState: SaveState = { status: "success", message: "Prompt saved.", fieldErrors: {} };
      if (isCreate) {
        window.sessionStorage.setItem(PROMPT_FLASH_KEY, JSON.stringify({ id: prompt.id, message: successState.message }));
        router.push(`/prompts/${prompt.id}`);
      }
      setSaveState(successState);
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedPrompt() {
    if (!selectedId) return;
    setDeleteState({ status: "deleting", message: "Deleting prompt." });
    try {
      const response = await fetch(`/api/prompts/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({ status: "error", message: typeof payload.message === "string" ? payload.message : "Prompt delete failed." });
        return;
      }
      setForm(blankPrompt);
      setSelectedId(null);
      setDeleteConfirm(false);
      await refreshList();
      router.refresh();
      router.push("/prompts");
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "Prompt delete failed." });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
        <section className="endpoint-list-panel" aria-labelledby="prompt-list-title">
          <div className="section-heading-row">
            <div>
              <h2 id="prompt-list-title">Prompt catalog</h2>
              <p>{listData.total} prompts, {listData.enabled} enabled</p>
            </div>
            <Link className="primary-button button-link" href="/prompts/new">
              <Plus className="button-icon" aria-hidden="true" />
              New prompt
            </Link>
          </div>

          <label className="field-label" htmlFor="prompt-search">Search</label>
          <input id="prompt-search" className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title, or description" />

          <div className="endpoint-table-shell" aria-live="polite">
            <table className="endpoint-table resource-table">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Status</th>
                  <th>Arguments</th>
                  <th>Messages</th>
                  <th>Completion</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map((prompt) => (
                  <tr key={prompt.id}>
                    <td>
                      <Link className="table-link" href={`/prompts/${prompt.id}`}>{prompt.name}</Link>
                      <span>{prompt.title || "Untitled prompt"}</span>
                      <span>{prompt.description || "No description"}</span>
                    </td>
                    <td><span className={prompt.enabled ? "status-pill enabled" : "status-pill"}>{prompt.enabled ? "Enabled" : "Disabled"}</span></td>
                    <td>{prompt.argumentCount}</td>
                    <td>{prompt.messageCount}</td>
                    <td>{prompt.completionCandidateCount}</td>
                    <td>{formatShortDate(prompt.updatedAt)}</td>
                  </tr>
                ))}
                {filteredPrompts.length === 0 ? (
                  <tr><td colSpan={6} className="empty-cell">No prompts match this search.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view !== "catalog" ? (
        <section className="endpoint-editor-panel" aria-labelledby="prompt-editor-title">
          <div className="section-heading-row">
            <div>
              <h2 id="prompt-editor-title">{pageTitleByView[view]}</h2>
              <p>User-controlled templates requested by MCP clients through prompts/get.</p>
            </div>
            {canSave ? (
              <button className="primary-button" type="button" onClick={() => void savePrompt()} disabled={saveState.status === "saving"}>
                <Save className="button-icon" aria-hidden="true" />
                {saveState.status === "saving" ? "Saving" : "Save"}
              </button>
            ) : null}
          </div>

          {selectedId ? <PromptSubNav promptId={selectedId} current={view} /> : null}
          {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

          {view === "overview" ? (
            <EditorSection title="Runtime summary">
              <dl className="detail-grid">
                <div><dt>Name</dt><dd>{form.name}</dd></div>
                <div><dt>Title</dt><dd>{form.title || "Untitled prompt"}</dd></div>
                <div><dt>Status</dt><dd>{form.enabled ? "Enabled" : "Disabled"}</dd></div>
                <div><dt>Arguments</dt><dd>{form.arguments.length}</dd></div>
                <div><dt>Messages</dt><dd>{form.messages.length}</dd></div>
                <div><dt>Completion candidates</dt><dd>{form.completionCandidates.length}</dd></div>
              </dl>
              <div className="quick-action-grid">
                <Link className="secondary-button button-link" href={`/prompts/${selectedId}/edit`}>Edit metadata</Link>
                <Link className="secondary-button button-link" href={`/prompts/${selectedId}/arguments`}>Edit arguments</Link>
                <Link className="secondary-button button-link" href={`/prompts/${selectedId}/messages`}>Edit messages</Link>
                <Link className="secondary-button button-link" href={`/prompts/${selectedId}/completion`}>Edit completion</Link>
                <Link className="secondary-button button-link" href={`/prompts/${selectedId}/console`}>Preview protocol</Link>
              </div>
            </EditorSection>
          ) : null}

          {["create", "edit"].includes(view) ? (
            <div className="form-grid">
              <label className="field-block">
                <FieldLabel help="Short client-facing prompt identifier used in prompts/get. Use letters, numbers, underscores, or hyphens.">Name</FieldLabel>
                <input className="text-input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
                {errorFor(fieldErrors, "name")}
              </label>
              <label className="field-block">
                <FieldLabel help="Human-readable label shown in prompt metadata.">Title</FieldLabel>
                <input className="text-input" value={form.title ?? ""} onChange={(event) => updateForm("title", event.target.value)} />
              </label>
              <label className="field-block wide">
                <FieldLabel help="Client-facing description. Avoid implying the prompt executes automatically; clients request it explicitly.">Description</FieldLabel>
                <textarea className="text-area short" value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} />
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={form.enabled} onChange={(event) => updateForm("enabled", event.target.checked)} />
                <span className="field-label-row">Enabled in prompt catalogs <HelpTooltip text="Enabled prompts appear in future MCP prompts/list runtime handlers. Disabled prompts remain editable." /></span>
              </label>
            </div>
          ) : null}

          {view === "arguments" || view === "create" ? (
            <EditorSection title="Prompt arguments">
              <div className="stack">
                {form.arguments.map((argument, index) => (
                  <div className="parameter-editor prompt-argument-editor" key={`${argument.name}-${index}`}>
                    <label className="field-block">
                      <FieldLabel help="Argument name referenced by text templates as {argumentName}.">Name</FieldLabel>
                      <input className="text-input" value={argument.name} onChange={(event) => updateArgument(index, "name", event.target.value)} />
                      {errorFor(fieldErrors, `arguments.${index}.name`)}
                    </label>
                    <label className="toggle-row">
                      <input type="checkbox" checked={argument.required} onChange={(event) => updateArgument(index, "required", event.target.checked)} />
                      <span>Required</span>
                    </label>
                    <label className="field-block">
                      <FieldLabel help="Human-readable label for clients that render prompt argument forms.">Title</FieldLabel>
                      <input className="text-input" value={argument.title ?? ""} onChange={(event) => updateArgument(index, "title", event.target.value)} />
                    </label>
                    <label className="field-block parameter-description">
                      <FieldLabel help="Description shown to client developers inspecting this prompt.">Description</FieldLabel>
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
            </EditorSection>
          ) : null}

          {view === "messages" || view === "create" ? (
            <EditorSection title="Prompt messages">
              <div className="stack">
                {form.messages.map((message, index) => (
                  <div className="case-editor prompt-message-editor" key={`${message.role}-${index}`}>
                    <label className="field-block">
                      <FieldLabel help="MCP prompt message role. This template is returned to clients; no model call is made here.">Role</FieldLabel>
                      <select className="text-input" value={message.role} onChange={(event) => updateMessage(index, "role", event.target.value as "user" | "assistant")}>
                        <option value="user">user</option>
                        <option value="assistant">assistant</option>
                      </select>
                      {errorFor(fieldErrors, `messages.${index}.role`)}
                    </label>
                    <label className="field-block wide">
                      <FieldLabel help="Text content with optional {argumentName} placeholders rendered in the console preview.">Text template</FieldLabel>
                      <textarea className="text-area" value={message.textTemplate ?? ""} onChange={(event) => updateMessage(index, "textTemplate", event.target.value)} />
                      {errorFor(fieldErrors, `messages.${index}.content`)}
                    </label>
                    <label className="field-block">
                      <FieldLabel help="Optional embedded server resource. Only enabled resources can be selected or saved.">Embedded resource</FieldLabel>
                      <select className="text-input" value={message.resourceUri ?? ""} onChange={(event) => setMessageResource(index, event.target.value)}>
                        <option value="">No embedded resource</option>
                        {enabledResources.map((resource) => (
                          <option key={resource.id} value={resource.uri}>{resource.name} - {resource.uri}</option>
                        ))}
                      </select>
                      {errorFor(fieldErrors, `messages.${index}.resourceUri`)}
                    </label>
                    <label className="field-block">
                      <FieldLabel help="Optional MIME type override for the embedded resource content block.">Resource MIME type</FieldLabel>
                      <input className="text-input" value={message.resourceMimeType ?? ""} onChange={(event) => updateMessage(index, "resourceMimeType", event.target.value)} />
                      {errorFor(fieldErrors, `messages.${index}.resourceMimeType`)}
                    </label>
                    <button className="secondary-button" type="button" onClick={() => removeMessage(index)} disabled={form.messages.length <= 1}>Remove</button>
                  </div>
                ))}
              </div>
              {errorFor(fieldErrors, "messages")}
              <div className="console-actions">
                <button className="secondary-button" type="button" onClick={addMessage}>
                  <MessageSquareText className="button-icon" aria-hidden="true" />
                  Add message
                </button>
              </div>
            </EditorSection>
          ) : null}

          {view === "completion" ? (
            <EditorSection title="Completion candidates">
              <div className="stack">
                {form.completionCandidates.map((candidate, index) => (
                  <div className="case-editor completion-candidate-editor" key={`${candidate.argumentName}-${candidate.value}-${index}`}>
                    <label className="field-block">
                      <FieldLabel help="Existing prompt argument this completion value belongs to.">Argument</FieldLabel>
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
            <EditorSection title="Prompt console preview">
              <div className="console-shell">
                <p className="section-note">Preview only. Prompt templates are user requested through prompts/get and do not run a model or persist sample argument values.</p>
                <div className="form-grid">
                  {form.arguments.map((argument) => (
                    <label className="field-block" key={argument.name}>
                      <FieldLabel help="Sample value used only for this browser preview. It is not sent to the save API.">{argument.name}</FieldLabel>
                      <input className="text-input" value={sampleArguments[argument.name] ?? ""} onChange={(event) => setSampleArguments((current) => ({ ...current, [argument.name]: event.target.value }))} />
                      {sampleErrors[argument.name] ? <p className="field-error">{sampleErrors[argument.name]}</p> : null}
                    </label>
                  ))}
                </div>
                <div className="console-actions">
                  <CopyButton value={listPreview} label="Copy prompts/list" />
                  <CopyButton value={getRequestPreview} label="Copy prompts/get" />
                  <CopyButton value={completionRequestPreview} label="Copy completion request" />
                </div>
                <div className="console-evidence-grid" aria-label="Prompt protocol evidence">
                  <EvidencePanel title="prompts/list response" value={listPreview} />
                  <EvidencePanel title="prompts/get request" value={getRequestPreview} />
                  <EvidencePanel title="prompts/get response" value={getResponsePreview} />
                  <EvidencePanel title="completion/complete request" value={completionRequestPreview} />
                  <EvidencePanel title="completion/complete response" value={completionResponsePreview} />
                  <EvidencePanel title="Runtime availability" value={form.enabled ? "Enabled prompt. Runtime handlers are wired in task 032." : "Disabled prompt. Preview only."} compact />
                </div>
              </div>
            </EditorSection>
          ) : null}

          {selectedId && view === "delete" ? (
            <EditorSection title="Delete prompt">
              <p className="section-note">Delete removes this prompt template, its argument definitions, messages, and completion candidates.</p>
              {deleteState.message ? <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p> : null}
              {deleteState.status === "confirming" || deleteState.status === "deleting" || deleteState.status === "error" ? (
                <div className="delete-confirmation">
                  <label className="toggle-row">
                    <input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />
                    <span>I understand this prompt will be deleted.</span>
                  </label>
                  <div className="console-actions">
                    <button className="danger-button" type="button" onClick={() => void deleteSelectedPrompt()} disabled={!deleteConfirm || deleteState.status === "deleting"}>
                      <Trash2 className="button-icon" aria-hidden="true" />
                      {deleteState.status === "deleting" ? "Deleting" : "Confirm delete"}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setDeleteState({ status: "idle", message: "" })}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="danger-button" type="button" onClick={() => setDeleteState({ status: "confirming", message: "" })}>
                  <Trash2 className="button-icon" aria-hidden="true" />
                  Delete prompt
                </button>
              )}
            </EditorSection>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  function updateArgument<K extends keyof PromptFormState["arguments"][number]>(index: number, key: K, value: PromptFormState["arguments"][number][K]) {
    setForm((current) => ({
      ...current,
      arguments: current.arguments.map((argument, itemIndex) => (itemIndex === index ? { ...argument, [key]: value } : argument)),
    }));
  }

  function addArgument() {
    setForm((current) => ({
      ...current,
      arguments: [...current.arguments, { name: `arg${current.arguments.length + 1}`, title: "", description: "", required: true }],
    }));
  }

  function removeArgument(index: number) {
    setForm((current) => {
      const removed = current.arguments[index]?.name;
      return {
        ...current,
        arguments: current.arguments.filter((_argument, itemIndex) => itemIndex !== index),
        completionCandidates: current.completionCandidates.filter((candidate) => candidate.argumentName !== removed),
      };
    });
  }

  function updateMessage<K extends keyof PromptFormState["messages"][number]>(index: number, key: K, value: PromptFormState["messages"][number][K]) {
    setForm((current) => ({
      ...current,
      messages: current.messages.map((message, itemIndex) => (itemIndex === index ? { ...message, [key]: value } : message)),
    }));
  }

  function setMessageResource(index: number, uri: string) {
    const resource = enabledResources.find((item) => item.uri === uri);
    setForm((current) => ({
      ...current,
      messages: current.messages.map((message, itemIndex) =>
        itemIndex === index
          ? { ...message, resourceUri: uri || null, resourceMimeType: resource ? resource.mimeType : message.resourceMimeType }
          : message,
      ),
    }));
  }

  function addMessage() {
    setForm((current) => ({
      ...current,
      messages: [...current.messages, { role: "assistant", textTemplate: "", resourceUri: null, resourceMimeType: null }],
    }));
  }

  function removeMessage(index: number) {
    setForm((current) => ({ ...current, messages: current.messages.filter((_message, itemIndex) => itemIndex !== index) }));
  }

  function updateCandidate<K extends keyof PromptFormState["completionCandidates"][number]>(index: number, key: K, value: PromptFormState["completionCandidates"][number][K]) {
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
    setForm((current) => ({ ...current, completionCandidates: current.completionCandidates.filter((_candidate, itemIndex) => itemIndex !== index) }));
  }
}

function PromptSubNav({ promptId, current }: { promptId: string; current: PromptView }) {
  const items: Array<[PromptView, string, string, ReactNode]> = [
    ["overview", "Overview", `/prompts/${promptId}`, <FileText className="button-icon" aria-hidden="true" key="overview" />],
    ["edit", "Edit", `/prompts/${promptId}/edit`, <Save className="button-icon" aria-hidden="true" key="edit" />],
    ["arguments", "Arguments", `/prompts/${promptId}/arguments`, <ListPlus className="button-icon" aria-hidden="true" key="arguments" />],
    ["messages", "Messages", `/prompts/${promptId}/messages`, <MessageSquareText className="button-icon" aria-hidden="true" key="messages" />],
    ["completion", "Completion", `/prompts/${promptId}/completion`, <ListPlus className="button-icon" aria-hidden="true" key="completion" />],
    ["console", "Preview", `/prompts/${promptId}/console`, <Play className="button-icon" aria-hidden="true" key="console" />],
    ["delete", "Delete", `/prompts/${promptId}/delete`, <Trash2 className="button-icon" aria-hidden="true" key="delete" />],
  ];
  return (
    <nav className="sub-nav" aria-label="Prompt workflow">
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
