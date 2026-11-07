import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { workspaceRecords } from "@/server/queries";
import { CoverageNotice, PageHeading } from "@/components/ui/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { scanSchema } from "@/core/workflow";
import { AuthorizationEvidence } from "@/features/reports/authorization-evidence";
import { InvestigationSource } from "@/features/reports/investigation-source";
import { jobResultSchema } from "@/core/job-results";
import { reportAuthorization } from "@/features/reports/report-authorization";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  if (!z.uuid().safeParse(reportId).success) notFound();
  const records = await workspaceRecords();
  const report = records.reports.find((record) => record.id === reportId);
  if (!report) notFound();
  const offboardingCase = records.cases.find(
    (record) => record.id === report.case_id,
  );
  const identity = records.identities.find(
    (record) => record.case_id === report.case_id,
  );
  const job = records.jobs.find((record) => record.id === report.job_id);
  const { operation, approval } = reportAuthorization(report, records);
  const result = jobResultSchema.safeParse(report.evidence);
  const source =
    result.success && result.data.type === "scan"
      ? result.data.scan
      : result.success && result.data.type === "removal"
        ? result.data.verification
        : null;
  const scan = scanSchema.safeParse(source);
  const failureReason =
    job?.error_code ??
    (typeof report.evidence.error === "string"
      ? report.evidence.error
      : result.success && result.data.type === "failure"
        ? result.data.code
        : null);
  return (
    <>
      <Link
        href="/reports"
        className="mb-7 inline-block text-xs text-muted-foreground hover:text-brand"
      >
        ← Verification Reports
      </Link>
      <PageHeading
        eyebrow={`${report.kind} evidence · ${formatDate(report.created_at)}`}
        title={offboardingCase?.full_name ?? "Offboarding evidence"}
        description="This report describes a specific checked scope and point in time. It does not certify that all company access is gone."
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={report.outcome} />
          <StatusBadge status={report.coverage_status} />
        </div>
      </PageHeading>
      <div className="grid items-start gap-7 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {failureReason && (
            <div
              role="status"
              className="rounded-xl border border-attention/25 bg-attention/5 p-5"
            >
              <h2 className="text-sm font-medium text-attention">
                This check did not establish verification.
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {failureReason.replaceAll("_", " ")}
              </p>
            </div>
          )}
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-medium">Who & what was checked</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Intended departing person
                </dt>
                <dd className="mt-1">{offboardingCase?.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Provider identity
                </dt>
                <dd className="mt-1">
                  {scan.success
                    ? `@${scan.data.target.login} · ID ${scan.data.target.id}`
                    : identity
                      ? `@${identity.username} · ID ${identity.provider_user_id ?? "not resolved"}`
                      : "Unresolved"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Organization</dt>
                <dd className="mt-1">
                  {scan.success
                    ? `${scan.data.organization.login} · ID ${scan.data.organization.id}`
                    : (records.integrations.find(
                        (integration) => integration.id === job?.integration_id,
                      )?.organization ?? "Not checked")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {report.kind === "removal"
                    ? "Independent rescan time"
                    : "Investigation scan time"}
                </dt>
                <dd className="mt-1">
                  {scan.success
                    ? formatDate(scan.data.completedAt)
                    : "No successful provider check recorded"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-medium">
              Checked permissions & remaining access
            </h2>
            {scan.success ? (
              <>
                <ul className="mt-5 space-y-3">
                  {scan.data.coverage.map((coverage) => (
                    <li
                      key={coverage.source}
                      className="flex flex-wrap items-center justify-between gap-3 text-sm"
                    >
                      <span className="capitalize">
                        {coverage.source.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Checked · {coverage.recordCount} records
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 border-t border-border pt-5">
                  <p className="text-sm font-medium">
                    Remaining findings in this scan: {scan.data.findings.length}
                  </p>
                  {scan.data.findings.map((finding) => (
                    <p
                      key={finding.grantType}
                      className="mt-2 text-sm leading-7 text-attention"
                    >
                      {finding.grantType.replaceAll("_", " ")} ·{" "}
                      {finding.resourceIdentifier}
                    </p>
                  ))}
                  {!scan.data.findings.length && (
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      Access was not detected in the listed sources at this
                      time. Other systems and permissions remain unverified.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                The provider check did not produce complete evidence. No
                permissions can be marked verified from this report.
              </p>
            )}
          </section>
          <InvestigationSource context={job?.room_context ?? null} />
          <AuthorizationEvidence approval={approval} operation={operation} />
          <details className="rounded-xl border border-border bg-surface p-6">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand">
              Inspect saved evidence
            </summary>
            <p className="mt-4 text-xs text-muted-foreground">
              Report {report.id} · Job {report.job_id}
            </p>
            <pre className="mt-4 max-h-[600px] overflow-auto rounded-lg bg-background p-4 text-xs leading-6 break-all whitespace-pre-wrap">
              {JSON.stringify(report.evidence, null, 2)}
            </pre>
          </details>
        </div>
        <aside className="space-y-5">
          <CoverageNotice />
          <Link
            href={`/people/${report.case_id}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            Open the case →
          </Link>
        </aside>
      </div>
    </>
  );
}
