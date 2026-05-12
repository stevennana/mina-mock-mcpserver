import Link from "next/link";
import {
  Activity,
  BarChart3,
  KeyRound,
  ListChecks,
  RotateCcw,
  ScrollText,
  ServerCog,
  Settings,
  ShieldUser,
  Terminal,
  TestTube2,
  UserRoundCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type AppNavItem = {
  href: string;
  label: string;
  key: AppNavKey;
  icon: LucideIcon;
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
    items: [{ key: "dashboard", href: "/", label: "Dashboard", icon: BarChart3 }],
  },
  {
    label: "Tools",
    items: [
      { key: "endpoints", href: "/endpoints", label: "Endpoints", icon: ListChecks },
      { key: "inspector", href: "/inspector", label: "Inspector", icon: TestTube2 },
    ],
  },
  {
    label: "Auth",
    items: [
      { key: "basic-users", href: "/basic-users", label: "Basic Users", icon: ShieldUser },
      { key: "oauth-users", href: "/oauth-users", label: "OAuth Users", icon: UsersRound },
      { key: "oauth-clients", href: "/oauth-clients", label: "OAuth Clients", icon: UserRoundCog },
      { key: "tokens", href: "/tokens", label: "Tokens", icon: KeyRound },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "config", href: "/config", label: "Config", icon: Settings },
      { key: "reset", href: "/reset", label: "Reset", icon: RotateCcw },
      { key: "audit", href: "/audit", label: "Audit", icon: ScrollText },
    ],
  },
];

export function AppNav({ current }: { current: AppNavKey }) {
  const currentGroup = navGroups.find((group) => group.items.some((item) => item.key === current));

  return (
    <div className="product-nav-shell">
      <header className="product-topbar">
        <div className="product-topbar-inner">
          <Link href="/" className="product-wordmark">
            MCP Mock Server
          </Link>
          <nav className="product-top-tabs" aria-label="Primary groups">
            {navGroups.map((group) => (
              <Link
                key={group.label}
                href={group.items[0]?.href ?? "/"}
                data-active={group.label === currentGroup?.label ? "true" : undefined}
              >
                {group.label}
              </Link>
            ))}
          </nav>
          <div className="product-top-actions" aria-label="Server status">
            <Terminal className="nav-icon" aria-hidden="true" />
            <ServerCog className="nav-icon" aria-hidden="true" />
            <span className="product-status-dot" aria-label="Operational" />
          </div>
        </div>
      </header>

      <aside className="product-side-rail">
        <div className="product-nav-brand" aria-label="Product">
          <div className="product-brand-icon" aria-hidden="true">
            <Activity aria-hidden="true" />
          </div>
          <div>
            <Link href="/" className="product-nav-mark">
              Protocol Lab
            </Link>
            <span>mcp-mock console</span>
          </div>
        </div>
        <nav className="top-nav" aria-label="Primary">
          {navGroups.map((group) => {
            const isActiveGroup = group.items.some((item) => item.key === current);

            return (
              <div key={group.label} className="top-nav-group" data-active={isActiveGroup ? "true" : undefined}>
                <span className="top-nav-group-label">{group.label}</span>
                <div className="top-nav-links">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}>
                        <Icon className="nav-icon" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
