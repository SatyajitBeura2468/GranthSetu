begin;
select plan(12);

select has_column('public', 'books', 'cover_storage_path', 'books support an optional private cover path');
select has_index('public', 'book_copies', 'book_copies_barcode_unique', 'barcode remains unique when present');
select has_function('public', 'catalogue_upsert_book', 'trusted book write function exists');
select has_function('public', 'inventory_upsert_copy', 'trusted inventory write function exists');
select has_function('public', 'member_upsert', 'trusted member write function exists');
select has_function('public', 'operator_dashboard', 'dashboard read model exists');
select has_function('public', 'global_search', 'global search exists');
select has_function('public', 'report_circulation', 'circulation report exists');
select has_function('public', 'report_inventory', 'inventory report exists');
select has_function('public', 'admin_audit_events', 'administrator audit reader exists');
select has_index('public', 'fines', 'fines_one_automated_overdue_per_loan', 'automated overdue fine uniqueness is partial');
select has_column('public', 'fines', 'fine_kind', 'fines preserve an explicit history kind');

select * from finish();
rollback;
