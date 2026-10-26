-- Update 9: count every visit, and label it as human / owner / bot.
-- Additive only: nothing is deleted or rewritten. Existing rows become 'human' (that is what they were).

alter table public.site_visits add column if not exists kind text not null default 'human';
alter table public.post_views  add column if not exists kind text not null default 'human';

-- track_visit: new optional p_kind (old 7-argument calls keep working through the default)
drop function if exists public.track_visit(text, text, text, text, text, text, boolean);
create or replace function public.track_visit(
  p_path text, p_visitor text, p_session text, p_referrer text, p_device text, p_lang text, p_new boolean,
  p_kind text default 'human')
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_path text := split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1);
  v_ref  text := lower(left(coalesce(p_referrer, ''), 100));
  v_kind text := case when p_kind in ('bot', 'owner') then p_kind else 'human' end;
begin
  if v_path !~ '^/[A-Za-z0-9/_.\-]{0,199}$' then return; end if;
  if coalesce(p_visitor, '') !~ '^[A-Za-z0-9\-]{8,64}$' then return; end if;
  if coalesce(p_session, '') !~ '^[A-Za-z0-9\-]{8,64}$' then return; end if;
  if v_ref !~ '^[a-z0-9.\-]*$' then v_ref := ''; end if;
  insert into public.site_visits (path, visitor, session_id, referrer, device, lang, is_new, kind)
  values (v_path, p_visitor, p_session, v_ref,
          case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
          case when p_lang = 'en' then 'en' else 'bn' end,
          coalesce(p_new, false), v_kind);
  insert into public.site_visitors (visitor) values (p_visitor) on conflict (visitor) do nothing;
end;
$$;
grant execute on function public.track_visit(text, text, text, text, text, text, boolean, text) to anon, authenticated, service_role;

-- increment_view: every read is recorded; the public counter on the article shows people (humans + owner), not bots
drop function if exists public.increment_view(text);
create or replace function public.increment_view(p_slug text, p_kind text default 'human')
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_kind text := case when p_kind in ('bot', 'owner') then p_kind else 'human' end;
begin
  select id into v_id from public.posts where slug = p_slug and status = 'published' and publish_at <= now();
  if v_id is null then return; end if;
  if v_kind <> 'bot' then update public.posts set views = views + 1 where id = v_id; end if;
  insert into public.post_views (post_id, kind) values (v_id, v_kind);
end;
$$;
grant execute on function public.increment_view(text, text) to anon, authenticated, service_role;

-- daily roll-up also keeps the human / owner / bot split
create or replace function public.stats_roll_day(p_day date)
returns void language plpgsql security definer set search_path to 'public' as $$
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
    select p_day, 'lang',     lang,     count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by lang
    union all
    select p_day, 'kind',     kind,     count(*), count(distinct visitor) from public.site_visits where visited_at >= lo and visited_at < hi group by kind;
end;
$$;

-- days that were already rolled up before this update were all human
insert into public.stats_daily_dim (day, kind, key, views, visitors)
  select d.day, 'kind', 'human', d.views, d.visitors from public.stats_daily d
  where not exists (select 1 from public.stats_daily_dim x where x.day = d.day and x.kind = 'kind');

-- admin: who is behind the numbers (humans / you / bots) for a date range
create or replace function public.admin_site_kinds(p_from date default null, p_to date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  today  date := (now() at time zone 'Asia/Dhaka')::date;
  t0     timestamptz := (today::timestamp at time zone 'Asia/Dhaka');
  d_to   date := least(coalesce(p_to, today), today);
  d_from date := coalesce(p_from, date '2000-01-01');
  tmp    date;
  lo timestamptz; hi timestamptz;
  n_views bigint;
  v_visits jsonb; v_reads jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.stats_roll();
  if d_from > d_to then tmp := d_from; d_from := d_to; d_to := tmp; end if;
  lo := (d_from::timestamp at time zone 'Asia/Dhaka');
  hi := ((d_to + 1)::timestamp at time zone 'Asia/Dhaka');
  select coalesce(sum(views), 0) + (select count(*) from public.site_visits where visited_at >= t0 and d_to >= today)
    into n_views from public.stats_daily where day between d_from and d_to and day < today;

  if n_views <= 40000 then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_visits from (
      select kind, count(*) as views, count(distinct visitor) as visitors
        from public.site_visits where visited_at >= lo and visited_at < hi group by kind order by 2 desc) t;
  else
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_visits from (
      select kind, sum(views) as views, sum(visitors) as visitors from (
        select key as kind, views, visitors from public.stats_daily_dim where kind = 'kind' and day between d_from and d_to and day < today
        union all
        select kind, count(*), count(distinct visitor) from public.site_visits where d_to >= today and visited_at >= t0 group by kind) u
      group by kind order by 2 desc) t;
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_reads from (
    select kind, count(*) as reads from public.post_views where viewed_at >= lo and viewed_at < hi group by kind order by 2 desc) t;

  return jsonb_build_object('visits', v_visits, 'reads', v_reads);
end;
$$;
grant execute on function public.admin_site_kinds(date, date) to authenticated;
