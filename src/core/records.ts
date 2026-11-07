import { z } from "zod";
import { switchContextSchema } from "./switch-investigation";
const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const evidence = z.record(z.string(), z.unknown());
export const caseRecord = z.object({
  id,
  full_name: z.string(),
  departure_on: z.string(),
  status: z.string(),
  created_by: id,
  created_at: timestamp,
  updated_at: timestamp,
});
export const integrationRecord = z.object({
  id,
  provider: z.literal("github"),
  organization: z.string(),
  organization_id: z.string().nullable(),
  status: z.string(),
  permissions: evidence,
  last_checked_at: timestamp.nullable(),
  last_successful_check_at: timestamp.nullable(),
  last_error: z.string().nullable(),
});
export const findingRecord = z.object({
  id,
  case_id: id,
  integration_id: id,
  identity_id: id,
  provider_user_id: z.string(),
  username: z.string(),
  grant_type: z.string(),
  resource_identifier: z.string(),
  protection_reasons: z.array(z.string()),
  status: z.string(),
  evidence,
  first_seen_at: timestamp,
  last_seen_at: timestamp,
  verified_at: timestamp.nullable(),
});
export const approvalRecord = z.object({
  id,
  finding_id: id,
  approved_by: id,
  status: z.string(),
  target_snapshot: evidence,
  created_at: timestamp,
  expires_at: timestamp,
  consumed_at: timestamp.nullable(),
  authorization_method: z.enum(["dashboard", "email"]),
  email_request_id: id.nullable(),
});
export const approvalEmailRecord = z.object({
  id,
  finding_id: id,
  recipient_id: id,
  recipient_email: z.email(),
  status: z.enum(["pending", "decided", "revoked"]),
  delivery_status: z.enum(["prepared", "accepted", "failed", "unknown"]),
  provider_message_id: z.string().nullable(),
  approval_id: id.nullable(),
  created_at: timestamp,
  expires_at: timestamp,
  decided_at: timestamp.nullable(),
  request_origin: z.enum(["dashboard", "automatic"]),
});
export const emailDispatchRecord = z.object({
  id,
  finding_id: id,
  scan_job_id: id,
  recipient_id: id,
  status: z.enum([
    "queued",
    "processing",
    "accepted",
    "skipped",
    "failed",
    "unknown",
  ]),
  created_at: timestamp,
});
export const reportRecord = z.object({
  id,
  case_id: id,
  job_id: id,
  kind: z.string(),
  outcome: z.string(),
  coverage_status: z.string(),
  evidence,
  created_at: timestamp,
});
export const eventRecord = z.object({
  id,
  case_id: id.nullable(),
  event_type: z.string(),
  actor_type: z.string(),
  actor_id: z.string(),
  data: evidence,
  created_at: timestamp,
});
export const heartbeatRecord = z.object({
  worker_id: id,
  last_seen_at: timestamp,
});
export const jobRecord = z.object({
  id,
  request_origin: z.enum([
    "dashboard",
    "switch",
    "email_review",
    "verification",
  ]),
  room_context: switchContextSchema.nullable(),
  approval_id: id.nullable(),
  kind: z.string(),
  case_id: id.nullable(),
  integration_id: id,
  status: z.string(),
  error_code: z.string().nullable(),
  created_at: timestamp,
  completed_at: timestamp.nullable(),
  execution_started: z.boolean(),
});
export const identityRecord = z.object({
  id,
  case_id: id,
  provider: z.string(),
  username: z.string(),
  provider_user_id: z.string().nullable(),
  confirmed_by: id.nullable(),
  confirmed_at: timestamp.nullable(),
});
export const operationRecord = z.object({
  id,
  approval_id: id,
  finding_id: id,
  job_id: id,
  action: z.string(),
  status: z.string(),
  preflight: evidence,
  provider_response: evidence.nullable(),
  verification: evidence.nullable(),
  attempted_at: timestamp,
  verified_at: timestamp.nullable(),
});
