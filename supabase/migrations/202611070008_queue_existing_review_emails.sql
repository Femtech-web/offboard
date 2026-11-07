-- Enable automatic review for genuine, recent findings saved before the email queue existed.
-- Never refresh timestamps or manufacture scan evidence during rollout.
insert into public.approval_email_dispatches(scan_job_id,finding_id,recipient_id)
select j.id,f.id,p.id
from public.access_findings f
join public.scan_runs s on s.id=f.latest_scan_id and s.outcome='succeeded'
join public.worker_jobs j on j.id=s.job_id and j.kind='scan' and j.status='succeeded'
join public.profiles p on p.id=j.requested_by and p.role='admin'
join auth.users u on u.id=p.id and u.email_confirmed_at is not null and lower(u.email)=lower(p.email)
where f.status in ('access_detected','access_remains','verification_failed')
  and f.last_seen_at>clock_timestamp()-interval '15 minutes'
  and cardinality(f.protection_reasons)=0
  and not exists(select 1 from public.approval_email_requests r where r.finding_id=f.id and r.recipient_id=p.id
    and r.status='pending' and r.expires_at>clock_timestamp())
on conflict do nothing;
