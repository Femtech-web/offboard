-- Scan completion queues email delivery; neither the agent nor delivery can approve access removal.
alter table public.approval_email_requests add column request_origin text not null default 'dashboard' check(request_origin in ('dashboard','automatic'));
create table public.approval_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references public.worker_jobs(id),
  finding_id uuid not null references public.access_findings(id),
  recipient_id uuid not null references public.profiles(id),
  request_id uuid references public.approval_email_requests(id),
  status text not null default 'queued' check(status in ('queued','processing','accepted','skipped','failed','unknown')),
  created_at timestamptz not null default clock_timestamp(), started_at timestamptz, completed_at timestamptz,
  unique(scan_job_id,finding_id,recipient_id)
);
create index on public.approval_email_dispatches(finding_id,recipient_id,created_at desc);
create index on public.approval_email_dispatches(recipient_id);
create index on public.approval_email_dispatches(request_id);
create index approval_email_dispatches_queue on public.approval_email_dispatches(created_at) where status='queued';
alter table public.approval_email_dispatches enable row level security;
create policy administrator_read on public.approval_email_dispatches for select to authenticated using ((select public.offboard_is_admin()));
revoke all on public.approval_email_dispatches from anon,authenticated;
grant select on public.approval_email_dispatches to authenticated;
grant all on public.approval_email_dispatches to service_role;

create function public.offboard_queue_scan_emails() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.approval_email_dispatches(scan_job_id,finding_id,recipient_id)
  select new.id,f.id,p.id from public.access_findings f
    join public.scan_runs s on s.id=f.latest_scan_id and s.job_id=new.id and s.outcome='succeeded'
    join public.profiles p on p.id=new.requested_by and p.role='admin'
    join auth.users u on u.id=p.id and u.email_confirmed_at is not null and lower(u.email)=lower(p.email)
    where f.case_id=new.case_id and f.integration_id=new.integration_id
      and f.status in ('access_detected','access_remains','verification_failed') and cardinality(f.protection_reasons)=0
      and not exists(select 1 from public.approval_email_dispatches d where d.finding_id=f.id and d.recipient_id=p.id
        and d.created_at>clock_timestamp()-interval '15 minutes' and d.status in ('queued','processing','accepted'))
    on conflict do nothing;
  return new;
end $$;
create trigger queue_scan_emails after update of status on public.worker_jobs for each row
  when (new.kind='scan' and new.status='succeeded' and old.status is distinct from new.status)
  execute function public.offboard_queue_scan_emails();

create function public.offboard_reserve_approval_email(p_finding_id uuid,p_token_hash text,p_administrator_id uuid,p_origin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := p_administrator_id; finding public.access_findings; identity_record public.provider_identities;
  recipient text; request public.approval_email_requests;
begin
  if p_origin is null or p_origin not in ('dashboard','automatic') then raise exception 'invalid_origin'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_token_hash'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  select lower(u.email) into recipient from auth.users u join public.profiles p on p.id=u.id
    where u.id=actor and p.role='admin' and u.email_confirmed_at is not null and lower(u.email)=lower(p.email);
  if recipient is null then raise exception 'recipient_not_confirmed'; end if;
  select * into strict finding from public.access_findings where id=p_finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  if finding.status not in ('access_detected','access_remains','verification_failed') or cardinality(finding.protection_reasons)>0
    or identity_record.provider_user_id is distinct from finding.provider_user_id
    or finding.last_seen_at<clock_timestamp()-interval '15 minutes'
    or public.offboard_finding_snapshot(p_finding_id)->>'organizationId' is null then raise exception 'unsafe_or_stale_target'; end if;
  if exists(select 1 from public.approval_email_requests where recipient_id=actor and created_at>clock_timestamp()-interval '1 minute')
    then raise exception 'email_rate_limited'; end if;
  update public.approval_email_requests set status='revoked' where finding_id=p_finding_id and recipient_id=actor and status='pending';
  insert into public.approval_email_requests(finding_id,recipient_id,recipient_email,token_hash,target_snapshot,request_origin)
    values(p_finding_id,actor,recipient,p_token_hash,public.offboard_finding_snapshot(p_finding_id),p_origin) returning * into request;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(finding.case_id,'approval_email_requested',case when p_origin='automatic' then 'system' else 'human' end,case when p_origin='automatic' then 'email_automation' else actor::text end,jsonb_build_object('requestId',request.id,'findingId',p_finding_id,'target',request.target_snapshot,'origin',p_origin,'recipientId',actor));
  return jsonb_build_object('id',request.id,'expiresAt',request.expires_at,'recipientEmail',recipient,'target',request.target_snapshot,
    'caseId',finding.case_id,'personName',(select full_name from public.offboarding_cases where id=finding.case_id));
end $$;


create or replace function public.offboard_request_approval_email(p_finding_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return public.offboard_reserve_approval_email(p_finding_id,p_token_hash,public.offboard_require_admin(),'dashboard');
end $$;

create function public.offboard_claim_email_dispatch() returns jsonb language plpgsql security definer set search_path='' as $$
declare dispatch public.approval_email_dispatches;
begin
  -- No automatic retry after a possible send or a crashed sender.
  update public.approval_email_dispatches set status='unknown',completed_at=clock_timestamp()
    where status='processing' and started_at<clock_timestamp()-interval '1 minute';
  select * into dispatch from public.approval_email_dispatches where status='queued' order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.approval_email_dispatches set status='processing',started_at=clock_timestamp() where id=dispatch.id;
  return jsonb_build_object('id',dispatch.id,'findingId',dispatch.finding_id,'recipientId',dispatch.recipient_id);
end $$;

create function public.offboard_prepare_automatic_email(p_dispatch_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare dispatch public.approval_email_dispatches; request jsonb;
begin
  select * into strict dispatch from public.approval_email_dispatches where id=p_dispatch_id for update;
  if dispatch.status<>'processing' or dispatch.request_id is not null then raise exception 'dispatch_not_available'; end if;
  request := public.offboard_reserve_approval_email(dispatch.finding_id,p_token_hash,dispatch.recipient_id,'automatic');
  update public.approval_email_dispatches set request_id=(request->>'id')::uuid where id=dispatch.id;
  return request;
end $$;

create function public.offboard_finish_email_dispatch(p_dispatch_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare dispatch public.approval_email_dispatches;
begin
  if p_status is null or p_status not in ('accepted','skipped','failed','unknown') then raise exception 'invalid_status'; end if;
  select * into strict dispatch from public.approval_email_dispatches where id=p_dispatch_id for update;
  if dispatch.status<>'processing' then return; end if;
  if p_status='accepted' and not exists(select 1 from public.approval_email_requests where id=dispatch.request_id and delivery_status='accepted') then raise exception 'delivery_not_confirmed'; end if;
  update public.approval_email_dispatches set status=p_status,completed_at=clock_timestamp() where id=dispatch.id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
    select case_id,'automatic_approval_email_'||p_status,'system','email_automation',jsonb_build_object('dispatchId',dispatch.id,'requestId',dispatch.request_id,'scanJobId',dispatch.scan_job_id)
    from public.access_findings where id=dispatch.finding_id;
end $$;

create or replace function public.offboard_review_email_request(p_request_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.approval_email_requests; finding public.access_findings;
begin
  select * into strict request from public.approval_email_requests where id=p_request_id and token_hash=p_token_hash;
  if request.status<>'pending' or request.delivery_status<>'accepted' or request.expires_at<=clock_timestamp()
    or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=request.recipient_id and p.role='admin'
      and u.email_confirmed_at is not null and lower(u.email)=request.recipient_email and lower(p.email)=request.recipient_email)
    then raise exception 'email_review_unavailable'; end if;
  select * into strict finding from public.access_findings where id=request.finding_id;
  if public.offboard_finding_snapshot(finding.id) is distinct from request.target_snapshot then raise exception 'target_changed'; end if;
  return jsonb_build_object('id',request.id,'expiresAt',request.expires_at,'recipientEmail',request.recipient_email,
    'identityConfirmed',exists(select 1 from public.provider_identities where id=finding.identity_id and confirmed_at is not null and provider_user_id=finding.provider_user_id),'target',request.target_snapshot,'personName',(select full_name from public.offboarding_cases where id=finding.case_id),
    'actionable',finding.status in ('access_detected','access_remains','verification_failed') and cardinality(finding.protection_reasons)=0
      and finding.last_seen_at>clock_timestamp()-interval '15 minutes'
      and exists(select 1 from public.provider_identities where id=finding.identity_id and provider_user_id=finding.provider_user_id));
end $$;


-- The narrow email capability can confirm the exact identity only with a separate explicit acknowledgement.
drop function public.offboard_decide_email_request(uuid,text,text);
create function public.offboard_decide_email_request(p_request_id uuid,p_token_hash text,p_decision text,p_identity_acknowledged boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.approval_email_requests; finding public.access_findings; identity_record public.provider_identities; result uuid;
begin
  select * into strict finding from public.access_findings where id=(select finding_id from public.approval_email_requests where id=p_request_id) for update;
  select * into strict request from public.approval_email_requests where id=p_request_id for update;
  perform public.offboard_review_email_request(p_request_id,p_token_hash);
  select * into strict identity_record from public.provider_identities where id=finding.identity_id for update;
  if p_decision='approved' and identity_record.confirmed_at is null then
    if p_identity_acknowledged is distinct from true or identity_record.provider_user_id is distinct from finding.provider_user_id then raise exception 'identity_confirmation_required'; end if;
    update public.provider_identities set confirmed_by=request.recipient_id,confirmed_at=clock_timestamp() where id=identity_record.id;
    insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
      values(finding.case_id,'identity_confirmed','human',request.recipient_id::text,jsonb_build_object('identityId',identity_record.id,'providerUserId',finding.provider_user_id,'authorizationMethod','email','emailRequestId',request.id));
  end if;
  result := public.offboard_record_removal_decision(request.finding_id,p_decision,request.recipient_id,'email',request.id);
  update public.approval_email_requests set status='decided',approval_id=result,decided_at=clock_timestamp() where id=request.id;
  return result;
end $$;

revoke all on function public.offboard_queue_scan_emails(),public.offboard_reserve_approval_email(uuid,text,uuid,text),public.offboard_claim_email_dispatch(),public.offboard_prepare_automatic_email(uuid,text),public.offboard_finish_email_dispatch(uuid,text),public.offboard_decide_email_request(uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.offboard_claim_email_dispatch(),public.offboard_prepare_automatic_email(uuid,text),public.offboard_finish_email_dispatch(uuid,text),public.offboard_decide_email_request(uuid,text,text,boolean) to service_role;
