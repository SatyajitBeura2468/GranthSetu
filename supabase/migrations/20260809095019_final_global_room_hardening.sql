-- Final V3 hardening. This migration intentionally repairs the additive
-- global-room upgrade without rewriting already-applied history.

alter table public.profile_roles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive'));

-- The room-local barcode index superseded the former global index. Keep a
-- stable canonical name because operational tooling and pgTAP address it.
alter index if exists public.book_copies_library_barcode_unique
  rename to book_copies_barcode_unique;

create or replace function private.request_library_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_setting text;
  v_library uuid;
  v_count integer;
begin
  v_setting := nullif(current_setting('granthsetu.library_id', true), '');
  if v_setting is not null then
    return v_setting::uuid;
  end if;

  if (select auth.uid()) is null and current_user in ('postgres', 'supabase_admin', 'service_role') then
    return '10000000-0000-0000-0000-000000000001'::uuid;
  end if;

  select count(distinct pr.library_id), min(pr.library_id)
    into v_count, v_library
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
  join public.roles r on r.id = pr.role_id
  join public.libraries l on l.id = pr.library_id and l.status = 'active'
  where p.auth_user_id = (select auth.uid())
    and p.status = 'active'
    and r.role_key in ('administrator', 'librarian');

  if v_count = 1 then return v_library; end if;
  if v_count > 1 then
    raise exception using errcode = '22023', message = 'GS_LIBRARY_CONTEXT_REQUIRED';
  end if;
  return null;
end;
$$;

create or replace function private.has_library_access(p_library_id uuid, p_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
    join public.roles r on r.id = pr.role_id
    join public.libraries l on l.id = pr.library_id
    where p.auth_user_id = (select auth.uid())
      and p.status = 'active'
      and l.status = 'active'
      and pr.library_id = p_library_id
      and r.role_key in ('administrator', 'librarian')
      and (p_role is null or r.role_key = p_role)
  )
$$;

create or replace function private.has_active_role(p_role_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_role_key is null or p_role_key not in ('administrator', 'librarian') then false
    else exists (
      select 1
      from public.profiles p
      join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
      join public.roles r on r.id = pr.role_id
      join public.libraries l on l.id = pr.library_id and l.status = 'active'
      where p.auth_user_id = (select auth.uid())
        and p.status = 'active'
        and r.role_key = p_role_key
        and (
          nullif(current_setting('granthsetu.library_id', true), '') is null
          or pr.library_id = nullif(current_setting('granthsetu.library_id', true), '')::uuid
        )
    )
  end
$$;

create or replace function private.require_operator()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid;
begin
  v_library := private.request_library_id();
  select p.id into v_profile
  from public.profiles p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active';
  if v_profile is null or v_library is null or not private.has_library_access(v_library) then
    raise exception using errcode = '42501', message = 'GS_NOT_OPERATOR';
  end if;
  perform set_config('granthsetu.library_id', v_library::text, true);
  return v_profile;
end;
$$;

create or replace function private.require_administrator()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid;
begin
  v_library := private.request_library_id();
  select p.id into v_profile
  from public.profiles p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active';
  if v_profile is null or v_library is null or not private.has_library_access(v_library, 'administrator') then
    raise exception using errcode = '42501', message = 'GS_ADMIN_REQUIRED';
  end if;
  perform set_config('granthsetu.library_id', v_library::text, true);
  return v_profile;
end;
$$;

create or replace function private.policy_integer(p_key text)
returns bigint language sql stable security definer set search_path = '' as $$
  select integer_value from public.library_settings
  where library_id = private.request_library_id()
    and setting_key = p_key and value_kind = 'integer'
  limit 1
$$;

create or replace function private.policy_money(p_key text)
returns bigint language sql stable security definer set search_path = '' as $$
  select money_minor_value from public.library_settings
  where library_id = private.request_library_id()
    and setting_key = p_key and value_kind = 'money_minor' and currency_code = 'INR'
  limit 1
$$;

create or replace function private.policy_boolean(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select boolean_value from public.library_settings
  where library_id = private.request_library_id()
    and setting_key = p_key and value_kind = 'boolean'
  limit 1
$$;

create or replace function private.fines_are_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.policy_boolean('fines_enabled'), false)
$$;

create or replace function private.append_circulation_audit(
  p_actor_profile_id uuid, p_action text, p_target_type text,
  p_target_id uuid, p_request_id uuid, p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.audit_events(library_id, actor_profile_id, action, target_type, target_id, request_id, metadata)
  values(private.request_library_id(), p_actor_profile_id, p_action, p_target_type, p_target_id,
    p_request_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function private.admin_audit(
  p_actor uuid, p_action text, p_target_type text, p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.audit_events(library_id, actor_profile_id, action, target_type, target_id, metadata)
  values(private.request_library_id(), p_actor, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Security-definer domain functions still pass through this trigger. It makes
-- the room selected by the trusted wrapper an invariant of every tenant write.
create or replace function private.enforce_tenant_write()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_expected uuid; v_actual uuid;
begin
  if (select auth.uid()) is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_expected := private.request_library_id();
  if tg_op = 'DELETE' then v_actual := old.library_id; else v_actual := new.library_id; end if;
  if v_expected is null or v_actual is distinct from v_expected then
    raise exception using errcode = '42501', message = 'GS_CROSS_LIBRARY_WRITE_DENIED';
  end if;
  if tg_op = 'UPDATE' and old.library_id is distinct from new.library_id then
    raise exception using errcode = '42501', message = 'GS_LIBRARY_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$ declare t text; begin
  foreach t in array array[
    'profile_roles','members','academic_sessions','grade_levels','sections','student_enrollments',
    'publishers','categories','subjects','authors','books','book_authors','book_categories',
    'book_subjects','locations','book_copies','loans','loan_renewals','fines','library_settings','audit_events'
  ] loop
    execute format('drop trigger if exists enforce_tenant_write on public.%I', t);
    execute format('create trigger enforce_tenant_write before insert or update or delete on public.%I for each row execute function private.enforce_tenant_write()', t);
  end loop;
end $$;

-- Complete and explicit RLS matrix: one narrow SELECT policy per application
-- table. Trusted mutations remain RPC-only because authenticated receives no DML.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy roles_operator_select on public.roles for select to authenticated
  using (private.is_active_operator());
create policy profiles_room_admin_select on public.profiles for select to authenticated
  using (exists (
    select 1 from public.profile_roles target
    where target.profile_id = profiles.id
      and target.library_id = private.request_library_id()
      and private.has_library_access(target.library_id, 'administrator')
  ));
create policy libraries_operator_select on public.libraries for select to authenticated
  using (private.has_library_access(id));

do $$ declare t text; begin
  foreach t in array array[
    'profile_roles','members','academic_sessions','grade_levels','sections','student_enrollments',
    'publishers','categories','subjects','authors','books','book_authors','book_categories',
    'book_subjects','locations','book_copies','loans','loan_renewals','fines','library_settings','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.has_library_access(library_id))', t || '_tenant_select', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated, anon', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
grant select on public.roles, public.profiles, public.libraries to authenticated;
revoke all on public.roles, public.profiles, public.libraries from anon;

-- Safe room policy bootstrap. Fines remain disabled until an administrator
-- explicitly enables them, while every typed dependency exists from day one.
insert into public.library_settings(library_id, setting_key, value_kind, boolean_value)
select l.id, k.key, 'boolean', k.value
from public.libraries l
cross join (values ('fines_enabled', false), ('overdue_renewal_allowed', false), ('librarian_waiver_allowed', false)) k(key, value)
on conflict(library_id, setting_key) do nothing;

insert into public.library_settings(library_id, setting_key, value_kind, integer_value)
select l.id, k.key, 'integer', k.value
from public.libraries l
cross join (values ('default_loan_period_days', 14::bigint), ('checkout_limit', 5::bigint), ('renewal_limit', 2::bigint), ('grace_period_days', 0::bigint)) k(key, value)
on conflict(library_id, setting_key) do nothing;

insert into public.library_settings(library_id, setting_key, value_kind, money_minor_value, currency_code)
select l.id, 'daily_fine_rate_minor', 'money_minor', 0, 'INR' from public.libraries l
on conflict(library_id, setting_key) do nothing;

create or replace function public.operator_accessible_libraries()
returns table(library_id uuid, library_code text, library_name text, roles text[])
language sql stable security definer set search_path = '' as $$
  select l.id, l.public_code, l.display_name, array_agg(r.role_key order by r.role_key)
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
  join public.roles r on r.id = pr.role_id
  join public.libraries l on l.id = pr.library_id
  where p.auth_user_id = (select auth.uid()) and p.status = 'active' and l.status = 'active'
    and r.role_key in ('administrator','librarian')
  group by l.id, l.public_code, l.display_name order by l.display_name
$$;

create or replace function public.operator_context_for_library(p_library_code text)
returns table(user_id uuid, profile_id uuid, display_name text, library_id uuid, library_code text, library_name text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.auth_user_id, p.id, p.display_name, l.id, l.public_code, l.display_name,
    array_agg(r.role_key order by r.role_key)
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
  join public.roles r on r.id = pr.role_id
  join public.libraries l on l.id = pr.library_id
  where p.auth_user_id = (select auth.uid()) and p.status = 'active' and l.status = 'active'
    and l.public_code = private.normalize_library_code(p_library_code)
    and r.role_key in ('administrator','librarian')
  group by p.auth_user_id, p.id, p.display_name, l.id, l.public_code, l.display_name
$$;

create or replace function public.current_operator_context()
returns table(user_id uuid, profile_id uuid, display_name text, status text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.auth_user_id, p.id, p.display_name, p.status,
    array_agg(distinct r.role_key order by r.role_key)
  from public.profiles p
  join public.profile_roles pr on pr.profile_id = p.id and pr.status = 'active'
  join public.roles r on r.id = pr.role_id
  join public.libraries l on l.id = pr.library_id and l.status = 'active'
  where p.auth_user_id = (select auth.uid()) and p.status = 'active'
    and r.role_key in ('administrator','librarian')
  group by p.auth_user_id, p.id, p.display_name, p.status
$$;

create or replace function public.create_library_room(p_display_name text, p_public_code text, p_creator_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_admin_role uuid; v_code text; v_status text;
begin
  if (select auth.uid()) is null then raise exception using errcode='42501', message='GS_AUTH_REQUIRED'; end if;
  v_code := private.normalize_library_code(p_public_code);
  if char_length(btrim(coalesce(p_display_name,''))) not between 3 and 160
    or char_length(btrim(coalesce(p_creator_display_name,''))) not between 2 and 120
    or v_code !~ '^[A-Z0-9](?:[A-Z0-9-]{3,14})[A-Z0-9]$' or v_code ~ '--'
    or v_code in ('ADMIN','API','AUTH','LOGIN','STAFF','OPERATOR','CREATE','SUPPORT','HELP','ROOT','SYSTEM','GRANTHSETU') then
    raise exception using errcode='22023', message='GS_LIBRARY_INPUT_INVALID';
  end if;

  select id, status into v_profile, v_status from public.profiles where auth_user_id = (select auth.uid()) for update;
  if v_profile is null then
    insert into public.profiles(auth_user_id, display_name, status)
    values((select auth.uid()), btrim(p_creator_display_name), 'active') returning id into v_profile;
  elsif v_status <> 'active' then
    raise exception using errcode='42501', message='GS_PROFILE_INACTIVE';
  end if;

  insert into public.libraries(public_code, display_name, created_by_profile_id)
  values(v_code, btrim(p_display_name), v_profile) returning id into v_library;
  perform set_config('granthsetu.library_id', v_library::text, true);
  select id into v_admin_role from public.roles where role_key='administrator';
  insert into public.profile_roles(profile_id, library_id, role_id, assigned_by_profile_id, status)
  values(v_profile, v_library, v_admin_role, v_profile, 'active');

  insert into public.library_settings(library_id, setting_key, value_kind, boolean_value, updated_by_profile_id)
  values
    (v_library,'fines_enabled','boolean',false,v_profile),
    (v_library,'overdue_renewal_allowed','boolean',false,v_profile),
    (v_library,'librarian_waiver_allowed','boolean',false,v_profile);
  insert into public.library_settings(library_id, setting_key, value_kind, integer_value, updated_by_profile_id)
  values
    (v_library,'default_loan_period_days','integer',14,v_profile),
    (v_library,'checkout_limit','integer',5,v_profile),
    (v_library,'renewal_limit','integer',2,v_profile),
    (v_library,'grace_period_days','integer',0,v_profile);
  insert into public.library_settings(library_id, setting_key, value_kind, money_minor_value, currency_code, updated_by_profile_id)
  values(v_library,'daily_fine_rate_minor','money_minor',0,'INR',v_profile);
  insert into public.audit_events(library_id,actor_profile_id,action,target_type,target_id,metadata)
  values(v_library,v_profile,'library.created','library',v_library,jsonb_build_object('public_code',v_code));
  return v_library;
exception when unique_violation then
  raise exception using errcode='23505', message='GS_LIBRARY_CODE_TAKEN';
end;
$$;

create or replace function public.member_set_enrollment(
  p_member_id uuid, p_academic_session_id uuid, p_grade_level_id uuid,
  p_section_id uuid, p_status text default 'active'
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_library uuid; v_id uuid;
begin
  v_actor := private.require_operator();
  v_library := private.request_library_id();
  if not exists(select 1 from public.members where id=p_member_id and library_id=v_library and member_kind='student') then
    raise exception using errcode='P0001', message='GS_STUDENT_MEMBER_REQUIRED';
  end if;
  if p_status not in ('active','completed','withdrawn')
    or not exists(select 1 from public.academic_sessions where id=p_academic_session_id and library_id=v_library)
    or not exists(select 1 from public.grade_levels where id=p_grade_level_id and library_id=v_library)
    or not exists(select 1 from public.sections where id=p_section_id and library_id=v_library) then
    raise exception using errcode='22023', message='GS_ENROLLMENT_INPUT_INVALID';
  end if;
  insert into public.student_enrollments(library_id,member_id,academic_session_id,grade_level_id,section_id,status)
  values(v_library,p_member_id,p_academic_session_id,p_grade_level_id,p_section_id,p_status)
  on conflict(library_id,member_id,academic_session_id) do update
    set grade_level_id=excluded.grade_level_id,section_id=excluded.section_id,status=excluded.status
  returning id into v_id;
  perform private.admin_audit(v_actor,'member.enrollment_saved','member',p_member_id,jsonb_build_object('academic_session_id',p_academic_session_id));
  return v_id;
end;
$$;

create or replace function public.member_set_enrollment_v71(
  p_member_id uuid, p_academic_session_id uuid, p_grade_level_id uuid,
  p_section_id uuid, p_roll_number text default null, p_status text default 'active'
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_library uuid; v_id uuid; v_roll text;
begin
  v_actor:=private.require_operator(); v_library:=private.request_library_id(); v_roll:=nullif(btrim(p_roll_number),'');
  perform 1 from public.members where id=p_member_id and library_id=v_library and member_kind='student' for update;
  if not found then raise exception using errcode='P0001',message='GS_STUDENT_MEMBER_REQUIRED'; end if;
  if p_status not in('active','completed','withdrawn')
    or not exists(select 1 from public.academic_sessions where id=p_academic_session_id and library_id=v_library)
    or not exists(select 1 from public.grade_levels where id=p_grade_level_id and library_id=v_library)
    or not exists(select 1 from public.sections where id=p_section_id and library_id=v_library)
    or (v_roll is not null and (char_length(v_roll)>40 or v_roll~'[[:cntrl:]]')) then
    raise exception using errcode='22023',message='GS_ENROLLMENT_INPUT_INVALID';
  end if;
  if p_status='active' and not exists(select 1 from public.academic_sessions where id=p_academic_session_id and library_id=v_library and status='active' and current_date between starts_on and ends_on) then
    raise exception using errcode='P0001',message='GS_ENROLLMENT_SESSION_NOT_CURRENT';
  end if;
  if p_status='active' then update public.student_enrollments set status='completed' where library_id=v_library and member_id=p_member_id and status='active' and academic_session_id<>p_academic_session_id; end if;
  insert into public.student_enrollments(library_id,member_id,academic_session_id,grade_level_id,section_id,roll_number,status)
  values(v_library,p_member_id,p_academic_session_id,p_grade_level_id,p_section_id,v_roll,p_status)
  on conflict(library_id,member_id,academic_session_id) do update set grade_level_id=excluded.grade_level_id,section_id=excluded.section_id,roll_number=excluded.roll_number,status=excluded.status
  returning id into v_id;
  perform private.admin_audit(v_actor,'member.enrollment_saved','member',p_member_id,jsonb_build_object('academic_session_id',p_academic_session_id,'roll_number',v_roll));
  return v_id;
exception when unique_violation then raise exception using errcode='23505',message='GS_ROLL_DUPLICATE';
end;
$$;

create or replace function public.admin_upsert_setting(
  p_setting_key text, p_boolean_value boolean default null,
  p_integer_value bigint default null, p_money_minor_value bigint default null
)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_library uuid; v_kind text;
begin
  v_actor := private.require_administrator();
  v_library := private.request_library_id();
  if p_setting_key not in(
    'fines_enabled','default_loan_period_days','checkout_limit','renewal_limit',
    'grace_period_days','daily_fine_rate_minor','overdue_renewal_allowed','librarian_waiver_allowed'
  ) then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if;

  if p_setting_key in ('fines_enabled','overdue_renewal_allowed','librarian_waiver_allowed') then
    if p_boolean_value is null then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if;
    v_kind := 'boolean';
  elsif p_setting_key='daily_fine_rate_minor' then
    if p_money_minor_value is null or p_money_minor_value < 0 then raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if;
    v_kind := 'money_minor';
  else
    if p_integer_value is null or p_integer_value < 0
      or (p_setting_key='default_loan_period_days' and p_integer_value < 1) then
      raise exception using errcode='22023',message='GS_SETTING_INVALID';
    end if;
    v_kind := 'integer';
  end if;

  if p_setting_key='fines_enabled' and p_boolean_value then
    if not exists(select 1 from public.library_settings where library_id=v_library and setting_key='grace_period_days' and integer_value is not null)
      or not exists(select 1 from public.library_settings where library_id=v_library and setting_key='daily_fine_rate_minor' and money_minor_value is not null) then
      raise exception using errcode='P0001',message='GS_FINE_POLICY_NOT_CONFIGURED';
    end if;
  end if;

  insert into public.library_settings(
    library_id,setting_key,value_kind,boolean_value,integer_value,money_minor_value,currency_code,updated_by_profile_id
  ) values(
    v_library,p_setting_key,v_kind,
    case when v_kind='boolean' then p_boolean_value end,
    case when v_kind='integer' then p_integer_value end,
    case when v_kind='money_minor' then p_money_minor_value end,
    case when v_kind='money_minor' then 'INR' end,v_actor
  )
  on conflict(library_id,setting_key) do update set
    value_kind=excluded.value_kind,boolean_value=excluded.boolean_value,integer_value=excluded.integer_value,
    money_minor_value=excluded.money_minor_value,currency_code=excluded.currency_code,updated_by_profile_id=v_actor;
  perform private.admin_audit(v_actor,'admin.setting_saved','library_setting',null,jsonb_build_object('setting_key',p_setting_key));
  return true;
end;
$$;

create or replace function public.admin_assign_operator_to_room(
  p_library_code text, p_target_auth_user_id uuid, p_display_name text, p_role_key text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_profile uuid; v_profile_status text; v_role uuid;
begin
  v_library := private.require_library_access(p_library_code,'administrator');
  v_actor := private.require_administrator();
  if p_target_auth_user_id is null or char_length(btrim(coalesce(p_display_name,''))) not between 2 and 160
    or p_role_key not in ('administrator','librarian') then
    raise exception using errcode='22023',message='GS_OPERATOR_INPUT_INVALID';
  end if;
  if not exists(select 1 from auth.users where id=p_target_auth_user_id) then
    raise exception using errcode='22023',message='GS_AUTH_USER_NOT_FOUND';
  end if;
  select id,status into v_profile,v_profile_status from public.profiles where auth_user_id=p_target_auth_user_id for update;
  if v_profile is null then
    insert into public.profiles(auth_user_id,display_name,status)
    values(p_target_auth_user_id,btrim(p_display_name),'active') returning id into v_profile;
  elsif v_profile_status <> 'active' then
    raise exception using errcode='42501',message='GS_PROFILE_INACTIVE';
  end if;
  select id into v_role from public.roles where role_key=p_role_key;
  insert into public.profile_roles(profile_id,library_id,role_id,assigned_by_profile_id,status)
  values(v_profile,v_library,v_role,v_actor,'active')
  on conflict(profile_id,library_id,role_id) do update set status='active',assigned_by_profile_id=v_actor;
  perform private.admin_audit(v_actor,'security.operator_assigned','profile',v_profile,jsonb_build_object('role_key',p_role_key));
  return v_profile;
end;
$$;

create or replace function public.admin_set_room_operator_status(
  p_library_code text, p_target_profile_id uuid, p_status text
)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_admin uuid; v_active_admins integer; v_changed integer;
begin
  v_library := private.require_library_access(p_library_code,'administrator');
  v_actor := private.require_administrator();
  if p_status not in ('active','inactive') then raise exception using errcode='22023',message='GS_STATUS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_library::text, 73918421));
  select id into v_admin from public.roles where role_key='administrator';
  if p_status='inactive' and exists(select 1 from public.profile_roles where profile_id=p_target_profile_id and library_id=v_library and role_id=v_admin and status='active') then
    select count(distinct pr.profile_id) into v_active_admins from public.profile_roles pr join public.profiles p on p.id=pr.profile_id
    where pr.library_id=v_library and pr.role_id=v_admin and pr.status='active' and p.status='active';
    if v_active_admins <= 1 then raise exception using errcode='42501',message='GS_LAST_ROOM_ADMIN'; end if;
  end if;
  update public.profile_roles set status=p_status where profile_id=p_target_profile_id and library_id=v_library and status<>p_status;
  get diagnostics v_changed=row_count;
  if v_changed>0 then perform private.admin_audit(v_actor,'security.operator_status_changed','profile',p_target_profile_id,jsonb_build_object('status',p_status)); end if;
  return v_changed>0;
end;
$$;

create or replace function public.public_catalogue_page(
  p_library_code text, p_query text default null, p_available_only boolean default false,
  p_limit integer default 24, p_offset integer default 0, p_book_id uuid default null
)
returns table(
  id uuid, title text, subtitle text, author_names text, isbn text, publisher_name text,
  category_names text[], subject_names text[], language_code text, publication_year integer, description text,
  total_copies bigint, available_copies bigint, availability_state text, expected_availability date,
  has_cover boolean, total_count bigint
)
language sql stable security definer set search_path = '' as $$
  with room as (
    select l.id from public.libraries l
    where l.public_code=private.normalize_library_code(p_library_code) and l.status='active'
  ), catalogue as (
    select b.id,b.title,b.subtitle,b.isbn,b.language_code,b.publication_year,b.description,b.created_at,
      p.name publisher_name,
      coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=b.library_id),'Author not listed') author_names,
      coalesce((select array_agg(c.name order by c.name) from public.book_categories bc join public.categories c on c.id=bc.category_id and c.library_id=bc.library_id where bc.book_id=b.id and bc.library_id=b.library_id),'{}'::text[]) category_names,
      coalesce((select array_agg(s.name order by s.name) from public.book_subjects bs join public.subjects s on s.id=bs.subject_id and s.library_id=bs.library_id where bs.book_id=b.id and bs.library_id=b.library_id),'{}'::text[]) subject_names,
      (select count(*) from public.book_copies cp where cp.book_id=b.id and cp.library_id=b.library_id and cp.operational_state<>'withdrawn') total_copies,
      (select count(*) from public.book_copies cp where cp.book_id=b.id and cp.library_id=b.library_id and cp.operational_state='active' and not exists(select 1 from public.loans lo where lo.book_copy_id=cp.id and lo.library_id=cp.library_id and lo.status='active')) available_copies,
      (select min(lo.due_at)::date from public.loans lo join public.book_copies cp on cp.id=lo.book_copy_id and cp.library_id=lo.library_id where cp.book_id=b.id and cp.library_id=b.library_id and lo.status='active') expected_availability,
      b.cover_storage_path is not null has_cover
    from public.books b join room on room.id=b.library_id
    left join public.publishers p on p.id=b.publisher_id and p.library_id=b.library_id
    where b.status='active' and (p_book_id is null or b.id=p_book_id)
  ), filtered as (
    select c.* from catalogue c
    where (not coalesce(p_available_only,false) or c.available_copies>0)
      and (nullif(btrim(coalesce(p_query,'')),'') is null or c.title ilike '%'||btrim(p_query)||'%'
        or c.author_names ilike '%'||btrim(p_query)||'%' or coalesce(c.isbn,'') ilike '%'||btrim(p_query)||'%'
        or exists(select 1 from unnest(c.category_names||c.subject_names) v where v ilike '%'||btrim(p_query)||'%'))
  )
  select f.id,f.title,f.subtitle,f.author_names,f.isbn,f.publisher_name,f.category_names,f.subject_names,
    f.language_code,f.publication_year,f.description,f.total_copies,f.available_copies,
    case when f.available_copies>1 then 'available' when f.available_copies=1 then 'limited'
      when f.expected_availability is not null then 'on_loan' else 'unavailable' end,
    case when f.available_copies=0 then f.expected_availability end,f.has_cover,count(*) over()
  from filtered f order by f.title,f.id
  limit least(greatest(coalesce(p_limit,24),1),100)
  offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.public_book_detail(p_library_code text, p_book_id uuid)
returns table(
  id uuid, title text, subtitle text, author_names text, isbn text, publisher_name text,
  category_names text[], subject_names text[], language_code text, publication_year integer, description text,
  total_copies bigint, available_copies bigint, availability_state text, expected_availability date, has_cover boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.title,p.subtitle,p.author_names,p.isbn,p.publisher_name,p.category_names,p.subject_names,
    p.language_code,p.publication_year,p.description,p.total_copies,p.available_copies,p.availability_state,
    p.expected_availability,p.has_cover
  from public.public_catalogue_page(p_library_code,null,false,1,0,p_book_id) p
$$;

create or replace function public.public_new_titles(p_library_code text, p_limit integer default 6)
returns table(
  id uuid, title text, subtitle text, author_names text, isbn text, publisher_name text,
  category_names text[], subject_names text[], language_code text, publication_year integer, description text,
  total_copies bigint, available_copies bigint, availability_state text, expected_availability date, has_cover boolean
)
language sql stable security definer set search_path = '' as $$
  select d.id,d.title,d.subtitle,d.author_names,d.isbn,d.publisher_name,d.category_names,d.subject_names,
    d.language_code,d.publication_year,d.description,d.total_copies,d.available_copies,d.availability_state,
    d.expected_availability,d.has_cover
  from public.libraries l
  join public.books b on b.library_id=l.id and b.status='active'
  cross join lateral public.public_book_detail(l.public_code,b.id) d
  where l.public_code=private.normalize_library_code(p_library_code) and l.status='active'
  order by b.created_at desc,b.id desc limit least(greatest(coalesce(p_limit,6),1),24)
$$;

create or replace function public.operator_circulation_search(p_library_code text, p_kind text, p_query text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_q text; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code); v_q:=btrim(coalesce(p_query,''));
  if char_length(v_q)<2 then return '[]'::jsonb; end if;
  if p_kind='members' then
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'identifier',m.member_identifier,
      'context',coalesce((select s.display_label||' · '||g.display_name||' · '||sec.display_name||coalesce(' · Roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id and s.library_id=se.library_id join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id where se.library_id=v_library and se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),initcap(m.member_kind)),
      'activeLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active'),
      'overdueLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active' and l.due_at<timezone('utc',now()))) order by m.display_name),'[]'::jsonb)
    into v_result from (select * from public.members where library_id=v_library and status='active' and (display_name ilike '%'||v_q||'%' or member_identifier ilike '%'||v_q||'%') order by display_name limit 50) m;
  elsif p_kind='copies' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'author',coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=q.book_id and ba.library_id=v_library),'Author not listed'),'accession',q.accession_number,'barcode',q.barcode,'location',q.location,'state','Available') order by q.title,q.accession_number),'[]'::jsonb)
    into v_result from (
      select c.id,c.book_id,b.title,c.accession_number,c.barcode,coalesce(loc.display_name,'Not assigned') location
      from public.book_copies c join public.books b on b.id=c.book_id and b.library_id=c.library_id left join public.locations loc on loc.id=c.location_id and loc.library_id=c.library_id
      where c.library_id=v_library and c.operational_state='active' and b.status='active'
        and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')
        and (b.title ilike '%'||v_q||'%' or coalesce(b.isbn,'') ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%' or coalesce(c.barcode,'') ilike '%'||v_q||'%' or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library and a.display_name ilike '%'||v_q||'%'))
      order by b.title,c.accession_number limit 50
    ) q;
  elsif p_kind='loans' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'member',q.member,'identifier',q.identifier,'title',q.title,'accession',q.accession,'barcode',q.barcode,'due',q.due_at::date,'overdue',q.due_at<timezone('utc',now())) order by q.due_at),'[]'::jsonb)
    into v_result from (
      select lo.id,m.display_name member,m.member_identifier identifier,b.title,c.accession_number accession,c.barcode,lo.due_at
      from public.loans lo join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where lo.library_id=v_library and lo.status='active' and (m.display_name ilike '%'||v_q||'%' or m.member_identifier ilike '%'||v_q||'%' or b.title ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%' or coalesce(c.barcode,'') ilike '%'||v_q||'%')
      order by lo.due_at limit 50
    ) q;
  elsif p_kind='fines' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'member',q.member,'identifier',q.identifier,'title',q.title,'accession',q.accession,'assessedMinor',q.assessed_amount_minor,'outstandingMinor',q.outstanding_minor,'reason',q.reason) order by q.created_at desc),'[]'::jsonb)
    into v_result from (
      select f.id,m.display_name member,m.member_identifier identifier,b.title,c.accession_number accession,f.assessed_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor outstanding_minor,f.reason,f.created_at
      from public.fines f join public.loans lo on lo.id=f.loan_id and lo.library_id=f.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where f.library_id=v_library and f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor>0 and (m.display_name ilike '%'||v_q||'%' or m.member_identifier ilike '%'||v_q||'%' or b.title ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%')
      order by f.created_at desc limit 50
    ) q;
  else raise exception using errcode='22023',message='GS_SEARCH_KIND_INVALID';
  end if;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

create or replace function public.operator_room_operators(p_library_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code,'administrator');
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'roles',q.roles,'globalStatus',q.global_status,'roomStatus',q.room_status) order by q.name),'[]'::jsonb)
  into v_result from (
    select p.id,p.display_name name,p.status global_status,
      array_agg(r.role_key order by r.role_key) roles,
      case when bool_or(pr.status='active') then 'active' else 'inactive' end room_status
    from public.profile_roles pr join public.profiles p on p.id=pr.profile_id join public.roles r on r.id=pr.role_id
    where pr.library_id=v_library group by p.id,p.display_name,p.status
  ) q;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

create or replace function public.operator_room_audit(
  p_library_code text, p_action text default null, p_from date default null,
  p_to date default null, p_actor text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code,'administrator');
  if p_from is not null and p_to is not null and p_from>p_to then raise exception using errcode='22023',message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'time',to_char(q.occurred_at at time zone 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS'),'actor',q.actor_name,'action',q.action,'entity',q.target_type,'target',coalesce(q.metadata->>'title',q.target_id::text,'—'),'result','Success') order by q.occurred_at desc),'[]'::jsonb)
  into v_result from (
    select e.id,e.occurred_at,coalesce(p.display_name,'System') as actor_name,e.action,e.target_type,e.target_id,e.metadata
    from public.audit_events e left join public.profiles p on p.id=e.actor_profile_id
    where e.library_id=v_library and (nullif(btrim(coalesce(p_action,'')),'') is null or e.action ilike '%'||btrim(p_action)||'%')
      and (p_from is null or e.occurred_at::date>=p_from) and (p_to is null or e.occurred_at::date<=p_to)
      and (nullif(btrim(coalesce(p_actor,'')),'') is null or coalesce(p.display_name,'System') ilike '%'||btrim(p_actor)||'%')
    order by e.occurred_at desc
    limit 500
  ) q;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

create or replace function public.operator_room_report(
  p_library_code text, p_kind text, p_from date default null, p_to date default null,
  p_query text default null, p_status text default null, p_outstanding_only boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code);
  if p_from is not null and p_to is not null and p_from>p_to then raise exception using errcode='22023',message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  if p_kind='circulation' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.issued_at desc),'[]'::jsonb) into v_result from (
      select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.issued_at,lo.due_at,lo.returned_at,lo.status
      from public.loans lo join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      where lo.library_id=v_library and (p_from is null or lo.issued_at::date>=p_from) and (p_to is null or lo.issued_at::date<=p_to)
        and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or c.accession_number ilike '%'||p_query||'%') limit 1000) q;
  elsif p_kind='overdue' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.due_at),'[]'::jsonb) into v_result from (
      select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.due_at,ceil(extract(epoch from ((coalesce(p_to,current_date)+1)::timestamptz-lo.due_at))/86400)::bigint days_overdue
      from public.loans lo join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      where lo.library_id=v_library and lo.status='active' and lo.due_at<(coalesce(p_to,current_date)+1)::timestamptz and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%') limit 1000) q;
  elsif p_kind='popular' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (
      select b.id book_id,b.title,count(lo.id) loan_count from public.books b join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id join public.loans lo on lo.book_copy_id=c.id and lo.library_id=c.library_id
      where b.library_id=v_library and (p_from is null or lo.issued_at::date>=p_from) and (p_to is null or lo.issued_at::date<=p_to) group by b.id,b.title order by count(lo.id) desc limit 500) q;
  elsif p_kind='members' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (
      select m.id member_id,m.display_name member_name,m.member_identifier,count(lo.id) loan_count,count(lo.id) filter(where lo.status='active') active_loans
      from public.members m left join public.loans lo on lo.member_id=m.id and lo.library_id=m.library_id and (p_from is null or lo.issued_at::date>=p_from) and (p_to is null or lo.issued_at::date<=p_to)
      where m.library_id=v_library and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%') group by m.id,m.display_name,m.member_identifier limit 1000) q;
  elsif p_kind='inventory' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.title),'[]'::jsonb) into v_result from (
      select b.id book_id,b.title,count(c.id) total_copies,count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) available_copies,count(c.id) filter(where exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) on_loan_copies,count(c.id) filter(where c.operational_state<>'active') unavailable_copies
      from public.books b left join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id and (p_status is null or c.operational_state=p_status) where b.library_id=v_library group by b.id,b.title) q;
  elsif p_kind='fines' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result from (
      select f.id fine_id,m.display_name member_name,m.member_identifier,b.title,c.accession_number,f.assessed_amount_minor,f.waived_amount_minor,f.settled_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor outstanding_minor,f.created_at,f.reason
      from public.fines f join public.loans lo on lo.id=f.loan_id and lo.library_id=f.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where f.library_id=v_library and (p_from is null or f.created_at::date>=p_from) and (p_to is null or f.created_at::date<=p_to) and (not p_outstanding_only or f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor>0) and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or b.title ilike '%'||p_query||'%') limit 1000) q;
  else raise exception using errcode='22023',message='GS_REPORT_KIND_INVALID';
  end if;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

-- The room-scoped gateway is now a thin adapter over the mature domain RPCs.
create or replace function public.operator_workspace_mutation(
  p_library_code text, p_operation text, p_payload jsonb, p_request_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_library uuid; v_actor uuid; v_id uuid; v_author uuid; v_result jsonb; v_author_name text; v_author_ids uuid[] := '{}';
  v_bool boolean; v_integer bigint; v_money bigint; v_expected timestamptz;
begin
  v_library := private.require_library_access(p_library_code);
  v_actor := private.require_operator();

  case p_operation
    when 'issue' then
      return public.circulation_issue_loan((p_payload->>'memberId')::uuid,(p_payload->>'copyId')::uuid,p_request_id,p_payload->>'notes');
    when 'return' then
      return public.circulation_return_loan((p_payload->>'loanId')::uuid,p_request_id);
    when 'renew' then
      return public.circulation_renew_loan((p_payload->>'loanId')::uuid,p_request_id);
    when 'fine_settle' then
      return public.circulation_settle_fine((p_payload->>'fineId')::uuid,(p_payload->>'amountMinor')::bigint,p_request_id,p_payload->>'note');
    when 'fine_waive' then
      return public.circulation_waive_fine((p_payload->>'fineId')::uuid,(p_payload->>'amountMinor')::bigint,p_request_id,p_payload->>'reason');
    when 'book_save' then
      foreach v_author_name in array regexp_split_to_array(coalesce(p_payload->>'author',''), '\s*,\s*') loop
        if btrim(v_author_name)<>'' then
          v_author := public.catalogue_upsert_author(null, v_author_name);
          v_author_ids := array_append(v_author_ids,v_author);
        end if;
      end loop;
      if cardinality(v_author_ids)=0 then raise exception using errcode='22023',message='GS_AUTHOR_REQUIRED'; end if;
      v_expected := nullif(p_payload->>'expectedUpdatedAt','')::timestamptz;
      v_id := public.catalogue_upsert_book(
        nullif(p_payload->>'id','')::uuid, p_payload->>'title', p_payload->>'subtitle', p_payload->>'isbn',
        p_payload->>'edition', nullif(p_payload->>'publicationYear','')::integer, p_payload->>'languageCode',
        nullif(p_payload->>'publisherId','')::uuid, p_payload->>'description', v_author_ids,
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'categoryIds','[]'::jsonb))::uuid),'{}'::uuid[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'subjectIds','[]'::jsonb))::uuid),'{}'::uuid[]), v_expected);
      return jsonb_build_object('id',v_id);
    when 'book_status' then
      v_bool := public.catalogue_set_book_status((p_payload->>'id')::uuid,p_payload->>'status');
      return jsonb_build_object('updated',v_bool);
    when 'book_cover' then
      return jsonb_build_object('previousPath',public.catalogue_set_book_cover_v71((p_payload->>'id')::uuid,nullif(p_payload->>'coverPath',''),p_payload->>'expectedCoverPath'));
    when 'copy_save' then
      v_expected := nullif(p_payload->>'expectedUpdatedAt','')::timestamptz;
      v_id := public.inventory_upsert_copy(
        nullif(p_payload->>'id','')::uuid,(p_payload->>'bookId')::uuid,p_payload->>'accession',p_payload->>'barcode',
        nullif(p_payload->>'locationId','')::uuid,nullif(p_payload->>'acquiredOn','')::date,p_payload->>'acquisitionSource',
        nullif(p_payload->>'replacementCostMinor','')::bigint,coalesce(nullif(p_payload->>'conditionStatus',''),'good'),
        coalesce(nullif(p_payload->>'operationalState',''),'active'),v_expected);
      return jsonb_build_object('id',v_id);
    when 'member_save' then
      v_expected := nullif(p_payload->>'expectedUpdatedAt','')::timestamptz;
      if nullif(p_payload->>'id','') is null then
        v_id := public.member_create_with_enrollment(
          p_payload->>'displayName',p_payload->>'memberKind',coalesce(nullif(p_payload->>'status',''),'active'),
          nullif(p_payload->>'academicSessionId','')::uuid,nullif(p_payload->>'gradeLevelId','')::uuid,
          nullif(p_payload->>'sectionId','')::uuid,p_payload->>'rollNumber',coalesce(nullif(p_payload->>'enrollmentStatus',''),'active'));
      else
        v_id := public.member_update_profile((p_payload->>'id')::uuid,p_payload->>'memberKind',p_payload->>'displayName',coalesce(nullif(p_payload->>'status',''),'active'),v_expected);
        if p_payload->>'memberKind'='student' and nullif(p_payload->>'academicSessionId','') is not null then
          perform public.member_set_enrollment_v71(v_id,(p_payload->>'academicSessionId')::uuid,(p_payload->>'gradeLevelId')::uuid,(p_payload->>'sectionId')::uuid,p_payload->>'rollNumber',coalesce(nullif(p_payload->>'enrollmentStatus',''),'active'));
        end if;
      end if;
      return jsonb_build_object('id',v_id);
    when 'setting_update' then
      if p_payload->>'valueKind' = 'boolean' then v_bool := (p_payload->>'value')::boolean;
      elsif p_payload->>'valueKind' = 'money_minor' then v_money := (p_payload->>'value')::bigint;
      else v_integer := (p_payload->>'value')::bigint; end if;
      perform public.admin_upsert_setting(p_payload->>'settingKey',v_bool,v_integer,v_money);
      return jsonb_build_object('updated',true);
    when 'academic_session_save' then
      v_id:=public.admin_upsert_academic_session(nullif(p_payload->>'id','')::uuid,p_payload->>'sessionCode',p_payload->>'displayLabel',(p_payload->>'startsOn')::date,(p_payload->>'endsOn')::date,coalesce(nullif(p_payload->>'status',''),'planned'));
      return jsonb_build_object('id',v_id);
    when 'grade_save' then
      v_id:=public.admin_upsert_grade(nullif(p_payload->>'id','')::uuid,p_payload->>'gradeCode',p_payload->>'displayName',coalesce(nullif(p_payload->>'sortOrder','')::integer,0));
      return jsonb_build_object('id',v_id);
    when 'section_save' then
      v_id:=public.admin_upsert_section(nullif(p_payload->>'id','')::uuid,p_payload->>'sectionCode',p_payload->>'displayName',coalesce(nullif(p_payload->>'sortOrder','')::integer,0));
      return jsonb_build_object('id',v_id);
    when 'library_update' then
      if not private.has_library_access(v_library,'administrator') or char_length(btrim(coalesce(p_payload->>'displayName',''))) not between 3 and 160 then raise exception using errcode='22023',message='GS_LIBRARY_INPUT_INVALID'; end if;
      update public.libraries set display_name=btrim(p_payload->>'displayName') where id=v_library;
      perform private.admin_audit(v_actor,'library.identity_updated','library',v_library,jsonb_build_object('display_name',btrim(p_payload->>'displayName')));
      return jsonb_build_object('updated',true);
    else
      raise exception using errcode='22023', message='GS_OPERATION_INVALID';
  end case;
end;
$$;

-- Restore the mature public RPC surface after the global migration's blanket
-- revoke. No anonymous table access or generic function execution is restored.
revoke execute on all functions in schema public from public, anon, authenticated;

do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'current_operator_context','operator_accessible_libraries','operator_context_for_library',
      'create_library_room','operator_workspace_data','operator_workspace_mutation',
      'operator_circulation_search','operator_room_operators','operator_room_audit','operator_room_report',
      'admin_assign_operator_to_room','admin_set_room_operator_status',
      'circulation_issue_loan','circulation_return_loan','circulation_renew_loan','circulation_assess_overdue_fine',
      'circulation_settle_fine','circulation_waive_fine','circulation_member_search','circulation_copy_search',
      'circulation_loan_search','circulation_fine_search','operator_policy_context','global_search_v71',
      'report_overdue_filtered','report_inventory_filtered','member_create_with_enrollment','member_update_profile',
      'member_set_enrollment','member_set_enrollment_v71','catalogue_set_book_cover_v71','admin_upsert_setting'
    ])
  loop
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

grant execute on function public.public_resolve_library(text) to anon, authenticated;
grant execute on function public.public_catalogue(text,text,boolean,integer) to anon, authenticated;
grant execute on function public.public_book_detail(text,uuid) to anon, authenticated;
grant execute on function public.public_catalogue_page(text,text,boolean,integer,integer,uuid) to anon, authenticated;
grant execute on function public.public_new_titles(text,integer) to anon, authenticated;
grant execute on function public.public_book_cover_path(text,uuid) to service_role;
grant execute on function public.bootstrap_first_administrator(uuid,text) to service_role;

revoke all on function private.enforce_tenant_write() from public, anon, authenticated, service_role;
revoke all on function private.request_library_id() from public, anon, authenticated, service_role;
revoke all on function private.has_library_access(uuid,text) from public, anon, service_role;
grant execute on function private.has_library_access(uuid,text) to authenticated;

comment on function public.operator_workspace_mutation(text,text,jsonb,uuid) is
  'Room-scoped thin adapter over canonical Phase 5-7.1 domain functions.';
