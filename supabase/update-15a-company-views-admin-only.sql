-- VOSB update 15a — company profile views are visible to the ADMIN only.
-- Before: companies.views was readable by everyone (public page + owner account).
-- Now: the counters live in two admin-only tables; companies.views is kept at 0 (old totals are COPIED, nothing is lost).

create table if not exists public.company_view_stats (
  company_id uuid primary key references public.companies (id) on delete cascade,
  views_total int not null default 0,
  last_view_at timestamptz
);
create table if not exists public.company_view_days (
  company_id uuid not null references public.companies (id) on delete cascade,
  day date not null,
  views int not null default 0,
  primary key (company_id, day)
);
alter table public.company_view_stats enable row level security;
alter table public.company_view_days enable row level security;
revoke all on public.company_view_stats, public.company_view_days from anon, authenticated;
grant select on public.company_view_stats, public.company_view_days to authenticated;
drop policy if exists "Admin reads view stats" on public.company_view_stats;
create policy "Admin reads view stats" on public.company_view_stats for select to authenticated using (public.is_admin());
drop policy if exists "Admin reads view days" on public.company_view_days;
create policy "Admin reads view days" on public.company_view_days for select to authenticated using (public.is_admin());

-- copy what was counted so far (once), then clear the public column
insert into public.company_view_stats (company_id, views_total)
  select id, views from public.companies where views > 0
  on conflict (company_id) do update set views_total = greatest(public.company_view_stats.views_total, excluded.views_total);
update public.companies set views = 0 where views <> 0;

create or replace function public.increment_company_view(p_slug text) returns void language plpgsql security definer set search_path to 'public' as $$
declare cid uuid;
begin
  if not public.rl_hit('cv', 120, 60) then return; end if;
  select id into cid from public.companies where slug = p_slug and status = 'published';
  if cid is null then return; end if;
  insert into public.company_view_stats (company_id, views_total, last_view_at) values (cid, 1, now())
    on conflict (company_id) do update set views_total = public.company_view_stats.views_total + 1, last_view_at = now();
  insert into public.company_view_days (company_id, day, views) values (cid, (now() at time zone 'Asia/Dhaka')::date, 1)
    on conflict (company_id, day) do update set views = public.company_view_days.views + 1;
end $$;

-- admin: one company's numbers (total, today, 7 / 30 days, 14-day series, distinct visitors from the site analytics)
create or replace function public.admin_company_views(p_company uuid) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare slug_ text; today date := (now() at time zone 'Asia/Dhaka')::date; r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select slug into slug_ from public.companies where id = p_company;
  select jsonb_build_object(
    'total', coalesce((select views_total from public.company_view_stats where company_id = p_company), 0),
    'today', coalesce((select views from public.company_view_days where company_id = p_company and day = today), 0),
    'd7', coalesce((select sum(views) from public.company_view_days where company_id = p_company and day > today - 7), 0),
    'd30', coalesce((select sum(views) from public.company_view_days where company_id = p_company and day > today - 30), 0),
    'last_view_at', (select last_view_at from public.company_view_stats where company_id = p_company),
    'visitors', case when slug_ is null then 0 else (select count(distinct visitor) from public.site_visits where path = '/company/' || slug_ and kind = 'human') end,
    'series', coalesce((select jsonb_agg(jsonb_build_object('d', g.d, 'n', coalesce(v.views, 0)) order by g.d)
                        from generate_series(today - 13, today, interval '1 day') as g(d)
                        left join public.company_view_days v on v.company_id = p_company and v.day = g.d::date), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_company_views(uuid) from public, anon;
grant execute on function public.admin_company_views(uuid) to authenticated;
