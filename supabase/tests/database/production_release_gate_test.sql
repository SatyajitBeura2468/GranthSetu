begin;
select plan(14);

select ok(has_function_privilege('authenticated','public.global_search_v71(text)','EXECUTE'), 'legacy global search remains available through the room-safe compatibility wrapper');
select ok(not has_function_privilege('authenticated','public.circulation_member_search(text,integer)','EXECUTE'), 'legacy member search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_copy_search(text,boolean,integer)','EXECUTE'), 'legacy copy search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_loan_search(text,boolean,integer)','EXECUTE'), 'legacy loan search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_fine_search(text,boolean,integer)','EXECUTE'), 'legacy fine search is revoked');
select ok(has_function_privilege('authenticated','public.report_inventory_filtered(text,uuid)','EXECUTE'), 'legacy inventory report remains available through a room-safe compatibility wrapper');
select ok(has_function_privilege('authenticated','public.report_overdue_filtered(date,text)','EXECUTE'), 'legacy overdue report remains available through a room-safe compatibility wrapper');
select ok(has_function_privilege('authenticated','public.operator_global_search(text,text)','EXECUTE'), 'explicit room-scoped global search is available');
select ok(has_function_privilege('authenticated','public.operator_reference_save(text,text,text,text)','EXECUTE'), 'room-scoped reference management is available');
select ok(not has_function_privilege('authenticated','public.operator_global_search_legacy_text(text,text)','EXECUTE'), 'the mojibake legacy global-search implementation is not executable');
select ok(not has_function_privilege('authenticated','public.operator_circulation_search_legacy_text(text,text,text)','EXECUTE'), 'the mojibake legacy circulation-search implementation is not executable');
select ok(pg_get_functiondef('public.operator_global_search(text,text)'::regprocedure) ~* 'security definer' and pg_get_functiondef('public.operator_global_search(text,text)'::regprocedure) ~* 'operator_global_search_legacy_text', 'global search exposes only the cleaned room-aware wrapper');
select ok(pg_get_functiondef('public.catalogue_upsert_author(uuid,text)'::regprocedure) ~* 'lower\(btrim\(display_name\)\)' and exists (select 1 from pg_indexes where schemaname='public' and indexname='authors_library_normalized_name_unique'), 'authors are normalized and unique only within their library room');
select ok(pg_get_functiondef('public.global_search_v71(text)'::regprocedure) ~* 'private.request_library_id' and pg_get_functiondef('public.global_search_v71(text)'::regprocedure) ~* 'public.operator_global_search', 'legacy global search resolves one current room before calling the room-bound search');

select * from finish();
rollback;
