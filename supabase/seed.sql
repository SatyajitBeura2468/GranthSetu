-- Development-only synthetic seed. These rows are not school records or policy defaults.

insert into public.profiles (id, display_name, status)
values
  ('10000000-0000-0000-0000-000000000001', 'DEV Administrator Profile', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'DEV Librarian Profile', 'active');

insert into public.profile_roles (profile_id, role_id)
select '10000000-0000-0000-0000-000000000001'::uuid, id from public.roles where role_key = 'administrator'
union all
select '10000000-0000-0000-0000-000000000002'::uuid, id from public.roles where role_key = 'librarian';

insert into public.members (id, member_identifier, member_kind, display_name, status)
values
  ('20000000-0000-0000-0000-000000000001', 'DEV-MEMBER-001', 'student', 'DEV Student 001', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'DEV-MEMBER-002', 'teacher', 'DEV Teacher 001', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'DEV-MEMBER-003', 'staff', 'DEV Staff 001', 'inactive');

insert into public.academic_sessions (id, session_code, display_label, starts_on, ends_on, status)
values ('30000000-0000-0000-0000-000000000001', 'DEV-2026-27', 'Development Session 2026-27', date '2026-04-01', date '2027-03-31', 'active');

insert into public.grade_levels (id, grade_code, display_name, sort_order)
values
  ('31000000-0000-0000-0000-000000000009', 'DEV-09', 'Development Grade 09', 9),
  ('31000000-0000-0000-0000-000000000010', 'DEV-10', 'Development Grade 10', 10);

insert into public.sections (id, section_code, display_name, sort_order)
values ('32000000-0000-0000-0000-000000000001', 'DEV-A', 'Development Section A', 1);

insert into public.student_enrollments (id, member_id, academic_session_id, grade_level_id, section_id, status)
values ('33000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000009', '32000000-0000-0000-0000-000000000001', 'active');

insert into public.publishers (id, name)
values ('40000000-0000-0000-0000-000000000001', 'Development Press');

insert into public.categories (id, name)
values
  ('41000000-0000-0000-0000-000000000001', 'Development Science'),
  ('41000000-0000-0000-0000-000000000002', 'Development Literature');

insert into public.subjects (id, name)
values
  ('42000000-0000-0000-0000-000000000001', 'Development Physics'),
  ('42000000-0000-0000-0000-000000000002', 'Development Reading');

insert into public.authors (id, display_name)
values
  ('43000000-0000-0000-0000-000000000001', 'DEV Author Alpha'),
  ('43000000-0000-0000-0000-000000000002', 'DEV Author Beta');

insert into public.books (id, title, isbn, edition, publication_year, language_code, publisher_id, description)
values
  ('44000000-0000-0000-0000-000000000001', 'Development Science Handbook', '978-0000000001', 'Development Edition', 2026, 'en', '40000000-0000-0000-0000-000000000001', 'Synthetic catalogue record for local testing.'),
  ('44000000-0000-0000-0000-000000000002', 'Development Reading Reader', null, 'Development Edition', 2026, 'en', '40000000-0000-0000-0000-000000000001', 'Synthetic catalogue record without an ISBN.'),
  ('44000000-0000-0000-0000-000000000003', 'Development Mathematics Notes', null, null, null, 'en', null, 'Synthetic catalogue record for inventory state tests.');

insert into public.book_authors (book_id, author_id, author_order)
values
  ('44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 1),
  ('44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000002', 2),
  ('44000000-0000-0000-0000-000000000002', '43000000-0000-0000-0000-000000000002', 1);

insert into public.book_categories (book_id, category_id)
values
  ('44000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001'),
  ('44000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002');

insert into public.book_subjects (book_id, subject_id)
values
  ('44000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001'),
  ('44000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000002');

insert into public.locations (id, location_code, display_name)
values
  ('50000000-0000-0000-0000-000000000001', 'DEV-SHELF-A1', 'Development Shelf A1'),
  ('50000000-0000-0000-0000-000000000002', 'DEV-SHELF-B1', 'Development Shelf B1');

insert into public.book_copies (id, book_id, accession_number, barcode, location_id, acquired_on, replacement_cost_minor, condition_status, operational_state)
values
  ('51000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'DEV-ACC-0001', 'DEV-BAR-0001', '50000000-0000-0000-0000-000000000001', date '2026-04-01', 12500, 'good', 'active'),
  ('51000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'DEV-ACC-0002', 'DEV-BAR-0002', '50000000-0000-0000-0000-000000000001', date '2026-04-02', 12500, 'fair', 'active'),
  ('51000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000002', 'DEV-ACC-0003', 'DEV-BAR-0003', '50000000-0000-0000-0000-000000000002', date '2026-04-03', null, 'good', 'lost'),
  ('51000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000003', 'DEV-ACC-0004', null, '50000000-0000-0000-0000-000000000002', date '2026-04-04', null, 'poor', 'damaged');

insert into public.loans (id, member_id, book_copy_id, issued_at, due_at, returned_at, issued_by_profile_id, returned_by_profile_id, status, notes)
values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', timestamptz '2026-05-01 09:00:00+00', timestamptz '2026-05-21 09:00:00+00', timestamptz '2026-05-20 10:00:00+00', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'returned', 'Synthetic historical loan.'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', timestamptz '2026-08-01 09:00:00+00', timestamptz '2026-08-25 09:00:00+00', null, '10000000-0000-0000-0000-000000000002', null, 'active', 'Synthetic active loan.');

insert into public.loan_renewals (id, loan_id, approved_by_profile_id, previous_due_at, new_due_at, renewed_at)
values ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', timestamptz '2026-08-25 09:00:00+00', timestamptz '2026-09-10 09:00:00+00', timestamptz '2026-08-02 10:00:00+00');

update public.loans
set due_at = timestamptz '2026-09-10 09:00:00+00'
where id = '60000000-0000-0000-0000-000000000002';

insert into public.fines (id, loan_id, assessed_amount_minor, waived_amount_minor, settled_amount_minor, reason, assessed_by_profile_id)
values ('62000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1250, 0, 0, 'Synthetic overdue example.', '10000000-0000-0000-0000-000000000002');

insert into public.library_settings (setting_key, value_kind, boolean_value, updated_by_profile_id)
values ('fines_enabled', 'boolean', false, '10000000-0000-0000-0000-000000000001')
on conflict (library_id, setting_key) do update set
  value_kind = excluded.value_kind,
  boolean_value = excluded.boolean_value,
  integer_value = null,
  money_minor_value = null,
  currency_code = null,
  updated_by_profile_id = excluded.updated_by_profile_id;

insert into public.audit_events (id, actor_profile_id, action, target_type, target_id, metadata)
values ('63000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'seed.bootstrap', 'book', '44000000-0000-0000-0000-000000000001', '{"source":"synthetic-development-seed"}'::jsonb);
