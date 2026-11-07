import { z } from "zod";
import {
  approvalRecord,
  operationRecord,
  reportRecord,
  jobRecord,
  findingRecord,
} from "@/core/records";

type Approval = z.infer<typeof approvalRecord>;
type Operation = z.infer<typeof operationRecord>;

export function reportAuthorization(
  report: Pick<
    z.infer<typeof reportRecord>,
    "case_id" | "job_id" | "kind" | "evidence"
  >,
  records: {
    jobs: Pick<z.infer<typeof jobRecord>, "id" | "case_id" | "approval_id">[];
    findings: Pick<z.infer<typeof findingRecord>, "id" | "case_id">[];
    operations: Operation[];
    approvals: Approval[];
  },
) {
  if (report.kind !== "removal") return {};
  const job = records.jobs.find(
    (record) =>
      record.id === report.job_id && record.case_id === report.case_id,
  );
  if (!job) return {};
  const followup = z.uuid().safeParse(report.evidence.followupForJobId);
  // A follow-up scan links to the original removal job in its saved evidence.
  const executionJob = followup.success
    ? records.jobs.find(
        (record) =>
          record.id === followup.data && record.case_id === report.case_id,
      )
    : job;
  const operation = records.operations.find(
    (record) => record.job_id === executionJob?.id,
  );
  const savedApproval = z.uuid().safeParse(report.evidence.approvalId);
  const approvalId =
    operation?.approval_id ??
    job.approval_id ??
    (savedApproval.success ? savedApproval.data : undefined);
  if (savedApproval.success && savedApproval.data !== approvalId) return {};
  const approval = records.approvals.find(
    (record) =>
      record.id === approvalId &&
      records.findings.some(
        (finding) =>
          finding.id === record.finding_id &&
          finding.case_id === report.case_id,
      ),
  );
  return approval ? { approval, operation } : {};
}
