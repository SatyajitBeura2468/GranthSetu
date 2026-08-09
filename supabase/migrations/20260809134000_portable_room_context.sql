-- PostgreSQL versions without min(uuid) still need deterministic single-room
-- fallback resolution for authenticated operators.

create or replace function private.request_library_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_setting text;
  v_library uuid;
  v_count integer;
begin
  v_setting := nullif(current_setting('granthsetu.library_id', true), '');
  if v_setting is not null then
    return v_setting::uuid;
  end if;

  if (select auth.uid()) is null and current_user in ('postgres', 'supabase_admin', 'service_role') then
    return '10000000-0000-0000-0000-000000000001'::uuid;
  end if;

  select count(distinct pr.library_id), min(pr.library_id::text)::uuid
    into v_count, v_library
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
  join public.roles r on r.id = pr.role_id
  join public.libraries l on l.id = pr.library_id and l.status = 'active'
  where p.auth_user_id = (select auth.uid())
    and p.status = 'active'
    and r.role_key in ('administrator', 'librarian');

  if v_count = 1 then return v_library; end if;
  if v_count > 1 then
    raise exception using errcode = '22023', message = 'GS_LIBRARY_CONTEXT_REQUIRED';
  end if;
  return null;
end;
$$;

revoke all on function private.request_library_id() from public, anon, service_role;
grant execute on function private.request_library_id() to authenticated;
