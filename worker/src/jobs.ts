import type { JobResult } from "../../src/core/job-results";
import { failureCode } from "../../src/core/job-results";
import {
  assertRemovalPreflight,
  scanSchema,
  verificationOutcome,
  scopeLimitations,
  type WorkerJob,
} from "../../src/core/workflow";
import {
  GitHubProviderError,
  GitHubReadOnlyClient,
} from "./providers/github/client";
import { removeGitHubGrant } from "./providers/github/removal";
import { scanGitHubAccess } from "./providers/github/scan";

type WorkerConfiguration = {
  accessToken: string;
  organization: string;
  protectedUserIds: string[];
  removalTestUserIds: string[];
};
export type WorkerJobDependencies = {
  scan: typeof scanGitHubAccess;
  remove: typeof removeGitHubGrant;
  beginRemoval: (
    job: WorkerJob,
    preflight: Awaited<ReturnType<typeof scanGitHubAccess>>,
  ) => Promise<boolean>;
};

export function safeFailureCode(error: unknown) {
  const code =
    error instanceof GitHubProviderError
      ? error.code
      : error instanceof Error
        ? error.message
        : "worker_error";
  const parsed = failureCode.safeParse(code);
  return parsed.success ? parsed.data : "worker_error";
}

export async function executeJob(
  job: WorkerJob,
  configuration: WorkerConfiguration,
  dependencies: WorkerJobDependencies,
): Promise<JobResult> {
  try {
    if (
      job.organization.toLowerCase() !==
      configuration.organization.toLowerCase()
    )
      throw new Error("organization_not_allowed");
    const client = new GitHubReadOnlyClient(
      configuration.accessToken,
      configuration.organization,
    );
    if (job.kind === "check_integration") {
      const { organization } = await client.inspectConnection();
      return {
        type: "connection",
        organization: {
          id: String(organization.id),
          login: organization.login,
        },
        permissions: {
          organizationRole: "admin",
          mode: "user_token",
          removalPermission: "not_tested",
        },
        checkedAt: new Date().toISOString(),
      };
    }
    if (!job.username) throw new Error("target_mismatch");
    const preflight = await dependencies.scan(
      client,
      job.username,
      configuration.protectedUserIds,
    );
    scanSchema.parse(preflight);
    if (job.expected_user_id && preflight.target.id !== job.expected_user_id)
      throw new Error("target_mismatch");
    if (job.kind === "scan")
      return { type: "scan", scan: preflight, limitations: scopeLimitations };
    if (!job.snapshot) throw new Error("target_mismatch");
    assertRemovalPreflight(job.snapshot, preflight);
    if (!configuration.removalTestUserIds.includes(job.snapshot.providerUserId))
      throw new Error("target_not_authorized_for_removal");
    // Never issue a provider mutation if the approval consumption acknowledgement is lost.
    if (!(await dependencies.beginRemoval(job, preflight)))
      throw new Error("approval_denied");
    const providerResponse = await dependencies.remove(
      configuration.accessToken,
      job.snapshot,
    );
    try {
      const verification = await dependencies.scan(
        client,
        job.username,
        configuration.protectedUserIds,
      );
      if (
        verificationOutcome(job.snapshot, verification) ===
        "verification_failed"
      )
        throw new Error("target_mismatch");
      return {
        type: "removal",
        preflight,
        providerResponse,
        verification,
        verificationError: null,
        limitations: scopeLimitations,
      };
    } catch (error) {
      return {
        type: "removal",
        preflight,
        providerResponse,
        verification: null,
        verificationError: safeFailureCode(error),
        limitations: scopeLimitations,
      };
    }
  } catch (error) {
    return {
      type: "failure",
      code: safeFailureCode(error),
      limitations: scopeLimitations,
    };
  }
}
