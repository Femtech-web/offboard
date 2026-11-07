"use client";
import { FileCheck2, LayoutDashboard, PlugZap, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/people", label: "People & Offboarding", icon: UsersRound },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/reports", label: "Verification Reports", icon: FileCheck2 },
];
export function WorkspaceNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Workspace navigation"
      className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:flex-col"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:gap-3 ${active ? "border-brand/15 bg-brand/10 text-brand" : "border-transparent text-muted-foreground hover:bg-surface-muted/60 hover:text-foreground"}`}
          >
            <Icon
              className="size-5 shrink-0"
              aria-hidden="true"
              strokeWidth={1.6}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
