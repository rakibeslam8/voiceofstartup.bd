-- Update 10 - security hardening (already applied to the live project as migration
-- "security_hardening_rate_limits_and_grants" + a follow-up that added created_at / self-cleaning).
-- Safe to re-run. It changes NO site data.
--
-- 1. Per-IP rate limiter (rl_hit) used by every public write function -> floods are ignored.
-- 2. Public write functions validate their input (path/visitor/session formats, device, lang).
-- 3. Admin-only functions are no longer callable without signing in.
-- 4. is_admin() = the owner's exact account id AND e-mail.
-- 5. Least-privilege table grants (no TRUNCATE/TRIGGER/REFERENCES, no anon writes to posts/ads).

create table if not exists public.rate_limits (
  k text not null, bucket bigint not null, n integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (k, bucket)
);
create index if not exists rate_limits_created_idx on public.rate_limits (created_at);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rl_hit(p_scope text, p_limit integer, p_secs integer)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare h jsonb; ip text; c integer; b bigint;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  ip := coalesce(nullif(h->>'cf-connecting-ip',''), nullif(h->>'x-real-ip',''),
                 nullif(btrim(split_part(coalesce(h->>'x-forwarded-for',''), ',', 1)),''), 'unknown');
  b := floor(extract(epoch from now()) / greatest(p_secs, 1))::bigint;
  insert into public.rate_limits as r (k, bucket, n) values (p_scope || ':' || md5(ip), b, 1)
  on conflict (k, bucket) do update set n = r.n + 1 returning r.n into c;
  if random() < 0.01 then delete from public.rate_limits where created_at < now() - interval '1 day'; end if;
  return c <= p_limit;
end; $$;
revoke all on function public.rl_hit(text, integer, integer) from public, anon, authenticated;

-- The public functions (track_visit_k, track_visit, increment_view_k, increment_view, increment_share,
-- ad_click, ad_impression, track_app_event, subscribe_newsletter) each start with
--     if not public.rl_hit('<scope>', <limit>, <seconds>) then return; end if;
-- limits per IP: visits 240/min, views 240/min, shares 120/min, ad clicks 60/min, ad impressions 600/min,
-- app events 60/min, newsletter 5 per 10 min.  See the live definitions in Supabase -> Database -> Functions.

revoke execute on function public.admin_app_stats() from public, anon;
revoke execute on function public.admin_set_visitor_kind(text, text) from public, anon;
revoke execute on function public.admin_site_kinds(date, date) from public, anon;
revoke execute on function public.admin_top_visitors(date, date, integer) from public, anon;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public', 'auth' as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'rakib@voiceofstartup.bd'
     and coalesce(auth.jwt() ->> 'sub', '') = 'c9c7d62e-08ee-4b0b-a3d8-572b7ac66d38';
$$;

revoke truncate, trigger, references on public.ads, public.app_events, public.posts, public.campaigns, public.campaign_sends from anon, authenticated;
revoke insert, update, delete on public.ads from anon;
revoke insert, update, delete on public.posts from anon;
revoke all on public.app_events from anon, authenticated;
alter function public.vosb_card_excerpt(text, integer) set search_path = public;
