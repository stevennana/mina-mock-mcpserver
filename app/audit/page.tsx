import { AppNav } from "@/app/app-nav";
import { AuditManager } from "@/app/audit/audit-manager";
import { listAuditEvents } from "@/lib/audit/service";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const auditData = await listAuditEvents({ limit: 25 });

  return (
    <main className="shell app-shell">
      <AppNav current="audit" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Mutation evidence</p>
          <h1>Audit log</h1>
          <p className="lede compact">
            Filter mutation and security evidence without loading every record at once.
          </p>
        </div>
      </header>

      <AuditManager initialData={auditData} />
    </main>
  );
}
