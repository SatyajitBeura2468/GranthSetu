-- Phase 6: trusted operator data administration.
-- All writes cross narrow RPCs; authenticated table DML remains revoked.

alter table public.books add column if not exists cover_storage_path text;
alter table public.books add constraint books_cover_path_check
  check (cover_storage_path is null or (char_length(cover_storage_path) between 1 and 512 and cover_storage_path !~ '[[:cntrl:]]'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.admin_audit(p_actor uuid, p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_profile_id, action, target_type, target_id, metadata)
  values (p_actor, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function private.require_catalogue_operator() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.require_operator();
end;
$$;

create or replace function public.catalogue_upsert_author(p_id uuid, p_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 160 then raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID'; end if;
  if p_id is null then insert into public.authors(display_name) values (btrim(p_display_name)) returning id into v_id;
  else update public.authors set display_name=btrim(p_display_name) where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if; end if;
  perform private.admin_audit(v_actor, 'catalogue.author_saved', 'author', v_id, jsonb_build_object('display_name', btrim(p_display_name)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.catalogue_upsert_publisher(p_id uuid, p_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID'; end if;
  if p_id is null then insert into public.publishers(name) values (btrim(p_name)) returning id into v_id;
  else update public.publishers set name=btrim(p_name) where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if; end if;
  perform private.admin_audit(v_actor, 'catalogue.publisher_saved', 'publisher', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.catalogue_upsert_category(p_id uuid, p_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID'; end if;
  if p_id is null then insert into public.categories(name) values (btrim(p_name)) returning id into v_id;
  else update public.categories set name=btrim(p_name) where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if; end if;
  perform private.admin_audit(v_actor, 'catalogue.category_saved', 'category', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.catalogue_upsert_subject(p_id uuid, p_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID'; end if;
  if p_id is null then insert into public.subjects(name) values (btrim(p_name)) returning id into v_id;
  else update public.subjects set name=btrim(p_name) where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if; end if;
  perform private.admin_audit(v_actor, 'catalogue.subject_saved', 'subject', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.catalogue_upsert_location(p_id uuid, p_location_code text, p_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_location_code is null or char_length(btrim(p_location_code)) not between 1 and 80 or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 160 then raise exception using errcode='22023', message='GS_LOCATION_INVALID'; end if;
  if p_id is null then insert into public.locations(location_code, display_name) values (btrim(p_location_code), btrim(p_display_name)) returning id into v_id;
  else update public.locations set location_code=btrim(p_location_code), display_name=btrim(p_display_name) where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if; end if;
  perform private.admin_audit(v_actor, 'inventory.location_saved', 'location', v_id, jsonb_build_object('location_code', btrim(p_location_code)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.catalogue_upsert_book(
  p_id uuid, p_title text, p_subtitle text default null, p_isbn text default null, p_edition text default null,
  p_publication_year integer default null, p_language_code text default null, p_publisher_id uuid default null,
  p_description text default null, p_author_ids uuid[] default '{}', p_category_ids uuid[] default '{}', p_subject_ids uuid[] default '{}',
  p_expected_updated_at timestamptz default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_updated timestamptz; v_count integer;
begin
  v_actor := private.require_catalogue_operator();
  if p_title is null or char_length(btrim(p_title)) not between 1 and 300 then raise exception using errcode='22023', message='GS_BOOK_TITLE_REQUIRED'; end if;
  if p_description is not null and char_length(p_description) > 10000 then raise exception using errcode='22023', message='GS_DESCRIPTION_TOO_LONG'; end if;
  if p_publisher_id is not null and not exists(select 1 from public.publishers where id=p_publisher_id) then raise exception using errcode='P0001', message='GS_PUBLISHER_NOT_FOUND'; end if;
  if exists(select 1 from unnest(coalesce(p_author_ids, '{}')) as x where not exists(select 1 from public.authors where id=x)) then raise exception using errcode='P0001', message='GS_AUTHOR_NOT_FOUND'; end if;
  if exists(select 1 from unnest(coalesce(p_category_ids, '{}')) as x where not exists(select 1 from public.categories where id=x)) then raise exception using errcode='P0001', message='GS_CATEGORY_NOT_FOUND'; end if;
  if exists(select 1 from unnest(coalesce(p_subject_ids, '{}')) as x where not exists(select 1 from public.subjects where id=x)) then raise exception using errcode='P0001', message='GS_SUBJECT_NOT_FOUND'; end if;
  if p_id is null then
    insert into public.books(title, subtitle, isbn, edition, publication_year, language_code, publisher_id, description)
    values (btrim(p_title), nullif(btrim(p_subtitle),''), nullif(btrim(p_isbn),''), nullif(btrim(p_edition),''), p_publication_year, nullif(btrim(p_language_code),''), p_publisher_id, nullif(btrim(p_description),'')) returning id into v_id;
  else
    select updated_at into v_updated from public.books where id=p_id for update;
    if v_updated is null then raise exception using errcode='P0001', message='GS_BOOK_NOT_FOUND'; end if;
    if p_expected_updated_at is null or p_expected_updated_at <> v_updated then raise exception using errcode='P0001', message='GS_STALE_UPDATE'; end if;
    update public.books set title=btrim(p_title), subtitle=nullif(btrim(p_subtitle),''), isbn=nullif(btrim(p_isbn),''), edition=nullif(btrim(p_edition),''), publication_year=p_publication_year, language_code=nullif(btrim(p_language_code),''), publisher_id=p_publisher_id, description=nullif(btrim(p_description),'') where id=p_id returning id into v_id;
  end if;
  delete from public.book_authors where book_id=v_id;
  insert into public.book_authors(book_id, author_id, author_order) select v_id, x, row_number() over ()::integer from unnest(coalesce(p_author_ids, '{}')) as x;
  delete from public.book_categories where book_id=v_id;
  insert into public.book_categories(book_id, category_id) select v_id, x from unnest(coalesce(p_category_ids, '{}')) as x;
  delete from public.book_subjects where book_id=v_id;
  insert into public.book_subjects(book_id, subject_id) select v_id, x from unnest(coalesce(p_subject_ids, '{}')) as x;
  select count(*) into v_count from public.book_authors where book_id=v_id;
  if v_count = 0 then raise exception using errcode='P0001', message='GS_AUTHOR_REQUIRED'; end if;
  perform private.admin_audit(v_actor, case when p_id is null then 'catalogue.book_created' else 'catalogue.book_updated' end, 'book', v_id, jsonb_build_object('title', btrim(p_title)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_BOOK_DUPLICATE';
end;
$$;

create or replace function public.catalogue_set_book_status(p_book_id uuid, p_status text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_status not in ('active','archived') then raise exception using errcode='22023', message='GS_STATUS_INVALID'; end if;
  update public.books set status=p_status where id=p_book_id;
  if not found then raise exception using errcode='P0001', message='GS_BOOK_NOT_FOUND'; end if;
  perform private.admin_audit(v_actor, 'catalogue.book_status_changed', 'book', p_book_id, jsonb_build_object('status', p_status));
  return true;
end;
$$;

create or replace function public.inventory_upsert_copy(
  p_id uuid, p_book_id uuid, p_accession_number text, p_barcode text default null, p_location_id uuid default null,
  p_acquired_on date default null, p_acquisition_source text default null, p_replacement_cost_minor bigint default null,
  p_condition_status text default 'good', p_operational_state text default 'active', p_expected_updated_at timestamptz default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_updated timestamptz;
begin
  v_actor := private.require_catalogue_operator();
  if p_book_id is null or not exists(select 1 from public.books where id=p_book_id) then raise exception using errcode='P0001', message='GS_BOOK_NOT_FOUND'; end if;
  if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id) then raise exception using errcode='P0001', message='GS_LOCATION_NOT_FOUND'; end if;
  if p_accession_number is null or char_length(btrim(p_accession_number)) not between 1 and 120 then raise exception using errcode='22023', message='GS_ACCESSION_REQUIRED'; end if;
  if p_condition_status not in ('good','fair','poor') or p_operational_state not in ('active','maintenance','lost','damaged','withdrawn') then raise exception using errcode='22023', message='GS_COPY_STATE_INVALID'; end if;
  if p_replacement_cost_minor is not null and p_replacement_cost_minor < 0 then raise exception using errcode='22023', message='GS_COPY_COST_INVALID'; end if;
  if p_id is null then insert into public.book_copies(book_id, accession_number, barcode, location_id, acquired_on, acquisition_source, replacement_cost_minor, condition_status, operational_state) values(p_book_id,btrim(p_accession_number),nullif(btrim(p_barcode),''),p_location_id,p_acquired_on,nullif(btrim(p_acquisition_source),''),p_replacement_cost_minor,p_condition_status,p_operational_state) returning id into v_id;
  else
    select updated_at into v_updated from public.book_copies where id=p_id for update;
    if v_updated is null then raise exception using errcode='P0001', message='GS_COPY_NOT_FOUND'; end if;
    if p_expected_updated_at is null or p_expected_updated_at <> v_updated then raise exception using errcode='P0001', message='GS_STALE_UPDATE'; end if;
    if p_operational_state <> 'active' and exists(select 1 from public.loans where book_copy_id=p_id and status='active') then raise exception using errcode='P0001', message='GS_COPY_ON_LOAN'; end if;
    update public.book_copies set book_id=p_book_id, accession_number=btrim(p_accession_number), barcode=nullif(btrim(p_barcode),''), location_id=p_location_id, acquired_on=p_acquired_on, acquisition_source=nullif(btrim(p_acquisition_source),''), replacement_cost_minor=p_replacement_cost_minor, condition_status=p_condition_status, operational_state=p_operational_state where id=p_id returning id into v_id;
  end if;
  perform private.admin_audit(v_actor, case when p_id is null then 'inventory.copy_created' else 'inventory.copy_updated' end, 'book_copy', v_id, jsonb_build_object('accession_number', btrim(p_accession_number), 'operational_state', p_operational_state));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_ACCESSION_DUPLICATE';
end;
$$;

create or replace function public.member_upsert(
  p_id uuid, p_member_identifier text, p_member_kind text, p_display_name text, p_status text default 'active',
  p_expected_updated_at timestamptz default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_updated timestamptz;
begin
  v_actor := private.require_catalogue_operator();
  if p_member_identifier is null or char_length(btrim(p_member_identifier)) not between 1 and 120 or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 200 then raise exception using errcode='22023', message='GS_MEMBER_INPUT_INVALID'; end if;
  if p_member_kind not in ('student','teacher','staff','other') or p_status not in ('active','inactive','archived') then raise exception using errcode='22023', message='GS_MEMBER_INPUT_INVALID'; end if;
  if p_id is null then insert into public.members(member_identifier,member_kind,display_name,status) values(btrim(p_member_identifier),p_member_kind,btrim(p_display_name),p_status) returning id into v_id;
  else select updated_at into v_updated from public.members where id=p_id for update; if v_updated is null then raise exception using errcode='P0001', message='GS_MEMBER_NOT_FOUND'; end if; if p_expected_updated_at is null or p_expected_updated_at <> v_updated then raise exception using errcode='P0001', message='GS_STALE_UPDATE'; end if; update public.members set member_identifier=btrim(p_member_identifier), member_kind=p_member_kind, display_name=btrim(p_display_name), status=p_status where id=p_id returning id into v_id; end if;
  perform private.admin_audit(v_actor, case when p_id is null then 'member.created' else 'member.updated' end, 'member', v_id, jsonb_build_object('member_identifier',btrim(p_member_identifier)));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_MEMBER_IDENTIFIER_DUPLICATE';
end;
$$;

create or replace function public.member_set_enrollment(p_member_id uuid, p_academic_session_id uuid, p_grade_level_id uuid, p_section_id uuid, p_status text default 'active')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if not exists(select 1 from public.members where id=p_member_id and member_kind='student') then raise exception using errcode='P0001', message='GS_STUDENT_MEMBER_REQUIRED'; end if;
  if p_status not in ('active','completed','withdrawn') or not exists(select 1 from public.academic_sessions where id=p_academic_session_id) or not exists(select 1 from public.grade_levels where id=p_grade_level_id) or not exists(select 1 from public.sections where id=p_section_id) then raise exception using errcode='22023', message='GS_ENROLLMENT_INPUT_INVALID'; end if;
  insert into public.student_enrollments(member_id,academic_session_id,grade_level_id,section_id,status) values(p_member_id,p_academic_session_id,p_grade_level_id,p_section_id,p_status)
  on conflict(member_id,academic_session_id) do update set grade_level_id=excluded.grade_level_id, section_id=excluded.section_id, status=excluded.status returning id into v_id;
  perform private.admin_audit(v_actor,'member.enrollment_saved','member',p_member_id,jsonb_build_object('academic_session_id',p_academic_session_id));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_ENROLLMENT_DUPLICATE';
end;
$$;

create or replace function public.admin_upsert_academic_session(p_id uuid,p_session_code text,p_display_label text,p_starts_on date,p_ends_on date,p_status text default 'planned') returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid; v_id uuid; begin v_actor:=private.require_administrator(); if p_session_code is null or btrim(p_session_code)='' or p_display_label is null or btrim(p_display_label)='' or p_ends_on<p_starts_on or p_status not in('planned','active','closed','archived') then raise exception using errcode='22023',message='GS_ACADEMIC_SESSION_INVALID'; end if; if p_id is null then insert into public.academic_sessions(session_code,display_label,starts_on,ends_on,status) values(btrim(p_session_code),btrim(p_display_label),p_starts_on,p_ends_on,p_status) returning id into v_id; else update public.academic_sessions set session_code=btrim(p_session_code),display_label=btrim(p_display_label),starts_on=p_starts_on,ends_on=p_ends_on,status=p_status where id=p_id returning id into v_id; if v_id is null then raise exception using errcode='P0001',message='GS_REFERENCE_NOT_FOUND'; end if; end if; perform private.admin_audit(v_actor,'admin.academic_session_saved','academic_session',v_id,'{}'); return v_id; exception when unique_violation then raise exception using errcode='23505',message='GS_REFERENCE_DUPLICATE'; end; $$;

create or replace function public.admin_upsert_grade(p_id uuid,p_grade_code text,p_display_name text,p_sort_order integer default 0) returns uuid language plpgsql volatile security definer set search_path='' as $$ declare v_actor uuid;v_id uuid;begin v_actor:=private.require_administrator();if p_grade_code is null or btrim(p_grade_code)='' or p_display_name is null or btrim(p_display_name)='' or p_sort_order<0 then raise exception using errcode='22023',message='GS_ACADEMIC_INPUT_INVALID';end if;if p_id is null then insert into public.grade_levels(grade_code,display_name,sort_order) values(btrim(p_grade_code),btrim(p_display_name),p_sort_order) returning id into v_id;else update public.grade_levels set grade_code=btrim(p_grade_code),display_name=btrim(p_display_name),sort_order=p_sort_order where id=p_id returning id into v_id;if v_id is null then raise exception using errcode='P0001',message='GS_REFERENCE_NOT_FOUND';end if;end if;perform private.admin_audit(v_actor,'admin.grade_saved','grade_level',v_id,'{}');return v_id;exception when unique_violation then raise exception using errcode='23505',message='GS_REFERENCE_DUPLICATE';end;$$;

create or replace function public.admin_upsert_section(p_id uuid,p_section_code text,p_display_name text,p_sort_order integer default 0) returns uuid language plpgsql volatile security definer set search_path='' as $$ declare v_actor uuid;v_id uuid;begin v_actor:=private.require_administrator();if p_section_code is null or btrim(p_section_code)='' or p_display_name is null or btrim(p_display_name)='' or p_sort_order<0 then raise exception using errcode='22023',message='GS_ACADEMIC_INPUT_INVALID';end if;if p_id is null then insert into public.sections(section_code,display_name,sort_order) values(btrim(p_section_code),btrim(p_display_name),p_sort_order) returning id into v_id;else update public.sections set section_code=btrim(p_section_code),display_name=btrim(p_display_name),sort_order=p_sort_order where id=p_id returning id into v_id;if v_id is null then raise exception using errcode='P0001',message='GS_REFERENCE_NOT_FOUND';end if;end if;perform private.admin_audit(v_actor,'admin.section_saved','section',v_id,'{}');return v_id;exception when unique_violation then raise exception using errcode='23505',message='GS_REFERENCE_DUPLICATE';end;$$;

create or replace function public.admin_upsert_setting(p_setting_key text,p_boolean_value boolean default null,p_integer_value bigint default null,p_money_minor_value bigint default null) returns boolean language plpgsql volatile security definer set search_path='' as $$ declare v_actor uuid;begin v_actor:=private.require_administrator();if p_setting_key not in('fines_enabled','default_loan_period_days','checkout_limit','renewal_limit','grace_period_days','daily_fine_rate_minor') then raise exception using errcode='22023',message='GS_SETTING_INVALID';end if;if p_setting_key='fines_enabled' and p_boolean_value is null then raise exception using errcode='22023',message='GS_SETTING_INVALID';end if;if p_setting_key<>'fines_enabled' and (coalesce(p_integer_value,p_money_minor_value) is null or coalesce(p_integer_value,p_money_minor_value)<0) then raise exception using errcode='22023',message='GS_SETTING_INVALID';end if;if p_setting_key='daily_fine_rate_minor' then insert into public.library_settings(setting_key,value_kind,money_minor_value,currency_code,updated_by_profile_id) values(p_setting_key,'money_minor',p_money_minor_value,'INR',v_actor) on conflict(setting_key) do update set value_kind='money_minor',money_minor_value=excluded.money_minor_value,currency_code='INR',updated_by_profile_id=v_actor;else if p_setting_key='fines_enabled' then insert into public.library_settings(setting_key,value_kind,boolean_value,updated_by_profile_id) values(p_setting_key,'boolean',p_boolean_value,v_actor) on conflict(setting_key) do update set value_kind='boolean',boolean_value=excluded.boolean_value,updated_by_profile_id=v_actor;else insert into public.library_settings(setting_key,value_kind,integer_value,updated_by_profile_id) values(p_setting_key,'integer',p_integer_value,v_actor) on conflict(setting_key) do update set value_kind='integer',integer_value=excluded.integer_value,updated_by_profile_id=v_actor;end if;end if;perform private.admin_audit(v_actor,'admin.setting_saved','library_setting',null,jsonb_build_object('setting_key',p_setting_key));return true;end;$$;

create or replace function public.catalogue_set_book_cover(p_book_id uuid,p_cover_storage_path text) returns boolean language plpgsql volatile security definer set search_path='' as $$ declare v_actor uuid;begin v_actor:=private.require_catalogue_operator();if p_cover_storage_path is not null and (char_length(p_cover_storage_path)>512 or p_cover_storage_path !~ '^book-covers/[0-9a-f-]+/[a-z0-9-]+[.](jpg|jpeg|png|webp)$') then raise exception using errcode='22023',message='GS_COVER_PATH_INVALID';end if;update public.books set cover_storage_path=p_cover_storage_path where id=p_book_id;if not found then raise exception using errcode='P0001',message='GS_BOOK_NOT_FOUND';end if;perform private.admin_audit(v_actor,'catalogue.book_cover_changed','book',p_book_id,jsonb_build_object('has_cover',p_cover_storage_path is not null));return true;end;$$;

create or replace function public.catalogue_books(p_search text default null) returns table(id uuid,title text,subtitle text,isbn text,status text,publisher_name text,author_names text,total_copies bigint,available_copies bigint,on_loan_copies bigint,cover_storage_path text,updated_at timestamptz) language sql stable security definer set search_path='' as $$
select b.id,b.title,b.subtitle,b.isbn,b.status,p.name,coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id),'No author'),(select count(*) from public.book_copies c where c.book_id=b.id),(select count(*) from public.book_copies c where c.book_id=b.id and c.operational_state='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),(select count(*) from public.book_copies c where c.book_id=b.id and exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),b.cover_storage_path,b.updated_at from public.books b left join public.publishers p on p.id=b.publisher_id where private.is_active_operator() and (p_search is null or p_search='' or b.title ilike '%'||p_search||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(p_search)||'%' or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id and a.display_name ilike '%'||p_search||'%')) order by b.title limit 100;$$;

create or replace function public.catalogue_members(p_search text default null) returns table(id uuid,member_identifier text,display_name text,member_kind text,status text,active_loans bigint,overdue_loans bigint,enrollment_label text,updated_at timestamptz) language sql stable security definer set search_path='' as $$
select m.id,m.member_identifier,m.display_name,m.member_kind,m.status,(select count(*) from public.loans l where l.member_id=m.id and l.status='active'),(select count(*) from public.loans l where l.member_id=m.id and l.status='active' and l.due_at<timezone('utc',now())),(select s.display_label||' / '||g.display_name||' / '||se.section_id::text from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id join public.grade_levels g on g.id=se.grade_level_id where se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),m.updated_at from public.members m where private.is_active_operator() and (p_search is null or p_search='' or m.display_name ilike '%'||p_search||'%' or m.member_identifier ilike '%'||p_search||'%') order by m.display_name limit 100;$$;

create or replace function public.inventory_copies(p_search text default null) returns table(id uuid,book_id uuid,title text,accession_number text,barcode text,location_name text,operational_state text,condition_status text,on_loan boolean,updated_at timestamptz) language sql stable security definer set search_path='' as $$ select c.id,c.book_id,b.title,c.accession_number,c.barcode,l.display_name,c.operational_state,c.condition_status,exists(select 1 from public.loans lo where lo.book_copy_id=c.id and lo.status='active'),c.updated_at from public.book_copies c join public.books b on b.id=c.book_id left join public.locations l on l.id=c.location_id where private.is_active_operator() and (p_search is null or p_search='' or c.accession_number ilike '%'||p_search||'%' or coalesce(c.barcode,'') ilike '%'||p_search||'%' or b.title ilike '%'||p_search||'%') order by b.title,c.accession_number limit 200; $$;

create or replace function public.global_search(p_query text) returns table(result_type text,result_id uuid,label text,detail text,status text) language sql stable security definer set search_path='' as $$ select 'book',b.id,b.title,coalesce(b.isbn,'No ISBN'),b.status from public.books b where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (b.title ilike '%'||p_query||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(p_query)||'%') union all select 'member',m.id,m.display_name,m.member_identifier,m.status from public.members m where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%') union all select 'loan',lo.id,b.title||' → '||m.display_name,'Due '||to_char(lo.due_at,'YYYY-MM-DD'),lo.status from public.loans lo join public.book_copies c on c.id=lo.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=lo.member_id where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%') order by 3 limit 50; $$;

create or replace function public.operator_dashboard() returns table(total_books bigint,total_copies bigint,available_copies bigint,active_loans bigint,overdue_loans bigint,active_members bigint,fines_outstanding_minor bigint) language sql stable security definer set search_path='' as $$ select (select count(*) from public.books where status='active'),(select count(*) from public.book_copies),(select count(*) from public.book_copies c where c.operational_state='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),(select count(*) from public.loans where status='active'),(select count(*) from public.loans where status='active' and due_at<timezone('utc',now())),(select count(*) from public.members where status='active'),(select coalesce(sum(assessed_amount_minor-waived_amount_minor-settled_amount_minor),0) from public.fines where assessed_amount_minor-waived_amount_minor-settled_amount_minor>0) where private.is_active_operator(); $$;

create or replace function public.report_circulation() returns table(loan_id uuid,title text,accession_number text,member_name text,member_identifier text,issued_at timestamptz,due_at timestamptz,returned_at timestamptz,status text) language sql stable security definer set search_path='' as $$ select lo.id,b.title,c.accession_number,m.display_name,m.member_identifier,lo.issued_at,lo.due_at,lo.returned_at,lo.status from public.loans lo join public.book_copies c on c.id=lo.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=lo.member_id where private.is_active_operator() order by lo.issued_at desc limit 500; $$;

create or replace function public.report_overdue() returns table(loan_id uuid,title text,member_name text,member_identifier text,due_at timestamptz,days_overdue bigint) language sql stable security definer set search_path='' as $$ select lo.id,b.title,m.display_name,m.member_identifier,lo.due_at,ceil(extract(epoch from (timezone('utc',now())-lo.due_at))/86400)::bigint from public.loans lo join public.book_copies c on c.id=lo.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=lo.member_id where private.is_active_operator() and lo.status='active' and lo.due_at<timezone('utc',now()) order by lo.due_at limit 500; $$;

create or replace function public.report_popular_books() returns table(book_id uuid,title text,loan_count bigint) language sql stable security definer set search_path='' as $$ select b.id,b.title,count(lo.id) from public.books b join public.book_copies c on c.book_id=b.id join public.loans lo on lo.book_copy_id=c.id where private.is_active_operator() group by b.id,b.title order by count(lo.id) desc,b.title limit 100; $$;

create or replace function public.report_member_activity() returns table(member_id uuid,member_name text,member_identifier text,loan_count bigint,active_loans bigint) language sql stable security definer set search_path='' as $$ select m.id,m.display_name,m.member_identifier,count(lo.id),count(lo.id) filter(where lo.status='active') from public.members m left join public.loans lo on lo.member_id=m.id where private.is_active_operator() group by m.id,m.display_name,m.member_identifier order by count(lo.id) desc,m.display_name limit 200; $$;

create or replace function public.report_inventory() returns table(book_id uuid,title text,total_copies bigint,available_copies bigint,on_loan_copies bigint,unavailable_copies bigint) language sql stable security definer set search_path='' as $$ select b.id,b.title,count(c.id),count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.book_copy_id=c.id and lo.status='active')),count(c.id) filter(where exists(select 1 from public.loans lo where lo.book_copy_id=c.id and lo.status='active')),count(c.id) filter(where c.operational_state<>'active') from public.books b left join public.book_copies c on c.book_id=b.id where private.is_active_operator() group by b.id,b.title order by b.title; $$;

create or replace function public.report_fines() returns table(fine_id uuid,loan_id uuid,fine_kind text,assessed_amount_minor bigint,waived_amount_minor bigint,settled_amount_minor bigint,outstanding_minor bigint,created_at timestamptz,reason text) language sql stable security definer set search_path='' as $$ select f.id,f.loan_id,f.fine_kind,f.assessed_amount_minor,f.waived_amount_minor,f.settled_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor,f.created_at,f.reason from public.fines f where private.is_active_operator() order by f.created_at desc limit 500; $$;

create or replace function public.admin_audit_events(p_action text default null,p_target_type text default null) returns table(id uuid,actor_name text,action text,target_type text,target_id uuid,occurred_at timestamptz,metadata jsonb) language sql stable security definer set search_path='' as $$ select e.id,p.display_name,e.action,e.target_type,e.target_id,e.occurred_at,e.metadata from public.audit_events e left join public.profiles p on p.id=e.actor_profile_id where private.is_administrator() and (p_action is null or e.action ilike '%'||p_action||'%') and (p_target_type is null or e.target_type=p_target_type) order by e.occurred_at desc limit 500; $$;

alter function private.admin_audit(uuid,text,text,uuid,jsonb) owner to postgres;
alter function private.require_catalogue_operator() owner to postgres;
revoke all on function private.admin_audit(uuid,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.require_catalogue_operator() from public,anon,authenticated,service_role;

do $$ declare f text; begin
  foreach f in array array['catalogue_upsert_author(uuid,text)','catalogue_upsert_publisher(uuid,text)','catalogue_upsert_category(uuid,text)','catalogue_upsert_subject(uuid,text)','catalogue_upsert_location(uuid,text,text)','catalogue_upsert_book(uuid,text,text,text,text,integer,text,uuid,text,uuid[],uuid[],uuid[],timestamptz)','catalogue_set_book_status(uuid,text)','inventory_upsert_copy(uuid,uuid,text,text,uuid,date,text,bigint,text,text,timestamptz)','member_upsert(uuid,text,text,text,text,timestamptz)','member_set_enrollment(uuid,uuid,uuid,uuid,text)','admin_upsert_academic_session(uuid,text,text,date,date,text)','admin_upsert_grade(uuid,text,text,integer)','admin_upsert_section(uuid,text,text,integer)','admin_upsert_setting(text,boolean,bigint,bigint)','catalogue_set_book_cover(uuid,text)','catalogue_books(text)','catalogue_members(text)','inventory_copies(text)','global_search(text)','operator_dashboard()','report_circulation()','report_overdue()','report_popular_books()','report_member_activity()','report_inventory()','report_fines()','admin_audit_events(text,text)'] loop
    execute 'revoke all on function public.'||f||' from public,anon,service_role';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;

comment on table public.books is 'Catalogue metadata; availability is derived from book_copies and active loans. cover_storage_path points to the private book-covers bucket.';
