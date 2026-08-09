-- Extend the administrator audit read model without widening table access.
drop function if exists public.admin_audit_events(text, text);

create or replace function public.admin_audit_events(
  p_action text default null,
  p_target_type text default null,
  p_actor_profile_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(id uuid, actor_name text, action text, target_type text, target_id uuid, occurred_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = '' as $$
  select e.id, p.display_name, e.action, e.target_type, e.target_id, e.occurred_at, e.metadata
  from public.audit_events e
  left join public.profiles p on p.id = e.actor_profile_id
  where private.is_administrator()
    and (nullif(btrim(p_action), '') is null or e.action ilike '%' || p_action || '%')
    and (nullif(btrim(p_target_type), '') is null or e.target_type = p_target_type)
    and (p_actor_profile_id is null or e.actor_profile_id = p_actor_profile_id)
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at < p_to + interval '1 day')
  order by e.occurred_at desc
  limit 500;
$$;

revoke all on function public.admin_audit_events(text, text, uuid, timestamptz, timestamptz) from public, anon, service_role;
grant execute on function public.admin_audit_events(text, text, uuid, timestamptz, timestamptz) to authenticated;
