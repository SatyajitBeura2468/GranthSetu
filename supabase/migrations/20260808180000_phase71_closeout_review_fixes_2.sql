create or replace function public.circulation_loan_search(p_query text default null, p_active_only boolean default false, p_limit integer default 50)
returns table(loan_id uuid, member_id uuid, member_identifier text, member_name text, copy_id uuid, accession_number text,
  title text, barcode text, issued_at timestamptz, due_at timestamptz, returned_at timestamptz, status text, overdue boolean)
language sql stable security definer set search_path = '' as $$
  select l.id, m.id, m.member_identifier, m.display_name, c.id, c.accession_number, b.title, c.barcode,
    l.issued_at, l.due_at, l.returned_at, l.status, l.status='active' and l.due_at < now()
  from public.loans l join public.members m on m.id=l.member_id join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id
  where private.is_active_operator() and (not coalesce(p_active_only,false) or l.status='active')
    and (nullif(btrim(coalesce(p_query,'')),'') is null or l.id::text = btrim(p_query) or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%'
      or b.title ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%' or coalesce(c.barcode,'') ilike '%'||btrim(p_query)||'%'
      or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||btrim(p_query)||'%'))
  order by l.status='active' desc, l.due_at limit greatest(1, least(coalesce(p_limit,50),50));
$$;

create or replace function public.report_inventory_filtered(p_status text default null, p_location_id uuid default null)
returns table(book_id uuid,title text,total_copies bigint,available_copies bigint,on_loan_copies bigint,unavailable_copies bigint)
language sql stable security definer set search_path = '' as $$
  select b.id,b.title,count(c.id),count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where c.operational_state<>'active')
  from public.books b left join public.book_copies c on c.book_id=b.id and (p_status is null or c.operational_state=p_status) and (p_location_id is null or c.location_id=p_location_id)
  where private.is_active_operator() and (p_status is null and p_location_id is null or c.id is not null)
  group by b.id,b.title order by b.title;
$$;

revoke all on function public.circulation_loan_search(text,boolean,integer) from public, anon, service_role;
revoke all on function public.report_inventory_filtered(text,uuid) from public, anon, service_role;
grant execute on function public.circulation_loan_search(text,boolean,integer), public.report_inventory_filtered(text,uuid) to authenticated;
