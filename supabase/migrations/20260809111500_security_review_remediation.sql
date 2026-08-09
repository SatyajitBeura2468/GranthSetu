-- Close the final cross-room authorization and bounded-read findings identified
-- during the V3 diff security review. This migration also repairs already-
-- migrated Development databases; fresh databases receive the same definitions
-- from 20260809095019_final_global_room_hardening.sql.

create or replace function public.admin_assign_operator_to_room(
  p_library_code text, p_target_auth_user_id uuid, p_display_name text, p_role_key text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_profile uuid; v_profile_status text; v_role uuid;
begin
  v_library := private.require_library_access(p_library_code,'administrator');
  v_actor := private.require_administrator();
  if p_target_auth_user_id is null or char_length(btrim(coalesce(p_display_name,''))) not between 2 and 160
    or p_role_key not in ('administrator','librarian') then
    raise exception using errcode='22023',message='GS_OPERATOR_INPUT_INVALID';
  end if;
  if not exists(select 1 from auth.users where id=p_target_auth_user_id) then
    raise exception using errcode='22023',message='GS_AUTH_USER_NOT_FOUND';
  end if;
  select id,status into v_profile,v_profile_status from public.profiles where auth_user_id=p_target_auth_user_id for update;
  if v_profile is null then
    insert into public.profiles(auth_user_id,display_name,status)
    values(p_target_auth_user_id,btrim(p_display_name),'active') returning id into v_profile;
  elsif v_profile_status <> 'active' then
    raise exception using errcode='42501',message='GS_PROFILE_INACTIVE';
  end if;
  select id into v_role from public.roles where role_key=p_role_key;
  insert into public.profile_roles(profile_id,library_id,role_id,assigned_by_profile_id,status)
  values(v_profile,v_library,v_role,v_actor,'active')
  on conflict(profile_id,library_id,role_id) do update set status='active',assigned_by_profile_id=v_actor;
  perform private.admin_audit(v_actor,'security.operator_assigned','profile',v_profile,jsonb_build_object('role_key',p_role_key));
  return v_profile;
end;
$$;

create or replace function public.operator_room_audit(
  p_library_code text, p_action text default null, p_from date default null,
  p_to date default null, p_actor text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code,'administrator');
  if p_from is not null and p_to is not null and p_from>p_to then raise exception using errcode='22023',message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'time',to_char(q.occurred_at at time zone 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS'),'actor',q.actor_name,'action',q.action,'entity',q.target_type,'target',coalesce(q.metadata->>'title',q.target_id::text,'—'),'result','Success') order by q.occurred_at desc),'[]'::jsonb)
  into v_result from (
    select e.id,e.occurred_at,coalesce(p.display_name,'System') as actor_name,e.action,e.target_type,e.target_id,e.metadata
    from public.audit_events e left join public.profiles p on p.id=e.actor_profile_id
    where e.library_id=v_library and (nullif(btrim(coalesce(p_action,'')),'') is null or e.action ilike '%'||btrim(p_action)||'%')
      and (p_from is null or e.occurred_at::date>=p_from) and (p_to is null or e.occurred_at::date<=p_to)
      and (nullif(btrim(coalesce(p_actor,'')),'') is null or coalesce(p.display_name,'System') ilike '%'||btrim(p_actor)||'%')
    order by e.occurred_at desc
    limit 500
  ) q;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

-- Legacy global-profile administrator entrypoints predate room tenancy and may
-- never be reachable by a room-local administrator.
revoke execute on function public.admin_provision_operator_profile(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.admin_assign_role(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_role(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_set_profile_status(uuid,text) from public, anon, authenticated;

grant execute on function public.admin_assign_operator_to_room(text,uuid,text,text) to authenticated;
grant execute on function public.operator_room_audit(text,text,date,date,text) to authenticated;
