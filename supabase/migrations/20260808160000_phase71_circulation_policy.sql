-- Phase 7.1 forward policy authorization for overdue renewal and librarian waivers.

create or replace function public.circulation_renew_loan(p_loan_id uuid, p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_member public.members%rowtype; v_copy public.book_copies%rowtype; v_book public.books%rowtype; v_period bigint; v_limit bigint; v_count bigint; v_now timestamptz; v_renewal public.loan_renewals%rowtype; v_result jsonb;
begin
  v_actor := private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.loan_renewed');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_renewed' then raise exception using errcode='23505', message='GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  select * into v_loan from public.loans where id=p_loan_id for update;
  if not found then raise exception using errcode='P0001', message='GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status <> 'active' then raise exception using errcode='P0001', message='GS_LOAN_NOT_ACTIVE'; end if;
  v_now := timezone('utc',now());
  if v_now > v_loan.due_at and not coalesce(private.policy_boolean('overdue_renewal_allowed'),false) then
    raise exception using errcode='P0001', message='GS_LOAN_OVERDUE';
  end if;
  select * into v_member from public.members where id=v_loan.member_id;
  if v_member.status <> 'active' then raise exception using errcode='P0001', message='GS_MEMBER_INACTIVE'; end if;
  if v_member.member_kind='student' and not exists(select 1 from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id where se.member_id=v_member.id and se.status='active' and s.status='active' and current_date between s.starts_on and s.ends_on) then raise exception using errcode='P0001', message='GS_STUDENT_ENROLMENT_REQUIRED'; end if;
  select * into v_copy from public.book_copies where id=v_loan.book_copy_id;
  if v_copy.operational_state <> 'active' then raise exception using errcode='P0001', message='GS_COPY_NOT_CIRCULATABLE'; end if;
  select * into v_book from public.books where id=v_copy.book_id;
  if v_book.status <> 'active' then raise exception using errcode='P0001', message='GS_BOOK_ARCHIVED'; end if;
  v_period := private.policy_integer('default_loan_period_days'); v_limit := private.policy_integer('renewal_limit');
  if v_period is null or v_period <= 0 or v_limit is null or v_limit < 0 then raise exception using errcode='P0001', message='GS_POLICY_NOT_CONFIGURED'; end if;
  select count(*) into v_count from public.loan_renewals where loan_id=v_loan.id;
  if v_count >= v_limit then raise exception using errcode='P0001', message='GS_RENEWAL_LIMIT_REACHED'; end if;
  insert into public.loan_renewals(loan_id,approved_by_profile_id,previous_due_at,new_due_at,renewed_at)
    values(v_loan.id,v_actor,v_loan.due_at,greatest(v_loan.due_at,v_now)+make_interval(days=>v_period::integer),v_now) returning * into v_renewal;
  update public.loans set due_at=v_renewal.new_due_at where id=v_loan.id returning * into v_loan;
  v_result := jsonb_build_object('loan_id',v_loan.id,'renewal_id',v_renewal.id,'previous_due_at',v_renewal.previous_due_at,'new_due_at',v_renewal.new_due_at,'renewal_count',v_count+1,'status',v_loan.status,'idempotent',false);
  perform private.append_circulation_audit(v_actor,'circulation.loan_renewed','loan',v_loan.id,p_request_id,v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_waive_fine(p_fine_id uuid, p_amount_minor bigint, p_request_id uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_existing record; v_fine public.fines%rowtype; v_outstanding bigint; v_result jsonb;
begin
  v_actor := private.require_operator();
  if not private.is_administrator() and not (private.has_active_role('librarian') and coalesce(private.policy_boolean('librarian_waiver_allowed'),false)) then
    raise exception using errcode='42501', message='GS_WAIVER_NOT_ALLOWED';
  end if;
  select * into v_existing from private.circulation_request_lock(p_request_id,'circulation.fine_waived');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.fine_waived' then raise exception using errcode='23505', message='GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent',true);
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_reason is null or char_length(btrim(p_reason)) < 1 or char_length(btrim(p_reason)) > 500 then raise exception using errcode='22023', message='GS_WAIVER_INPUT_INVALID'; end if;
  select * into v_fine from public.fines where id=p_fine_id for update;
  if not found then raise exception using errcode='P0001', message='GS_FINE_NOT_FOUND'; end if;
  v_outstanding := v_fine.assessed_amount_minor-v_fine.waived_amount_minor-v_fine.settled_amount_minor;
  if v_outstanding < 0 or p_amount_minor > v_outstanding then raise exception using errcode='P0001', message='GS_FINE_OUTSTANDING_EXCEEDED'; end if;
  update public.fines set waived_amount_minor=waived_amount_minor+p_amount_minor where id=v_fine.id returning * into v_fine;
  v_outstanding := v_fine.assessed_amount_minor-v_fine.waived_amount_minor-v_fine.settled_amount_minor;
  v_result := jsonb_build_object('fine_id',v_fine.id,'amount_waived_minor',p_amount_minor,'outstanding_minor',v_outstanding,'reason',btrim(p_reason),'status','waived','idempotent',false);
  perform private.append_circulation_audit(v_actor,'circulation.fine_waived','fine',v_fine.id,p_request_id,v_result);
  return v_result;
end;
$$;

revoke all on function public.circulation_renew_loan(uuid,uuid) from public, anon, service_role;
revoke all on function public.circulation_waive_fine(uuid,bigint,uuid,text) from public, anon, service_role;
grant execute on function public.circulation_renew_loan(uuid,uuid), public.circulation_waive_fine(uuid,bigint,uuid,text) to authenticated;
