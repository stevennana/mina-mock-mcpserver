import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { OAuthClientsManager } from "@/app/oauth-clients/oauth-clients-manager";
import { listOAuthClients } from "@/lib/oauth/service";

export async function OAuthClientWorkflowPage({ id, create = false }: { id?: string; create?: boolean }) {
  const clientData = await listOAuthClients();
  if (id && !clientData.clients.some((client) => client.id === id)) {
    notFound();
  }

  return (
    <main className="shell app-shell">
      <AppNav current="oauth-clients" />
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth relying parties</p>
          <h1>{create ? "Create OAuth client" : "OAuth client detail"}</h1>
          <p className="lede compact">
            {create ? "Create one mock OAuth client and copy its one-time secret." : "Edit one client, redirect URI set, TTL, secret, and endpoint permissions."}
          </p>
        </div>
        <div className="summary-strip" aria-label="OAuth client counts">
          <span><strong>{clientData.total}</strong>Total</span>
          <span><strong>{clientData.enabled}</strong>Enabled</span>
          <span><strong>{clientData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <OAuthClientsManager initialData={clientData} initialSelectedId={id ?? null} view={create ? "create" : "detail"} />
    </main>
  );
}
