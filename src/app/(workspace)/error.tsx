"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-critical/25 bg-surface p-8"
    >
      <h1 className="text-xl font-medium">
        Workspace records are unavailable.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        Check the Supabase connection and migration. No counts or successful
        outcomes can be shown until the records load.
      </p>
      <button
        onClick={reset}
        className="mt-6 min-h-11 rounded-lg bg-brand px-5 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        Try again
      </button>
    </div>
  );
}
