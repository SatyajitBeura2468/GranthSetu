-- GranthSetu shelves are the existing room-local locations model. This migration
-- deliberately adds no shelves table and keeps copy-level ownership intact.

create or replace function public.operator_shelf_save(
  p_library_code text, p_id uuid, p_name text, p_code text, p_status text, p_request_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_id uuid; v_name text:=btrim(coalesce(p_name,'')); v_code text:=btrim(coalesce(p_code,'')); v_status text:=lower(btrim(coalesce(p_status,'active')));
begin
  if p_request_id is null then raise exception using errcode='22023',message='GS_REQUEST_ID_REQUIRED'; end if;
  v_library:=private.require_library_access(p_library_code); v_actor:=private.require_catalogue_operator();
  if char_length(v_name) not between 1 and 160 or char_length(v_code) not between 1 and 80 or v_status not in ('active','inactive') then
    raise exception using errcode='22023',message='GS_LOCATION_INVALID';
  end if;
  if p_id is not null and v_status='inactive' and exists(select 1 from public.book_copies c where c.library_id=v_library and c.location_id=p_id and c.operational_state<>'withdrawn') then
    raise exception using errcode='P0001',message='GS_LOCATION_IN_USE';
  end if;
  if p_id is null then
    insert into public.locations(library_id,display_name,location_code,status) values(v_library,v_name,v_code,v_status) returning id into v_id;
    perform private.admin_audit(v_actor,'inventory.shelf_created','location',v_id,jsonb_build_object('display_name',v_name,'location_code',v_code));
  else
    update public.locations set display_name=v_name,location_code=v_code,status=v_status where id=p_id and library_id=v_library returning id into v_id;
    if v_id is null then raise exception using errcode='P0001',message='GS_REFERENCE_NOT_FOUND'; end if;
    perform private.admin_audit(v_actor,'inventory.shelf_updated','location',v_id,jsonb_build_object('display_name',v_name,'location_code',v_code,'status',v_status));
  end if;
  return jsonb_build_object('id',v_id);
exception when unique_violation then raise exception using errcode='23505',message='GS_REFERENCE_DUPLICATE';
end;
$$;

create or replace function public.operator_shelf_summaries(p_library_code text)
returns table(id uuid,display_name text,location_code text,status text,title_count bigint,copy_count bigint,available_copy_count bigint)
language sql stable security definer set search_path = '' as $$
  with room as (select private.require_library_access(p_library_code) id)
  select l.id,l.display_name,l.location_code,l.status,
    count(distinct c.book_id) filter(where c.operational_state<>'withdrawn') title_count,
    count(c.id) filter(where c.operational_state<>'withdrawn') copy_count,
    count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=c.library_id and lo.book_copy_id=c.id and lo.status='active')) available_copy_count
  from public.locations l join room r on r.id=l.library_id
  left join public.book_copies c on c.location_id=l.id and c.library_id=l.library_id
  group by l.id,l.display_name,l.location_code,l.status order by l.display_name,l.location_code
$$;

create or replace function public.public_shelf_summaries(p_library_code text)
returns table(code text,name text,title_count bigint,copy_count bigint,available_copy_count bigint)
language sql stable security definer set search_path = '' as $$
  with room as (select id from public.libraries where public_code=private.normalize_library_code(p_library_code) and status='active')
  select l.location_code,l.display_name,
    count(distinct c.book_id) filter(where c.operational_state<>'withdrawn' and b.status='active'),
    count(c.id) filter(where c.operational_state<>'withdrawn' and b.status='active'),
    count(c.id) filter(where c.operational_state='active' and b.status='active' and not exists(select 1 from public.loans lo where lo.library_id=c.library_id and lo.book_copy_id=c.id and lo.status='active'))
  from public.locations l join room r on r.id=l.library_id
  left join public.book_copies c on c.library_id=l.library_id and c.location_id=l.id
  left join public.books b on b.id=c.book_id and b.library_id=c.library_id
  where l.status='active'
  group by l.id,l.location_code,l.display_name having count(c.id) filter(where c.operational_state<>'withdrawn' and b.status='active')>0
  order by l.display_name,l.location_code
$$;

create or replace function public.public_book_shelves(p_library_code text,p_book_id uuid)
returns table(code text,name text,total_copies bigint,available_copies bigint)
language sql stable security definer set search_path = '' as $$
  with room as (select id from public.libraries where public_code=private.normalize_library_code(p_library_code) and status='active')
  select l.location_code,l.display_name,count(c.id),
    count(c.id) filter(where c.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=c.library_id and lo.book_copy_id=c.id and lo.status='active'))
  from public.book_copies c join room r on r.id=c.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id and b.status='active'
  join public.locations l on l.id=c.location_id and l.library_id=c.library_id
  where c.book_id=p_book_id and c.operational_state<>'withdrawn'
  group by l.id,l.location_code,l.display_name order by l.display_name,l.location_code
$$;

create or replace function public.public_catalogue_page_v2(
  p_library_code text,p_query text default null,p_available_only boolean default false,p_limit integer default 24,p_offset integer default 0,p_shelf_code text default null,p_book_id uuid default null
)
returns table(id uuid,title text,subtitle text,author_names text,isbn text,publisher_name text,category_names text[],subject_names text[],language_code text,publication_year integer,description text,total_copies bigint,available_copies bigint,availability_state text,expected_availability date,has_cover boolean,shelves jsonb,total_count bigint)
language sql stable security definer set search_path = '' as $$
  with room as (select id from public.libraries where public_code=private.normalize_library_code(p_library_code) and status='active'),
  catalogue as (
    select b.id,b.title,b.subtitle,b.isbn,b.language_code,b.publication_year,b.description,p.name publisher_name,
      coalesce((select string_agg(a.display_name,', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id=ba.author_id and a.library_id=ba.library_id where ba.book_id=b.id and ba.library_id=b.library_id),'Author not listed') author_names,
      coalesce((select array_agg(ca.name order by ca.name) from public.book_categories bc join public.categories ca on ca.id=bc.category_id and ca.library_id=bc.library_id where bc.book_id=b.id and bc.library_id=b.library_id),'{}'::text[]) category_names,
      coalesce((select array_agg(s.name order by s.name) from public.book_subjects bs join public.subjects s on s.id=bs.subject_id and s.library_id=bs.library_id where bs.book_id=b.id and bs.library_id=b.library_id),'{}'::text[]) subject_names,
      count(cp.id) filter(where cp.operational_state<>'withdrawn') total_copies,
      count(cp.id) filter(where cp.operational_state='active' and not exists(select 1 from public.loans lo where lo.library_id=cp.library_id and lo.book_copy_id=cp.id and lo.status='active')) available_copies,
      (min(lo.due_at) filter(where lo.status='active'))::date expected_availability,b.cover_storage_path is not null has_cover,
      coalesce(jsonb_agg(distinct jsonb_build_object('code',l.location_code,'name',l.display_name,'totalCopies',sc.total_copies,'availableCopies',sc.available_copies)) filter(where l.id is not null),'[]'::jsonb) shelves
    from public.books b join room r on r.id=b.library_id left join public.publishers p on p.id=b.publisher_id and p.library_id=b.library_id
    left join public.book_copies cp on cp.book_id=b.id and cp.library_id=b.library_id
    left join public.loans lo on lo.book_copy_id=cp.id and lo.library_id=cp.library_id and lo.status='active'
    left join public.locations l on l.id=cp.location_id and l.library_id=cp.library_id
    left join lateral (select count(*) filter(where x.operational_state<>'withdrawn') total_copies,count(*) filter(where x.operational_state='active' and not exists(select 1 from public.loans xl where xl.library_id=x.library_id and xl.book_copy_id=x.id and xl.status='active')) available_copies from public.book_copies x where x.book_id=b.id and x.library_id=b.library_id and x.location_id=l.id) sc on l.id is not null
    where b.status='active' and (p_book_id is null or b.id=p_book_id) group by b.id,p.name
  ), filtered as (
    select c.* from catalogue c where (not coalesce(p_available_only,false) or c.available_copies>0)
    and (nullif(btrim(coalesce(p_shelf_code,'')),'') is null or exists(select 1 from jsonb_array_elements(c.shelves) s where s->>'code'=btrim(p_shelf_code)))
    and (nullif(btrim(coalesce(p_query,'')),'') is null or c.title ilike '%'||btrim(p_query)||'%' or c.author_names ilike '%'||btrim(p_query)||'%' or coalesce(c.isbn,'') ilike '%'||btrim(p_query)||'%' or exists(select 1 from unnest(c.category_names||c.subject_names) v where v ilike '%'||btrim(p_query)||'%') or exists(select 1 from jsonb_array_elements(c.shelves) s where s->>'name' ilike '%'||btrim(p_query)||'%' or s->>'code' ilike '%'||btrim(p_query)||'%'))
  ) select f.id,f.title,f.subtitle,f.author_names,f.isbn,f.publisher_name,f.category_names,f.subject_names,f.language_code,f.publication_year,f.description,f.total_copies,f.available_copies,
    case when f.available_copies>1 then 'available' when f.available_copies=1 then 'limited' when f.expected_availability is not null then 'on_loan' else 'unavailable' end,
    f.expected_availability,f.has_cover,f.shelves,count(*) over()
  from filtered f order by f.title,f.id limit least(greatest(coalesce(p_limit,24),1),100) offset greatest(coalesce(p_offset,0),0)
$$;

revoke all on function public.operator_shelf_save(text,uuid,text,text,text,uuid) from public,anon;
grant execute on function public.operator_shelf_save(text,uuid,text,text,text,uuid) to authenticated;
revoke all on function public.operator_shelf_summaries(text) from public,anon;
grant execute on function public.operator_shelf_summaries(text) to authenticated;
revoke all on function public.public_shelf_summaries(text),public.public_book_shelves(text,uuid),public.public_catalogue_page_v2(text,text,boolean,integer,integer,text,uuid) from public;
grant execute on function public.public_shelf_summaries(text),public.public_book_shelves(text,uuid),public.public_catalogue_page_v2(text,text,boolean,integer,integer,text,uuid) to anon,authenticated;
