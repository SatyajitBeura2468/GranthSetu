begin;
select plan(9);

select ok(has_function_privilege('authenticated','public.global_search_v71(text)','EXECUTE'), 'legacy global search remains available through the room-safe compatibility wrapper');
select ok(not has_function_privilege('authenticated','public.circulation_member_search(text,integer)','EXECUTE'), 'legacy member search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_copy_search(text,boolean,integer)','EXECUTE'), 'legacy copy search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_loan_search(text,boolean,integer)','EXECUTE'), 'legacy loan search is revoked');
select ok(not has_function_privilege('authenticated','public.circulation_fine_search(text,boolean,integer)','EXECUTE'), 'legacy fine search is revoked');
select ok(has_function_privilege('authenticated','public.report_inventory_filtered(text,uuid)','EXECUTE'), 'legacy inventory report remains available through a room-safe compatibility wrapper');
select ok(has_function_privilege('authenticated','public.report_overdue_filtered(date,text)','EXECUTE'), 'legacy overdue report remains available through a room-safe compatibility wrapper');
select ok(has_function_privilege('authenticated','public.operator_global_search(text,text)','EXECUTE'), 'explicit room-scoped global search is available');
select ok(has_function_privilege('authenticated','public.operator_reference_save(text,text,text,text)','EXECUTE'), 'room-scoped reference management is available');

select * from finish();
rollback;
