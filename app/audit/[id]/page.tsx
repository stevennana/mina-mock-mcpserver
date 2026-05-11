import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { listAuditEvents } from "@/lib/audit/service";
import { formatDateTime } from "@/lib/date-format";

export const dynamic = "force-dynamic";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await listAuditEvents();
  const event = events.find((candidate) => candidate.id === id);
  if (!event) {
    notFound();
  }

  return (
    <main className="shell app-shell">
      <AppNav current="audit" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Mutation evidence</p>
          <h1>Audit event detail</h1>
          <p className="lede compact">Inspect the full non-secret evidence payload for one recorded event.</p>
        </div>
      </header>

      <div className="focused-layout">
        <section className="panel guide-panel" aria-labelledby="audit-detail-title">
          <div className="section-heading-row">
            <div>
              <h2 id="audit-detail-title">{event.eventType}</h2>
              <p>{formatDateTime(event.createdAt)}</p>
            </div>
            <span className={event.outcome === "success" ? "status-pill enabled" : "status-pill danger"}>
              {event.outcome}
            </span>
          </div>
          <dl className="detail-grid">
            <div><dt>Subject type</dt><dd>{event.subjectType}</dd></div>
            <div><dt>Subject</dt><dd>{event.subjectName ?? event.subjectId ?? "unknown"}</dd></div>
            <div><dt>Actor</dt><dd>{event.actorType}</dd></div>
            <div><dt>Event ID</dt><dd>{event.id}</dd></div>
          </dl>
          <pre className="json-panel" aria-label="Audit metadata">{JSON.stringify(event.metadata, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}
