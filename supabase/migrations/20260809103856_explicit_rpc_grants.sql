-- Reassert least-privilege execution after every V3 function replacement.
-- SECURITY DEFINER routines are denied by default and only current application
-- entry points plus the mature canonical mutation engine are exposed.
revoke execute on all functions in schema public from public, anon, authenticated;

do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'current_operator_context','operator_accessible_libraries','operator_context_for_library',
      'create_library_room','operator_workspace_data','operator_workspace_mutation',
      'operator_circulation_search','operator_room_operators','operator_room_audit','operator_room_report',
      'admin_assign_operator_to_room','admin_set_room_operator_status'
    ])
  loop
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

grant execute on function public.public_resolve_library(text) to anon, authenticated;
grant execute on function public.public_catalogue(text,text,boolean,integer) to anon, authenticated;
grant execute on function public.public_book_detail(text,uuid) to anon, authenticated;
grant execute on function public.public_catalogue_page(text,text,boolean,integer,integer,uuid) to anon, authenticated;
grant execute on function public.public_new_titles(text,integer) to anon, authenticated;
grant execute on function public.public_book_cover_path(text,uuid) to service_role;
grant execute on function public.bootstrap_first_administrator(uuid,text) to service_role;
