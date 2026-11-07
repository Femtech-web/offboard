-- A provider may briefly list access after accepting a removal. Preserve the first report
-- and queue one additional read-only verification, never another DELETE.
alter table public.worker_jobs drop constraint worker_jobs_request_origin_check;
alter table public.worker_jobs add constraint worker_jobs_request_origin_check check(request_origin in ('dashboard','switch','email_review','verification'));
alter table public.worker_jobs add column verification_operation_id uuid references public.removal_operations(id);
create unique index worker_jobs_operation_verification_once on public.worker_jobs(verification_operation_id) where verification_operation_id is not null;

create function public.offboard_queue_followup_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.worker_jobs(kind,case_id,integration_id,requested_by,request_origin,verification_operation_id)
    select 'scan',new.case_id,new.integration_id,new.requested_by,'verification',o.id
    from public.removal_operations o where o.job_id=new.id and o.status='access_remains'
      and o.provider_response->>'outcome'='accepted'
    on conflict do nothing;
  return new;
end $$;
create trigger queue_followup_verification after update of status on public.worker_jobs for each row
  when(new.kind='execute_removal' and new.status='succeeded' and old.status is distinct from new.status)
  execute function public.offboard_queue_followup_verification();

create function public.offboard_save_followup_verification() returns trigger language plpgsql security definer set search_path='' as $$
declare operation public.removal_operations; approval public.removal_approvals; scan jsonb; verified boolean;
begin
  select o.* into operation from public.worker_jobs j join public.removal_operations o on o.id=j.verification_operation_id
    where j.id=new.job_id and j.kind='scan' and j.request_origin='verification';
  if not found then return new; end if;
  select * into strict approval from public.removal_approvals where id=operation.approval_id;
  scan := new.evidence->'scan';
  verified := new.outcome in ('access_detected','not_detected') and scan is not null
    and scan#>>'{target,id}'=approval.target_snapshot->>'providerUserId'
    and lower(scan#>>'{target,login}')=lower(approval.target_snapshot->>'username')
    and scan#>>'{organization,id}'=approval.target_snapshot->>'organizationId';
  new.kind := 'removal';
  new.outcome := case when verified then
    case when exists(select 1 from jsonb_array_elements(scan->'findings') f where f->>'providerUserId'=approval.target_snapshot->>'providerUserId'
      and f->>'grantType'=approval.target_snapshot->>'grantType' and f->>'resourceIdentifier'=approval.target_snapshot->>'resourceIdentifier')
      then 'access_remains' else 'verified_removed' end
    else 'verification_failed' end;
  new.coverage_status := case when verified then 'partially_verified' else 'not_checked' end;
  new.evidence := jsonb_build_object('type','removal','preflight',operation.preflight,'providerResponse',operation.provider_response,
    'verification',case when verified then scan end,'verificationError',case when not verified then 'unavailable' end,
    'limitations',coalesce(new.evidence->'limitations','[]'::jsonb),'target',approval.target_snapshot,'approvedBy',approval.approved_by,
    'approvedAt',approval.created_at,'approvalId',approval.id,'consumedAt',approval.consumed_at,'followupForJobId',operation.job_id);
  update public.removal_operations set status=new.outcome,verification=case when verified then scan end,
    verified_at=case when verified then clock_timestamp() end where id=operation.id;
  update public.access_findings set status=new.outcome,verified_at=case when new.outcome='verified_removed' then clock_timestamp() end
    where id=operation.finding_id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
    values(new.case_id,'removal_reverified','system','independent_verification',jsonb_build_object('jobId',new.job_id,'operationId',operation.id,'outcome',new.outcome));
  return new;
end $$;
create trigger save_followup_verification before insert on public.verification_reports for each row
  execute function public.offboard_save_followup_verification();
revoke all on function public.offboard_queue_followup_verification(),public.offboard_save_followup_verification() from public,anon,authenticated,service_role;

-- Include genuine accepted operations awaiting verification when this feature rolls out.
insert into public.worker_jobs(kind,case_id,integration_id,requested_by,request_origin,verification_operation_id)
  select 'scan',j.case_id,j.integration_id,j.requested_by,'verification',o.id
  from public.removal_operations o join public.worker_jobs j on j.id=o.job_id
  where j.status='succeeded' and o.status='access_remains' and o.provider_response->>'outcome'='accepted'
  on conflict do nothing;
