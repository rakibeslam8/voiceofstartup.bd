-- =====================================================================
--  Voice of Startup Bangladesh — update 3: newsletter subscribers
--  Safe to run more than once. (Also appended to setup.sql.)
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
