-- Single-workspace MVP. Browser users read through RLS; writes use narrow RPCs.
create table public.profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);
create function public.offboard_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create table public.offboarding_cases (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  departure_on date not null,
  status text not null default 'open' check (status in ('open','investigating','needs_review','partially_verified','verification_failed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.provider_identities (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.offboarding_cases(id),
  provider text not null default 'github' check (provider = 'github'),
  username text not null check (username ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
  provider_user_id text check (provider_user_id ~ '^[1-9][0-9]*$'),
  confirmed_by uuid references public.profiles(id), confirmed_at timestamptz,
  unique(case_id,provider), check ((confirmed_by is null) = (confirmed_at is null)),
  check (confirmed_at is null or provider_user_id is not null)
);
create table public.integrations (
  id uuid primary key default gen_random_uuid(), provider text not null check (provider = 'github'),
  organization text not null check (organization ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
  organization_id text check (organization_id ~ '^[1-9][0-9]*$'),
  status text not null default 'not_connected' check (status in ('not_connected','connected','failed')),
  permissions jsonb not null default '{}', last_checked_at timestamptz, last_successful_check_at timestamptz,
  last_error text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create unique index integrations_scope on public.integrations(provider,lower(organization));
create table public.worker_jobs (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('check_integration','scan','execute_removal')),
  integration_id uuid not null references public.integrations(id), case_id uuid references public.offboarding_cases(id),
  approval_id uuid, requested_by uuid not null references public.profiles(id),
  request_origin text not null default 'dashboard' check (request_origin in ('dashboard','switch')),
  room_context jsonb, status text not null default 'queued' check (status in ('queued','leased','succeeded','failed','uncertain')),
  lease_token uuid, lease_expires_at timestamptz, worker_id uuid, attempts integer not null default 0,
  execution_started boolean not null default false, error_code text,
  created_at timestamptz not null default now(), completed_at timestamptz,
  check ((kind = 'check_integration' and case_id is null) or (kind <> 'check_integration' and case_id is not null))
);
create index worker_jobs_queue on public.worker_jobs(created_at) where status = 'queued';
create unique index worker_jobs_active_scan on public.worker_jobs(case_id,integration_id) where kind = 'scan' and status in ('queued','leased');
create unique index worker_jobs_active_connection on public.worker_jobs(integration_id) where kind = 'check_integration' and status in ('queued','leased');
create table public.scan_runs (
  id uuid primary key default gen_random_uuid(), job_id uuid not null unique references public.worker_jobs(id),
  case_id uuid not null references public.offboarding_cases(id), integration_id uuid not null references public.integrations(id),
  provider_user_id text, outcome text not null check (outcome in ('succeeded','failed')),
  evidence jsonb not null, created_at timestamptz not null default now()
);
create table public.access_findings (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.offboarding_cases(id),
  integration_id uuid not null references public.integrations(id), identity_id uuid not null references public.provider_identities(id),
  provider_user_id text not null, username text not null,
  grant_type text not null check (grant_type in ('organization_membership','outside_collaborator')),
  resource_identifier text not null,
  protection_reasons text[] not null default '{}',
  status text not null default 'access_detected' check (status in ('access_detected','awaiting_approval','removal_in_progress','verified_removed','access_remains','verification_failed','not_detected')),
  evidence jsonb not null, latest_scan_id uuid not null references public.scan_runs(id),
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), verified_at timestamptz,
  unique(case_id,integration_id,provider_user_id,grant_type,resource_identifier)
);
create table public.removal_approvals (
  id uuid primary key default gen_random_uuid(), finding_id uuid not null references public.access_findings(id),
  approved_by uuid not null references public.profiles(id),
  status text not null check (status in ('approved','rejected','consumed','expired')),
  target_snapshot jsonb not null, created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'), consumed_at timestamptz
);
create unique index removal_approvals_one_active on public.removal_approvals(finding_id) where status = 'approved';
alter table public.worker_jobs add constraint worker_jobs_approval_fk foreign key(approval_id) references public.removal_approvals(id);
create unique index worker_jobs_approval_once on public.worker_jobs(approval_id) where approval_id is not null;
create table public.removal_operations (
  id uuid primary key default gen_random_uuid(), approval_id uuid not null unique references public.removal_approvals(id),
  finding_id uuid not null references public.access_findings(id), job_id uuid not null unique references public.worker_jobs(id),
  action text not null check(action in ('organization_membership','outside_collaborator')),
  status text not null check (status in ('executing','verified_removed','access_remains','verification_failed','uncertain')),
  preflight jsonb not null, provider_response jsonb, verification jsonb,
  attempted_at timestamptz not null default now(), verified_at timestamptz
);
create table public.verification_reports (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.offboarding_cases(id),
  job_id uuid not null unique references public.worker_jobs(id), kind text not null check (kind in ('investigation','removal')),
  outcome text not null check (outcome in ('access_detected','not_detected','verified_removed','access_remains','verification_failed','uncertain')),
  coverage_status text not null check (coverage_status in ('partially_verified','not_checked')),
  evidence jsonb not null, created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), case_id uuid references public.offboarding_cases(id),
  event_type text not null, actor_type text not null check (actor_type in ('human','worker','system','agent')),
  actor_id text not null, data jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.worker_heartbeats (
  worker_id uuid primary key, last_seen_at timestamptz not null default now()
);

-- Index foreign keys used by authorization, case timelines, and relationship queries.
create index on public.offboarding_cases(created_by);
create index on public.provider_identities(confirmed_by);
create index on public.integrations(created_by);
create index on public.worker_jobs(integration_id);
create index on public.worker_jobs(case_id);
create index on public.worker_jobs(requested_by);
create index on public.scan_runs(case_id,created_at desc);
create index on public.scan_runs(integration_id);
create index on public.access_findings(identity_id);
create index on public.access_findings(integration_id);
create index on public.access_findings(latest_scan_id);
create index on public.removal_approvals(approved_by);
create index on public.removal_approvals(finding_id,created_at desc);
create index on public.removal_operations(finding_id);
create index on public.verification_reports(case_id,created_at desc);
create index on public.audit_events(case_id,created_at desc);

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.offboard_is_admin()));
do $$ declare table_name text; begin
  foreach table_name in array array['offboarding_cases','provider_identities','integrations','worker_jobs','scan_runs','access_findings','removal_approvals','removal_operations','verification_reports','audit_events','worker_heartbeats'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select public.offboard_is_admin()))', table_name);
  end loop;
end $$;
revoke all on public.profiles, public.offboarding_cases, public.provider_identities, public.integrations, public.worker_jobs, public.scan_runs, public.access_findings, public.removal_approvals, public.removal_operations, public.verification_reports, public.audit_events, public.worker_heartbeats from anon, authenticated;
grant select on public.profiles, public.offboarding_cases, public.provider_identities, public.integrations, public.worker_jobs, public.scan_runs, public.access_findings, public.removal_approvals, public.removal_operations, public.verification_reports, public.audit_events, public.worker_heartbeats to authenticated;
grant all on public.profiles, public.offboarding_cases, public.provider_identities, public.integrations, public.worker_jobs, public.scan_runs, public.access_findings, public.removal_approvals, public.removal_operations, public.verification_reports, public.audit_events, public.worker_heartbeats to service_role;

create function public.offboard_require_admin() returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.offboard_is_admin() then raise exception 'administrator_required' using errcode = '42501'; end if;
  return auth.uid();
end $$;
create function public.offboard_create_case(p_name text, p_departure date, p_username text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); case_identifier uuid;
begin
  insert into public.offboarding_cases(full_name,departure_on,created_by) values(trim(p_name),p_departure,actor) returning id into case_identifier;
  insert into public.provider_identities(case_id,username) values(case_identifier,trim(p_username));
  insert into public.audit_events(case_id,event_type,actor_type,actor_id) values(case_identifier,'case_created','human',actor::text);
  return case_identifier;
end $$;
create function public.offboard_connect_github(p_organization text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); integration_identifier uuid;
begin
  insert into public.integrations(provider,organization,created_by) values('github',trim(p_organization),actor)
  on conflict (provider,lower(organization)) do update set organization = excluded.organization returning id into integration_identifier;
  insert into public.worker_jobs(kind,integration_id,requested_by) values('check_integration',integration_identifier,actor) on conflict do nothing;
  insert into public.audit_events(event_type,actor_type,actor_id,data) values('integration_check_requested','human',actor::text,jsonb_build_object('integrationId',integration_identifier));
  return integration_identifier;
end $$;
create function public.offboard_request_scan(p_case_id uuid, p_integration_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); job_identifier uuid;
begin
  if not exists(select 1 from public.offboarding_cases where id=p_case_id) or not exists(select 1 from public.integrations where id=p_integration_id) then raise exception 'unknown_scope'; end if;
  insert into public.worker_jobs(kind,case_id,integration_id,requested_by) values('scan',p_case_id,p_integration_id,actor) returning id into job_identifier;
  update public.offboarding_cases set status='investigating', updated_at=now() where id=p_case_id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(p_case_id,'scan_requested','human',actor::text,jsonb_build_object('jobId',job_identifier));
  return job_identifier;
end $$;
create function public.offboard_confirm_identity(p_identity_id uuid, p_provider_user_id text) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); identity_record public.provider_identities;
begin
  select * into strict identity_record from public.provider_identities where id=p_identity_id for update;
  if identity_record.provider_user_id is null or identity_record.provider_user_id <> p_provider_user_id then raise exception 'identity_not_resolved_or_mismatch'; end if;
  update public.provider_identities set confirmed_by=actor,confirmed_at=now() where id=p_identity_id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(identity_record.case_id,'identity_confirmed','human',actor::text,jsonb_build_object('identityId',p_identity_id,'providerUserId',p_provider_user_id));
end $$;
create function public.offboard_decide_removal(p_finding_id uuid, p_decision text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.offboard_require_admin(); finding public.access_findings; identity_record public.provider_identities; integration_record public.integrations; snapshot jsonb; approval_identifier uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  select * into strict finding from public.access_findings where id=p_finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  select * into strict integration_record from public.integrations where id=finding.integration_id;
  if finding.status not in ('access_detected','access_remains','verification_failed') then raise exception 'finding_not_actionable'; end if;
  if p_decision='approved' and (identity_record.confirmed_at is null or identity_record.provider_user_id <> finding.provider_user_id or cardinality(finding.protection_reasons)>0 or integration_record.organization_id is null or finding.last_seen_at < now()-interval '15 minutes') then raise exception 'unsafe_or_stale_target'; end if;
  snapshot := jsonb_build_object('organizationId',integration_record.organization_id,'organization',integration_record.organization,'providerUserId',finding.provider_user_id,'username',finding.username,'grantType',finding.grant_type,'resourceIdentifier',finding.resource_identifier);
  update public.removal_approvals set status='expired' where finding_id=p_finding_id and status='approved' and expires_at<=now();
  insert into public.removal_approvals(finding_id,approved_by,status,target_snapshot) values(p_finding_id,actor,p_decision,snapshot) returning id into approval_identifier;
  if p_decision='approved' then
    insert into public.worker_jobs(kind,integration_id,case_id,approval_id,requested_by) values('execute_removal',finding.integration_id,finding.case_id,approval_identifier,actor);
    update public.access_findings set status='awaiting_approval' where id=p_finding_id;
  end if;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data) values(finding.case_id,'removal_'||p_decision,'human',actor::text,jsonb_build_object('approvalId',approval_identifier,'target',snapshot));
  return approval_identifier;
end $$;

-- A leased mutation is never retried. An ambiguous crash stays unresolved.
create function public.offboard_claim_job(p_worker_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; integration_record public.integrations; identity_record public.provider_identities; snapshot jsonb;
begin
  insert into public.worker_heartbeats(worker_id) values(p_worker_id) on conflict(worker_id) do update set last_seen_at=now();
  for job in select * from public.worker_jobs where status='leased' and lease_expires_at<now() for update skip locked loop
    if job.kind='execute_removal' then
      update public.worker_jobs set status='uncertain',error_code='lease_expired_no_retry',completed_at=now() where id=job.id;
      update public.removal_operations set status='uncertain' where job_id=job.id;
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

create function public.offboard_begin_removal(p_job_id uuid,p_lease_token uuid,p_preflight jsonb) returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; approval public.removal_approvals; finding public.access_findings; identity_record public.provider_identities; matching jsonb;
begin
  select * into strict job from public.worker_jobs where id=p_job_id for update;
  if job.kind<>'execute_removal' or job.status<>'leased' or job.lease_token is distinct from p_lease_token or job.lease_expires_at<=now() or job.execution_started then raise exception 'invalid_job_lease'; end if;
  select * into strict approval from public.removal_approvals where id=job.approval_id for update;
  select * into strict finding from public.access_findings where id=approval.finding_id for update;
  select * into strict identity_record from public.provider_identities where id=finding.identity_id;
  if approval.status<>'approved' or approval.expires_at<=now() or approval.consumed_at is not null or not exists(select 1 from public.profiles where id=approval.approved_by and role='admin') then raise exception 'invalid_approval'; end if;
  if identity_record.confirmed_at is null or identity_record.provider_user_id is distinct from approval.target_snapshot->>'providerUserId' or cardinality(finding.protection_reasons)>0 then raise exception 'unsafe_identity'; end if;
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

create function public.offboard_finish_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare job public.worker_jobs; integration_record public.integrations; identity_record public.provider_identities; scan jsonb; observed jsonb; scan_identifier uuid; approval public.removal_approvals; outcome text; coverage text; finding_identifier uuid;
begin
  select * into strict job from public.worker_jobs where id=p_job_id for update;
  if job.status in ('succeeded','failed') and job.lease_token=p_lease_token then return; end if;
  if job.status<>'leased' or job.lease_token is distinct from p_lease_token or job.lease_expires_at<=now() then raise exception 'invalid_job_lease'; end if;
  select * into strict integration_record from public.integrations where id=job.integration_id;
  if p_result->>'type'='failure' then
    update public.worker_jobs set status=case when execution_started then 'uncertain' else 'failed' end,error_code=p_result->>'code',completed_at=now() where id=job.id;
    update public.integrations set status='failed',last_checked_at=now(),last_error=p_result->>'code' where id=job.integration_id;
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
    if scan is not null and scan<>'null'::jsonb and scan#>>'{target,id}'=approval.target_snapshot->>'providerUserId' and scan#>>'{organization,id}'=approval.target_snapshot->>'organizationId' then
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

-- SECURITY DEFINER functions are not public APIs until explicitly granted.
do $$ declare signature text; begin
  for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'offboard_%' loop
    execute 'revoke all on function ' || signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || signature || ' to service_role';
  end loop;
end $$;
grant execute on function public.offboard_is_admin(), public.offboard_create_case(text,date,text), public.offboard_connect_github(text), public.offboard_request_scan(uuid,uuid), public.offboard_confirm_identity(uuid,text), public.offboard_decide_removal(uuid,text) to authenticated;
