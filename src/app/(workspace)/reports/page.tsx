import { PendingJobRefresh } from "@/components/layout/pending-job-refresh";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { workspaceRecords } from "@/server/queries";
import {
  CoverageNotice,
  EmptyState,
  PageHeading,
} from "@/components/ui/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

export default async function ReportsPage() {
  const { reports, cases, jobs } = await workspaceRecords();
  return (
    <>
      <PendingJobRefresh
        active={jobs.some(
          (job) => job.status === "queued" || job.status === "leased",
        )}
      />
      <PageHeading
        title="Verification reports"
        description="Review access findings, approvals, removals, and the checks that followed."
      />
      <div className="mb-8">
        <CoverageNotice />
      </div>
      {reports.length ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="flex flex-wrap items-center justify-between gap-4 p-6 hover:bg-surface-muted/40 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <div>
                <p className="font-medium">
                  {
                    cases.find(
                      (offboardingCase) =>
                        offboardingCase.id === report.case_id,
                    )?.full_name
                  }
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="capitalize">{report.kind}</span> ·{" "}
                  {formatDate(report.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={report.outcome} />
                <StatusBadge status={report.coverage_status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileCheck2} title="No verification reports yet">
          Reports appear after an access check or removal. Start an
          investigation from a case to create the first report.
        </EmptyState>
      )}
    </>
  );
}
