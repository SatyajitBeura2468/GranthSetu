-- Phase 7.1 database-applied search and reporting surfaces.

create or replace function public.catalogue_members_v71(p_search text default null)
returns table(id uuid, member_identifier text, display_name text, member_kind text, status text,
  active_loans bigint, overdue_loans bigint, enrollment_label text, roll_number text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.member_identifier, m.display_name, m.member_kind, m.status,
    (select count(*) from public.loans l where l.member_id=m.id and l.status='active'),
    (select count(*) from public.loans l where l.member_id=m.id and l.status='active' and l.due_at < timezone('utc',now())),
    (select s.display_label || ' / ' || g.display_name || ' / ' || sec.display_name
       from public.student_enrollments se
       join public.academic_sessions s on s.id=se.academic_session_id
       join public.grade_levels g on g.id=se.grade_level_id
       join public.sections sec on sec.id=se.section_id
      where se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),
    (select se.roll_number from public.student_enrollments se where se.member_id=m.id and se.status='active' order by se.created_at desc limit 1),
    m.updated_at
  from public.members m
  where private.is_active_operator()
    and (nullif(btrim(coalesce(p_search,'')),'') is null
      or m.display_name ilike '%'||btrim(p_search)||'%'
      or m.member_identifier ilike '%'||btrim(p_search)||'%'
      or exists (select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||btrim(p_search)||'%')
      or exists (select 1 from public.student_enrollments se join public.grade_levels g on g.id=se.grade_level_id join public.sections sec on sec.id=se.section_id where se.member_id=m.id and (g.display_name ilike '%'||btrim(p_search)||'%' or sec.display_name ilike '%'||btrim(p_search)||'%')))
  order by m.display_name limit 200;
$$;

create or replace function public.circulation_member_search(p_query text default null, p_limit integer default 50)
returns table(member_id uuid, member_identifier text, display_name text, member_kind text, status text,
  enrollment_label text, roll_number text, active_loans bigint, overdue_loans bigint)
language sql stable security definer set search_path = '' as $$
  select m.id, m.member_identifier, m.display_name, m.member_kind, m.status,
    (select s.display_label||' / '||g.display_name||' / '||sec.display_name from public.student_enrollments se
      join public.academic_sessions s on s.id=se.academic_session_id join public.grade_levels g on g.id=se.grade_level_id join public.sections sec on sec.id=se.section_id
      where se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),
    (select se.roll_number from public.student_enrollments se where se.member_id=m.id and se.status='active' order by se.created_at desc limit 1),
    (select count(*) from public.loans l where l.member_id=m.id and l.status='active'),
    (select count(*) from public.loans l where l.member_id=m.id and l.status='active' and l.due_at < timezone('utc',now()))
  from public.members m
  where private.is_active_operator() and m.status='active'
    and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%'
      or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||btrim(p_query)||'%')
      or exists(select 1 from public.student_enrollments se join public.grade_levels g on g.id=se.grade_level_id join public.sections sec on sec.id=se.section_id where se.member_id=m.id and (g.display_name ilike '%'||btrim(p_query)||'%' or sec.display_name ilike '%'||btrim(p_query)||'%')))
  order by m.display_name limit greatest(1, least(coalesce(p_limit,50),50));
$$;

create or replace function public.circulation_copy_search(p_query text default null, p_available_only boolean default false, p_limit integer default 50)
returns table(copy_id uuid, book_id uuid, title text, author_names text, isbn text, accession_number text, barcode text,
  location_name text, operational_state text, available boolean, on_loan boolean, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, b.id, b.title,
    coalesce((select string_agg(a.display_name, ', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id),'No author'),
    b.isbn, c.accession_number, c.barcode, loc.display_name, c.operational_state,
    (c.operational_state='active' and b.status='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),
    exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active'), c.updated_at
  from public.book_copies c join public.books b on b.id=c.book_id left join public.locations loc on loc.id=c.location_id
  where private.is_active_operator()
    and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||btrim(p_query)||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(btrim(p_query))||'%'
      or c.accession_number ilike '%'||btrim(p_query)||'%' or coalesce(c.barcode,'') ilike '%'||btrim(p_query)||'%'
      or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id and a.display_name ilike '%'||btrim(p_query)||'%'))
    and (not coalesce(p_available_only,false) or (c.operational_state='active' and b.status='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')))
  order by b.title,c.accession_number limit greatest(1, least(coalesce(p_limit,50),50));
$$;

create or replace function public.circulation_loan_search(p_query text default null, p_active_only boolean default false, p_limit integer default 50)
returns table(loan_id uuid, member_id uuid, member_identifier text, member_name text, copy_id uuid, accession_number text,
  title text, barcode text, issued_at timestamptz, due_at timestamptz, returned_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select l.id, m.id, m.member_identifier, m.display_name, c.id, c.accession_number, b.title, c.barcode,
    l.issued_at, l.due_at, l.returned_at, l.status
  from public.loans l join public.members m on m.id=l.member_id join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id
  where private.is_active_operator() and (not coalesce(p_active_only,false) or l.status='active')
    and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%'
      or b.title ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%' or coalesce(c.barcode,'') ilike '%'||btrim(p_query)||'%'
      or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||btrim(p_query)||'%'))
  order by case when l.status='active' then 0 else 1 end, l.due_at desc limit greatest(1, least(coalesce(p_limit,50),50));
$$;

create or replace function public.circulation_fine_search(p_query text default null, p_outstanding_only boolean default false, p_limit integer default 50)
returns table(fine_id uuid, loan_id uuid, fine_kind text, member_identifier text, member_name text, title text,
  accession_number text, assessed_amount_minor bigint, waived_amount_minor bigint, settled_amount_minor bigint,
  outstanding_minor bigint, created_at timestamptz, reason text)
language sql stable security definer set search_path = '' as $$
  select f.id, f.loan_id, f.fine_kind, m.member_identifier, m.display_name, b.title, c.accession_number,
    f.assessed_amount_minor, f.waived_amount_minor, f.settled_amount_minor,
    f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor, f.created_at, f.reason
  from public.fines f join public.loans l on l.id=f.loan_id join public.members m on m.id=l.member_id
    join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id
  where private.is_active_operator()
    and (not coalesce(p_outstanding_only,false) or f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor > 0)
    and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%'
      or b.title ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%' or f.fine_kind ilike '%'||btrim(p_query)||'%')
  order by f.created_at desc limit greatest(1, least(coalesce(p_limit,50),50));
$$;

create or replace function public.report_circulation_filtered(p_from date default null, p_to date default null, p_query text default null)
returns table(loan_id uuid,title text,accession_number text,member_name text,member_identifier text,issued_at timestamptz,due_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is not null and p_to is not null and p_from > p_to then raise exception using errcode='22023', message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  return query select l.id,b.title,c.accession_number,m.display_name,m.member_identifier,l.issued_at,l.due_at,l.returned_at,l.status
    from public.loans l join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=l.member_id
    where private.is_active_operator() and (p_from is null or l.issued_at::date >= p_from) and (p_to is null or l.issued_at::date <= p_to)
      and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||btrim(p_query)||'%' or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%')
    order by l.issued_at desc limit 1000;
end;
$$;

create or replace function public.report_overdue_filtered(p_as_of date default null, p_query text default null)
returns table(loan_id uuid,title text,member_name text,member_identifier text,accession_number text,due_at timestamptz,days_overdue bigint)
language sql stable security definer set search_path = '' as $$
  select l.id,b.title,m.display_name,m.member_identifier,c.accession_number,l.due_at,
    greatest(0, ceil(extract(epoch from ((coalesce(p_as_of,current_date)+1)::timestamptz-l.due_at))/86400)::bigint)
  from public.loans l join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=l.member_id
  where private.is_active_operator() and l.status='active' and l.due_at < (coalesce(p_as_of,current_date)+1)::timestamptz
    and (nullif(btrim(coalesce(p_query,'')),'') is null or b.title ilike '%'||btrim(p_query)||'%' or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%')
  order by l.due_at limit 1000;
$$;

create or replace function public.report_popular_books_filtered(p_from date default null, p_to date default null)
returns table(book_id uuid,title text,loan_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is not null and p_to is not null and p_from > p_to then raise exception using errcode='22023', message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  return query select b.id,b.title,count(l.id) from public.books b join public.book_copies c on c.book_id=b.id join public.loans l on l.book_copy_id=c.id
    where private.is_active_operator() and (p_from is null or l.issued_at::date >= p_from) and (p_to is null or l.issued_at::date <= p_to)
    group by b.id,b.title order by count(l.id) desc,b.title limit 500;
end;
$$;

create or replace function public.report_member_activity_filtered(p_from date default null, p_to date default null, p_query text default null)
returns table(member_id uuid,member_name text,member_identifier text,loan_count bigint,active_loans bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is not null and p_to is not null and p_from > p_to then raise exception using errcode='22023', message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  return query select m.id,m.display_name,m.member_identifier,count(l.id),count(l.id) filter(where l.status='active')
    from public.members m left join public.loans l on l.member_id=m.id and (p_from is null or l.issued_at::date >= p_from) and (p_to is null or l.issued_at::date <= p_to)
    where private.is_active_operator() and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%')
    group by m.id,m.display_name,m.member_identifier order by count(l.id) desc,m.display_name limit 1000;
end;
$$;

create or replace function public.report_inventory_filtered(p_status text default null, p_location_id uuid default null)
returns table(book_id uuid,title text,total_copies bigint,available_copies bigint,on_loan_copies bigint,unavailable_copies bigint)
language sql stable security definer set search_path = '' as $$
  select b.id,b.title,count(c.id),count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where exists(select 1 from public.loans l where l.book_copy_id=c.id and l.status='active')),
    count(c.id) filter(where c.operational_state<>'active')
  from public.books b left join public.book_copies c on c.book_id=b.id and (p_status is null or c.operational_state=p_status) and (p_location_id is null or c.location_id=p_location_id)
  where private.is_active_operator() group by b.id,b.title order by b.title;
$$;

create or replace function public.report_fines_filtered(p_from date default null, p_to date default null, p_query text default null, p_outstanding_only boolean default false)
returns table(fine_id uuid,loan_id uuid,fine_kind text,assessed_amount_minor bigint,waived_amount_minor bigint,settled_amount_minor bigint,outstanding_minor bigint,created_at timestamptz,reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is not null and p_to is not null and p_from > p_to then raise exception using errcode='22023', message='GS_REPORT_DATE_RANGE_INVALID'; end if;
  return query select f.id,f.loan_id,f.fine_kind,f.assessed_amount_minor,f.waived_amount_minor,f.settled_amount_minor,
    f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor,f.created_at,f.reason
    from public.fines f join public.loans l on l.id=f.loan_id join public.members m on m.id=l.member_id join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id
    where private.is_active_operator() and (p_from is null or f.created_at::date >= p_from) and (p_to is null or f.created_at::date <= p_to)
      and (not coalesce(p_outstanding_only,false) or f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor > 0)
      and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%' or b.title ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%')
    order by f.created_at desc limit 1000;
end;
$$;

revoke all on function public.catalogue_members_v71(text) from public, anon, service_role;
revoke all on function public.circulation_member_search(text,integer) from public, anon, service_role;
revoke all on function public.circulation_copy_search(text,boolean,integer) from public, anon, service_role;
revoke all on function public.circulation_loan_search(text,boolean,integer) from public, anon, service_role;
revoke all on function public.circulation_fine_search(text,boolean,integer) from public, anon, service_role;
revoke all on function public.report_circulation_filtered(date,date,text) from public, anon, service_role;
revoke all on function public.report_overdue_filtered(date,text) from public, anon, service_role;
revoke all on function public.report_popular_books_filtered(date,date) from public, anon, service_role;
revoke all on function public.report_member_activity_filtered(date,date,text) from public, anon, service_role;
revoke all on function public.report_inventory_filtered(text,uuid) from public, anon, service_role;
revoke all on function public.report_fines_filtered(date,date,text,boolean) from public, anon, service_role;
grant execute on function public.catalogue_members_v71(text), public.circulation_member_search(text,integer), public.circulation_copy_search(text,boolean,integer), public.circulation_loan_search(text,boolean,integer), public.circulation_fine_search(text,boolean,integer), public.report_circulation_filtered(date,date,text), public.report_overdue_filtered(date,text), public.report_popular_books_filtered(date,date), public.report_member_activity_filtered(date,date,text), public.report_inventory_filtered(text,uuid), public.report_fines_filtered(date,date,text,boolean) to authenticated;
