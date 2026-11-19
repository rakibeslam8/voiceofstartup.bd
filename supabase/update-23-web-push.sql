-- VOSB update 23 — real Web Push (notifications that reach the phone / computer even when the site is closed)
-- Subscribers: any visitor (signed in or not) who taps "Turn on notifications". Sent by the edge function `send-push`.
-- Triggers: a new article going live, any in-app notification of a member / admin, and announcements the admin writes.
-- Safe to re-run. Nothing is deleted. The VAPID private key lives only in the database vault (never in the repo):
--   select vault.create_secret('<private key>', 'vapid_private');  select vault.create_secret('<public key>', 'vapid_public');
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_cron_secret', 'shared secret between pg_cron and the send-push edge function');
  end if;
end $$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  user_id uuid references auth.users(id) on delete set null,
  lang text not null default 'bn' check (lang in ('bn','en')),
  ua text check (char_length(ua) <= 300),
  installed boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  fail_count int not null default 0,
  disabled_at timestamptz
);
create index if not exists push_subs_user on public.push_subscriptions (user_id) where user_id is not null;
create index if not exists push_subs_live on public.push_subscriptions (id) where disabled_at is null;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('article','announce','user','test')),
  audience text not null default 'all' check (audience in ('all','members','user')),
  user_id uuid references auth.users(id) on delete cascade,
  title_bn text not null, title_en text not null, body_bn text, body_en text,
  url text not null default '/' check (url ~ '^/' and char_length(url) <= 300),
  image text,
  post_id uuid,
  created_by text,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  cursor uuid, sent_n int not null default 0, failed_n int not null default 0, total_n int,
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index if not exists push_outbox_pending on public.push_outbox (created_at) where status in ('pending','sending');
create index if not exists push_outbox_recent on public.push_outbox (created_at desc);
create index if not exists push_outbox_user on public.push_outbox (user_id) where user_id is not null;
alter table public.push_outbox enable row level security;
drop policy if exists "Admin reads push outbox" on public.push_outbox;
create policy "Admin reads push outbox" on public.push_outbox for select to authenticated using (public.is_admin());
revoke all on public.push_outbox from anon;
revoke insert, update, delete on public.push_outbox from authenticated;

-- an article is pushed once, when it first goes live
alter table public.posts add column if not exists push_sent_at timestamptz;
update public.posts set push_sent_at = now() where push_sent_at is null;   -- existing articles never push

-- ---------- visitor side ----------
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'bn', p_ua text default null, p_installed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'invalid subscription'; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id, lang, ua, installed)
  values (p_endpoint, p_p256dh, p_auth, uid, case when p_lang = 'en' then 'en' else 'bn' end, left(p_ua, 300), coalesce(p_installed, false))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = coalesce(uid, public.push_subscriptions.user_id),
    lang = excluded.lang, ua = coalesce(excluded.ua, public.push_subscriptions.ua), installed = excluded.installed or public.push_subscriptions.installed,
    last_seen_at = now(), fail_count = 0, disabled_at = null;
end $$;
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions set disabled_at = now() where endpoint = p_endpoint $$;
revoke all on function public.push_subscribe(text, text, text, text, text, boolean), public.push_unsubscribe(text) from public;
grant execute on function public.push_subscribe(text, text, text, text, text, boolean), public.push_unsubscribe(text) to anon, authenticated;

-- ---------- queue helpers ----------
create or replace function public._push_cfg() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = 'push_cfg'), '{"auto_articles": true, "auto_members": true}'::jsonb) $$;
revoke all on function public._push_cfg() from public, anon, authenticated;

-- every in-app notification of a member also goes to that member's devices (and the admin's own)
create or replace function public._notify(p_user uuid, p_admin boolean, p_kind text, p_t_en text, p_t_bn text, p_b_en text, p_b_bn text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare adm uuid;
begin
  if p_user is null and not coalesce(p_admin, false) then return; end if;
  insert into public.notifications (user_id, for_admin, kind, title_en, title_bn, body_en, body_bn, link, data)
  values (p_user, coalesce(p_admin, false), p_kind, left(p_t_en, 160), left(p_t_bn, 160), left(p_b_en, 500), left(p_b_bn, 500), left(p_link, 200), coalesce(p_data, '{}'::jsonb));
  if coalesce((public._push_cfg() ->> 'auto_members')::boolean, true) then
    if p_user is not null then
      if exists (select 1 from public.push_subscriptions where user_id = p_user and disabled_at is null) then
        insert into public.push_outbox (kind, audience, user_id, title_bn, title_en, body_bn, body_en, url)
        values ('user', 'user', p_user, coalesce(nullif(left(p_t_bn, 120), ''), left(p_t_en, 120), 'VOSB'), coalesce(nullif(left(p_t_en, 120), ''), left(p_t_bn, 120), 'VOSB'), left(p_b_bn, 180), left(p_b_en, 180), coalesce(nullif(case when p_link ~ '^/' then left(p_link, 200) end, ''), '/account'));
      end if;
    end if;
    if coalesce(p_admin, false) then
      for adm in select s.user_id from public.push_subscriptions s join auth.users u on u.id = s.user_id
                 where s.disabled_at is null and lower(u.email) = 'rakib@voiceofstartup.bd' group by s.user_id loop
        insert into public.push_outbox (kind, audience, user_id, title_bn, title_en, body_bn, body_en, url)
        values ('user', 'user', adm, coalesce(nullif(left(p_t_bn, 120), ''), left(p_t_en, 120), 'VOSB'), coalesce(nullif(left(p_t_en, 120), ''), left(p_t_bn, 120), 'VOSB'), left(p_b_bn, 180), left(p_b_en, 180), '/admin');
      end loop;
    end if;
  end if;
end $$;
revoke all on function public._notify(uuid, boolean, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- runs every minute: turns newly live articles into one push each, then wakes the sender if anything is waiting
create or replace function public.push_tick() returns void language plpgsql security definer set search_path = public as $$
declare r record; cfg jsonb := public._push_cfg(); sec text;
begin
  for r in select p.id, p.slug, p.title_bn, p.title_en, p.excerpt_bn, p.excerpt_en, p.image_url, p.publish_at from public.posts p
            where p.status = 'published' and p.publish_at <= now() and p.push_sent_at is null order by p.publish_at limit 20 loop
    update public.posts set push_sent_at = now() where id = r.id;
    if coalesce((cfg ->> 'auto_articles')::boolean, true) and r.publish_at > now() - interval '6 hours' and exists (select 1 from public.push_subscriptions where disabled_at is null) then
      insert into public.push_outbox (kind, audience, title_bn, title_en, body_bn, body_en, url, image, post_id)
      values ('article', 'all', coalesce(nullif(left(r.title_bn, 140), ''), left(r.title_en, 140)), coalesce(nullif(left(r.title_en, 140), ''), left(r.title_bn, 140)),
              nullif(left(coalesce(r.excerpt_bn, ''), 180), ''), nullif(left(coalesce(r.excerpt_en, ''), 180), ''), '/read/' || r.slug, r.image_url, r.id);
    end if;
  end loop;
  if exists (select 1 from public.push_outbox where status = 'pending' or (status = 'sending' and created_at < now() - interval '5 minutes')) then
    select decrypted_secret into sec from vault.decrypted_secrets where name = 'push_cron_secret';
    perform net.http_post(url := 'https://hpanuojuazdqolgkafqg.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec), body := '{}'::jsonb);
  end if;
end $$;
revoke all on function public.push_tick() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'vosb-push') then perform cron.schedule('vosb-push', '* * * * *', 'select public.push_tick()'); end if;
end $$;

-- the sender reads its keys through these (service role only)
create or replace function public.push_secret_ok(p text) returns boolean language sql stable security definer set search_path = public, vault as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'push_cron_secret' and decrypted_secret = p) $$;
create or replace function public.push_keys() returns jsonb language sql stable security definer set search_path = public, vault as $$
  select jsonb_build_object('public', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public'),
                            'private', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private')) $$;
revoke all on function public.push_secret_ok(text), public.push_keys() from public, anon, authenticated;
grant execute on function public.push_secret_ok(text), public.push_keys() to service_role;

-- ---------- admin ----------
create or replace function public.admin_push_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'active', (select count(*) from public.push_subscriptions where disabled_at is null),
    'members', (select count(*) from public.push_subscriptions where disabled_at is null and user_id is not null),
    'visitors', (select count(*) from public.push_subscriptions where disabled_at is null and user_id is null),
    'bn', (select count(*) from public.push_subscriptions where disabled_at is null and lang = 'bn'),
    'en', (select count(*) from public.push_subscriptions where disabled_at is null and lang = 'en'),
    'installed', (select count(*) from public.push_subscriptions where disabled_at is null and installed),
    'new_7d', (select count(*) from public.push_subscriptions where created_at > now() - interval '7 days' and disabled_at is null),
    'lost', (select count(*) from public.push_subscriptions where disabled_at is not null),
    'cfg', public._push_cfg(),
    'mine', (select count(*) from public.push_subscriptions s join auth.users u on u.id = s.user_id where s.disabled_at is null and lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
end $$;
create or replace function public.admin_push_send(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid; aud text := coalesce(p ->> 'audience', 'all'); kd text := case when (p ->> 'test') = 'true' then 'test' else 'announce' end;
        tbn text := btrim(coalesce(p ->> 'title_bn', ''));
        ten text := btrim(coalesce(p ->> 'title_en', ''));
        lnk text := coalesce(nullif(btrim(p ->> 'url'), ''), '/');
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if tbn = '' and ten = '' then raise exception 'Write a title'; end if;
  if tbn = '' then tbn := ten; end if;
  if ten = '' then ten := tbn; end if;
  if lnk !~ '^/' then raise exception 'The link must start with / (for example /news)'; end if;
  if kd = 'test' then
    insert into public.push_outbox (kind, audience, user_id, title_bn, title_en, body_bn, body_en, url, created_by)
    values ('test', 'user', auth.uid(), left(tbn, 120), left(ten, 120), nullif(left(p ->> 'body_bn', 180), ''), nullif(left(p ->> 'body_en', 180), ''), left(lnk, 300), auth.jwt() ->> 'email') returning push_outbox.id into nid;
  else
    if aud not in ('all','members') then aud := 'all'; end if;
    insert into public.push_outbox (kind, audience, title_bn, title_en, body_bn, body_en, url, created_by)
    values ('announce', aud, left(tbn, 120), left(ten, 120), nullif(left(p ->> 'body_bn', 180), ''), nullif(left(p ->> 'body_en', 180), ''), left(lnk, 300), auth.jwt() ->> 'email') returning push_outbox.id into nid;
  end if;
  perform public.push_tick();
  return nid;
end $$;
create or replace function public.admin_push_set(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := public._push_cfg();
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  c := c || jsonb_build_object('auto_articles', coalesce((p ->> 'auto_articles')::boolean, (c ->> 'auto_articles')::boolean, true), 'auto_members', coalesce((p ->> 'auto_members')::boolean, (c ->> 'auto_members')::boolean, true));
  insert into public.site_settings (key, value) values ('push_cfg', c) on conflict (key) do update set value = excluded.value;
  return c;
end $$;
revoke all on function public.admin_push_stats(), public.admin_push_send(jsonb), public.admin_push_set(jsonb) from public, anon;
grant execute on function public.admin_push_stats(), public.admin_push_send(jsonb), public.admin_push_set(jsonb) to authenticated;
