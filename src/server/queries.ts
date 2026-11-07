import "server-only";
import { z } from "zod";
import { requireWorkspaceMember } from "./auth";
import {
  caseRecord,
  integrationRecord,
  findingRecord,
  approvalRecord,
  reportRecord,
  eventRecord,
  heartbeatRecord,
  jobRecord,
  identityRecord,
  operationRecord,
  approvalEmailRecord,
  emailDispatchRecord,
} from "@/core/records";

export async function workspaceRecords() {
  const { client, profile } = await requireWorkspaceMember();
  if (profile.role === "viewer") {
    const { data, error } = await client.rpc("offboard_review_workspace");
    if (error) throw new Error("The demo records could not be loaded.");
    const records = z
      .object({
        cases: z.array(caseRecord),
        integrations: z.array(integrationRecord),
        findings: z.array(findingRecord),
        approvals: z.array(approvalRecord),
        reports: z.array(reportRecord),
        events: z.array(eventRecord),
        jobs: z.array(jobRecord),
        identities: z.array(identityRecord),
        operations: z.array(operationRecord),
      })
      .parse(data);
    return {
      ...records,
      profile,
      observedAt: Date.now(),
      heartbeat: undefined,
      approvalEmails: [],
      emailDispatches: [],
    };
  }
  // Read every page rather than silently treating PostgREST's default row limit as a total.
  async function read<T>(table: string, schema: z.ZodType<T>) {
    const records: T[] = [];
    for (let offset = 0; offset < 100_000; offset += 1000) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order(table === "worker_heartbeats" ? "worker_id" : "id")
        .range(offset, offset + 999);
      if (error || !data)
        throw new Error(
          "Database records could not be loaded. Check the migration and connection.",
        );
      records.push(...z.array(schema).parse(data));
      if (data.length < 1000) return records;
    }
    throw new Error(
      "This workspace needs paginated reporting before more records can be loaded safely.",
    );
  }
  const [
    cases,
    integrations,
    findings,
    approvals,
    reports,
    events,
    heartbeats,
    jobs,
    identities,
    operations,
    approvalEmails,
    emailDispatches,
  ] = await Promise.all([
    read("offboarding_cases", caseRecord),
    read("integrations", integrationRecord),
    read("access_findings", findingRecord),
    read("removal_approvals", approvalRecord),
    read("verification_reports", reportRecord),
    read("audit_events", eventRecord),
    read("worker_heartbeats", heartbeatRecord),
    read("worker_jobs", jobRecord),
    read("provider_identities", identityRecord),
    read("removal_operations", operationRecord),
    read("approval_email_requests", approvalEmailRecord),
    read("approval_email_dispatches", emailDispatchRecord),
  ]);
  cases.sort((a, b) => b.created_at.localeCompare(a.created_at));
  reports.sort((a, b) => b.created_at.localeCompare(a.created_at));
  events.sort((a, b) => b.created_at.localeCompare(a.created_at));
  jobs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  heartbeats.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
  return {
    profile,
    observedAt: Date.now(),
    cases,
    integrations,
    findings,
    approvals,
    reports,
    events,
    heartbeat: heartbeats[0],
    jobs,
    identities,
    operations,
    approvalEmails,
    emailDispatches,
  };
}
