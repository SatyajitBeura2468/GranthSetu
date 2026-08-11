begin;

set local search_path = public, extensions;

select plan(42);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.members') is not null, 'members table exists');
select ok(to_regclass('public.books') is not null, 'books table exists');
select ok(to_regclass('public.book_copies') is not null, 'book_copies table exists');
select ok(to_regclass('public.loans') is not null, 'loans table exists');
select ok(to_regclass('public.fines') is not null, 'fines table exists');
select ok((select count(*) from public.roles where role_key in ('administrator', 'librarian')) = 2, 'initial roles are present');
select ok((select count(*) from public.members) >= 3, 'synthetic members are seeded');
select ok((select count(*) from public.book_copies where book_id = '44000000-0000-0000-0000-000000000001') = 2, 'multiple copies can belong to one book');
select ok((select count(*) from public.book_authors where book_id = '44000000-0000-0000-0000-000000000001') = 2, 'multiple authors can belong to one book');

select ok((select relrowsecurity from pg_class where oid = 'public.members'::regclass), 'RLS is enabled on members');
select ok((select relrowsecurity from pg_class where oid = 'public.loans'::regclass), 'RLS is enabled on loans');
select ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) = 25, 'all application tables retain RLS');
select ok((select count(*) from pg_policies where schemaname = 'public') = 24, 'every client-readable application table has one narrow read policy; receipts expose none');
select ok(not has_table_privilege('anon', 'public.members', 'SELECT'), 'anon cannot read members');
select ok(has_table_privilege('authenticated', 'public.members', 'SELECT'), 'authenticated receives only policy-filtered member read privilege');
select ok(not has_table_privilege('authenticated', 'public.loans', 'INSERT'), 'authenticated cannot insert loans directly');
select ok(not has_table_privilege('authenticated', 'public.loans', 'UPDATE'), 'authenticated cannot update loans directly');
select ok(not has_table_privilege('authenticated', 'public.loans', 'DELETE'), 'authenticated cannot delete loans directly');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'), 'authenticated cannot insert audit events directly');
select ok(not has_table_privilege('anon', 'public.audit_events', 'UPDATE'), 'anon cannot update audit events');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'DELETE'), 'authenticated cannot delete audit events');
select ok(to_regnamespace('private') is not null, 'private authorization schema exists');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated cannot use private authorization schema');
select ok(has_function_privilege('authenticated', 'public.current_operator_context()', 'EXECUTE'), 'authenticated can resolve only current operator context');
select ok(not has_function_privilege('anon', 'public.current_operator_context()', 'EXECUTE'), 'anon cannot resolve operator context');
select ok(not has_function_privilege('authenticated', 'public.admin_provision_operator_profile(uuid,text,text)', 'EXECUTE'), 'room operators cannot invoke legacy global-profile provisioning');
select ok(has_function_privilege('service_role', 'public.bootstrap_first_administrator(uuid,text)', 'EXECUTE'), 'service role can invoke bootstrap RPC');
select ok(not has_function_privilege('authenticated', 'public.bootstrap_first_administrator(uuid,text)', 'EXECUTE'), 'authenticated cannot invoke bootstrap RPC');
select ok(not has_function_privilege('anon', 'public.bootstrap_first_administrator(uuid,text)', 'EXECUTE'), 'anon cannot invoke bootstrap RPC');

select throws_ok(
  $$insert into public.profile_roles (profile_id, role_id) values ('10000000-0000-0000-0000-000000000001', (select id from public.roles where role_key = 'administrator'))$$,
  '23505', null, 'duplicate profile-role assignment is rejected'
);
select throws_ok(
  $$insert into public.student_enrollments (member_id, academic_session_id, grade_level_id, section_id) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000010', '32000000-0000-0000-0000-000000000001')$$,
  '23505', null, 'duplicate member-session enrollment is rejected'
);
select throws_ok(
  $$insert into public.book_copies (book_id, accession_number, barcode) values ('44000000-0000-0000-0000-000000000001', 'DEV-ACC-0001', 'DEV-BAR-X')$$,
  '23505', null, 'duplicate accession number is rejected'
);
select throws_ok(
  $$insert into public.book_copies (book_id, accession_number, barcode) values ('44000000-0000-0000-0000-000000000001', 'DEV-ACC-X', 'DEV-BAR-0001')$$,
  '23505', null, 'duplicate non-null barcode is rejected'
);

insert into public.book_copies (id, book_id, accession_number)
values ('70000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'DEV-TEST-ACC-001');

select throws_ok(
  $$insert into public.loans (member_id, book_copy_id, due_at, issued_by_profile_id) values ('20000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', timestamptz '2026-09-01 09:00:00+00', '10000000-0000-0000-0000-000000000002')$$,
  '23505', null, 'second simultaneous active loan for one copy is rejected'
);
select throws_ok(
  $$insert into public.loans (member_id, book_copy_id, due_at, returned_at, issued_by_profile_id, status) values ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', timestamptz '2026-09-01 09:00:00+00', timestamptz '2026-09-02 09:00:00+00', '10000000-0000-0000-0000-000000000002', 'active')$$,
  '23514', null, 'active loan with return timestamp is rejected'
);
select throws_ok(
  $$insert into public.loans (member_id, book_copy_id, due_at, issued_by_profile_id, status) values ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', timestamptz '2026-09-01 09:00:00+00', '10000000-0000-0000-0000-000000000002', 'returned')$$,
  '23514', null, 'returned loan without return timestamp is rejected'
);
select throws_ok(
  $$insert into public.loans (member_id, book_copy_id, issued_at, due_at, issued_by_profile_id) values ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', timestamptz '2026-09-02 09:00:00+00', timestamptz '2026-09-01 09:00:00+00', '10000000-0000-0000-0000-000000000002')$$,
  '23514', null, 'due timestamp before issue timestamp is rejected'
);
select throws_ok(
  $$insert into public.loan_renewals (loan_id, approved_by_profile_id, previous_due_at, new_due_at) values ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', timestamptz '2026-09-10 09:00:00+00', timestamptz '2026-09-10 09:00:00+00')$$,
  '23514', null, 'renewal must extend the due timestamp'
);
select throws_ok(
  $$insert into public.fines (loan_id, assessed_amount_minor, waived_amount_minor, settled_amount_minor, assessed_by_profile_id) values ('60000000-0000-0000-0000-000000000002', 100, 60, 50, '10000000-0000-0000-0000-000000000002')$$,
  '23514', null, 'fine waiver plus settlement cannot exceed assessment'
);
select throws_ok(
  $$insert into public.fines (loan_id, assessed_amount_minor, assessed_by_profile_id) values ('60000000-0000-0000-0000-000000000002', -1, '10000000-0000-0000-0000-000000000002')$$,
  '23514', null, 'negative fine amount is rejected'
);

insert into public.loans (id, member_id, book_copy_id, issued_at, due_at, returned_at, issued_by_profile_id, returned_by_profile_id, status)
values ('71000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', timestamptz '2026-06-01 09:00:00+00', timestamptz '2026-06-15 09:00:00+00', timestamptz '2026-06-14 09:00:00+00', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'returned');
insert into public.loans (id, member_id, book_copy_id, issued_at, due_at, issued_by_profile_id, status)
values ('71000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', timestamptz '2026-07-01 09:00:00+00', timestamptz '2026-07-15 09:00:00+00', '10000000-0000-0000-0000-000000000002', 'active');
select ok(true, 'returned loan can coexist historically with a later active loan');

select * from finish();
rollback;
