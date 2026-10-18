-- Voice of Startup Bangladesh — update 5: newsletter sender (campaigns).
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (char_length(subject) between 1 and 200),
  preview     text not null default '',
  audience    text not null default 'all' check (audience in ('all','bn','en')),
  body_md     text not null default '',
  body_html   text not null default '',          -- final email HTML (placeholders: {{UNSUB_URL}})
  status      text not null default 'draft' check (status in ('draft','sending','paused','sent','failed')),
  total       integer not null default 0,
  sent        integer not null default 0,
  failed      integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create table if not exists public.campaign_sends (
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  status        text not null check (status in ('sent','failed')),
  error         text,
  sent_at       timestamptz not null default now(),
  primary key (campaign_id, subscriber_id)
);
create index if not exists campaign_sends_day_idx on public.campaign_sends (sent_at) where status = 'sent';

alter table public.campaigns       enable row level security;
alter table public.campaign_sends  enable row level security;

drop policy if exists "Admin manages campaigns" on public.campaigns;
create policy "Admin manages campaigns" on public.campaigns for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin reads campaign sends" on public.campaign_sends;
create policy "Admin reads campaign sends" on public.campaign_sends for select to authenticated
  using (public.is_admin());

-- the public (anon) key must never touch these tables
revoke all on public.campaigns, public.campaign_sends from anon;

-- Next group of subscribers who have not received this campaign yet (used only by the send-newsletter function).
create or replace function public.campaign_next_batch(p_campaign uuid, p_limit integer)
returns table (id uuid, email text, token uuid, lang text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.email, s.token, s.lang
  from public.subscribers s
  join public.campaigns c on c.id = p_campaign
  where s.status = 'active'
    and (c.audience = 'all' or s.lang = c.audience)
    and not exists (select 1 from public.campaign_sends x where x.campaign_id = c.id and x.subscriber_id = s.id)
  order by s.created_at
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

-- How many people a campaign would go to / has gone to.
create or replace function public.campaign_audience_count(p_audience text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.subscribers s
  where s.status = 'active' and (p_audience = 'all' or s.lang = p_audience);
$$;

revoke all on function public.campaign_next_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.campaign_next_batch(uuid, integer) to service_role;
revoke all on function public.campaign_audience_count(text) from public, anon;
grant execute on function public.campaign_audience_count(text) to authenticated, service_role;
