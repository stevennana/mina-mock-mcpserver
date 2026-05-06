import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { BasicUsersManager } from "@/app/basic-users/basic-users-manager";
import { listBasicUsers } from "@/lib/basic-auth/service";

export async function BasicUserWorkflowPage({ id, create = false }: { id?: string; create?: boolean }) {
  const userData = await listBasicUsers();
  if (id && !userData.users.some((user) => user.id === id)) {
    notFound();
  }

  return (
    <main className="shell app-shell">
      <AppNav current="basic-users" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Basic Auth test identities</p>
          <h1>{create ? "Create Basic user" : "Basic user detail"}</h1>
          <p className="lede compact">
            {create ? "Create one Basic Auth fixture for MCP and REST calls." : "Edit one Basic Auth fixture without crowding the user catalog."}
          </p>
        </div>
        <div className="summary-strip" aria-label="Basic user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <BasicUsersManager initialData={userData} initialSelectedId={id ?? null} view={create ? "create" : "detail"} />
    </main>
  );
}
