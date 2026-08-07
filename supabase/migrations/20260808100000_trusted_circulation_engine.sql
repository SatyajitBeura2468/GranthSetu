-- Phase 5 trusted circulation boundary.
-- Policy values remain environment data; this migration does not invent school policy.

alter table public.fines add column if not exists fine_kind text not null default 'overdue';
alter table public.fines add constraint fines_kind_check check (fine_kind in ('overdue'));
update public.fines set fine_kind = 'overdue' where fine_kind is null;

do $$
begin
  if exists (
    select 1 from public.audit_events
    where request_id is not null
    group by request_id having count(*) > 1
  ) then
    raise exception 'cannot add request id uniqueness while duplicates exist';
  end if;
end $$;

create unique index if not exists audit_events_request_id_unique
on public.audit_events (request_id)
where request_id is not null;

create unique index if not exists fines_loan_kind_unique
on public.fines (loan_id, fine_kind);

create index if not exists loan_renewals_loan_index on public.loan_renewals (loan_id);

create or replace function private.require_operator()
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
  if v_profile_id is null or not private.is_active_operator() then
    raise exception using errcode = '42501', message = 'GS_NOT_OPERATOR';
  end if;
  return v_profile_id;
end;
$$;

create or replace function private.circulation_request_lock(p_request_id uuid, p_action text)
returns table (existing_action text, existing_target_id uuid, existing_metadata jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_request_id is null or p_action is null or btrim(p_action) = '' then
    raise exception using errcode = '22023', message = 'GS_REQUEST_ID_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 731905));

  return query
  select a.action, a.target_id, a.metadata
  from public.audit_events as a
  where a.request_id = p_request_id
  limit 1;
end;
$$;

create or replace function private.append_circulation_audit(
  p_actor_profile_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_request_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_profile_id, action, target_type, target_id, request_id, metadata)
  values (
    p_actor_profile_id, p_action, p_target_type, p_target_id, p_request_id,
    case when p_metadata is null then '{}'::jsonb else p_metadata end
  );
end;
$$;

create or replace function private.policy_integer(p_key text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select integer_value
  from public.library_settings
  where setting_key = p_key and value_kind = 'integer'
  limit 1;
$$;

create or replace function private.policy_money(p_key text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select money_minor_value
  from public.library_settings
  where setting_key = p_key and value_kind = 'money_minor' and currency_code = 'INR'
  limit 1;
$$;

create or replace function private.fines_are_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select boolean_value from public.library_settings where setting_key = 'fines_enabled' and value_kind = 'boolean' limit 1), false);
$$;

create or replace function public.circulation_issue_loan(
  p_member_id uuid,
  p_book_copy_id uuid,
  p_request_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_existing record;
  v_member public.members%rowtype;
  v_copy public.book_copies%rowtype;
  v_book public.books%rowtype;
  v_period bigint;
  v_limit bigint;
  v_active_count bigint;
  v_now timestamptz;
  v_loan public.loans%rowtype;
begin
  v_actor := private.require_operator();
  if p_member_id is null or p_book_copy_id is null or p_request_id is null then raise exception using errcode = '22023', message = 'GS_INPUT_INVALID'; end if;
  if p_notes is not null and char_length(btrim(p_notes)) > 2000 then raise exception using errcode = '22023', message = 'GS_NOTES_TOO_LONG'; end if;
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.loan_issued');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_issued' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;

  select * into v_member from public.members where id = p_member_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_MEMBER_NOT_FOUND'; end if;
  if v_member.status <> 'active' then raise exception using errcode = 'P0001', message = 'GS_MEMBER_INACTIVE'; end if;
  if v_member.member_kind = 'student' and not exists (
    select 1 from public.student_enrollments se join public.academic_sessions s on s.id = se.academic_session_id
    where se.member_id = v_member.id and se.status = 'active' and s.status = 'active' and current_date between s.starts_on and s.ends_on
  ) then raise exception using errcode = 'P0001', message = 'GS_STUDENT_ENROLMENT_REQUIRED'; end if;

  v_period := private.policy_integer('default_loan_period_days');
  v_limit := private.policy_integer('checkout_limit');
  if v_period is null or v_period <= 0 or v_limit is null or v_limit < 0 then raise exception using errcode = 'P0001', message = 'GS_POLICY_NOT_CONFIGURED'; end if;
  select count(*) into v_active_count from public.loans where member_id = v_member.id and status = 'active';
  if v_active_count >= v_limit then raise exception using errcode = 'P0001', message = 'GS_CHECKOUT_LIMIT_REACHED'; end if;

  select * into v_copy from public.book_copies where id = p_book_copy_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_COPY_NOT_FOUND'; end if;
  if v_copy.operational_state <> 'active' then raise exception using errcode = 'P0001', message = 'GS_COPY_NOT_CIRCULATABLE'; end if;
  select * into v_book from public.books where id = v_copy.book_id;
  if not found or v_book.status <> 'active' then raise exception using errcode = 'P0001', message = 'GS_BOOK_ARCHIVED'; end if;
  if exists (select 1 from public.loans where book_copy_id = v_copy.id and status = 'active') then raise exception using errcode = 'P0001', message = 'GS_COPY_ALREADY_ON_LOAN'; end if;

  v_now := timezone('utc', now());
  insert into public.loans (member_id, book_copy_id, issued_at, due_at, issued_by_profile_id, status, notes)
  values (v_member.id, v_copy.id, v_now, v_now + make_interval(days => v_period::integer), v_actor, 'active', nullif(btrim(p_notes), ''))
  returning * into v_loan;
  v_existing.existing_metadata := jsonb_build_object('loan_id', v_loan.id, 'member_id', v_loan.member_id, 'copy_id', v_loan.book_copy_id, 'issued_at', v_loan.issued_at, 'due_at', v_loan.due_at, 'status', v_loan.status, 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.loan_issued', 'loan', v_loan.id, p_request_id, v_existing.existing_metadata);
  return v_existing.existing_metadata;
end;
$$;

create or replace function public.circulation_return_loan(p_loan_id uuid, p_request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_now timestamptz; v_result jsonb;
begin
  v_actor := private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.loan_returned');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_returned' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status <> 'active' or v_loan.returned_at is not null then raise exception using errcode = 'P0001', message = 'GS_LOAN_ALREADY_RETURNED'; end if;
  v_now := timezone('utc', now());
  update public.loans set returned_at = v_now, returned_by_profile_id = v_actor, status = 'returned' where id = v_loan.id returning * into v_loan;
  v_result := jsonb_build_object('loan_id', v_loan.id, 'member_id', v_loan.member_id, 'copy_id', v_loan.book_copy_id, 'due_at', v_loan.due_at, 'returned_at', v_loan.returned_at, 'status', v_loan.status, 'overdue', v_loan.returned_at > v_loan.due_at, 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.loan_returned', 'loan', v_loan.id, p_request_id, v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_renew_loan(p_loan_id uuid, p_request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_member public.members%rowtype; v_copy public.book_copies%rowtype; v_book public.books%rowtype; v_period bigint; v_limit bigint; v_count bigint; v_now timestamptz; v_renewal public.loan_renewals%rowtype; v_result jsonb;
begin
  v_actor := private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.loan_renewed');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.loan_renewed' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status <> 'active' then raise exception using errcode = 'P0001', message = 'GS_LOAN_NOT_ACTIVE'; end if;
  v_now := timezone('utc', now());
  if v_now > v_loan.due_at then raise exception using errcode = 'P0001', message = 'GS_LOAN_OVERDUE'; end if;
  select * into v_member from public.members where id = v_loan.member_id;
  if v_member.status <> 'active' then raise exception using errcode = 'P0001', message = 'GS_MEMBER_INACTIVE'; end if;
  if v_member.member_kind = 'student' and not exists (select 1 from public.student_enrollments se join public.academic_sessions s on s.id = se.academic_session_id where se.member_id = v_member.id and se.status = 'active' and s.status = 'active' and current_date between s.starts_on and s.ends_on) then raise exception using errcode = 'P0001', message = 'GS_STUDENT_ENROLMENT_REQUIRED'; end if;
  select * into v_copy from public.book_copies where id = v_loan.book_copy_id;
  if v_copy.operational_state <> 'active' then raise exception using errcode = 'P0001', message = 'GS_COPY_NOT_CIRCULATABLE'; end if;
  select * into v_book from public.books where id = v_copy.book_id;
  if v_book.status <> 'active' then raise exception using errcode = 'P0001', message = 'GS_BOOK_ARCHIVED'; end if;
  v_period := private.policy_integer('default_loan_period_days'); v_limit := private.policy_integer('renewal_limit');
  if v_period is null or v_period <= 0 or v_limit is null or v_limit < 0 then raise exception using errcode = 'P0001', message = 'GS_POLICY_NOT_CONFIGURED'; end if;
  select count(*) into v_count from public.loan_renewals where loan_id = v_loan.id;
  if v_count >= v_limit then raise exception using errcode = 'P0001', message = 'GS_RENEWAL_LIMIT_REACHED'; end if;
  insert into public.loan_renewals (loan_id, approved_by_profile_id, previous_due_at, new_due_at, renewed_at) values (v_loan.id, v_actor, v_loan.due_at, v_loan.due_at + make_interval(days => v_period::integer), v_now) returning * into v_renewal;
  update public.loans set due_at = v_renewal.new_due_at where id = v_loan.id returning * into v_loan;
  v_result := jsonb_build_object('loan_id', v_loan.id, 'renewal_id', v_renewal.id, 'previous_due_at', v_renewal.previous_due_at, 'new_due_at', v_renewal.new_due_at, 'renewal_count', v_count + 1, 'status', v_loan.status, 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.loan_renewed', 'loan', v_loan.id, p_request_id, v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_assess_overdue_fine(p_loan_id uuid, p_request_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_existing record; v_loan public.loans%rowtype; v_grace bigint; v_rate bigint; v_start timestamptz; v_days bigint; v_amount bigint; v_fine public.fines%rowtype; v_result jsonb;
begin
  v_actor := private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.fine_assessed');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.fine_assessed' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  if not private.fines_are_enabled() then return jsonb_build_object('status', 'fines_disabled', 'code', 'GS_FINES_DISABLED', 'idempotent', false); end if;
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_LOAN_NOT_FOUND'; end if;
  if v_loan.status <> 'returned' or v_loan.returned_at is null then raise exception using errcode = 'P0001', message = 'GS_LOAN_NOT_RETURNED'; end if;
  if exists (select 1 from public.fines where loan_id = v_loan.id and fine_kind = 'overdue') then raise exception using errcode = 'P0001', message = 'GS_FINE_ALREADY_ASSESSED'; end if;
  v_grace := private.policy_integer('grace_period_days'); v_rate := private.policy_money('daily_fine_rate_minor');
  if v_grace is null or v_grace < 0 or v_rate is null or v_rate < 0 then raise exception using errcode = 'P0001', message = 'GS_FINE_POLICY_NOT_CONFIGURED'; end if;
  v_start := v_loan.due_at + make_interval(days => v_grace::integer);
  if v_loan.returned_at <= v_start then v_days := 0; else v_days := ceil(extract(epoch from (v_loan.returned_at - v_start)) / 86400.0)::bigint; end if;
  v_amount := v_days * v_rate;
  if v_amount <= 0 then return jsonb_build_object('status', 'no_fine_due', 'code', 'GS_NO_FINE_DUE', 'chargeable_days', v_days, 'idempotent', false); end if;
  insert into public.fines (loan_id, fine_kind, assessed_amount_minor, reason, assessed_by_profile_id) values (v_loan.id, 'overdue', v_amount, 'Overdue fine calculated from configured circulation policy.', v_actor) returning * into v_fine;
  v_result := jsonb_build_object('fine_id', v_fine.id, 'loan_id', v_loan.id, 'assessed_amount_minor', v_fine.assessed_amount_minor, 'chargeable_days', v_days, 'currency_code', v_fine.currency_code, 'status', 'assessed', 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.fine_assessed', 'fine', v_fine.id, p_request_id, v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_settle_fine(p_fine_id uuid, p_amount_minor bigint, p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_existing record; v_fine public.fines%rowtype; v_outstanding bigint; v_result jsonb;
begin
  v_actor := private.require_operator();
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.fine_settled');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.fine_settled' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception using errcode = '22023', message = 'GS_FINE_AMOUNT_INVALID'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 500 then raise exception using errcode = '22023', message = 'GS_NOTE_TOO_LONG'; end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_FINE_NOT_FOUND'; end if;
  v_outstanding := v_fine.assessed_amount_minor - v_fine.waived_amount_minor - v_fine.settled_amount_minor;
  if v_outstanding < 0 or p_amount_minor > v_outstanding then raise exception using errcode = 'P0001', message = 'GS_FINE_OUTSTANDING_EXCEEDED'; end if;
  update public.fines set settled_amount_minor = settled_amount_minor + p_amount_minor where id = v_fine.id returning * into v_fine;
  v_outstanding := v_fine.assessed_amount_minor - v_fine.waived_amount_minor - v_fine.settled_amount_minor;
  v_result := jsonb_build_object('fine_id', v_fine.id, 'amount_settled_minor', p_amount_minor, 'outstanding_minor', v_outstanding, 'currency_code', v_fine.currency_code, 'note', nullif(btrim(p_note), ''), 'status', 'settled', 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.fine_settled', 'fine', v_fine.id, p_request_id, v_result);
  return v_result;
end;
$$;

create or replace function public.circulation_waive_fine(p_fine_id uuid, p_amount_minor bigint, p_request_id uuid, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_existing record; v_fine public.fines%rowtype; v_outstanding bigint; v_result jsonb;
begin
  v_actor := private.require_operator();
  if not private.is_administrator() then raise exception using errcode = '42501', message = 'GS_ADMIN_REQUIRED'; end if;
  select * into v_existing from private.circulation_request_lock(p_request_id, 'circulation.fine_waived');
  if v_existing.existing_action is not null then
    if v_existing.existing_action <> 'circulation.fine_waived' then raise exception using errcode = '23505', message = 'GS_REQUEST_ID_REUSED'; end if;
    return v_existing.existing_metadata || jsonb_build_object('idempotent', true);
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_reason is null or char_length(btrim(p_reason)) < 1 or char_length(btrim(p_reason)) > 500 then raise exception using errcode = '22023', message = 'GS_WAIVER_INPUT_INVALID'; end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_FINE_NOT_FOUND'; end if;
  v_outstanding := v_fine.assessed_amount_minor - v_fine.waived_amount_minor - v_fine.settled_amount_minor;
  if v_outstanding < 0 or p_amount_minor > v_outstanding then raise exception using errcode = 'P0001', message = 'GS_FINE_OUTSTANDING_EXCEEDED'; end if;
  update public.fines set waived_amount_minor = waived_amount_minor + p_amount_minor where id = v_fine.id returning * into v_fine;
  v_outstanding := v_fine.assessed_amount_minor - v_fine.waived_amount_minor - v_fine.settled_amount_minor;
  v_result := jsonb_build_object('fine_id', v_fine.id, 'amount_waived_minor', p_amount_minor, 'outstanding_minor', v_outstanding, 'reason', btrim(p_reason), 'status', 'waived', 'idempotent', false);
  perform private.append_circulation_audit(v_actor, 'circulation.fine_waived', 'fine', v_fine.id, p_request_id, v_result);
  return v_result;
end;
$$;

alter function private.require_operator() owner to postgres;
alter function private.circulation_request_lock(uuid, text) owner to postgres;
alter function private.append_circulation_audit(uuid, text, text, uuid, uuid, jsonb) owner to postgres;
alter function private.policy_integer(text) owner to postgres;
alter function private.policy_money(text) owner to postgres;
alter function private.fines_are_enabled() owner to postgres;

revoke all on function private.require_operator() from public, anon, authenticated, service_role;
revoke all on function private.circulation_request_lock(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.append_circulation_audit(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.policy_integer(text) from public, anon, authenticated, service_role;
revoke all on function private.policy_money(text) from public, anon, authenticated, service_role;
revoke all on function private.fines_are_enabled() from public, anon, authenticated, service_role;

revoke all on function public.circulation_issue_loan(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.circulation_return_loan(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.circulation_renew_loan(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.circulation_assess_overdue_fine(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.circulation_settle_fine(uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.circulation_waive_fine(uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.circulation_issue_loan(uuid, uuid, uuid, text), public.circulation_return_loan(uuid, uuid), public.circulation_renew_loan(uuid, uuid), public.circulation_assess_overdue_fine(uuid, uuid), public.circulation_settle_fine(uuid, bigint, uuid, text), public.circulation_waive_fine(uuid, bigint, uuid, text) to authenticated;

comment on column public.fines.fine_kind is 'Phase 5 currently supports overdue only; future fine categories require an approved migration.';
comment on index public.audit_events_request_id_unique is 'One successful mutating business request per idempotency UUID.';
