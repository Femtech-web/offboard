import { z } from "zod";

export const githubName = z
  .string()
  .trim()
  .regex(
    /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i,
    "Use a valid GitHub username or organization.",
  );
export const providerId = z.string().regex(/^[1-9]\d*$/);
export const grantType = z.enum([
  "organization_membership",
  "outside_collaborator",
]);
export const scopeLimitations = [
  "GitHub organization membership, organization owners, and outside-collaborator listings only.",
  "Enterprise access, pending invitations, other GitHub organizations, Vercel, and other services remain unverified.",
];
export const scanSchema = z
  .object({
    organization: z.object({ id: providerId, login: githubName }),
    authenticatedIdentity: z.object({ id: providerId, login: githubName }),
    target: z.object({ id: providerId, login: githubName }),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    coverage: z
      .array(
        z.object({
          source: z.enum([
            "organization_membership",
            "organization_owners",
            "outside_collaborator",
          ]),
          outcome: z.literal("checked"),
          recordCount: z.number().int().nonnegative(),
        }),
      )
      .length(3),
    targetAccess: z.enum([
      "access_detected",
      "not_detected_in_checked_sources",
    ]),
    findings: z
      .array(
        z.object({
          providerUserId: providerId,
          username: githubName,
          grantType,
          resourceIdentifier: z.string().max(160),
          status: z.literal("access_detected"),
          protectionReasons: z.array(
            z.enum([
              "organization_owner",
              "integration_identity",
              "configured_protected_identity",
              "privileged_account",
            ]),
          ),
          observedAt: z.iso.datetime(),
        }),
      )
      .max(2),
  })
  .superRefine((scan, context) => {
    const sources = new Set(scan.coverage.map((item) => item.source));
    if (
      sources.size !== 3 ||
      Date.parse(scan.completedAt) < Date.parse(scan.startedAt)
    )
      context.addIssue({
        code: "custom",
        message: "Incomplete or inconsistent scan coverage.",
      });
    if (
      scan.findings.length > 0 !== (scan.targetAccess === "access_detected") ||
      new Set(scan.findings.map((finding) => finding.grantType)).size !==
        scan.findings.length
    )
      context.addIssue({ code: "custom", message: "Inconsistent findings." });
    if (
      scan.findings.some(
        (finding) =>
          finding.providerUserId !== scan.target.id ||
          finding.username.toLowerCase() !== scan.target.login.toLowerCase() ||
          finding.resourceIdentifier !==
            `github:organization:${scan.organization.id}`,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Finding target does not match the scan.",
      });
  });
export type AccessScan = z.infer<typeof scanSchema>;
export const snapshotSchema = z.object({
  organizationId: providerId,
  organization: githubName,
  providerUserId: providerId,
  username: githubName,
  grantType,
  resourceIdentifier: z.string().max(160),
});
export type RemovalSnapshot = z.infer<typeof snapshotSchema>;
export const jobSchema = z.object({
  id: z.uuid(),
  lease_token: z.uuid(),
  kind: z.enum(["check_integration", "scan", "execute_removal"]),
  integration_id: z.uuid(),
  case_id: z.uuid().nullable(),
  approval_id: z.uuid().nullable(),
  organization: githubName,
  username: githubName.nullable(),
  expected_user_id: providerId.nullable(),
  snapshot: snapshotSchema.nullable(),
});
export type WorkerJob = z.infer<typeof jobSchema>;

export function assertRemovalPreflight(
  snapshot: RemovalSnapshot,
  scan: AccessScan,
) {
  if (
    scan.organization.id !== snapshot.organizationId ||
    scan.organization.login.toLowerCase() !==
      snapshot.organization.toLowerCase() ||
    scan.target.id !== snapshot.providerUserId ||
    scan.target.login.toLowerCase() !== snapshot.username.toLowerCase()
  )
    throw new Error("target_mismatch");
  if (scan.target.id === scan.authenticatedIdentity.id)
    throw new Error("protected_identity");
  const matching = scan.findings.find(
    (finding) =>
      finding.providerUserId === snapshot.providerUserId &&
      finding.grantType === snapshot.grantType &&
      finding.resourceIdentifier === snapshot.resourceIdentifier,
  );
  if (!matching) throw new Error("permission_no_longer_present");
  if (scan.findings.some((finding) => finding.protectionReasons.length > 0))
    throw new Error("protected_identity");
}

export function verificationOutcome(
  snapshot: RemovalSnapshot,
  scan: AccessScan | null,
) {
  if (
    !scan ||
    scan.organization.id !== snapshot.organizationId ||
    scan.target.id !== snapshot.providerUserId ||
    scan.target.login.toLowerCase() !== snapshot.username.toLowerCase() ||
    scan.organization.login.toLowerCase() !==
      snapshot.organization.toLowerCase() ||
    !scanSchema.safeParse(scan).success
  )
    return "verification_failed" as const;
  return scan.findings.some(
    (finding) =>
      finding.providerUserId === snapshot.providerUserId &&
      finding.grantType === snapshot.grantType &&
      finding.resourceIdentifier === snapshot.resourceIdentifier,
  )
    ? ("access_remains" as const)
    : ("verified_removed" as const);
}
