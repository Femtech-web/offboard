import { LogOut } from "lucide-react";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Offboard home"
      className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/7 text-brand">
        <LogOut aria-hidden="true" className="size-5" strokeWidth={1.6} />
      </span>
      <span
        className={`${compact ? "text-lg" : "text-xl"} font-medium tracking-tight text-foreground`}
      >
        Offboard<span className="text-brand">.</span>
      </span>
    </Link>
  );
}
