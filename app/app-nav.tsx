import Link from "next/link";

type AppNavItem = {
  href: string;
  label: string;
  key: AppNavKey;
};

export type AppNavKey =
  | "dashboard"
  | "endpoints"
  | "basic-users"
  | "oauth-users"
  | "oauth-clients"
  | "tokens"
  | "config"
  | "reset"
  | "audit";

const navItems: AppNavItem[] = [
  { key: "dashboard", href: "/", label: "Dashboard" },
  { key: "endpoints", href: "/endpoints", label: "Endpoints" },
  { key: "basic-users", href: "/basic-users", label: "Basic Users" },
  { key: "oauth-users", href: "/oauth-users", label: "OAuth Users" },
  { key: "oauth-clients", href: "/oauth-clients", label: "OAuth Clients" },
  { key: "tokens", href: "/tokens", label: "Tokens" },
  { key: "config", href: "/config", label: "Config" },
  { key: "reset", href: "/reset", label: "Reset" },
  { key: "audit", href: "/audit", label: "Audit" },
];

export function AppNav({ current }: { current: AppNavKey }) {
  return (
    <nav className="top-nav" aria-label="Primary">
      {navItems.map((item) => (
        <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
