-- Forward-only global commercial launch hardening. Existing rooms retain their
-- historical INR/en-IN/Asia-Kolkata defaults and no money values are converted.
alter table public.libraries
  add column if not exists currency_code char(3) not null default 'INR',
  add column if not exists locale_code text not null default 'en-IN',
  add column if not exists time_zone text not null default 'Asia/Kolkata';

alter table public.libraries drop constraint if exists libraries_currency_code_check;
alter table public.libraries add constraint libraries_currency_code_check
  check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.libraries add constraint libraries_locale_code_check
  check (char_length(btrim(locale_code)) between 2 and 64);
alter table public.libraries add constraint libraries_time_zone_check
  check (char_length(btrim(time_zone)) between 3 and 64);

alter table public.fines drop constraint if exists fines_currency_check;
alter table public.fines add constraint fines_currency_code_check
  check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.book_copies drop constraint if exists book_copies_currency_check;
alter table public.book_copies drop constraint if exists book_copies_cost_currency_check;
alter table public.book_copies add constraint book_copies_currency_code_check
  check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.library_settings drop constraint if exists library_settings_value_check;
alter table public.library_settings add constraint library_settings_value_check check (
  (value_kind = 'boolean' and boolean_value is not null and integer_value is null and money_minor_value is null and currency_code is null)
  or (value_kind = 'integer' and boolean_value is null and integer_value is not null and integer_value >= 0 and money_minor_value is null and currency_code is null)
  or (value_kind = 'money_minor' and boolean_value is null and integer_value is null and money_minor_value is not null and money_minor_value >= 0 and currency_code ~ '^[A-Z]{3}$')
);

create table if not exists public.workspace_mutation_receipts (
  request_id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (operation ~ '^[a-z_]{2,64}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (request_id, library_id, actor_profile_id, operation)
);
create index if not exists workspace_mutation_receipts_library_actor_created_idx
  on public.workspace_mutation_receipts(library_id, actor_profile_id, created_at desc);

create or replace function private.library_local_date(p_library_id uuid, p_at timestamptz default now())
returns date language sql stable security definer set search_path = '' as $$
  select timezone(l.time_zone, p_at)::date from public.libraries l where l.id = p_library_id
$$;
create or replace function private.library_local_day_start_utc(p_library_id uuid, p_date date)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select (p_date::timestamp at time zone l.time_zone) from public.libraries l where l.id = p_library_id
$$;
create or replace function private.policy_money(p_key text)
returns bigint language sql stable security definer set search_path = '' as $$
  select s.money_minor_value from public.library_settings s
  join public.libraries l on l.id = s.library_id
  where s.library_id = private.request_library_id() and s.setting_key = p_key
    and s.value_kind = 'money_minor' and s.currency_code = l.currency_code limit 1
$$;

create or replace function public.create_library_room(
  p_display_name text, p_public_code text, p_creator_display_name text,
  p_currency_code text, p_locale_code text, p_time_zone text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_currency text := upper(btrim(p_currency_code));
begin
  select id into v_profile from public.profiles where auth_user_id = auth.uid() and status = 'active';
  if v_profile is null then raise exception using errcode='42501', message='GS_PROFILE_INACTIVE'; end if;
  if char_length(btrim(p_display_name)) not between 3 and 160 or btrim(p_public_code) !~ '^[A-Z0-9][A-Z0-9-]{3,14}[A-Z0-9]$' then raise exception using errcode='22023',message='GS_LIBRARY_INPUT_INVALID'; end if;
  if v_currency !~ '^[A-Z]{3}$' or char_length(btrim(p_locale_code)) not between 2 and 64 or not exists(select 1 from pg_timezone_names where name=btrim(p_time_zone)) then raise exception using errcode='22023',message='GS_LIBRARY_LOCALIZATION_INVALID'; end if;
  insert into public.libraries(display_name,public_code,status,currency_code,locale_code,time_zone)
  values(btrim(p_display_name),upper(btrim(p_public_code)),'active',v_currency,btrim(p_locale_code),btrim(p_time_zone)) returning id into v_library;
  insert into public.profile_roles(profile_id,library_id,role_id,status)
  select v_profile,v_library,id,'active' from public.roles where role_key='administrator';
  insert into public.library_settings(library_id,setting_key,value_kind,money_minor_value,currency_code,updated_by_profile_id)
  values(v_library,'daily_fine_rate_minor','money_minor',0,v_currency,v_profile);
  return v_library;
exception when unique_violation then raise exception using errcode='23505',message='GS_LIBRARY_CODE_TAKEN';
end $$;

grant execute on function public.create_library_room(text,text,text,text,text,text) to authenticated;
revoke execute on function public.create_library_room(text,text,text) from authenticated;
