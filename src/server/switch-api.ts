import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  assertSwitchScope,
  type SwitchRequest,
} from "@/core/switch-investigation";
import { createServiceClient } from "./supabase/service";

export function switchBridgeAuthorized(request: Request) {
  const token = process.env.OFFBOARD_SWITCH_TOKEN;
  if (
    !token ||
    token.length < 32 ||
    token === process.env.OFFBOARD_WORKER_TOKEN
  )
    return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function runSwitchOperation(request: SwitchRequest) {
  const scope = z
    .object({
      roomId: z.uuid(),
      agentId: z.uuid(),
      senderId: z.string().min(1),
      caseIds: z.array(z.uuid()).min(1),
      integrationId: z.uuid(),
    })
    .parse({
      roomId: process.env.OFFBOARD_SWITCH_ROOM_ID,
      agentId: process.env.OFFBOARD_SWITCH_AGENT_ID,
      senderId: process.env.OFFBOARD_SWITCH_SENDER_ID,
      caseIds: (process.env.OFFBOARD_SWITCH_CASE_IDS ?? "")
        .split(",")
        .filter(Boolean),
      integrationId: process.env.OFFBOARD_SWITCH_INTEGRATION_ID,
    });
  assertSwitchScope(request, scope);
  const client = createServiceClient();
  const { data: administrator, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("email", process.env.OFFBOARD_ADMIN_EMAIL ?? "")
    .eq("role", "admin")
    .single();
  if (profileError || !administrator)
    throw new Error("administrator_unavailable");
  if (request.action === "request_scan") {
    const { data, error } = await client.rpc("offboard_switch_request_scan", {
      p_case_id: request.caseId,
      p_integration_id: scope.integrationId,
      p_administrator_id: administrator.id,
      p_context: request.context,
    });
    if (error) throw new Error("scan_request_denied");
    return { jobId: z.uuid().parse(data), approvalGranted: false };
  }
  async function read(
    table: string,
    columns: string,
    order: string,
    limit = 50,
  ) {
    let query = client
      .from(table)
      .select(columns)
      .eq(table === "offboarding_cases" ? "id" : "case_id", request.caseId);
    if (table === "worker_jobs" || table === "access_findings")
      query = query.eq("integration_id", scope.integrationId);
    if (table === "worker_jobs" && request.jobId)
      query = query.eq("id", request.jobId);
    if (table === "verification_reports" && request.jobId)
      query = query.eq("job_id", request.jobId);
    const { data, error } = await query
      .order(order, { ascending: false })
      .limit(limit + 1);
    if (error || !data) throw new Error("records_unavailable");
    return { records: data.slice(0, limit), truncated: data.length > limit };
  }
  const [offboardingCase, identity, findings, jobs, reports] =
    await Promise.all([
      read(
        "offboarding_cases",
        "id,full_name,departure_on,status",
        "created_at",
        1,
      ),
      read(
        "provider_identities",
        "provider,username,provider_user_id,confirmed_at",
        "id",
        1,
      ),
      read(
        "access_findings",
        "id,provider_user_id,username,grant_type,resource_identifier,protection_reasons,status,last_seen_at,verified_at",
        "last_seen_at",
      ),
      read(
        "worker_jobs",
        "id,kind,status,error_code,request_origin,room_context,created_at,completed_at",
        "created_at",
        10,
      ),
      read(
        "verification_reports",
        "id,job_id,kind,outcome,coverage_status,evidence,created_at",
        "created_at",
        5,
      ),
    ]);
  if (
    !offboardingCase.records.length ||
    (request.jobId && !jobs.records.length)
  )
    throw new Error("unknown_scope");
  const recordIds = z.array(z.object({ id: z.uuid() }));
  const findingIds = recordIds
    .parse(findings.records)
    .map((record) => record.id);
  const jobIds = recordIds.parse(jobs.records).map((record) => record.id);
  const [approvalResult, operationResult] = await Promise.all([
    findingIds.length
      ? client
          .from("removal_approvals")
          .select(
            "id,finding_id,approved_by,status,target_snapshot,authorization_method,created_at,expires_at,consumed_at",
          )
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false })
          .limit(51)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? client
          .from("removal_operations")
          .select(
            "id,job_id,approval_id,finding_id,action,status,provider_response,verification,attempted_at,verified_at",
          )
          .in("job_id", jobIds)
          .order("attempted_at", { ascending: false })
          .limit(11)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (approvalResult.error || operationResult.error)
    throw new Error("evidence_unavailable");
  return {
    offboardingCase,
    identity,
    findings,
    jobs,
    reports,
    reportLinks: z
      .array(z.object({ id: z.uuid() }))
      .parse(reports.records)
      .map((report) => ({
        reportId: report.id,
        path: `/reports/${report.id}`,
      })),
    approvals: {
      records: approvalResult.data?.slice(0, 50) ?? [],
      truncated: (approvalResult.data?.length ?? 0) > 50,
    },
    operations: {
      records: operationResult.data?.slice(0, 10) ?? [],
      truncated: (operationResult.data?.length ?? 0) > 10,
    },
    reviewPath: `/people/${request.caseId}`,
    coverage:
      "GitHub organization membership and outside collaborators only; all other access remains unchecked. A successful job does not mean complete offboarding.",
    approvalPolicy:
      "Only the authorized administrator may approve an exact proposal through the authenticated dashboard or its private email review. This interface cannot confirm identity, approve, or execute removals.",
  };
}
