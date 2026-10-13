-- =====================================================================
--  Voice of Startup Bangladesh — database setup for Supabase
--
--  HOW TO USE (once):
--    Supabase Dashboard -> SQL Editor -> New query -> paste ALL of this
--    file -> Run.  It is safe to run again (idempotent).
--
--  ADMIN LOGIN:
--    The admin signs in with User ID "voiceofstartupbd". The site turns that
--    into the email below. Create that user in Supabase
--    (Authentication -> Users -> Add user -> Create new user, tick
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
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'voiceofstartupbd@voiceofstartup.bd';
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
