-- =====================================================================
--  Voice of Startup Bangladesh — database setup for Supabase
--
--  HOW TO USE (once):
--    Supabase Dashboard -> SQL Editor -> New query -> paste ALL of this
--    file -> Run.  It is safe to run again (idempotent).
--
--  ADMIN LOGIN:
--    The admin signs in with User ID "rakib". The site turns that
--    into the email below. Create that user in Supabase
--    (Authentication -> Users -> Add user -> Create new user, e.g. rakib@voiceofstartup.bd, tick
--    "Auto Confirm User") and set your own password there.
--    If you ever want another User ID, change the email in is_admin() and
--    in js/config.js (admin.loginDomain / admin.userId).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Articles
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  category    text not null,                       -- funding | founder | business | opportunity
  status      text not null default 'draft' check (status in ('draft', 'published')),
  publish_at  timestamptz not null default now(),  -- future date = scheduled
  featured    boolean not null default false,
  title_bn    text not null default '',
  title_en    text not null default '',
  excerpt_bn  text not null default '',
  excerpt_en  text not null default '',
  body_bn     text not null default '',            -- simple markdown (see admin toolbar)
  body_en     text not null default '',
  source      text not null default 'VOSB',        -- BIDA, BEPZA, BEZA, BSCIC, ICT, BHTPA, PPPA, VOSB ...
  source_url  text,
  author      text not null default 'VOSB Desk',
  image_url   text,
  image_alt   text not null default '',
  views       bigint not null default 0,
  shares      bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint posts_has_title   check (length(title_bn) > 0 or length(title_en) > 0)
);

create index if not exists posts_live_idx on public.posts (status, publish_at desc);
create index if not exists posts_category_idx on public.posts (category, publish_at desc);

-- updated_at only changes when CONTENT changes (not when a view is counted),
-- so the sitemap "lastmod" stays honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'views' - 'shares' - 'updated_at')
     is distinct from (to_jsonb(old) - 'views' - 'shares' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2) View log (one row per counted view; used for the daily chart)
-- ---------------------------------------------------------------------
create table if not exists public.post_views (
  id        bigint generated always as identity primary key,
  post_id   uuid not null references public.posts (id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists post_views_time_idx on public.post_views (viewed_at);

-- ---------------------------------------------------------------------
-- 3) Who is the admin?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'rakib@voiceofstartup.bd';
$$;

-- ---------------------------------------------------------------------
-- 4) Row Level Security  (this is the real protection)
--    - Visitors can ONLY read published posts whose publish time has passed.
--    - Only the admin account can read drafts / scheduled posts and write.
-- ---------------------------------------------------------------------
alter table public.posts      enable row level security;
alter table public.post_views enable row level security;   -- no policies = nobody reads it directly

drop policy if exists "Visitors read live posts" on public.posts;
create policy "Visitors read live posts" on public.posts
  for select to anon, authenticated
  using (status = 'published' and publish_at <= now());

drop policy if exists "Admin reads all posts" on public.posts;
create policy "Admin reads all posts" on public.posts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admin inserts posts" on public.posts;
create policy "Admin inserts posts" on public.posts
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admin updates posts" on public.posts;
create policy "Admin updates posts" on public.posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin deletes posts" on public.posts;
create policy "Admin deletes posts" on public.posts
  for delete to authenticated
  using (public.is_admin());

-- Explicit table privileges (RLS above still decides who can do what)
grant usage on schema public to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
revoke all on public.post_views from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) Counters visitors may call (they can ONLY add +1, nothing else)
-- ---------------------------------------------------------------------
create or replace function public.increment_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.posts
     set views = views + 1
   where slug = p_slug
     and status = 'published'
     and publish_at <= now()
  returning id into v_id;

  if v_id is not null then
    insert into public.post_views (post_id) values (v_id);
  end if;
end;
$$;

create or replace function public.increment_share(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
     set shares = shares + 1
   where slug = p_slug
     and status = 'published'
     and publish_at <= now();
$$;

revoke all on function public.increment_view(text)  from public;
revoke all on function public.increment_share(text) from public;
grant execute on function public.increment_view(text)  to anon, authenticated;
grant execute on function public.increment_share(text) to anon, authenticated;

-- Daily views for the admin dashboard (Bangladesh time). Admin only.
create or replace function public.admin_daily_views(p_days int default 30)
returns table (day date, views bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
    select s.d::date as day,
           count(v.id)::bigint as views
      from generate_series(
             ((now() at time zone 'Asia/Dhaka')::date - (greatest(p_days, 1) - 1))::timestamp,
             (now() at time zone 'Asia/Dhaka')::date::timestamp,
             interval '1 day') as s(d)
      left join public.post_views v
             on (v.viewed_at at time zone 'Asia/Dhaka')::date = s.d::date
     group by s.d
     order by s.d;
end;
$$;

revoke all on function public.admin_daily_views(int) from public, anon;
grant execute on function public.admin_daily_views(int) to authenticated;

-- ---------------------------------------------------------------------
-- 6) Image storage (public read, admin-only upload; max 5 MB; images only)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
   set public             = true,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads post images" on storage.objects;
create policy "Public reads post images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'post-images');

drop policy if exists "Admin uploads post images" on storage.objects;
create policy "Admin uploads post images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "Admin updates post images" on storage.objects;
create policy "Admin updates post images" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and public.is_admin())
  with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "Admin deletes post images" on storage.objects;
create policy "Admin deletes post images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and public.is_admin());

-- Done. Next: Authentication -> Providers -> Email: turn OFF "Allow new users
-- to sign up" (so nobody else can create an account).

-- =====================================================================
-- UPDATE 2 (analytics, ads, translation flags)
-- =====================================================================
-- =====================================================================
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

-- =====================================================================
--  Newsletter subscribers (update 3)
-- =====================================================================

create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  status          text not null default 'active' check (status in ('active', 'unsubscribed')),
  lang            text not null default 'bn' check (lang in ('bn', 'en')),
  source          text not null default 'home',
  token           uuid not null default gen_random_uuid(),   -- used in the unsubscribe link
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint subscribers_email_chk check (email = lower(email) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index if not exists subscribers_email_key on public.subscribers (email);
create unique index if not exists subscribers_token_key on public.subscribers (token);
create index if not exists subscribers_created_idx on public.subscribers (created_at desc);

alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;
grant select, update, delete on public.subscribers to authenticated;   -- RLS below limits this to the admin

drop policy if exists "Admin reads subscribers" on public.subscribers;
create policy "Admin reads subscribers" on public.subscribers
  for select to authenticated using (public.is_admin());
drop policy if exists "Admin updates subscribers" on public.subscribers;
create policy "Admin updates subscribers" on public.subscribers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin deletes subscribers" on public.subscribers;
create policy "Admin deletes subscribers" on public.subscribers
  for delete to authenticated using (public.is_admin());

-- Public sign-up. Returns 'ok' (also for an address that is already on the list, so nobody can
-- probe who is subscribed), 'invalid' or 'busy' (a crude flood guard).
create or replace function public.subscribe_newsletter(p_email text, p_lang text default 'bn', p_source text default 'home')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lang  text := case when p_lang = 'en' then 'en' else 'bn' end;
  v_src   text := left(regexp_replace(coalesce(p_source, 'home'), '[^a-z0-9_\-]', '', 'g'), 30);
begin
  if v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid';
  end if;
  if (select count(*) from public.subscribers where created_at > now() - interval '1 minute') > 40 then
    return 'busy';
  end if;
  if v_src = '' then v_src := 'home'; end if;
  insert into public.subscribers (email, lang, source) values (v_email, v_lang, v_src)
  on conflict (email) do update
    set status = 'active', unsubscribed_at = null, lang = excluded.lang
    where public.subscribers.status = 'unsubscribed';
  return 'ok';
end;
$$;
revoke all on function public.subscribe_newsletter(text, text, text) from public;
grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;

-- One-click unsubscribe (the link in every newsletter carries the subscriber's private token).
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.subscribers set status = 'unsubscribed', unsubscribed_at = now()
  where token = p_token and status = 'active';
  get diagnostics n = row_count;
  return n > 0 or exists (select 1 from public.subscribers where token = p_token);
end;
$$;
revoke all on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;
