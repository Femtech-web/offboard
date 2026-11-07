import { describe, expect, it, vi } from "vitest";
import { removeGitHubGrant } from "./removal";
const target = {
  organization: "test-org",
  organizationId: "7",
  providerUserId: "42",
  username: "controlled-person",
  grantType: "organization_membership" as const,
  resourceIdentifier: "github:organization:7",
};
describe("GitHub removal adapter", () => {
  it("deletes only the exact approved grant at the fixed GitHub origin", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "x-github-request-id": "request-1" },
      }),
    );
    const result = await removeGitHubGrant("test-only-token", target, request);
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.github.com/orgs/test-org/members/controlled-person",
    );
    expect(options).toMatchObject({ method: "DELETE", redirect: "error" });
    expect(result).toMatchObject({
      status: 204,
      outcome: "accepted",
      requestId: "request-1",
    });
    expect(JSON.stringify(result)).not.toContain("test-only-token");
  });
  it("records a timeout as uncertain and never retries", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("sensitive provider payload"));
    expect(
      await removeGitHubGrant("test-only-token", target, request),
    ).toMatchObject({ status: null, outcome: "unknown" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("keeps an unsuccessful provider response distinct from accepted removal", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ sensitive: "details" }, { status: 403 }),
      );
    const result = await removeGitHubGrant(
      "test-only-token",
      { ...target, grantType: "outside_collaborator" },
      request,
    );
    expect(result).toMatchObject({ status: 403, outcome: "rejected" });
    expect(String(request.mock.calls[0]![0])).toContain(
      "/outside_collaborators/",
    );
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });
});
