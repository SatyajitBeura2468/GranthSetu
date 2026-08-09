-- Production corrective hardening: normalized room-local authors and clean text output.

create unique index if not exists authors_library_normalized_name_unique
  on public.authors (library_id, lower(btrim(display_name)));

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
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  v_actor := private.require_catalogue_operator();
  v_library := private.request_library_id();
  if char_length(v_name) not between 1 and 160 then
    raise exception using errcode='22023', message='GS_REFERENCE_NAME_INVALID';
  end if;

  if p_id is null then
    select id into v_id from public.authors
    where library_id=v_library and lower(btrim(display_name))=lower(v_name)
    limit 1;
    if v_id is null then
      begin
        insert into public.authors(library_id,display_name) values(v_library,v_name) returning id into v_id;
      exception when unique_violation then
        select id into v_id from public.authors
        where library_id=v_library and lower(btrim(display_name))=lower(v_name)
        limit 1;
      end;
    end if;
  else
    update public.authors set display_name=v_name
    where id=p_id and library_id=v_library returning id into v_id;
    if v_id is null then raise exception using errcode='P0001', message='GS_REFERENCE_NOT_FOUND'; end if;
  end if;

  perform private.admin_audit(v_actor,'catalogue.author_saved','author',v_id,jsonb_build_object('display_name',v_name));
  return v_id;
exception when unique_violation then
  raise exception using errcode='23505', message='GS_REFERENCE_DUPLICATE';
end;
$$;

-- The prior release function was valid UTF-8 source but returned mojibake separators.
-- Keep the old implementation private and expose a cleaned room-aware wrapper.
alter function public.operator_global_search(text,text) rename to operator_global_search_legacy_text;
revoke all on function public.operator_global_search_legacy_text(text,text) from public, anon, authenticated, service_role;

create function public.operator_global_search(p_library_code text,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  return replace(public.operator_global_search_legacy_text(p_library_code,p_query)::text,chr(194)||chr(183),' | ')::jsonb;
end;
$$;
revoke all on function public.operator_global_search(text,text) from public, anon;
grant execute on function public.operator_global_search(text,text) to authenticated;

alter function public.operator_circulation_search(text,text,text) rename to operator_circulation_search_legacy_text;
revoke all on function public.operator_circulation_search_legacy_text(text,text,text) from public, anon, authenticated, service_role;

create function public.operator_circulation_search(p_library_code text,p_kind text,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  return replace(public.operator_circulation_search_legacy_text(p_library_code,p_kind,p_query)::text,chr(194)||chr(183),' | ')::jsonb;
end;
$$;
revoke all on function public.operator_circulation_search(text,text,text) from public, anon;
grant execute on function public.operator_circulation_search(text,text,text) to authenticated;
