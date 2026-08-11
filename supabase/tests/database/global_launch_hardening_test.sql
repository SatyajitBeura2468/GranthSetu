begin;
select plan(16);

select has_column('public', 'libraries', 'currency_code', 'rooms persist an operating currency');
select has_column('public', 'libraries', 'locale_code', 'rooms persist a display locale');
select has_column('public', 'libraries', 'time_zone', 'rooms persist an IANA timezone');
select has_table('public', 'workspace_mutation_receipts', 'durable mutation receipts exist');
select ok(not has_table_privilege('authenticated', 'public.workspace_mutation_receipts', 'SELECT'), 'authenticated clients cannot read receipts directly');
select ok(not has_table_privilege('authenticated', 'public.workspace_mutation_receipts', 'INSERT'), 'authenticated clients cannot insert receipts directly');
select has_function('private', 'library_local_date', 'room-local business-date helper exists');
select has_function('private', 'library_local_day_start_utc', 'room-local report-boundary helper exists');
select has_index('public', 'book_copies', 'book_copies_book_id_fk_idx', 'book-copy book FK is indexed');
select has_index('public', 'fines', 'fines_loan_id_fk_idx', 'fine loan FK is indexed');
select has_index('public', 'loans', 'loans_member_id_fk_idx', 'loan member FK is indexed');
select has_function('public', 'operator_workspace_mutation', 'trusted mutation gateway remains available');
select has_function('public', 'create_library_room', 'localization-aware room creation remains available');
select ok(to_regprocedure('public.create_library_room(text,text,text)') is null, 'legacy three-argument room creation is unavailable');

insert into public.libraries(id, public_code, display_name, currency_code, locale_code, time_zone)
values
  ('10000000-0000-0000-0000-000000000171', 'TZNYROOM', 'Timezone New York', 'USD', 'en-US', 'America/New_York'),
  ('10000000-0000-0000-0000-000000000172', 'TZTOKYOR', 'Timezone Tokyo', 'JPY', 'ja-JP', 'Asia/Tokyo');
select is(private.library_local_date('10000000-0000-0000-0000-000000000171', '2026-08-11T02:30:00Z'::timestamptz), '2026-08-10'::date, 'New York and UTC can be different business dates');
select is(private.library_local_date('10000000-0000-0000-0000-000000000172', '2026-08-11T02:30:00Z'::timestamptz), '2026-08-11'::date, 'Tokyo uses its own correct business date');

select * from finish();
rollback;
