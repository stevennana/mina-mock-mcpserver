import Link from "next/link";
import { BasicUsersManager } from "@/app/basic-users/basic-users-manager";
import { listBasicUsers } from "@/lib/basic-auth/service";

export default async function BasicUsersPage() {
  const userData = await listBasicUsers();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users" aria-current="page">Basic Users</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Basic Auth test identities</p>
          <h1>Basic Auth users</h1>
          <p className="lede compact">
            Manage public test credentials for future Basic-authenticated MCP and REST calls.
          </p>
        </div>
        <div className="summary-strip" aria-label="Basic user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <BasicUsersManager initialData={userData} />
    </main>
  );
}
