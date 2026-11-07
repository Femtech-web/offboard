-- Exhausted read-only retries stay failed, with evidence and audit records. Destructive jobs are never retried.
create or replace function public.offboard_claim_job(p_worker_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; integration_record public.integrations; identity_record public.provider_identities; snapshot jsonb;
begin
  insert into public.worker_heartbeats(worker_id) values(p_worker_id) on conflict(worker_id) do update set last_seen_at=now();
  for job in select * from public.worker_jobs where status='leased' and lease_expires_at<now() for update skip locked loop
    if job.kind='execute_removal' then
      update public.worker_jobs set status='uncertain',error_code='lease_expired_no_retry',completed_at=now() where id=job.id;
      update public.removal_operations set status='uncertain' where job_id=job.id;
      update public.access_findings set status='verification_failed' where id=(select finding_id from public.removal_approvals where id=job.approval_id);
      update public.removal_approvals set status='expired' where id=job.approval_id and status='approved';
      insert into public.verification_reports(case_id,job_id,kind,outcome,coverage_status,evidence) values(job.case_id,job.id,'removal','uncertain','not_checked',jsonb_build_object('error','Worker lease expired. No automatic destructive retry. Inspect provider state before a new proposal.','approvalId',job.approval_id)) on conflict do nothing;
      update public.offboarding_cases set status='verification_failed',updated_at=now() where id=job.case_id;
    else
      update public.worker_jobs set status=case when attempts<3 then 'queued' else 'failed' end, error_code='lease_expired',completed_at=case when attempts>=3 then now() end where id=job.id;
      if job.attempts>=3 then
        update public.integrations set status='failed',last_checked_at=now(),last_error='worker_lease_expired' where id=job.integration_id;
        if job.case_id is not null then
          update public.offboarding_cases set status='verification_failed',updated_at=now() where id=job.case_id;
          insert into public.scan_runs(job_id,case_id,integration_id,outcome,evidence) values(job.id,job.case_id,job.integration_id,'failed',jsonb_build_object('error','Worker stopped before scan evidence was saved.','code','worker_lease_expired')) on conflict do nothing;
          insert into public.verification_reports(case_id,job_id,kind,outcome,coverage_status,evidence) values(job.case_id,job.id,'investigation','verification_failed','not_checked',jsonb_build_object('error','Read-only scan retry limit reached without saved provider evidence.','code','worker_lease_expired')) on conflict do nothing;
        end if;
        insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(job.case_id,'job_retries_exhausted','system',p_worker_id::text,jsonb_build_object('jobId',job.id,'kind',job.kind,'errorCode','worker_lease_expired'));
      end if;
    end if;
  end loop;
  select * into job from public.worker_jobs where status='queued' order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.worker_jobs set status='leased',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '10 minutes',worker_id=p_worker_id,attempts=attempts+1 where id=job.id returning * into job;
  select * into strict integration_record from public.integrations where id=job.integration_id;
  if job.case_id is not null then select * into strict identity_record from public.provider_identities where case_id=job.case_id and provider='github'; end if;
  if job.approval_id is not null then select target_snapshot into snapshot from public.removal_approvals where id=job.approval_id; end if;
  return jsonb_build_object('id',job.id,'lease_token',job.lease_token,'kind',job.kind,'integration_id',job.integration_id,'case_id',job.case_id,'approval_id',job.approval_id,'organization',integration_record.organization,'username',identity_record.username,'expected_user_id',identity_record.provider_user_id,'snapshot',snapshot);
end $$;
