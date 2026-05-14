import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { ResourceManager, type ResourceView } from "@/app/resources/resource-manager";
import { getMcpResource, listMcpResources } from "@/lib/mcp-fixtures/service";

const resourceCopy: Record<ResourceView, { eyebrow: string; title: string; description: string }> = {
  catalog: {
    eyebrow: "Tools / Resources",
    title: "Resource management",
    description: "List direct MCP context resources and open focused workflows for edits or read previews.",
  },
  create: {
    eyebrow: "Resource setup",
    title: "Create resource",
    description: "Create a direct enabled text resource with a stable URI and read-only MCP content.",
  },
  overview: {
    eyebrow: "Resource detail",
    title: "Resource overview",
    description: "Inspect the resource identity, status, and content shape before focused edits.",
  },
  edit: {
    eyebrow: "Resource detail",
    title: "Edit resource metadata",
    description: "Change URI, name, description, MIME type, annotations, and enabled state.",
  },
  content: {
    eyebrow: "Resource detail",
    title: "Resource content",
    description: "Edit the direct text body returned by a resources/read response preview.",
  },
  console: {
    eyebrow: "Resource detail",
    title: "Resource read preview",
    description: "Preview and copy the exact JSON-RPC resources/read request and response shape.",
  },
  delete: {
    eyebrow: "Protected operation",
    title: "Delete resource",
    description: "Delete one direct MCP resource from the admin catalog.",
  },
};

export async function ResourceWorkflowPage({ view, id }: { view: ResourceView; id?: string }) {
  const [resourceData, resource] = await Promise.all([
    listMcpResources(),
    id ? getMcpResource(id) : Promise.resolve(null),
  ]);

  if (id && !resource) {
    notFound();
  }

  const copy = resourceCopy[view];

  return (
    <main className="shell app-shell">
      <AppNav current="resources" />
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede compact">{copy.description}</p>
        </div>
        <div className="summary-strip" aria-label="Resource counts">
          <span><strong>{resourceData.total}</strong>Total</span>
          <span><strong>{resourceData.enabled}</strong>Enabled</span>
          <span><strong>{resourceData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <ResourceManager initialData={resourceData} initialDetail={resource} view={view} />
    </main>
  );
}
