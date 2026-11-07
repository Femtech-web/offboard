import { PendingJobRefresh } from "@/components/layout/pending-job-refresh";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fingerprint, GitBranch, ScanLine, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { workspaceRecords } from "@/server/queries";
import {
  confirmIdentity,
  decideRemoval,
  requestScan,
  requestApprovalEmail,
} from "@/server/actions";
import {
  CoverageNotice,
  inputClassName,
  OperationError,
  PageHeading,
} from "@/components/ui/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate, humanize } from "@/lib/format";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const records = await workspaceRecords();
  const canManage = records.profile.role === "admin";
  const offboardingCase = records.cases.find((record) => record.id === caseId);
  if (!offboardingCase) notFound();
  const { error } = await searchParams;
  const identity = records.identities.find(
    (record) => record.case_id === caseId,
  );
  const findings = records.findings.filter(
    (record) => record.case_id === caseId,
  );
  const jobs = records.jobs.filter((record) => record.case_id === caseId);
  const reports = records.reports.filter((record) => record.case_id === caseId);
  return (
    <>
      <PendingJobRefresh
        active={
          jobs.some(
            (job) => job.status === "queued" || job.status === "leased",
          ) ||
          records.emailDispatches.some(
            (dispatch) =>
              findings.some((finding) => finding.id === dispatch.finding_id) &&
              ["queued", "processing"].includes(dispatch.status),
          )
        }
      />
      <Link
        href="/people"
        className="mb-7 inline-block text-xs text-muted-foreground hover:text-brand"
      >
        ← People & Offboarding
      </Link>
      <PageHeading
        eyebrow={`Departure · ${formatDate(offboardingCase.departure_on, false)}`}
        title={offboardingCase.full_name}
        description={
          canManage
            ? "Confirm the person, investigate their access, and review each proposed correction."
            : "Review the account, decisions, and saved verification evidence."
        }
      >
        <StatusBadge status={offboardingCase.status} />
      </PageHeading>
      <OperationError error={error} />
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-7">
          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <Fingerprint
                className="size-6 text-brand"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h2 className="text-lg font-medium">GitHub account</h2>
            </div>
            {identity && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">GitHub · @{identity.username}</p>
                  </div>
                  <StatusBadge
                    status={identity.confirmed_at ? "confirmed" : "unconfirmed"}
                  />
                </div>
                {identity.confirmed_at ? (
                  <p className="mt-4 text-xs leading-6 text-muted-foreground">
                    Account confirmed on {formatDate(identity.confirmed_at)}.
                  </p>
                ) : canManage && identity.provider_user_id ? (
                  <form
                    action={confirmIdentity}
                    className="mt-5 border-t border-border pt-5"
                  >
                    <input type="hidden" name="caseId" value={caseId} />
                    <input
                      type="hidden"
                      name="identityId"
                      value={identity.id}
                    />
                    <input
                      type="hidden"
                      name="providerUserId"
                      value={identity.provider_user_id}
                    />
                    <p className="mb-4 text-sm leading-7 text-muted-foreground">
                      Verify independently that @{identity.username} (ID{" "}
                      {identity.provider_user_id}) belongs to{" "}
                      {offboardingCase.full_name}. Confirming the account
                      doesn’t approve a removal.
                    </p>
                    <SubmitButton pendingLabel="Confirming…">
                      Confirm this identity
                    </SubmitButton>
                  </form>
                ) : (
                  <p className="mt-5 text-xs leading-6 text-muted-foreground">
                    {canManage
                      ? "Run an access check to find this account before confirming it."
                      : "This account has not been confirmed by an administrator."}
                  </p>
                )}
              </>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-lg font-medium">
              Discovered access & decisions
            </h2>
            {findings.length ? (
              <div className="space-y-4">
                {findings.map((finding) => {
                  const integration = records.integrations.find(
                    (record) => record.id === finding.integration_id,
                  );
                  const approval = records.approvals
                    .filter((record) => record.finding_id === finding.id)
                    .sort((a, b) =>
                      b.created_at.localeCompare(a.created_at),
                    )[0];
                  const actionable = [
                    "access_detected",
                    "access_remains",
                    "verification_failed",
                  ].includes(finding.status);
                  const blocked = finding.protection_reasons.length > 0;
                  const emailRequest = records.approvalEmails
                    .filter((record) => record.finding_id === finding.id)
                    .sort((a, b) =>
                      b.created_at.localeCompare(a.created_at),
                    )[0];
                  const dispatch = records.emailDispatches
                    .filter((record) => record.finding_id === finding.id)
                    .sort((a, b) =>
                      b.created_at.localeCompare(a.created_at),
                    )[0];
                  return (
                    <article
                      key={finding.id}
                      className="rounded-xl border border-border bg-surface p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            GitHub · {integration?.organization}
                          </p>
                          <h3 className="mt-2 text-base font-medium capitalize">
                            {humanize(finding.grant_type)}
                          </h3>
                        </div>
                        <StatusBadge status={finding.status} />
                      </div>
                      <dl className="mt-5 grid gap-3 text-xs">
                        <div className="flex flex-wrap justify-between gap-2">
                          <dt className="text-muted-foreground">Target</dt>
                          <dd>
                            @{finding.username} · ID {finding.provider_user_id}
                          </dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <dt className="text-muted-foreground">
                            Last discovered
                          </dt>
                          <dd>{formatDate(finding.last_seen_at)}</dd>
                        </div>
                        {finding.verified_at && (
                          <div className="flex flex-wrap justify-between gap-2">
                            <dt className="text-muted-foreground">Verified</dt>
                            <dd>{formatDate(finding.verified_at)}</dd>
                          </div>
                        )}
                      </dl>
                      {blocked ? (
                        <div className="mt-5 flex gap-3 rounded-lg border border-attention/20 bg-attention/5 p-4">
                          <ShieldAlert
                            className="mt-0.5 size-5 shrink-0 text-attention"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-sm font-medium text-attention">
                              Protected account — removal blocked
                            </p>
                            <p className="mt-2 text-xs leading-6 text-muted-foreground">
                              {finding.protection_reasons
                                .map(humanize)
                                .join(", ")}
                              . This account cannot be removed through Offboard.
                            </p>
                          </div>
                        </div>
                      ) : canManage && actionable && identity?.confirmed_at ? (
                        <div className="mt-6 border-t border-border pt-5">
                          <p className="text-sm font-medium">
                            Review the exact proposal
                          </p>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">
                            Remove {humanize(finding.grant_type)} for @
                            {finding.username} (ID {finding.provider_user_id})
                            from {integration?.organization} (ID{" "}
                            {integration?.organization_id}). Approval expires in
                            15 minutes and can be used once.
                          </p>
                          <form
                            action={decideRemoval}
                            className="mt-5 space-y-4"
                          >
                            <input type="hidden" name="caseId" value={caseId} />
                            <input
                              type="hidden"
                              name="findingId"
                              value={finding.id}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="approved"
                            />
                            <label className="flex items-start gap-3 text-xs leading-6 text-muted-foreground">
                              <input
                                type="checkbox"
                                name="acknowledged"
                                value="yes"
                                required
                                className="mt-1 size-4 accent-brand"
                              />
                              I am authorized to remove this exact access from
                              this controlled account.
                            </label>
                            <SubmitButton
                              destructive
                              pendingLabel="Recording approval…"
                            >
                              Approve this removal
                            </SubmitButton>
                          </form>
                          <form action={decideRemoval} className="mt-3">
                            <input type="hidden" name="caseId" value={caseId} />
                            <input
                              type="hidden"
                              name="findingId"
                              value={finding.id}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="rejected"
                            />
                            <button className="min-h-11 rounded-lg border border-border px-4 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
                              Reject proposal
                            </button>
                          </form>
                        </div>
                      ) : canManage && actionable ? (
                        <p className="mt-5 text-xs leading-6 text-attention">
                          Confirm the provider identity here or through its
                          private email review before approving a removal.
                        </p>
                      ) : null}
                      {canManage && !blocked && actionable && (
                        <form
                          action={requestApprovalEmail}
                          className="mt-6 border-t border-border pt-5"
                        >
                          <input type="hidden" name="caseId" value={caseId} />
                          <input
                            type="hidden"
                            name="findingId"
                            value={finding.id}
                          />
                          <p className="mb-4 text-xs leading-6 text-muted-foreground">
                            Prefer email? Send a private, single-use review link
                            to your confirmed administrator address,{" "}
                            {records.profile.email}. It expires in 15 minutes
                            and requires an explicit decision.
                          </p>
                          <SubmitButton pendingLabel="Requesting email…">
                            Email me this proposal
                          </SubmitButton>
                        </form>
                      )}
                      {approval && (
                        <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
                          Latest decision:{" "}
                          {approval.status === "consumed"
                            ? "Approved (used)"
                            : humanize(approval.status)}{" "}
                          ·{" "}
                          {approval.authorization_method === "email"
                            ? "email review"
                            : "dashboard"}{" "}
                          · {formatDate(approval.created_at)}
                          {approval.status === "approved"
                            ? ` · expires ${formatDate(approval.expires_at)}`
                            : ""}
                        </p>
                      )}
                      {dispatch &&
                        [
                          "queued",
                          "processing",
                          "skipped",
                          "unknown",
                          "failed",
                        ].includes(dispatch.status) && (
                          <p className="mt-5 text-xs leading-6 text-muted-foreground">
                            Automatic email:{" "}
                            {dispatch.status === "queued"
                              ? "waiting to send"
                              : dispatch.status === "processing"
                                ? "sending"
                                : dispatch.status === "skipped"
                                  ? "not sent; a recent review already exists or this access no longer needs approval"
                                  : dispatch.status === "failed"
                                    ? "couldn’t be sent; request a new link to retry"
                                    : "delivery couldn’t be confirmed; check your inbox before requesting another link"}
                            .
                          </p>
                        )}
                      {emailRequest && (
                        <details
                          open={emailRequest.status === "pending"}
                          className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground"
                        >
                          <summary className="cursor-pointer rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                            Review email · {formatDate(emailRequest.created_at)}
                          </summary>
                          <p className="mt-2">
                            {emailRequest.delivery_status === "accepted"
                              ? "Accepted for delivery. Check your inbox and spam folder."
                              : emailRequest.delivery_status === "failed"
                                ? "The email couldn’t be sent. Request a new review link."
                                : emailRequest.delivery_status === "unknown"
                                  ? "Delivery couldn’t be confirmed. Request a new review link before deciding."
                                  : "Waiting for the email service to respond."}
                          </p>
                          <p>
                            Review:{" "}
                            {emailRequest.status === "pending" &&
                            Date.parse(emailRequest.expires_at) <=
                              records.observedAt
                              ? "expired"
                              : emailRequest.status === "decided"
                                ? "decision recorded"
                                : emailRequest.status}{" "}
                            · recipient {emailRequest.recipient_email}
                          </p>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-sm leading-7 text-muted-foreground">
                No access findings yet. Run an investigation to see what this
                account can access.
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-lg font-medium">Saved evidence</h2>
            {reports.length ? (
              <div className="divide-y divide-border rounded-xl border border-border">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-surface"
                  >
                    <div>
                      <p className="text-sm capitalize">{report.kind} report</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(report.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={report.outcome} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No report has been saved for this case.
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-6">
          {canManage && (
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-4 flex items-center gap-3">
                <ScanLine className="size-5 text-brand" aria-hidden="true" />
                <h2 className="font-medium">Investigate access</h2>
              </div>
              <p className="mb-5 text-xs leading-6 text-muted-foreground">
                Ask Offboard in the security-offboarding room to investigate
                this case with you, or run an access check below.
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Switch room request
              </p>
              <code className="mb-5 block rounded-lg border border-border bg-background p-3 text-xs leading-6 break-all select-all">
                @offboard investigate {caseId}
              </code>
              <p className="mb-5 text-xs leading-6 text-muted-foreground">
                Keep the Offboard agent running in Switch. You’ll review and
                approve any removal separately.
              </p>
              {records.integrations.length ? (
                <form action={requestScan} className="space-y-4">
                  <input type="hidden" name="caseId" value={caseId} />
                  <label className="block text-xs text-muted-foreground">
                    Authorized organization
                    <select
                      name="integrationId"
                      className={inputClassName}
                      required
                    >
                      {records.integrations.map((integration) => (
                        <option key={integration.id} value={integration.id}>
                          {integration.organization}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton pendingLabel="Queuing…">
                    Check access
                  </SubmitButton>
                </form>
              ) : (
                <Link
                  href="/integrations"
                  className="text-sm text-brand hover:underline"
                >
                  <GitBranch
                    className="mr-2 inline size-4"
                    aria-hidden="true"
                  />
                  Connect GitHub first
                </Link>
              )}
            </section>
          )}
          <section>
            <h2 className="mb-4 text-sm font-medium">Checks & changes</h2>
            {jobs.length ? (
              <ol className="space-y-3">
                {jobs.slice(0, 8).map((job) => (
                  <li
                    key={job.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs">
                        {job.kind === "scan"
                          ? "Access check"
                          : job.kind === "execute_removal"
                            ? "Access removal"
                            : "Connection check"}
                      </p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(job.created_at)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Requested{" "}
                      {job.request_origin === "switch"
                        ? "through Switch"
                        : job.request_origin === "email_review"
                          ? "automatically to refresh a pending email review"
                          : job.request_origin === "verification"
                            ? "for an independent verification"
                            : records.approvals.find(
                                  (approval) => approval.id === job.approval_id,
                                )?.authorization_method === "email"
                              ? "through a private email review"
                              : "in the dashboard"}
                    </p>
                    {job.error_code && (
                      <p className="mt-2 text-xs text-critical">
                        {humanize(job.error_code)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">
                No checks or changes yet.
              </p>
            )}
          </section>
          <CoverageNotice />
        </aside>
      </div>
    </>
  );
}
