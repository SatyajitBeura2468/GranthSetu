-- Forward-only production advisor cleanup. This migration is intentionally
-- additive except for exact single-column duplicates introduced on 2026-08-11.
-- It must be applied only through the reviewed migration workflow.

-- Composite tenant foreign keys require the FK column order shown here. The
-- existing room-scoped composite constraints make cross-room references fail;
-- these indexes make their checks and parent deletes efficient.
create index if not exists book_authors_author_library_fk_idx on public.book_authors(author_id, library_id);
create index if not exists book_authors_book_library_fk_idx on public.book_authors(book_id, library_id);
create index if not exists book_categories_book_library_fk_idx on public.book_categories(book_id, library_id);
create index if not exists book_categories_category_library_fk_idx on public.book_categories(category_id, library_id);
create index if not exists book_subjects_book_library_fk_idx on public.book_subjects(book_id, library_id);
create index if not exists book_subjects_subject_library_fk_idx on public.book_subjects(subject_id, library_id);
create index if not exists book_copies_book_library_fk_idx on public.book_copies(book_id, library_id);
create index if not exists book_copies_location_library_fk_idx on public.book_copies(location_id, library_id);
create index if not exists books_publisher_library_fk_idx on public.books(publisher_id, library_id);
create index if not exists fines_loan_library_fk_idx on public.fines(loan_id, library_id);
create index if not exists loan_renewals_loan_library_fk_idx on public.loan_renewals(loan_id, library_id);
create index if not exists loans_book_copy_library_fk_idx on public.loans(book_copy_id, library_id);
create index if not exists loans_member_library_fk_idx on public.loans(member_id, library_id);
create index if not exists student_enrollments_member_library_fk_idx on public.student_enrollments(member_id, library_id);
create index if not exists student_enrollments_session_library_fk_idx on public.student_enrollments(academic_session_id, library_id);
create index if not exists student_enrollments_grade_library_fk_idx on public.student_enrollments(grade_level_id, library_id);
create index if not exists student_enrollments_section_library_fk_idx on public.student_enrollments(section_id, library_id);
create index if not exists workspace_mutation_receipts_actor_profile_fk_idx on public.workspace_mutation_receipts(actor_profile_id);

-- These are exact redundant single-column pairs. Keep the historical indexes;
-- do not remove partial, unique, expression, or multi-column indexes.
drop index if exists public.books_publisher_id_fk_idx;
drop index if exists public.fines_assessed_by_profile_id_fk_idx;
drop index if exists public.loan_renewals_loan_id_fk_idx;
drop index if exists public.student_enrollments_academic_session_id_fk_idx;
drop index if exists public.student_enrollments_grade_level_id_fk_idx;
drop index if exists public.student_enrollments_section_id_fk_idx;

-- The two operator-context entry points are authenticated application RPCs,
-- not anonymous catalogue surfaces. Explicit grants avoid PostgreSQL's default
-- PUBLIC EXECUTE grant after CREATE OR REPLACE.
revoke execute on function public.operator_accessible_libraries() from public, anon;
revoke execute on function public.operator_context_for_library(text) from public, anon;
grant execute on function public.operator_accessible_libraries() to authenticated, service_role;
grant execute on function public.operator_context_for_library(text) to authenticated, service_role;
