-- Final production release-gate fixes for global Library Rooms.
-- 1) Remove legacy global read RPCs that can bypass room scoping.
-- 2) Reuse existing room-local authors when saving books.
-- 3) Add explicit room-aware reference and global-search RPCs.
-- 4) Make circulation member search match its advertised class/section/roll behavior.

revoke execute on function public.global_search_v71(text) from public, anon, authenticated;
revoke execute on function public.circulation_member_search(text, integer) from public, anon, authenticated;
revoke execute on function public.circulation_copy_search(text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.circulation_loan_search(text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.circulation_fine_search(text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.report_inventory_filtered(text, uuid) from public, anon, authenticated;
revoke execute on function public.report_overdue_filtered(date, text) from public, anon, authenticated;

create or replace function public.catalogue_upsert_author(p_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_library uuid;
  v_id uuid;
  v_name text;
begin
  v_actor := private.require_catalogue_operator();
  v_library := private.request_library_id();
  v_name := btrim(coalesce(p_display_name, ''));
  if char_length(v_name) not between 1 and 160 then
    raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID';
  end if;

  if p_id is null then
    select id into v_id
    from public.authors
    where library_id = v_library and display_name = v_name
    limit 1;
    if v_id is not null then
      return v_id;
    end if;

    begin
      insert into public.authors(library_id, display_name)
      values (v_library, v_name)
      returning id into v_id;
    exception when unique_violation then
      select id into v_id
      from public.authors
      where library_id = v_library and display_name = v_name
      limit 1;
      if v_id is not null then return v_id; end if;
      raise;
    end;
  else
    update public.authors
    set display_name = v_name
    where id = p_id and library_id = v_library
    returning id into v_id;
    if v_id is null then
      raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND';
    end if;
  end if;

  perform private.admin_audit(
    v_actor,
    'catalogue.author_saved',
    'author',
    v_id,
    jsonb_build_object('display_name', v_name)
  );
  return v_id;
exception when unique_violation then
  raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.operator_reference_save(
  p_library_code text,
  p_kind text,
  p_name text,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_library uuid;
  v_id uuid;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
begin
  v_library := private.require_library_access(p_library_code);
  if char_length(v_name) not between 1 and 160 then
    raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID';
  end if;

  case v_kind
    when 'author' then v_id := public.catalogue_upsert_author(null, v_name);
    when 'publisher' then v_id := public.catalogue_upsert_publisher(null, v_name);
    when 'category' then v_id := public.catalogue_upsert_category(null, v_name);
    when 'subject' then v_id := public.catalogue_upsert_subject(null, v_name);
    when 'location' then
      if v_code is null or char_length(v_code) > 80 then
        raise exception using errcode='22023', message='GS_LOCATION_CODE_REQUIRED';
      end if;
      v_id := public.catalogue_upsert_location(null, v_code, v_name);
    else
      raise exception using errcode='22023', message='GS_REFERENCE_KIND_INVALID';
  end case;

  return jsonb_build_object('id', v_id, 'kind', v_kind, 'library_id', v_library);
end;
$$;

revoke execute on function public.operator_reference_save(text,text,text,text) from public, anon;
grant execute on function public.operator_reference_save(text,text,text,text) to authenticated;

create or replace function public.operator_global_search(p_library_code text, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_library uuid;
  v_q text := btrim(coalesce(p_query, ''));
  v_result jsonb;
begin
  v_library := private.require_library_access(p_library_code);
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'result_type', q.result_type,
      'result_id', q.result_id,
      'title', q.title,
      'subtitle', q.subtitle
    ) order by q.result_type, q.title
  ), '[]'::jsonb)
  into v_result
  from (
    select * from (
      select
        'book'::text as result_type,
        b.id as result_id,
        b.title,
        coalesce((select string_agg(a.display_name, ', ' order by ba.author_order)
          from public.book_authors ba
          join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id
          where ba.library_id=v_library and ba.book_id=b.id), 'Author not listed') as subtitle
      from public.books b
      where b.library_id=v_library and b.status='active'
        and (
          b.title ilike '%'||v_q||'%'
          or coalesce(b.isbn,'') ilike '%'||v_q||'%'
          or exists(select 1 from public.book_authors ba
            join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id
            where ba.library_id=v_library and ba.book_id=b.id and a.display_name ilike '%'||v_q||'%')
        )

      union all

      select
        'copy', c.id, b.title,
        c.accession_number || coalesce(' · '||nullif(c.barcode,''), '')
      from public.book_copies c
      join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where c.library_id=v_library
        and (
          b.title ilike '%'||v_q||'%'
          or coalesce(b.isbn,'') ilike '%'||v_q||'%'
          or c.accession_number ilike '%'||v_q||'%'
          or coalesce(c.barcode,'') ilike '%'||v_q||'%'
          or exists(select 1 from public.book_authors ba
            join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id
            where ba.library_id=v_library and ba.book_id=b.id and a.display_name ilike '%'||v_q||'%')
        )

      union all

      select
        'member', m.id, m.display_name,
        m.member_identifier || coalesce((select ' · '||g.display_name||' · '||sec.display_name||coalesce(' · Roll '||se.roll_number,'')
          from public.student_enrollments se
          join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id
          join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id
          where se.library_id=v_library and se.member_id=m.id and se.status='active'
          order by se.created_at desc limit 1), '')
      from public.members m
      where m.library_id=v_library
        and (
          m.display_name ilike '%'||v_q||'%'
          or m.member_identifier ilike '%'||v_q||'%'
          or exists(select 1 from public.student_enrollments se
            join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id
            join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id
            where se.library_id=v_library and se.member_id=m.id
              and (coalesce(se.roll_number,'') ilike '%'||v_q||'%'
                or g.display_name ilike '%'||v_q||'%'
                or g.grade_code ilike '%'||v_q||'%'
                or sec.display_name ilike '%'||v_q||'%'
                or sec.section_code ilike '%'||v_q||'%'))
        )

      union all

      select
        'loan', lo.id, b.title,
        m.display_name || ' · ' || c.accession_number
      from public.loans lo
      join public.members m on m.id=lo.member_id and m.library_id=lo.library_id
      join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id
      join public.books b on b.id=c.book_id and b.library_id=c.library_id
      where lo.library_id=v_library and lo.status='active'
        and (
          m.display_name ilike '%'||v_q||'%'
          or m.member_identifier ilike '%'||v_q||'%'
          or b.title ilike '%'||v_q||'%'
          or c.accession_number ilike '%'||v_q||'%'
          or coalesce(c.barcode,'') ilike '%'||v_q||'%'
        )
    ) all_results
    order by result_type, title
    limit 50
  ) q;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke execute on function public.operator_global_search(text,text) from public, anon;
grant execute on function public.operator_global_search(text,text) to authenticated;

create or replace function public.operator_circulation_search(p_library_code text, p_kind text, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_library uuid; v_q text; v_result jsonb;
begin
  v_library:=private.require_library_access(p_library_code); v_q:=btrim(coalesce(p_query,''));
  if char_length(v_q)<2 then return '[]'::jsonb; end if;
  if p_kind='members' then
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'identifier',m.member_identifier,
      'context',coalesce((select s.display_label||' · '||g.display_name||' · '||sec.display_name||coalesce(' · Roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id and s.library_id=se.library_id join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id where se.library_id=v_library and se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),initcap(m.member_kind)),
      'activeLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active'),
      'overdueLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active' and l.due_at<timezone('utc',now()))) order by m.display_name),'[]'::jsonb)
    into v_result from (
      select * from public.members m0 where m0.library_id=v_library and m0.status='active' and (
        m0.display_name ilike '%'||v_q||'%'
        or m0.member_identifier ilike '%'||v_q||'%'
        or exists(select 1 from public.student_enrollments se
          join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id
          join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id
          where se.library_id=v_library and se.member_id=m0.id and se.status='active'
            and (coalesce(se.roll_number,'') ilike '%'||v_q||'%'
              or g.display_name ilike '%'||v_q||'%'
              or g.grade_code ilike '%'||v_q||'%'
              or sec.display_name ilike '%'||v_q||'%'
              or sec.section_code ilike '%'||v_q||'%'))
      ) order by m0.display_name limit 50
    ) m;
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
