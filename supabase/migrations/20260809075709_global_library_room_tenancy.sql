-- GranthSetu V3: deterministic single-library upgrade to globally isolated Library Rooms.
-- Existing rows are assigned to the bootstrap OAV Musiguda room without changing their primary IDs.

create table public.libraries (
  id uuid primary key default extensions.gen_random_uuid(),
  public_code text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint libraries_public_code_format check (
    public_code = upper(public_code)
    and public_code ~ '^[A-Z0-9](?:[A-Z0-9-]{3,14})[A-Z0-9]$'
    and public_code !~ '--'
    and public_code not in ('ADMIN','API','AUTH','LOGIN','STAFF','OPERATOR','CREATE','SUPPORT','HELP','ROOT','SYSTEM','GRANTHSETU')
  ),
  constraint libraries_display_name_not_blank check (char_length(btrim(display_name)) between 3 and 160)
);

create unique index libraries_public_code_unique_ci on public.libraries (upper(public_code));
create trigger libraries_set_updated_at before update on public.libraries for each row execute function public.set_updated_at();
alter table public.libraries enable row level security;

insert into public.libraries (id, public_code, display_name, status)
values ('10000000-0000-0000-0000-000000000001', 'OAVMUSI', 'OAV Musiguda Library', 'active');

alter table public.profile_roles add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.members add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.academic_sessions add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.grade_levels add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.sections add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.student_enrollments add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.publishers add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.categories add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.subjects add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.authors add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.books add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.book_authors add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.book_categories add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.book_subjects add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.locations add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.book_copies add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.loans add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.loan_renewals add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.fines add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.library_settings add column library_id uuid references public.libraries(id) on delete restrict;
alter table public.audit_events add column library_id uuid references public.libraries(id) on delete restrict;

update public.profile_roles set library_id = '10000000-0000-0000-0000-000000000001';
update public.members set library_id = '10000000-0000-0000-0000-000000000001';
update public.academic_sessions set library_id = '10000000-0000-0000-0000-000000000001';
update public.grade_levels set library_id = '10000000-0000-0000-0000-000000000001';
update public.sections set library_id = '10000000-0000-0000-0000-000000000001';
update public.student_enrollments set library_id = '10000000-0000-0000-0000-000000000001';
update public.publishers set library_id = '10000000-0000-0000-0000-000000000001';
update public.categories set library_id = '10000000-0000-0000-0000-000000000001';
update public.subjects set library_id = '10000000-0000-0000-0000-000000000001';
update public.authors set library_id = '10000000-0000-0000-0000-000000000001';
update public.books set library_id = '10000000-0000-0000-0000-000000000001';
update public.book_authors set library_id = '10000000-0000-0000-0000-000000000001';
update public.book_categories set library_id = '10000000-0000-0000-0000-000000000001';
update public.book_subjects set library_id = '10000000-0000-0000-0000-000000000001';
update public.locations set library_id = '10000000-0000-0000-0000-000000000001';
update public.book_copies set library_id = '10000000-0000-0000-0000-000000000001';
update public.loans set library_id = '10000000-0000-0000-0000-000000000001';
update public.loan_renewals set library_id = '10000000-0000-0000-0000-000000000001';
update public.fines set library_id = '10000000-0000-0000-0000-000000000001';
update public.library_settings set library_id = '10000000-0000-0000-0000-000000000001';
update public.audit_events set library_id = '10000000-0000-0000-0000-000000000001';

alter table public.profile_roles alter column library_id set not null;
alter table public.members alter column library_id set not null;
alter table public.academic_sessions alter column library_id set not null;
alter table public.grade_levels alter column library_id set not null;
alter table public.sections alter column library_id set not null;
alter table public.student_enrollments alter column library_id set not null;
alter table public.publishers alter column library_id set not null;
alter table public.categories alter column library_id set not null;
alter table public.subjects alter column library_id set not null;
alter table public.authors alter column library_id set not null;
alter table public.books alter column library_id set not null;
alter table public.book_authors alter column library_id set not null;
alter table public.book_categories alter column library_id set not null;
alter table public.book_subjects alter column library_id set not null;
alter table public.locations alter column library_id set not null;
alter table public.book_copies alter column library_id set not null;
alter table public.loans alter column library_id set not null;
alter table public.loan_renewals alter column library_id set not null;
alter table public.fines alter column library_id set not null;
alter table public.library_settings alter column library_id set not null;
alter table public.audit_events alter column library_id set not null;

-- Replace former platform-global uniqueness with tenant-local uniqueness.
alter table public.profile_roles drop constraint profile_roles_pkey;
alter table public.profile_roles add primary key (profile_id, library_id, role_id);
alter table public.members drop constraint members_member_identifier_key;
alter table public.members add constraint members_library_identifier_unique unique (library_id, member_identifier);
alter table public.members drop constraint members_profile_id_key;
alter table public.members add constraint members_library_profile_unique unique (library_id, profile_id);
alter table public.academic_sessions drop constraint academic_sessions_session_code_key;
alter table public.academic_sessions add constraint academic_sessions_library_code_unique unique (library_id, session_code);
alter table public.grade_levels drop constraint grade_levels_grade_code_key;
alter table public.grade_levels add constraint grade_levels_library_code_unique unique (library_id, grade_code);
alter table public.sections drop constraint sections_section_code_key;
alter table public.sections add constraint sections_library_code_unique unique (library_id, section_code);
alter table public.student_enrollments drop constraint student_enrollments_one_per_member_session;
alter table public.student_enrollments add constraint student_enrollments_library_member_session_unique unique (library_id, member_id, academic_session_id);
alter table public.publishers drop constraint publishers_name_key;
alter table public.publishers add constraint publishers_library_name_unique unique (library_id, name);
alter table public.categories drop constraint categories_name_key;
alter table public.categories add constraint categories_library_name_unique unique (library_id, name);
alter table public.subjects drop constraint subjects_name_key;
alter table public.subjects add constraint subjects_library_name_unique unique (library_id, name);
alter table public.authors drop constraint authors_display_name_key;
alter table public.authors add constraint authors_library_name_unique unique (library_id, display_name);
alter table public.locations drop constraint locations_location_code_key;
alter table public.locations add constraint locations_library_code_unique unique (library_id, location_code);
alter table public.book_copies drop constraint book_copies_accession_number_key;
alter table public.book_copies add constraint book_copies_library_accession_unique unique (library_id, accession_number);
drop index public.book_copies_barcode_unique;
create unique index book_copies_library_barcode_unique on public.book_copies (library_id, barcode) where barcode is not null;
alter table public.library_settings drop constraint library_settings_pkey;
alter table public.library_settings add primary key (library_id, setting_key);

-- Composite identity allows foreign keys to prove that both sides belong to the same Library Room.
alter table public.members add constraint members_id_library_unique unique (id, library_id);
alter table public.academic_sessions add constraint academic_sessions_id_library_unique unique (id, library_id);
alter table public.grade_levels add constraint grade_levels_id_library_unique unique (id, library_id);
alter table public.sections add constraint sections_id_library_unique unique (id, library_id);
alter table public.publishers add constraint publishers_id_library_unique unique (id, library_id);
alter table public.authors add constraint authors_id_library_unique unique (id, library_id);
alter table public.categories add constraint categories_id_library_unique unique (id, library_id);
alter table public.subjects add constraint subjects_id_library_unique unique (id, library_id);
alter table public.books add constraint books_id_library_unique unique (id, library_id);
alter table public.locations add constraint locations_id_library_unique unique (id, library_id);
alter table public.book_copies add constraint book_copies_id_library_unique unique (id, library_id);
alter table public.loans add constraint loans_id_library_unique unique (id, library_id);

alter table public.student_enrollments add constraint student_enrollments_member_library_fk foreign key (member_id, library_id) references public.members(id, library_id) on delete restrict;
alter table public.student_enrollments add constraint student_enrollments_session_library_fk foreign key (academic_session_id, library_id) references public.academic_sessions(id, library_id) on delete restrict;
alter table public.student_enrollments add constraint student_enrollments_grade_library_fk foreign key (grade_level_id, library_id) references public.grade_levels(id, library_id) on delete restrict;
alter table public.student_enrollments add constraint student_enrollments_section_library_fk foreign key (section_id, library_id) references public.sections(id, library_id) on delete restrict;
alter table public.books add constraint books_publisher_library_fk foreign key (publisher_id, library_id) references public.publishers(id, library_id) on delete restrict;
alter table public.book_authors add constraint book_authors_book_library_fk foreign key (book_id, library_id) references public.books(id, library_id) on delete restrict;
alter table public.book_authors add constraint book_authors_author_library_fk foreign key (author_id, library_id) references public.authors(id, library_id) on delete restrict;
alter table public.book_categories add constraint book_categories_book_library_fk foreign key (book_id, library_id) references public.books(id, library_id) on delete restrict;
alter table public.book_categories add constraint book_categories_category_library_fk foreign key (category_id, library_id) references public.categories(id, library_id) on delete restrict;
alter table public.book_subjects add constraint book_subjects_book_library_fk foreign key (book_id, library_id) references public.books(id, library_id) on delete restrict;
alter table public.book_subjects add constraint book_subjects_subject_library_fk foreign key (subject_id, library_id) references public.subjects(id, library_id) on delete restrict;
alter table public.book_copies add constraint book_copies_book_library_fk foreign key (book_id, library_id) references public.books(id, library_id) on delete restrict;
alter table public.book_copies drop constraint book_copies_location_id_fkey;
alter table public.book_copies add constraint book_copies_location_library_fk foreign key (location_id, library_id) references public.locations(id, library_id) on delete set null (location_id);
alter table public.loans add constraint loans_member_library_fk foreign key (member_id, library_id) references public.members(id, library_id) on delete restrict;
alter table public.loans add constraint loans_copy_library_fk foreign key (book_copy_id, library_id) references public.book_copies(id, library_id) on delete restrict;
alter table public.loan_renewals add constraint loan_renewals_loan_library_fk foreign key (loan_id, library_id) references public.loans(id, library_id) on delete restrict;
alter table public.fines add constraint fines_loan_library_fk foreign key (loan_id, library_id) references public.loans(id, library_id) on delete restrict;

create index profile_roles_library_profile_index on public.profile_roles (library_id, profile_id);
create index books_library_title_index on public.books (library_id, title);
create index members_library_name_index on public.members (library_id, display_name);
create index loans_library_status_due_index on public.loans (library_id, status, due_at);
create index audit_events_library_time_index on public.audit_events (library_id, occurred_at desc);

create or replace function private.normalize_library_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select upper(btrim(coalesce(p_code, '')))
$$;

create or replace function private.request_library_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_setting text; v_library uuid;
begin
  v_setting := nullif(current_setting('granthsetu.library_id', true), '');
  if v_setting is not null then return v_setting::uuid; end if;
  select pr.library_id into v_library
  from public.profiles p join public.profile_roles pr on pr.profile_id = p.id join public.roles r on r.id = pr.role_id
  where p.auth_user_id = (select auth.uid()) and p.status = 'active' and r.role_key in ('administrator','librarian')
  group by pr.library_id having count(*) > 0
  order by pr.library_id limit 1;
  if v_library is null and current_user in ('postgres', 'supabase_admin') then
    v_library := '10000000-0000-0000-0000-000000000001'::uuid;
  end if;
  return v_library;
end;
$$;

create or replace function public.operator_workspace_mutation(
  p_library_code text, p_operation text, p_payload jsonb, p_request_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_actor uuid; v_id uuid; v_period bigint; v_role uuid; v_profile uuid; v_user uuid; v_author uuid; v_setting text; v_value text;
begin
  v_library := private.require_library_access(p_library_code);
  select p.id into v_actor from public.profiles p where p.auth_user_id=(select auth.uid()) and p.status='active';
  if v_actor is null then raise exception using errcode='42501',message='GS_OPERATOR_REQUIRED'; end if;
  if p_operation = 'issue' then
    if not exists(select 1 from public.members where id=(p_payload->>'memberId')::uuid and library_id=v_library and status='active') then raise exception using errcode='P0001',message='GS_MEMBER_NOT_ELIGIBLE'; end if;
    if not exists(select 1 from public.book_copies where id=(p_payload->>'copyId')::uuid and library_id=v_library and operational_state='active') or exists(select 1 from public.loans where book_copy_id=(p_payload->>'copyId')::uuid and library_id=v_library and status='active') then raise exception using errcode='P0001',message='GS_COPY_NOT_AVAILABLE'; end if;
    select integer_value into v_period from public.library_settings where library_id=v_library and setting_key='default_loan_period_days'; v_period:=coalesce(v_period,14);
    insert into public.loans(library_id,member_id,book_copy_id,due_at,issued_by_profile_id,notes) values(v_library,(p_payload->>'memberId')::uuid,(p_payload->>'copyId')::uuid,timezone('utc',now())+make_interval(days=>v_period::integer),v_actor,nullif(p_payload->>'notes','')) returning id into v_id;
  elsif p_operation = 'return' then
    update public.loans set status='returned',returned_at=timezone('utc',now()),returned_by_profile_id=v_actor where id=(p_payload->>'loanId')::uuid and library_id=v_library and status='active' returning id into v_id;
    if v_id is null then raise exception using errcode='P0001',message='GS_LOAN_NOT_ACTIVE'; end if;
  elsif p_operation = 'renew' then
    select integer_value into v_period from public.library_settings where library_id=v_library and setting_key='default_loan_period_days'; v_period:=coalesce(v_period,14);
    insert into public.loan_renewals(library_id,loan_id,approved_by_profile_id,previous_due_at,new_due_at)
      select v_library,l.id,v_actor,l.due_at,greatest(l.due_at,timezone('utc',now()))+make_interval(days=>v_period::integer) from public.loans l where l.id=(p_payload->>'loanId')::uuid and l.library_id=v_library and l.status='active' returning loan_id into v_id;
    if v_id is null then raise exception using errcode='P0001',message='GS_LOAN_NOT_ACTIVE'; end if;
    update public.loans set due_at=greatest(due_at,timezone('utc',now()))+make_interval(days=>v_period::integer) where id=v_id and library_id=v_library;
  elsif p_operation = 'book_create' then
    if char_length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 300 or char_length(btrim(coalesce(p_payload->>'author',''))) not between 1 and 200 then raise exception using errcode='22023',message='GS_BOOK_TITLE_REQUIRED'; end if;
    insert into public.authors(library_id,display_name) values(v_library,btrim(p_payload->>'author')) on conflict(library_id,display_name) do update set display_name=excluded.display_name returning id into v_author;
    insert into public.books(library_id,title,isbn) values(v_library,btrim(p_payload->>'title'),nullif(btrim(p_payload->>'isbn'),'')) returning id into v_id;
    insert into public.book_authors(library_id,book_id,author_id,author_order) values(v_library,v_id,v_author,1);
  elsif p_operation = 'copy_create' then
    if not exists(select 1 from public.books where id=(p_payload->>'bookId')::uuid and library_id=v_library) then raise exception using errcode='P0001',message='GS_BOOK_NOT_FOUND'; end if;
    insert into public.book_copies(library_id,book_id,accession_number) values(v_library,(p_payload->>'bookId')::uuid,btrim(p_payload->>'accession')) returning id into v_id;
  elsif p_operation = 'member_create' then
    if char_length(btrim(coalesce(p_payload->>'displayName',''))) not between 1 and 200 or p_payload->>'memberKind' not in ('student','teacher','staff','other') then raise exception using errcode='22023',message='GS_MEMBER_INPUT_INVALID'; end if;
    loop
      begin
        insert into public.members(library_id,member_identifier,member_kind,display_name) values(v_library,'M-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8)),p_payload->>'memberKind',btrim(p_payload->>'displayName')) returning id into v_id; exit;
      exception when unique_violation then null;
      end;
    end loop;
  elsif p_operation = 'setting_update' then
    if not private.has_library_access(v_library,'administrator') then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    v_setting:=p_payload->>'settingKey'; v_value:=p_payload->>'settingValue';
    if v_setting in ('fines_enabled','overdue_renewal_allowed','librarian_waiver_allowed') then
      insert into public.library_settings(library_id,setting_key,value_kind,boolean_value,updated_by_profile_id) values(v_library,v_setting,'boolean',lower(v_value) in ('true','enabled','1'),v_actor) on conflict(library_id,setting_key) do update set value_kind='boolean',boolean_value=excluded.boolean_value,integer_value=null,money_minor_value=null,currency_code=null,updated_by_profile_id=v_actor;
    elsif v_setting='daily_fine_rate_minor' then
      insert into public.library_settings(library_id,setting_key,value_kind,money_minor_value,currency_code,updated_by_profile_id) values(v_library,v_setting,'money_minor',greatest(coalesce(v_value,'0')::numeric,0)*100,'INR',v_actor) on conflict(library_id,setting_key) do update set value_kind='money_minor',money_minor_value=excluded.money_minor_value,boolean_value=null,integer_value=null,currency_code='INR',updated_by_profile_id=v_actor;
    elsif v_setting in ('default_loan_period_days','checkout_limit','renewal_limit','grace_period_days') then
      insert into public.library_settings(library_id,setting_key,value_kind,integer_value,updated_by_profile_id) values(v_library,v_setting,'integer',greatest(coalesce(v_value,'0')::bigint,0),v_actor) on conflict(library_id,setting_key) do update set value_kind='integer',integer_value=excluded.integer_value,boolean_value=null,money_minor_value=null,currency_code=null,updated_by_profile_id=v_actor;
    else raise exception using errcode='22023',message='GS_SETTING_INVALID'; end if;
    v_id:=v_library;
  elsif p_operation = 'operator_assign' then
    if not private.has_library_access(v_library,'administrator') then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select id into v_user from auth.users where lower(email)=lower(btrim(p_payload->>'email'));
    if v_user is null then raise exception using errcode='P0001',message='GS_AUTH_USER_NOT_FOUND'; end if;
    insert into public.profiles(auth_user_id,display_name,status) values(v_user,split_part(p_payload->>'email','@',1),'active') on conflict(auth_user_id) do update set status='active' returning id into v_profile;
    select id into v_role from public.roles where role_key=p_payload->>'role' and role_key in ('administrator','librarian'); if v_role is null then raise exception using errcode='22023',message='GS_ROLE_INVALID'; end if;
    insert into public.profile_roles(profile_id,library_id,role_id,assigned_by_profile_id) values(v_profile,v_library,v_role,v_actor) on conflict do nothing; v_id:=v_profile;
  else raise exception using errcode='22023',message='GS_OPERATION_INVALID';
  end if;
  insert into public.audit_events(library_id,actor_profile_id,action,target_type,target_id,request_id,metadata) values(v_library,v_actor,'workspace.'||p_operation,p_operation,v_id,p_request_id,jsonb_build_object('library_code',private.normalize_library_code(p_library_code)));
  return jsonb_build_object('id',v_id,'operation',p_operation);
exception when unique_violation then raise exception using errcode='23505',message='GS_TENANT_DUPLICATE';
end;
$$;

create or replace function public.operator_workspace_data(
  p_library_code text, p_resource text, p_query text default null, p_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid; v_result jsonb; v_admin boolean;
begin
  v_library := private.require_library_access(p_library_code);
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
      'activity', coalesce((select jsonb_agg(jsonb_build_object('time',to_char(e.occurred_at at time zone 'Asia/Kolkata','HH24:MI'),'action',replace(split_part(e.action,'.',2),'_',' '),'member',coalesce(p.display_name,'System'),'item',coalesce(e.metadata->>'title',e.target_type)) order by e.occurred_at desc) from (select * from public.audit_events where library_id=v_library order by occurred_at desc limit 8) e left join public.profiles p on p.id=e.actor_profile_id),'[]'::jsonb)
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
      'context',coalesce((select s.display_label||' · '||g.display_name||' · '||sec.display_name||coalesce(' · Roll '||se.roll_number,'') from public.student_enrollments se join public.academic_sessions s on s.id=se.academic_session_id and s.library_id=se.library_id join public.grade_levels g on g.id=se.grade_level_id and g.library_id=se.library_id join public.sections sec on sec.id=se.section_id and sec.library_id=se.library_id where se.library_id=v_library and se.member_id=m.id and se.status='active' order by s.starts_on desc limit 1),initcap(m.member_kind)),
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
      'summary',jsonb_build_object('issues',(select count(*) from public.loans where library_id=v_library and issued_at>=date_trunc('month',timezone('utc',now()))),'returns',(select count(*) from public.loans where library_id=v_library and returned_at>=date_trunc('month',timezone('utc',now()))),'overdue',(select count(*) from public.loans where library_id=v_library and status='active' and due_at<timezone('utc',now())),'activeMembers',(select count(*) from public.members where library_id=v_library and status='active')),
      'circulation',coalesce((select jsonb_agg(coalesce(x.value,0) order by x.week) from (select g.week,(select count(*) from public.loans lo where lo.library_id=v_library and lo.issued_at>=g.week and lo.issued_at<g.week+interval '7 days') value from generate_series(date_trunc('week',timezone('utc',now()))-interval '11 weeks',date_trunc('week',timezone('utc',now())),interval '1 week') g(week)) x),'[]'::jsonb),
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
        select 'loan',lo.id,b.title,m.display_name||' · '||c.accession_number from public.loans lo join public.members m on m.id=lo.member_id and m.library_id=lo.library_id join public.book_copies c on c.id=lo.book_copy_id and c.library_id=lo.library_id join public.books b on b.id=c.book_id and b.library_id=c.library_id where lo.library_id=v_library and btrim(coalesce(p_query,''))<>'' and (m.display_name ilike '%'||p_query||'%' or m.member_identifier ilike '%'||p_query||'%' or b.title ilike '%'||p_query||'%' or c.accession_number ilike '%'||p_query||'%')
        limit 40
      ) q
    ),'[]'::jsonb)) into v_result;
  elsif p_resource = 'settings' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('settings',coalesce(jsonb_agg(jsonb_build_object('key',s.setting_key,'label',initcap(replace(s.setting_key,'_',' ')),'value',case when s.value_kind='boolean' then case when s.boolean_value then 'Enabled' else 'Disabled' end when s.value_kind='money_minor' then '₹'||to_char(s.money_minor_value/100.0,'FM999999990.00') else s.integer_value::text end) order by s.setting_key),'[]'::jsonb)) into v_result from public.library_settings s where s.library_id=v_library;
  elsif p_resource = 'operators' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('operators',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'role',initcap(r.role_key),'status',initcap(p.status)) order by p.display_name),'[]'::jsonb)) into v_result from public.profile_roles pr join public.profiles p on p.id=pr.profile_id join public.roles r on r.id=pr.role_id where pr.library_id=v_library;
  elsif p_resource = 'audit' then
    if not v_admin then raise exception using errcode='42501',message='GS_ADMIN_REQUIRED'; end if;
    select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('time',to_char(e.occurred_at at time zone 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS'),'actor',coalesce(p.display_name,'System'),'action',e.action,'entity',e.target_type,'target',coalesce(e.metadata->>'title',e.target_id::text,'—'),'result','Success') order by e.occurred_at desc),'[]'::jsonb)) into v_result from (select * from public.audit_events where library_id=v_library order by occurred_at desc limit 500) e left join public.profiles p on p.id=e.actor_profile_id;
  else raise exception using errcode='22023',message='GS_RESOURCE_INVALID';
  end if;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

create or replace function private.has_library_access(p_library_id uuid, p_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    join public.roles r on r.id = pr.role_id
    join public.libraries l on l.id = pr.library_id
    where p.auth_user_id = (select auth.uid()) and p.status = 'active' and l.status = 'active'
      and pr.library_id = p_library_id and r.role_key in ('administrator','librarian')
      and (p_role is null or r.role_key = p_role)
  )
$$;

create or replace function private.require_library_access(p_code text, p_role text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_library uuid;
begin
  select l.id into v_library from public.libraries l where l.public_code = private.normalize_library_code(p_code) and l.status = 'active';
  if v_library is null or not private.has_library_access(v_library, p_role) then raise exception using errcode = '42501', message = 'GS_LIBRARY_ACCESS_DENIED'; end if;
  perform set_config('granthsetu.library_id', v_library::text, true);
  return v_library;
end;
$$;

alter table public.profile_roles alter column library_id set default private.request_library_id();
alter table public.members alter column library_id set default private.request_library_id();
alter table public.academic_sessions alter column library_id set default private.request_library_id();
alter table public.grade_levels alter column library_id set default private.request_library_id();
alter table public.sections alter column library_id set default private.request_library_id();
alter table public.student_enrollments alter column library_id set default private.request_library_id();
alter table public.publishers alter column library_id set default private.request_library_id();
alter table public.categories alter column library_id set default private.request_library_id();
alter table public.subjects alter column library_id set default private.request_library_id();
alter table public.authors alter column library_id set default private.request_library_id();
alter table public.books alter column library_id set default private.request_library_id();
alter table public.book_authors alter column library_id set default private.request_library_id();
alter table public.book_categories alter column library_id set default private.request_library_id();
alter table public.book_subjects alter column library_id set default private.request_library_id();
alter table public.locations alter column library_id set default private.request_library_id();
alter table public.book_copies alter column library_id set default private.request_library_id();
alter table public.loans alter column library_id set default private.request_library_id();
alter table public.loan_renewals alter column library_id set default private.request_library_id();
alter table public.fines alter column library_id set default private.request_library_id();
alter table public.library_settings alter column library_id set default private.request_library_id();
alter table public.audit_events alter column library_id set default private.request_library_id();

-- Replace former global read policies with tenant predicates. Public users receive no table grants.
do $$ declare item record; begin
  for item in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end $$;

create policy libraries_operator_select on public.libraries for select to authenticated using (private.has_library_access(id));
do $$ declare table_name text; begin
  foreach table_name in array array['profile_roles','members','academic_sessions','grade_levels','sections','student_enrollments','publishers','categories','subjects','authors','books','book_authors','book_categories','book_subjects','locations','book_copies','loans','loan_renewals','fines','library_settings','audit_events'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.has_library_access(library_id))', table_name || '_tenant_select', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end $$;
grant select on public.libraries to authenticated;

-- Every exposed function is denied by default; explicitly safe functions are granted below.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create or replace function public.public_resolve_library(p_library_code text)
returns table(id uuid, public_code text, display_name text, status text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.public_code, l.display_name, l.status
  from public.libraries l
  where l.public_code = private.normalize_library_code(p_library_code) and l.status = 'active'
$$;

create or replace function public.public_catalogue(
  p_library_code text, p_query text default null, p_available_only boolean default false, p_limit integer default 120
)
returns table(
  id uuid, title text, subtitle text, author_names text, isbn text, publisher_name text,
  category_names text[], subject_names text[], language_code text, publication_year integer, description text,
  total_copies bigint, available_copies bigint, availability_state text, expected_availability date, has_cover boolean
)
language sql stable security definer set search_path = '' as $$
  with room as (
    select l.id from public.libraries l where l.public_code = private.normalize_library_code(p_library_code) and l.status = 'active'
  ), catalogue as (
    select b.id, b.title, b.subtitle, b.isbn, b.language_code, b.publication_year, b.description,
      p.name as publisher_name,
      coalesce((select string_agg(a.display_name, ', ' order by ba.author_order) from public.book_authors ba join public.authors a on a.id = ba.author_id and a.library_id = ba.library_id where ba.book_id = b.id and ba.library_id = b.library_id), 'Author not listed') as author_names,
      coalesce((select array_agg(c.name order by c.name) from public.book_categories bc join public.categories c on c.id = bc.category_id and c.library_id = bc.library_id where bc.book_id = b.id and bc.library_id = b.library_id), '{}'::text[]) as category_names,
      coalesce((select array_agg(s.name order by s.name) from public.book_subjects bs join public.subjects s on s.id = bs.subject_id and s.library_id = bs.library_id where bs.book_id = b.id and bs.library_id = b.library_id), '{}'::text[]) as subject_names,
      (select count(*) from public.book_copies cp where cp.book_id = b.id and cp.library_id = b.library_id and cp.operational_state <> 'withdrawn') as total_copies,
      (select count(*) from public.book_copies cp where cp.book_id = b.id and cp.library_id = b.library_id and cp.operational_state = 'active' and not exists (select 1 from public.loans lo where lo.book_copy_id = cp.id and lo.library_id = cp.library_id and lo.status = 'active')) as available_copies,
      (select min(lo.due_at)::date from public.loans lo join public.book_copies cp on cp.id = lo.book_copy_id and cp.library_id = lo.library_id where cp.book_id = b.id and cp.library_id = b.library_id and lo.status = 'active') as expected_availability,
      b.cover_storage_path is not null as has_cover
    from public.books b join room on room.id = b.library_id left join public.publishers p on p.id = b.publisher_id and p.library_id = b.library_id
    where b.status = 'active'
  )
  select c.id, c.title, c.subtitle, c.author_names, c.isbn, c.publisher_name, c.category_names, c.subject_names,
    c.language_code, c.publication_year, c.description, c.total_copies, c.available_copies,
    case when c.available_copies > 1 then 'available' when c.available_copies = 1 then 'limited' when c.expected_availability is not null then 'on_loan' else 'unavailable' end,
    case when c.available_copies = 0 then c.expected_availability else null end, c.has_cover
  from catalogue c
  where (not p_available_only or c.available_copies > 0)
    and (p_query is null or btrim(p_query) = '' or c.title ilike '%' || p_query || '%' or c.author_names ilike '%' || p_query || '%' or coalesce(c.isbn,'') ilike '%' || p_query || '%' or exists(select 1 from unnest(c.category_names || c.subject_names) v where v ilike '%' || p_query || '%'))
  order by c.title limit least(greatest(coalesce(p_limit,120),1),200)
$$;

create or replace function public.public_book_detail(p_library_code text, p_book_id uuid)
returns table(
  id uuid, title text, subtitle text, author_names text, isbn text, publisher_name text,
  category_names text[], subject_names text[], language_code text, publication_year integer, description text,
  total_copies bigint, available_copies bigint, availability_state text, expected_availability date, has_cover boolean
)
language sql stable security definer set search_path = '' as $$
  select * from public.public_catalogue(p_library_code, null, false, 200) c where c.id = p_book_id
$$;

create or replace function public.public_book_cover_path(p_library_code text, p_book_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select b.cover_storage_path
  from public.books b
  join public.libraries l on l.id = b.library_id
  where l.public_code = private.normalize_library_code(p_library_code)
    and l.status = 'active' and b.id = p_book_id and b.status = 'active'
$$;

create or replace function public.operator_accessible_libraries()
returns table(library_id uuid, library_code text, library_name text, roles text[])
language sql stable security definer set search_path = '' as $$
  select l.id, l.public_code, l.display_name, array_agg(r.role_key order by r.role_key)
  from public.profiles p join public.profile_roles pr on pr.profile_id = p.id
  join public.roles r on r.id = pr.role_id join public.libraries l on l.id = pr.library_id
  where p.auth_user_id = (select auth.uid()) and p.status = 'active' and l.status = 'active' and r.role_key in ('administrator','librarian')
  group by l.id, l.public_code, l.display_name order by l.display_name
$$;

create or replace function public.operator_context_for_library(p_library_code text)
returns table(user_id uuid, profile_id uuid, display_name text, library_id uuid, library_code text, library_name text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.auth_user_id, p.id, p.display_name, l.id, l.public_code, l.display_name, array_agg(r.role_key order by r.role_key)
  from public.profiles p join public.profile_roles pr on pr.profile_id = p.id
  join public.roles r on r.id = pr.role_id join public.libraries l on l.id = pr.library_id
  where p.auth_user_id = (select auth.uid()) and p.status = 'active' and l.status = 'active'
    and l.public_code = private.normalize_library_code(p_library_code) and r.role_key in ('administrator','librarian')
  group by p.auth_user_id, p.id, p.display_name, l.id, l.public_code, l.display_name
$$;

create or replace function public.create_library_room(p_display_name text, p_public_code text, p_creator_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_profile uuid; v_library uuid; v_admin_role uuid; v_code text;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'GS_AUTH_REQUIRED'; end if;
  v_code := private.normalize_library_code(p_public_code);
  if char_length(btrim(coalesce(p_display_name,''))) not between 3 and 160 or char_length(btrim(coalesce(p_creator_display_name,''))) not between 2 and 120
    or v_code !~ '^[A-Z0-9](?:[A-Z0-9-]{3,14})[A-Z0-9]$' or v_code ~ '--'
    or v_code in ('ADMIN','API','AUTH','LOGIN','STAFF','OPERATOR','CREATE','SUPPORT','HELP','ROOT','SYSTEM','GRANTHSETU') then
    raise exception using errcode = '22023', message = 'GS_LIBRARY_INPUT_INVALID';
  end if;
  insert into public.profiles(auth_user_id, display_name, status) values((select auth.uid()), btrim(p_creator_display_name), 'active')
  on conflict(auth_user_id) do update set display_name = coalesce(nullif(public.profiles.display_name,''), excluded.display_name)
  returning id into v_profile;
  insert into public.libraries(public_code, display_name, created_by_profile_id) values(v_code, btrim(p_display_name), v_profile) returning id into v_library;
  select id into v_admin_role from public.roles where role_key = 'administrator';
  insert into public.profile_roles(profile_id, library_id, role_id, assigned_by_profile_id) values(v_profile, v_library, v_admin_role, v_profile);
  perform set_config('granthsetu.library_id', v_library::text, true);
  insert into public.library_settings(library_id, setting_key, value_kind, boolean_value, updated_by_profile_id)
    values(v_library, 'fines_enabled', 'boolean', false, v_profile);
  insert into public.library_settings(library_id, setting_key, value_kind, integer_value, updated_by_profile_id)
    values(v_library, 'default_loan_period_days', 'integer', 14, v_profile), (v_library, 'checkout_limit', 'integer', 5, v_profile), (v_library, 'renewal_limit', 'integer', 2, v_profile);
  insert into public.audit_events(library_id, actor_profile_id, action, target_type, target_id, metadata)
    values(v_library, v_profile, 'library.created', 'library', v_library, jsonb_build_object('public_code',v_code));
  return v_library;
exception when unique_violation then raise exception using errcode = '23505', message = 'GS_LIBRARY_CODE_TAKEN';
end;
$$;

grant execute on function public.public_resolve_library(text) to anon, authenticated;
grant execute on function public.public_catalogue(text,text,boolean,integer) to anon, authenticated;
grant execute on function public.public_book_detail(text,uuid) to anon, authenticated;
grant execute on function public.operator_accessible_libraries() to authenticated;
grant execute on function public.operator_context_for_library(text) to authenticated;
grant execute on function public.create_library_room(text,text,text) to authenticated;
grant execute on function public.operator_workspace_data(text,text,text,uuid) to authenticated;
grant execute on function public.operator_workspace_mutation(text,text,jsonb,uuid) to authenticated;
grant execute on function public.public_book_cover_path(text,uuid) to service_role;

comment on table public.libraries is 'First-class GranthSetu tenant. public_code is a public locator, never authorization.';
comment on function public.public_catalogue(text,text,boolean,integer) is 'Deliberately narrow anonymous catalogue surface; returns no member, loan, fine, audit, or operator identity.';
comment on function public.operator_workspace_mutation(text,text,jsonb,uuid) is 'Room-scoped trusted mutation gateway. Auth, role, target tenant, and invariants are revalidated in the database.';
