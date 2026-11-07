-- Reviewers receive selected case evidence through one read-only function.
-- Existing administrator RLS and every mutation function remain unchanged.
create table public.reviewer_case_access (
  reviewer_id uuid not null references public.profiles(id),
  case_id uuid not null references public.offboarding_cases(id),
  expires_at timestamptz not null,
  primary key (reviewer_id, case_id)
);
create index reviewer_case_access_case on public.reviewer_case_access(case_id);
alter table public.reviewer_case_access enable row level security;
revoke all on public.reviewer_case_access from anon, authenticated;
grant all on public.reviewer_case_access to service_role;

create function public.offboard_can_review() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    join public.reviewer_case_access a on a.reviewer_id = p.id
    where p.id = (select auth.uid()) and p.role = 'viewer'
      and u.email_confirmed_at is not null and lower(u.email) = lower(p.email)
      and a.expires_at > now()
  );
$$;

create function public.offboard_review_workspace() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.offboard_can_review() then
    raise exception 'reviewer_access_required' using errcode = '42501';
  end if;
  with authorized_cases as materialized (
    select c.* from public.offboarding_cases c
    join public.reviewer_case_access a on a.case_id = c.id
    where a.reviewer_id = (select auth.uid()) and a.expires_at > now()
  ), authorized_findings as materialized (
    select f.* from public.access_findings f
    join authorized_cases c on c.id = f.case_id
  )
  select jsonb_build_object(
    'cases', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) from authorized_cases c),
    'identities', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.provider_identities i join authorized_cases c on c.id = i.case_id),
    'integrations', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.integrations i where exists (
      select 1 from public.worker_jobs j join authorized_cases c on c.id = j.case_id where j.integration_id = i.id
    )),
    'findings', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from authorized_findings f),
    'approvals', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.removal_approvals a join authorized_findings f on f.id = a.finding_id),
    'operations', (select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from public.removal_operations o join authorized_findings f on f.id = o.finding_id),
    'reports', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) from public.verification_reports r join authorized_cases c on c.id = r.case_id),
    'events', (select coalesce(jsonb_agg(
      (to_jsonb(e) - 'data') || jsonb_build_object('data', jsonb_strip_nulls(jsonb_build_object('kind', e.data->>'kind')))
      order by e.created_at desc
    ), '[]'::jsonb) from public.audit_events e join authorized_cases c on c.id = e.case_id),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'request_origin', j.request_origin, 'room_context', j.room_context,
      'approval_id', j.approval_id, 'kind', j.kind, 'case_id', j.case_id,
      'integration_id', j.integration_id, 'status', j.status, 'error_code', j.error_code,
      'created_at', j.created_at, 'completed_at', j.completed_at, 'execution_started', j.execution_started
    ) order by j.created_at desc), '[]'::jsonb) from public.worker_jobs j join authorized_cases c on c.id = j.case_id)
  ) into result;
  -- No job leases, heartbeat identities, mail recipients, token hashes or private links.
  return result;
end;
$$;
revoke all on function public.offboard_can_review(), public.offboard_review_workspace() from public, anon;
grant execute on function public.offboard_can_review(), public.offboard_review_workspace() to authenticated;
