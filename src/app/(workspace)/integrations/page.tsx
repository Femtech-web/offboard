import { PendingJobRefresh } from "@/components/layout/pending-job-refresh";
import { GitBranch, PlugZap } from "lucide-react";
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
  const { integrations, jobs, profile } = await workspaceRecords();
  const canManage = profile.role === "admin";
  const { error } = await searchParams;
  return (
    <>
      <PendingJobRefresh
        active={jobs.some(
          (job) => job.status === "queued" || job.status === "leased",
        )}
      />
      <PageHeading
        title="Integrations"
        description={
          canManage
            ? "Connect the organizations you want to check and review their connection status."
            : "Review the organization connection used for this controlled test."
        }
      />
      <OperationError error={error} />
      <div
        className={`grid items-start gap-8 ${canManage ? "xl:grid-cols-[1fr_340px]" : ""}`}
      >
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
                    Administrator access confirmed. Permission to remove members
                    is checked separately before each change.
                  </p>
                )}
                {integration.last_error && (
                  <p
                    role="status"
                    className="mt-4 rounded-lg border border-critical/20 p-3 text-xs leading-6 text-critical"
                  >
                    Last check failed:{" "}
                    {integration.last_error.replaceAll("_", " ")}. Check the
                    organization’s permissions and try again.
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
                    pending actions
                  </p>
                  {canManage && (
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
                  )}
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              icon={PlugZap}
              title="Connect an authorized organization."
            >
              Add your company’s GitHub organization. Offboard checks the
              connection before showing it as connected.
            </EmptyState>
          )}
          <section className="rounded-xl border border-dashed border-border p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Vercel</h2>
              <StatusBadge status="unsupported" />
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Vercel access checks aren’t available yet. Vercel permissions
              remain unchecked in your reports.
            </p>
          </section>
        </div>
        {canManage && (
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-medium">Add GitHub</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Enter an organization you manage that’s enabled for this
              workspace.
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
            <p className="mt-6 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
              Connecting an organization doesn’t remove anyone’s access.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
