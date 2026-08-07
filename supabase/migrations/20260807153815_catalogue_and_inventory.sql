create table public.publishers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  status text not null default 'active'
    constraint publishers_status_check check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint publishers_name_not_blank check (btrim(name) <> '')
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  status text not null default 'active'
    constraint categories_status_check check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_not_blank check (btrim(name) <> '')
);

create table public.subjects (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  status text not null default 'active'
    constraint subjects_status_check check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subjects_name_not_blank check (btrim(name) <> '')
);

create table public.authors (
  id uuid primary key default extensions.gen_random_uuid(),
  display_name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint authors_name_not_blank check (btrim(display_name) <> '')
);

create table public.books (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  subtitle text,
  isbn text,
  isbn_normalized text generated always as (
    nullif(regexp_replace(lower(coalesce(isbn, '')), '[^0-9x]', '', 'g'), '')
  ) stored,
  edition text,
  publication_year integer check (publication_year is null or publication_year between 1000 and 9999),
  language_code text,
  publisher_id uuid references public.publishers(id) on delete restrict,
  status text not null default 'active'
    constraint books_status_check check (status in ('active', 'archived')),
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint books_title_not_blank check (btrim(title) <> '')
);

create table public.book_authors (
  book_id uuid not null references public.books(id) on delete restrict,
  author_id uuid not null references public.authors(id) on delete restrict,
  author_order integer not null default 1 check (author_order > 0),
  primary key (book_id, author_id),
  constraint book_authors_order_unique unique (book_id, author_order)
);

create table public.book_categories (
  book_id uuid not null references public.books(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (book_id, category_id)
);

create table public.book_subjects (
  book_id uuid not null references public.books(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  primary key (book_id, subject_id)
);

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  location_code text not null unique,
  display_name text not null,
  status text not null default 'active'
    constraint locations_status_check check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint locations_code_not_blank check (btrim(location_code) <> ''),
  constraint locations_name_not_blank check (btrim(display_name) <> '')
);

create table public.book_copies (
  id uuid primary key default extensions.gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  accession_number text not null unique,
  barcode text,
  location_id uuid references public.locations(id) on delete set null,
  acquired_on date,
  acquisition_source text,
  replacement_cost_minor bigint check (replacement_cost_minor is null or replacement_cost_minor >= 0),
  currency_code char(3) not null default 'INR'
    constraint book_copies_currency_check check (currency_code = 'INR'),
  condition_status text not null default 'good'
    constraint book_copies_condition_check check (condition_status in ('good', 'fair', 'poor')),
  operational_state text not null default 'active'
    constraint book_copies_state_check check (operational_state in ('active', 'maintenance', 'lost', 'damaged', 'withdrawn')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint book_copies_accession_not_blank check (btrim(accession_number) <> ''),
  constraint book_copies_cost_currency_check check (replacement_cost_minor is null or currency_code = 'INR')
);

create unique index book_copies_barcode_unique
on public.book_copies (barcode)
where barcode is not null;

create trigger publishers_set_updated_at
before update on public.publishers
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger authors_set_updated_at
before update on public.authors
for each row execute function public.set_updated_at();

create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create trigger book_copies_set_updated_at
before update on public.book_copies
for each row execute function public.set_updated_at();
