/** Opt-in live read-only check. Persists genuine connectivity evidence; never runs DELETE. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { readWorkerConfiguration } from "../../worker/src/config";
import { executeJob } from "../../worker/src/jobs";
import { scanGitHubAccess } from "../../worker/src/providers/github/scan";
import { jobSchema } from "../../src/core/workflow";

const required = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    OFFBOARD_ADMIN_EMAIL: z.email(),
    OFFBOARD_WORKER_TOKEN: z.string().min(32),
    OFFBOARD_APP_URL: z.url(),
  })
  .safeParse(process.env);
if (!required.success) {
  console.error(
    "Configure the Supabase, administrator, worker token, and app URL values first.",
  );
  process.exit(1);
}
const environment = required.data;
const baseUrl = new URL(environment.OFFBOARD_APP_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  console.error("This test is restricted to a local app URL.");
  process.exit(1);
}
const configuration = readWorkerConfiguration(
  process.env,
  process.argv.includes("--github-cli-auth"),
);
const service = createClient(
  environment.NEXT_PUBLIC_SUPABASE_URL,
  environment.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const cookieJar = new Map<string, string>();
const session = createServerClient(
  environment.NEXT_PUBLIC_SUPABASE_URL,
  environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
    },
  },
);
async function appRequest(path: string, body: unknown, authorized = true) {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorized
        ? { Authorization: `Bearer ${environment.OFFBOARD_WORKER_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
}
async function rpc(name: string, parameters: Record<string, unknown>) {
  const { data, error } = await session.rpc(name, parameters);
  if (error) throw new Error("application_rpc_failed");
  return data;
}
try {
  const { data: users, error: usersError } = await service.auth.admin.listUsers(
    { page: 1, perPage: 1000 },
  );
  if (usersError) throw new Error("auth_unavailable");
  const administrator = users.users.find(
    (user) =>
      user.email?.toLowerCase() ===
      environment.OFFBOARD_ADMIN_EMAIL.toLowerCase(),
  );
  if (!administrator?.email_confirmed_at)
    throw new Error("confirmed_administrator_required");
  // Generate and consume a local test session without sending email or changing a password.
  const { data: link, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: environment.OFFBOARD_ADMIN_EMAIL,
    });
  if (linkError) throw new Error("auth_link_failed");
  const { data: signedIn, error: signInError } = await session.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (signInError || signedIn.user?.id !== administrator.id)
    throw new Error("auth_verification_failed");
  const { error: profileError } = await service.from("profiles").upsert({
    id: administrator.id,
    email: environment.OFFBOARD_ADMIN_EMAIL.toLowerCase(),
    role: "admin",
  });
  if (profileError) throw new Error("administrator_bootstrap_failed");
  console.info(
    "Confirmed administrator authenticated through Supabase; session remains in memory.",
  );
  const denied = await appRequest(
    "/api/worker/claim",
    { workerId: randomUUID() },
    false,
  );
  assert.equal(denied.status, 401);
  const deniedRemoval = await appRequest(
    `/api/worker/jobs/${randomUUID()}`,
    { action: "begin_removal", leaseToken: randomUUID() },
    false,
  );
  assert.equal(deniedRemoval.status, 401);
  const { data: activeMutations, error: activeJobError } = await session
    .from("worker_jobs")
    .select("id")
    .eq("kind", "execute_removal")
    .in("status", ["queued", "leased"])
    .limit(1);
  if (activeJobError || activeMutations?.length)
    throw new Error("read_only_test_refuses_mutation_job");
  const integrationId = z.uuid().parse(
    await rpc("offboard_connect_github", {
      p_organization: configuration.organization,
    }),
  );
  const { data: existingCases, error: caseReadError } = await session
    .from("offboarding_cases")
    .select("id")
    .eq("full_name", "Read-only connectivity check (protected account)")
    .eq("created_by", administrator.id)
    .limit(1);
  if (caseReadError) throw new Error("case_read_failed");
  const username = configuration.testUsername;
  if (!username) throw new Error("GITHUB_TEST_USERNAME_required");
  const caseId =
    existingCases?.[0]?.id ??
    z.uuid().parse(
      await rpc("offboard_create_case", {
        p_name: "Read-only connectivity check (protected account)",
        p_departure: new Date().toISOString().slice(0, 10),
        p_username: username,
      }),
    );
  const { data: identities } = await session
    .from("provider_identities")
    .select("username")
    .eq("case_id", caseId)
    .single();
  assert.equal(identities?.username.toLowerCase(), username.toLowerCase());
  const requestedJobId = z.uuid().parse(
    await rpc("offboard_request_scan", {
      p_case_id: caseId,
      p_integration_id: integrationId,
    }),
  );
  const workerId = randomUUID();
  for (let count = 0; count < 8; count += 1) {
    const response = await appRequest("/api/worker/claim", { workerId });
    assert.equal(response.status, 200);
    const { job } = z
      .object({ job: jobSchema.nullable() })
      .parse(await response.json());
    if (!job) break;
    // Fail closed even if another person has queued a mutation. No removal adapter is supplied.
    if (job.kind === "execute_removal")
      throw new Error("read_only_test_refuses_mutation_job");
    const result = await executeJob(job, configuration, {
      scan: scanGitHubAccess,
      beginRemoval: async () => {
        throw new Error("forbidden_in_read_only_test");
      },
      remove: async () => {
        throw new Error("forbidden_in_read_only_test");
      },
    });
    const completion = await appRequest(`/api/worker/jobs/${job.id}`, {
      action: "complete",
      leaseToken: job.lease_token,
      result,
    });
    assert.equal(completion.status, 200);
    if (result.type === "failure") throw new Error(result.code);
    console.info(`Real ${job.kind} result persisted for job ${job.id}.`);
    if (job.kind === "scan" && job.case_id === caseId) break;
    await delay(100);
  }
  const { data: reports, error: reportError } = await session
    .from("verification_reports")
    .select("id,outcome,coverage_status")
    .eq("case_id", caseId)
    .eq("job_id", requestedJobId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (reportError || !reports?.[0]) throw new Error("report_missing");
  assert.equal(reports[0].coverage_status, "partially_verified");
  const cookieHeader = [...cookieJar]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  for (const path of [
    "/overview",
    "/people",
    "/integrations",
    "/reports",
    `/people/${caseId}`,
    `/reports/${reports[0].id}`,
  ]) {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { cookie: cookieHeader },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(response.status, 200, `Authenticated route ${path}`);
    const html = await response.text();
    assert.ok(
      !html.includes("Workspace records are unavailable."),
      `Records loaded at ${path}`,
    );
    assert.ok(!html.includes("NEXT_REDIRECT"), `Session authorized at ${path}`);
  }
  console.info(
    `Read-only workflow passed. Saved case ${caseId}; report ${reports[0].id}; outcome ${reports[0].outcome}; coverage remains partial. Six authenticated routes returned HTTP 200. Unauthorized worker requests returned HTTP 401.`,
  );
} catch (error) {
  const safeCodes = [
    "application_rpc_failed",
    "auth_unavailable",
    "confirmed_administrator_required",
    "auth_link_failed",
    "auth_verification_failed",
    "administrator_bootstrap_failed",
    "case_read_failed",
    "GITHUB_TEST_USERNAME_required",
    "read_only_test_refuses_mutation_job",
    "report_missing",
  ];
  const code =
    error instanceof Error && safeCodes.includes(error.message)
      ? error.message
      : error instanceof assert.AssertionError
        ? "assertion_failed"
        : "live_check_failed";
  console.error(
    `Read-only live check failed (${code}). No removal was attempted.`,
  );
  process.exitCode = 1;
} finally {
  await session.auth.signOut({ scope: "local" });
}
