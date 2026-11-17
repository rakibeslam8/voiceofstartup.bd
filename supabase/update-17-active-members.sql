-- Update 17 — per-day list of active members for the admin "Daily active" page (already applied to the live project). Safe to re-run.
create or replace function public.admin_active_members(p_day date default null) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare d date := coalesce(p_day, (now() at time zone 'Asia/Dhaka')::date);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.last_at desc) from (
    select a.user_id as id, u.email, p.full_name as name, p.phone, p.user_type as role, a.device, a.hits, a.first_at, a.last_at,
           (select count(*) from public.user_activity_daily z where z.user_id = a.user_id and z.day > d - 30) as days_30
    from public.user_activity_daily a join auth.users u on u.id = a.user_id left join public.profiles p on p.id = a.user_id
    where a.day = d limit 500) x), '[]'::jsonb);
end $$;
revoke all on function public.admin_active_members(date) from public, anon;
grant execute on function public.admin_active_members(date) to authenticated;
