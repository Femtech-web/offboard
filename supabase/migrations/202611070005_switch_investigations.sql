-- Only the trusted local adapter may attest Switch context. No approval capability.
create unique index worker_jobs_switch_message_once
  on public.worker_jobs ((room_context->>'roomId'), (room_context->>'messageId'))
  where request_origin='switch';

create function public.offboard_switch_request_scan(
  p_case_id uuid, p_integration_id uuid, p_administrator_id uuid, p_context jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare job_identifier uuid;
begin
  if not exists(select 1 from public.profiles where id=p_administrator_id and role='admin')
    or not exists(select 1 from public.integrations where id=p_integration_id and provider='github')
    or jsonb_typeof(p_context) is distinct from 'object'
    or coalesce(p_context->>'roomId','') !~ '^[0-9a-f-]{36}$'
    or coalesce(p_context->>'agentId','') !~ '^[0-9a-f-]{36}$'
    or coalesce(p_context->>'messageId','') !~ '^sw_[a-f0-9]{32}$'
    or length(coalesce(p_context->>'senderId','')) not between 1 and 250
  then raise exception 'switch_request_denied'; end if;
  -- Serialize scan creation against case decisions and another request for this case.
  perform 1 from public.offboarding_cases where id=p_case_id for update;
  if not found then raise exception 'unknown_scope'; end if;
  select id into job_identifier from public.worker_jobs
    where request_origin='switch' and room_context->>'roomId'=p_context->>'roomId'
    and room_context->>'messageId'=p_context->>'messageId';
  if found then
    if not exists(select 1 from public.worker_jobs where id=job_identifier and case_id=p_case_id and integration_id=p_integration_id)
      then raise exception 'switch_message_reused'; end if;
    return job_identifier;
  end if;
  if exists(select 1 from public.worker_jobs where case_id=p_case_id and integration_id=p_integration_id
    and kind in ('scan','execute_removal') and status in ('queued','leased'))
    then raise exception 'case_work_pending'; end if;
  insert into public.worker_jobs(kind,case_id,integration_id,requested_by,request_origin,room_context)
    values('scan',p_case_id,p_integration_id,p_administrator_id,'switch',p_context) returning id into job_identifier;
  update public.offboarding_cases set status='investigating',updated_at=now() where id=p_case_id;
  insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
    values(p_case_id,'switch_investigation_requested','agent',p_context->>'agentId',
      jsonb_build_object('jobId',job_identifier,'source',p_context,'approvalGranted',false));
  return job_identifier;
end $$;
revoke all on function public.offboard_switch_request_scan(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.offboard_switch_request_scan(uuid,uuid,uuid,jsonb) to service_role;
