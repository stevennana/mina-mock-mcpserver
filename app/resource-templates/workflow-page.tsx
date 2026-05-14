import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { ResourceTemplateManager, type ResourceTemplateView } from "@/app/resource-templates/resource-template-manager";
import { getMcpResourceTemplate, listMcpResourceTemplates } from "@/lib/mcp-fixtures/service";

const resourceTemplateCopy: Record<ResourceTemplateView, { eyebrow: string; title: string; description: string }> = {
  catalog: {
    eyebrow: "Tools / Resource Templates",
    title: "Resource template management",
    description: "List parameterized MCP resource descriptors and open focused workflows for arguments, content, completion, and previews.",
  },
  create: {
    eyebrow: "Template setup",
    title: "Create resource template",
    description: "Create a URI template with validated arguments, rendered mock content, and sample completion candidates.",
  },
  overview: {
    eyebrow: "Template detail",
    title: "Resource template overview",
    description: "Inspect the template identity, rendered sample URI, argument count, and completion coverage.",
  },
  edit: {
    eyebrow: "Template detail",
    title: "Edit template metadata",
    description: "Change URI template, metadata, MIME type, annotations, and enabled state.",
  },
  arguments: {
    eyebrow: "Template detail",
    title: "URI-template arguments",
    description: "Keep template placeholders aligned with argument definitions and sample JSON values.",
  },
  content: {
    eyebrow: "Template detail",
    title: "Rendered mock content",
    description: "Edit the text template returned in the resources/read preview after sample substitution.",
  },
  completion: {
    eyebrow: "Template detail",
    title: "Completion candidates",
    description: "Configure sample values served through completion/complete prefix matching.",
  },
  console: {
    eyebrow: "Template detail",
    title: "Template console preview",
    description: "Preview resources/templates/list, resources/read, and completion/complete shapes.",
  },
  delete: {
    eyebrow: "Protected operation",
    title: "Delete resource template",
    description: "Delete one resource template plus its argument and completion fixtures.",
  },
};

export async function ResourceTemplateWorkflowPage({ view, id }: { view: ResourceTemplateView; id?: string }) {
  const [templateData, template] = await Promise.all([
    listMcpResourceTemplates(),
    id ? getMcpResourceTemplate(id) : Promise.resolve(null),
  ]);

  if (id && !template) {
    notFound();
  }

  const copy = resourceTemplateCopy[view];

  return (
    <main className="shell app-shell">
      <AppNav current="resource-templates" />
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede compact">{copy.description}</p>
        </div>
        <div className="summary-strip" aria-label="Resource template counts">
          <span><strong>{templateData.total}</strong>Total</span>
          <span><strong>{templateData.enabled}</strong>Enabled</span>
          <span><strong>{templateData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <ResourceTemplateManager initialData={templateData} initialDetail={template} view={view} />
    </main>
  );
}
