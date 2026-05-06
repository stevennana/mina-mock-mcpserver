import { AppNav } from "@/app/app-nav";
import { EndpointManager } from "@/app/endpoints/endpoint-manager";
import { listEndpoints } from "@/lib/endpoints/service";

export default async function EndpointsPage() {
  const endpointData = await listEndpoints();

  return (
    <main className="shell app-shell">
      <AppNav current="endpoints" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Public endpoint setup</p>
          <h1>Endpoint management</h1>
          <p className="lede compact">
            Create and edit persisted mock tool definitions for later MCP and REST runtime slices.
          </p>
        </div>
        <div className="summary-strip" aria-label="Endpoint counts">
          <span><strong>{endpointData.total}</strong>Total</span>
          <span><strong>{endpointData.enabled}</strong>Enabled</span>
          <span><strong>{endpointData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <EndpointManager initialData={endpointData} view="catalog" />
    </main>
  );
}
