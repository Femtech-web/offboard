import { z } from "zod";
import { approvalRecord, operationRecord } from "@/core/records";
import { providerResponseSchema } from "@/core/job-results";
import { snapshotSchema } from "@/core/workflow";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, humanize } from "@/lib/format";

type Approval = z.infer<typeof approvalRecord>;
type Operation = z.infer<typeof operationRecord>;

export function AuthorizationEvidence({
  approval,
  operation,
}: {
  approval?: Approval;
  operation?: Operation;
}) {
  const target = snapshotSchema.safeParse(approval?.target_snapshot);
  const providerResponse = providerResponseSchema.safeParse(
    operation?.provider_response,
  );
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium">
        Authorization & provider operation
      </h2>
      {approval ? (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Human authorization</h3>
            <StatusBadge status={approval.status} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                Approval channel
              </dt>
              <dd className="mt-1">
                {approval.authorization_method === "email"
                  ? "Private email review"
                  : "Authenticated dashboard"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Authorized administrator
              </dt>
              <dd className="mt-1 break-all">{approval.approved_by}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Decision recorded
              </dt>
              <dd className="mt-1">{formatDate(approval.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Approval expires
              </dt>
              <dd className="mt-1">{formatDate(approval.expires_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Single-use approval consumed
              </dt>
              <dd className="mt-1">
                {approval.consumed_at
                  ? formatDate(approval.consumed_at)
                  : "Not consumed"}
              </dd>
            </div>
          </dl>
          {target.success && (
            <div className="mt-5 rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-medium">
                Remove {humanize(target.data.grantType)}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                @{target.data.username} · user ID {target.data.providerUserId}
                <br />
                {target.data.organization} · organization ID{" "}
                {target.data.organizationId}
              </p>
              <p className="mt-3 font-mono text-xs leading-6 break-all text-muted-foreground">
                {target.data.resourceIdentifier}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          No removal approval is associated with this investigation. An
          investigation never implies removal.
        </p>
      )}
      {operation ? (
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Saved provider execution</h3>
            <StatusBadge status={operation.status} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                Provider request attempted
              </dt>
              <dd className="mt-1">{formatDate(operation.attempted_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Provider response
              </dt>
              <dd className="mt-1">
                {providerResponse.success
                  ? `${providerResponse.data.status ? `HTTP ${providerResponse.data.status}` : "No HTTP response"} · ${humanize(providerResponse.data.outcome)}`
                  : "No provider response saved"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Independent rescan completed
              </dt>
              <dd className="mt-1">
                {operation.verified_at
                  ? formatDate(operation.verified_at)
                  : "No successful rescan recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Provider request ID
              </dt>
              <dd className="mt-1 break-all">
                {providerResponse.success && providerResponse.data.requestId
                  ? providerResponse.data.requestId
                  : "Not returned or not saved"}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            The provider response and independent rescan are separate evidence.
            An accepted request alone does not verify removal.
          </p>
        </div>
      ) : approval ? (
        <p className="mt-5 border-t border-border pt-5 text-sm leading-7 text-attention">
          No provider operation was saved for this approval. Its execution and
          verification must not be assumed.
        </p>
      ) : null}
    </section>
  );
}
