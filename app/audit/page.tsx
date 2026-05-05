import Link from "next/link";
import { listAuditEvents } from "@/lib/audit/service";

export default async function AuditPage() {
  const events = await listAuditEvents();

  return (
    <main className="shell app-shell">
      <nav className="top-nav" aria-label="Primary">
        <Link href="/">Dashboard</Link>
        <Link href="/endpoints">Endpoints</Link>
        <Link href="/basic-users">Basic Users</Link>
        <Link href="/oauth-users">OAuth Users</Link>
        <Link href="/reset">Reset</Link>
        <Link href="/audit" aria-current="page">Audit</Link>
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Mutation evidence</p>
          <h1>Audit log</h1>
          <p className="lede compact">
            Public destructive endpoint actions are recorded with outcome and reason metadata only.
          </p>
        </div>
      </header>

      <section className="audit-panel" aria-label="Audit events">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Subject</th>
              <th>Outcome</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
                <td>{event.eventType}</td>
                <td>{event.subjectName ?? event.subjectId ?? "unknown"}</td>
                <td>
                  <span className={event.outcome === "success" ? "status-pill enabled" : "status-pill danger"}>
                    {event.outcome}
                  </span>
                </td>
                <td>
                  <code>{JSON.stringify(event.metadata)}</code>
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">No audit events recorded yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
