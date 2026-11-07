import { PendingJobRefresh } from "@/components/layout/pending-job-refresh";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleCheck,
  Clock3,
  FileCheck2,
  ScanLine,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { workspaceRecords } from "@/server/queries";
import {
  CoverageNotice,
  EmptyState,
  PageHeading,
} from "@/components/ui/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, humanize } from "@/lib/format";

export default async function OverviewPage() {
  const records = await workspaceRecords();
  const now = records.observedAt;
  const pending = records.findings.filter((finding) => {
    const identityConfirmed = records.identities.some(
      (identity) =>
        identity.id === finding.identity_id && identity.confirmed_at,
    );
    const latestDecision = records.approvals
      .filter((approval) => approval.finding_id === finding.id)
      .sort((first, second) =>
        second.created_at.localeCompare(first.created_at),
      )[0];
    const alreadyRejected =
      latestDecision?.status === "rejected" &&
      Date.parse(latestDecision.created_at) >= Date.parse(finding.last_seen_at);
    return (
      ["access_detected", "access_remains", "verification_failed"].includes(
        finding.status,
      ) &&
      finding.protection_reasons.length === 0 &&
      identityConfirmed &&
      !alreadyRejected
    );
  });
  const metrics = [
    {
      label: "Open cases",
      value: records.cases.length,
      icon: UsersRound,
      note: "All cases retain incomplete coverage",
    },
    {
      label: "Remaining access risks",
      value: records.findings.filter(
        (finding) =>
          !["verified_removed", "not_detected"].includes(finding.status),
      ).length,
      icon: ShieldAlert,
      note: "Saved findings awaiting resolution",
    },
    {
      label: "Pending approvals",
      value: pending.length,
      icon: Clock3,
      note: "Confirmed, unprotected findings awaiting a decision",
    },
    {
      label: "Verified removals",
      value: records.operations.filter(
        (operation) => operation.status === "verified_removed",
      ).length,
      icon: CircleCheck,
      note: "Exact permissions independently rechecked",
    },
  ];
  const workerOnline =
    records.heartbeat &&
    now - Date.parse(records.heartbeat.last_seen_at) < 90_000;
  return (
    <>
      <PendingJobRefresh
        active={records.jobs.some(
          (job) => job.status === "queued" || job.status === "leased",
        )}
      />
      <PageHeading
        eyebrow="Your security workspace"
        title="Every exit. In clear view."
        description="Follow the cases, decisions, and evidence that need your attention."
      >
        <Link
          href="/people"
          className="inline-flex min-h-11 items-center gap-4 rounded-lg bg-brand px-4 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          Create a case
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </PageHeading>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, note }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon
                className="size-5 text-brand"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <p className="mt-6 text-4xl font-medium tracking-tight tabular-nums">
              {value}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {note}
            </p>
          </div>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <ScanLine className="size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">
              Provider worker{" "}
              {workerOnline ? "recently connected" : "has no recent heartbeat"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last heartbeat: {formatDate(records.heartbeat?.last_seen_at)}
            </p>
          </div>
        </div>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          This describes the worker only. Switch agent availability is not
          monitored yet.
        </p>
      </div>
      <section className="mb-9" aria-labelledby="cases-heading">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="cases-heading" className="text-lg font-medium">
            Cases to follow
          </h2>
          <Link href="/people" className="text-xs text-brand hover:underline">
            View all cases
          </Link>
        </div>
        {records.cases.length ? (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {records.cases.slice(0, 5).map((offboardingCase) => (
              <Link
                key={offboardingCase.id}
                href={`/people/${offboardingCase.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-surface-muted/40 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <div>
                  <p className="text-sm font-medium">
                    {offboardingCase.full_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Departure {formatDate(offboardingCase.departure_on, false)}
                  </p>
                </div>
                <StatusBadge status={offboardingCase.status} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={UsersRound} title="Start with a departure record.">
            Create a case, connect an authorized organization, and investigate
            the person’s provider identity.
          </EmptyState>
        )}
      </section>
      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-5 text-lg font-medium">Recent activity</h2>
          {records.events.length ? (
            <ol className="space-y-5">
              {records.events.slice(0, 6).map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
                    <FileCheck2
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-sm capitalize">
                      {humanize(event.event_type)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {event.actor_type} · {formatDate(event.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">
              No saved activity yet. Case creation, scan requests, and decisions
              will appear here.
            </p>
          )}
        </section>
        <section>
          <h2 className="mb-5 text-lg font-medium">Verification status</h2>
          <div className="mb-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm">Saved evidence reports</p>
              <span className="font-medium tabular-nums">
                {records.reports.length}
              </span>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              An investigation records what was checked. A removal is verified
              only after a new provider scan.
            </p>
            <Link
              href="/reports"
              className="mt-4 inline-block text-xs text-brand hover:underline"
            >
              Inspect the evidence →
            </Link>
          </div>
          <CoverageNotice />
        </section>
      </div>
    </>
  );
}
