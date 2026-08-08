create or replace function public.global_search_v71(p_query text)
returns table(result_type text, result_id uuid, label text, detail text, status text)
language sql stable security definer set search_path = '' as $$
  with q as (select btrim(coalesce(p_query,'')) as value)
  select 'book', b.id, b.title, coalesce(b.isbn, 'No ISBN') || ' · ' || coalesce((select string_agg(a.display_name, ', ') from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id), 'No author'), b.status
    from public.books b, q where private.is_active_operator() and char_length(q.value) >= 2
      and (b.title ilike '%'||q.value||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(q.value)||'%' or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id where ba.book_id=b.id and a.display_name ilike '%'||q.value||'%'))
  union all
  select 'member', m.id, m.display_name, m.member_identifier || coalesce(' · ' || (select s.display_label||' / '||g.display_name||' / '||sec.display_name||coalesce(' / roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id join public.grade_levels g on g.id=se.grade_level_id join public.sections sec on sec.id=se.section_id where se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1), ''), m.status
    from public.members m, q where private.is_active_operator() and char_length(q.value) >= 2
      and (m.display_name ilike '%'||q.value||'%' or m.member_identifier ilike '%'||q.value||'%' or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||q.value||'%'))
  union all
  select 'loan', l.id, b.title || ' → ' || m.display_name, 'Due ' || to_char(l.due_at, 'YYYY-MM-DD'), case when l.due_at < now() then 'overdue' else l.status end
    from public.loans l join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id join public.members m on m.id=l.member_id, q
    where private.is_active_operator() and l.status='active' and char_length(q.value) >= 2
      and (b.title ilike '%'||q.value||'%' or m.display_name ilike '%'||q.value||'%' or m.member_identifier ilike '%'||q.value||'%' or c.accession_number ilike '%'||q.value||'%' or coalesce(c.barcode,'') ilike '%'||q.value||'%')
  union all
  select 'copy', c.id, b.title || ' · ' || c.accession_number, coalesce(c.barcode,'No barcode') || ' · ' || coalesce(b.isbn,'No ISBN'), c.operational_state
    from public.book_copies c join public.books b on b.id=c.book_id, q where private.is_active_operator() and char_length(q.value) >= 2
      and (b.title ilike '%'||q.value||'%' or coalesce(b.isbn_normalized,'') ilike '%'||lower(q.value)||'%' or c.accession_number ilike '%'||q.value||'%' or coalesce(c.barcode,'') ilike '%'||q.value||'%')
  order by 3 limit 50;
$$;

drop function if exists public.circulation_loan_search(text, boolean, integer);
create function public.circulation_loan_search(p_query text default null, p_active_only boolean default false, p_limit integer default 50)
returns table(loan_id uuid, member_id uuid, member_identifier text, member_name text, copy_id uuid, accession_number text,
  title text, barcode text, issued_at timestamptz, due_at timestamptz, returned_at timestamptz, status text, overdue boolean)
language sql stable security definer set search_path = '' as $$
  select l.id, m.id, m.member_identifier, m.display_name, c.id, c.accession_number, b.title, c.barcode,
    l.issued_at, l.due_at, l.returned_at, l.status, l.status='active' and l.due_at < now()
  from public.loans l join public.members m on m.id=l.member_id join public.book_copies c on c.id=l.book_copy_id join public.books b on b.id=c.book_id
  where private.is_active_operator() and (not coalesce(p_active_only,false) or l.status='active')
    and (nullif(btrim(coalesce(p_query,'')),'') is null or m.display_name ilike '%'||btrim(p_query)||'%' or m.member_identifier ilike '%'||btrim(p_query)||'%'
      or b.title ilike '%'||btrim(p_query)||'%' or c.accession_number ilike '%'||btrim(p_query)||'%' or coalesce(c.barcode,'') ilike '%'||btrim(p_query)||'%'
      or exists(select 1 from public.student_enrollments se where se.member_id=m.id and se.roll_number ilike '%'||btrim(p_query)||'%'))
  order by l.status='active' desc, l.due_at limit greatest(1, least(coalesce(p_limit,50),50));
$$;

revoke all on function public.global_search_v71(text) from public, anon, service_role;
revoke all on function public.circulation_loan_search(text,boolean,integer) from public, anon, service_role;
grant execute on function public.global_search_v71(text), public.circulation_loan_search(text,boolean,integer) to authenticated;
