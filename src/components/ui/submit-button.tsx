"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  destructive = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  destructive?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50 ${destructive ? "bg-critical text-ink hover:bg-critical/85" : "bg-brand text-ink hover:bg-brand/85"}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
