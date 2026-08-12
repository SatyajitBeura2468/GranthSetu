CREATE OR REPLACE FUNCTION public.operator_workspace_data(p_library_code text, p_resource text, p_query text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_library uuid; v_result jsonb; v_admin boolean; v_zone text; v_currency text; v_local_today date; v_month_start timestamptz; v_week_start date;
begin
  v_library := private.require_library_access(p_library_code);
  select l.time_zone, l.currency_code into v_zone, v_currency from public.libraries l where l.id = v_library;
  v_local_today := private.library_local_date(v_library, now());
  v_month_start := private.library_local_day_start_utc(v_library, date_trunc('month', v_local_today)::date);
  v_week_start := v_local_today - (extract(isodow from v_local_today)::integer - 1);
  v_admin := private.has_library_access(v_library, 'administrator');
  if p_resource = 'dashboard' then
    select jsonb_build_object(
      'metrics', jsonb_build_object(
        'activeLoans', (select count(*) from public.loans where library_id=v_library and status='active'),
        'overdueLoans', (select count(*) from public.loans where library_id=v_library and status='active' and due_at<timezone('utc',now())),
        'availableCopies', (select count(*) from public.book_copies c where c.library_id=v_library and c.operational_state='active' and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')),
        'activeMembers', (select count(*) from public.members where library_id=v_library and status='active'),
        'finesOutstandingMinor', (select coalesce(sum(assessed_amount_minor-waived_amount_minor-settled_amount_minor),0) from public.fines where library_id=v_library),
        'totalBooks', (select count(*) from public.books where library_id=v_library and status='active')
      ),
      'attention', jsonb_build_array(
        jsonb_build_object('label',(select count(*)||' loans are overdue' from public.loans where library_id=v_library and status='active' and due_at<timezone('utc',now())),'detail','Review overdue circulation records','tone','danger'),
        jsonb_build_object('label',(select count(*)||' copies need condition review' from public.book_copies where library_id=v_library and operational_state in ('maintenance','damaged')),'detail','Maintenance or damaged state','tone','warning')
      ),
      'activity', coalesce((select jsonb_agg(jsonb_build_object('time',to_char(timezone(v_zone, e.occurred_at),'HH24:MI'),'action',replace(split_part(e.action,'.',2),'_',' '),'member',coalesce(p.display_name,'System'),'item',coalesce(e.metadata->>'title',e.target_type)) order by e.occurred_at desc) from (select * from public.audit_events where library_id=v_library order by occurred_at desc limit 8) e left join public.profiles p on p.id=e.actor_profile_id),'[]'::jsonb)
    ) into v_result;
  elsif p_resource = 'catalogue' then
    select jsonb_build_object('books',coalesce(jsonb_agg(jsonb_build_object(
      'id',b.id,'title',b.title,'author',coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library),'Author not listed'),
      'isbn',b.isbn,'available',(select count(*) from public.book_copies c where c.library_id=v_library and c.book_id=b.id and c.operational_state='active' and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active')),
      'total',(select count(*) from public.book_copies c where c.library_id=v_library and c.book_id=b.id and c.operational_state<>'withdrawn'),'status',initcap(b.status)
    ) order by b.title),'[]'::jsonb)) into v_result from public.books b where b.library_id=v_library and (p_id is null or b.id=p_id) and (p_query is null or btrim(p_query)='' or b.title ilike '%'||p_query||'%' or coalesce(b.isbn,'') ilike '%'||p_query||'%');
  elsif p_resource = 'inventory' then
    select jsonb_build_object('copies',coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'accession',c.accession_number,'title',b.title,'location',coalesce(l.display_name,'Not assigned'),'condition',initcap(c.condition_status),
      'state',case when exists(select 1 from public.loans lo where lo.library_id=v_library and lo.book_copy_id=c.id and lo.status='active') then 'On loan' when c.operational_state='active' then 'Available' else initcap(c.operational_state) end
    ) order by b.title,c.accession_number),'[]'::jsonb)) into v_result from public.book_copies c join public.books b on b.id=c.book_id and b.library_id=c.library_id left join public.locations l on l.id=c.location_id and l.library_id=c.library_id where c.library_id=v_library and (p_id is null or c.id=p_id) and (p_query is null or btrim(p_query)='' or c.accession_number ilike '%'||p_query||'%' or b.title ilike '%'||p_query||'%');
  elsif p_resource = 'members' then
    select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'name',m.display_name,'identifier',m.member_identifier,'kind',initcap(m.member_kind),'status',initcap(m.status),
      'context',coalesce((select s.display_label||' Â· '||g.display_name||' Â· '||sec.display_name||coalesce(' Â· Roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id and s.library_id=se.library_id join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id where se.library_id=v_library and se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),initcap(m.member_kind)),
      'activeLoans',(select count(*) from public.loans lo where lo.library_id=v_library and lo.member_id=m.id and lo.status='active')
    ) order by m.display_name),'[]'::jsonb)) into v_result from public.members m where m.library_id=v_library and (p_id is null or m.id=p_id) and (p_query is null or btrim(p_query)='' or m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%');
  elsif p_resource = 'circulation' then
    select jsonb_build_object(
      'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'identifier',m.member_identifier,'context',initcap(m.member_kind),'activeLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active'),'overdueLoans',(select count(*) from public.loans l where l.library_id=v_library and l.member_id=m.id and l.status='active' and l.due_at<timezone('utc',now()))) order by m.display_name) from (select * from public.members where library_id=v_library and status='active' order by display_name limit 80) m),'[]'::jsonb),
      'copies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',b.title,'author',coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library),'Author not listed'),'accession',c.accession_number,'location',coalesce(loc.display_name,'Not assigned'),'state','Available') order by b.title,c.accession_number) from public.book_copies c join public.books b on b.id=c.book_id and b.library_id=c.library_id left join public.locations loc on loc.id=c.location_id and loc.library_id=c.library_id where c.library_id=v_library and c.operational_state='active' and not exists(select 1 from public.loans l where l.library_id=v_library and l.book_copy_id=c.id and l.status='active') limit 80),'[]'::jsonb),
      'loans',coalesce((select jsonb_agg(jsonb_build_object('id',lo.id,'member',m.display_name,'identifier',m.member_identifier,'title',b.title,'accession',c.accession_number,'due',lo.due_at::date,'overdue',lo.due_at<timezone('utc',now())) order by lo.due_at) from public.loans lo join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id where lo.library_id=v_library and lo.status='active'),'[]'::jsonb)
    ) into v_result;
  elsif p_resource = 'reports' then
    select jsonb_build_object(
      'summary',jsonb_build_object('issues',(select count(*) from public.loans where library_id=v_library and issued_at>=v_month_start),'returns',(select count(*) from public.loans where library_id=v_library and returned_at>=v_month_start),'overdue',(select count(*) from public.loans where library_id=v_library and status='active' and due_at<timezone('utc',now())),'activeMembers',(select count(*) from public.members where library_id=v_library and status='active')),
      'circulation',coalesce((select jsonb_agg(coalesce(x.value,0) order by x.week) from (select (v_week_start - 77 + (g.week_offset * 7)) as week,(select count(*) from public.loans lo where lo.library_id=v_library and lo.issued_at>=private.library_local_day_start_utc(v_library, v_week_start - 77 + (g.week_offset * 7)) and lo.issued_at<private.library_local_day_start_utc(v_library, v_week_start - 70 + (g.week_offset * 7))) value from generate_series(0,11) g(week_offset)) x),'[]'::jsonb),
      'categories',coalesce((select jsonb_agg(jsonb_build_object('label',name,'value',share) order by share desc) from (select c.name,round(100.0*count(distinct bc.book_id)/nullif((select count(*) from public.books where library_id=v_library and status='active'),0))::integer share from public.categories c join public.book_categories bc on bc.category_id=c.id and bc.library_id=c.library_id where c.library_id=v_library group by c.name limit 8) q),'[]'::jsonb),
      'popular',coalesce((select jsonb_agg(jsonb_build_object('title',q.title,'author',q.author,'loans',q.loans) order by q.loans desc) from (select b.title,coalesce((select string_agg(a.display_name,', ') from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library),'Author not listed') author,count(lo.id) loans from public.books b join public.book_copies c on c.book_id=b.id and c.library_id=b.library_id join public.loans lo on lo.book_copy_id=c.id and lo.library_id=c.library_id where b.library_id=v_library group by b.id,b.title order by count(lo.id) desc limit 10) q),'[]'::jsonb)
    ) into v_result;
  elsif p_resource = 'search' then
    select jsonb_build_object('results', coalesce((
      select jsonb_agg(jsonb_build_object('result_type',q.result_type,'result_id',q.result_id,'title',q.title,'subtitle',q.subtitle) order by q.result_type,q.title)
      from (
        select 'book'::text result_type,b.id result_id,b.title,coalesce((select string_agg(a.display_name,', ') from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=v_library),'Author not listed') subtitle
        from public.books b where b.library_id=v_library and b.status='active' and btrim(coalesce(p_query,''))<>'' and (b.title ilike '%'||p_query||'%' or coalesce(b.isbn,'') ilike '%'||p_query||'%')
        union all
        select 'copy',c.id,b.title,c.accession_number from public.book_copies c join public.books b on b.id=c.book_id and b.library_id=c.library_id where c.library_id=v_library and btrim(coalesce(p_query,''))<>'' and (c.accession_number ilike '%'||p_query||'%' or coalesce(c.barcode,'') ilike '%'||p_query||'%')
        union all
        select 'member',m.id,m.display_name,m.member_identifier from public.members m where m.library_id=v_library and btrim(coalesce(p_query,''))<>'' and (m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%')
        union all
        select 'loan',lo.id,b.title,m.display_name||' Â· '||c.accession_number from public.loans lo join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id where lo.library_id=v_library and btrim(coalesce(p_query,''))<>'' and (m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or b.title ilike '%'||p_query||'%' or c.accession_number ilike '%'||p_query||'%')
        limit 40
      ) q
    ),'[]'::jsonb)) into v_result;
  elsif p_resource = 'settings' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('settings',coalesce(jsonb_agg(jsonb_build_object('key',s.setting_key,'label',initcap(replace(s.setting_key,'_',' ')),'value',case when s.value_kind='boolean' then case when s.boolean_value then 'Enabled' else 'Disabled' end when s.value_kind='money_minor' then v_currency||' '||s.money_minor_value::text else s.integer_value::text end) order by s.setting_key),'[]'::jsonb)) into v_result from public.library_settings s where s.library_id=v_library;
  elsif p_resource = 'operators' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('operators',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'role',initcap(r.role_key),'status',initcap(p.status)) order by p.display_name),'[]'::jsonb)) into v_result from public.profile_roles pr join public.profiles p on p.id=pr.profile_id join public.roles r on r.id=pr.role_id where pr.library_id=v_library;
  elsif p_resource = 'audit' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('time',to_char(timezone(v_zone, e.occurred_at),'YYYY-MM-DD HH24:MI:SS'),'actor',coalesce(p.display_name,'System'),'action',e.action,'entity',e.target_type,'target',coalesce(e.metadata->>'title',e.target_id::text,'â€”'),'result','Success') order by e.occurred_at desc),'[]'::jsonb)) into v_result from (select * from public.audit_events where library_id=v_library order by occurred_at desc limit 500) e left join public.profiles p on p.id=e.actor_profile_id;
  else raise exception using errcode='22023',message='GS_RESOURCE_INVALID';
  end if;
  return coalesce(v_result,'{}'::jsonb);
end;
$function$;
