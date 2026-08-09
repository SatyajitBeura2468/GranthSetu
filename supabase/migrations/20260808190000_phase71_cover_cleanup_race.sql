-- Phase 7.1 forward hardening for atomic cover replacement/removal cleanup.

create or replace function public.catalogue_set_book_cover_v71(
  p_book_id uuid,
  p_cover_storage_path text,
  p_expected_cover_storage_path text
)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_previous_path text;
begin
  v_actor := private.require_catalogue_operator();
  if p_cover_storage_path is not null and (char_length(p_cover_storage_path) > 512 or p_cover_storage_path !~ '^book-covers/[0-9a-f-]+/[a-z0-9-]+[.](jpg|jpeg|png|webp)$') then
    raise exception using errcode = '22023', message = 'GS_COVER_PATH_INVALID';
  end if;
  select cover_storage_path into v_previous_path
  from public.books
  where id = p_book_id
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'GS_BOOK_NOT_FOUND'; end if;
  if p_cover_storage_path is not null and split_part(p_cover_storage_path, '/', 2) <> p_book_id::text then
    raise exception using errcode = '22023', message = 'GS_COVER_PATH_INVALID';
  end if;
  if v_previous_path is distinct from p_expected_cover_storage_path then
    raise exception using errcode = 'P0001', message = 'GS_STALE_UPDATE';
  end if;
  update public.books set cover_storage_path = p_cover_storage_path where id = p_book_id;
  perform private.admin_audit(v_actor, 'catalogue.book_cover_changed', 'book', p_book_id,
    jsonb_build_object('has_cover', p_cover_storage_path is not null));
  return v_previous_path;
end;
$$;

revoke all on function public.catalogue_set_book_cover_v71(uuid, text, text) from public, anon, service_role;
grant execute on function public.catalogue_set_book_cover_v71(uuid, text, text) to authenticated;
revoke all on function public.catalogue_set_book_cover(uuid, text) from authenticated;
