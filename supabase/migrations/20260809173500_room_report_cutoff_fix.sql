-- Keep room-scoped reports aligned with the mature Phase 7.1 semantics.
-- Default overdue cutoff is the current instant; an explicit p_to date is end-of-day inclusive.
-- Inventory filters omit books with no matching copies when a state filter is supplied.

create or replace function public.operator_room_report(
  p_library_code text,
  p_kind text,
  p_from date default null,
  p_to date default null,
  p_query text default null,
  p_status text default null,
  p_outstanding_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_library uuid;
  v_result jsonb;
  v_overdue_cutoff timestamptz;
begin
  v_library := private.require_library_access(p_library_code);
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception using errcode='22023', message='GS_REPORT_DATE_RANGE_INVALID';
  end if;
  v_overdue_cutoff := case
    when p_to is null then timezone('utc', now())
    else (p_to + 1)::timestamptz
  end;

  if p_kind='circulation' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.issued_at desc),'[]'::jsonb) into v_result from (
      select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.issued_at,lo.due_at,lo.returned_at,lo.status
      from public.loans lo
      join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id
      join public.books b on b.id=c.book_id and b.library_id=c.library_id
      join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      where lo.library_id=v_library
        and (p_from is null or lo.issued_at::date>=p_from)
        and (p_to is null or lo.issued_at::date<=p_to)
        and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or c.accession_number ilike '%'||p_query||'%')
      limit 1000
    ) q;
  elsif p_kind='overdue' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.due_at),'[]'::jsonb) into v_result from (
      select lo.id loan_id,b.title,c.accession_number,m.display_name member_name,m.member_identifier,lo.due_at,
        greatest(0,ceil(extract(epoch from (v_overdue_cutoff-lo.due_at))/86400.0)::bigint) days_overdue
      from public.loans lo
      join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id
      join public.books b on b.id=c.book_id and b.library_id=c.library_id
      join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      where lo.library_id=v_library and lo.status='active' and lo.due_at<v_overdue_cutoff
        and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||p_query||'%' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or c.accession_number ilike '%'||p_query||'%')
      limit 1000
    ) q;
  elsif p_kind='popular' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (
      select b.id book_id,b.title,count(lo.id) loan_count
      from public.books b
      join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id
      join public.loans lo on lo.book_copy_id=c.id and lo.library_id=c.library_id
      where b.library_id=v_library and (p_from is null or lo.issued_at::date>=p_from) and (p_to is null or lo.issued_at::date<=p_to)
      group by b.id,b.title order by count(lo.id) desc limit 500
    ) q;
  elsif p_kind='members' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.loan_count desc),'[]'::jsonb) into v_result from (
      select m.id member_id,m.display_name member_name,m.member_identifier,count(lo.id) loan_count,count(lo.id) filter(where lo.status='active') active_loans
      from public.members m
      left join public.loans lo on lo.member_id=m.id and lo.library_id=m.library_id and (p_from is null or lo.issued_at::date>=p_from) and (p_to is null or lo.issued_at::date<=p_to)
      where m.library_id=v_library and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%')
      group by m.id,m.display_name,m.member_identifier limit 1000
    ) q;
  elsif p_kind='inventory' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.title),'[]'::jsonb) into v_result from (
      select b.id book_id,b.title,count(c.id) total_copies,
        count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) available_copies,
        count(c.id) filter(where exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active')) on_loan_copies,
        count(c.id) filter(where c.operational_state<>'active') unavailable_copies
      from public.books b
      left join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id and (p_status is null or c.operational_state=p_status)
      where b.library_id=v_library
      group by b.id,b.title
      having p_status is null or count(c.id)>0
    ) q;
  elsif p_kind='fines' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result from (
      select f.id fine_id,m.display_name member_name,m.member_identifier,b.title,c.accession_number,f.assessed_amount_minor,f.waived_amount_minor,f.settled_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor outstanding_minor,f.created_at,f.reason
      from public.fines f
      join public.loans lo on lo.id=f.loan_id and lo.library_id=f.library_id
      join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id
      join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where f.library_id=v_library
        and (p_from is null or f.created_at::date>=p_from)
        and (p_to is null or f.created_at::date<=p_to)
        and (not p_outstanding_only or f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor>0)
        and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or b.title ilike '%'||p_query||'%')
      limit 1000
    ) q;
  else
    raise exception using errcode='22023',message='GS_REPORT_KIND_INVALID';
  end if;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke execute on function public.operator_room_report(text,text,date,date,text,text,boolean) from public, anon;
grant execute on function public.operator_room_report(text,text,date,date,text,text,boolean) to authenticated;
