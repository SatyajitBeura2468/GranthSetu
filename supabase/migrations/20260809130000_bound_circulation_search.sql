-- Bound every circulation search before JSON aggregation so broad queries
-- cannot return an unbounded room data set.

create or replace function public.operator_circulation_search(p_library_code text, p_kind text, p_query text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_library uuid; v_q text; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code); v_q:=btrim(coalesce(p_query,''));
  if char_length(v_q)<2 then return '[]'::jsonb; end if;
  if p_kind='members' then
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'identifier',m.member_identifier,
      'context',coalesce((select s.display_label||' · '||g.display_name||' · '||sec.display_name||coalesce(' · Roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id and s.library_id=se.library_id join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id where se.library_id=v_library and se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),initcap(m.member_kind)),
      'activeLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active'),
      'overdueLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active' and l.due_at<timezone('utc',now()))) order by m.display_name),'[]'::jsonb)
    into v_result from (select * from public.members where library_id=v_library and status='active' and (display_name ilike '%'||v_q||'%' or member_identifier ilike '%'||v_q||'%') order by display_name limit 50) m;
  elsif p_kind='copies' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'author',coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=q.book_id and ba.library_id=v_library),'Author not listed'),'accession',q.accession_number,'barcode',q.barcode,'location',q.location,'state','Available') order by q.title,q.accession_number),'[]'::jsonb)
    into v_result from (
      select c.id,c.book_id,b.title,c.accession_number,c.barcode,coalesce(loc.display_name,'Not assigned') location
      from public.book_copies c join public.books b on b.id=c.book_id and b.library_id=c.library_id left join public.locations loc on loc.id=c.location_id and loc.library_id=c.library_id
      where c.library_id=v_library and c.operational_state='active' and b.status='active'
        and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')
        and (b.title ilike '%'||v_q||'%' or coalesce(b.isbn,'') ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%' or coalesce(c.barcode,'') ilike '%'||v_q||'%' or exists(select 1 from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library and a.display_name ilike '%'||v_q||'%'))
      order by b.title,c.accession_number limit 50
    ) q;
  elsif p_kind='loans' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'member',q.member,'identifier',q.identifier,'title',q.title,'accession',q.accession,'barcode',q.barcode,'due',q.due_at::date,'overdue',q.due_at<timezone('utc',now())) order by q.due_at),'[]'::jsonb)
    into v_result from (
      select lo.id,m.display_name member,m.member_identifier identifier,b.title,c.accession_number accession,c.barcode,lo.due_at
      from public.loans lo join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where lo.library_id=v_library and lo.status='active' and (m.display_name ilike '%'||v_q||'%' or m.member_identifier ilike '%'||v_q||'%' or b.title ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%' or coalesce(c.barcode,'') ilike '%'||v_q||'%')
      order by lo.due_at limit 50
    ) q;
  elsif p_kind='fines' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'member',q.member,'identifier',q.identifier,'title',q.title,'accession',q.accession,'assessedMinor',q.assessed_amount_minor,'outstandingMinor',q.outstanding_minor,'reason',q.reason) order by q.created_at desc),'[]'::jsonb)
    into v_result from (
      select f.id,m.display_name member,m.member_identifier identifier,b.title,c.accession_number accession,f.assessed_amount_minor,f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor outstanding_minor,f.reason,f.created_at
      from public.fines f join public.loans lo on lo.id=f.loan_id and lo.library_id=f.library_id join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where f.library_id=v_library and f.assessed_amount_minor-f.waived_amount_minor-f.settled_amount_minor>0 and (m.display_name ilike '%'||v_q||'%' or m.member_identifier ilike '%'||v_q||'%' or b.title ilike '%'||v_q||'%' or c.accession_number ilike '%'||v_q||'%')
      order by f.created_at desc limit 50
    ) q;
  else raise exception using errcode='22023',message='GS_SEARCH_KIND_INVALID';
  end if;
  return coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke execute on function public.operator_circulation_search(text,text,text) from public, anon;
grant execute on function public.operator_circulation_search(text,text,text) to authenticated;
