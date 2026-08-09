-- The pre-tenancy global role assignment cannot choose a Library Room and is
-- intentionally unavailable. Keep its compatibility signature fail-closed so
-- static database analysis does not retain obsolete DML against old keys.

create or replace function public.admin_assign_role(
  p_target_profile_id uuid,
  p_role_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'GS_LEGACY_GLOBAL_ADMIN_DISABLED';
end;
$$;

revoke execute on function public.admin_assign_role(uuid,text) from public, anon, authenticated, service_role;
