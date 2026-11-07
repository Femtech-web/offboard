import { after } from "next/server";
import { dispatchNextApprovalEmail } from "@/server/approval-email";
import { z } from "zod";
import { privateJson, workerAuthorized, workerRpc } from "@/server/worker-api";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!workerAuthorized(request))
    return privateJson({ error: "unauthorized" }, 401);
  try {
    const { workerId } = z
      .object({ workerId: z.uuid() })
      .parse(await request.json());
    const job = await workerRpc("offboard_claim_job", {
      p_worker_id: workerId,
    });
    after(async () => {
      try {
        await dispatchNextApprovalEmail();
      } catch {
        console.error(
          "Automatic approval email could not be confirmed; inspect persisted email status.",
        );
      }
    });
    return privateJson({ job });
  } catch {
    return privateJson({ error: "claim_failed" }, 400);
  }
}
