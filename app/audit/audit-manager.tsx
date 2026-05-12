"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatDateTime } from "@/lib/date-format";
import type { AuditEventListResult, AuditEventSummary } from "@/lib/audit/service";

type AuditFilters = {
  outcome: "all" | "success" | "failure";
  eventType: string;
  subject: string;
  query: string;
};

type LoadState = {
  status: "idle" | "loading" | "error" | "success";
  message: string;
};

const PAGE_SIZE = 25;

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="field-label-row">
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}

function queryString(filters: AuditFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);
  if (filters.outcome !== "all") params.set("outcome", filters.outcome);
  if (filters.eventType.trim()) params.set("eventType", filters.eventType.trim());
  if (filters.subject.trim()) params.set("subject", filters.subject.trim());
  if (filters.query.trim()) params.set("query", filters.query.trim());
  return params.toString();
}

function outcomeClass(outcome: AuditEventSummary["outcome"]) {
  return outcome === "success" ? "status-pill enabled" : "status-pill danger";
}

function subjectLabel(event: AuditEventSummary) {
  return event.subjectName ?? event.subjectId ?? "unknown";
}

function metadataPreview(event: AuditEventSummary) {
  const value = JSON.stringify(event.metadata);
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}

export function AuditManager({ initialData }: { initialData: AuditEventListResult }) {
  const [auditData, setAuditData] = useState(initialData);
  const [filters, setFilters] = useState<AuditFilters>({ outcome: "all", eventType: "", subject: "", query: "" });
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle", message: "" });
  const loadingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => {
    const shown = auditData.events.length;
    const total = auditData.total;
    return `${shown} shown, ${total} matching`;
  }, [auditData.events.length, auditData.total]);
  const progress = auditData.total > 0 ? Math.min(100, Math.round((auditData.events.length / auditData.total) * 100)) : 0;

  const loadPage = useCallback(
    async ({ cursor = null, append = false, nextFilters = filters }: { cursor?: string | null; append?: boolean; nextFilters?: AuditFilters } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadState({ status: "loading", message: append ? "Loading more audit records." : "Loading audit records." });
      try {
        const response = await fetch(`/api/audit?${queryString(nextFilters, cursor)}`);
        if (!response.ok) throw new Error("Unable to load audit records.");
        const payload = (await response.json()) as AuditEventListResult;
        setAuditData((current) => ({
          ...payload,
          events: append ? [...current.events, ...payload.events] : payload.events,
        }));
        setLoadState({ status: "success", message: append ? "More audit records loaded." : "Filters applied." });
      } catch (error) {
        setLoadState({ status: "error", message: error instanceof Error ? error.message : "Audit load failed." });
      } finally {
        loadingRef.current = false;
      }
    },
    [filters],
  );

  const loadNextPage = useCallback(() => {
    if (auditData.hasMore && auditData.nextCursor) {
      void loadPage({ cursor: auditData.nextCursor, append: true });
    }
  }, [auditData.hasMore, auditData.nextCursor, loadPage]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) loadNextPage();
      },
      { rootMargin: "240px" },
    );
    const onScroll = () => {
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (remaining < 240) loadNextPage();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) loadNextPage();
    };
    observer.observe(target);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
    };
  }, [auditData.hasMore, auditData.nextCursor, loadPage]);

  function applyFilters() {
    void loadPage({ nextFilters: filters });
  }

  function clearFilters() {
    const next = { outcome: "all" as const, eventType: "", subject: "", query: "" };
    setFilters(next);
    void loadPage({ nextFilters: next });
  }

  return (
    <section className="audit-panel" aria-label="Audit events">
      <div className="audit-toolbar">
        <div>
          <h2>Records</h2>
          <p>{summary}</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadPage()}>
          Refresh
        </button>
      </div>

      <div className="audit-progress" aria-label={`Loaded ${auditData.events.length} of ${auditData.total} matching audit records`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="audit-filter-grid">
        <label className="field-block">
          <FieldLabel label="Outcome" help="Filter by whether the protected or mutating action succeeded or failed." />
          <select
            className="text-input"
            value={filters.outcome}
            onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as AuditFilters["outcome"] }))}
          >
            <option value="all">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </label>
        <label className="field-block">
          <FieldLabel label="Event type" help="Filter by event family, such as endpoint.delete or system.reset." />
          <input
            className="text-input"
            value={filters.eventType}
            onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))}
            placeholder="endpoint.delete"
          />
        </label>
        <label className="field-block">
          <FieldLabel label="Subject" help="Filter by endpoint name, user, client, subject ID, or subject type." />
          <input
            className="text-input"
            value={filters.subject}
            onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
            placeholder="Endpoint or subject"
          />
        </label>
        <label className="field-block">
          <FieldLabel label="Search evidence" help="Search event, subject, actor, and non-secret metadata text." />
          <input
            className="text-input"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="reason, mode, actor"
          />
        </label>
      </div>

      <div className="console-actions filter-actions">
        <button className="primary-button" type="button" onClick={applyFilters} disabled={loadState.status === "loading"}>
          Apply filters
        </button>
        <button className="secondary-button" type="button" onClick={clearFilters} disabled={loadState.status === "loading"}>
          Clear
        </button>
      </div>
      {loadState.message ? <p className={`form-message ${loadState.status}`}>{loadState.message}</p> : null}

      <div className="audit-table-shell" aria-live="polite">
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
            {auditData.events.map((event) => (
              <tr key={event.id}>
                <td>{formatDateTime(event.createdAt)}</td>
                <td>
                  <Link className="table-link" href={`/audit/${event.id}`}>
                    {event.eventType}
                  </Link>
                  <span>{event.actorType}</span>
                </td>
                <td>
                  {subjectLabel(event)}
                  <span>{event.subjectType}</span>
                </td>
                <td>
                  <span className={outcomeClass(event.outcome)}>{event.outcome}</span>
                </td>
                <td>
                  <code>{metadataPreview(event)}</code>
                </td>
              </tr>
            ))}
            {auditData.events.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">No audit events match these filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div ref={loadMoreRef} className="audit-load-more" aria-live="polite">
        {auditData.hasMore ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadPage({ cursor: auditData.nextCursor, append: true })}
            disabled={loadState.status === "loading"}
          >
            {loadState.status === "loading" ? "Loading records" : `Load more records (${auditData.events.length}/${auditData.total})`}
          </button>
        ) : (
          <span>End of matching records.</span>
        )}
      </div>
    </section>
  );
}
