-- Voice of Startup Bangladesh — update 21: revenue by source (every PR service counts automatically) + ads / admin charges ledger + net.
-- Safe to run more than once. Nothing is hard-deleted (charges are soft-deleted).

create table if not exists public.admin_charges (
  id uuid primary key default gen_random_uuid(),
  day date not null default ((now() at time zone 'Asia/Dhaka')::date),
  kind text not null default 'ads' check (kind in ('ads','admin','other')),
  amount numeric not null check (amount > 0 and amount < 1000000000),
  note text check (char_length(note) <= 300),
  created_by text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists admin_charges_day on public.admin_charges (day) where deleted_at is null;
alter table public.admin_charges enable row level security;
drop policy if exists "Admin manages charges" on public.admin_charges;
create policy "Admin manages charges" on public.admin_charges for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_charges from anon;

create or replace function public.admin_overview_totals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare base jsonb := public._admin_overview_totals_base(); today date := (now() at time zone 'Asia/Dhaka')::date; rv jsonb; prv jsonb; byc jsonb; ch jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  rv := coalesce(base -> 'revenue', '{}'::jsonb);
  prv := jsonb_build_object(
    'pr_verified', coalesce((select sum(amount) from public.pr_orders where pay_status = 'verified' and kind <> 'free' and deleted_at is null), 0),
    'pr_verified_n', (select count(*) from public.pr_orders where pay_status = 'verified' and amount > 0 and deleted_at is null),
    'pr_pending', coalesce((select sum(amount) from public.pr_orders where pay_status = 'pending' and deleted_at is null), 0),
    'pr_pending_n', (select count(*) from public.pr_orders where pay_status = 'pending' and deleted_at is null),
    'pr_today', coalesce((select sum(amount) from public.pr_orders where pay_status = 'verified' and kind <> 'free' and deleted_at is null and (paid_at at time zone 'Asia/Dhaka')::date = today), 0),
    'pr_30d', coalesce((select sum(amount) from public.pr_orders where pay_status = 'verified' and kind <> 'free' and deleted_at is null and paid_at > now() - interval '30 days'), 0));
  -- every PR service (also ones added later) is grouped here by its key
  select coalesce(jsonb_agg(jsonb_build_object('key', k, 'name', nm, 'amount', amt, 'n', n) order by amt desc), '[]'::jsonb) into byc
    from (select service_key k, max(service_name_en) nm, sum(amount) amt, count(*) n from public.pr_orders where pay_status = 'verified' and kind <> 'free' and amount > 0 and deleted_at is null group by service_key) x;
  ch := jsonb_build_object(
    'charges_total', coalesce((select sum(amount) from public.admin_charges where deleted_at is null), 0),
    'charges_30d', coalesce((select sum(amount) from public.admin_charges where deleted_at is null and day > today - 30), 0),
    'charges_today', coalesce((select sum(amount) from public.admin_charges where deleted_at is null and day = today), 0),
    'charges_ads', coalesce((select sum(amount) from public.admin_charges where deleted_at is null and kind = 'ads'), 0),
    'charges_admin', coalesce((select sum(amount) from public.admin_charges where deleted_at is null and kind = 'admin'), 0));
  rv := rv || prv || ch || jsonb_build_object(
    'by_service', byc,
    'total_verified', coalesce((rv ->> 'listing_verified')::numeric, 0) + (prv ->> 'pr_verified')::numeric,
    'total_30d', coalesce((rv ->> 'listing_30d')::numeric, 0) + (prv ->> 'pr_30d')::numeric,
    'total_today', coalesce((rv ->> 'listing_today')::numeric, 0) + (prv ->> 'pr_today')::numeric,
    'total_pending', coalesce((rv ->> 'listing_pending')::numeric, 0) + (prv ->> 'pr_pending')::numeric);
  rv := rv || jsonb_build_object('net_verified', (rv ->> 'total_verified')::numeric - (ch ->> 'charges_total')::numeric, 'net_30d', (rv ->> 'total_30d')::numeric - (ch ->> 'charges_30d')::numeric);
  return base || jsonb_build_object('revenue', rv);
end $$;
revoke all on function public.admin_overview_totals() from public, anon;
grant execute on function public.admin_overview_totals() to authenticated;

-- advisor: cover the new foreign keys
create index if not exists pr_blackouts_group on public.pr_blackouts (slot_group);
create index if not exists pr_services_group on public.pr_services (slot_group);
