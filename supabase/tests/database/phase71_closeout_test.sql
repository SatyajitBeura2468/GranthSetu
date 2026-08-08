begin;
select plan(25);

select has_column('public','student_enrollments','roll_number','student enrollments store a nullable roll number');
select has_index('public','student_enrollments','student_enrollments_active_roll_unique','active roll uniqueness is scoped to session, grade, and section');
select has_index('public','student_enrollments','student_enrollments_one_active_per_member','one active enrollment per member is enforced');
select has_function('public','member_create_with_enrollment','student creation is atomic');
select has_function('public','member_update_profile','member identifiers are not part of profile edits');
select has_function('public','member_set_enrollment_v71','enrollment mutation preserves history');
select has_function('public','operator_policy_context','operator policy context is server-resolved');
select has_function('public','global_search_v71','global search includes practical identifiers');
select has_function('public','circulation_member_search','member circulation search exists');
select has_function('public','circulation_copy_search','copy circulation search exists');
select has_function('public','circulation_loan_search','loan circulation search exists');
select has_function('public','circulation_fine_search','fine circulation search exists');
select has_function('public','report_circulation_filtered','circulation report accepts filters');
select has_function('public','report_overdue_filtered','overdue report accepts an as-of date');
select has_function('public','report_popular_books_filtered','popular-books report accepts date filters');
select has_function('public','report_member_activity_filtered','member report accepts filters');
select has_function('public','report_inventory_filtered','inventory report accepts copy filters');
select has_function('public','report_fines_filtered','fine report accepts filters');
select has_function('public','circulation_renew_loan','renewal policy function exists');
select has_function('public','circulation_waive_fine','waiver policy function exists');
select ok((select relrowsecurity from pg_class where oid='public.student_enrollments'::regclass),'enrollment RLS remains enabled');
select ok(not has_table_privilege('authenticated','public.student_enrollments','INSERT'),'enrollment direct inserts remain closed');
select ok(not has_table_privilege('authenticated','public.members','UPDATE'),'member direct updates remain closed');
select ok((select count(*) from storage.buckets where id='book-covers' and public=false)=1,'book covers remain private');
select ok((select count(*) from public.library_settings where setting_key in ('overdue_renewal_allowed','librarian_waiver_allowed'))=0,'new policy toggles default to fail-closed when absent');

select * from finish();
rollback;

begin;
select plan(2);
insert into public.members(id,member_identifier,member_kind,display_name,status)
values ('72000000-0000-0000-0000-000000000001','PHASE71-ROLL-TEST','student','Phase 7.1 Roll Test','active');
insert into public.student_enrollments(member_id,academic_session_id,grade_level_id,section_id,roll_number,status)
values ('72000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000009','32000000-0000-0000-0000-000000000001','17','active');
select throws_ok($$insert into public.student_enrollments(member_id,academic_session_id,grade_level_id,section_id,roll_number,status) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000009','32000000-0000-0000-0000-000000000001',' 17 ','active')$$,'23505',null,'active roll duplicates are rejected within the same class context');
select throws_ok($$insert into public.student_enrollments(member_id,academic_session_id,grade_level_id,section_id,roll_number,status) values ('72000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000009','32000000-0000-0000-0000-000000000001',E'17\n','active')$$,'23514',null,'control characters are rejected in roll numbers');
select * from finish();
rollback;
