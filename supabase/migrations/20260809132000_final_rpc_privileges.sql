-- Make the final executable surface deterministic for both fresh installs and
-- Development databases that received earlier V3 migration iterations.

revoke execute on all functions in schema public from public, anon, authenticated, service_role;

do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'current_operator_context','operator_accessible_libraries','operator_context_for_library',
      'create_library_room','operator_workspace_data','operator_workspace_mutation',
      'operator_circulation_search','operator_room_operators','operator_room_audit','operator_room_report',
      'admin_assign_operator_to_room','admin_set_room_operator_status',
      'circulation_issue_loan','circulation_return_loan','circulation_renew_loan','circulation_assess_overdue_fine',
      'circulation_settle_fine','circulation_waive_fine','circulation_member_search','circulation_copy_search',
      'circulation_loan_search','circulation_fine_search','operator_policy_context','global_search_v71',
      'report_overdue_filtered','report_inventory_filtered','member_create_with_enrollment','member_update_profile',
      'member_set_enrollment','member_set_enrollment_v71','catalogue_set_book_cover_v71','admin_upsert_setting'
    ])
  loop
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

grant execute on function public.public_resolve_library(text) to anon, authenticated;
grant execute on function public.public_catalogue(text,text,boolean,integer) to anon, authenticated;
grant execute on function public.public_book_detail(text,uuid) to anon, authenticated;
grant execute on function public.public_catalogue_page(text,text,boolean,integer,integer,uuid) to anon, authenticated;
grant execute on function public.public_new_titles(text,integer) to anon, authenticated;
grant execute on function public.public_book_cover_path(text,uuid) to service_role;
grant execute on function public.bootstrap_first_administrator(uuid,text) to service_role;

-- RLS policies resolve this private helper by OID while running as the caller.
revoke all on function private.has_library_access(uuid,text) from public, anon, service_role;
grant execute on function private.request_library_id() to authenticated;
grant execute on function private.has_library_access(uuid,text) to authenticated;
grant execute on function private.is_active_operator() to authenticated;
