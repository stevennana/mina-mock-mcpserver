import { AppNav } from "@/app/app-nav";
import { BasicUsersManager } from "@/app/basic-users/basic-users-manager";
import { listBasicUsers } from "@/lib/basic-auth/service";

export default async function BasicUsersPage() {
  const userData = await listBasicUsers();

  return (
    <main className="shell app-shell">
      <AppNav current="basic-users" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Basic Auth test identities</p>
          <h1>Basic Auth users</h1>
          <p className="lede compact">
            Manage public test credentials for Basic-authenticated MCP and REST calls.
          </p>
        </div>
        <div className="summary-strip" aria-label="Basic user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <BasicUsersManager initialData={userData} view="catalog" />
    </main>
  );
}
