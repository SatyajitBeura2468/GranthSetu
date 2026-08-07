create table public.library_settings (
  setting_key text primary key,
  value_kind text not null
    constraint library_settings_kind_check check (value_kind in ('boolean', 'integer', 'money_minor')),
  boolean_value boolean,
  integer_value bigint,
  money_minor_value bigint,
  currency_code char(3),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint library_settings_key_check check (
    setting_key in (
      'fines_enabled',
      'default_loan_period_days',
      'checkout_limit',
      'renewal_limit',
      'grace_period_days',
      'daily_fine_rate_minor'
    )
  ),
  constraint library_settings_key_kind_check check (
    (setting_key = 'fines_enabled' and value_kind = 'boolean')
    or
    (setting_key in ('default_loan_period_days', 'checkout_limit', 'renewal_limit', 'grace_period_days') and value_kind = 'integer')
    or
    (setting_key = 'daily_fine_rate_minor' and value_kind = 'money_minor')
  ),
  constraint library_settings_one_typed_value_check check (
    (value_kind = 'boolean' and boolean_value is not null and integer_value is null and money_minor_value is null and currency_code is null)
    or
    (value_kind = 'integer' and boolean_value is null and integer_value is not null and integer_value >= 0 and money_minor_value is null and currency_code is null)
    or
    (value_kind = 'money_minor' and boolean_value is null and integer_value is null and money_minor_value is not null and money_minor_value >= 0 and currency_code = 'INR')
  )
);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  occurred_at timestamptz not null default timezone('utc', now()),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  before_data jsonb,
  after_data jsonb,
  constraint audit_events_action_not_blank check (btrim(action) <> ''),
  constraint audit_events_target_type_not_blank check (btrim(target_type) <> ''),
  constraint audit_events_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint audit_events_before_object_check check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint audit_events_after_object_check check (after_data is null or jsonb_typeof(after_data) = 'object')
);

create trigger library_settings_set_updated_at
before update on public.library_settings
for each row execute function public.set_updated_at();

create index members_status_index on public.members (status);
create index academic_sessions_status_dates_index on public.academic_sessions (status, starts_on, ends_on);
create index student_enrollments_member_session_index on public.student_enrollments (member_id, academic_session_id);
create index books_title_index on public.books (title);
create index books_isbn_normalized_index on public.books (isbn_normalized);
create index book_authors_author_index on public.book_authors (author_id, book_id);
create index book_categories_category_index on public.book_categories (category_id, book_id);
create index book_subjects_subject_index on public.book_subjects (subject_id, book_id);
create index book_copies_book_state_index on public.book_copies (book_id, operational_state);
create index loans_member_history_index on public.loans (member_id, issued_at desc);
create index loans_copy_history_index on public.loans (book_copy_id, issued_at desc);
create index loans_active_due_index on public.loans (due_at) where status = 'active';
create index loan_renewals_loan_time_index on public.loan_renewals (loan_id, renewed_at desc);
create index fines_loan_index on public.fines (loan_id, created_at desc);
create index audit_events_actor_time_index on public.audit_events (actor_profile_id, occurred_at desc);
create index audit_events_target_time_index on public.audit_events (target_type, target_id, occurred_at desc);

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.profile_roles enable row level security;
alter table public.members enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.grade_levels enable row level security;
alter table public.sections enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.publishers enable row level security;
alter table public.categories enable row level security;
alter table public.subjects enable row level security;
alter table public.authors enable row level security;
alter table public.books enable row level security;
alter table public.book_authors enable row level security;
alter table public.book_categories enable row level security;
alter table public.book_subjects enable row level security;
alter table public.locations enable row level security;
alter table public.book_copies enable row level security;
alter table public.loans enable row level security;
alter table public.loan_renewals enable row level security;
alter table public.fines enable row level security;
alter table public.library_settings enable row level security;
alter table public.audit_events enable row level security;

revoke usage on schema public from anon, authenticated;
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on function public.set_updated_at() from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

comment on table public.library_settings is
  'Policy storage is intentionally empty until school policy values are approved; development seed may contain only non-authoritative disabled defaults.';
comment on table public.audit_events is
  'Append-oriented history; normal API roles receive no privileges or policies.';
