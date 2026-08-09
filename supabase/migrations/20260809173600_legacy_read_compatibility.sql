-- Preserve mature Phase 7.1 read contracts without restoring platform-global data access.
-- These compatibility functions resolve only a caller's sole active Library Room.
-- Multi-room operators must use the explicit room-aware APIs and fail closed here.

create or replace function public.global_search_v71(p_query text)
returns table(result_type text, result_id uuid, label text, detail text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_library uuid;
  v_code text;
  v_results jsonb;
begin
  v_library := private.request_library_id();
  if v_library is null then raise exception using errcode='42501', message='GS_NOT_OPERATOR'; end if;
  select public_code into v_code from public.libraries where id=v_library and status='active';
  if v_code is null then raise exception using errcode='42501', message='GS_LIBRARY_CONTEXT_REQUIRED'; end if;
  v_results := public.operator_global_search(v_code, p_query);
  return query
  select r.result_type, r.result_id, r.title, r.subtitle, null::text
  from jsonb_to_recordset(v_results) as r(result_type text,result_id uuid,title text,subtitle text);
end;
$$;

create or replace function public.report_overdue_filtered(p_as_of date default null, p_query text default null)
returns table(loan_id uuid, title text, member_name text, member_identifier text, accession_number text, due_at timestamptz, days_overdue bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_library uuid;
  v_code text;
  v_results jsonb;
begin
  v_library := private.request_library_id();
  if v_library is null then raise exception using errcode='42501', message='GS_NOT_OPERATOR'; end if;
  select public_code into v_code from public.libraries where id=v_library and status='active';
  if v_code is null then raise exception using errcode='42501', message='GS_LIBRARY_CONTEXT_REQUIRED'; end if;
  v_results := public.operator_room_report(v_code,'overdue',null,p_as_of,p_query,null,false);
  return query
  select r.loan_id,r.title,r.member_name,r.member_identifier,r.accession_number,r.due_at,r.days_overdue
  from jsonb_to_recordset(v_results) as r(loan_id uuid,title text,member_name text,member_identifier text,accession_number text,due_at timestamptz,days_overdue bigint);
end;
$$;

create or replace function public.report_inventory_filtered(p_status text default null, p_location_id uuid default null)
returns table(book_id uuid, title text, total_copies bigint, available_copies bigint, on_loan_copies bigint, unavailable_copies bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_library uuid;
begin
  v_library := private.request_library_id();
  if v_library is null then raise exception using errcode='42501', message='GS_NOT_OPERATOR'; end if;
  return query
  select b.id,b.title,
    count(c.id),
    count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where c.operational_state<>'active')
  from public.books b
  left join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id
    and (p_status is null or c.operational_state=p_status)
    and (p_location_id is null or c.location_id=p_location_id)
  where b.library_id=v_library
  group by b.id,b.title
  having (p_status is null and p_location_id is null) or count(c.id)>0
  order by b.title;
end;
$$;

revoke execute on function public.global_search_v71(text) from public, anon;
revoke execute on function public.report_overdue_filtered(date,text) from public, anon;
revoke execute on function public.report_inventory_filtered(text,uuid) from public, anon;
grant execute on function public.global_search_v71(text) to authenticated;
grant execute on function public.report_overdue_filtered(date,text) to authenticated;
grant execute on function public.report_inventory_filtered(text,uuid) to authenticated;
