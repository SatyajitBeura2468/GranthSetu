-- A member record is useful before a school has configured its academic
-- structure. An enrollment remains all-or-nothing and tenant-scoped.
create or replace function public.member_create_with_enrollment(
  p_display_name text, p_member_kind text, p_status text default 'active',
  p_academic_session_id uuid default null, p_grade_level_id uuid default null,
  p_section_id uuid default null, p_roll_number text default null,
  p_enrollment_status text default 'active'
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_library uuid; v_id uuid; v_roll text; v_has_enrollment boolean;
begin
  v_actor := private.require_operator(); v_library := private.request_library_id();
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 200
    or p_member_kind not in ('student','teacher','staff','other') or p_status not in ('active','inactive','archived') then
    raise exception using errcode='22023', message='GS_MEMBER_INPUT_INVALID';
  end if;
  v_roll := nullif(btrim(p_roll_number),'');
  if v_roll is not null and (char_length(v_roll)>40 or v_roll ~ '[[:cntrl:]]') then raise exception using errcode='22023',message='GS_ROLL_INVALID'; end if;
  v_has_enrollment := p_academic_session_id is not null or p_grade_level_id is not null or p_section_id is not null or v_roll is not null;
  if p_member_kind <> 'student' and v_has_enrollment then raise exception using errcode='22023',message='GS_NONSTUDENT_ENROLLMENT_FORBIDDEN'; end if;
  if v_has_enrollment and (p_academic_session_id is null or p_grade_level_id is null or p_section_id is null
    or p_enrollment_status not in ('active','completed','withdrawn')
    or not exists(select 1 from public.academic_sessions where id=p_academic_session_id and library_id=v_library)
    or not exists(select 1 from public.grade_levels where id=p_grade_level_id and library_id=v_library)
    or not exists(select 1 from public.sections where id=p_section_id and library_id=v_library)) then
    raise exception using errcode='22023',message='GS_ENROLLMENT_INPUT_INVALID';
  end if;
  insert into public.members(member_identifier,member_kind,display_name,status) values(private.generate_member_identifier(),p_member_kind,btrim(p_display_name),p_status) returning id into v_id;
  if v_has_enrollment then
    insert into public.student_enrollments(member_id,academic_session_id,grade_level_id,section_id,roll_number,status)
    values(v_id,p_academic_session_id,p_grade_level_id,p_section_id,v_roll,p_enrollment_status);
  end if;
  perform private.admin_audit(v_actor,'member.created','member',v_id,jsonb_build_object('member_kind',p_member_kind,'enrollment_created',v_has_enrollment));
  return v_id;
end;
$$;

revoke all on function public.member_create_with_enrollment(text,text,text,uuid,uuid,uuid,text,text) from public, anon, service_role;
grant execute on function public.member_create_with_enrollment(text,text,text,uuid,uuid,uuid,text,text) to authenticated;
