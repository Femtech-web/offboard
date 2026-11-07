import { z } from "zod";
import { snapshotSchema } from "@/core/workflow";

export const emailReviewInput = z.strictObject({
  requestId: z.uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["preview", "approved", "rejected"]),
  acknowledged: z.boolean().optional(),
  identityAcknowledged: z.boolean().optional(),
});
export const emailReviewSchema = z.object({
  id: z.uuid(),
  personName: z.string(),
  recipientEmail: z.email(),
  expiresAt: z.iso.datetime({ offset: true }),
  target: snapshotSchema,
  actionable: z.boolean(),
  identityConfirmed: z.boolean(),
});
export type EmailReview = z.infer<typeof emailReviewSchema>;
export const approvalSenderSchema = z
  .string()
  .refine(
    (value) =>
      !/[\r\n]/.test(value) && /^.{1,80}\s*<[^<>\s]+@[^<>\s]+>$/.test(value),
    "invalid_sender",
  );

export function approvalApplicationOrigin(origin: string) {
  const base = new URL(origin);
  if (
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(base.hostname)
      ))
  )
    throw new Error("invalid_application_origin");
  return base;
}

export function approvalReviewUrl(
  origin: string,
  requestId: string,
  token: string,
) {
  z.uuid().parse(requestId);
  emailReviewInput.shape.token.parse(token);
  const base = approvalApplicationOrigin(origin);
  const link = new URL(`/email-approvals/${requestId}`, base);
  // Fragments never reach HTTP access logs or referrer headers.
  link.hash = `token=${token}`;
  return link.href;
}

export type ApprovalEmailDetails = Pick<
  EmailReview,
  "id" | "personName" | "recipientEmail" | "expiresAt" | "target"
>;

export function approvalAccessLabel(grant: EmailReview["target"]["grantType"]) {
  return grant === "organization_membership"
    ? "Organization membership"
    : "Outside collaborator access";
}

export function approvalExpiryLabel(value: string) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}

export function approvalEmailMessage(
  from: string,
  reviewUrl: string,
  review: ApprovalEmailDetails,
) {
  approvalSenderSchema.parse(from);
  const { target } = review;
  return {
    from,
    to: [review.recipientEmail],
    subject: `Review GitHub access for ${review.personName} · Offboard`,
    text: `OFFBOARD

Your review is needed

Please review the GitHub access proposed for removal. Nothing changes until you approve.

Person: ${review.personName}
GitHub account: @${target.username}
Organization: ${target.organization}
Proposed change: Remove ${approvalAccessLabel(target.grantType).toLowerCase()}

Review access removal:
${reviewUrl}

No sign-in needed. This link expires ${approvalExpiryLabel(review.expiresAt)}.

Sent to ${review.recipientEmail}. This private link allows one decision. Please don’t forward it.

Offboard · Access reviewed. Decisions documented.`,
  };
}
