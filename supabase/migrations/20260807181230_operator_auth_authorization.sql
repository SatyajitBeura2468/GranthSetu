create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.auth_user_id = (select auth.uid())
    and p.status = 'active'
  limit 1;
$$;

create or replace function private.has_active_role(p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_role_key is null or p_role_key not in ('administrator', 'librarian') then false
    else exists (
      select 1
      from public.profiles as p
      join public.profile_roles as pr on pr.profile_id = p.id
      join public.roles as r on r.id = pr.role_id
      where p.auth_user_id = (select auth.uid())
        and p.status = 'active'
        and r.role_key = p_role_key
    )
  end;
$$;

create or replace function private.is_active_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_active_role('administrator')
      or private.has_active_role('librarian');
$$;

create or replace function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_active_role('administrator');
$$;

create or replace function private.require_administrator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := private.current_profile_id();
  if v_profile_id is null or not private.is_administrator() then
    raise exception using errcode = '42501', message = 'administrator authorization required';
  end if;
  return v_profile_id;
end;
$$;

create or replace function private.append_security_audit(
  p_actor_profile_id uuid,
  p_action text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_action is null or btrim(p_action) = '' then
    raise exception using errcode = '22023', message = 'audit action is required';
  end if;

  insert into public.audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_actor_profile_id,
    p_action,
    'profile',
    p_target_id,
    case when p_metadata is null then '{}'::jsonb else p_metadata end
  );
end;
$$;

create or replace function public.current_operator_context()
returns table (
  user_id uuid,
  profile_id uuid,
  display_name text,
  status text,
  roles text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.auth_user_id,
    p.id,
    p.display_name,
    p.status,
    array_agg(r.role_key order by r.role_key)
  from public.profiles as p
  join public.profile_roles as pr on pr.profile_id = p.id
  join public.roles as r on r.id = pr.role_id
  where p.auth_user_id = (select auth.uid())
    and p.status = 'active'
    and r.role_key in ('administrator', 'librarian')
  group by p.auth_user_id, p.id, p.display_name, p.status;
$$;

create or replace function public.admin_provision_operator_profile(
  p_target_auth_user_id uuid,
  p_display_name text,
  p_role_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_profile_id uuid;
  v_role_id uuid;
begin
  v_actor_profile_id := private.require_administrator();

  if p_target_auth_user_id is null
     or p_display_name is null
     or btrim(p_display_name) = ''
     or char_length(btrim(p_display_name)) > 160
     or p_role_key is null
     or p_role_key not in ('administrator', 'librarian') then
    raise exception using errcode = '22023', message = 'invalid operator provisioning input';
  end if;

  if not exists (select 1 from auth.users where id = p_target_auth_user_id) then
    raise exception using errcode = '22023', message = 'target authentication user does not exist';
  end if;

  if exists (select 1 from public.profiles where auth_user_id = p_target_auth_user_id) then
    raise exception using errcode = '23505', message = 'authentication user is already linked';
  end if;

  select r.id
  into v_role_id
  from public.roles as r
  where r.role_key = p_role_key;

  if v_role_id is null then
    raise exception using errcode = '22023', message = 'operator role does not exist';
  end if;

  insert into public.profiles (auth_user_id, display_name, status)
  values (p_target_auth_user_id, btrim(p_display_name), 'active')
  returning id into v_profile_id;

  insert into public.profile_roles (profile_id, role_id, assigned_by_profile_id)
  values (v_profile_id, v_role_id, v_actor_profile_id);

  perform private.append_security_audit(
    v_actor_profile_id,
    'security.operator_provisioned',
    v_profile_id,
    jsonb_build_object('role_key', p_role_key)
  );

  return v_profile_id;
end;
$$;

create or replace function public.admin_assign_role(
  p_target_profile_id uuid,
  p_role_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_role_id uuid;
  v_inserted_profile_id uuid;
begin
  v_actor_profile_id := private.require_administrator();

  if p_target_profile_id is null
     or p_role_key is null
     or p_role_key not in ('administrator', 'librarian') then
    raise exception using errcode = '22023', message = 'invalid role assignment input';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_target_profile_id and status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'target operator is not active';
  end if;

  select r.id into v_role_id from public.roles as r where r.role_key = p_role_key;

  insert into public.profile_roles (profile_id, role_id, assigned_by_profile_id)
  values (p_target_profile_id, v_role_id, v_actor_profile_id)
  on conflict (profile_id, role_id) do nothing
  returning profile_id into v_inserted_profile_id;

  if v_inserted_profile_id is not null then
    perform private.append_security_audit(
      v_actor_profile_id,
      'security.role_assigned',
      p_target_profile_id,
      jsonb_build_object('role_key', p_role_key)
    );
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.admin_revoke_role(
  p_target_profile_id uuid,
  p_role_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_role_id uuid;
  v_deleted_count integer;
  v_active_admin_count integer;
begin
  v_actor_profile_id := private.require_administrator();

  if p_target_profile_id is null
     or p_role_key is null
     or p_role_key not in ('administrator', 'librarian') then
    raise exception using errcode = '22023', message = 'invalid role revocation input';
  end if;

  perform pg_advisory_xact_lock(73918421);

  select r.id into v_role_id from public.roles as r where r.role_key = p_role_key;

  if p_role_key = 'administrator' then
    select count(*)::integer
    into v_active_admin_count
    from public.profiles as p
    join public.profile_roles as pr on pr.profile_id = p.id
    where p.status = 'active' and pr.role_id = v_role_id;

    if v_active_admin_count <= 1
       and exists (select 1 from public.profile_roles where profile_id = p_target_profile_id and role_id = v_role_id) then
      raise exception using errcode = '42501', message = 'the last active administrator cannot be removed';
    end if;
  end if;

  delete from public.profile_roles
  where profile_id = p_target_profile_id and role_id = v_role_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count > 0 then
    perform private.append_security_audit(
      v_actor_profile_id,
      'security.role_revoked',
      p_target_profile_id,
      jsonb_build_object('role_key', p_role_key)
    );
  end if;

  return v_deleted_count > 0;
end;
$$;

create or replace function public.admin_set_profile_status(
  p_target_profile_id uuid,
  p_status text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_old_status text;
  v_admin_role_id uuid;
  v_active_admin_count integer;
begin
  v_actor_profile_id := private.require_administrator();

  if p_target_profile_id is null
     or p_status is null
     or p_status not in ('active', 'inactive', 'archived') then
    raise exception using errcode = '22023', message = 'invalid profile status input';
  end if;

  perform pg_advisory_xact_lock(73918421);

  select p.status into v_old_status
  from public.profiles as p
  where p.id = p_target_profile_id
  for update;

  if v_old_status is null then
    raise exception using errcode = '22023', message = 'target operator does not exist';
  end if;

  select r.id into v_admin_role_id from public.roles as r where r.role_key = 'administrator';

  if v_old_status = 'active'
     and p_status <> 'active'
     and exists (select 1 from public.profile_roles where profile_id = p_target_profile_id and role_id = v_admin_role_id) then
    select count(*)::integer
    into v_active_admin_count
    from public.profiles as p
    join public.profile_roles as pr on pr.profile_id = p.id
    where p.status = 'active' and pr.role_id = v_admin_role_id;

    if v_active_admin_count <= 1 then
      raise exception using errcode = '42501', message = 'the last active administrator cannot be deactivated';
    end if;
  end if;

  if v_old_status = p_status then
    return false;
  end if;

  update public.profiles
  set status = p_status
  where id = p_target_profile_id;

  perform private.append_security_audit(
    v_actor_profile_id,
    'security.profile_status_changed',
    p_target_profile_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
  );

  return true;
end;
$$;

create or replace function public.bootstrap_first_administrator(
  p_target_auth_user_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_role_id uuid;
  v_active_admin_count integer;
begin
  perform pg_advisory_xact_lock(73918421);

  select count(*)::integer
  into v_active_admin_count
  from public.profiles as p
  join public.profile_roles as pr on pr.profile_id = p.id
  join public.roles as r on r.id = pr.role_id
  where p.status = 'active' and r.role_key = 'administrator';

  if v_active_admin_count <> 0 then
    raise exception using errcode = '42501', message = 'an active administrator already exists';
  end if;

  if p_target_auth_user_id is null
     or p_display_name is null
     or btrim(p_display_name) = ''
     or char_length(btrim(p_display_name)) > 160 then
    raise exception using errcode = '22023', message = 'invalid bootstrap input';
  end if;

  if not exists (select 1 from auth.users where id = p_target_auth_user_id) then
    raise exception using errcode = '22023', message = 'target authentication user does not exist';
  end if;

  if exists (select 1 from public.profiles where auth_user_id = p_target_auth_user_id) then
    raise exception using errcode = '23505', message = 'authentication user is already linked';
  end if;

  select r.id into v_role_id from public.roles as r where r.role_key = 'administrator';

  insert into public.profiles (auth_user_id, display_name, status)
  values (p_target_auth_user_id, btrim(p_display_name), 'active')
  returning id into v_profile_id;

  insert into public.profile_roles (profile_id, role_id, assigned_by_profile_id)
  values (v_profile_id, v_role_id, null);

  perform private.append_security_audit(
    null,
    'security.bootstrap_administrator',
    v_profile_id,
    '{}'::jsonb
  );

  return v_profile_id;
end;
$$;

alter function private.current_profile_id() owner to postgres;
alter function private.has_active_role(text) owner to postgres;
alter function private.is_active_operator() owner to postgres;
alter function private.is_administrator() owner to postgres;
alter function private.require_administrator() owner to postgres;
alter function private.append_security_audit(uuid, text, uuid, jsonb) owner to postgres;
alter function public.current_operator_context() owner to postgres;
alter function public.admin_provision_operator_profile(uuid, text, text) owner to postgres;
alter function public.admin_assign_role(uuid, text) owner to postgres;
alter function public.admin_revoke_role(uuid, text) owner to postgres;
alter function public.admin_set_profile_status(uuid, text) owner to postgres;
alter function public.bootstrap_first_administrator(uuid, text) owner to postgres;

revoke all on function private.current_profile_id() from public, anon, authenticated, service_role;
revoke all on function private.has_active_role(text) from public, anon, authenticated, service_role;
revoke all on function private.is_active_operator() from public, anon, authenticated, service_role;
revoke all on function private.is_administrator() from public, anon, authenticated, service_role;
revoke all on function private.require_administrator() from public, anon, authenticated, service_role;
revoke all on function private.append_security_audit(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.current_operator_context() from public, anon, authenticated, service_role;
revoke all on function public.admin_provision_operator_profile(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_assign_role(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_revoke_role(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_profile_status(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.bootstrap_first_administrator(uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.current_operator_context() to authenticated;
grant execute on function public.admin_provision_operator_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_assign_role(uuid, text) to authenticated;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;
grant execute on function public.admin_set_profile_status(uuid, text) to authenticated;
grant execute on function public.bootstrap_first_administrator(uuid, text) to service_role;

grant usage on schema public to authenticated;
grant select on table
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
  public.library_settings
to authenticated;
grant select on table public.profiles, public.profile_roles, public.audit_events to authenticated;

create policy roles_select_active_operators
on public.roles for select to authenticated
using (private.is_active_operator());

create policy profiles_select_administrators
on public.profiles for select to authenticated
using (private.is_administrator());

create policy profile_roles_select_administrators
on public.profile_roles for select to authenticated
using (private.is_administrator());

create policy members_select_active_operators
on public.members for select to authenticated
using (private.is_active_operator());

create policy academic_sessions_select_active_operators
on public.academic_sessions for select to authenticated
using (private.is_active_operator());

create policy grade_levels_select_active_operators
on public.grade_levels for select to authenticated
using (private.is_active_operator());

create policy sections_select_active_operators
on public.sections for select to authenticated
using (private.is_active_operator());

create policy student_enrollments_select_active_operators
on public.student_enrollments for select to authenticated
using (private.is_active_operator());

create policy publishers_select_active_operators
on public.publishers for select to authenticated
using (private.is_active_operator());

create policy categories_select_active_operators
on public.categories for select to authenticated
using (private.is_active_operator());

create policy subjects_select_active_operators
on public.subjects for select to authenticated
using (private.is_active_operator());

create policy authors_select_active_operators
on public.authors for select to authenticated
using (private.is_active_operator());

create policy books_select_active_operators
on public.books for select to authenticated
using (private.is_active_operator());

create policy book_authors_select_active_operators
on public.book_authors for select to authenticated
using (private.is_active_operator());

create policy book_categories_select_active_operators
on public.book_categories for select to authenticated
using (private.is_active_operator());

create policy book_subjects_select_active_operators
on public.book_subjects for select to authenticated
using (private.is_active_operator());

create policy locations_select_active_operators
on public.locations for select to authenticated
using (private.is_active_operator());

create policy book_copies_select_active_operators
on public.book_copies for select to authenticated
using (private.is_active_operator());

create policy loans_select_active_operators
on public.loans for select to authenticated
using (private.is_active_operator());

create policy loan_renewals_select_active_operators
on public.loan_renewals for select to authenticated
using (private.is_active_operator());

create policy fines_select_active_operators
on public.fines for select to authenticated
using (private.is_active_operator());

create policy library_settings_select_active_operators
on public.library_settings for select to authenticated
using (private.is_active_operator());

create policy audit_events_select_administrators
on public.audit_events for select to authenticated
using (private.is_administrator());

comment on schema private is
  'Non-exposed, security-definer authorization helpers for GranthSetu V3.';

comment on function public.current_operator_context() is
  'Returns only the current authenticated user operator context from database-authoritative profile and role state.';

comment on function public.bootstrap_first_administrator(uuid, text) is
  'Development bootstrap only; execution is restricted to the Supabase service role and the function refuses when an active administrator exists.';
