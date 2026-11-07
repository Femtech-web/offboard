import { PendingJobRefresh } from "@/components/layout/pending-job-refresh";
import { GitBranch, PlugZap, TriangleAlert } from "lucide-react";
import { workspaceRecords } from "@/server/queries";
import { connectGitHub } from "@/server/actions";
import {
  EmptyState,
  inputClassName,
  OperationError,
  PageHeading,
} from "@/components/ui/workspace";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { integrations, jobs } = await workspaceRecords();
  const { error } = await searchParams;
  return (
    <>
      <PendingJobRefresh
        active={jobs.some(
          (job) => job.status === "queued" || job.status === "leased",
        )}
      />
      <PageHeading
        eyebrow="Integrations"
        title="Know what’s connected."
        description="Connection status comes from a real worker check. Provider credentials stay with the local worker."
      />
      <OperationError error={error} />
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {integrations.length ? (
            integrations.map((integration) => (
              <section
                key={integration.id}
                className="rounded-xl border border-border bg-surface p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-brand/20 bg-brand/8">
                      <GitBranch
                        className="size-6 text-brand"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        GitHub organization
                      </p>
                      <h2 className="mt-1 text-lg font-medium">
                        {integration.organization}
                      </h2>
                    </div>
                  </div>
                  <StatusBadge status={integration.status} />
                </div>
                <dl className="mt-6 space-y-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Organization ID</dt>
                    <dd>{integration.organization_id ?? "Not resolved"}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">
                      Last successful check
                    </dt>
                    <dd>{formatDate(integration.last_successful_check_at)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Last attempt</dt>
                    <dd>{formatDate(integration.last_checked_at)}</dd>
                  </div>
                </dl>
                {integration.permissions.organizationRole === "admin" && (
                  <p className="mt-5 text-xs leading-6 text-muted-foreground">
                    Active administrator membership observed. Removal capability
                    has not been established by a read-only connection check.
                  </p>
                )}
                {integration.last_error && (
                  <p
                    role="status"
                    className="mt-4 rounded-lg border border-critical/20 p-3 text-xs leading-6 text-critical"
                  >
                    Last check failed:{" "}
                    {integration.last_error.replaceAll("_", " ")}. Prior
                    successful checks do not establish current availability.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {
                      jobs.filter(
                        (job) =>
                          job.integration_id === integration.id &&
                          ["queued", "leased"].includes(job.status),
                      ).length
                    }{" "}
                    pending jobs
                  </p>
                  <form action={connectGitHub}>
                    <input
                      type="hidden"
                      name="organization"
                      value={integration.organization}
                    />
                    <SubmitButton pendingLabel="Queuing…">
                      Check connection
                    </SubmitButton>
                  </form>
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              icon={PlugZap}
              title="Connect an authorized organization."
            >
              Add the GitHub organization configured in your local worker. The
              connection stays unverified until the provider responds.
            </EmptyState>
          )}
          <section className="rounded-xl border border-dashed border-border p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Vercel</h2>
              <StatusBadge status="not_connected" />
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Vercel access checks are not implemented. No Vercel team or
              permission has been verified, and GitHub results cannot clear this
              scope.
            </p>
          </section>
        </div>
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-medium">Add GitHub</h2>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            Use an organization you administer and have permission to test. Its
            name must match the worker’s configured allowlist.
          </p>
          <form action={connectGitHub} className="mt-5 space-y-5">
            <label className="block text-sm">
              Organization
              <input
                name="organization"
                required
                maxLength={39}
                autoCapitalize="none"
                spellCheck={false}
                className={inputClassName}
              />
            </label>
            <SubmitButton pendingLabel="Queuing check…">
              Connect & check
            </SubmitButton>
          </form>
          <div className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
            <TriangleAlert
              className="mt-1 size-4 shrink-0 text-attention"
              aria-hidden="true"
            />
            The local worker must be running to process checks. This form never
            grants the agent removal approval.
          </div>
        </section>
      </div>
    </>
  );
}
