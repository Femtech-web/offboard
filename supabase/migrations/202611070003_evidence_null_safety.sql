-- Validate complete checked scope before evidence can establish absence.
create or replace function public.offboard_scan_complete(p_scan jsonb) returns boolean language plpgsql volatile set search_path = '' as $$
begin
  if p_scan is null or jsonb_typeof(p_scan) is distinct from 'object' or jsonb_typeof(p_scan->'coverage') is distinct from 'array' or jsonb_typeof(p_scan->'findings') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_scan->'coverage')<>3 or (select count(distinct value->>'source') from jsonb_array_elements(p_scan->'coverage') where value->>'source' in ('organization_membership','organization_owners','outside_collaborator') and value->>'outcome'='checked')<>3 then return false; end if;
  if p_scan#>>'{target,login}' is null or p_scan#>>'{organization,login}' is null or p_scan#>>'{target,id}' is null or p_scan#>>'{organization,id}' is null or p_scan->>'startedAt' is null or p_scan->>'completedAt' is null then return false; end if;
  if (p_scan->>'completedAt')::timestamptz < (p_scan->>'startedAt')::timestamptz or (p_scan->>'completedAt')::timestamptz > clock_timestamp()+interval '5 seconds' then return false; end if;
  if exists(select 1 from jsonb_array_elements(p_scan->'findings') where value->>'providerUserId' is distinct from p_scan#>>'{target,id}' or value->>'resourceIdentifier' is distinct from 'github:organization:'||(p_scan#>>'{organization,id}') or jsonb_typeof(value->'protectionReasons') is distinct from 'array') then return false; end if;
  return true;
exception when others then return false;
end $$;

