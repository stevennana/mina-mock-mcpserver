import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return <main className={["shell", "app-shell", className].filter(Boolean).join(" ")}>{children}</main>;
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede compact">{description}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </header>
  );
}

type PanelProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
};

export function Panel({ children, className, title, description }: PanelProps) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      {title || description ? (
        <div className="primitive-section-header">
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type MetricTileProps = {
  label: string;
  value: ReactNode;
};

export function MetricTile({ label, value }: MetricTileProps) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type MetricGridProps = {
  children: ReactNode;
};

export function MetricGrid({ children }: MetricGridProps) {
  return <section className="status-grid">{children}</section>;
}

type ActionBarProps = {
  children: ReactNode;
};

export function ActionBar({ children }: ActionBarProps) {
  return <div className="action-bar">{children}</div>;
}

type StatusPillProps = {
  children: ReactNode;
  tone?: "neutral" | "enabled" | "success" | "warning" | "danger";
};

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return <span className={["status-pill", tone === "neutral" ? "" : tone].filter(Boolean).join(" ")}>{children}</span>;
}

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

type ToolbarProps = {
  children: ReactNode;
};

export function Toolbar({ children }: ToolbarProps) {
  return <div className="primitive-toolbar">{children}</div>;
}

type CodeRowProps = {
  label: string;
  value: ReactNode;
  action?: ReactNode;
};

export function CodeRow({ label, value, action }: CodeRowProps) {
  return (
    <div className="primitive-code-row">
      <span>{label}</span>
      <code>{value}</code>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

type ProductTableProps = {
  children: ReactNode;
  className?: string;
};

export function ProductTable({ children, className }: ProductTableProps) {
  return <div className={["endpoint-table-shell", className].filter(Boolean).join(" ")}>{children}</div>;
}
