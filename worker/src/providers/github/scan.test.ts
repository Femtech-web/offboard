import { describe, expect, it, vi } from "vitest";

import { GitHubReadOnlyClient } from "./client";
import { scanGitHubAccess } from "./scan";

const admin = {
  id: 99,
  login: "offboard-admin",
  type: "User",
  site_admin: false,
};
const target = {
  id: 42,
  login: "departed-test-user",
  type: "User",
  site_admin: false,
};

function createClient(
  overrides: Record<string, unknown> = {},
  failingPath?: string,
) {
  const request = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    const route =
      url.pathname +
      (url.pathname.endsWith("/members")
        ? `?role=${url.searchParams.get("role")}`
        : "");
    if (url.pathname === failingPath) return Response.json({}, { status: 403 });

    const responses: Record<string, unknown> = {
      "/user": admin,
      "/orgs/test-org": { id: 7, login: "test-org", type: "Organization" },
      "/orgs/test-org/memberships/offboard-admin": {
        role: "admin",
        state: "active",
      },
      "/users/departed-test-user": target,
      "/orgs/test-org/members?role=all": [admin, target],
      "/orgs/test-org/members?role=admin": [admin],
      "/orgs/test-org/outside_collaborators": [],
      ...overrides,
    };
    if (!(route in responses)) throw new Error("Unexpected test route");
    return Response.json(responses[route]);
  });

  return new GitHubReadOnlyClient("test-only-token", "test-org", request);
}

describe("GitHub access investigation", () => {
  it("detects a member using the stable provider ID and records scope limitations", async () => {
    const result = await scanGitHubAccess(createClient(), target.login);

    expect(result.findings).toMatchObject([
      {
        providerUserId: "42",
        grantType: "organization_membership",
        status: "access_detected",
      },
    ]);
    expect(result.target.identityConfirmedForRemoval).toBe(false);
    expect(result.coverage).toHaveLength(3);
    expect(result.limitations).not.toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("test-only-token");
  });

  it("distinguishes outside-collaborator access from organization membership", async () => {
    const client = createClient({
      "/orgs/test-org/members?role=all": [admin],
      "/orgs/test-org/outside_collaborators": [target],
    });
    const result = await scanGitHubAccess(client, target.login);

    expect(result.findings).toMatchObject([
      { grantType: "outside_collaborator" },
    ]);
  });

  it("does not match a reused username with a different provider ID", async () => {
    const client = createClient({
      "/users/departed-test-user": { ...target, id: 400 },
    });
    const result = await scanGitHubAccess(client, target.login);

    expect(result.findings).toEqual([]);
    expect(result.targetAccess).toBe("not_detected_in_checked_sources");
  });

  it("marks owners, the integration identity, and configured protected accounts", async () => {
    const client = createClient({
      "/users/departed-test-user": admin,
    });
    const result = await scanGitHubAccess(client, target.login, ["99"]);

    expect(result.findings[0]?.protectionReasons).toEqual([
      "organization_owner",
      "integration_identity",
      "configured_protected_identity",
    ]);
  });

  it("does not return a successful scan if one access source fails", async () => {
    await expect(
      scanGitHubAccess(
        createClient({}, "/orgs/test-org/outside_collaborators"),
        target.login,
      ),
    ).rejects.toMatchObject({ code: "insufficient_permissions" });
  });

  it("rejects restricted non-admin enumeration rather than claiming complete coverage", async () => {
    const client = createClient({
      "/orgs/test-org/memberships/offboard-admin": {
        role: "member",
        state: "active",
      },
    });
    await expect(scanGitHubAccess(client, target.login)).rejects.toMatchObject({
      code: "insufficient_permissions",
    });
  });

  it("rejects inconsistent membership and outside-collaborator data", async () => {
    const client = createClient({
      "/orgs/test-org/outside_collaborators": [target],
    });
    await expect(scanGitHubAccess(client, target.login)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
