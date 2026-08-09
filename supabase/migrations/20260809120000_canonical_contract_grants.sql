-- Preserve the mature, guarded Phase 5-7.1 RPC contracts used by integration
-- tests and trusted clients while keeping legacy global-profile lifecycle
-- administration denied to tenant operators.

do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
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

revoke execute on function public.admin_provision_operator_profile(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.admin_assign_role(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_role(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_set_profile_status(uuid,text) from public, anon, authenticated;
