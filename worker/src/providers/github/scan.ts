import {
  GitHubProviderError,
  GitHubReadOnlyClient,
  type GitHubUser,
} from "./client";

type ProtectionReason =
  | "organization_owner"
  | "integration_identity"
  | "configured_protected_identity"
  | "privileged_account";

export async function scanGitHubAccess(
  client: GitHubReadOnlyClient,
  username: string,
  protectedUserIds: string[] = [],
) {
  const startedAt = new Date().toISOString();
  const connection = await client.inspectConnection();
  const [target, members, owners, collaborators] = await Promise.all([
    client.getUser(username),
    client.listMembers(),
    client.listMembers("admin"),
    client.listOutsideCollaborators(),
  ]);

  // Inconsistent enumeration is unresolved, never evidence that a grant is absent.
  if (
    !owners.some((owner) => owner.id === connection.authenticatedUser.id) ||
    owners.some((owner) => !members.some((member) => member.id === owner.id)) ||
    members.some((member) =>
      collaborators.some((collaborator) => collaborator.id === member.id),
    )
  ) {
    throw new GitHubProviderError("invalid_response");
  }

  const completedAt = new Date().toISOString();
  const protectionReasons: ProtectionReason[] = [];
  if (owners.some((owner) => owner.id === target.id))
    protectionReasons.push("organization_owner");
  if (connection.authenticatedUser.id === target.id)
    protectionReasons.push("integration_identity");
  if (protectedUserIds.includes(String(target.id)))
    protectionReasons.push("configured_protected_identity");
  if (target.site_admin || target.type !== "User")
    protectionReasons.push("privileged_account");

  function finding(
    users: GitHubUser[],
    grantType: "organization_membership" | "outside_collaborator",
  ) {
    const observedUser = users.find((user) => user.id === target.id);
    if (!observedUser) return [];

    return [
      {
        providerUserId: String(observedUser.id),
        username: observedUser.login,
        grantType,
        resourceIdentifier: `github:organization:${connection.organization.id}`,
        status: "access_detected" as const,
        protectionReasons,
        observedAt: completedAt,
      },
    ];
  }

  const findings = [
    ...finding(members, "organization_membership"),
    ...finding(collaborators, "outside_collaborator"),
  ];

  return {
    provider: "github" as const,
    operation: "read_only_access_scan" as const,
    organization: {
      id: String(connection.organization.id),
      login: connection.organization.login,
    },
    authenticatedIdentity: {
      id: String(connection.authenticatedUser.id),
      login: connection.authenticatedUser.login,
    },
    target: {
      id: String(target.id),
      login: target.login,
      identityConfirmedForRemoval: false,
    },
    startedAt,
    completedAt,
    coverage: [
      {
        source: "organization_membership" as const,
        outcome: "checked" as const,
        recordCount: members.length,
      },
      {
        source: "organization_owners" as const,
        outcome: "checked" as const,
        recordCount: owners.length,
      },
      {
        source: "outside_collaborator" as const,
        outcome: "checked" as const,
        recordCount: collaborators.length,
      },
    ],
    targetAccess: findings.length
      ? ("access_detected" as const)
      : ("not_detected_in_checked_sources" as const),
    findings,
    limitations: [
      "This scan covers GitHub organization membership and outside-collaborator listings at the stated times.",
      "Enterprise-managed access and other services are not verified by this scan.",
      "This read-only scan alone does not establish complete offboarding or authorized removal.",
    ],
  };
}
