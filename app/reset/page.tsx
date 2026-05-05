import Link from "next/link";
import { ResetForm } from "@/app/reset/reset-form";

export default function ResetPage() {
  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/oauth-clients">OAuth Clients</Link>
        <Link href="/reset" aria-current="page">Reset</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Operator recovery</p>
          <h1>Reset defaults</h1>
          <p className="lede compact">
            Root-protected reset for recovering the public test service to the current deterministic endpoint defaults.
          </p>
        </div>
      </header>

      <ResetForm />
    </main>
  );
}
