-- Email is an action-scoped authentication channel; it never grants an agent approval access.
create table public.approval_email_requests (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.access_findings(id),
  recipient_id uuid not null references public.profiles(id), recipient_email text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  target_snapshot jsonb not null,
  status text not null default 'pending' check(status in ('pending','decided','revoked')),
  delivery_status text not null default 'prepared' check(delivery_status in ('prepared','accepted','failed','unknown')),
  provider_message_id text, approval_id uuid references public.removal_approvals(id),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '15 minutes'),
  decided_at timestamptz,
  check ((status='decided')=(approval_id is not null)),
  check ((status='decided')=(decided_at is not null))
);
create index on public.approval_email_requests(finding_id,created_at desc);
create index on public.approval_email_requests(recipient_id,created_at desc);
create index on public.approval_email_requests(approval_id);
alter table public.approval_email_requests enable row level security;
create policy administrator_read on public.approval_email_requests for select to authenticated using ((select public.offboard_is_admin()));
revoke all on public.approval_email_requests from anon,authenticated;
grant select on public.approval_email_requests to authenticated;
grant all on public.approval_email_requests to service_role;
alter table public.removal_approvals add column authorization_method text not null default 'dashboard' check(authorization_method in ('dashboard','email'));
alter table public.removal_approvals add column email_request_id uuid references public.approval_email_requests(id);
create unique index removal_approvals_email_once on public.removal_approvals(email_request_id) where email_request_id is not null;

create function public.offboard_finding_snapshot(p_finding_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('organizationId',i.organization_id,'organization',i.organization,
    'providerUserId',f.provider_user_id,'username',f.username,'grantType',f.grant_type,'resourceIdentifier',f.resource_identifier)
  from public.access_findings f join public.integrations i on i.id=f.integration_id where f.id=p_finding_id;
$$;

create function public.offboard_record_removal_decision(p_finding_id uuid,p_decision text,p_administrator_id uuid,p_method text,p_email_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := p_administrator_id; finding public.access_findings; identity_record public.provider_identities; integration_record public.integrations; snapshot jsonb; approval_identifier uuid;
begin
  if not exists(select 1 from public.profiles where id=actor and role='admin') or p_method not in ('dashboard','email') or ((p_method='email') is distinct from (p_email_request_id is not null)) then raise exception 'unauthorized_decision'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  select * into strict finding from public.access_findings where id=p_finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  select * into strict integration_record from public.integrations where id=finding.integration_id;
  if finding.status not in ('access_detected','access_remains','verification_failed') then raise exception 'finding_not_actionable'; end if;
  if p_decision='approved' and (identity_record.confirmed_at is null or identity_record.provider_user_id is distinct from finding.provider_user_id or cardinality(finding.protection_reasons)>0 or integration_record.organization_id is null or finding.last_seen_at < clock_timestamp()-interval '15 minutes') then raise exception 'unsafe_or_stale_target'; end if;
  snapshot := public.offboard_finding_snapshot(p_finding_id);
  update public.removal_approvals set status='expired' where finding_id=p_finding_id and status='approved' and expires_at<=now();
  insert into public.removal_approvals(finding_id,approved_by,status,target_snapshot,authorization_method,email_request_id) values(p_finding_id,actor,p_decision,snapshot,p_method,p_email_request_id) returning id into approval_identifier;
  -- A newer human decision invalidates every other outstanding review for this finding.
  update public.approval_email_requests set status='revoked' where finding_id=p_finding_id and status='pending' and id is distinct from p_email_request_id;
  if p_decision='approved' then
    insert into public.worker_jobs(kind,integration_id,case_id,approval_id,requested_by) values('execute_removal',finding.integration_id,finding.case_id,approval_identifier,actor);
    update public.access_findings set status='awaiting_approval' where id=p_finding_id;
  end if;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(finding.case_id,'removal_'||p_decision,'human',actor::text,jsonb_build_object('approvalId',approval_identifier,'target',snapshot,'authorizationMethod',p_method,'emailRequestId',p_email_request_id));
  return approval_identifier;
end $$;

create or replace function public.offboard_decide_removal(p_finding_id uuid,p_decision text) returns uuid language plpgsql security definer set search_path='' as $$
begin
  return public.offboard_record_removal_decision(p_finding_id,p_decision,public.offboard_require_admin(),'dashboard',null);
end $$;

create function public.offboard_request_approval_email(p_finding_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := public.offboard_require_admin(); finding public.access_findings; identity_record public.provider_identities;
  recipient text; request public.approval_email_requests;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_token_hash'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  select lower(u.email) into recipient from auth.users u join public.profiles p on p.id=u.id
    where u.id=actor and p.role='admin' and u.email_confirmed_at is not null and lower(u.email)=lower(p.email);
  if recipient is null then raise exception 'recipient_not_confirmed'; end if;
  select * into strict finding from public.access_findings where id=p_finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  if finding.status not in ('access_detected','access_remains','verification_failed') or cardinality(finding.protection_reasons)>0
    or identity_record.confirmed_at is null or identity_record.provider_user_id is distinct from finding.provider_user_id
    or finding.last_seen_at<clock_timestamp()-interval '15 minutes'
    or public.offboard_finding_snapshot(p_finding_id)->>'organizationId' is null then raise exception 'unsafe_or_stale_target'; end if;
  if exists(select 1 from public.approval_email_requests where recipient_id=actor and created_at>clock_timestamp()-interval '1 minute')
    then raise exception 'email_rate_limited'; end if;
  update public.approval_email_requests set status='revoked' where finding_id=p_finding_id and recipient_id=actor and status='pending';
  insert into public.approval_email_requests(finding_id,recipient_id,recipient_email,token_hash,target_snapshot)
    values(p_finding_id,actor,recipient,p_token_hash,public.offboard_finding_snapshot(p_finding_id)) returning * into request;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(finding.case_id,'approval_email_requested','human',actor::text,jsonb_build_object('requestId',request.id,'findingId',p_finding_id,'target',request.target_snapshot));
  return jsonb_build_object('id',request.id,'expiresAt',request.expires_at,'recipientEmail',recipient,'target',request.target_snapshot,
    'caseId',finding.case_id,'personName',(select full_name from public.offboarding_cases where id=finding.case_id));
end $$;

create function public.offboard_record_approval_email_delivery(p_request_id uuid,p_status text,p_provider_message_id text) returns void language plpgsql security definer set search_path='' as $$
declare request public.approval_email_requests;
begin
  if p_status not in ('accepted','failed','unknown') or (p_status='accepted' and length(coalesce(p_provider_message_id,'')) not between 1 and 200) then raise exception 'invalid_delivery'; end if;
  update public.approval_email_requests set delivery_status=p_status,provider_message_id=p_provider_message_id
    where id=p_request_id and delivery_status='prepared' and status='pending' returning * into request;
  if not found then return; end if;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
    select f.case_id,'approval_email_'||p_status,'system','email_delivery',jsonb_build_object('requestId',request.id,'providerMessageId',p_provider_message_id)
    from public.access_findings f where f.id=request.finding_id;
end $$;

create function public.offboard_review_email_request(p_request_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
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
    'target',request.target_snapshot,'personName',(select full_name from public.offboarding_cases where id=finding.case_id),
    'actionable',finding.status in ('access_detected','access_remains','verification_failed') and cardinality(finding.protection_reasons)=0
      and finding.last_seen_at>clock_timestamp()-interval '15 minutes'
      and exists(select 1 from public.provider_identities where id=finding.identity_id and confirmed_at is not null and provider_user_id=finding.provider_user_id));
end $$;

create function public.offboard_decide_email_request(p_request_id uuid,p_token_hash text,p_decision text) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.approval_email_requests; result uuid;
begin
  -- Consistent lock order with request creation: finding, then email capability.
  perform 1 from public.access_findings where id=(select finding_id from public.approval_email_requests where id=p_request_id) for update;
  select * into strict request from public.approval_email_requests where id=p_request_id for update;
  perform public.offboard_review_email_request(p_request_id,p_token_hash);
  result := public.offboard_record_removal_decision(request.finding_id,p_decision,request.recipient_id,'email',request.id);
  update public.approval_email_requests set status='decided',approval_id=result,decided_at=clock_timestamp() where id=request.id;
  return result;
end $$;

revoke all on function public.offboard_finding_snapshot(uuid),public.offboard_record_removal_decision(uuid,text,uuid,text,uuid),public.offboard_request_approval_email(uuid,text),public.offboard_record_approval_email_delivery(uuid,text,text),public.offboard_review_email_request(uuid,text),public.offboard_decide_email_request(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.offboard_request_approval_email(uuid,text) to authenticated;
grant execute on function public.offboard_record_approval_email_delivery(uuid,text,text),public.offboard_review_email_request(uuid,text),public.offboard_decide_email_request(uuid,text,text) to service_role;
