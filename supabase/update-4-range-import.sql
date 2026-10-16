-- =====================================================================
--  Voice of Startup Bangladesh — update 4: custom date ranges + subscriber import
--  Safe to run more than once. (Also appended to setup.sql.)
-- =====================================================================

-- A) Visitors page for ANY date range (Bangladesh time). p_from null = since the first visit.
create or replace function public.admin_site_stats_range(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today   date := (now() at time zone 'Asia/Dhaka')::date;
  d_to    date := least(coalesce(p_to, today), today);
  d_from  date;
  first_d date;
  tmp     date;
  lo      timestamptz;
  hi      timestamptz;
  t0      timestamptz := (today::timestamp at time zone 'Asia/Dhaka');
  res     jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select least(
           coalesce((select min((visited_at at time zone 'Asia/Dhaka')::date) from public.site_visits), today),
           coalesce((select min((viewed_at  at time zone 'Asia/Dhaka')::date) from public.post_views),  today))
    into first_d;

  d_from := coalesce(p_from, first_d);
  if d_from > d_to then tmp := d_from; d_from := d_to; d_to := tmp; end if;
  d_from := greatest(d_from, d_to - 1094);          -- at most 3 years per request
  lo := (d_from::timestamp at time zone 'Asia/Dhaka');
  hi := ((d_to + 1)::timestamp at time zone 'Asia/Dhaka');

  with w as (
    select *, (visited_at at time zone 'Asia/Dhaka')::date as day
      from public.site_visits where visited_at >= lo and visited_at < hi
  ),
  pw as (
    select post_id, (viewed_at at time zone 'Asia/Dhaka')::date as day
      from public.post_views where viewed_at >= lo and viewed_at < hi
  ),
  days as (select generate_series(d_from, d_to, interval '1 day')::date as day)
  select jsonb_build_object(
    'from', to_char(d_from, 'YYYY-MM-DD'),
    'to',   to_char(d_to,   'YYYY-MM-DD'),
    'first_day', to_char(first_d, 'YYYY-MM-DD'),
    'range', jsonb_build_object(
      'views',         (select count(*) from w),
      'visitors',      (select count(distinct visitor) from w),
      'sessions',      (select count(distinct session_id) from w),
      'article_reads', (select count(*) from pw)
    ),
    'totals', jsonb_build_object(
      'views_today',    (select count(*) from public.site_visits where visited_at >= t0),
      'visitors_today', (select count(distinct visitor) from public.site_visits where visited_at >= t0),
      'reads_today',    (select count(*) from public.post_views where viewed_at >= t0),
      'views_all',      (select count(*) from public.site_visits),
      'visitors_all',   (select count(distinct visitor) from public.site_visits),
      'online_now',     (select count(distinct visitor) from public.site_visits where visited_at > now() - interval '5 minutes')
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', to_char(days.day, 'YYYY-MM-DD'),
               'views', coalesce(x.views, 0),
               'visitors', coalesce(x.visitors, 0),
               'reads', coalesce(r.reads, 0)) order by days.day)
        from days
        left join (select day, count(*) as views, count(distinct visitor) as visitors from w group by day) x using (day)
        left join (select day, count(*) as reads from pw group by day) r using (day)
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as views, count(distinct visitor) as visitors
          from w group by path order by count(*) desc, path limit 15) t
    ), '[]'::jsonb),
    'top_articles', coalesce((
      select jsonb_agg(t) from (
        select p.id, p.slug, p.title_bn, p.title_en, count(*) as reads
          from pw join public.posts p on p.id = pw.post_id
         group by p.id, p.slug, p.title_bn, p.title_en order by count(*) desc limit 10) t
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(t) from (
        select case when referrer = '' then 'Direct / unknown' else referrer end as source, count(*) as views
          from w group by 1 order by count(*) desc limit 10) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(t) from (
        select device, count(distinct visitor) as visitors from w group by device order by 2 desc) t
    ), '[]'::jsonb),
    'langs', coalesce((
      select jsonb_agg(t) from (
        select lang, count(distinct visitor) as visitors from w group by lang order by 2 desc) t
    ), '[]'::jsonb),
    'new_visitors', (select count(distinct visitor) from w where is_new),
    'returning_visitors', (select count(distinct visitor) from w
                            where visitor not in (select visitor from w where is_new))
  ) into res;
  return res;
end;
$$;
revoke all on function public.admin_site_stats_range(date, date) from public, anon;
grant execute on function public.admin_site_stats_range(date, date) to authenticated;

-- B) Import existing email addresses into the newsletter list (admin only).
create or replace function public.admin_import_subscribers(p_emails text[], p_lang text default 'bn')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lang text := case when p_lang = 'en' then 'en' else 'bn' end;
  v_total int; v_distinct int; v_valid int; v_added int;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_emails is null or coalesce(array_length(p_emails, 1), 0) = 0 then
    return jsonb_build_object('total', 0, 'duplicates', 0, 'invalid', 0, 'added', 0, 'existing', 0);
  end if;
  if array_length(p_emails, 1) > 20000 then
    raise exception 'Too many addresses at once (max 20000 per import)';
  end if;

  with raw as (select lower(btrim(e)) as email from unnest(p_emails) as e where btrim(e) <> ''),
  d   as (select distinct email from raw),
  ok  as (select email from d where length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ins as (
    insert into public.subscribers (email, lang, source)
    select email, v_lang, 'import' from ok
    on conflict (email) do nothing
    returning 1
  )
  select (select count(*) from raw), (select count(*) from d), (select count(*) from ok), (select count(*) from ins)
    into v_total, v_distinct, v_valid, v_added;

  return jsonb_build_object(
    'total', v_total, 'duplicates', v_total - v_distinct, 'invalid', v_distinct - v_valid,
    'added', v_added, 'existing', v_valid - v_added);
end;
$$;
revoke all on function public.admin_import_subscribers(text[], text) from public, anon;
grant execute on function public.admin_import_subscribers(text[], text) to authenticated;
