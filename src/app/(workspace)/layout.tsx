import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { WorkspaceNavigation } from "@/components/layout/workspace-navigation";
import { signOut } from "@/features/auth/actions";
import { requireWorkspaceMember } from "@/server/auth";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile } = await requireWorkspaceMember();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="border-b border-border bg-surface/60 px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0 lg:px-5 lg:py-8">
        <div className="mb-5 flex items-center justify-between gap-3 px-2 lg:mb-12">
          <Brand />
          <form action={signOut} className="lg:hidden">
            <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-brand">
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
        <WorkspaceNavigation />
        {profile.role === "viewer" && (
          <p className="mt-5 px-3 text-xs text-brand">
            Read-only demo · Saved test records
          </p>
        )}
        <div className="mt-5 hidden border-t border-border pt-5 lg:mt-auto lg:block">
          <p className="truncate px-3 text-xs text-muted-foreground">
            {user.email}
          </p>
          <form action={signOut}>
            <button className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <main
          id="main-content"
          className="mx-auto max-w-[1400px] px-5 py-9 sm:px-9 sm:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
