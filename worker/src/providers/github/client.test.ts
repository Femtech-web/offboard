import { describe, expect, it, vi } from "vitest";

import { GitHubReadOnlyClient } from "./client";

const user = {
  id: 42,
  login: "departed-test-user",
  type: "User",
  site_admin: false,
};

describe("read-only GitHub client", () => {
  it("follows scoped pagination and keeps every request read-only", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([user], {
          headers: {
            link: '<https://api.github.com/orgs/test-org/members?role=all&per_page=100&page=2>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json([{ ...user, id: 43, login: "another-test-user" }]),
      );

    const client = new GitHubReadOnlyClient(
      "test-only-token",
      "test-org",
      request,
    );
    expect(await client.listMembers()).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [url, options] of request.mock.calls) {
      expect(new URL(String(url)).origin).toBe("https://api.github.com");
      expect(options?.method).toBe("GET");
      expect(options?.redirect).toBe("error");
      expect(options?.cache).toBe("no-store");
    }
  });

  it.each([
    "https://untrusted.example/orgs/test-org/members?role=all&per_page=100&page=2",
    "https://api.github.com/orgs/another-org/members?role=all&per_page=100&page=2",
    "https://api.github.com/orgs/test-org/members?role=admin&per_page=100&page=2",
    "https://api.github.com/orgs/test-org/members?role=all&per_page=100&page=1",
  ])(
    "refuses a pagination link that changes the host, scope, filter or page: %s",
    async (nextLink) => {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(
        Response.json([user], {
          headers: { link: `<${nextLink}>; rel="next"` },
        }),
      );
      const client = new GitHubReadOnlyClient(
        "test-only-token",
        "test-org",
        request,
      );

      await expect(client.listMembers()).rejects.toMatchObject({
        code: "incomplete_pagination",
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each([401, 403, 404, 429, 500])(
    "treats HTTP %i as unresolved rather than an empty access list",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({ message: "sensitive-provider-error" }, { status }),
        );
      const client = new GitHubReadOnlyClient(
        "test-only-token",
        "test-org",
        request,
      );

      await expect(client.listOutsideCollaborators()).rejects.toMatchObject({
        status,
      });
    },
  );

  it("rejects malformed provider data", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([{ login: "missing-stable-id" }]));
    const client = new GitHubReadOnlyClient(
      "test-only-token",
      "test-org",
      request,
    );

    await expect(client.listMembers()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("sanitizes transport errors instead of leaking credentials", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("test-only-token"));
    const client = new GitHubReadOnlyClient(
      "test-only-token",
      "test-org",
      request,
    );

    await expect(client.listMembers()).rejects.toMatchObject({
      code: "network_error",
      message: "GitHub check unresolved: network_error.",
    });
  });
});
