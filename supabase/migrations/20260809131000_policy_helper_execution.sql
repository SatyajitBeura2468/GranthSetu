-- Tenant SELECT policies evaluate this non-API private helper as the
-- authenticated caller. Grant only the execution right required by RLS.

revoke all on function private.has_library_access(uuid,text) from public, anon, service_role;
grant execute on function private.has_library_access(uuid,text) to authenticated;
