-- VOSB update 13c — role chosen at sign-up is saved on the profile; my_context() lets the site show
-- each person the menu that fits them (founder / investor / reader). Additive; applied 2026-11-06.
create or replace function public.ensure_profile()
returns profiles language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); j jsonb := auth.jwt(); um jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb); am jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb); r public.profiles;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  insert into public.profiles (id, email, full_name, avatar_url, provider, user_type)
  values (uid, lower(j ->> 'email'), public._txt(coalesce(um ->> 'full_name', um ->> 'name'), 120),
          case when (um ->> 'avatar_url') ~* '^https://' then left(um ->> 'avatar_url', 500) when (um ->> 'picture') ~* '^https://' then left(um ->> 'picture', 500) end,
          coalesce(am ->> 'provider', 'email'),
          case when (um ->> 'user_type') in ('reader','founder','investor','other') then um ->> 'user_type' end)
  on conflict (id) do update set last_seen_at = now(), email = excluded.email
  returning * into r;
  return r;
end $$;

create or replace function public.my_context()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'user_type', (select user_type from public.profiles where id = uid),
    'companies', (select count(*) from public.company_private cp join public.companies c on c.id = cp.company_id where cp.owner_id = uid and c.status <> 'deleted'),
    'investing', (select count(*) from public.company_interests where user_id = uid) + (select count(*) from public.company_investments where investor_id = uid));
end $$;
revoke execute on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;
