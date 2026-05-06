import Link from "next/link";

type AppNavItem = {
  href: string;
  label: string;
  key: AppNavKey;
};

type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export type AppNavKey =
  | "dashboard"
  | "endpoints"
  | "inspector"
  | "basic-users"
  | "oauth-users"
  | "oauth-clients"
  | "tokens"
  | "config"
  | "reset"
  | "audit";

const navGroups: AppNavGroup[] = [
  {
    label: "Overview",
    items: [{ key: "dashboard", href: "/", label: "Dashboard" }],
  },
  {
    label: "Tools",
    items: [
      { key: "endpoints", href: "/endpoints", label: "Endpoints" },
      { key: "inspector", href: "/inspector", label: "Inspector" },
    ],
  },
  {
    label: "Auth",
    items: [
      { key: "basic-users", href: "/basic-users", label: "Basic Users" },
      { key: "oauth-users", href: "/oauth-users", label: "OAuth Users" },
      { key: "oauth-clients", href: "/oauth-clients", label: "OAuth Clients" },
      { key: "tokens", href: "/tokens", label: "Tokens" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "config", href: "/config", label: "Config" },
      { key: "reset", href: "/reset", label: "Reset" },
      { key: "audit", href: "/audit", label: "Audit" },
    ],
  },
];

export function AppNav({ current }: { current: AppNavKey }) {
  return (
    <nav className="top-nav" aria-label="Primary">
      {navGroups.map((group) => {
        const isActiveGroup = group.items.some((item) => item.key === current);

        return (
          <div key={group.label} className="top-nav-group" data-active={isActiveGroup ? "true" : undefined}>
            <span className="top-nav-group-label">{group.label}</span>
            <div className="top-nav-links">
              {group.items.map((item) => (
                <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
