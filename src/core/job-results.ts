import { z } from "zod";
import { githubName, providerId, scanSchema } from "./workflow";

export const failureCode = z.enum([
  "authentication_failed",
  "insufficient_permissions",
  "rate_limited",
  "unavailable",
  "invalid_response",
  "incomplete_pagination",
  "network_error",
  "target_mismatch",
  "target_not_authorized_for_removal",
  "protected_identity",
  "permission_no_longer_present",
  "organization_not_allowed",
  "approval_denied",
  "worker_error",
]);
export const providerResponseSchema = z.object({
  status: z.number().int().min(100).max(599).nullable(),
  outcome: z.enum(["accepted", "rejected", "unknown"]),
  requestId: z.string().max(200).nullable(),
  attemptedAt: z.iso.datetime(),
});
export const jobResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("failure"),
    code: failureCode,
    limitations: z.array(z.string().max(300)).max(10),
  }),
  z.object({
    type: z.literal("connection"),
    organization: z.object({ id: providerId, login: githubName }),
    permissions: z.object({
      organizationRole: z.literal("admin"),
      mode: z.literal("user_token"),
      removalPermission: z.literal("not_tested"),
    }),
    checkedAt: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("scan"),
    scan: scanSchema,
    limitations: z.array(z.string().max(300)).max(10),
  }),
  z.object({
    type: z.literal("removal"),
    providerResponse: providerResponseSchema,
    preflight: scanSchema,
    verification: scanSchema.nullable(),
    verificationError: failureCode.nullable(),
    limitations: z.array(z.string().max(300)).max(10),
  }),
]);
export type JobResult = z.infer<typeof jobResultSchema>;
