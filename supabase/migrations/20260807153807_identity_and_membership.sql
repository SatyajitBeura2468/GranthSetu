create table public.profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  status text not null default 'active'
    constraint profiles_status_check check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_display_name_not_blank check (btrim(display_name) <> '')
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  role_key text not null unique,
  display_name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint roles_key_check check (role_key in ('administrator', 'librarian')),
  constraint roles_display_name_not_blank check (btrim(display_name) <> '')
);

insert into public.roles (id, role_key, display_name, description)
values
  ('00000000-0000-0000-0000-000000000001', 'administrator', 'Administrator', 'System and security administration'),
  ('00000000-0000-0000-0000-000000000002', 'librarian', 'Librarian', 'Day-to-day library operations')
on conflict (role_key) do update
set display_name = excluded.display_name,
    description = excluded.description;

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc', now()),
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  primary key (profile_id, role_id)
);

create table public.members (
  id uuid primary key default extensions.gen_random_uuid(),
  member_identifier text not null unique,
  member_kind text not null
    constraint members_member_kind_check check (member_kind in ('student', 'teacher', 'staff', 'other')),
  display_name text not null,
  profile_id uuid unique references public.profiles(id) on delete set null,
  status text not null default 'active'
    constraint members_status_check check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint members_identifier_not_blank check (btrim(member_identifier) <> ''),
  constraint members_display_name_not_blank check (btrim(display_name) <> '')
);

create table public.academic_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  session_code text not null unique,
  display_label text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned'
    constraint academic_sessions_status_check check (status in ('planned', 'active', 'closed', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint academic_sessions_dates_check check (ends_on >= starts_on),
  constraint academic_sessions_code_not_blank check (btrim(session_code) <> '')
);

create table public.grade_levels (
  id uuid primary key default extensions.gen_random_uuid(),
  grade_code text not null unique,
  display_name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint grade_levels_code_not_blank check (btrim(grade_code) <> ''),
  constraint grade_levels_name_not_blank check (btrim(display_name) <> '')
);

create table public.sections (
  id uuid primary key default extensions.gen_random_uuid(),
  section_code text not null unique,
  display_name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint sections_code_not_blank check (btrim(section_code) <> ''),
  constraint sections_name_not_blank check (btrim(display_name) <> '')
);

create table public.student_enrollments (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions(id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  status text not null default 'active'
    constraint student_enrollments_status_check check (status in ('active', 'completed', 'withdrawn')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint student_enrollments_one_per_member_session unique (member_id, academic_session_id)
);

comment on table public.student_enrollments is
  'Member-kind/student validation is a trusted mutation invariant; this table preserves promotion history.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger academic_sessions_set_updated_at
before update on public.academic_sessions
for each row execute function public.set_updated_at();

create trigger student_enrollments_set_updated_at
before update on public.student_enrollments
for each row execute function public.set_updated_at();
