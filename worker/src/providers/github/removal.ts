import type { RemovalSnapshot } from "../../../../src/core/workflow";
import type { z } from "zod";
import type { providerResponseSchema } from "../../../../src/core/job-results";

// The executor calls this only after fresh preflight and successful single-use consumption.
export async function removeGitHubGrant(
  accessToken: string,
  snapshot: RemovalSnapshot,
  request: typeof fetch = fetch,
): Promise<z.infer<typeof providerResponseSchema>> {
  const path =
    snapshot.grantType === "organization_membership"
      ? "members"
      : "outside_collaborators";
  const url = new URL(
    `https://api.github.com/orgs/${encodeURIComponent(snapshot.organization)}/${path}/${encodeURIComponent(snapshot.username)}`,
  );
  const attemptedAt = new Date().toISOString();
  try {
    const response = await request(url, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "offboard-worker",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const requestId = response.headers.get("x-github-request-id");
    return {
      status: response.status,
      outcome: response.status === 204 ? "accepted" : "rejected",
      requestId: requestId?.slice(0, 200) ?? null,
      attemptedAt,
    };
  } catch {
    // A timeout can happen after the provider changed state. Never retry DELETE.
    return { status: null, outcome: "unknown", requestId: null, attemptedAt };
  }
}
