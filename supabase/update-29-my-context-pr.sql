-- update-29 (20 Nov 2026): my_context() also returns 'pr_orders' (count of the user's PR orders) so the profile menu can show "My PR orders".
-- Already applied as migration "my_context_pr_orders".
create or replace function public.my_context()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'user_type', (select user_type from public.profiles where id = uid),
    'companies', (select count(*) from public.company_private cp join public.companies c on c.id = cp.company_id where cp.owner_id = uid and c.status <> 'deleted'),
    'investing', (select count(*) from public.company_interests where user_id = uid) + (select count(*) from public.company_investments where investor_id = uid),
    'pr_orders', (select count(*) from public.pr_orders where user_id = uid and deleted_at is null));
end $f$;
revoke all on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;
