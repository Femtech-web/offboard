import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdministrator } from "./auth";
import { createServiceClient } from "./supabase/service";
import { renderApprovalEmail } from "@/features/approvals/email-template";
import { snapshotSchema } from "@/core/workflow";
import {
  approvalEmailMessage,
  approvalApplicationOrigin,
  approvalSenderSchema,
  approvalReviewUrl,
  emailReviewInput,
  emailReviewSchema,
} from "@/features/approvals/email-contract";

const preparedEmail = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  personName: z.string(),
  recipientEmail: z.email(),
  expiresAt: z.iso.datetime({ offset: true }),
  target: snapshotSchema,
});
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export class EmailDeliveryRejected extends Error {
  constructor() {
    super("email_not_accepted");
  }
}

export async function submitApprovalEmail(
  apiKey: string,
  requestId: string,
  message: ReturnType<typeof approvalEmailMessage> & { html?: string },
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `offboard-approval/${requestId}`,
    },
    body: JSON.stringify(message),
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new EmailDeliveryRejected();
  return z
    .object({ id: z.string().min(1).max(200) })
    .parse(await response.json()).id;
}

function emailConfiguration() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.APPROVAL_EMAIL_FROM;
  const origin = process.env.OFFBOARD_APP_URL;
  if (!key || !from || !origin) throw new Error("email_not_configured");
  approvalSenderSchema.parse(from);
  approvalApplicationOrigin(origin);
  return { key, from, origin };
}

class ApprovalEmailDeliveryError extends Error {
  constructor(readonly deliveryStatus: "failed" | "unknown") {
    super("email_confirmation_unavailable");
  }
}

async function deliverPreparedApprovalEmail(
  request: z.infer<typeof preparedEmail>,
  token: string,
  configuration: ReturnType<typeof emailConfiguration>,
) {
  const service = createServiceClient();
  try {
    const providerId = await submitApprovalEmail(
      configuration.key,
      request.id,
      {
        ...approvalEmailMessage(
          configuration.from,
          approvalReviewUrl(configuration.origin, request.id, token),
          request,
        ),
        html: await renderApprovalEmail(
          request,
          approvalReviewUrl(configuration.origin, request.id, token),
        ),
      },
    );
    const { error } = await service.rpc(
      "offboard_record_approval_email_delivery",
      {
        p_request_id: request.id,
        p_status: "accepted",
        p_provider_message_id: providerId,
      },
    );
    if (error) throw new Error("email_confirmation_not_saved");
  } catch (error) {
    const status =
      error instanceof EmailDeliveryRejected ? "failed" : "unknown";
    // A timeout may mean the provider accepted it. Unconfirmed links remain unusable.
    await service.rpc("offboard_record_approval_email_delivery", {
      p_request_id: request.id,
      p_status: status,
      p_provider_message_id: null,
    });
    throw new ApprovalEmailDeliveryError(status);
  }
}

export async function sendApprovalEmail(findingId: string) {
  const { client } = await requireAdministrator();
  const configuration = emailConfiguration();
  const token = randomBytes(32).toString("hex");
  const { data, error } = await client.rpc("offboard_request_approval_email", {
    p_finding_id: z.uuid().parse(findingId),
    p_token_hash: tokenHash(token),
  });
  if (error) throw new Error("email_request_denied");
  await deliverPreparedApprovalEmail(
    preparedEmail.parse(data),
    token,
    configuration,
  );
}

// Called only by authenticated worker polling. The queue fixes the recipient and target;
// neither the worker nor agent can supply an email address or authorize a removal.
export async function dispatchNextApprovalEmail() {
  if (!process.env.RESEND_API_KEY || !process.env.APPROVAL_EMAIL_FROM) return;
  const configuration = emailConfiguration();
  const service = createServiceClient();
  const { data, error } = await service.rpc("offboard_claim_email_dispatch");
  if (error) throw new Error("email_queue_unavailable");
  if (!data) return;
  const dispatch = z.object({ id: z.uuid() }).parse(data);
  const token = randomBytes(32).toString("hex");
  const { data: prepared, error: prepareError } = await service.rpc(
    "offboard_prepare_automatic_email",
    {
      p_dispatch_id: dispatch.id,
      p_token_hash: tokenHash(token),
    },
  );
  let status: "accepted" | "skipped" | "failed" | "unknown" = "skipped";
  if (!prepareError) {
    try {
      await deliverPreparedApprovalEmail(
        preparedEmail.parse(prepared),
        token,
        configuration,
      );
      status = "accepted";
    } catch (error) {
      status =
        error instanceof ApprovalEmailDeliveryError
          ? error.deliveryStatus
          : "unknown";
    }
  }
  const { error: finishError } = await service.rpc(
    "offboard_finish_email_dispatch",
    {
      p_dispatch_id: dispatch.id,
      p_status: status,
    },
  );
  if (finishError) throw new Error("email_dispatch_confirmation_unavailable");
}

export async function performEmailDecision(
  input: z.infer<typeof emailReviewInput>,
) {
  const service = createServiceClient();
  const parameters = {
    p_request_id: input.requestId,
    p_token_hash: tokenHash(input.token),
  };
  if (input.action === "preview") {
    const { data, error } = await service.rpc(
      "offboard_review_email_request",
      parameters,
    );
    if (error) throw new Error("email_review_unavailable");
    return { review: emailReviewSchema.parse(data) };
  }
  if (input.action === "approved" && input.acknowledged !== true)
    throw new Error("acknowledgement_required");
  const { data, error } = await service.rpc("offboard_decide_email_request", {
    ...parameters,
    p_decision: input.action,
    p_identity_acknowledged: input.identityAcknowledged === true,
  });
  if (error) throw new Error("email_decision_denied");
  return { approvalId: z.uuid().parse(data), decision: input.action };
}
