import { describe, expect, it, vi } from "vitest";
import type { WorkerJob, RemovalSnapshot } from "../../src/core/workflow";
import { scanSchema, verificationOutcome } from "../../src/core/workflow";
import { executeJob, type WorkerJobDependencies } from "./jobs";
import { GitHubProviderError } from "./providers/github/client";
import type { scanGitHubAccess } from "./providers/github/scan";

const time = "2026-11-07T12:00:00.000Z";
const snapshot: RemovalSnapshot = {
  organization: "test-org",
  organizationId: "7",
  providerUserId: "42",
  username: "test-person",
  grantType: "organization_membership",
  resourceIdentifier: "github:organization:7",
};
function scan(findings = true): Awaited<ReturnType<typeof scanGitHubAccess>> {
  return {
    provider: "github",
    operation: "read_only_access_scan",
    organization: { id: "7", login: "test-org" },
    authenticatedIdentity: { id: "99", login: "integration" },
    target: {
      id: "42",
      login: "test-person",
      identityConfirmedForRemoval: false,
    },
    startedAt: time,
    completedAt: time,
    coverage: [
      { source: "organization_membership", outcome: "checked", recordCount: 2 },
      { source: "organization_owners", outcome: "checked", recordCount: 1 },
      { source: "outside_collaborator", outcome: "checked", recordCount: 0 },
    ],
    targetAccess: findings
      ? "access_detected"
      : "not_detected_in_checked_sources",
    findings: findings
      ? [
          {
            providerUserId: "42",
            username: "test-person",
            grantType: "organization_membership",
            resourceIdentifier: "github:organization:7",
            status: "access_detected",
            protectionReasons: [],
            observedAt: time,
          },
        ]
      : [],
    limitations: ["Offline test fixture"],
  };
}
const job: WorkerJob = {
  id: "71374c9e-f061-4c84-938c-8ad3c6f2d146",
  lease_token: "fd92c788-126a-4058-8b13-81a5605784fa",
  kind: "execute_removal",
  integration_id: "4982d849-d99b-4f9f-8137-c75f3ccbc649",
  case_id: "8658d787-fcdf-428a-b3c1-a815f85c17b7",
  approval_id: "384ce8c9-4b1d-4574-813e-a8987968089e",
  organization: "test-org",
  username: "test-person",
  expected_user_id: "42",
  snapshot,
};
const configuration = {
  accessToken: "test-only",
  organization: "test-org",
  protectedUserIds: ["99"],
  removalTestUserIds: ["42"],
};
function dependencies() {
  return {
    scan: vi
      .fn<WorkerJobDependencies["scan"]>()
      .mockResolvedValueOnce(scan())
      .mockResolvedValueOnce(scan(false)),
    beginRemoval: vi
      .fn<WorkerJobDependencies["beginRemoval"]>()
      .mockResolvedValue(true),
    remove: vi.fn<WorkerJobDependencies["remove"]>().mockResolvedValue({
      status: 204,
      outcome: "accepted",
      requestId: "test-request",
      attemptedAt: time,
    }),
  };
}
describe("worker removal boundary", () => {
  it("requires a fresh scan, server approval consumption, mutation, and a separate scan in order", async () => {
    const tools = dependencies();
    const result = await executeJob(job, configuration, tools);
    expect(result.type).toBe("removal");
    expect(tools.scan).toHaveBeenCalledTimes(2);
    expect(tools.beginRemoval.mock.invocationCallOrder[0]).toBeGreaterThan(
      tools.scan.mock.invocationCallOrder[0]!,
    );
    expect(tools.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      tools.beginRemoval.mock.invocationCallOrder[0]!,
    );
    expect(tools.scan.mock.invocationCallOrder[1]).toBeGreaterThan(
      tools.remove.mock.invocationCallOrder[0]!,
    );
    if (result.type === "removal")
      expect(verificationOutcome(snapshot, result.verification)).toBe(
        "verified_removed",
      );
  });
  it.each([false, "lost_response"])(
    "does not mutate when approval acknowledgement is %s",
    async (acknowledgement) => {
      const tools = dependencies();
      if (acknowledgement === false)
        tools.beginRemoval.mockResolvedValue(false);
      else
        tools.beginRemoval.mockRejectedValue(
          new Error("Connection lost after consume"),
        );
      expect((await executeJob(job, configuration, tools)).type).toBe(
        "failure",
      );
      expect(tools.remove).not.toHaveBeenCalled();
    },
  );
  it("refuses a target outside the controlled test allowlist", async () => {
    const tools = dependencies();
    expect(
      await executeJob(
        job,
        { ...configuration, removalTestUserIds: [] },
        tools,
      ),
    ).toMatchObject({
      type: "failure",
      code: "target_not_authorized_for_removal",
    });
    expect(tools.beginRemoval).not.toHaveBeenCalled();
    expect(tools.remove).not.toHaveBeenCalled();
  });
  it("refuses a protected identity discovered in fresh preflight", async () => {
    const tools = dependencies();
    const protectedScan = scan();
    protectedScan.findings[0]!.protectionReasons.push("organization_owner");
    tools.scan.mockReset().mockResolvedValue(protectedScan);
    expect(await executeJob(job, configuration, tools)).toMatchObject({
      type: "failure",
      code: "protected_identity",
    });
    expect(tools.remove).not.toHaveBeenCalled();
  });
  it("refuses a username rebound to a different stable ID", async () => {
    const tools = dependencies();
    const rebound = scan(false);
    rebound.target.id = "400";
    tools.scan.mockReset().mockResolvedValue(rebound);
    expect(await executeJob(job, configuration, tools)).toMatchObject({
      type: "failure",
      code: "target_mismatch",
    });
    expect(tools.remove).not.toHaveBeenCalled();
  });
  it("cannot verify a successful DELETE when the independent check fails", async () => {
    const tools = dependencies();
    tools.scan
      .mockReset()
      .mockResolvedValueOnce(scan())
      .mockRejectedValueOnce(new GitHubProviderError("unavailable", 503));
    const result = await executeJob(job, configuration, tools);
    expect(result).toMatchObject({
      type: "removal",
      verification: null,
      verificationError: "unavailable",
    });
    expect(tools.remove).toHaveBeenCalledTimes(1);
    if (result.type === "removal")
      expect(verificationOutcome(snapshot, result.verification)).toBe(
        "verification_failed",
      );
  });
  it("does not repeat an ambiguous provider mutation", async () => {
    const tools = dependencies();
    tools.remove.mockResolvedValue({
      status: null,
      outcome: "unknown",
      requestId: null,
      attemptedAt: time,
    });
    const result = await executeJob(job, configuration, tools);
    expect(tools.remove).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      type: "removal",
      providerResponse: { outcome: "unknown" },
    });
  });
  it("preserves remaining access rather than treating a 204 response as clearance", async () => {
    const tools = dependencies();
    tools.scan.mockReset().mockResolvedValue(scan());
    const result = await executeJob(job, configuration, tools);
    if (result.type !== "removal") throw new Error("Expected removal evidence");
    expect(verificationOutcome(snapshot, result.verification)).toBe(
      "access_remains",
    );
  });
  it("rejects incomplete coverage even when the checked list contains no access", () => {
    const incomplete = scan(false);
    incomplete.coverage[2] = incomplete.coverage[0]!;
    expect(scanSchema.safeParse(incomplete).success).toBe(false);
    expect(verificationOutcome(snapshot, incomplete)).toBe(
      "verification_failed",
    );
  });
  it("refuses any organization outside local configuration before contacting providers", async () => {
    const tools = dependencies();
    expect(
      await executeJob(
        { ...job, organization: "other-org" },
        configuration,
        tools,
      ),
    ).toMatchObject({ type: "failure", code: "organization_not_allowed" });
    expect(tools.scan).not.toHaveBeenCalled();
    expect(tools.remove).not.toHaveBeenCalled();
  });
});
