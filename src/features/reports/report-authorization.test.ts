import { expect, it } from "vitest";
import { approvalRecord, operationRecord } from "@/core/records";
import { reportAuthorization } from "./report-authorization";

const caseId = "00000000-0000-4000-8000-000000000001";
const removalJobId = "00000000-0000-4000-8000-000000000002";
const verificationJobId = "00000000-0000-4000-8000-000000000003";
const approvalId = "00000000-0000-4000-8000-000000000004";
const findingId = "00000000-0000-4000-8000-000000000005";
const approval = approvalRecord.parse({
  id: approvalId,
  finding_id: findingId,
  approved_by: caseId,
  status: "consumed",
  target_snapshot: {},
  created_at: "2026-11-07T14:23:44Z",
  expires_at: "2026-11-07T14:38:44Z",
  consumed_at: "2026-11-07T14:23:48Z",
  authorization_method: "email",
  email_request_id: null,
});
const operation = operationRecord.parse({
  id: removalJobId,
  approval_id: approvalId,
  finding_id: findingId,
  job_id: removalJobId,
  action: "organization_membership",
  status: "verified_removed",
  preflight: {},
  provider_response: { status: 204 },
  verification: {},
  attempted_at: "2026-11-07T14:23:48Z",
  verified_at: "2026-11-07T14:23:58Z",
});
const records = {
  jobs: [
    { id: removalJobId, case_id: caseId, approval_id: approvalId },
    { id: verificationJobId, case_id: caseId, approval_id: null },
  ],
  findings: [{ id: findingId, case_id: caseId }],
  approvals: [approval],
  operations: [operation],
};
const followup = {
  case_id: caseId,
  job_id: verificationJobId,
  kind: "removal",
  evidence: { followupForJobId: removalJobId, approvalId },
};

it("shows the original human approval and provider operation on the independent follow-up report", () => {
  expect(reportAuthorization(followup, records)).toEqual({
    approval,
    operation,
  });
});
it("retains direct removal authorization and does not invent one for an investigation", () => {
  expect(
    reportAuthorization(
      { ...followup, job_id: removalJobId, evidence: {} },
      records,
    ),
  ).toEqual({ approval, operation });
  expect(
    reportAuthorization({ ...followup, kind: "investigation" }, records),
  ).toEqual({});
});
it("refuses to attach another case's approval or operation", () => {
  const otherCase = "00000000-0000-4000-8000-000000000006";
  expect(
    reportAuthorization(followup, {
      ...records,
      findings: [{ id: findingId, case_id: otherCase }],
    }),
  ).toEqual({});
  expect(
    reportAuthorization(followup, {
      ...records,
      jobs: records.jobs.map((job) => ({ ...job, case_id: otherCase })),
    }),
  ).toEqual({});
});
it("fails closed on contradictory approval evidence", () => {
  expect(
    reportAuthorization(
      { ...followup, evidence: { ...followup.evidence, approvalId: caseId } },
      records,
    ),
  ).toEqual({});
});
