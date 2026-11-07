import { z } from "zod";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2026-03-10";
const MAX_PAGES = 1_000;

const userSchema = z.object({
  id: z.number().int().positive().safe(),
  login: z.string().min(1),
  type: z.string(),
  site_admin: z.boolean().default(false),
});

const organizationSchema = z.object({
  id: z.number().int().positive().safe(),
  login: z.string().min(1),
  type: z.literal("Organization"),
});

const membershipSchema = z.object({
  state: z.enum(["active", "pending"]),
  role: z.enum(["admin", "member"]),
});

export type GitHubUser = z.infer<typeof userSchema>;
export type GitHubOrganization = z.infer<typeof organizationSchema>;

type ProviderErrorCode =
  | "authentication_failed"
  | "insufficient_permissions"
  | "rate_limited"
  | "unavailable"
  | "invalid_response"
  | "incomplete_pagination"
  | "network_error";

export class GitHubProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    public readonly status?: number,
  ) {
    super(
      `GitHub check unresolved: ${code}${status ? ` (HTTP ${status})` : ""}.`,
    );
    this.name = "GitHubProviderError";
  }
}

export class GitHubReadOnlyClient {
  constructor(
    private readonly accessToken: string,
    readonly organization: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async inspectConnection() {
    const authenticatedUser = await this.get("/user", userSchema);
    const organizationPath = `/orgs/${encodeURIComponent(this.organization)}`;
    const [organization, membership] = await Promise.all([
      this.get(organizationPath, organizationSchema),
      this.get(
        `${organizationPath}/memberships/${encodeURIComponent(authenticatedUser.login)}`,
        membershipSchema,
      ),
    ]);

    // Public-only enumeration cannot establish full organization coverage.
    if (membership.state !== "active" || membership.role !== "admin") {
      throw new GitHubProviderError("insufficient_permissions");
    }

    return { authenticatedUser, organization, membership };
  }

  getUser(username: string) {
    return this.get(`/users/${encodeURIComponent(username)}`, userSchema);
  }

  listMembers(role: "all" | "admin" = "all") {
    return this.getUsers(
      `/orgs/${encodeURIComponent(this.organization)}/members?role=${role}&per_page=100`,
    );
  }

  listOutsideCollaborators() {
    return this.getUsers(
      `/orgs/${encodeURIComponent(this.organization)}/outside_collaborators?filter=all&per_page=100`,
    );
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const { data } = await this.getResponse(path, schema);
    return data;
  }

  private async getResponse<T>(path: string, schema: z.ZodType<T>) {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN)
      throw new GitHubProviderError("invalid_response");

    let response: Response;
    try {
      response = await this.request(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.accessToken}`,
          "X-GitHub-Api-Version": API_VERSION,
          "User-Agent": "offboard-worker",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GitHubProviderError("network_error");
    }

    if (!response.ok) {
      const rateLimited =
        response.status === 429 ||
        response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after");
      const code = rateLimited
        ? "rate_limited"
        : response.status === 401
          ? "authentication_failed"
          : response.status === 403
            ? "insufficient_permissions"
            : "unavailable";
      throw new GitHubProviderError(code, response.status);
    }

    try {
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) throw new GitHubProviderError("invalid_response");
      return { data: parsed.data, headers: response.headers };
    } catch {
      throw new GitHubProviderError("invalid_response");
    }
  }

  private async getUsers(path: string): Promise<GitHubUser[]> {
    const users = new Map<number, GitHubUser>();
    const initialUrl = new URL(path, API_ORIGIN);
    let currentPath = path;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, headers } = await this.getResponse(
        currentPath,
        z.array(userSchema),
      );
      for (const user of data) users.set(user.id, user);

      const link = headers.get("link");
      const nextLink = link?.match(/<([^>]+)>;\s*rel="next"/);
      if (!nextLink?.[1]) return [...users.values()];

      let nextUrl: URL;
      try {
        nextUrl = new URL(nextLink[1]);
      } catch {
        throw new GitHubProviderError("incomplete_pagination");
      }

      const expectedUrl = new URL(initialUrl);
      expectedUrl.searchParams.set("page", String(page + 1));
      nextUrl.searchParams.sort();
      expectedUrl.searchParams.sort();

      // A provider Link header must never redirect credentials to another host or scope.
      if (nextUrl.href !== expectedUrl.href)
        throw new GitHubProviderError("incomplete_pagination");
      currentPath = `${expectedUrl.pathname}${expectedUrl.search}`;
    }

    throw new GitHubProviderError("incomplete_pagination");
  }
}
