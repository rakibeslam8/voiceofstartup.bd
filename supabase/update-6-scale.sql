-- =====================================================================
-- Voice of Startup Bangladesh — update 6: statistics that stay exact AND fast at millions of rows
--
-- Run this ONCE in Supabase → SQL Editor (it is safe to run again).
--
-- Why: the old dashboard queries re-scanned every visit row each time. That is fine for thousands of
-- rows but takes ~20 s at 2 million (your admin role stops queries after 8 s) and the daily-reads
-- function was capped by the API at 1,000 rows. This update keeps every number exact:
--   * all-time totals come from a small "visitors registry" and per-day totals (no big scans),
--   * finished days are stored once in stats_daily / stats_daily_dim (exact),
--   * only "today" is counted live from the raw rows,
--   * unique-visitor figures for a date range are exact up to 400,000 visits in that range and, above
--     that, are the sum of each day's exact unique visitors (the page tells you when this applies).
-- Newsletter counts get one exact server-side function so the Subscribers page never loads the full list.
-- Nothing is deleted. Existing data is back-filled below.
-- =====================================================================

-- ---------- 1) all-time unique visitors registry ----------
create table if not exists public.site_visitors (
  visitor    text primary key,
  first_seen timestamptz not null default now()
);
create index if not exists site_visitors_first_seen_idx on public.site_visitors (first_seen);
alter table public.site_visitors enable row level security;          -- no policies: nobody reads it directly
revoke all on public.site_visitors from anon, authenticated;

insert into public.site_visitors (visitor, first_seen)
  select visitor, min(visited_at) from public.site_visits group by visitor
  on conflict (visitor) do nothing;

-- ---------- 2) per-day totals for finished days ----------
create table if not exists public.stats_daily (
  day      date primary key,
  views    bigint not null default 0,
  visitors bigint not null default 0,
  sessions bigint not null default 0
);
create table if not exists public.stats_daily_dim (
  day      date   not null,
  kind     text   not null,            -- 'path' | 'referrer' | 'device' | 'lang'
  key      text   not null,
  views    bigint not null default 0,
  visitors bigint not null default 0,
  primary key (day, kind, key)
);
alter table public.stats_daily     enable row level security;
alter table public.stats_daily_dim enable row level security;
revoke all on public.stats_daily, public.stats_daily_dim from anon, authenticated;

-- ---------- 3) every new visit also registers the visitor (once) ----------
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
  insert into public.site_visitors (visitor) values (p_visitor) on conflict (visitor) do nothing;
end;
$$;
revoke all on function public.track_visit(text, text, text, text, text, text, boolean) from public;
grant execute on function public.track_visit(text, text, text, text, text, text, boolean) to anon, authenticated;

-- ---------- 4) roll finished days up (idempotent; Bangladesh days) ----------
create or replace function public.stats_roll_day(p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lo timestamptz := (p_day::timestamp at time zone 'Asia/Dhaka');
  hi timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Dhaka');
begin
  insert into public.stats_daily (day, views, visitors, sessions)
    select p_day, count(*), count(distinct visitor), count(distinct session_id)
      from public.site_visits where visited_at >= lo and visited_at < hi
  on conflict (day) do update
    set views = excluded.views, visitors = excluded.visitors, sessions = excluded.sessions;

  delete from public.stats_daily_dim where day = p_day;
  insert into public.stats_daily_dim (day, kind, key, views, visitors)
    select p_day, 'path',     path,     count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by path
    union all
    select p_day, 'referrer', referrer, count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by referrer
    union all
    select p_day, 'device',   device,   count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by device
    union all
    select p_day, 'lang',     lang,     count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by lang;
end;
$$;

-- Rolls up every finished day that is not stored yet (at most 60 per call). Returns how many days it did.
create or replace function public.stats_roll()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  today  date := (now() at time zone 'Asia/Dhaka')::date;
  last_d date;
  d      date;
  n      int := 0;
begin
  if not pg_try_advisory_xact_lock(727001) then return 0; end if;     -- another run is already doing it
  select max(day) into last_d from public.stats_daily;
  if last_d is null then
    select (min(visited_at) at time zone 'Asia/Dhaka')::date into d from public.site_visits;
  else
    d := last_d + 1;
  end if;
  if d is null then return 0; end if;
  while d < today and n < 60 loop
    perform public.stats_roll_day(d);
    d := d + 1; n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.stats_roll_day(date) from public, anon, authenticated;
revoke all on function public.stats_roll()         from public, anon, authenticated;

-- back-fill all existing history now
do $$
declare n int;
begin
  loop
    n := public.stats_roll();
    exit when n = 0;
  end loop;
end $$;

-- also roll up every hour in the background when pg_cron is available (otherwise it happens automatically
-- the next time you open the dashboard)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('vosb-stats-roll', '5 * * * *', 'select public.stats_roll()');
exception when others then
  raise notice 'pg_cron not enabled (%). Daily roll-up will run when the dashboard is opened.', sqlerrm;
end $$;

-- ---------- 5) dashboard totals ----------
create or replace function public.admin_site_stats(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  t0    timestamptz := (today::timestamp at time zone 'Asia/Dhaka');
  t7    timestamptz := ((today - 6)::timestamp at time zone 'Asia/Dhaka');
  t30   timestamptz := ((today - 29)::timestamp at time zone 'Asia/Dhaka');
  vt bigint; vv bigint; st bigint;           -- today: views / visitors / sessions
  v7 bigint; v30 bigint; vall bigint;        -- views
  u7 bigint; u30 bigint; s30 bigint;         -- unique visitors / sessions
  b_vis int := coalesce(nullif(current_setting('vosb.b_vis', true), '')::int, 400000);
  b_ses int := coalesce(nullif(current_setting('vosb.b_ses', true), '')::int, 150000);
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.stats_roll();

  select count(*), count(distinct visitor), count(distinct session_id) into vt, vv, st
    from public.site_visits where visited_at >= t0;

  select coalesce(sum(views), 0) + vt into v7  from public.stats_daily where day > today - 7  and day < today;
  select coalesce(sum(views), 0) + vt into v30 from public.stats_daily where day > today - 30 and day < today;
  select coalesce(sum(views), 0) + vt into vall from public.stats_daily;

  if v7 <= b_vis then
    select count(*) into u7 from (select visitor from public.site_visits where visited_at >= t7 group by visitor) s;
  else
    select coalesce(sum(visitors), 0) + vv into u7 from public.stats_daily where day > today - 7 and day < today;
  end if;
  if v30 <= b_vis then
    select count(*) into u30 from (select visitor from public.site_visits where visited_at >= t30 group by visitor) s;
  else
    select coalesce(sum(visitors), 0) + vv into u30 from public.stats_daily where day > today - 30 and day < today;
  end if;
  if v30 <= b_ses then
    select count(*) into s30 from (select session_id from public.site_visits where visited_at >= t30 group by session_id) s;
  else
    select coalesce(sum(sessions), 0) + st into s30 from public.stats_daily where day > today - 30 and day < today;
  end if;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'views_today',    vt,
      'visitors_today', vv,
      'views_7d',       v7,
      'visitors_7d',    u7,
      'views_30d',      v30,
      'visitors_30d',   u30,
      'views_all',      vall,
      'visitors_all',   (select count(*) from public.site_visitors),
      'sessions_30d',   s30,
      'online_now',     (select count(distinct visitor) from public.site_visits where visited_at > now() - interval '5 minutes')
    ),
    'exact', jsonb_build_object('visitors_7d', v7 <= b_vis, 'visitors_30d', v30 <= b_vis)
  );
end;
$$;
revoke all on function public.admin_site_stats(int) from public, anon;
grant execute on function public.admin_site_stats(int) to authenticated;

-- ---------- 6) Visitors page (any date range) ----------
create or replace function public.admin_site_stats_range(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today   date := (now() at time zone 'Asia/Dhaka')::date;
  t0      timestamptz := (today::timestamp at time zone 'Asia/Dhaka');
  d_to    date := least(coalesce(p_to, today), today);
  d_from  date;
  first_d date;
  tmp     date;
  lo      timestamptz;
  hi      timestamptz;
  today_in boolean;
  vt bigint; vv bigint; st bigint;           -- today live
  n_views bigint; n_vis bigint; n_ses bigint; n_reads bigint; n_new bigint;
  exact_vis boolean; exact_ses boolean; exact_dim boolean;
  j_daily jsonb; j_pages jsonb; j_refs jsonb; j_dev jsonb; j_lang jsonb; j_arts jsonb;
  b_vis int := coalesce(nullif(current_setting('vosb.b_vis', true), '')::int, 400000);
  b_ses int := coalesce(nullif(current_setting('vosb.b_ses', true), '')::int, 150000);
  b_dim int := coalesce(nullif(current_setting('vosb.b_dim', true), '')::int, 40000);
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.stats_roll();

  select least(
           coalesce((select min(day) from public.stats_daily), today),
           coalesce((select (min(viewed_at) at time zone 'Asia/Dhaka')::date from public.post_views), today),
           coalesce((select (min(visited_at) at time zone 'Asia/Dhaka')::date from public.site_visits where visited_at >= t0), today))
    into first_d;

  d_from := coalesce(p_from, first_d);
  if d_from > d_to then tmp := d_from; d_from := d_to; d_to := tmp; end if;
  d_from := greatest(d_from, d_to - 1094);                 -- at most 3 years per request
  lo := (d_from::timestamp at time zone 'Asia/Dhaka');
  hi := ((d_to + 1)::timestamp at time zone 'Asia/Dhaka');
  today_in := d_to >= today;

  select count(*), count(distinct visitor), count(distinct session_id) into vt, vv, st
    from public.site_visits where visited_at >= t0;

  n_views := coalesce((select sum(views) from public.stats_daily where day between d_from and d_to and day < today), 0)
             + case when today_in then vt else 0 end;
  exact_vis := n_views <= b_vis;
  exact_ses := n_views <= b_ses;
  exact_dim := n_views <= b_dim;

  if exact_vis then
    select count(*) into n_vis from (select visitor from public.site_visits where visited_at >= lo and visited_at < hi group by visitor) s;
  else
    select coalesce(sum(visitors), 0) + case when today_in then vv else 0 end into n_vis
      from public.stats_daily where day between d_from and d_to and day < today;
  end if;
  if exact_ses then
    select count(*) into n_ses from (select session_id from public.site_visits where visited_at >= lo and visited_at < hi group by session_id) s;
  else
    select coalesce(sum(sessions), 0) + case when today_in then st else 0 end into n_ses
      from public.stats_daily where day between d_from and d_to and day < today;
  end if;

  -- "All time" = the whole history: the visitors registry gives the exact number of unique visitors
  if p_from is null and today_in and d_from <= first_d then
    select count(*) into n_vis from public.site_visitors;
    exact_vis := true;
  end if;

  select count(*) into n_reads from public.post_views where viewed_at >= lo and viewed_at < hi;
  select count(*) into n_new   from public.site_visitors where first_seen >= lo and first_seen < hi;

  -- one row per day (exact)
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', to_char(g.day, 'YYYY-MM-DD'),
           'views', coalesce(x.views, 0),
           'visitors', coalesce(x.visitors, 0),
           'reads', coalesce(r.reads, 0)) order by g.day), '[]'::jsonb)
    into j_daily
    from (select generate_series(d_from, d_to, interval '1 day')::date as day) g
    left join (
      select day, views, visitors from public.stats_daily where day between d_from and d_to and day < today
      union all
      select today, vt, vv where today_in
    ) x on x.day = g.day
    left join (
      select (viewed_at at time zone 'Asia/Dhaka')::date as day, count(*) as reads
        from public.post_views where viewed_at >= lo and viewed_at < hi group by 1
    ) r on r.day = g.day;

  -- pages / sources / devices / languages
  if exact_dim then
    with w as materialized (
      select path, referrer, device, lang, visitor from public.site_visits where visited_at >= lo and visited_at < hi)
    select
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select path, count(*) as views, count(distinct visitor) as visitors from w group by path order by count(*) desc, path limit 15) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select case when referrer = '' then 'Direct / unknown' else referrer end as source, count(*) as views
           from w group by 1 order by count(*) desc, 1 limit 10) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select device, count(distinct visitor) as visitors from w group by device order by 2 desc, device) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select lang, count(distinct visitor) as visitors from w group by lang order by 2 desc, lang) t)
      into j_pages, j_refs, j_dev, j_lang;
  else
    with d as (
      select kind, key, sum(views) as views, sum(visitors) as visitors from (
        select kind, key, views, visitors from public.stats_daily_dim where day between d_from and d_to and day < today
        union all select 'path',     path,     count(*), count(distinct visitor) from public.site_visits where today_in and visited_at >= t0 group by path
        union all select 'referrer', referrer, count(*), count(distinct visitor) from public.site_visits where today_in and visited_at >= t0 group by referrer
        union all select 'device',   device,   count(*), count(distinct visitor) from public.site_visits where today_in and visited_at >= t0 group by device
        union all select 'lang',     lang,     count(*), count(distinct visitor) from public.site_visits where today_in and visited_at >= t0 group by lang
      ) u group by kind, key)
    select
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select key as path, views, visitors from d where kind = 'path' order by views desc, key limit 15) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select case when key = '' then 'Direct / unknown' else key end as source, views from d where kind = 'referrer' order by views desc, key limit 10) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select key as device, visitors from d where kind = 'device' order by visitors desc, key) t),
      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
         select key as lang, visitors from d where kind = 'lang' order by visitors desc, key) t)
      into j_pages, j_refs, j_dev, j_lang;
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into j_arts from (
    select p.id, p.slug, p.title_bn, p.title_en, count(*) as reads
      from public.post_views pv join public.posts p on p.id = pv.post_id
     where pv.viewed_at >= lo and pv.viewed_at < hi
     group by p.id, p.slug, p.title_bn, p.title_en order by count(*) desc limit 10) t;

  return jsonb_build_object(
    'from', to_char(d_from, 'YYYY-MM-DD'),
    'to',   to_char(d_to,   'YYYY-MM-DD'),
    'first_day', to_char(first_d, 'YYYY-MM-DD'),
    'range', jsonb_build_object('views', n_views, 'visitors', n_vis, 'sessions', n_ses, 'article_reads', n_reads),
    'exact', jsonb_build_object('visitors', exact_vis, 'sessions', exact_ses, 'breakdowns', exact_dim),
    'totals', jsonb_build_object(
      'views_today',    vt,
      'visitors_today', vv,
      'reads_today',    (select count(*) from public.post_views where viewed_at >= t0),
      'views_all',      coalesce((select sum(views) from public.stats_daily), 0) + vt,
      'visitors_all',   (select count(*) from public.site_visitors),
      'online_now',     (select count(distinct visitor) from public.site_visits where visited_at > now() - interval '5 minutes')
    ),
    'daily', j_daily,
    'top_pages', j_pages,
    'top_articles', j_arts,
    'referrers', j_refs,
    'devices', j_dev,
    'langs', j_lang,
    'new_visitors', n_new,
    'returning_visitors', greatest(n_vis - n_new, 0)
  );
end;
$$;
revoke all on function public.admin_site_stats_range(date, date) from public, anon;
grant execute on function public.admin_site_stats_range(date, date) to authenticated;

-- ---------- 7) daily article reads (was capped at 1,000 rows by the API; now one JSON value) ----------
drop function if exists public.admin_daily_views(int);
create or replace function public.admin_daily_views(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  n     int  := least(greatest(coalesce(p_days, 30), 1), 3650);
  lo    timestamptz := (((today - (n - 1))::timestamp) at time zone 'Asia/Dhaka');
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'), 'views', coalesce(c.views, 0)) order by g.d)
      from (select generate_series(today - (n - 1), today, interval '1 day')::date as d) g
      left join (
        select (viewed_at at time zone 'Asia/Dhaka')::date as day, count(*) as views
          from public.post_views where viewed_at >= lo group by 1
      ) c on c.day = g.d
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_daily_views(int) from public, anon;
grant execute on function public.admin_daily_views(int) to authenticated;

-- ---------- 8) exact newsletter numbers without loading the list ----------
create index if not exists subscribers_status_lang_idx on public.subscribers (status, lang);

create or replace function public.admin_subscriber_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total',        count(*),
      'active',       count(*) filter (where status = 'active'),
      'unsubscribed', count(*) filter (where status <> 'active'),
      'active_bn',    count(*) filter (where status = 'active' and lang = 'bn'),
      'active_en',    count(*) filter (where status = 'active' and lang = 'en'),
      'new_7d',       count(*) filter (where created_at > now() - interval '7 days'))
      from public.subscribers);
end;
$$;
revoke all on function public.admin_subscriber_stats() from public, anon;
grant execute on function public.admin_subscriber_stats() to authenticated;
