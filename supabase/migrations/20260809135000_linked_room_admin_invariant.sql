-- Only linked authentication identities can keep a Library Room
-- administrable. Synthetic or orphaned profiles must not satisfy the final
-- room-administrator invariant.

create or replace function public.admin_set_room_operator_status(
  p_library_code text, p_target_profile_id uuid, p_status text
)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_admin uuid; v_active_admins integer; v_changed integer;
begin
  v_library := private.require_library_access(p_library_code,'administrator');
  v_actor := private.require_administrator();
  if p_status not in ('active','inactive') then raise exception using errcode='22023',message='GS_STATUS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_library::text, 73918421));
  select id into v_admin from public.roles where role_key='administrator';
  if p_status='inactive' and exists(select 1 from public.profile_roles where profile_id=p_target_profile_id and library_id=v_library and role_id=v_admin and status='active') then
    select count(distinct pr.profile_id) into v_active_admins from public.profile_roles pr join public.profiles p on p.id=pr.profile_id
    where pr.library_id=v_library and pr.role_id=v_admin and pr.status='active' and p.status='active' and p.auth_user_id is not null;
    if v_active_admins <= 1 then raise exception using errcode='42501',message='GS_LAST_ROOM_ADMIN'; end if;
  end if;
  update public.profile_roles set status=p_status where profile_id=p_target_profile_id and library_id=v_library and status<>p_status;
  get diagnostics v_changed=row_count;
  if v_changed>0 then perform private.admin_audit(v_actor,'security.operator_status_changed','profile',p_target_profile_id,jsonb_build_object('status',p_status)); end if;
  return v_changed>0;
end;
$$;

revoke execute on function public.admin_set_room_operator_status(text,uuid,text) from public, anon, service_role;
grant execute on function public.admin_set_room_operator_status(text,uuid,text) to authenticated;
