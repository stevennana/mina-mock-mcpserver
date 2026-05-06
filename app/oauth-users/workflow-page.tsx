import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { OAuthUsersManager } from "@/app/oauth-users/oauth-users-manager";
import { listOAuthUsers } from "@/lib/oauth/service";

export async function OAuthUserWorkflowPage({ id, create = false }: { id?: string; create?: boolean }) {
  const userData = await listOAuthUsers();
  if (id && !userData.users.some((user) => user.id === id)) {
    notFound();
  }

  return (
    <main className="shell app-shell">
      <AppNav current="oauth-users" />
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth login identities</p>
          <h1>{create ? "Create OAuth user" : "OAuth user detail"}</h1>
          <p className="lede compact">
            {create ? "Create one login fixture for browser authorization-code testing." : "Edit one OAuth login fixture and its token TTL preset."}
          </p>
        </div>
        <div className="summary-strip" aria-label="OAuth user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <OAuthUsersManager initialData={userData} initialSelectedId={id ?? null} view={create ? "create" : "detail"} />
    </main>
  );
}
