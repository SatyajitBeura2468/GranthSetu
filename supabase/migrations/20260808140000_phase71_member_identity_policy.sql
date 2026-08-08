-- Phase 7.1 forward migration: stable member identity, enrollment invariants,
-- policy controls, and trusted mutation boundaries. Existing migrations remain
-- immutable; this migration deliberately repairs forward.

alter index if exists public.fines_one_automated_overdue_per_loan rename to fines_loan_kind_unique;
create unique index if not exists fines_loan_kind_unique on public.fines (loan_id) where fine_kind = 'overdue';

alter table public.student_enrollments add column if not exists roll_number text;
alter table public.student_enrollments drop constraint if exists student_enrollments_roll_number_check;
alter table public.student_enrollments add constraint student_enrollments_roll_number_check
  check (roll_number is null or (roll_number = btrim(roll_number) and char_length(roll_number) between 1 and 40 and roll_number !~ '[[:cntrl:]]'));

create unique index if not exists student_enrollments_active_roll_unique
  on public.student_enrollments (academic_session_id, grade_level_id, section_id, lower(btrim(roll_number)))
  where status = 'active' and roll_number is not null and btrim(roll_number) <> '';

-- Older deployments allowed one active row per member and academic session,
-- so a member may already have active rows in multiple sessions. Preserve all
-- rows while retaining an operationally current enrollment first. This is the
-- same eligibility predicate used by circulation issue and renewal policy:
-- active enrollment + active session + current_date inside the session range.
-- If multiple sessions are currently in range, prefer the latest current
-- session chronology. Only when none is currently in range do we fall back to
-- session chronology across historical/future rows, then creation time and
-- stable row id. No enrollment data is copied or deleted.
with ranked_active_enrollments as (
  select se.id,
    row_number() over (
      partition by se.member_id
      order by
        (s.status = 'active' and current_date between s.starts_on and s.ends_on) desc,
        case when s.status = 'active' and current_date between s.starts_on and s.ends_on then s.starts_on end desc,
        case when s.status = 'active' and current_date between s.starts_on and s.ends_on then s.ends_on end desc,
        s.starts_on desc,
        s.ends_on desc,
        se.created_at desc,
        se.id desc
    ) as row_number
  from public.student_enrollments se
  join public.academic_sessions s on s.id = se.academic_session_id
  where se.status = 'active'
)
update public.student_enrollments se
set status = 'completed'
from ranked_active_enrollments ranked
where ranked.id = se.id and ranked.row_number > 1;

create unique index if not exists student_enrollments_one_active_per_member
  on public.student_enrollments (member_id)
  where status = 'active';
create index if not exists student_enrollments_roll_search_index
  on public.student_enrollments (lower(btrim(roll_number)))
  where roll_number is not null;

-- A zero-day default was valid before Phase 7.1 but is not operationally usable.
-- Remove it before tightening the constraint so upgrades fail closed instead of aborting.
delete from public.library_settings
where setting_key = 'default_loan_period_days' and value_kind = 'integer' and integer_value = 0;

alter table public.library_settings drop constraint if exists library_settings_key_check;
alter table public.library_settings drop constraint if exists library_settings_key_kind_check;
alter table public.library_settings drop constraint if exists library_settings_one_typed_value_check;
alter table public.library_settings add constraint library_settings_key_check check (
  setting_key in ('fines_enabled','default_loan_period_days','checkout_limit','renewal_limit',
    'grace_period_days','daily_fine_rate_minor','overdue_renewal_allowed','librarian_waiver_allowed')
);
alter table public.library_settings add constraint library_settings_key_kind_check check (
  (setting_key in ('fines_enabled','overdue_renewal_allowed','librarian_waiver_allowed') and value_kind = 'boolean')
  or (setting_key in ('default_loan_period_days','checkout_limit','renewal_limit','grace_period_days') and value_kind = 'integer')
  or (setting_key = 'daily_fine_rate_minor' and value_kind = 'money_minor')
);
alter table public.library_settings add constraint library_settings_one_typed_value_check check (
  (value_kind = 'boolean' and boolean_value is not null and integer_value is null and money_minor_value is null and currency_code is null)
  or (value_kind = 'integer' and boolean_value is null and integer_value is not null and integer_value >= 0 and money_minor_value is null and currency_code is null
    and (setting_key <> 'default_loan_period_days' or integer_value > 0))
  or (value_kind = 'money_minor' and boolean_value is null and integer_value is null and money_minor_value is not null and money_minor_value >= 0 and currency_code = 'INR')
);

create sequence if not exists private.member_identifier_sequence;
alter sequence private.member_identifier_sequence owner to postgres;

create or replace function private.generate_member_identifier()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_candidate text;
begin
  loop
    v_candidate := 'GS-' || lpad(nextval('private.member_identifier_sequence')::text, 6, '0');
    exit when not exists (select 1 from public.members where member_identifier = v_candidate);
  end loop;
  return v_candidate;
end;
$$;
alter function private.generate_member_identifier() owner to postgres;
revoke all on function private.generate_member_identifier() from public, anon, authenticated, service_role;
revoke all on sequence private.member_identifier_sequence from public, anon, authenticated, service_role;

create or replace function public.inventory_upsert_copy(
  p_id uuid, p_book_id uuid, p_accession_number text, p_barcode text default null, p_location_id uuid default null,
  p_acquired_on date default null, p_acquisition_source text default null, p_replacement_cost_minor bigint default null,
  p_condition_status text default 'good', p_operational_state text default 'active', p_expected_updated_at timestamptz default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_updated timestamptz; v_old_book uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_book_id is null or not exists(select 1 from public.books where id=p_book_id) then raise exception using errcode='P0001', message='GS_BOOK_NOT_FOUND'; end if;
  if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id) then raise exception using errcode='P0001', message='GS_LOCATION_NOT_FOUND'; end if;
  if p_accession_number is null or char_length(btrim(p_accession_number)) not between 1 and 120 then raise exception using errcode='22023', message='GS_ACCESSION_REQUIRED'; end if;
  if p_condition_status not in ('good','fair','poor') or p_operational_state not in ('active','maintenance','lost','damaged','withdrawn') then raise exception using errcode='22023', message='GS_COPY_STATE_INVALID'; end if;
  if p_replacement_cost_minor is not null and p_replacement_cost_minor < 0 then raise exception using errcode='22023', message='GS_COPY_COST_INVALID'; end if;
  if p_id is null then
    insert into public.book_copies(book_id,accession_number,barcode,location_id,acquired_on,acquisition_source,replacement_cost_minor,condition_status,operational_state)
      values(p_book_id,btrim(p_accession_number),nullif(btrim(p_barcode),''),p_location_id,p_acquired_on,nullif(btrim(p_acquisition_source),''),p_replacement_cost_minor,p_condition_status,p_operational_state) returning id into v_id;
  else
    select updated_at,book_id into v_updated,v_old_book from public.book_copies where id=p_id for update;
    if v_updated is null then raise exception using errcode='P0001', message='GS_COPY_NOT_FOUND'; end if;
    if p_expected_updated_at is null or p_expected_updated_at <> v_updated then raise exception using errcode='P0001', message='GS_STALE_UPDATE'; end if;
    if v_old_book <> p_book_id and exists(select 1 from public.loans where book_copy_id=p_id) then raise exception using errcode='P0001', message='GS_COPY_BOOK_IMMUTABLE'; end if;
    if p_operational_state <> 'active' and exists(select 1 from public.loans where book_copy_id=p_id and status='active') then raise exception using errcode='P0001', message='GS_COPY_ON_LOAN'; end if;
    update public.book_copies set book_id=p_book_id,accession_number=btrim(p_accession_number),barcode=nullif(btrim(p_barcode),''),location_id=p_location_id,acquired_on=p_acquired_on,acquisition_source=nullif(btrim(p_acquisition_source),''),replacement_cost_minor=p_replacement_cost_minor,condition_status=p_condition_status,operational_state=p_operational_state where id=p_id returning id into v_id;
  end if;
  perform private.admin_audit(v_actor,case when p_id is null then 'inventory.copy_created' else 'inventory.copy_updated' end,'book_copy',v_id,jsonb_build_object('accession_number',btrim(p_accession_number),'operational_state',p_operational_state));
  return v_id;
exception when unique_violation then raise exception using errcode='23505', message='GS_ACCESSION_DUPLICATE';
end;
$$;

create or replace function public.global_search(p_query text)
returns table(result_type text,result_id uuid,label text,detail text,status text)
language sql stable security definer set search_path = '' as $$
  select 'book',b.id,b.title,coalesce(b.isbn,'No ISBN'),b.status from public.books b
    where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (b.title ilike '%'||p_query||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(p_query)||'%')
  union all
  select 'member',m.id,m.display_name,m.member_identifier,m.status from public.members m
    where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%')
  union all
  select 'loan',l.id,b.title||' → '||m.display_name,'Due '||to_char(l.due_at,'YYYY-MM-DD'),l.status from public.loans l join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=l.member_id
    where private.is_active_operator() and char_length(btrim(coalesce(p_query,'')))>=2 and (b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%')
  order by 3 limit 50;
$$;

create or replace function public.member_create_with_enrollment(
  p_display_name text, p_member_kind text, p_status text default 'active',
  p_academic_session_id uuid default null, p_grade_level_id uuid default null,
  p_section_id uuid default null, p_roll_number text default null,
  p_enrollment_status text default 'active'
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_roll text;
begin
  v_actor := private.require_catalogue_operator();
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 200
    or p_member_kind not in ('student','teacher','staff','other')
    or p_status not in ('active','inactive','archived') then
    raise exception using errcode = '22023', message = 'GS_MEMBER_INPUT_INVALID';
  end if;
  v_roll := nullif(btrim(p_roll_number), '');
  if v_roll is not null and (char_length(v_roll) > 40 or v_roll ~ '[[:cntrl:]]') then
    raise exception using errcode = '22023', message = 'GS_ROLL_INVALID';
  end if;
  if p_member_kind = 'student' then
    if p_academic_session_id is null or p_grade_level_id is null or p_section_id is null
      or not exists (select 1 from public.academic_sessions where id = p_academic_session_id)
      or not exists (select 1 from public.grade_levels where id = p_grade_level_id)
      or not exists (select 1 from public.sections where id = p_section_id)
      or p_enrollment_status not in ('active','completed','withdrawn') then
      raise exception using errcode = '22023', message = 'GS_ENROLLMENT_INPUT_INVALID';
    end if;
    if p_enrollment_status = 'active' and not exists (
      select 1 from public.academic_sessions
      where id = p_academic_session_id
        and status = 'active'
        and current_date between starts_on and ends_on
    ) then
      raise exception using errcode = 'P0001', message = 'GS_ENROLLMENT_SESSION_NOT_CURRENT';
    end if;
  elsif p_academic_session_id is not null or p_grade_level_id is not null or p_section_id is not null or v_roll is not null then
    raise exception using errcode = '22023', message = 'GS_NONSTUDENT_ENROLLMENT_FORBIDDEN';
  end if;
  insert into public.members(member_identifier, member_kind, display_name, status)
    values (private.generate_member_identifier(), p_member_kind, btrim(p_display_name), p_status)
    returning id into v_id;
  if p_member_kind = 'student' then
    insert into public.student_enrollments(member_id, academic_session_id, grade_level_id, section_id, roll_number, status)
      values (v_id, p_academic_session_id, p_grade_level_id, p_section_id, v_roll, p_enrollment_status);
  end if;
  perform private.admin_audit(v_actor, 'member.created', 'member', v_id,
    jsonb_build_object('member_kind', p_member_kind, 'has_enrollment', p_member_kind = 'student'));
  return v_id;
exception when unique_violation then
  if sqlerrm like '%student_enrollments_active_roll_unique%' then
    raise exception using errcode = '23505', message = 'GS_ROLL_DUPLICATE';
  end if;
  raise exception using errcode = '23505', message = 'GS_MEMBER_IDENTIFIER_DUPLICATE';
end;
$$;

create or replace function public.member_update_profile(
  p_id uuid, p_member_kind text, p_display_name text, p_status text,
  p_expected_updated_at timestamptz default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_old public.members%rowtype; v_id uuid;
begin
  v_actor := private.require_catalogue_operator();
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 200
    or p_member_kind not in ('student','teacher','staff','other')
    or p_status not in ('active','inactive','archived') then
    raise exception using errcode = '22023', message = 'GS_MEMBER_INPUT_INVALID';
  end if;
  select * into v_old from public.members where id = p_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_MEMBER_NOT_FOUND'; end if;
  if p_expected_updated_at is null or p_expected_updated_at <> v_old.updated_at then
    raise exception using errcode = 'P0001', message = 'GS_STALE_UPDATE';
  end if;
  if p_member_kind <> 'student' and exists (select 1 from public.student_enrollments where member_id = p_id and status = 'active') then
    update public.student_enrollments set status = 'completed' where member_id = p_id and status = 'active';
  end if;
  update public.members set member_kind = p_member_kind, display_name = btrim(p_display_name), status = p_status
    where id = p_id returning id into v_id;
  perform private.admin_audit(v_actor, 'member.updated', 'member', v_id,
    jsonb_build_object('member_kind', p_member_kind, 'member_identifier_immutable', true));
  return v_id;
end;
$$;

create or replace function public.member_set_enrollment_v71(
  p_member_id uuid, p_academic_session_id uuid, p_grade_level_id uuid,
  p_section_id uuid, p_roll_number text default null, p_status text default 'active'
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_roll text;
begin
  v_actor := private.require_catalogue_operator();
  v_roll := nullif(btrim(p_roll_number), '');
  perform 1 from public.members where id = p_member_id and member_kind = 'student' for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_STUDENT_MEMBER_REQUIRED'; end if;
  if p_status not in ('active','completed','withdrawn') or p_academic_session_id is null or p_grade_level_id is null or p_section_id is null
    or not exists (select 1 from public.academic_sessions where id = p_academic_session_id)
    or not exists (select 1 from public.grade_levels where id = p_grade_level_id)
    or not exists (select 1 from public.sections where id = p_section_id)
    or (v_roll is not null and (char_length(v_roll) > 40 or v_roll ~ '[[:cntrl:]]')) then
    raise exception using errcode = '22023', message = 'GS_ENROLLMENT_INPUT_INVALID';
  end if;
  if p_status = 'active' and not exists (
    select 1 from public.academic_sessions
    where id = p_academic_session_id
      and status = 'active'
      and current_date between starts_on and ends_on
  ) then
    raise exception using errcode = 'P0001', message = 'GS_ENROLLMENT_SESSION_NOT_CURRENT';
  end if;
  if p_status = 'active' then
    update public.student_enrollments set status = 'completed'
      where member_id = p_member_id and status = 'active'
        and academic_session_id <> p_academic_session_id;
  end if;
  insert into public.student_enrollments(member_id, academic_session_id, grade_level_id, section_id, roll_number, status)
    values (p_member_id, p_academic_session_id, p_grade_level_id, p_section_id, v_roll, p_status)
    on conflict (member_id, academic_session_id) do update set grade_level_id = excluded.grade_level_id,
      section_id = excluded.section_id, roll_number = excluded.roll_number, status = excluded.status
    returning id into v_id;
  perform private.admin_audit(v_actor, 'member.enrollment_saved', 'member', p_member_id,
    jsonb_build_object('academic_session_id', p_academic_session_id, 'roll_number', v_roll));
  return v_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'GS_ROLL_DUPLICATE';
end;
$$;

create or replace function public.admin_upsert_setting(
  p_setting_key text, p_boolean_value boolean default null,
  p_integer_value bigint default null, p_money_minor_value bigint default null
)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_kind text; v_value bigint;
begin
  v_actor := private.require_administrator();
  if p_setting_key not in ('fines_enabled','default_loan_period_days','checkout_limit','renewal_limit',
    'grace_period_days','daily_fine_rate_minor','overdue_renewal_allowed','librarian_waiver_allowed') then
    raise exception using errcode = '22023', message = 'GS_SETTING_INVALID';
  end if;
  if p_setting_key in ('fines_enabled','overdue_renewal_allowed','librarian_waiver_allowed') then
    if p_boolean_value is null or p_integer_value is not null or p_money_minor_value is not null then
      raise exception using errcode = '22023', message = 'GS_SETTING_INVALID';
    end if;
    v_kind := 'boolean';
  elsif p_setting_key = 'daily_fine_rate_minor' then
    if p_money_minor_value is null or p_money_minor_value < 0 or p_integer_value is not null or p_boolean_value is not null then
      raise exception using errcode = '22023', message = 'GS_SETTING_INVALID';
    end if;
    v_kind := 'money_minor';
  else
    v_value := p_integer_value;
    if v_value is null or v_value < 0 or (p_setting_key = 'default_loan_period_days' and v_value = 0)
      or p_money_minor_value is not null or p_boolean_value is not null then
      raise exception using errcode = '22023', message = 'GS_SETTING_INVALID';
    end if;
    v_kind := 'integer';
  end if;
  if p_setting_key = 'fines_enabled' and p_boolean_value and
    (private.policy_integer('grace_period_days') is null or private.policy_money('daily_fine_rate_minor') is null) then
    raise exception using errcode = 'P0001', message = 'GS_FINE_POLICY_NOT_CONFIGURED';
  end if;
  if v_kind = 'boolean' then
    insert into public.library_settings(setting_key,value_kind,boolean_value,updated_by_profile_id)
      values(p_setting_key,v_kind,p_boolean_value,v_actor)
      on conflict(setting_key) do update set value_kind=excluded.value_kind,boolean_value=excluded.boolean_value,
        integer_value=null,money_minor_value=null,currency_code=null,updated_by_profile_id=v_actor;
  elsif v_kind = 'money_minor' then
    insert into public.library_settings(setting_key,value_kind,money_minor_value,currency_code,updated_by_profile_id)
      values(p_setting_key,v_kind,p_money_minor_value,'INR',v_actor)
      on conflict(setting_key) do update set value_kind=excluded.value_kind,boolean_value=null,integer_value=null,
        money_minor_value=excluded.money_minor_value,currency_code='INR',updated_by_profile_id=v_actor;
  else
    insert into public.library_settings(setting_key,value_kind,integer_value,updated_by_profile_id)
      values(p_setting_key,v_kind,p_integer_value,v_actor)
      on conflict(setting_key) do update set value_kind=excluded.value_kind,boolean_value=null,
        integer_value=excluded.integer_value,money_minor_value=null,currency_code=null,updated_by_profile_id=v_actor;
  end if;
  perform private.admin_audit(v_actor,'admin.setting_saved','library_setting',null,jsonb_build_object('setting_key',p_setting_key));
  return true;
end;
$$;

create or replace function private.policy_boolean(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select boolean_value from public.library_settings where setting_key = p_key and value_kind = 'boolean' limit 1;
$$;
alter function private.policy_boolean(text) owner to postgres;
revoke all on function private.policy_boolean(text) from public, anon, authenticated, service_role;

create or replace function public.operator_policy_context()
returns table(policy_ready boolean, overdue_renewal_allowed boolean, librarian_waiver_allowed boolean)
language sql stable security definer set search_path = '' as $$
  select private.is_active_operator()
    and coalesce(private.policy_integer('default_loan_period_days') > 0, false)
    and coalesce(private.policy_integer('checkout_limit') >= 0, false)
    and coalesce(private.policy_integer('renewal_limit') >= 0, false),
    coalesce(private.policy_boolean('overdue_renewal_allowed'), false),
    coalesce(private.policy_boolean('librarian_waiver_allowed'), false)
  where private.is_active_operator();
$$;

create or replace function public.global_search_v71(p_query text)
returns table(result_type text, result_id uuid, label text, detail text, status text)
language sql stable security definer set search_path = '' as $$
  with q as (select btrim(coalesce(p_query,'')) as value)
  select 'book', b.id, b.title, coalesce(b.isbn, 'No ISBN') || ' · ' || coalesce((select string_agg(a.display_name, ', ') from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id), 'No author'), b.status
    from public.books b, q where private.is_active_operator() and char_length(q.value) >= 2
      and (b.title ilike '%'||q.value||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(q.value)||'%' or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id and a.display_name ilike '%'||q.value||'%'))
  union all
  select 'member', m.id, m.display_name, m.member_identifier || coalesce(' · ' || (select s.display_label||' / '||g.display_name||' / '||sec.display_name||coalesce(' / roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id join public.grade_levels g on g.id=se.grade_level_id join public.sections sec on sec.id=se.section_id where se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1), ''), m.status
    from public.members m, q where private.is_active_operator() and char_length(q.value) >= 2
      and (m.display_name ilike '%'||q.value||'%' or m.member_identifier ilike '%'||q.value||'%' or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||q.value||'%'))
  union all
  select 'copy', c.id, b.title || ' · ' || c.accession_number, coalesce(c.barcode,'No barcode') || ' · ' || coalesce(b.isbn,'No ISBN'), c.operational_state
    from public.book_copies c join public.books b on b.id=c.book_id, q where private.is_active_operator() and char_length(q.value) >= 2
      and (b.title ilike '%'||q.value||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(q.value)||'%' or c.accession_number ilike '%'||q.value||'%' or coalesce(c.barcode,'') ilike '%'||q.value||'%')
  order by 3 limit 50;
$$;

revoke all on function public.member_create_with_enrollment(text,text,text,uuid,uuid,uuid,text,text) from public, anon, service_role;
revoke all on function public.member_update_profile(uuid,text,text,text,timestamptz) from public, anon, service_role;
revoke all on function public.member_upsert(uuid,text,text,text,text,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.member_set_enrollment(uuid,uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.member_set_enrollment_v71(uuid,uuid,uuid,uuid,text,text) from public, anon, service_role;
revoke all on function public.admin_upsert_setting(text,boolean,bigint,bigint) from public, anon, service_role;
revoke all on function public.operator_policy_context() from public, anon, service_role;
revoke all on function public.global_search_v71(text) from public, anon, service_role;
grant execute on function public.member_create_with_enrollment(text,text,text,uuid,uuid,uuid,text,text), public.member_update_profile(uuid,text,text,text,timestamptz), public.member_set_enrollment_v71(uuid,uuid,uuid,uuid,text,text), public.admin_upsert_setting(text,boolean,bigint,bigint), public.operator_policy_context(), public.global_search_v71(text) to authenticated;
