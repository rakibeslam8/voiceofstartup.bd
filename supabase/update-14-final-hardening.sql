-- VOSB update 14 — final hardening (no data is touched).
-- 1) the null-safe clamp helpers get a fixed search_path (security advisor)
create or replace function public._gr(a numeric, b numeric) returns numeric language sql immutable set search_path = '' as $$ select case when a is null or b is null then null else greatest(a, b) end $$;
create or replace function public._lt(a numeric, b numeric) returns numeric language sql immutable set search_path = '' as $$ select case when a is null or b is null then null else least(a, b) end $$;
-- 2) rls_auto_enable() is a database event-trigger helper — nobody should call it over the API
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
-- 3) the public (anon) role never writes tables directly — every write goes through a checked function; RLS already blocked it, this removes the privilege too
revoke insert, update, delete, truncate on public.admin_field_defs, public.admin_meta, public.company_delete_requests, public.company_financials, public.company_investments, public.company_valuations, public.notifications, public.post_comments, public.post_likes, public.valuation_requests from anon;
-- 4) autosave while a founder fills a long form must never lock them out: 80 -> 240 saves per 10 minutes
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_company_draft';
  if d is null then raise exception 'save_company_draft not found'; end if;
  if d ~ 'co_save., 80, 600' then execute replace(d, '''co_save'', 80, 600', '''co_save'', 240, 600'); end if;
end $$;
