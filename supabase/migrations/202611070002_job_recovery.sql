-- Validate complete checked scope before evidence can establish absence.
create function public.offboard_scan_complete(p_scan jsonb) returns boolean language plpgsql volatile set search_path = '' as $$
begin
  if p_scan is null or jsonb_typeof(p_scan)<>'object' or jsonb_typeof(p_scan->'coverage')<>'array' or jsonb_typeof(p_scan->'findings')<>'array' then return false; end if;
  if jsonb_array_length(p_scan->'coverage')<>3 or (select count(distinct value->>'source') from jsonb_array_elements(p_scan->'coverage') where value->>'source' in ('organization_membership','organization_owners','outside_collaborator') and value->>'outcome'='checked')<>3 then return false; end if;
  if p_scan#>>'{target,id}' is null or p_scan#>>'{organization,id}' is null or p_scan->>'startedAt' is null or p_scan->>'completedAt' is null then return false; end if;
  if (p_scan->>'completedAt')::timestamptz < (p_scan->>'startedAt')::timestamptz or (p_scan->>'completedAt')::timestamptz > clock_timestamp()+interval '5 seconds' then return false; end if;
  if exists(select 1 from jsonb_array_elements(p_scan->'findings') where value->>'providerUserId' is distinct from p_scan#>>'{target,id}' or value->>'resourceIdentifier' is distinct from 'github:organization:'||(p_scan#>>'{organization,id}') or jsonb_typeof(value->'protectionReasons') is distinct from 'array') then return false; end if;
  return true;
exception when others then return false;
end $$;

create or replace function public.offboard_request_scan(p_case_id uuid, p_integration_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); job_identifier uuid;
begin
  if not exists(select 1 from public.offboarding_cases where id=p_case_id) or not exists(select 1 from public.integrations where id=p_integration_id) then raise exception 'unknown_scope'; end if;
  if exists(select 1 from public.worker_jobs where case_id=p_case_id and integration_id=p_integration_id and kind='execute_removal' and status in ('queued','leased')) then raise exception 'removal_pending'; end if;
  insert into public.worker_jobs(kind,case_id,integration_id,requested_by) values('scan',p_case_id,p_integration_id,actor) returning id into job_identifier;
  update public.offboarding_cases set status='investigating', updated_at=now() where id=p_case_id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(p_case_id,'scan_requested','human',actor::text,jsonb_build_object('jobId',job_identifier));
  return job_identifier;
end $$;

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
      update public.worker_jobs set status=case when attempts<3 then 'queued' else 'failed' end, error_code='lease_expired' where id=job.id;
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

create or replace function public.offboard_begin_removal(p_job_id uuid,p_lease_token uuid,p_preflight jsonb) returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; approval public.removal_approvals; finding public.access_findings; identity_record public.provider_identities; matching jsonb;
begin
  select * into strict job from public.worker_jobs where id=p_job_id for update;
  if job.kind<>'execute_removal' or job.status<>'leased' or job.lease_token is distinct from p_lease_token or job.lease_expires_at<=now() or job.execution_started then raise exception 'invalid_job_lease'; end if;
  select * into strict approval from public.removal_approvals where id=job.approval_id for update;
  select * into strict finding from public.access_findings where id=approval.finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  if approval.status<>'approved' or approval.expires_at<=now() or approval.consumed_at is not null or not exists(select 1 from public.profiles where id=approval.approved_by and role='admin') then raise exception 'invalid_approval'; end if;
  if identity_record.confirmed_at is null or identity_record.provider_user_id is distinct from approval.target_snapshot->>'providerUserId' or cardinality(finding.protection_reasons)>0 then raise exception 'unsafe_identity'; end if;
  if not public.offboard_scan_complete(p_preflight) or (p_preflight->>'completedAt')::timestamptz < clock_timestamp()-interval '60 seconds' then raise exception 'incomplete_or_stale_preflight'; end if;
  if p_preflight#>>'{organization,id}' is distinct from approval.target_snapshot->>'organizationId' or p_preflight#>>'{target,id}' is distinct from approval.target_snapshot->>'providerUserId' or lower(p_preflight#>>'{target,login}') is distinct from lower(approval.target_snapshot->>'username') or p_preflight#>>'{target,id}' = p_preflight#>>'{authenticatedIdentity,id}' then raise exception 'target_mismatch'; end if;
  select value into matching from jsonb_array_elements(p_preflight->'findings') where value->>'providerUserId'=approval.target_snapshot->>'providerUserId' and value->>'grantType'=approval.target_snapshot->>'grantType' and value->>'resourceIdentifier'=approval.target_snapshot->>'resourceIdentifier';
  if matching is null or jsonb_array_length(matching->'protectionReasons')<>0 then raise exception 'protected_or_absent_permission'; end if;
  update public.removal_approvals set status='consumed',consumed_at=now() where id=approval.id;
  update public.worker_jobs set execution_started=true where id=job.id;
  update public.access_findings set status='removal_in_progress' where id=finding.id;
  insert into public.removal_operations(approval_id,finding_id,job_id,action,status,preflight) values(approval.id,finding.id,job.id,finding.grant_type,'executing',p_preflight);
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(job.case_id,'approval_consumed','worker',job.worker_id::text,jsonb_build_object('approvalId',approval.id,'target',approval.target_snapshot));
  return true;
end $$;

create or replace function public.offboard_finish_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; integration_record public.integrations; identity_record public.provider_identities; scan jsonb; observed jsonb; scan_identifier uuid; approval public.removal_approvals; outcome text; coverage text; finding_identifier uuid;
begin
  select * into strict job from public.worker_jobs where id=p_job_id for update;
  if job.status in ('succeeded','failed') and job.lease_token=p_lease_token then return; end if;
  if job.status<>'leased' or job.lease_token is distinct from p_lease_token or job.lease_expires_at<=now() then raise exception 'invalid_job_lease'; end if;
  select * into strict integration_record from public.integrations where id=job.integration_id;
  if p_result->>'type'='failure' then
    update public.worker_jobs set status=case when execution_started then 'uncertain' else 'failed' end,error_code=p_result->>'code',completed_at=now() where id=job.id;
    update public.integrations set status='failed',last_checked_at=now(),last_error=p_result->>'code' where id=job.integration_id;
    if job.kind='execute_removal' then
      update public.access_findings set status='verification_failed' where id=(select finding_id from public.removal_approvals where id=job.approval_id);
      update public.removal_approvals set status='expired' where id=job.approval_id and status='approved';
    end if;
    if job.case_id is not null then
      update public.offboarding_cases set status='verification_failed',updated_at=now() where id=job.case_id;
      insert into public.verification_reports(case_id,job_id,kind,outcome,coverage_status,evidence) values(job.case_id,job.id,case when job.kind='scan' then 'investigation' else 'removal' end,'verification_failed','not_checked',p_result);
      if job.kind='scan' then insert into public.scan_runs(job_id,case_id,integration_id,outcome,evidence) values(job.id,job.case_id,job.integration_id,'failed',p_result); end if;
      if job.execution_started then
        update public.removal_operations set status='uncertain',provider_response=p_result where job_id=job.id;
        update public.access_findings set status='verification_failed' where id=(select finding_id from public.removal_approvals where id=job.approval_id);
      end if;
    end if;
  elsif job.kind='check_integration' and p_result->>'type'='connection' then
    if lower(p_result#>>'{organization,login}')<>lower(integration_record.organization) or (integration_record.organization_id is not null and integration_record.organization_id<>p_result#>>'{organization,id}') then raise exception 'organization_mismatch'; end if;
    update public.integrations set organization_id=p_result#>>'{organization,id}',status='connected',permissions=p_result->'permissions',last_checked_at=now(),last_successful_check_at=now(),last_error=null where id=job.integration_id;
    update public.worker_jobs set status='succeeded',completed_at=now() where id=job.id;
  elsif job.kind='scan' and p_result->>'type'='scan' then
    scan := p_result->'scan';
    if not public.offboard_scan_complete(scan) then raise exception 'incomplete_scan'; end if;
    select * into strict identity_record from public.provider_identities where case_id=job.case_id for update;
    if lower(scan#>>'{target,login}')<>lower(identity_record.username) or (identity_record.provider_user_id is not null and identity_record.provider_user_id<>scan#>>'{target,id}') or lower(scan#>>'{organization,login}')<>lower(integration_record.organization) or (integration_record.organization_id is not null and integration_record.organization_id<>scan#>>'{organization,id}') then raise exception 'target_mismatch'; end if;
    update public.provider_identities set provider_user_id=scan#>>'{target,id}' where id=identity_record.id;
    insert into public.scan_runs(job_id,case_id,integration_id,provider_user_id,outcome,evidence) values(job.id,job.case_id,job.integration_id,scan#>>'{target,id}','succeeded',scan) returning id into scan_identifier;
    -- A read-only absence is never labeled a verified removal.
    update public.access_findings set status='not_detected',latest_scan_id=scan_identifier where case_id=job.case_id and integration_id=job.integration_id and status not in ('awaiting_approval','removal_in_progress','verified_removed');
    for observed in select value from jsonb_array_elements(scan->'findings') loop
      insert into public.access_findings(case_id,integration_id,identity_id,provider_user_id,username,grant_type,resource_identifier,protection_reasons,evidence,latest_scan_id)
      values(job.case_id,job.integration_id,identity_record.id,observed->>'providerUserId',observed->>'username',observed->>'grantType',observed->>'resourceIdentifier',array(select jsonb_array_elements_text(observed->'protectionReasons')),observed,scan_identifier)
      on conflict(case_id,integration_id,provider_user_id,grant_type,resource_identifier) do update set status=case when public.access_findings.status in ('awaiting_approval','removal_in_progress') then public.access_findings.status else 'access_detected' end, protection_reasons=excluded.protection_reasons,evidence=excluded.evidence,latest_scan_id=excluded.latest_scan_id,last_seen_at=now();
    end loop;
    update public.integrations set organization_id=scan#>>'{organization,id}',status='connected',last_checked_at=now(),last_successful_check_at=now(),last_error=null where id=job.integration_id;
    outcome := case when jsonb_array_length(scan->'findings')>0 then 'access_detected' else 'not_detected' end;
    insert into public.verification_reports(case_id,job_id,kind,outcome,coverage_status,evidence) values(job.case_id,job.id,'investigation',outcome,'partially_verified',p_result);
    update public.offboarding_cases set status=case when outcome='access_detected' then 'needs_review' else 'partially_verified' end,updated_at=now() where id=job.case_id;
    update public.worker_jobs set status='succeeded',completed_at=now() where id=job.id;
  elsif job.kind='execute_removal' and p_result->>'type'='removal' and job.execution_started then
    select * into strict approval from public.removal_approvals where id=job.approval_id;
    scan := p_result->'verification';
    outcome := 'verification_failed'; coverage := 'not_checked';
    if public.offboard_scan_complete(scan) and (scan->>'startedAt')::timestamptz >= (p_result#>>'{providerResponse,attemptedAt}')::timestamptz and scan#>>'{target,id}'=approval.target_snapshot->>'providerUserId' and scan#>>'{organization,id}'=approval.target_snapshot->>'organizationId' and lower(scan#>>'{target,login}')=lower(approval.target_snapshot->>'username') then
      coverage := 'partially_verified';
      outcome := case when exists(select 1 from jsonb_array_elements(scan->'findings') where value->>'providerUserId'=approval.target_snapshot->>'providerUserId' and value->>'grantType'=approval.target_snapshot->>'grantType' and value->>'resourceIdentifier'=approval.target_snapshot->>'resourceIdentifier') then 'access_remains' else 'verified_removed' end;
    end if;
    update public.removal_operations set status=outcome,provider_response=p_result->'providerResponse',verification=scan,verified_at=case when coverage='partially_verified' then now() end where job_id=job.id;
    update public.access_findings set status=outcome,verified_at=case when outcome='verified_removed' then now() end where id=approval.finding_id;
    insert into public.verification_reports(case_id,job_id,kind,outcome,coverage_status,evidence) values(job.case_id,job.id,'removal',outcome,coverage,p_result || jsonb_build_object('target',approval.target_snapshot,'approvedBy',approval.approved_by,'approvedAt',approval.created_at,'approvalId',approval.id,'consumedAt',approval.consumed_at));
    update public.offboarding_cases set status=case when outcome='verification_failed' then 'verification_failed' else 'partially_verified' end,updated_at=now() where id=job.case_id;
    update public.worker_jobs set status='succeeded',completed_at=now() where id=job.id;
  else raise exception 'invalid_result_kind'; end if;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(job.case_id,'job_completed','worker',job.worker_id::text,jsonb_build_object('jobId',job.id,'kind',job.kind,'resultType',p_result->>'type','outcome',outcome,'errorCode',p_result->>'code'));
end $$;

revoke all on function public.offboard_scan_complete(jsonb) from public, anon, authenticated;
grant execute on function public.offboard_scan_complete(jsonb) to service_role;
