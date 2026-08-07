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
    where p.status = 'active' and p.auth_user_id is not null and pr.role_id = v_role_id;

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
    where p.status = 'active' and p.auth_user_id is not null and pr.role_id = v_admin_role_id;

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
  where p.status = 'active' and p.auth_user_id is not null and r.role_key = 'administrator';

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
