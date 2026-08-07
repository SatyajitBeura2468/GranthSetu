begin;

select plan(24);

select has_column('public', 'fines', 'fine_kind', 'fines record the controlled fine kind');
select ok(to_regclass('public.audit_events_request_id_unique') is not null, 'request IDs are unique when present');
select ok(to_regclass('public.fines_loan_kind_unique') is not null, 'one fine kind per loan is indexed uniquely');
select ok(to_regprocedure('private.require_operator()') is not null, 'operator helper exists');
select ok(to_regprocedure('private.circulation_request_lock(uuid,text)') is not null, 'request lock helper exists');
select ok(to_regprocedure('private.append_circulation_audit(uuid,text,text,uuid,uuid,jsonb)') is not null, 'circulation audit helper exists');
select ok(to_regprocedure('public.circulation_issue_loan(uuid,uuid,uuid,text)') is not null, 'issue RPC exists');
select ok(to_regprocedure('public.circulation_return_loan(uuid,uuid)') is not null, 'return RPC exists');
select ok(to_regprocedure('public.circulation_renew_loan(uuid,uuid)') is not null, 'renew RPC exists');
select ok(to_regprocedure('public.circulation_assess_overdue_fine(uuid,uuid)') is not null, 'fine assessment RPC exists');
select ok(to_regprocedure('public.circulation_settle_fine(uuid,bigint,uuid,text)') is not null, 'settlement RPC exists');
select ok(to_regprocedure('public.circulation_waive_fine(uuid,bigint,uuid,text)') is not null, 'waiver RPC exists');

select ok(has_function_privilege('authenticated', 'public.circulation_issue_loan(uuid,uuid,uuid,text)', 'EXECUTE'), 'authenticated can call issue RPC');
select ok(has_function_privilege('authenticated', 'public.circulation_return_loan(uuid,uuid)', 'EXECUTE'), 'authenticated can call return RPC');
select ok(has_function_privilege('authenticated', 'public.circulation_renew_loan(uuid,uuid)', 'EXECUTE'), 'authenticated can call renew RPC');
select ok(has_function_privilege('authenticated', 'public.circulation_assess_overdue_fine(uuid,uuid)', 'EXECUTE'), 'authenticated can call fine assessment RPC');
select ok(has_function_privilege('authenticated', 'public.circulation_settle_fine(uuid,bigint,uuid,text)', 'EXECUTE'), 'authenticated can call settlement RPC');
select ok(has_function_privilege('authenticated', 'public.circulation_waive_fine(uuid,bigint,uuid,text)', 'EXECUTE'), 'authenticated can call waiver RPC');
select ok(not has_function_privilege('anon', 'public.circulation_issue_loan(uuid,uuid,uuid,text)', 'EXECUTE'), 'anon cannot call issue RPC');
select ok(not has_function_privilege('anon', 'public.circulation_waive_fine(uuid,bigint,uuid,text)', 'EXECUTE'), 'anon cannot call waiver RPC');
select ok(not has_function_privilege('authenticated', 'private.require_operator()', 'EXECUTE'), 'private operator helper is not exposed');
select ok(not has_function_privilege('authenticated', 'private.circulation_request_lock(uuid,text)', 'EXECUTE'), 'private request helper is not exposed');

select ok(not has_table_privilege('authenticated', 'public.loans', 'INSERT'), 'operators cannot insert loans directly');
select ok(not has_table_privilege('authenticated', 'public.loans', 'UPDATE'), 'operators cannot update loans directly');
select ok(not has_table_privilege('authenticated', 'public.loan_renewals', 'INSERT'), 'operators cannot insert renewals directly');
select ok(not has_table_privilege('authenticated', 'public.fines', 'UPDATE'), 'operators cannot update fines directly');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'), 'operators cannot insert audit events directly');

select * from finish();
rollback;
