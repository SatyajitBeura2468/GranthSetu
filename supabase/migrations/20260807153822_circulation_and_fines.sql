create table public.loans (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  book_copy_id uuid not null references public.book_copies(id) on delete restrict,
  issued_at timestamptz not null default timezone('utc', now()),
  due_at timestamptz not null,
  returned_at timestamptz,
  issued_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  returned_by_profile_id uuid references public.profiles(id) on delete restrict,
  status text not null default 'active'
    constraint loans_status_check check (status in ('active', 'returned')),
  notes text,
  constraint loans_due_after_issue_check check (due_at >= issued_at),
  constraint loans_return_after_issue_check check (returned_at is null or returned_at >= issued_at),
  constraint loans_lifecycle_check check (
    (status = 'active' and returned_at is null and returned_by_profile_id is null)
    or
    (status = 'returned' and returned_at is not null and returned_by_profile_id is not null)
  ),
  constraint loans_notes_length_check check (notes is null or char_length(notes) <= 2000)
);

create unique index loans_one_active_per_copy
on public.loans (book_copy_id)
where status = 'active';

create table public.loan_renewals (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  approved_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  previous_due_at timestamptz not null,
  new_due_at timestamptz not null,
  renewed_at timestamptz not null default timezone('utc', now()),
  constraint loan_renewals_due_date_check check (new_due_at > previous_due_at)
);

create table public.fines (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  assessed_amount_minor bigint not null check (assessed_amount_minor >= 0),
  waived_amount_minor bigint not null default 0 check (waived_amount_minor >= 0),
  settled_amount_minor bigint not null default 0 check (settled_amount_minor >= 0),
  currency_code char(3) not null default 'INR'
    constraint fines_currency_check check (currency_code = 'INR'),
  reason text,
  assessed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fines_totals_check check (waived_amount_minor + settled_amount_minor <= assessed_amount_minor)
);

create trigger fines_set_updated_at
before update on public.fines
for each row execute function public.set_updated_at();
