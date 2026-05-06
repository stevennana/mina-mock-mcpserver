import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { EndpointManager, type EndpointView } from "@/app/endpoints/endpoint-manager";
import { getEndpoint, listEndpoints } from "@/lib/endpoints/service";

const endpointCopy: Record<EndpointView, { eyebrow: string; title: string; description: string }> = {
  catalog: {
    eyebrow: "Public endpoint setup",
    title: "Endpoint management",
    description: "Create and edit persisted mock tool definitions for later MCP and REST runtime slices.",
  },
  create: {
    eyebrow: "Endpoint setup",
    title: "Create endpoint",
    description: "Define the basic tool identity first. Parameters, responses, failure modes, and console tests come next.",
  },
  overview: {
    eyebrow: "Endpoint detail",
    title: "Endpoint overview",
    description: "Review runtime shape and choose the next focused setup step.",
  },
  edit: {
    eyebrow: "Endpoint detail",
    title: "Edit endpoint basics",
    description: "Change the tool identity, enabled state, and delete code.",
  },
  parameters: {
    eyebrow: "Endpoint detail",
    title: "Parameters and schema",
    description: "Configure tool arguments and inspect the generated MCP inputSchema.",
  },
  responses: {
    eyebrow: "Endpoint detail",
    title: "Responses",
    description: "Configure the default response and exact-match response cases.",
  },
  failure: {
    eyebrow: "Endpoint detail",
    title: "Failure simulation",
    description: "Configure delay, error, and intentionally malformed response behavior.",
  },
  console: {
    eyebrow: "Endpoint detail",
    title: "Endpoint console",
    description: "Run focused REST evidence calls against this endpoint.",
  },
  delete: {
    eyebrow: "Protected operation",
    title: "Delete endpoint",
    description: "Delete one endpoint with its delete code or root override.",
  },
};

export async function EndpointWorkflowPage({ view, id }: { view: EndpointView; id?: string }) {
  const [endpointData, endpoint] = await Promise.all([
    listEndpoints(),
    id ? getEndpoint(id) : Promise.resolve(null),
  ]);

  if (id && !endpoint) {
    notFound();
  }

  const copy = endpointCopy[view];

  return (
    <main className="shell app-shell">
      <AppNav current="endpoints" />
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede compact">{copy.description}</p>
        </div>
        <div className="summary-strip" aria-label="Endpoint counts">
          <span><strong>{endpointData.total}</strong>Total</span>
          <span><strong>{endpointData.enabled}</strong>Enabled</span>
          <span><strong>{endpointData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <EndpointManager initialData={endpointData} initialDetail={endpoint} view={view} />
    </main>
  );
}
