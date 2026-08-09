begin;
select plan(32);

select has_table('public', 'libraries', 'library rooms are first-class records');
select has_column('public', 'books', 'library_id', 'catalogue records are tenant scoped');
select has_column('public', 'members', 'library_id', 'member records are tenant scoped');
select has_column('public', 'loans', 'library_id', 'circulation records are tenant scoped');
select has_function('public', 'public_catalogue', 'anonymous catalogue uses a narrow RPC');
select has_function('public', 'operator_workspace_mutation', 'operator writes use a room-scoped trusted RPC');
select ok(has_function_privilege('anon', 'public.public_catalogue(text,text,boolean,integer)', 'EXECUTE'), 'anonymous users may execute only the public catalogue surface');
select ok(not has_table_privilege('anon', 'public.members', 'SELECT'), 'anonymous users cannot read members');
select ok(not has_table_privilege('authenticated', 'public.loans', 'INSERT'), 'operators cannot bypass trusted circulation writes');
select ok(not has_function_privilege('authenticated', 'public.admin_set_profile_status(uuid,text)', 'EXECUTE'), 'room operators cannot invoke the legacy global profile lifecycle RPC');
select ok(not has_function_privilege('authenticated', 'public.catalogue_set_book_cover(uuid,text)', 'EXECUTE'), 'room operators cannot invoke the legacy non-atomic cover mutation');
select ok(not has_function_privilege('authenticated', 'public.admin_upsert_academic_session(uuid,text,text,date,date,text)', 'EXECUTE'), 'room operators cannot bypass the room mutation adapter for academic sessions');
select ok(not has_function_privilege('authenticated', 'public.admin_upsert_grade(uuid,text,text,integer)', 'EXECUTE'), 'room operators cannot bypass the room mutation adapter for grades');
select ok(not has_function_privilege('authenticated', 'public.admin_upsert_section(uuid,text,text,integer)', 'EXECUTE'), 'room operators cannot bypass the room mutation adapter for sections');
select ok(has_function_privilege('authenticated', 'public.admin_assign_operator_to_room(text,uuid,text,text)', 'EXECUTE'), 'room administrators retain the room-scoped operator assignment RPC');
select ok(has_function_privilege('authenticated', 'private.has_library_access(uuid,text)', 'EXECUTE'), 'authenticated tenant SELECT policies can evaluate the private room-access helper');
select ok(has_function_privilege('authenticated', 'private.request_library_id()', 'EXECUTE'), 'authenticated profile policies can resolve the active room context');
select ok(has_function_privilege('authenticated', 'private.is_active_operator()', 'EXECUTE'), 'authenticated role policies can evaluate active operator state');
select ok((select qual from pg_policies where schemaname='public' and tablename='audit_events' and policyname='audit_events_room_admin_select') like '%administrator%', 'audit rows remain visible only through the room-administrator policy');
select ok(not exists(select 1 from pg_policies where schemaname='public' and tablename='audit_events' and policyname='audit_events_tenant_select'), 'the broad room-operator audit policy is absent');
select ok(position('update public.profiles set display_name' in lower(pg_get_functiondef('public.admin_assign_operator_to_room(text,uuid,text,text)'::regprocedure))) = 0, 'room assignment cannot overwrite an existing global display name');
select ok(pg_get_functiondef('public.operator_room_audit(text,text,date,date,text)'::regprocedure) ~* 'from\s+\(\s*select[\s\S]*limit 500\s*\)\s+q', 'audit input rows are bounded before JSON aggregation');
select ok(regexp_count(lower(pg_get_functiondef('public.operator_circulation_search_legacy_text(text,text,text)'::regprocedure)), 'limit 50') >= 4, 'every circulation search kind is bounded before JSON aggregation before the cleaned wrapper formats output');
select is((select public_code from public.public_resolve_library(' oavmusi ')), 'OAVMUSI', 'public codes resolve case-insensitively');
select is((select count(*)::integer from public.public_resolve_library('NOT-A-ROOM')), 0, 'unknown room codes fail closed');
select ok(not ((select proargnames from pg_proc where oid = 'public.public_catalogue(text,text,boolean,integer)'::regprocedure) && array['member_identifier','display_name','cover_storage_path']), 'public catalogue cannot return member identity or private storage paths');

insert into public.libraries(id, public_code, display_name)
values ('10000000-0000-0000-0000-000000000099', 'TESTROOM', 'Isolation Test Library');

insert into public.members(id, library_id, member_identifier, member_kind, display_name)
values ('20000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000099', 'DEV-MEMBER-001', 'student', 'Second Room Member');
select is((select count(*)::integer from public.members where member_identifier = 'DEV-MEMBER-001'), 2, 'member identifiers may repeat across rooms');

insert into public.books(id, library_id, title)
values ('44000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000099', 'Second Room Book');
insert into public.book_copies(id, library_id, book_id, accession_number)
values ('51000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000099', '44000000-0000-0000-0000-000000000099', 'DEV-ACC-0001');
select is((select count(*)::integer from public.book_copies where accession_number = 'DEV-ACC-0001'), 2, 'accession numbers may repeat across rooms');

select throws_ok(
  $$insert into public.book_copies(library_id, book_id, accession_number) values ('10000000-0000-0000-0000-000000000099', '44000000-0000-0000-0000-000000000001', 'CROSS-ROOM-COPY')$$,
  '23503', null, 'a copy cannot reference a book from another room'
);
select throws_ok(
  $$insert into public.loans(library_id, member_id, book_copy_id, due_at, issued_by_profile_id) values ('10000000-0000-0000-0000-000000000099', '20000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000099', timezone('utc',now()) + interval '14 days', '10000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'a loan cannot combine a member and copy from different rooms'
);

set local role anon;
select is((select count(*)::integer from public.public_catalogue('TESTROOM', null, false, 120)), 1, 'anonymous catalogue is limited to the addressed room');
select throws_ok('select count(*) from public.members', '42501', null, 'anonymous direct member reads remain denied');
reset role;

select * from finish();
rollback;
