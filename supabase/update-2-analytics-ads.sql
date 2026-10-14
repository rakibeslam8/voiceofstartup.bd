-- =====================================================================
--  Voice of Startup Bangladesh — update 2: visitor analytics, ads, auto-translation flags
--  Safe to run more than once. (Already applied to the live project; also appended to setup.sql.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) Posts: remember which language version was machine-translated
-- ---------------------------------------------------------------------
alter table public.posts add column if not exists auto_translated_bn boolean not null default false;
alter table public.posts add column if not exists auto_translated_en boolean not null default false;

-- ---------------------------------------------------------------------
-- B) Site visitor analytics (anonymous: random id kept in the visitor's browser)
-- ---------------------------------------------------------------------
create table if not exists public.site_visits (
  id          bigint generated always as identity primary key,
  visited_at  timestamptz not null default now(),
  path        text not null,
  visitor     text not null,
  session_id  text not null,
  referrer    text not null default '',
  device      text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  lang        text not null default 'bn' check (lang in ('bn', 'en')),
  is_new      boolean not null default false
);
create index if not exists site_visits_time_idx on public.site_visits (visited_at);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor, visited_at);
alter table public.site_visits enable row level security;   -- no policies: nobody reads it directly
revoke all on public.site_visits from anon, authenticated;

create or replace function public.track_visit(
  p_path text, p_visitor text, p_session text, p_referrer text,
  p_device text, p_lang text, p_new boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1);
  v_ref  text := lower(left(coalesce(p_referrer, ''), 100));
begin
  if v_path !~ '^/[A-Za-z0-9/_.\-]{0,199}$' then return; end if;
  if coalesce(p_visitor, '') !~ '^[A-Za-z0-9\-]{8,64}$' then return; end if;
  if coalesce(p_session, '') !~ '^[A-Za-z0-9\-]{8,64}$' then return; end if;
  if v_ref !~ '^[a-z0-9.\-]*$' then v_ref := ''; end if;
  insert into public.site_visits (path, visitor, session_id, referrer, device, lang, is_new)
  values (v_path, p_visitor, p_session, v_ref,
          case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
          case when p_lang = 'en' then 'en' else 'bn' end,
          coalesce(p_new, false));
end;
$$;
revoke all on function public.track_visit(text, text, text, text, text, text, boolean) from public;
grant execute on function public.track_visit(text, text, text, text, text, text, boolean) to anon, authenticated;

-- One call returns everything the admin "Visitors" page needs (Bangladesh time). Admin only.
create or replace function public.admin_site_stats(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  today date := (now() at time zone 'Asia/Dhaka')::date;
  res jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with v as (
    select *, (visited_at at time zone 'Asia/Dhaka')::date as day from public.site_visits
  ),
  win as (select * from v where day > today - d),
  days as (select generate_series(today - (d - 1), today, interval '1 day')::date as day)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views_today',    (select count(*) from v where day = today),
      'visitors_today', (select count(distinct visitor) from v where day = today),
      'views_7d',       (select count(*) from v where day > today - 7),
      'visitors_7d',    (select count(distinct visitor) from v where day > today - 7),
      'views_30d',      (select count(*) from v where day > today - 30),
      'visitors_30d',   (select count(distinct visitor) from v where day > today - 30),
      'views_all',      (select count(*) from v),
      'visitors_all',   (select count(distinct visitor) from v),
      'sessions_30d',   (select count(distinct session_id) from v where day > today - 30),
      'online_now',     (select count(distinct visitor) from public.site_visits where visited_at > now() - interval '5 minutes')
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', to_char(days.day, 'YYYY-MM-DD'),
               'views', coalesce(x.views, 0),
               'visitors', coalesce(x.visitors, 0)) order by days.day)
        from days
        left join (select day, count(*) as views, count(distinct visitor) as visitors from v group by day) x using (day)
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as views, count(distinct visitor) as visitors
          from win group by path order by count(*) desc, path limit 15) t
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(t) from (
        select case when referrer = '' then 'Direct / unknown' else referrer end as source, count(*) as views
          from win group by 1 order by count(*) desc limit 10) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(t) from (
        select device, count(distinct visitor) as visitors from win group by device order by 2 desc) t
    ), '[]'::jsonb),
    'langs', coalesce((
      select jsonb_agg(t) from (
        select lang, count(distinct visitor) as visitors from win group by lang order by 2 desc) t
    ), '[]'::jsonb),
    'new_visitors', (select count(distinct visitor) from win where is_new),
    'returning_visitors', (select count(distinct visitor) from win
                            where visitor not in (select visitor from win where is_new))
  ) into res;
  return res;
end;
$$;
revoke all on function public.admin_site_stats(int) from public, anon;
grant execute on function public.admin_site_stats(int) to authenticated;

-- ---------------------------------------------------------------------
-- C) Ads
-- ---------------------------------------------------------------------
create table if not exists public.ads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  placement   text not null check (placement in ('popup', 'header', 'feed', 'in_article', 'after_article', 'footer')),
  kind        text not null default 'image' check (kind in ('image', 'text')),
  image_url   text,
  link_url    text not null check (link_url ~* '^https?://'),
  headline    text not null default '',
  body        text not null default '',
  cta         text not null default '',
  lang        text not null default 'all' check (lang in ('all', 'bn', 'en')),
  category    text,
  is_active   boolean not null default true,
  start_at    timestamptz,
  end_at      timestamptz,
  priority    int not null default 5 check (priority between 1 and 10),
  freq_hours  int not null default 12 check (freq_hours between 0 and 720),
  impressions bigint not null default 0,
  clicks      bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ads_image_needs_url   check (kind <> 'image' or coalesce(image_url, '') <> ''),
  constraint ads_text_needs_text   check (kind <> 'text' or length(headline) > 0)
);
create index if not exists ads_live_idx on public.ads (is_active, placement);

create or replace function public.ads_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'impressions' - 'clicks' - 'updated_at')
     is distinct from (to_jsonb(old) - 'impressions' - 'clicks' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists ads_set_updated_at on public.ads;
create trigger ads_set_updated_at before update on public.ads
  for each row execute function public.ads_set_updated_at();

alter table public.ads enable row level security;

drop policy if exists "Visitors read live ads" on public.ads;
create policy "Visitors read live ads" on public.ads
  for select to anon, authenticated
  using (is_active and (start_at is null or start_at <= now()) and (end_at is null or end_at > now()));

drop policy if exists "Admin reads all ads" on public.ads;
create policy "Admin reads all ads" on public.ads for select to authenticated using (public.is_admin());
drop policy if exists "Admin inserts ads" on public.ads;
create policy "Admin inserts ads" on public.ads for insert to authenticated with check (public.is_admin());
drop policy if exists "Admin updates ads" on public.ads;
create policy "Admin updates ads" on public.ads for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin deletes ads" on public.ads;
create policy "Admin deletes ads" on public.ads for delete to authenticated using (public.is_admin());

grant select on public.ads to anon, authenticated;
grant insert, update, delete on public.ads to authenticated;

create or replace function public.ad_impression(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ads set impressions = impressions + 1
   where id = p_id and is_active
     and (start_at is null or start_at <= now()) and (end_at is null or end_at > now());
$$;
create or replace function public.ad_click(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ads set clicks = clicks + 1
   where id = p_id and is_active
     and (start_at is null or start_at <= now()) and (end_at is null or end_at > now());
$$;
revoke all on function public.ad_impression(uuid) from public;
revoke all on function public.ad_click(uuid) from public;
grant execute on function public.ad_impression(uuid) to anon, authenticated;
grant execute on function public.ad_click(uuid) to anon, authenticated;
