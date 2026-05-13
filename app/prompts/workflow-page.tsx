import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { PromptManager, type PromptView } from "@/app/prompts/prompt-manager";
import { getMcpPrompt, listEnabledMcpResources, listMcpPrompts } from "@/lib/mcp-fixtures/service";

const promptCopy: Record<PromptView, { eyebrow: string; title: string; description: string }> = {
  catalog: {
    eyebrow: "Tools / Prompts",
    title: "Prompt management",
    description: "List reusable MCP prompt templates and open focused workflows for arguments, messages, completion, and previews.",
  },
  create: {
    eyebrow: "Prompt setup",
    title: "Create prompt",
    description: "Create a user-invoked prompt template with required arguments, ordered messages, and optional enabled resource embeds.",
  },
  overview: {
    eyebrow: "Prompt detail",
    title: "Prompt overview",
    description: "Inspect prompt metadata, argument count, message count, and completion coverage.",
  },
  edit: {
    eyebrow: "Prompt detail",
    title: "Edit prompt metadata",
    description: "Change prompt identity, client-facing text, and enabled state.",
  },
  arguments: {
    eyebrow: "Prompt detail",
    title: "Prompt arguments",
    description: "Define required and optional values that users provide when requesting the prompt.",
  },
  messages: {
    eyebrow: "Prompt detail",
    title: "Prompt messages",
    description: "Edit ordered user and assistant text messages, with optional enabled resource references.",
  },
  completion: {
    eyebrow: "Prompt detail",
    title: "Completion candidates",
    description: "Configure sample values later served through completion/complete prefix matching.",
  },
  console: {
    eyebrow: "Prompt detail",
    title: "Prompt console preview",
    description: "Preview prompts/list, prompts/get, and completion/complete shapes without running an external model.",
  },
  delete: {
    eyebrow: "Protected operation",
    title: "Delete prompt",
    description: "Delete one prompt plus its arguments, messages, and completion fixtures.",
  },
};

export async function PromptWorkflowPage({ view, id }: { view: PromptView; id?: string }) {
  const [promptData, prompt, enabledResources] = await Promise.all([
    listMcpPrompts(),
    id ? getMcpPrompt(id) : Promise.resolve(null),
    listEnabledMcpResources(),
  ]);

  if (id && !prompt) {
    notFound();
  }

  const copy = promptCopy[view];

  return (
    <main className="shell app-shell">
      <AppNav current="prompts" />
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede compact">{copy.description}</p>
        </div>
        <div className="summary-strip" aria-label="Prompt counts">
          <span><strong>{promptData.total}</strong>Total</span>
          <span><strong>{promptData.enabled}</strong>Enabled</span>
          <span><strong>{promptData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <PromptManager initialData={promptData} initialDetail={prompt} enabledResources={enabledResources} view={view} />
    </main>
  );
}
