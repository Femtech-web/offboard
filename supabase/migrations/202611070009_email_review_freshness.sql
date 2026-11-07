-- Keep a still-valid private review backed by a fresh, real provider scan.
-- This can queue one read-only refresh per email; it cannot approve or execute removal.
alter table public.worker_jobs drop constraint worker_jobs_request_origin_check;
alter table public.worker_jobs add constraint worker_jobs_request_origin_check check(request_origin in ('dashboard','switch','email_review'));
alter table public.worker_jobs add column review_email_request_id uuid references public.approval_email_requests(id);
create unique index worker_jobs_email_refresh_once on public.worker_jobs(review_email_request_id) where review_email_request_id is not null;

create function public.offboard_refresh_pending_email_scans() returns void language plpgsql security definer set search_path='' as $$
declare review record; job_identifier uuid;
begin
  for review in
    select r.id,r.recipient_id,f.case_id,f.integration_id from public.approval_email_requests r
    join public.access_findings f on f.id=r.finding_id
    join public.profiles p on p.id=r.recipient_id and p.role='admin'
    join auth.users u on u.id=p.id and u.email_confirmed_at is not null and lower(u.email)=r.recipient_email and lower(p.email)=r.recipient_email
    where r.status='pending' and r.delivery_status='accepted' and r.expires_at>clock_timestamp()
      and f.status in ('access_detected','access_remains','verification_failed') and cardinality(f.protection_reasons)=0
      and f.last_seen_at<clock_timestamp()-interval '10 minutes'
      and r.target_snapshot=public.offboard_finding_snapshot(f.id)
      and not exists(select 1 from public.worker_jobs where review_email_request_id=r.id)
    order by r.created_at for update of f skip locked limit 10
  loop
    if not exists(select 1 from public.worker_jobs where case_id=review.case_id and integration_id=review.integration_id
      and kind in ('scan','execute_removal') and status in ('queued','leased')) then
      insert into public.worker_jobs(kind,case_id,integration_id,requested_by,request_origin,review_email_request_id)
        values('scan',review.case_id,review.integration_id,review.recipient_id,'email_review',review.id)
        on conflict do nothing returning id into job_identifier;
      if job_identifier is not null then
        insert into public.audit_events(case_id,event_type,actor_type,actor_id,data)
          values(review.case_id,'email_review_scan_requested','system','email_review_refresh',jsonb_build_object('jobId',job_identifier,'emailRequestId',review.id,'approvalGranted',false));
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.offboard_refresh_pending_email_scans() from public,anon,authenticated,service_role;

create or replace function public.offboard_claim_email_dispatch() returns jsonb language plpgsql security definer set search_path='' as $$
declare dispatch public.approval_email_dispatches;
begin
  perform public.offboard_refresh_pending_email_scans();
  -- No automatic retry after a possible send or a crashed sender.
  update public.approval_email_dispatches set status='unknown',completed_at=clock_timestamp()
    where status='processing' and started_at<clock_timestamp()-interval '1 minute';
  select * into dispatch from public.approval_email_dispatches where status='queued' order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.approval_email_dispatches set status='processing',started_at=clock_timestamp() where id=dispatch.id;
  return jsonb_build_object('id',dispatch.id,'findingId',dispatch.finding_id,'recipientId',dispatch.recipient_id);
end $$;

