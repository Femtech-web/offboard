-- Verification belongs to the observed grant. Rediscovered access cannot inherit
-- the successful-removal timestamp of an earlier grant; old reports remain intact.
create function public.offboard_clear_rediscovered_verification() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.latest_scan_id is distinct from old.latest_scan_id
    and new.status in ('access_detected','awaiting_approval','removal_in_progress','access_remains') then
    new.verified_at := null;
  end if;
  return new;
end $$;

create trigger clear_rediscovered_verification before update of latest_scan_id
  on public.access_findings for each row
  execute function public.offboard_clear_rediscovered_verification();

revoke all on function public.offboard_clear_rediscovered_verification()
  from public,anon,authenticated,service_role;

update public.access_findings set verified_at=null
  where status in ('access_detected','awaiting_approval','removal_in_progress','access_remains')
    and verified_at is not null and last_seen_at>verified_at;
