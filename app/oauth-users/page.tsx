import { AppNav } from "@/app/app-nav";
import { OAuthUsersManager } from "@/app/oauth-users/oauth-users-manager";
import { listOAuthUsers } from "@/lib/oauth/service";

export default async function OAuthUsersPage() {
  const userData = await listOAuthUsers();

  return (
    <main className="shell app-shell">
      <AppNav current="oauth-users" />
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth login identities</p>
          <h1>OAuth users</h1>
          <p className="lede compact">
            Manage public login fixtures and token TTL presets for the mock OAuth authorization-code runtime.
          </p>
        </div>
        <div className="summary-strip" aria-label="OAuth user counts">
          <span><strong>{userData.total}</strong>Total</span>
          <span><strong>{userData.enabled}</strong>Enabled</span>
          <span><strong>{userData.disabled}</strong>Disabled</span>
        </div>
      </header>
      <OAuthUsersManager initialData={userData} view="catalog" />
    </main>
  );
}
