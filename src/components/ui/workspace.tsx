import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Unplug } from "lucide-react";
import { scopeLimitations } from "@/core/workflow";

export const inputClassName =
  "mt-2 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base outline-none sm:text-sm focus:border-brand focus:ring-2 focus:ring-brand/20";
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && (
          <p className="mb-3 text-xs font-medium text-brand">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon
        aria-hidden="true"
        className="mx-auto mb-4 size-9 text-muted-foreground"
        strokeWidth={1.4}
      />
      <h3 className="font-medium">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
export function CoverageNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface/60 p-5">
      <Unplug
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-attention"
      />
      <div>
        <p className="text-sm font-medium">What’s covered</p>
        {scopeLimitations.map((text) => (
          <p
            key={text}
            className="mt-1 text-xs leading-6 text-muted-foreground"
          >
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}
export function OperationError({ error }: { error?: string }) {
  return error ? (
    <p
      role="alert"
      className="mb-6 rounded-lg border border-critical/25 bg-critical/5 p-4 text-sm leading-7 text-critical"
    >
      {error === "input"
        ? "Check the form values and try again."
        : error === "email"
          ? "We couldn’t send a new review link. Check the email status and latest access check, then try again in a minute."
          : "This action couldn’t be completed. Check the account confirmation, approval expiry, and any pending checks, then try again."}
    </p>
  ) : null;
}
