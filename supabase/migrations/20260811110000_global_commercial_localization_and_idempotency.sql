-- Forward-only global commercial launch hardening. Existing values remain
-- untouched: a room's currency is an accounting boundary, never an FX rate.
alter table public.libraries
  add column if not exists currency_code char(3) not null default 'INR',
  add column if not exists locale_code text not null default 'en-IN',
  add column if not exists time_zone text not null default 'Asia/Kolkata';

alter table public.libraries drop constraint if exists libraries_currency_code_check;
alter table public.libraries add constraint libraries_currency_code_check check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.libraries add constraint libraries_locale_code_check check (locale_code ~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,12})*$');
alter table public.libraries add constraint libraries_time_zone_check check (char_length(btrim(time_zone)) between 3 and 64);
alter table public.fines drop constraint if exists fines_currency_check;
alter table public.fines add constraint fines_currency_code_check check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.book_copies drop constraint if exists book_copies_currency_check;
alter table public.book_copies drop constraint if exists book_copies_cost_currency_check;
alter table public.book_copies add constraint book_copies_currency_code_check check (currency_code = upper(currency_code) and currency_code ~ '^[A-Z]{3}$');
alter table public.library_settings drop constraint if exists library_settings_value_check;
alter table public.library_settings add constraint library_settings_value_check check (
  (value_kind = 'boolean' and boolean_value is not null and integer_value is null and money_minor_value is null and currency_code is null)
  or (value_kind = 'integer' and boolean_value is null and integer_value is not null and integer_value >= 0 and money_minor_value is null and currency_code is null)
  or (value_kind = 'money_minor' and boolean_value is null and integer_value is null and money_minor_value is not null and money_minor_value >= 0 and currency_code ~ '^[A-Z]{3}$')
);

-- One client UUID identifies exactly one authorized room mutation. Direct
-- table access remains impossible: only SECURITY DEFINER RPCs use this table.
create table if not exists public.workspace_mutation_receipts (
  request_id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (operation ~ '^[a-z_]{2,64}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (request_id, library_id, actor_profile_id, operation)
);
alter table public.workspace_mutation_receipts enable row level security;
revoke all on table public.workspace_mutation_receipts from public, anon, authenticated;
grant all on table public.libraries, public.workspace_mutation_receipts to service_role;
create index if not exists workspace_mutation_receipts_library_actor_created_idx on public.workspace_mutation_receipts(library_id, actor_profile_id, created_at desc);

-- The Supabase advisor checks the leading FK column, so these indexes are
-- deliberately narrow; existing composite tenant indexes remain in place.
create index if not exists book_authors_author_id_fk_idx on public.book_authors(author_id);
create index if not exists book_authors_book_id_fk_idx on public.book_authors(book_id);
create index if not exists book_categories_book_id_fk_idx on public.book_categories(book_id);
create index if not exists book_categories_category_id_fk_idx on public.book_categories(category_id);
create index if not exists book_subjects_book_id_fk_idx on public.book_subjects(book_id);
create index if not exists book_subjects_subject_id_fk_idx on public.book_subjects(subject_id);
create index if not exists book_copies_book_id_fk_idx on public.book_copies(book_id);
create index if not exists books_publisher_id_fk_idx on public.books(publisher_id);
create index if not exists fines_loan_id_fk_idx on public.fines(loan_id);
create index if not exists fines_assessed_by_profile_id_fk_idx on public.fines(assessed_by_profile_id);
create index if not exists libraries_created_by_profile_id_fk_idx on public.libraries(created_by_profile_id);
create index if not exists loan_renewals_loan_id_fk_idx on public.loan_renewals(loan_id);
create index if not exists loans_member_id_fk_idx on public.loans(member_id);
create index if not exists loans_book_copy_id_fk_idx on public.loans(book_copy_id);
create index if not exists members_profile_id_fk_idx on public.members(profile_id);
create index if not exists student_enrollments_member_id_fk_idx on public.student_enrollments(member_id);
create index if not exists student_enrollments_academic_session_id_fk_idx on public.student_enrollments(academic_session_id);
create index if not exists student_enrollments_grade_level_id_fk_idx on public.student_enrollments(grade_level_id);
create index if not exists student_enrollments_section_id_fk_idx on public.student_enrollments(section_id);

create or replace function private.library_local_date(p_library_id uuid, p_at timestamptz default now())
returns date language sql stable security definer set search_path = '' as $$
  select timezone(l.time_zone, p_at)::date from public.libraries l where l.id = p_library_id
$$;
create or replace function private.library_local_day_start_utc(p_library_id uuid, p_date date)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select p_date::timestamp at time zone l.time_zone from public.libraries l where l.id = p_library_id
$$;
create or replace function private.policy_money(p_key text)
returns bigint language sql stable security definer set search_path = '' as $$
  select s.money_minor_value from public.library_settings s join public.libraries l on l.id = s.library_id
  where s.library_id = private.request_library_id() and s.setting_key = p_key and s.value_kind = 'money_minor' and s.currency_code = l.currency_code limit 1
$$;

-- All trusted domain procedures already call one of these guards. Setting the
-- transaction timezone here makes existing current_date and date casts use the
-- selected room calendar without changing canonical timestamptz storage.
create or replace function private.require_operator()
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_zone text;
begin
  v_library:=private.request_library_id(); select p.id into v_profile from public.profiles p where p.auth_user_id=(select auth.uid()) and p.status='active';
  if v_profile is null or v_library is null or not private.has_library_access(v_library) then raise exception using errcode='42501',message='GS_NOT_OPERATOR'; end if;
  select time_zone into v_zone from public.libraries where id=v_library; perform set_config('granthsetu.library_id',v_library::text,true); perform set_config('TimeZone',v_zone,true); return v_profile;
end;
$$;
create or replace function private.require_administrator()
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_zone text;
begin
  v_library:=private.request_library_id(); select p.id into v_profile from public.profiles p where p.auth_user_id=(select auth.uid()) and p.status='active';
  if v_profile is null or v_library is null or not private.has_library_access(v_library,'administrator') then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
  select time_zone into v_zone from public.libraries where id=v_library; perform set_config('granthsetu.library_id',v_library::text,true); perform set_config('TimeZone',v_zone,true); return v_profile;
end;
$$;

-- Currency is captured at the domain write boundary, including assessments
-- made by pre-existing circulation procedures.
create or replace function private.capture_room_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select currency_code into new.currency_code from public.libraries where id = new.library_id;
  return new;
end;
$$;
drop trigger if exists fines_capture_room_currency on public.fines;
create trigger fines_capture_room_currency before insert on public.fines for each row execute function private.capture_room_currency();
drop trigger if exists book_copies_capture_room_currency on public.book_copies;
create trigger book_copies_capture_room_currency before insert or update of replacement_cost_minor on public.book_copies for each row execute function private.capture_room_currency();

-- The legacy unaudited creation overload is removed while this migration is
-- still unmerged. New rooms receive their explicit localization atomically.
drop function if exists public.create_library_room(text, text, text);
create or replace function public.create_library_room(
  p_display_name text, p_public_code text, p_creator_display_name text,
  p_currency_code text, p_locale_code text, p_time_zone text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_admin_role uuid; v_code text; v_status text; v_currency text := upper(btrim(p_currency_code)); v_locale text := btrim(p_locale_code); v_zone text := btrim(p_time_zone);
begin
  if (select auth.uid()) is null then raise exception using errcode='42501', message='GS_AUTH_REQUIRED'; end if;
  v_code := private.normalize_library_code(p_public_code);
  if char_length(btrim(coalesce(p_display_name,''))) not between 3 and 160 or char_length(btrim(coalesce(p_creator_display_name,''))) not between 2 and 120 or v_code !~ '^[A-Z0-9](?:[A-Z0-9-]{3,14})[A-Z0-9]$' or v_code ~ '--' or v_code in ('ADMIN','API','AUTH','LOGIN','STAFF','OPERATOR','CREATE','SUPPORT','HELP','ROOT','SYSTEM','GRANTHSETU') then raise exception using errcode='22023', message='GS_LIBRARY_INPUT_INVALID'; end if;
  if v_currency !~ '^[A-Z]{3}$' or v_locale !~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,12})*$' or not exists(select 1 from pg_timezone_names where name=v_zone) then raise exception using errcode='22023', message='GS_LIBRARY_LOCALIZATION_INVALID'; end if;
  select id, status into v_profile, v_status from public.profiles where auth_user_id = (select auth.uid()) for update;
  if v_profile is null then insert into public.profiles(auth_user_id, display_name, status) values((select auth.uid()), btrim(p_creator_display_name), 'active') returning id into v_profile; elsif v_status <> 'active' then raise exception using errcode='42501', message='GS_PROFILE_INACTIVE'; end if;
  insert into public.libraries(public_code, display_name, created_by_profile_id, currency_code, locale_code, time_zone) values(v_code, btrim(p_display_name), v_profile, v_currency, v_locale, v_zone) returning id into v_library;
  perform set_config('granthsetu.library_id', v_library::text, true);
  select id into v_admin_role from public.roles where role_key='administrator';
  insert into public.profile_roles(profile_id, library_id, role_id, assigned_by_profile_id, status) values(v_profile, v_library, v_admin_role, v_profile, 'active');
  insert into public.library_settings(library_id, setting_key, value_kind, boolean_value, updated_by_profile_id) values (v_library,'fines_enabled','boolean',false,v_profile),(v_library,'overdue_renewal_allowed','boolean',false,v_profile),(v_library,'librarian_waiver_allowed','boolean',false,v_profile);
  insert into public.library_settings(library_id, setting_key, value_kind, integer_value, updated_by_profile_id) values (v_library,'default_loan_period_days','integer',14,v_profile),(v_library,'checkout_limit','integer',5,v_profile),(v_library,'renewal_limit','integer',2,v_profile),(v_library,'grace_period_days','integer',0,v_profile);
  insert into public.library_settings(library_id, setting_key, value_kind, money_minor_value, currency_code, updated_by_profile_id) values(v_library,'daily_fine_rate_minor','money_minor',0,v_currency,v_profile);
  insert into public.audit_events(library_id,actor_profile_id,action,target_type,target_id,metadata) values(v_library,v_profile,'library.created','library',v_library,jsonb_build_object('public_code',v_code,'currency_code',v_currency,'locale_code',v_locale,'time_zone',v_zone));
  return v_library;
exception when unique_violation then raise exception using errcode='23505', message='GS_LIBRARY_CODE_TAKEN';
end;
$$;

drop function if exists public.operator_context_for_library(text);
create function public.operator_context_for_library(p_library_code text)
returns table(user_id uuid, profile_id uuid, display_name text, library_id uuid, library_code text, library_name text, currency_code text, locale_code text, time_zone text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.auth_user_id,p.id,p.display_name,l.id,l.public_code,l.display_name,l.currency_code::text,l.locale_code,l.time_zone,array_agg(r.role_key order by r.role_key)
  from public.profiles p join public.profile_roles pr on pr.profile_id=p.id and pr.status='active' join public.roles r on r.id=pr.role_id join public.libraries l on l.id=pr.library_id
  where p.auth_user_id=(select auth.uid()) and p.status='active' and l.status='active' and l.public_code=private.normalize_library_code(p_library_code) and r.role_key in ('administrator','librarian')
  group by p.auth_user_id,p.id,p.display_name,l.id,l.public_code,l.display_name,l.currency_code,l.locale_code,l.time_zone
$$;
drop function if exists public.operator_accessible_libraries();
create function public.operator_accessible_libraries()
returns table(library_id uuid, library_code text, library_name text, currency_code text, locale_code text, time_zone text, roles text[])
language sql stable security definer set search_path = '' as $$
  select l.id,l.public_code,l.display_name,l.currency_code::text,l.locale_code,l.time_zone,array_agg(r.role_key order by r.role_key)
  from public.profiles p join public.profile_roles pr on pr.profile_id=p.id and pr.status='active' join public.roles r on r.id=pr.role_id join public.libraries l on l.id=pr.library_id
  where p.auth_user_id=(select auth.uid()) and p.status='active' and l.status='active' and r.role_key in ('administrator','librarian')
  group by l.id,l.public_code,l.display_name,l.currency_code,l.locale_code,l.time_zone order by l.display_name
$$;
drop function if exists public.public_resolve_library(text);
create function public.public_resolve_library(p_library_code text)
returns table(id uuid, public_code text, display_name text, status text, currency_code text, locale_code text, time_zone text)
language sql stable security definer set search_path = '' as $$
  select l.id,l.public_code,l.display_name,l.status,l.currency_code::text,l.locale_code,l.time_zone from public.libraries l where l.public_code=private.normalize_library_code(p_library_code) and l.status='active'
$$;

create or replace function public.admin_upsert_setting(p_setting_key text, p_boolean_value boolean default null, p_integer_value bigint default null, p_money_minor_value bigint default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_library uuid; v_kind text; v_currency text;
begin
  v_actor:=private.require_administrator(); v_library:=private.request_library_id(); select currency_code into v_currency from public.libraries where id=v_library;
  if p_setting_key not in ('fines_enabled','default_loan_period_days','checkout_limit','renewal_limit','grace_period_days','daily_fine_rate_minor','overdue_renewal_allowed','librarian_waiver_allowed') then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if;
  if p_setting_key in ('fines_enabled','overdue_renewal_allowed','librarian_waiver_allowed') then if p_boolean_value is null then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if; v_kind:='boolean'; elsif p_setting_key='daily_fine_rate_minor' then if p_money_minor_value is null or p_money_minor_value<0 then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if; v_kind:='money_minor'; else if p_integer_value is null or p_integer_value<0 or (p_setting_key='default_loan_period_days' and p_integer_value<1) then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if; v_kind:='integer'; end if;
  insert into public.library_settings(library_id,setting_key,value_kind,boolean_value,integer_value,money_minor_value,currency_code,updated_by_profile_id) values(v_library,p_setting_key,v_kind,case when v_kind='boolean' then p_boolean_value end,case when v_kind='integer' then p_integer_value end,case when v_kind='money_minor' then p_money_minor_value end,case when v_kind='money_minor' then v_currency end,v_actor) on conflict(library_id,setting_key) do update set value_kind=excluded.value_kind,boolean_value=excluded.boolean_value,integer_value=excluded.integer_value,money_minor_value=excluded.money_minor_value,currency_code=excluded.currency_code,updated_by_profile_id=v_actor;
  perform private.admin_audit(v_actor,'admin.setting_saved','library_setting',null,jsonb_build_object('setting_key',p_setting_key,'currency_code',case when v_kind='money_minor' then v_currency end)); return true;
end;
$$;

create or replace function public.operator_workspace_mutation(p_library_code text, p_operation text, p_payload jsonb, p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_id uuid; v_author uuid; v_result jsonb; v_author_name text; v_author_ids uuid[] := '{}'; v_bool boolean; v_integer bigint; v_money bigint; v_expected timestamptz; v_receipt public.workspace_mutation_receipts%rowtype; v_currency text; v_locale text; v_zone text;
begin
  if p_request_id is null then raise exception using errcode='22023',message='GS_REQUEST_ID_REQUIRED'; end if;
  v_library:=private.require_library_access(p_library_code); v_actor:=private.require_operator();
  select currency_code,locale_code,time_zone into v_currency,v_locale,v_zone from public.libraries where id=v_library for update;
  perform set_config('TimeZone',v_zone,true);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 91371031));
  select * into v_receipt from public.workspace_mutation_receipts where request_id=p_request_id for update;
  if found then
    if v_receipt.library_id<>v_library or v_receipt.actor_profile_id<>v_actor or v_receipt.operation<>p_operation then raise exception using errcode='23505',message='GS_REQUEST_ID_REUSED'; end if;
    return v_receipt.result;
  end if;
  case p_operation
    when 'issue' then v_result:=public.circulation_issue_loan((p_payload->>'memberId')::uuid,(p_payload->>'copyId')::uuid,p_request_id,p_payload->>'notes');
    when 'return' then v_result:=public.circulation_return_loan((p_payload->>'loanId')::uuid,p_request_id);
    when 'renew' then v_result:=public.circulation_renew_loan((p_payload->>'loanId')::uuid,p_request_id);
    when 'fine_settle' then v_result:=public.circulation_settle_fine((p_payload->>'fineId')::uuid,(p_payload->>'amountMinor')::bigint,p_request_id,p_payload->>'note');
    when 'fine_waive' then v_result:=public.circulation_waive_fine((p_payload->>'fineId')::uuid,(p_payload->>'amountMinor')::bigint,p_request_id,p_payload->>'reason');
    when 'book_save' then
      foreach v_author_name in array regexp_split_to_array(coalesce(p_payload->>'author',''),'\s*,\s*') loop if btrim(v_author_name)<>'' then v_author:=public.catalogue_upsert_author(null,v_author_name); v_author_ids:=array_append(v_author_ids,v_author); end if; end loop;
      if cardinality(v_author_ids)=0 then raise exception using errcode='22023',message='GS_AUTHOR_REQUIRED'; end if; v_expected:=nullif(p_payload->>'expectedUpdatedAt','')::timestamptz;
      v_id:=public.catalogue_upsert_book(nullif(p_payload->>'id','')::uuid,p_payload->>'title',p_payload->>'subtitle',p_payload->>'isbn',p_payload->>'edition',nullif(p_payload->>'publicationYear','')::integer,p_payload->>'languageCode',nullif(p_payload->>'publisherId','')::uuid,p_payload->>'description',v_author_ids,coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'categoryIds','[]'::jsonb))::uuid),'{}'::uuid[]),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'subjectIds','[]'::jsonb))::uuid),'{}'::uuid[]),v_expected); v_result:=jsonb_build_object('id',v_id);
    when 'book_status' then v_result:=jsonb_build_object('updated',public.catalogue_set_book_status((p_payload->>'id')::uuid,p_payload->>'status'));
    when 'book_cover' then v_result:=jsonb_build_object('previousPath',public.catalogue_set_book_cover_v71((p_payload->>'id')::uuid,nullif(p_payload->>'coverPath',''),p_payload->>'expectedCoverPath'));
    when 'copy_save' then v_expected:=nullif(p_payload->>'expectedUpdatedAt','')::timestamptz; v_id:=public.inventory_upsert_copy(nullif(p_payload->>'id','')::uuid,(p_payload->>'bookId')::uuid,p_payload->>'accession',p_payload->>'barcode',nullif(p_payload->>'locationId','')::uuid,nullif(p_payload->>'acquiredOn','')::date,p_payload->>'acquisitionSource',nullif(p_payload->>'replacementCostMinor','')::bigint,coalesce(nullif(p_payload->>'conditionStatus',''),'good'),coalesce(nullif(p_payload->>'operationalState',''),'active'),v_expected); v_result:=jsonb_build_object('id',v_id);
    when 'member_save' then v_expected:=nullif(p_payload->>'expectedUpdatedAt','')::timestamptz; if nullif(p_payload->>'id','') is null then v_id:=public.member_create_with_enrollment(p_payload->>'displayName',p_payload->>'memberKind',coalesce(nullif(p_payload->>'status',''),'active'),nullif(p_payload->>'academicSessionId','')::uuid,nullif(p_payload->>'gradeLevelId','')::uuid,nullif(p_payload->>'sectionId','')::uuid,p_payload->>'rollNumber',coalesce(nullif(p_payload->>'enrollmentStatus',''),'active')); else v_id:=public.member_update_profile((p_payload->>'id')::uuid,p_payload->>'memberKind',p_payload->>'displayName',coalesce(nullif(p_payload->>'status',''),'active'),v_expected); if p_payload->>'memberKind'='student' and nullif(p_payload->>'academicSessionId','') is not null then perform public.member_set_enrollment_v71(v_id,(p_payload->>'academicSessionId')::uuid,(p_payload->>'gradeLevelId')::uuid,(p_payload->>'sectionId')::uuid,p_payload->>'rollNumber',coalesce(nullif(p_payload->>'enrollmentStatus',''),'active')); end if; end if; v_result:=jsonb_build_object('id',v_id);
    when 'setting_update' then if p_payload->>'valueKind'='boolean' then v_bool:=(p_payload->>'value')::boolean; elsif p_payload->>'valueKind'='money_minor' then v_money:=(p_payload->>'value')::bigint; else v_integer:=(p_payload->>'value')::bigint; end if; perform public.admin_upsert_setting(p_payload->>'settingKey',v_bool,v_integer,v_money); v_result:=jsonb_build_object('updated',true);
    when 'academic_session_save' then v_id:=public.admin_upsert_academic_session(nullif(p_payload->>'id','')::uuid,p_payload->>'sessionCode',p_payload->>'displayLabel',(p_payload->>'startsOn')::date,(p_payload->>'endsOn')::date,coalesce(nullif(p_payload->>'status',''),'planned')); v_result:=jsonb_build_object('id',v_id);
    when 'grade_save' then v_id:=public.admin_upsert_grade(nullif(p_payload->>'id','')::uuid,p_payload->>'gradeCode',p_payload->>'displayName',coalesce(nullif(p_payload->>'sortOrder','')::integer,0)); v_result:=jsonb_build_object('id',v_id);
    when 'section_save' then v_id:=public.admin_upsert_section(nullif(p_payload->>'id','')::uuid,p_payload->>'sectionCode',p_payload->>'displayName',coalesce(nullif(p_payload->>'sortOrder','')::integer,0)); v_result:=jsonb_build_object('id',v_id);
    when 'library_update' then if not private.has_library_access(v_library,'administrator') or char_length(btrim(coalesce(p_payload->>'displayName',''))) not between 3 and 160 then raise exception using errcode='22023',message='GS_LIBRARY_INPUT_INVALID'; end if; update public.libraries set display_name=btrim(p_payload->>'displayName') where id=v_library; perform private.admin_audit(v_actor,'library.identity_updated','library',v_library,jsonb_build_object('display_name',btrim(p_payload->>'displayName'))); v_result:=jsonb_build_object('updated',true);
    when 'library_localization_update' then
      if not private.has_library_access(v_library,'administrator') then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
      if upper(btrim(coalesce(p_payload->>'currencyCode',''))) !~ '^[A-Z]{3}$' or btrim(coalesce(p_payload->>'localeCode','')) !~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,12})*$' or not exists(select 1 from pg_timezone_names where name=btrim(coalesce(p_payload->>'timeZone',''))) then raise exception using errcode='22023',message='GS_LIBRARY_LOCALIZATION_INVALID'; end if;
      if upper(btrim(p_payload->>'currencyCode'))<>v_currency and (exists(select 1 from public.fines where library_id=v_library) or exists(select 1 from public.book_copies where library_id=v_library and coalesce(replacement_cost_minor,0)<>0) or exists(select 1 from public.library_settings where library_id=v_library and value_kind='money_minor' and coalesce(money_minor_value,0)<>0)) then raise exception using errcode='P0001',message='GS_CURRENCY_LOCKED'; end if;
      if upper(btrim(p_payload->>'currencyCode'))<>v_currency then update public.library_settings set currency_code=upper(btrim(p_payload->>'currencyCode')) where library_id=v_library and value_kind='money_minor' and coalesce(money_minor_value,0)=0; end if;
      update public.libraries set currency_code=upper(btrim(p_payload->>'currencyCode')),locale_code=btrim(p_payload->>'localeCode'),time_zone=btrim(p_payload->>'timeZone') where id=v_library; perform private.admin_audit(v_actor,'library.localization_updated','library',v_library,jsonb_build_object('currency_code',upper(btrim(p_payload->>'currencyCode')),'locale_code',btrim(p_payload->>'localeCode'),'time_zone',btrim(p_payload->>'timeZone'))); v_result:=jsonb_build_object('updated',true);
    when 'reference_save' then v_result:=public.operator_reference_save(p_library_code,p_payload->>'kind',p_payload->>'name',p_payload->>'code');
    when 'operator_assign' then v_id:=public.admin_assign_operator_to_room(p_library_code,(p_payload->>'targetAuthUserId')::uuid,p_payload->>'displayName',p_payload->>'role'); v_result:=jsonb_build_object('profile_id',v_id);
    when 'operator_status' then v_result:=jsonb_build_object('updated',public.admin_set_room_operator_status(p_library_code,(p_payload->>'profileId')::uuid,p_payload->>'status'));
    else raise exception using errcode='22023',message='GS_OPERATION_INVALID';
  end case;
  insert into public.workspace_mutation_receipts(request_id,library_id,actor_profile_id,operation,result) values(p_request_id,v_library,v_actor,p_operation,v_result);
  return v_result;
end;
$$;

-- Date ranges become two indexed UTC instants derived from the room's local
-- midnight. Historical fine amounts carry their assessment currency.
create or replace function public.operator_room_report(p_library_code text,p_kind text,p_from date default null,p_to date default null,p_query text default null,p_status text default null,p_outstanding_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_start timestamptz; v_end timestamptz; v_cutoff timestamptz; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code); if p_from is not null and p_to is not null and p_from>p_to then raise exception using errcode='22023',message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  v_start:=case when p_from is null then null else private.library_local_day_start_utc(v_library,p_from) end; v_end:=case when p_to is null then null else private.library_local_day_start_utc(v_library,p_to+1) end; v_cutoff:=coalesce(v_end,now());
  if p_kind='circulation' then select coalesce(jsonb_agg(to_jsonb(q) order by q.issued_at desc),'[]'::jsonb) into v_result from (select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.issued_at,lo.due_at,lo.returned_at,lo.status from public.loans lo join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id where lo.library_id=v_library and (v_start is null or lo.issued_at>=v_start) and (v_end is null or lo.issued_at<v_end) and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%') limit 1000) q;
  elsif p_kind='overdue' then select coalesce(jsonb_agg(to_jsonb(q) order by q.due_at),'[]'::jsonb) into v_result from (select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.due_at,greatest(0,ceil(extract(epoch from (v_cutoff-lo.due_at))/86400.0)::bigint) days_overdue from public.loans lo join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id where lo.library_id=v_library and lo.status='active' and lo.due_at<v_cutoff limit 1000) q;
  elsif p_kind='popular' then select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (select b.id book_id,b.title,count(lo.id) loan_count from public.books b join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id join public.loans lo on lo.book_copy_id=c.id and lo.library_id=c.library_id where b.library_id=v_library and (v_start is null or lo.issued_at>=v_start) and (v_end is null or lo.issued_at<v_end) group by b.id,b.title order by count(lo.id) desc limit 500) q;
  elsif p_kind='members' then select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (select m.id member_id,m.display_name member_name,m.member_identifier,count(lo.id) loan_count,count(lo.id) filter(where lo.status='active') active_loans from public.members m left join public.loans lo on lo.member_id=m.id and lo.library_id=m.library_id and (v_start is null or lo.issued_at>=v_start) and (v_end is null or lo.issued_at<v_end) where m.library_id=v_library group by m.id,m.display_name,m.member_identifier limit 1000) q;
  elsif p_kind='inventory' then select coalesce(jsonb_agg(to_jsonb(q) order by q.title),'[]'::jsonb) into v_result from (select b.id book_id,b.title,count(c.id) total_copies,count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) available_copies,count(c.id) filter(where exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) on_loan_copies,count(c.id) filter(where c.operational_state<>'active') unavailable_copies from public.books b left join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id and (p_status is null or c.operational_state=p_status) where b.library_id=v_library group by b.id,b.title having p_status is null or count(c.id)>0) q;
  elsif p_kind='fines' then select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result from (select f.id fine_id,m.display_name member_name,m.member_identifier,b.title,c.accession_number,f.assessed_amount_minor,f.waived_amount_minor,f.settled_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor outstanding_minor,f.currency_code::text currency_code,f.created_at,f.reason from public.fines f join public.loans lo on lo.id=f.loan_id and lo.library_id=f.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id where f.library_id=v_library and (v_start is null or f.created_at>=v_start) and (v_end is null or f.created_at<v_end) and (not p_outstanding_only or f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor>0) limit 1000) q;
  else raise exception using errcode='22023',message='GS_REPORT_KIND_INVALID'; end if; return coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke execute on function public.create_library_room(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_library_room(text,text,text,text,text,text), public.operator_context_for_library(text), public.operator_accessible_libraries(), public.operator_workspace_mutation(text,text,jsonb,uuid), public.operator_room_report(text,text,date,date,text,text,boolean) to authenticated;
grant execute on function public.public_resolve_library(text) to anon, authenticated;
comment on function public.operator_workspace_mutation(text,text,jsonb,uuid) is 'Trusted room mutation gateway with request UUID replay, tenant validation, and transaction-scoped receipt locking.';

-- `require_operator` deliberately sets the transaction timezone to the room's
-- business timezone so date-only policy checks use the library's local day.
-- Keep instants as `timestamptz`: `timezone('utc', now())` returns a timestamp
-- without timezone and would otherwise be reinterpreted in that room timezone.
create or replace function public.circulation_issue_loan(
  p_member_id uuid,
  p_book_copy_id uuid,
  p_request_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid; v_existing record; v_member public.members%rowtype; v_copy public.book_copies%rowtype;
  v_book public.books%rowtype; v_period bigint; v_limit bigint; v_active_count bigint;
  v_now timestamptz; v_loan public.loans%rowtype;
begin
  v_actor := private.require_operator();
  if p_member_id is null or p_book_copy_id is null or p_request_id is null then raise exception using errcode='22023', message='GS_INPUT_INVALID'; end if;
  if p_notes is not null and char_length(btrim(p_notes)) > 2000 then raise exception using errcode='22023', message='GS_NOTES_TOO_LONG'; end if;
  select * into v_existing from private.circulation_request_lock(p_request_id,'circulation.loan_issued');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_issued' then raise exception using errcode='23505', message='GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent',true);
  end if;
  select * into v_member from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='P0001', message='GS_MEMBER_NOT_FOUND'; end if;
  if v_member.status <> 'active' then raise exception using errcode='P0001', message='GS_MEMBER_INACTIVE'; end if;
  if v_member.member_kind='student' and not exists (
    select 1 from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id
    where se.member_id=v_member.id and se.status='active' and s.status='active' and current_date between s.starts_on and s.ends_on
  ) then raise exception using errcode='P0001', message='GS_STUDENT_ENROLMENT_REQUIRED'; end if;
  v_period:=private.policy_integer('default_loan_period_days'); v_limit:=private.policy_integer('checkout_limit');
  if v_period is null or v_period<=0 or v_limit is null or v_limit<0 then raise exception using errcode='P0001', message='GS_POLICY_NOT_CONFIGURED'; end if;
  select count(*) into v_active_count from public.loans where member_id=v_member.id and status='active';
  if v_active_count>=v_limit then raise exception using errcode='P0001', message='GS_CHECKOUT_LIMIT_REACHED'; end if;
  select * into v_copy from public.book_copies where id=p_book_copy_id for update;
  if not found then raise exception using errcode='P0001', message='GS_COPY_NOT_FOUND'; end if;
  if v_copy.operational_state<>'active' then raise exception using errcode='P0001', message='GS_COPY_NOT_CIRCULATABLE'; end if;
  select * into v_book from public.books where id=v_copy.book_id;
  if not found or v_book.status<>'active' then raise exception using errcode='P0001', message='GS_BOOK_ARCHIVED'; end if;
  if exists(select 1 from public.loans where book_copy_id=v_copy.id and status='active') then raise exception using errcode='P0001', message='GS_COPY_ALREADY_ON_LOAN'; end if;
  v_now:=now();
  insert into public.loans(member_id,book_copy_id,issued_at,due_at,issued_by_profile_id,status,notes)
    values(v_member.id,v_copy.id,v_now,v_now+make_interval(days=>v_period::integer),v_actor,'active',nullif(btrim(p_notes),'')) returning * into v_loan;
  v_existing.existing_metadata:=jsonb_build_object('loan_id',v_loan.id,'member_id',v_loan.member_id,'copy_id',v_loan.book_copy_id,'issued_at',v_loan.issued_at,'due_at',v_loan.due_at,'status',v_loan.status,'idempotent',false);
  perform private.append_circulation_audit(v_actor,'circulation.loan_issued','loan',v_loan.id,p_request_id,v_existing.existing_metadata);
  return v_existing.existing_metadata;
end;
$$;

create or replace function public.circulation_return_loan(p_loan_id uuid, p_request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_now timestamptz; v_result jsonb;
begin
  v_actor:=private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id,'circulation.loan_returned');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_returned' then raise exception using errcode='23505', message='GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent',true);
  end if;
  select * into v_loan from public.loans where id=p_loan_id for update;
  if not found then raise exception using errcode='P0001', message='GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status<>'active' or v_loan.returned_at is not null then raise exception using errcode='P0001', message='GS_LOAN_ALREADY_RETURNED'; end if;
  v_now:=now();
  update public.loans set returned_at=v_now,returned_by_profile_id=v_actor,status='returned' where id=v_loan.id returning * into v_loan;
  v_result:=jsonb_build_object('loan_id',v_loan.id,'member_id',v_loan.member_id,'copy_id',v_loan.book_copy_id,'due_at',v_loan.due_at,'returned_at',v_loan.returned_at,'status',v_loan.status,'overdue',v_loan.returned_at>v_loan.due_at,'idempotent',false);
  perform private.append_circulation_audit(v_actor,'circulation.loan_returned','loan',v_loan.id,p_request_id,v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_renew_loan(p_loan_id uuid, p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_member public.members%rowtype; v_copy public.book_copies%rowtype; v_book public.books%rowtype; v_period bigint; v_limit bigint; v_count bigint; v_now timestamptz; v_renewal public.loan_renewals%rowtype; v_result jsonb;
begin
  v_actor:=private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id,'circulation.loan_renewed');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_renewed' then raise exception using errcode='23505', message='GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent',true);
  end if;
  select * into v_loan from public.loans where id=p_loan_id for update;
  if not found then raise exception using errcode='P0001', message='GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status<>'active' then raise exception using errcode='P0001', message='GS_LOAN_NOT_ACTIVE'; end if;
  v_now:=now();
  if v_now>v_loan.due_at and not coalesce(private.policy_boolean('overdue_renewal_allowed'),false) then raise exception using errcode='P0001', message='GS_LOAN_OVERDUE'; end if;
  select * into v_member from public.members where id=v_loan.member_id;
  if v_member.status<>'active' then raise exception using errcode='P0001', message='GS_MEMBER_INACTIVE'; end if;
  if v_member.member_kind='student' and not exists(select 1 from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id where se.member_id=v_member.id and se.status='active' and s.status='active' and current_date between s.starts_on and s.ends_on) then raise exception using errcode='P0001', message='GS_STUDENT_ENROLMENT_REQUIRED'; end if;
  select * into v_copy from public.book_copies where id=v_loan.book_copy_id;
  if v_copy.operational_state<>'active' then raise exception using errcode='P0001', message='GS_COPY_NOT_CIRCULATABLE'; end if;
  select * into v_book from public.books where id=v_copy.book_id;
  if v_book.status<>'active' then raise exception using errcode='P0001', message='GS_BOOK_ARCHIVED'; end if;
  v_period:=private.policy_integer('default_loan_period_days'); v_limit:=private.policy_integer('renewal_limit');
  if v_period is null or v_period<=0 or v_limit is null or v_limit<0 then raise exception using errcode='P0001', message='GS_POLICY_NOT_CONFIGURED'; end if;
  select count(*) into v_count from public.loan_renewals where loan_id=v_loan.id;
  if v_count>=v_limit then raise exception using errcode='P0001', message='GS_RENEWAL_LIMIT_REACHED'; end if;
  insert into public.loan_renewals(loan_id,approved_by_profile_id,previous_due_at,new_due_at,renewed_at)
    values(v_loan.id,v_actor,v_loan.due_at,greatest(v_loan.due_at,v_now)+make_interval(days=>v_period::integer),v_now) returning * into v_renewal;
  update public.loans set due_at=v_renewal.new_due_at where id=v_loan.id returning * into v_loan;
  v_result:=jsonb_build_object('loan_id',v_loan.id,'renewal_id',v_renewal.id,'previous_due_at',v_renewal.previous_due_at,'new_due_at',v_renewal.new_due_at,'renewal_count',v_count+1,'status',v_loan.status,'idempotent',false);
  perform private.append_circulation_audit(v_actor,'circulation.loan_renewed','loan',v_loan.id,p_request_id,v_result);
  return v_result;
end;
$$;
