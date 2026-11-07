import { z } from "zod";
import { jobResultSchema } from "@/core/job-results";
import { scanSchema } from "@/core/workflow";
import { privateJson, workerAuthorized, workerRpc } from "@/server/worker-api";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("begin_removal"),
    leaseToken: z.uuid(),
    preflight: scanSchema,
  }),
  z.object({
    action: z.literal("complete"),
    leaseToken: z.uuid(),
    result: jobResultSchema,
  }),
]);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!workerAuthorized(request))
    return privateJson({ error: "unauthorized" }, 401);
  try {
    if (Number(request.headers.get("content-length")) > 1_000_000)
      return privateJson({ error: "request_too_large" }, 413);
    const { jobId } = await params;
    z.uuid().parse(jobId);
    const body = requestSchema.parse(await request.json());
    const data =
      body.action === "begin_removal"
        ? await workerRpc("offboard_begin_removal", {
            p_job_id: jobId,
            p_lease_token: body.leaseToken,
            p_preflight: body.preflight,
          })
        : await workerRpc("offboard_finish_job", {
            p_job_id: jobId,
            p_lease_token: body.leaseToken,
            p_result: body.result,
          });
    return privateJson({
      accepted: body.action === "complete" || data === true,
    });
  } catch {
    return privateJson({ error: "operation_denied" }, 409);
  }
}
