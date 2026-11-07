import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

if (!process.env.SUPABASE_DB_URL) {
  console.error(
    "SUPABASE_DB_URL is required for transactional database safety tests.",
  );
  process.exit(1);
}
const sql = postgres(process.env.SUPABASE_DB_URL, {
  max: 1,
  ssl: "require",
  connect_timeout: 15,
  onnotice: () => {},
});
const rollback = new Error("test_transaction_rollback");
let checks = 0;
try {
  await sql.begin(async (transaction) => {
    const administratorId = randomUUID();
    const viewerId = randomUUID();
    const workerId = randomUUID();
    await transaction`insert into auth.users(id,email) values(${administratorId},${`offboard-test-${administratorId}@example.invalid`}),(${viewerId},${`offboard-test-${viewerId}@example.invalid`})`;
    await transaction`insert into public.profiles(id,email,role) values(${administratorId},'test-admin@example.invalid','admin'),(${viewerId},'test-viewer@example.invalid','viewer')`;
    async function role(
      name: "authenticated" | "service_role" | "anon" | "postgres",
      userId = administratorId,
    ) {
      await transaction.unsafe(`set local role ${name}`);
      await transaction`select set_config('request.jwt.claims',${JSON.stringify({ sub: userId, role: name })},true)`;
    }
    async function denied(
      label: string,
      action: (savepoint: postgres.TransactionSql) => Promise<unknown>,
    ) {
      let refused = false;
      try {
        await transaction.savepoint(action);
      } catch {
        refused = true;
      }
      assert.ok(refused, label);
      checks += 1;
    }
    await role("anon");
    await denied("anonymous cannot read cases", async (sp) => {
      await sp`select * from public.offboarding_cases`;
    });
    await role("authenticated", viewerId);
    assert.equal(
      (await transaction`select * from public.offboarding_cases`).length,
      0,
    );
    checks += 1;
    await denied("viewer cannot create a case", async (sp) => {
      await sp`select public.offboard_create_case('test',current_date,'test-user')`;
    });
    await denied("viewer cannot claim worker jobs", async (sp) => {
      await sp`select public.offboard_claim_job(${workerId}::uuid)`;
    });
    await denied("viewer cannot promote itself", async (sp) => {
      await sp`update public.profiles set role='admin' where id=${viewerId}`;
    });
    await role("authenticated");
    const [created] =
      await transaction`select public.offboard_create_case('Transactional safety test',current_date,'controlled-test-user') as id`;
    const caseId = created!.id as string;
    const [connected] =
      await transaction`select public.offboard_connect_github('controlled-test-org') as id`;
    const integrationId = connected!.id as string;
    await role("postgres");
    await transaction`update public.worker_jobs set created_at='1970-01-01' where integration_id=${integrationId}`;
    await role("service_role");
    const [claim] =
      await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
    const connectionJob = claim!.job;
    assert.equal(connectionJob.integration_id, integrationId);
    checks += 1;
    await transaction`select public.offboard_finish_job(${connectionJob.id}::uuid,${connectionJob.lease_token}::uuid,${transaction.json({ type: "connection", organization: { id: "700", login: "controlled-test-org" }, permissions: { organizationRole: "admin", mode: "user_token", removalPermission: "not_tested" }, checkedAt: new Date().toISOString() })}::jsonb)`;
    await role("authenticated");
    const [requested] =
      await transaction`select public.offboard_request_scan(${caseId}::uuid,${integrationId}::uuid) as id`;
    await denied("duplicate active scans are refused", async (sp) => {
      await sp`select public.offboard_request_scan(${caseId}::uuid,${integrationId}::uuid)`;
    });
    await role("postgres");
    await transaction`update public.worker_jobs set created_at='1970-01-01' where id=${requested!.id}`;
    await role("service_role");
    const [scanClaim] =
      await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
    const scanJob = scanClaim!.job;
    const time = new Date().toISOString();
    const finding = {
      providerUserId: "100",
      username: "controlled-test-user",
      grantType: "organization_membership",
      resourceIdentifier: "github:organization:700",
      status: "access_detected",
      protectionReasons: [],
      observedAt: time,
    };
    const scan = {
      organization: { id: "700", login: "controlled-test-org" },
      authenticatedIdentity: { id: "900", login: "integration-test" },
      target: { id: "100", login: "controlled-test-user" },
      startedAt: time,
      completedAt: time,
      coverage: [
        {
          source: "organization_membership",
          outcome: "checked",
          recordCount: 2,
        },
        { source: "organization_owners", outcome: "checked", recordCount: 1 },
        { source: "outside_collaborator", outcome: "checked", recordCount: 0 },
      ],
      targetAccess: "access_detected",
      findings: [finding],
    };
    await transaction`select public.offboard_finish_job(${scanJob.id}::uuid,${scanJob.lease_token}::uuid,${transaction.json({ type: "scan", scan, limitations: ["Transactional test fixture; no provider operations."] })}::jsonb)`;
    const [savedFinding] =
      await transaction`select * from public.access_findings where case_id=${caseId}`;
    const [identity] =
      await transaction`select * from public.provider_identities where case_id=${caseId}`;
    const findingId = savedFinding!.id as string;
    await role("authenticated");
    await denied("unconfirmed identity cannot be approved", async (sp) => {
      await sp`select public.offboard_decide_removal(${findingId}::uuid,'approved')`;
    });
    await denied("mismatched identity confirmation is refused", async (sp) => {
      await sp`select public.offboard_confirm_identity(${identity!.id}::uuid,'101')`;
    });
    await transaction`select public.offboard_confirm_identity(${identity!.id}::uuid,'100')`;
    await role("postgres");
    await transaction`update public.access_findings set protection_reasons=array['organization_owner'] where id=${findingId}`;
    await role("authenticated");
    await denied("protected identities cannot be approved", async (sp) => {
      await sp`select public.offboard_decide_removal(${findingId}::uuid,'approved')`;
    });
    await role("postgres");
    await transaction`update public.access_findings set protection_reasons='{}', last_seen_at=now()-interval '16 minutes' where id=${findingId}`;
    await role("authenticated");
    await denied("stale findings cannot be approved", async (sp) => {
      await sp`select public.offboard_decide_removal(${findingId}::uuid,'approved')`;
    });
    await role("postgres");
    await transaction`update public.access_findings set last_seen_at=now() where id=${findingId}`;
    await role("authenticated");
    await transaction`select public.offboard_decide_removal(${findingId}::uuid,'rejected')`;
    const [noRemovalJob] =
      await transaction`select count(*)::int as count from public.worker_jobs where case_id=${caseId} and kind='execute_removal'`;
    assert.equal(noRemovalJob!.count, 0);
    checks += 1;
    const [approved] =
      await transaction`select public.offboard_decide_removal(${findingId}::uuid,'approved') as id`;
    await denied(
      "duplicate approval cannot enqueue another operation",
      async (sp) => {
        await sp`select public.offboard_decide_removal(${findingId}::uuid,'approved')`;
      },
    );
    await role("postgres");
    await transaction`update public.worker_jobs set created_at='1970-01-01' where approval_id=${approved!.id}`;
    await role("service_role");
    const [removalClaim] =
      await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
    const removalJob = removalClaim!.job;
    await denied("wrong lease cannot consume approval", async (sp) => {
      await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${randomUUID()}::uuid,${sp.json(scan)}::jsonb)`;
    });
    await denied("mismatched target cannot consume approval", async (sp) => {
      await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${sp.json({ ...scan, target: { id: "101", login: "other-user" } })}::jsonb)`;
    });
    await denied(
      "fresh protected-account evidence refuses execution",
      async (sp) => {
        await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${sp.json({ ...scan, findings: [{ ...finding, protectionReasons: ["organization_owner"] }] })}::jsonb)`;
      },
    );
    await role("postgres");
    await transaction`update public.removal_approvals set expires_at=now()-interval '1 second' where id=${approved!.id}`;
    await role("service_role");
    await denied("expired approval cannot execute", async (sp) => {
      await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${sp.json(scan)}::jsonb)`;
    });
    await role("postgres");
    await transaction`update public.removal_approvals set expires_at=now()+interval '15 minutes' where id=${approved!.id}`;
    await transaction`update public.profiles set role='viewer' where id=${administratorId}`;
    await role("service_role");
    await denied(
      "revoked administrator cannot authorize execution",
      async (sp) => {
        await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${sp.json(scan)}::jsonb)`;
      },
    );
    await role("postgres");
    await transaction`update public.profiles set role='admin' where id=${administratorId}`;
    await role("service_role");
    await transaction`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${transaction.json(scan)}::jsonb)`;
    await denied("single-use approval cannot execute twice", async (sp) => {
      await sp`select public.offboard_begin_removal(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${sp.json(scan)}::jsonb)`;
    });
    await transaction`select public.offboard_finish_job(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${transaction.json({ type: "removal", preflight: scan, providerResponse: { status: 204, outcome: "accepted", requestId: null, attemptedAt: time }, verification: null, verificationError: "unavailable", limitations: ["Test only"] })}::jsonb)`;
    const [report] =
      await transaction`select * from public.verification_reports where job_id=${removalJob.id}`;
    assert.equal(report!.outcome, "verification_failed");
    assert.equal(report!.coverage_status, "not_checked");
    checks += 2;
    const [caseState] =
      await transaction`select status from public.offboarding_cases where id=${caseId}`;
    assert.equal(caseState!.status, "verification_failed");
    checks += 1;
    await transaction`select public.offboard_finish_job(${removalJob.id}::uuid,${removalJob.lease_token}::uuid,${transaction.json({ type: "failure", code: "worker_error" })}::jsonb)`;
    const [reportCount] =
      await transaction`select count(*)::int as count from public.verification_reports where job_id=${removalJob.id}`;
    assert.equal(reportCount!.count, 1);
    checks += 1;
    // Independent verification never upgrades the whole case to fully cleared.
    for (const expectedOutcome of ["access_remains", "verified_removed"]) {
      await role("authenticated");
      const [nextApproval] =
        await transaction`select public.offboard_decide_removal(${findingId}::uuid,'approved') as id`;
      await role("postgres");
      await transaction`update public.worker_jobs set created_at='1970-01-01' where approval_id=${nextApproval!.id}`;
      await role("service_role");
      const [nextClaim] =
        await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
      const nextJob = nextClaim!.job;
      const freshTime = new Date().toISOString();
      const freshScan = {
        ...scan,
        startedAt: freshTime,
        completedAt: freshTime,
      };
      await transaction`select public.offboard_begin_removal(${nextJob.id}::uuid,${nextJob.lease_token}::uuid,${transaction.json(freshScan)}::jsonb)`;
      const verifiedScan =
        expectedOutcome === "verified_removed"
          ? {
              ...freshScan,
              findings: [],
              targetAccess: "not_detected_in_checked_sources",
            }
          : freshScan;
      await transaction`select public.offboard_finish_job(${nextJob.id}::uuid,${nextJob.lease_token}::uuid,${transaction.json({ type: "removal", preflight: freshScan, providerResponse: { status: 204, outcome: "accepted", requestId: null, attemptedAt: freshTime }, verification: verifiedScan, verificationError: null, limitations: ["Other providers are not checked"] })}::jsonb)`;
      const [verifiedReport] =
        await transaction`select outcome,coverage_status from public.verification_reports where job_id=${nextJob.id}`;
      assert.equal(verifiedReport!.outcome, expectedOutcome);
      assert.equal(verifiedReport!.coverage_status, "partially_verified");
      checks += 2;
      const [partialCase] =
        await transaction`select status from public.offboarding_cases where id=${caseId}`;
      assert.equal(partialCase!.status, "partially_verified");
      checks += 1;
      if (expectedOutcome === "access_remains") {
        const [followup] =
          await transaction`select j.* from public.worker_jobs j join public.removal_operations o on o.id=j.verification_operation_id where o.job_id=${nextJob.id}`;
        assert.ok(followup);
        assert.equal(followup!.kind, "scan");
        assert.equal(followup!.approval_id, null);
        assert.equal(followup!.request_origin, "verification");
        checks += 4;
        await role("postgres");
        await transaction`update public.worker_jobs set created_at='1970-01-01' where id=${followup!.id}`;
        await role("service_role");
        const [verificationClaim] =
          await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
        assert.equal(verificationClaim!.job.id, followup!.id);
        checks += 1;
        const absentScan = {
          ...freshScan,
          findings: [],
          targetAccess: "not_detected_in_checked_sources",
        };
        await transaction`select public.offboard_finish_job(${followup!.id}::uuid,${verificationClaim!.job.lease_token}::uuid,${transaction.json({ type: "scan", scan: absentScan, limitations: ["Other providers remain unchecked"] })}::jsonb)`;
        const [followupReport] =
          await transaction`select kind,outcome,coverage_status,evidence from public.verification_reports where job_id=${followup!.id}`;
        assert.equal(followupReport!.kind, "removal");
        assert.equal(followupReport!.outcome, "verified_removed");
        assert.equal(followupReport!.coverage_status, "partially_verified");
        assert.equal(followupReport!.evidence.approvalId, nextApproval!.id);
        const [originalReport] =
          await transaction`select outcome from public.verification_reports where job_id=${nextJob.id}`;
        assert.equal(originalReport!.outcome, "access_remains");
        checks += 5;
        await role("postgres");
        await transaction`update public.access_findings set status='access_remains' where id=${findingId}`;
      }
    }
    // Expired leases cannot cause a destructive retry, even after an ambiguous crash.
    await role("postgres");
    await transaction`update public.access_findings set status='access_detected',last_seen_at=now() where id=${findingId}`;
    await role("authenticated");
    const [crashApproval] =
      await transaction`select public.offboard_decide_removal(${findingId}::uuid,'approved') as id`;
    await role("postgres");
    await transaction`update public.worker_jobs set created_at='1970-01-01' where approval_id=${crashApproval!.id}`;
    await role("service_role");
    const [crashClaim] =
      await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
    await role("postgres");
    await transaction`update public.worker_jobs set lease_expires_at=now()-interval '1 second' where id=${crashClaim!.job.id}`;
    await role("service_role");
    await transaction`select public.offboard_claim_job(${workerId}::uuid)`;
    const [expiredJob] =
      await transaction`select status from public.worker_jobs where id=${crashClaim!.job.id}`;
    assert.equal(expiredJob!.status, "uncertain");
    checks += 1;
    const [uncertainReport] =
      await transaction`select outcome,coverage_status from public.verification_reports where job_id=${crashClaim!.job.id}`;
    assert.equal(uncertainReport!.outcome, "uncertain");
    assert.equal(uncertainReport!.coverage_status, "not_checked");
    checks += 2;
    // Repeated read-only worker crashes must leave a terminal report, not an endless investigation.
    await role("authenticated");
    const [crashedScan] =
      await transaction`select public.offboard_request_scan(${caseId}::uuid,${integrationId}::uuid) as id`;
    await role("postgres");
    await transaction`update public.worker_jobs set status='leased',lease_token=gen_random_uuid(),lease_expires_at=now()-interval '1 second',attempts=3,worker_id=${workerId} where id=${crashedScan!.id}`;
    await role("service_role");
    await transaction`select public.offboard_claim_job(${workerId}::uuid)`;
    const [failedScanJob] =
      await transaction`select status,completed_at from public.worker_jobs where id=${crashedScan!.id}`;
    assert.equal(failedScanJob!.status, "failed");
    checks += 1;
    assert.ok(failedScanJob!.completed_at);
    checks += 1;
    const [failedScanReport] =
      await transaction`select outcome,coverage_status from public.verification_reports where job_id=${crashedScan!.id}`;
    assert.equal(failedScanReport!.outcome, "verification_failed");
    assert.equal(failedScanReport!.coverage_status, "not_checked");
    checks += 2;
    const [failedCase] =
      await transaction`select status from public.offboarding_cases where id=${caseId}`;
    assert.equal(failedCase!.status, "verification_failed");
    checks += 1;
    const [failedRun] =
      await transaction`select outcome from public.scan_runs where job_id=${crashedScan!.id}`;
    assert.equal(failedRun!.outcome, "failed");
    checks += 1;
    const [failureAudit] =
      await transaction`select count(*)::int as count from public.audit_events where case_id=${caseId} and event_type='job_retries_exhausted'`;
    assert.equal(failureAudit!.count, 1);
    checks += 1;
    await role("authenticated", viewerId);
    await denied("non-administrator cannot approve a finding", async (sp) => {
      await sp`select public.offboard_decide_removal(${findingId}::uuid,'approved')`;
    });
    const switchContext = {
      roomId: randomUUID(),
      agentId: randomUUID(),
      senderId: "controlled-human",
      messageId: `sw_${randomUUID().replaceAll("-", "")}`,
      messageTimestamp: Date.now(),
      verifiedAt: new Date().toISOString(),
    };
    await denied("browser roles cannot attest Switch messages", async (sp) => {
      await sp`select public.offboard_switch_request_scan(${caseId}::uuid,${integrationId}::uuid,${administratorId}::uuid,${sp.json(switchContext)}::jsonb)`;
    });
    await role("service_role");
    await denied("Switch cannot map a scan request to a viewer", async (sp) => {
      await sp`select public.offboard_switch_request_scan(${caseId}::uuid,${integrationId}::uuid,${viewerId}::uuid,${sp.json(switchContext)}::jsonb)`;
    });
    await denied("missing Switch source message is refused", async (sp) => {
      await sp`select public.offboard_switch_request_scan(${caseId}::uuid,${integrationId}::uuid,${administratorId}::uuid,${sp.json({ ...switchContext, messageId: null })}::jsonb)`;
    });
    const [switchScan] =
      await transaction`select public.offboard_switch_request_scan(${caseId}::uuid,${integrationId}::uuid,${administratorId}::uuid,${transaction.json(switchContext)}::jsonb) as id`;
    const [sameRequest] =
      await transaction`select public.offboard_switch_request_scan(${caseId}::uuid,${integrationId}::uuid,${administratorId}::uuid,${transaction.json(switchContext)}::jsonb) as id`;
    assert.equal(switchScan!.id, sameRequest!.id);
    checks += 1;
    const [switchJob] =
      await transaction`select kind,request_origin,approval_id,room_context from public.worker_jobs where id=${switchScan!.id}`;
    assert.equal(switchJob!.kind, "scan");
    assert.equal(switchJob!.request_origin, "switch");
    assert.equal(switchJob!.approval_id, null);
    assert.equal(switchJob!.room_context.messageId, switchContext.messageId);
    checks += 4;
    await denied(
      "one Switch message cannot select another integration",
      async (sp) => {
        await sp`select public.offboard_switch_request_scan(${caseId}::uuid,${randomUUID()}::uuid,${administratorId}::uuid,${sp.json(switchContext)}::jsonb)`;
      },
    );

    // Email capabilities use transactional fixtures only; no mail or provider request is sent.
    await role("postgres");
    await transaction`update public.access_findings set status='access_detected',protection_reasons='{}',last_seen_at=now() where id=${findingId}`;
    await transaction`update public.removal_approvals set status='expired' where finding_id=${findingId} and status='approved'`;
    await transaction`update auth.users set email='test-admin@example.invalid',email_confirmed_at=null where id=${administratorId}`;
    await role("authenticated");
    await denied(
      "unconfirmed administrator email cannot receive a capability",
      async (sp) => {
        await sp`select public.offboard_request_approval_email(${findingId}::uuid,${"a".repeat(64)})`;
      },
    );
    await role("postgres");
    await transaction`update auth.users set email_confirmed_at=now() where id=${administratorId}`;
    await transaction`update public.access_findings set protection_reasons=array['organization_owner'] where id=${findingId}`;
    await role("authenticated");
    await denied(
      "protected targets cannot receive email reviews",
      async (sp) => {
        await sp`select public.offboard_request_approval_email(${findingId}::uuid,${"a".repeat(64)})`;
      },
    );
    await role("postgres");
    await transaction`update public.access_findings set protection_reasons='{}',last_seen_at=now()-interval '16 minutes' where id=${findingId}`;
    await role("authenticated");
    await denied("stale targets cannot receive email reviews", async (sp) => {
      await sp`select public.offboard_request_approval_email(${findingId}::uuid,${"a".repeat(64)})`;
    });
    await role("postgres");
    await transaction`update public.access_findings set last_seen_at=now() where id=${findingId}`;
    await role("authenticated", viewerId);
    assert.equal(
      (await transaction`select * from public.approval_email_requests`).length,
      0,
    );
    checks += 1;
    await denied("viewer cannot request approval emails", async (sp) => {
      await sp`select public.offboard_request_approval_email(${findingId}::uuid,${"a".repeat(64)})`;
    });
    await role("authenticated");
    const [emailReservation] =
      await transaction`select public.offboard_request_approval_email(${findingId}::uuid,${"a".repeat(64)}) as request`;
    const emailId = emailReservation!.request.id as string;
    assert.equal(
      emailReservation!.request.recipientEmail,
      "test-admin@example.invalid",
    );
    checks += 1;
    await denied("email requests are rate limited", async (sp) => {
      await sp`select public.offboard_request_approval_email(${findingId}::uuid,${"b".repeat(64)})`;
    });
    await denied(
      "browser roles cannot redeem email capabilities directly",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
      },
    );
    await role("service_role");
    await denied(
      "service callers cannot impersonate an administrator through the private decision helper",
      async (sp) => {
        await sp`select public.offboard_record_removal_decision(${findingId}::uuid,'approved',${administratorId}::uuid,'dashboard',null)`;
      },
    );
    await denied(
      "unconfirmed email submissions cannot authorize removals",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
      },
    );
    await transaction`select public.offboard_record_approval_email_delivery(${emailId}::uuid,'accepted','transactional-test-id')`;
    await denied("incorrect capability hash is refused", async (sp) => {
      await sp`select public.offboard_review_email_request(${emailId}::uuid,${"b".repeat(64)})`;
    });
    const [beforePreview] =
      await transaction`select count(*)::int as count from public.removal_approvals where finding_id=${findingId}`;
    const [emailPreview] =
      await transaction`select public.offboard_review_email_request(${emailId}::uuid,${"a".repeat(64)}) as review`;
    assert.equal(emailPreview!.review.actionable, true);
    const [afterPreview] =
      await transaction`select count(*)::int as count from public.removal_approvals where finding_id=${findingId}`;
    assert.equal(beforePreview!.count, afterPreview!.count);
    checks += 2;
    await role("postgres");
    await transaction`update public.access_findings set username='changed-test-user' where id=${findingId}`;
    await role("service_role");
    await denied("changed email target cannot be approved", async (sp) => {
      await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
    });
    await role("postgres");
    await transaction`update public.access_findings set username='controlled-test-user' where id=${findingId}`;
    await transaction`update public.profiles set role='viewer' where id=${administratorId}`;
    await role("service_role");
    await denied("revoked administrator cannot redeem an email", async (sp) => {
      await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
    });
    await role("postgres");
    await transaction`update public.profiles set role='admin' where id=${administratorId}`;
    await transaction`update public.approval_email_requests set expires_at=now()-interval '1 second' where id=${emailId}`;
    await role("service_role");
    await denied("expired email cannot be redeemed", async (sp) => {
      await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
    });
    await role("postgres");
    await transaction`update public.approval_email_requests set expires_at=now()+interval '15 minutes',delivery_status='unknown' where id=${emailId}`;
    await role("service_role");
    await denied(
      "ambiguous email delivery cannot authorize a removal",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
      },
    );
    await role("postgres");
    await transaction`update public.approval_email_requests set delivery_status='accepted' where id=${emailId}`;
    await role("service_role");
    const [emailRejection] =
      await transaction`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'rejected',false) as id`;
    assert.equal(
      (
        await transaction`select * from public.worker_jobs where approval_id=${emailRejection!.id}`
      ).length,
      0,
    );
    checks += 1;
    await denied("rejected email cannot be reused for approval", async (sp) => {
      await sp`select public.offboard_decide_email_request(${emailId}::uuid,${"a".repeat(64)},'approved',false)`;
    });
    await role("postgres");
    await transaction`update public.approval_email_requests set created_at=now()-interval '2 minutes' where recipient_id=${administratorId}`;
    await role("authenticated");
    const [secondEmail] =
      await transaction`select public.offboard_request_approval_email(${findingId}::uuid,${"b".repeat(64)}) as request`;
    await role("service_role");
    await transaction`select public.offboard_record_approval_email_delivery(${secondEmail!.request.id}::uuid,'accepted','transactional-test-id-2')`;
    await role("authenticated");
    await transaction`select public.offboard_decide_removal(${findingId}::uuid,'rejected')`;
    await role("service_role");
    await denied(
      "a newer dashboard decision revokes an old email",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${secondEmail!.request.id}::uuid,${"b".repeat(64)},'approved',false)`;
      },
    );
    await role("postgres");
    await transaction`update public.approval_email_requests set created_at=now()-interval '2 minutes' where recipient_id=${administratorId}`;
    await role("authenticated");
    const [thirdEmail] =
      await transaction`select public.offboard_request_approval_email(${findingId}::uuid,${"c".repeat(64)}) as request`;
    await role("service_role");
    await transaction`select public.offboard_record_approval_email_delivery(${thirdEmail!.request.id}::uuid,'accepted','transactional-test-id-3')`;
    const [emailApproval] =
      await transaction`select public.offboard_decide_email_request(${thirdEmail!.request.id}::uuid,${"c".repeat(64)},'approved',false) as id`;
    const [emailDecision] =
      await transaction`select approved_by::text,authorization_method,email_request_id::text from public.removal_approvals where id=${emailApproval!.id}`;
    assert.equal(emailDecision!.approved_by, administratorId);
    assert.equal(emailDecision!.authorization_method, "email");
    assert.equal(emailDecision!.email_request_id, thirdEmail!.request.id);
    assert.equal(
      (
        await transaction`select * from public.worker_jobs where approval_id=${emailApproval!.id}`
      ).length,
      1,
    );
    checks += 4;
    await denied(
      "an approved email cannot queue a second execution",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${thirdEmail!.request.id}::uuid,${"c".repeat(64)},'approved',false)`;
      },
    );
    // A genuine saved scan queues mail even before identity confirmation; approval stays human-only.
    await role("postgres");
    await transaction`update public.worker_jobs set status='failed' where case_id=${caseId} and status in ('queued','leased')`;
    await transaction`update public.access_findings set status='access_detected',last_seen_at=now(),protection_reasons='{}' where id=${findingId}`;
    await transaction`update public.provider_identities set confirmed_by=null,confirmed_at=null where id=${identity!.id}`;
    await transaction`update public.removal_approvals set status='expired' where finding_id=${findingId} and status='approved'`;
    await transaction`update public.approval_email_requests set created_at=now()-interval '2 minutes' where recipient_id=${administratorId}`;
    await role("authenticated");
    const [emailScan] =
      await transaction`select public.offboard_request_scan(${caseId}::uuid,${integrationId}::uuid) as id`;
    await role("postgres");
    await transaction`update public.worker_jobs set created_at='1970-01-01' where id=${emailScan!.id}`;
    await transaction`update public.access_findings set status='verified_removed',verified_at=now()-interval '30 minutes',last_seen_at=now()-interval '31 minutes' where id=${findingId}`;
    await role("service_role");
    const [emailScanClaim] =
      await transaction`select public.offboard_claim_job(${workerId}::uuid) as job`;
    const emailScanResult = {
      type: "scan",
      scan: {
        ...scan,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      limitations: ["Transactional fixture only"],
    };
    await transaction`select public.offboard_finish_job(${emailScan!.id}::uuid,${emailScanClaim!.job.lease_token}::uuid,${transaction.json(emailScanResult)}::jsonb)`;
    const [rediscovered] =
      await transaction`select status,verified_at,latest_scan_id from public.access_findings where id=${findingId}`;
    assert.equal(rediscovered!.status, "access_detected");
    assert.equal(rediscovered!.verified_at, null);
    assert.notEqual(rediscovered!.latest_scan_id, savedFinding!.latest_scan_id);
    checks += 3;
    const [queuedEmail] =
      await transaction`select * from public.approval_email_dispatches where scan_job_id=${emailScan!.id}`;
    assert.ok(queuedEmail);
    assert.equal(queuedEmail!.recipient_id, administratorId);
    checks += 2;
    await transaction`select public.offboard_finish_job(${emailScan!.id}::uuid,${emailScanClaim!.job.lease_token}::uuid,${transaction.json(emailScanResult)}::jsonb)`;
    assert.equal(
      (
        await transaction`select * from public.approval_email_dispatches where scan_job_id=${emailScan!.id}`
      ).length,
      1,
    );
    checks += 1;
    await role("authenticated");
    await denied(
      "browser cannot claim the automatic mail queue",
      async (sp) => {
        await sp`select public.offboard_claim_email_dispatch()`;
      },
    );
    await role("service_role");
    const [mailClaim] =
      await transaction`select public.offboard_claim_email_dispatch() as dispatch`;
    assert.equal(mailClaim!.dispatch.id, queuedEmail!.id);
    const [otherClaim] =
      await transaction`select public.offboard_claim_email_dispatch() as dispatch`;
    assert.equal(otherClaim!.dispatch, null);
    checks += 2;
    const [autoReservation] =
      await transaction`select public.offboard_prepare_automatic_email(${queuedEmail!.id}::uuid,${"d".repeat(64)}) as request`;
    await denied(
      "one dispatch cannot prepare another private link",
      async (sp) => {
        await sp`select public.offboard_prepare_automatic_email(${queuedEmail!.id}::uuid,${"e".repeat(64)})`;
      },
    );
    await denied(
      "automatic delivery cannot be marked accepted before provider evidence",
      async (sp) => {
        await sp`select public.offboard_finish_email_dispatch(${queuedEmail!.id}::uuid,'accepted')`;
      },
    );
    await transaction`select public.offboard_record_approval_email_delivery(${autoReservation!.request.id}::uuid,'accepted','transactional-auto-test')`;
    await transaction`select public.offboard_finish_email_dispatch(${queuedEmail!.id}::uuid,'accepted')`;
    const [autoPreview] =
      await transaction`select public.offboard_review_email_request(${autoReservation!.request.id}::uuid,${"d".repeat(64)}) as review`;
    assert.equal(autoPreview!.review.identityConfirmed, false);
    assert.equal(autoPreview!.review.actionable, true);
    assert.equal(
      (
        await transaction`select * from public.removal_approvals where email_request_id=${autoReservation!.request.id}`
      ).length,
      0,
    );
    checks += 3;
    await role("postgres");
    await transaction`update public.access_findings set last_seen_at=now()-interval '11 minutes' where id=${findingId}`;
    await role("service_role");
    await transaction`select public.offboard_claim_email_dispatch()`;
    const [reviewRefresh] =
      await transaction`select * from public.worker_jobs where review_email_request_id=${autoReservation!.request.id}`;
    assert.ok(reviewRefresh);
    assert.equal(reviewRefresh!.kind, "scan");
    assert.equal(reviewRefresh!.status, "queued");
    assert.equal(reviewRefresh!.request_origin, "email_review");
    assert.equal(reviewRefresh!.approval_id, null);
    checks += 5;
    await transaction`select public.offboard_claim_email_dispatch()`;
    assert.equal(
      (
        await transaction`select * from public.worker_jobs where review_email_request_id=${autoReservation!.request.id}`
      ).length,
      1,
    );
    checks += 1;
    await denied(
      "private review-refresh internals are not exposed to the worker's database role",
      async (sp) => {
        await sp`select public.offboard_refresh_pending_email_scans()`;
      },
    );
    await role("postgres");
    await transaction`update public.worker_jobs set status='failed' where id=${reviewRefresh!.id}`;
    await role("service_role");
    await transaction`select public.offboard_claim_email_dispatch()`;
    assert.equal(
      (
        await transaction`select * from public.worker_jobs where review_email_request_id=${autoReservation!.request.id}`
      ).length,
      1,
    );
    checks += 1;
    await denied(
      "automatic mail cannot approve an unconfirmed identity without a human acknowledgement",
      async (sp) => {
        await sp`select public.offboard_decide_email_request(${autoReservation!.request.id}::uuid,${"d".repeat(64)},'approved',false)`;
      },
    );
    const [autoHumanApproval] =
      await transaction`select public.offboard_decide_email_request(${autoReservation!.request.id}::uuid,${"d".repeat(64)},'approved',true) as id`;
    const [emailConfirmedIdentity] =
      await transaction`select confirmed_by::text from public.provider_identities where id=${identity!.id}`;
    assert.equal(emailConfirmedIdentity!.confirmed_by, administratorId);
    assert.equal(
      (
        await transaction`select * from public.worker_jobs where approval_id=${autoHumanApproval!.id}`
      ).length,
      1,
    );
    checks += 2;
    // A crashed mail sender is uncertain, not retried or presented as delivered.
    await role("postgres");
    await transaction`update public.approval_email_dispatches set status='processing',started_at=now()-interval '2 minutes' where id=${queuedEmail!.id}`;
    await role("service_role");
    await transaction`select public.offboard_claim_email_dispatch()`;
    const [uncertainMail] =
      await transaction`select status from public.approval_email_dispatches where id=${queuedEmail!.id}`;
    assert.equal(uncertainMail!.status, "unknown");
    checks += 1;
    console.info(
      `${checks} database safety checks passed. All test records are rolled back; no provider API was called.`,
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) {
    console.error(
      `Database safety test failed (${error instanceof postgres.PostgresError ? error.code : error instanceof assert.AssertionError ? "assertion" : "connection_or_test_error"}; ${checks} checks completed). No provider operations were attempted.`,
    );
    process.exitCode = 1;
  }
} finally {
  await sql.end({ timeout: 5 });
}
