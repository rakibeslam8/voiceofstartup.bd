-- Update 11 - user accounts + Company Directory (applications, one-time listing fee, reviews, comments, investor interest)
-- STATUS: DRAFT - NOT YET APPLIED to the live project (waiting for the owner to approve the Supabase confirmation).
-- Safe to re-run. It only adds new tables/functions/buckets and does not delete any existing data.
-- Security model: users NEVER write to tables directly. Every write goes through a checked SECURITY DEFINER function
-- (login required, ownership checks, field whitelist, rate limits). Row-level security hides drafts, legal numbers,
-- payments and documents from everyone except their owner and the admin.

-------------------------------------------------------------------- helpers
create or replace function public._txt(t text, n int) returns text language sql immutable set search_path to 'public' as $$
  select nullif(left(btrim(regexp_replace(coalesce(t, ''), '[\x01-\x08\x0b\x0c\x0e-\x1f]', '', 'g')), n), '') $$;
create or replace function public._url(t text, n int default 300) returns text language sql immutable set search_path to 'public' as $$
  select case when t ~* '^https?://[^\s<>"'']+$' and char_length(t) <= n then btrim(t) else null end $$;
create or replace function public._num(t text) returns numeric language plpgsql immutable set search_path to 'public' as $$
begin return nullif(btrim(t), '')::numeric; exception when others then return null; end $$;
create or replace function public._own_img(t text, b text) returns text language sql immutable set search_path to 'public' as $$
  select case when t like 'https://hpanuojuazdqolgkafqg.supabase.co/storage/v1/object/public/' || b || '/%' and char_length(t) <= 400 and t !~ '[\s<>"'']' then t else null end $$;
create or replace function public.rl_user(p_scope text, p_limit int, p_secs int) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare c int; b bigint := floor(extract(epoch from now()) / greatest(p_secs, 1))::bigint;
begin
  insert into public.rate_limits as r (k, bucket, n) values ('u:' || p_scope || ':' || coalesce(auth.uid()::text, 'anon'), b, 1)
  on conflict (k, bucket) do update set n = r.n + 1 returning r.n into c;
  return c <= p_limit;
end $$;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at := now(); return new; end $$;
revoke all on function public._txt(text,int), public._url(text,int), public._num(text), public._own_img(text,text), public.rl_user(text,int,int), public.touch_updated_at() from public, anon, authenticated;

-------------------------------------------------------------------- settings (fee + payment methods)
create table if not exists public.site_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.site_settings enable row level security;
drop policy if exists "Admin manages settings" on public.site_settings;
create policy "Admin manages settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update on public.site_settings to authenticated;
insert into public.site_settings (key, value) values
  ('listing_fee', '1000'),
  ('payment_methods', '{"bkash":{"enabled":true,"number":"01403960352","kind":"Personal"},"nagad":{"enabled":false,"number":"","kind":"Personal"},"rocket":{"enabled":false,"number":"","kind":"Personal"},"upay":{"enabled":false,"number":"","kind":"Personal"},"cellfin":{"enabled":false,"number":"","kind":"Personal"},"tap":{"enabled":false,"number":"","kind":"Personal"}}')
on conflict (key) do nothing;

create or replace function public.get_listing_settings() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'fee', (select value from public.site_settings where key = 'listing_fee'),
    'methods', case when auth.uid() is null
      then (select jsonb_object_agg(k, v - 'number') from jsonb_each((select value from public.site_settings where key = 'payment_methods')) as t(k, v))
      else (select value from public.site_settings where key = 'payment_methods') end) $$;
revoke all on function public.get_listing_settings() from public;
grant execute on function public.get_listing_settings() to anon, authenticated;

-------------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text, full_name text, phone text, avatar_url text, headline text, bio text, location text,
  user_type text not null default 'reader' check (user_type in ('reader','founder','investor','other')),
  provider text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_seen_at timestamptz);
alter table public.profiles enable row level security;
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.ensure_profile() returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); j jsonb := auth.jwt(); um jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb); am jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb); r public.profiles;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  insert into public.profiles (id, email, full_name, avatar_url, provider)
  values (uid, lower(j ->> 'email'), public._txt(coalesce(um ->> 'full_name', um ->> 'name'), 120),
          case when (um ->> 'avatar_url') ~* '^https://' then left(um ->> 'avatar_url', 500) when (um ->> 'picture') ~* '^https://' then left(um ->> 'picture', 500) end,
          coalesce(am ->> 'provider', 'email'))
  on conflict (id) do update set last_seen_at = now(), email = excluded.email
  returning * into r;
  return r;
end $$;

create or replace function public.update_my_profile(p jsonb) returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); r public.profiles; nm text; ph text;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('profile', 30, 600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  perform public.ensure_profile();
  nm := public._txt(p ->> 'full_name', 120);
  if p ? 'full_name' and (nm is null or char_length(nm) < 2) then raise exception 'Please enter your name'; end if;
  ph := public._txt(p ->> 'phone', 20);
  if ph is not null and ph !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)'; end if;
  update public.profiles set
    full_name = case when p ? 'full_name' then nm else full_name end,
    phone = case when p ? 'phone' then ph else phone end,
    headline = case when p ? 'headline' then public._txt(p ->> 'headline', 120) else headline end,
    bio = case when p ? 'bio' then public._txt(p ->> 'bio', 600) else bio end,
    location = case when p ? 'location' then public._txt(p ->> 'location', 80) else location end,
    user_type = case when (p ->> 'user_type') in ('reader','founder','investor','other') then p ->> 'user_type' else user_type end
  where id = uid returning * into r;
  return r;
end $$;

-------------------------------------------------------------------- companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}$'),
  status text not null default 'draft' check (status in ('draft','submitted','in_review','changes_requested','rejected','published','suspended')),
  name text check (char_length(name) <= 120), tagline text check (char_length(tagline) <= 160), description text check (char_length(description) <= 6000),
  category text check (char_length(category) <= 40), stage text check (char_length(stage) <= 40),
  founded_year int check (founded_year between 1900 and 2100),
  website text check (website is null or (website ~* '^https?://' and char_length(website) <= 300)),
  social jsonb not null default '{}'::jsonb, team jsonb not null default '[]'::jsonb,
  logo_url text check (char_length(logo_url) <= 400), cover_url text check (char_length(cover_url) <= 400),
  team_size text check (char_length(team_size) <= 30), business_model text check (char_length(business_model) <= 1500),
  division text check (char_length(division) <= 60), district text check (char_length(district) <= 60), revenue_range text check (char_length(revenue_range) <= 40),
  seeking_amount numeric check (seeking_amount is null or (seeking_amount >= 0 and seeking_amount <= 1e13)),
  equity_offered numeric check (equity_offered is null or (equity_offered >= 0 and equity_offered <= 100)),
  expected_valuation numeric check (expected_valuation is null or (expected_valuation >= 0 and expected_valuation <= 1e13)),
  use_of_funds text check (char_length(use_of_funds) <= 1500), highlights text check (char_length(highlights) <= 1500),
  vosb_valuation numeric check (vosb_valuation is null or (vosb_valuation >= 0 and vosb_valuation <= 1e13)), valuation_date date, valuation_note text check (char_length(valuation_note) <= 1000),
  verified boolean not null default false, verified_at timestamptz, featured boolean not null default false,
  rating_avg numeric(3,2) not null default 0, rating_count int not null default 0, views int not null default 0, interest_count int not null default 0,
  submitted_at timestamptz, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists companies_pub_idx on public.companies (status, featured desc, published_at desc);
drop trigger if exists trg_companies_touch on public.companies;
create trigger trg_companies_touch before update on public.companies for each row execute function public.touch_updated_at();

create table if not exists public.company_private (
  company_id uuid primary key references public.companies (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  owner_name text, owner_email text, owner_phone text,
  legal_name text check (char_length(legal_name) <= 160), reg_type text check (char_length(reg_type) <= 40), reg_no text check (char_length(reg_no) <= 60),
  tin text check (char_length(tin) <= 40), bin text check (char_length(bin) <= 40),
  contact_email text check (char_length(contact_email) <= 200), contact_phone text check (char_length(contact_phone) <= 30), address text check (char_length(address) <= 400),
  review_note text check (char_length(review_note) <= 2000), accepted_terms boolean not null default false, accepted_at timestamptz);
create index if not exists company_private_owner_idx on public.company_private (owner_id);

create table if not exists public.company_admin_notes (company_id uuid primary key references public.companies (id) on delete cascade, note text check (char_length(note) <= 4000), updated_at timestamptz not null default now());

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete cascade,
  doc_type text not null check (doc_type in ('trade_license','tin','incorporation','financials','pitch_deck','other')),
  file_path text not null check (char_length(file_path) <= 400), file_name text check (char_length(file_name) <= 200), file_size int, mime text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')), note text check (char_length(note) <= 500), created_at timestamptz not null default now());
create index if not exists company_documents_co_idx on public.company_documents (company_id);

create table if not exists public.listing_payments (
  id uuid primary key default gen_random_uuid(), invoice_no text not null unique,
  company_id uuid references public.companies (id) on delete set null, user_id uuid references auth.users (id) on delete set null, user_email text,
  method text not null default 'bkash' check (method in ('bkash','nagad','rocket','upay','cellfin','tap')),
  amount numeric not null check (amount >= 0), sender_msisdn text not null, trx_id text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')), note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(), verified_at timestamptz, verified_by text);
create unique index if not exists listing_payments_trx_uq on public.listing_payments (upper(trx_id)) where status <> 'rejected';
create unique index if not exists listing_payments_company_uq on public.listing_payments (company_id) where status in ('pending','verified');
create index if not exists listing_payments_user_idx on public.listing_payments (user_id);

create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null, author_name text not null,
  rating int not null check (rating between 1 and 5), title text check (char_length(title) <= 120), body text check (char_length(body) <= 1500),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (company_id, user_id));
create index if not exists company_reviews_co_idx on public.company_reviews (company_id, created_at desc);

create table if not exists public.company_comments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete cascade,
  parent_id uuid references public.company_comments (id) on delete cascade, user_id uuid references auth.users (id) on delete set null,
  author_name text not null, by_owner boolean not null default false, body text not null check (char_length(body) between 2 and 800),
  status text not null default 'published' check (status in ('published','hidden')), created_at timestamptz not null default now());
create index if not exists company_comments_co_idx on public.company_comments (company_id, created_at);

create table if not exists public.company_interests (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null, investor_name text, investor_email text, investor_phone text,
  investor_type text not null default 'individual' check (investor_type in ('angel','vc','individual','institution','other')),
  ticket_min numeric check (ticket_min is null or (ticket_min >= 0 and ticket_min <= 1e13)), ticket_max numeric check (ticket_max is null or (ticket_max >= 0 and ticket_max <= 1e13)),
  message text not null check (char_length(message) between 10 and 1000), share_contact boolean not null default false,
  status text not null default 'new' check (status in ('new','contacted','closed')), created_at timestamptz not null default now(), unique (company_id, user_id));

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(), user_id uuid, email text, full_name text, phone text, provider text,
  reason text not null, reason_detail text, joined_at timestamptz, deleted_at timestamptz not null default now(), snapshot jsonb);

-- rating summary kept in sync
create or replace function public.refresh_company_rating(cid uuid) returns void language sql security definer set search_path to 'public' as $$
  update public.companies c set
    rating_count = (select count(*) from public.company_reviews r where r.company_id = cid and r.status = 'published'),
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.company_reviews r where r.company_id = cid and r.status = 'published'), 0)
  where c.id = cid $$;
create or replace function public.trg_reviews_rating() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin perform public.refresh_company_rating(coalesce(new.company_id, old.company_id)); return null; end $$;
drop trigger if exists trg_reviews_rating on public.company_reviews;
create trigger trg_reviews_rating after insert or update or delete on public.company_reviews for each row execute function public.trg_reviews_rating();
revoke all on function public.refresh_company_rating(uuid), public.trg_reviews_rating() from public, anon, authenticated;

-------------------------------------------------------------------- row-level security
do $$ declare t text; begin
  foreach t in array array['companies','company_private','company_admin_notes','company_documents','listing_payments','company_reviews','company_comments','company_interests','account_deletions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

drop policy if exists "Public reads published companies" on public.companies;
create policy "Public reads published companies" on public.companies for select to anon, authenticated using (status = 'published');
drop policy if exists "Owner reads own company" on public.companies;
create policy "Owner reads own company" on public.companies for select to authenticated using (exists (select 1 from public.company_private cp where cp.company_id = companies.id and cp.owner_id = (select auth.uid())));
drop policy if exists "Admin manages companies" on public.companies;
create policy "Admin manages companies" on public.companies for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.companies to anon, authenticated;
grant insert, update, delete on public.companies to authenticated;

drop policy if exists "Owner reads private" on public.company_private;
create policy "Owner reads private" on public.company_private for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admin manages private" on public.company_private;
create policy "Admin manages private" on public.company_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.company_private to authenticated;

drop policy if exists "Admin manages notes" on public.company_admin_notes;
create policy "Admin manages notes" on public.company_admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.company_admin_notes to authenticated;

drop policy if exists "Owner reads documents" on public.company_documents;
create policy "Owner reads documents" on public.company_documents for select to authenticated using (public.is_admin() or exists (select 1 from public.company_private cp where cp.company_id = company_documents.company_id and cp.owner_id = (select auth.uid())));
drop policy if exists "Admin manages documents" on public.company_documents;
create policy "Admin manages documents" on public.company_documents for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.company_documents to authenticated;

drop policy if exists "Read own payments" on public.listing_payments;
create policy "Read own payments" on public.listing_payments for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admin manages payments" on public.listing_payments;
create policy "Admin manages payments" on public.listing_payments for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.listing_payments to authenticated;

drop policy if exists "Read own reviews" on public.company_reviews;
create policy "Read own reviews" on public.company_reviews for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admin manages reviews" on public.company_reviews;
create policy "Admin manages reviews" on public.company_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.company_reviews to authenticated;

drop policy if exists "Read own comments" on public.company_comments;
create policy "Read own comments" on public.company_comments for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admin manages comments" on public.company_comments;
create policy "Admin manages comments" on public.company_comments for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.company_comments to authenticated;

drop policy if exists "Read own interests" on public.company_interests;
create policy "Read own interests" on public.company_interests for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admin manages interests" on public.company_interests;
create policy "Admin manages interests" on public.company_interests for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.company_interests to authenticated;

drop policy if exists "Admin reads deletions" on public.account_deletions;
create policy "Admin reads deletions" on public.account_deletions for select to authenticated using (public.is_admin());
grant select on public.account_deletions to authenticated;

-------------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('company-docs', 'company-docs', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('company-logos', 'company-logos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Users upload own company docs" on storage.objects;
create policy "Users upload own company docs" on storage.objects for insert to authenticated with check (bucket_id = 'company-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users and admin read company docs" on storage.objects;
create policy "Users and admin read company docs" on storage.objects for select to authenticated using (bucket_id = 'company-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "Users delete own company docs" on storage.objects;
create policy "Users delete own company docs" on storage.objects for delete to authenticated using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users upload own company logos" on storage.objects;
create policy "Users upload own company logos" on storage.objects for insert to authenticated with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update own company logos" on storage.objects;
create policy "Users update own company logos" on storage.objects for update to authenticated using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete own company logos" on storage.objects;
create policy "Users delete own company logos" on storage.objects for delete to authenticated using (bucket_id = 'company-logos' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- an older helper any signed-in person could call: admin only now
create or replace function public.campaign_audience_count(p_audience text) returns integer language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select count(*)::int from public.subscribers s where s.status = 'active' and (p_audience = 'all' or s.lang = p_audience));
end $$;
