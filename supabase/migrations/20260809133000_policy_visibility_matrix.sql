-- RLS policies execute these private predicates as the authenticated caller.
-- Audit data remains restricted to room administrators.

grant execute on function private.request_library_id() to authenticated;
grant execute on function private.has_library_access(uuid,text) to authenticated;
grant execute on function private.is_active_operator() to authenticated;

drop policy if exists audit_events_tenant_select on public.audit_events;
drop policy if exists audit_events_room_admin_select on public.audit_events;
create policy audit_events_room_admin_select on public.audit_events for select to authenticated
  using (private.has_library_access(library_id, 'administrator'));
