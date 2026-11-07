import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { jobSchema } from "../../src/core/workflow";
import { executeJob } from "./jobs";
import { readWorkerConfiguration, WorkerConfigurationError } from "./config";
import { removeGitHubGrant } from "./providers/github/removal";
import { scanGitHubAccess } from "./providers/github/scan";

export async function pollJobs(useGitHubCli: boolean) {
  const configuration = readWorkerConfiguration(process.env, useGitHubCli);
  const token = process.env.OFFBOARD_WORKER_TOKEN;
  const baseUrl = new URL(
    process.env.OFFBOARD_APP_URL || "http://127.0.0.1:3000",
  );
  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.pathname !== "/" ||
    (baseUrl.protocol !== "https:" &&
      !(
        baseUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(baseUrl.hostname)
      ))
  )
    throw new WorkerConfigurationError([
      "OFFBOARD_APP_URL (HTTPS, or loopback HTTP)",
    ]);
  if (!token || token.length < 32)
    throw new WorkerConfigurationError(["OFFBOARD_WORKER_TOKEN"]);
  const abort = new AbortController();
  process.once("SIGINT", () => abort.abort());
  process.once("SIGTERM", () => abort.abort());
  const workerId = randomUUID();
  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok)
      throw new Error(
        "Application refused the worker request. Check configuration and job state.",
      );
    return response.json();
  }
  console.info(
    "Worker polling started. Provider operations use only the locally configured organization.",
  );
  while (!abort.signal.aborted) {
    try {
      const response = z
        .object({ job: jobSchema.nullable() })
        .parse(await post("/api/worker/claim", { workerId }));
      if (response.job) {
        const job = response.job;
        console.info(`Processing ${job.kind} job ${job.id}.`);
        const result = await executeJob(job, configuration, {
          scan: scanGitHubAccess,
          remove: removeGitHubGrant,
          async beginRemoval(currentJob, preflight) {
            const acknowledgement = await post(
              `/api/worker/jobs/${currentJob.id}`,
              {
                action: "begin_removal",
                leaseToken: currentJob.lease_token,
                preflight,
              },
            );
            return z.object({ accepted: z.boolean() }).parse(acknowledgement)
              .accepted;
          },
        });
        // Retrying only the idempotent persistence call is safe; executeJob is never repeated.
        let saved = false;
        for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
          try {
            await post(`/api/worker/jobs/${job.id}`, {
              action: "complete",
              leaseToken: job.lease_token,
              result,
            });
            saved = true;
          } catch {
            if (attempt === 2)
              throw new Error(
                "Result persistence failed. Inspect the job; mutations are never automatically repeated.",
              );
            await delay(1000);
          }
        }
        console.info(
          `Saved result for ${job.id}: ${result.type === "failure" ? result.code : result.type}.`,
        );
      }
    } catch {
      console.error(
        "Polling or result persistence failed. Check app connectivity, token, migration, and job status. No successful outcome is assumed.",
      );
    }
    await delay(5000, undefined, { signal: abort.signal }).catch(() => {});
  }
  console.info(
    "Worker stopped. Availability will expire after the heartbeat window.",
  );
}
