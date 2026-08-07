grant usage on schema public to service_role;

grant all on table
  public.profiles,
  public.profile_roles,
  public.roles,
  public.members,
  public.academic_sessions,
  public.grade_levels,
  public.sections,
  public.student_enrollments,
  public.publishers,
  public.categories,
  public.subjects,
  public.authors,
  public.books,
  public.book_authors,
  public.book_categories,
  public.book_subjects,
  public.locations,
  public.book_copies,
  public.loans,
  public.loan_renewals,
  public.fines,
  public.library_settings,
  public.audit_events
to service_role;
