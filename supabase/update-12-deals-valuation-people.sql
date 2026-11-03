-- VOSB update 12 — applied to the live database on 2026-11-03.
-- Instant payment + unregistered brands, valuation engine, investor deals + notifications,
-- article comments/likes, profile photos, admin people tools, custom fields.
-- Additive only (no data deleted). Run the parts in order; every part is safe to re-run.

-- ======== part 12a ========
alter table public.companies add column if not exists registered boolean not null default true;
alter table public.companies add column if not exists invest_open boolean not null default true;
alter table public.companies add column if not exists raised_amount numeric not null default 0;
alter table public.companies add column if not exists investor_count integer not null default 0;
alter table public.companies add column if not exists vosb_val_low numeric;
alter table public.companies add column if not exists vosb_val_high numeric;
alter table public.companies add column if not exists vosb_confidence integer;

alter table public.company_documents drop constraint if exists company_documents_doc_type_check;
alter table public.company_documents add constraint company_documents_doc_type_check check (doc_type = any (array[
  'trade_license','tin','incorporation','financials','pitch_deck','other','founder_id','business_plan','bank_statement','sales_proof']));

create table if not exists public.admin_meta (
  scope text not null check (scope in ('user','company')),
  ref_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  note text,
  updated_at timestamptz not null default now(),
  primary key (scope, ref_id)
);
alter table public.admin_meta enable row level security;
drop policy if exists "Admin manages meta" on public.admin_meta;
create policy "Admin manages meta" on public.admin_meta for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.admin_field_defs (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user','company')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label_en text not null check (char_length(label_en) between 1 and 60),
  label_bn text,
  kind text not null default 'text' check (kind in ('text','number','select','date','bool')),
  options jsonb not null default '[]'::jsonb,
  sort int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (scope, key)
);
alter table public.admin_field_defs enable row level security;
drop policy if exists "Admin manages field defs" on public.admin_field_defs;
create policy "Admin manages field defs" on public.admin_field_defs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  for_admin boolean not null default false,
  kind text not null,
  title_en text, title_bn text, body_en text, body_bn text,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or for_admin)
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_admin_idx on public.notifications (created_at desc) where for_admin;
alter table public.notifications enable row level security;
drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (for_admin and public.is_admin()));

create or replace function public._notify(p_user uuid, p_admin boolean, p_kind text, p_t_en text, p_t_bn text, p_b_en text, p_b_bn text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null and not coalesce(p_admin, false) then return; end if;
  insert into public.notifications (user_id, for_admin, kind, title_en, title_bn, body_en, body_bn, link, data)
  values (p_user, coalesce(p_admin, false), p_kind, left(p_t_en, 160), left(p_t_bn, 160), left(p_b_en, 500), left(p_b_bn, 500), left(p_link, 200), coalesce(p_data, '{}'::jsonb));
end $$;
revoke all on function public._notify(uuid, boolean, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.my_notifications(p_limit int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); adm boolean := public.is_admin();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.read_at is null and (n.user_id = uid or (adm and n.for_admin))),
    'items', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select n.id, n.kind, n.title_en, n.title_bn, n.body_en, n.body_bn, n.link, n.data, n.read_at, n.created_at, n.for_admin
      from public.notifications n where n.user_id = uid or (adm and n.for_admin)
      order by n.created_at desc limit least(greatest(p_limit, 1), 100)) x), '[]'::jsonb));
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); adm boolean := public.is_admin();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  update public.notifications set read_at = now()
  where read_at is null and (user_id = uid or (adm and for_admin)) and (p_ids is null or id = any(p_ids));
end $$;

revoke execute on function public.my_notifications(int), public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.my_notifications(int), public.mark_notifications_read(uuid[]) to authenticated;

-- ======== part 12b-1 ========
create table if not exists public.company_financials (
  company_id uuid primary key references public.companies(id) on delete cascade,
  annual_revenue numeric, monthly_revenue numeric, growth_mom numeric, gross_margin numeric,
  annual_net_profit numeric, monthly_burn numeric, cash_in_bank numeric, debt numeric,
  assets_value numeric, ip_value numeric, customers integer, paying_customers integer, team_ft integer,
  total_raised numeric, market_size numeric, traction text, owner_note text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.company_financials enable row level security;
drop policy if exists "Owner or admin reads financials" on public.company_financials;
create policy "Owner or admin reads financials" on public.company_financials for select to authenticated
  using (public.is_admin() or exists (select 1 from public.company_private cp where cp.company_id = company_financials.company_id and cp.owner_id = (select auth.uid())));
drop policy if exists "Admin manages financials" on public.company_financials;
create policy "Admin manages financials" on public.company_financials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.company_valuations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  version int not null default 1,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  source text not null default 'application' check (source in ('application','update_request','admin')),
  low numeric, mid numeric, high numeric, confidence int,
  result jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  expected_by_owner numeric,
  reason text, requested_by uuid, note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz, decided_by text
);
create index if not exists company_valuations_company_idx on public.company_valuations (company_id, created_at desc);
create index if not exists company_valuations_status_idx on public.company_valuations (status) where status = 'pending';
alter table public.company_valuations enable row level security;
drop policy if exists "Owner or admin reads valuations" on public.company_valuations;
create policy "Owner or admin reads valuations" on public.company_valuations for select to authenticated
  using (public.is_admin() or exists (select 1 from public.company_private cp where cp.company_id = company_valuations.company_id and cp.owner_id = (select auth.uid())));
drop policy if exists "Admin manages valuations" on public.company_valuations;
create policy "Admin manages valuations" on public.company_valuations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.company_investments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  interest_id uuid references public.company_interests(id) on delete set null,
  investor_id uuid not null references auth.users(id) on delete cascade,
  investor_name text, amount numeric not null check (amount > 0 and amount <= 1e13),
  equity_pct numeric check (equity_pct is null or (equity_pct > 0 and equity_pct <= 100)),
  invested_on date not null default current_date,
  recorded_by text not null check (recorded_by in ('investor','owner','admin')),
  investor_confirmed_at timestamptz, owner_confirmed_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed','confirmed','verified','cancelled')),
  verified_at timestamptz, note text,
  created_at timestamptz not null default now()
);
create index if not exists company_investments_company_idx on public.company_investments (company_id);
create index if not exists company_investments_investor_idx on public.company_investments (investor_id);
alter table public.company_investments enable row level security;
drop policy if exists "Parties and admin read investments" on public.company_investments;
create policy "Parties and admin read investments" on public.company_investments for select to authenticated
  using (public.is_admin() or investor_id = (select auth.uid()) or exists (select 1 from public.company_private cp where cp.company_id = company_investments.company_id and cp.owner_id = (select auth.uid())));
drop policy if exists "Admin manages investments" on public.company_investments;
create policy "Admin manages investments" on public.company_investments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ======== part 12b-2 ========
create or replace function public._calc_valuation(p_company uuid, f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.companies; cp public.company_private;
  cat text; lo numeric; hi numeric;
  rev numeric; g numeric; gg numeric; mult numeric; gm numeric; mf numeric;
  m_rev numeric := 0; m_earn numeric; m_ber numeric; m_floor numeric;
  profit numeric; burn numeric; cash numeric; runway numeric;
  s_idea numeric; s_prod numeric; s_team numeric; s_strat numeric; s_roll numeric;
  docs_ok int; docs_pend int; filled int := 0; k text;
  w_rev numeric; w_earn numeric; w_ber numeric; wsum numeric; base numeric; adj numeric := 1; adjs jsonb := '[]'::jsonb;
  mid numeric; conf int; w numeric; flags jsonb := '[]'::jsonb; ex numeric; ratio numeric; dlom numeric := 0.85; reg boolean; teamn int; ptc int;
begin
  select * into c from public.companies where id = p_company;
  select * into cp from public.company_private where company_id = p_company;
  if c.id is null then raise exception 'Company not found'; end if;
  reg := cp.reg_type is distinct from 'not_registered';
  cat := coalesce(c.category, 'other');
  select (case cat when 'fintech' then 3.0 when 'saas' then 3.5 when 'ai' then 3.5 when 'ecommerce' then 0.6 when 'edtech' then 1.5 when 'healthtech' then 1.5
    when 'agritech' then 0.8 when 'logistics' then 0.6 when 'food' then 0.6 when 'fashion' then 0.6 when 'manufacturing' then 0.5 when 'energy' then 1.0
    when 'realestate' then 0.8 when 'media' then 1.0 when 'travel' then 0.7 when 'services' then 0.7 else 0.8 end),
    (case cat when 'fintech' then 6.0 when 'saas' then 7.0 when 'ai' then 7.0 when 'ecommerce' then 1.4 when 'edtech' then 3.5 when 'healthtech' then 3.5
    when 'agritech' then 2.0 when 'logistics' then 1.5 when 'food' then 1.5 when 'fashion' then 1.4 when 'manufacturing' then 1.2 when 'energy' then 2.5
    when 'realestate' then 1.8 when 'media' then 2.5 when 'travel' then 1.6 when 'services' then 1.5 else 2.0 end) into lo, hi;

  foreach k in array array['annual_revenue','growth_mom','gross_margin','monthly_burn','cash_in_bank','customers','team_ft','annual_net_profit'] loop
    if public._num(f ->> k) is not null then filled := filled + 1; end if;
  end loop;

  rev := coalesce(public._num(f ->> 'annual_revenue'), coalesce(public._num(f ->> 'monthly_revenue'), 0) * 12, 0);
  g := greatest(-20, least(30, coalesce(public._num(f ->> 'growth_mom'), 0)));
  gg := greatest(-0.5, least(3, power(1 + g / 100, 12) - 1));
  mult := case when gg < 0 then lo * 0.7 else lo + (hi - lo) * least(1, gg / 2) end;
  gm := greatest(0, least(100, coalesce(public._num(f ->> 'gross_margin'), 40)));
  mf := 0.7 + 0.6 * gm / 100;
  m_rev := rev * mult * mf;
  profit := coalesce(public._num(f ->> 'annual_net_profit'), 0);
  m_earn := case when profit > 0 then profit * (case when c.stage in ('established','scale') then 6 else 5 end) end;
  burn := coalesce(public._num(f ->> 'monthly_burn'), 0);
  cash := coalesce(public._num(f ->> 'cash_in_bank'), 0);
  runway := case when burn > 0 then cash / burn end;

  select count(*) filter (where status = 'accepted'), count(*) filter (where status = 'pending') into docs_ok, docs_pend from public.company_documents where company_id = p_company;
  teamn := coalesce(jsonb_array_length(case when jsonb_typeof(c.team) = 'array' then c.team else '[]'::jsonb end), 0);
  ptc := coalesce(public._num(f ->> 'paying_customers'), public._num(f ->> 'customers'), 0)::int;
  s_idea := case when char_length(coalesce(c.description, '')) + char_length(coalesce(c.business_model, '')) >= 400 then 1 when char_length(coalesce(c.description, '')) >= 150 then 0.7 else 0.4 end;
  s_prod := case c.stage when 'idea' then 0.2 when 'prototype' then 0.6 when 'early_revenue' then 0.8 else 1 end;
  s_team := least(1, coalesce(public._num(f ->> 'team_ft'), 0) / 6 * 0.6 + least(teamn, 4) / 4.0 * 0.4);
  s_strat := (case when reg then 0.3 else 0 end) + 0.7 * least(1, (docs_ok + docs_pend * 0.5) / 4.0);
  s_roll := case when ptc >= 100 then 1 when ptc >= 20 then 0.7 when ptc >= 1 then 0.4 else 0 end;
  m_ber := (s_idea + s_prod + s_team + s_strat + s_roll) * 5000000;
  m_floor := greatest(0, cash + coalesce(public._num(f ->> 'assets_value'), 0) + coalesce(public._num(f ->> 'ip_value'), 0) - coalesce(public._num(f ->> 'debt'), 0));

  if rev > 0 then w_rev := 0.6; w_earn := case when m_earn is not null then 0.25 else 0 end; w_ber := 0.15;
  else w_rev := 0; w_earn := 0; w_ber := 1; end if;
  wsum := w_rev + w_earn + w_ber;
  base := (w_rev * m_rev + w_earn * coalesce(m_earn, 0) + w_ber * m_ber) / wsum;

  if runway is not null and runway < 3 then adj := adj * 0.85; adjs := adjs || jsonb_build_object('k', 'runway_lt_3m', 'f', 0.85);
  elsif runway is not null and runway < 6 then adj := adj * 0.93; adjs := adjs || jsonb_build_object('k', 'runway_lt_6m', 'f', 0.93); end if;
  if burn > 0 and rev > 0 and burn * 12 > rev * 1.5 then adj := adj * 0.92; adjs := adjs || jsonb_build_object('k', 'burn_exceeds_revenue', 'f', 0.92); end if;
  if not reg then adj := adj * 0.8; adjs := adjs || jsonb_build_object('k', 'not_registered', 'f', 0.8); end if;
  if docs_ok + docs_pend = 0 then adj := adj * 0.9; adjs := adjs || jsonb_build_object('k', 'no_documents', 'f', 0.9); end if;
  adjs := adjs || jsonb_build_object('k', 'private_company_discount', 'f', dlom);

  mid := greatest(base * adj * dlom, m_floor);
  conf := least(95, 30 + filled * 4 + least(24, docs_ok * 8 + docs_pend * 3) + (case when reg then 8 else 0 end));
  w := 0.45 - conf / 100.0 * 0.30;

  if filled < 3 then flags := flags || to_jsonb('thin_financials'::text); end if;
  if runway is not null and runway < 3 then flags := flags || to_jsonb('runway_short'::text); end if;
  if not reg then flags := flags || to_jsonb('not_registered'::text); end if;
  if docs_ok + docs_pend = 0 then flags := flags || to_jsonb('no_documents'::text); end if;
  if docs_ok = 0 and docs_pend > 0 then flags := flags || to_jsonb('documents_unverified'::text); end if;
  if burn > 0 and rev > 0 and burn * 12 > rev * 1.5 then flags := flags || to_jsonb('burn_exceeds_revenue'::text); end if;
  ex := coalesce(c.expected_valuation, 0);
  if ex > 0 and mid > 0 then
    ratio := ex / mid;
    if ratio > 1.5 then flags := flags || to_jsonb('expectation_high'::text);
    elsif ratio < 0.6 then flags := flags || to_jsonb('expectation_low'::text);
    else flags := flags || to_jsonb('expectation_reasonable'::text); end if;
  end if;

  return jsonb_build_object(
    'low', round(mid * (1 - w) / 10000) * 10000, 'mid', round(mid / 10000) * 10000, 'high', round(mid * (1 + w) / 10000) * 10000,
    'confidence', conf, 'flags', flags, 'adjustments', adjs, 'expected_ratio', ratio,
    'methods', jsonb_build_object(
      'revenue', jsonb_build_object('value', round(m_rev), 'multiple', round(mult, 2), 'margin_factor', round(mf, 2), 'weight', w_rev / wsum),
      'earnings', jsonb_build_object('value', round(coalesce(m_earn, 0)), 'weight', w_earn / wsum),
      'scorecard', jsonb_build_object('value', round(m_ber), 'weight', w_ber / wsum, 'parts', jsonb_build_object('idea', s_idea, 'product', s_prod, 'team', round(s_team, 2), 'strategic', round(s_strat, 2), 'rollout', s_roll)),
      'floor', jsonb_build_object('value', round(m_floor)),
      'runway_months', round(runway, 1)));
end $$;
revoke all on function public._calc_valuation(uuid, jsonb) from public, anon, authenticated;

create or replace function public._store_valuation(p_company uuid, f jsonb, p_source text, p_reason text, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r jsonb; vid uuid; v int;
begin
  r := public._calc_valuation(p_company, f);
  select coalesce(max(version), 0) + 1 into v from public.company_valuations where company_id = p_company;
  update public.company_valuations set status = 'superseded', decided_at = now(), decided_by = 'system' where company_id = p_company and status = 'pending' and source = p_source;
  insert into public.company_valuations (company_id, version, status, source, low, mid, high, confidence, result, inputs, expected_by_owner, reason, requested_by)
  values (p_company, v, 'pending', p_source, (r ->> 'low')::numeric, (r ->> 'mid')::numeric, (r ->> 'high')::numeric, (r ->> 'confidence')::int, r, coalesce(f, '{}'::jsonb),
          (select expected_valuation from public.companies where id = p_company), public._txt(p_reason, 800), p_by) returning id into vid;
  return vid;
end $$;
revoke all on function public._store_valuation(uuid, jsonb, text, text, uuid) from public, anon, authenticated;

-- ======== part 12b-3 ========
create or replace function public.save_company_financials(p_company uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st text; owner_ uuid;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Bad request'; end if;
  if not public.rl_user('co_fin', 60, 600) then raise exception 'Too many requests, please try again in a few minutes' using errcode = '54000'; end if;
  select c.status, cp.owner_id into st, owner_ from public.companies c join public.company_private cp on cp.company_id = c.id where c.id = p_company;
  if owner_ is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if st not in ('draft', 'changes_requested') then raise exception 'Financial details can only be edited before submitting, or when changes are requested'; end if;
  insert into public.company_financials (company_id) values (p_company) on conflict do nothing;
  update public.company_financials set
    annual_revenue = case when p ? 'annual_revenue' then greatest(0, least(public._num(p ->> 'annual_revenue'), 1e13)) else annual_revenue end,
    monthly_revenue = case when p ? 'monthly_revenue' then greatest(0, least(public._num(p ->> 'monthly_revenue'), 1e12)) else monthly_revenue end,
    growth_mom = case when p ? 'growth_mom' then greatest(-100, least(public._num(p ->> 'growth_mom'), 1000)) else growth_mom end,
    gross_margin = case when p ? 'gross_margin' then greatest(-100, least(public._num(p ->> 'gross_margin'), 100)) else gross_margin end,
    annual_net_profit = case when p ? 'annual_net_profit' then greatest(-1e13, least(public._num(p ->> 'annual_net_profit'), 1e13)) else annual_net_profit end,
    monthly_burn = case when p ? 'monthly_burn' then greatest(0, least(public._num(p ->> 'monthly_burn'), 1e12)) else monthly_burn end,
    cash_in_bank = case when p ? 'cash_in_bank' then greatest(0, least(public._num(p ->> 'cash_in_bank'), 1e13)) else cash_in_bank end,
    debt = case when p ? 'debt' then greatest(0, least(public._num(p ->> 'debt'), 1e13)) else debt end,
    assets_value = case when p ? 'assets_value' then greatest(0, least(public._num(p ->> 'assets_value'), 1e13)) else assets_value end,
    ip_value = case when p ? 'ip_value' then greatest(0, least(public._num(p ->> 'ip_value'), 1e13)) else ip_value end,
    customers = case when p ? 'customers' then greatest(0, least(public._num(p ->> 'customers'), 1e9))::int else customers end,
    paying_customers = case when p ? 'paying_customers' then greatest(0, least(public._num(p ->> 'paying_customers'), 1e9))::int else paying_customers end,
    team_ft = case when p ? 'team_ft' then greatest(0, least(public._num(p ->> 'team_ft'), 100000))::int else team_ft end,
    total_raised = case when p ? 'total_raised' then greatest(0, least(public._num(p ->> 'total_raised'), 1e13)) else total_raised end,
    market_size = case when p ? 'market_size' then greatest(0, least(public._num(p ->> 'market_size'), 1e15)) else market_size end,
    traction = case when p ? 'traction' then public._txt(p ->> 'traction', 1500) else traction end,
    owner_note = case when p ? 'owner_note' then public._txt(p ->> 'owner_note', 1500) else owner_note end,
    updated_at = now()
  where company_id = p_company;
end $$;

create or replace function public.admin_recompute_valuation(p_company uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare f jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select to_jsonb(x) - 'company_id' - 'updated_at' into f from public.company_financials x where company_id = p_company;
  return public._store_valuation(p_company, coalesce(f, '{}'::jsonb), 'admin', 'Recomputed by admin', null);
end $$;

create or replace function public.admin_decide_valuation(p_id uuid, p_approve boolean, p_mid numeric default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.company_valuations; own uuid; lo numeric; mi numeric; hi numeric; nt text := public._txt(p_note, 800); c public.companies;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from public.company_valuations where id = p_id;
  if v.id is null then raise exception 'Valuation not found'; end if;
  if v.status <> 'pending' then raise exception 'This valuation was already decided'; end if;
  select owner_id into own from public.company_private where company_id = v.company_id;
  select * into c from public.companies where id = v.company_id;
  if not p_approve then
    if nt is null then raise exception 'Please write a note for the owner'; end if;
    update public.company_valuations set status = 'rejected', note = nt, decided_at = now(), decided_by = lower(auth.jwt() ->> 'email') where id = p_id;
    perform public._notify(own, false, 'valuation_rejected', 'Valuation not approved', 'ভ্যালুয়েশন অনুমোদিত হয়নি', nt, nt, '/account', jsonb_build_object('company', v.company_id));
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;
  mi := coalesce(p_mid, v.mid);
  if mi is null or mi <= 0 then raise exception 'Invalid valuation'; end if;
  lo := round(case when v.mid > 0 then v.low * mi / v.mid else mi * 0.8 end / 10000) * 10000;
  hi := round(case when v.mid > 0 then v.high * mi / v.mid else mi * 1.2 end / 10000) * 10000;
  update public.company_valuations set status = 'superseded', decided_at = now(), decided_by = 'system' where company_id = v.company_id and status = 'approved';
  update public.company_valuations set status = 'approved', low = lo, mid = mi, high = hi, note = coalesce(nt, note), decided_at = now(), decided_by = lower(auth.jwt() ->> 'email') where id = p_id;
  if v.source = 'update_request' and jsonb_typeof(v.inputs) = 'object' then
    insert into public.company_financials (company_id) values (v.company_id) on conflict do nothing;
    update public.company_financials set
      annual_revenue = coalesce(public._num(v.inputs ->> 'annual_revenue'), annual_revenue), monthly_revenue = coalesce(public._num(v.inputs ->> 'monthly_revenue'), monthly_revenue),
      growth_mom = coalesce(public._num(v.inputs ->> 'growth_mom'), growth_mom), gross_margin = coalesce(public._num(v.inputs ->> 'gross_margin'), gross_margin),
      annual_net_profit = coalesce(public._num(v.inputs ->> 'annual_net_profit'), annual_net_profit), monthly_burn = coalesce(public._num(v.inputs ->> 'monthly_burn'), monthly_burn),
      cash_in_bank = coalesce(public._num(v.inputs ->> 'cash_in_bank'), cash_in_bank), debt = coalesce(public._num(v.inputs ->> 'debt'), debt),
      customers = coalesce(public._num(v.inputs ->> 'customers'), customers)::int, paying_customers = coalesce(public._num(v.inputs ->> 'paying_customers'), paying_customers)::int,
      team_ft = coalesce(public._num(v.inputs ->> 'team_ft'), team_ft)::int, total_raised = coalesce(public._num(v.inputs ->> 'total_raised'), total_raised), updated_at = now()
    where company_id = v.company_id;
  end if;
  update public.companies set vosb_valuation = mi, vosb_val_low = lo, vosb_val_high = hi, vosb_confidence = v.confidence, valuation_date = current_date,
    valuation_note = coalesce(nt, valuation_note) where id = v.company_id;
  perform public._notify(own, false, 'valuation_approved', 'Your valuation is approved', 'আপনার ভ্যালুয়েশন অনুমোদিত হয়েছে',
    'The VOSB valuation range is now shown on ' || coalesce(c.name, 'your company') || '.', coalesce(c.name, 'আপনার কোম্পানি') || '-এ VOSB ভ্যালুয়েশন রেঞ্জ এখন দেখানো হচ্ছে।', '/account', jsonb_build_object('company', v.company_id));
  return jsonb_build_object('ok', true, 'status', 'approved', 'low', lo, 'mid', mi, 'high', hi);
end $$;

create or replace function public.my_valuations(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not (public.is_admin() or exists (select 1 from public.company_private where company_id = p_company and owner_id = auth.uid())) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'financials', (select to_jsonb(f) from public.company_financials f where f.company_id = p_company),
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select v.id, v.version, v.status, v.source, v.low, v.mid, v.high, v.confidence, v.result, v.expected_by_owner, v.reason, v.note, v.created_at, v.decided_at from public.company_valuations v where v.company_id = p_company order by v.created_at desc limit 20) x), '[]'::jsonb));
end $$;

revoke execute on function public.save_company_financials(uuid, jsonb), public.admin_recompute_valuation(uuid), public.admin_decide_valuation(uuid, boolean, numeric, text), public.my_valuations(uuid) from public, anon;
grant execute on function public.save_company_financials(uuid, jsonb), public.admin_recompute_valuation(uuid), public.admin_decide_valuation(uuid, boolean, numeric, text), public.my_valuations(uuid) to authenticated;

select public._calc_valuation(id, '{"annual_revenue":6000000,"growth_mom":8,"gross_margin":55,"monthly_burn":300000,"cash_in_bank":1200000,"customers":120,"paying_customers":80,"team_ft":6,"annual_net_profit":-500000}'::jsonb) r from public.companies limit 1;

-- ======== part 12c-1 ========
-- 12c-1: instant payment, unregistered brands, publish guard, invest toggle, interest notifications
create or replace function public.submit_company_application(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.companies; cp public.company_private; miss text[] := '{}'::text[]; unreg boolean; f jsonb;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('submit', 20, 3600) then raise exception 'Too many attempts' using errcode = '54000'; end if;
  select * into c from public.companies where id = p_id;
  select * into cp from public.company_private where company_id = p_id;
  if c.id is null or cp.owner_id is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if c.status not in ('draft', 'changes_requested') then raise exception 'This application was already submitted'; end if;
  unreg := cp.reg_type = 'not_registered';
  if c.name is null then miss := array_append(miss, 'name'); end if;
  if c.tagline is null then miss := array_append(miss, 'tagline'); end if;
  if c.description is null or char_length(c.description) < 80 then miss := array_append(miss, 'description'); end if;
  if c.category is null then miss := array_append(miss, 'category'); end if;
  if c.stage is null then miss := array_append(miss, 'stage'); end if;
  if c.division is null then miss := array_append(miss, 'division'); end if;
  if cp.reg_type is null then miss := array_append(miss, 'reg_type'); end if;
  if cp.legal_name is null and not unreg then miss := array_append(miss, 'legal_name'); end if;
  if cp.contact_email is null then miss := array_append(miss, 'contact_email'); end if;
  if cp.contact_phone is null then miss := array_append(miss, 'contact_phone'); end if;
  if not cp.accepted_terms then miss := array_append(miss, 'terms'); end if;
  if not exists (select 1 from public.listing_payments where company_id = p_id and status in ('pending', 'verified')) then miss := array_append(miss, 'payment'); end if;
  if unreg then
    if not exists (select 1 from public.company_documents where company_id = p_id and doc_type = 'founder_id') then miss := array_append(miss, 'doc_founder_id'); end if;
  else
    if not exists (select 1 from public.company_documents where company_id = p_id and doc_type = 'trade_license') then miss := array_append(miss, 'doc_trade_license'); end if;
    if not exists (select 1 from public.company_documents where company_id = p_id and doc_type = 'tin') then miss := array_append(miss, 'doc_tin'); end if;
  end if;
  if not exists (select 1 from public.company_financials where company_id = p_id) then miss := array_append(miss, 'financials'); end if;
  if coalesce(array_length(miss, 1), 0) > 0 then return jsonb_build_object('ok', false, 'missing', to_jsonb(miss)); end if;
  update public.companies set status = 'submitted', submitted_at = now(), registered = not unreg where id = p_id;
  update public.company_private set review_note = null where company_id = p_id;
  select to_jsonb(x) - 'company_id' - 'updated_at' - 'extra' into f from public.company_financials x where company_id = p_id;
  perform public._store_valuation(p_id, coalesce(f, '{}'::jsonb), 'application', null, uid);
  perform public._notify(uid, false, 'application_submitted', 'Application received', 'আবেদন জমা হয়েছে', coalesce(c.name, 'Your company') || ' is now with the VOSB team for review.', coalesce(c.name, 'আপনার কোম্পানি') || ' এখন VOSB টিমের রিভিউতে আছে।', '/account', jsonb_build_object('company', p_id));
  perform public._notify(null, true, 'application_submitted', 'New application: ' || coalesce(c.name, '—'), 'নতুন আবেদন: ' || coalesce(c.name, '—'),
    case when unreg then 'Unregistered brand. ' else 'Registered company. ' end || 'Payment and valuation are ready to check.', case when unreg then 'নিবন্ধনহীন ব্র্যান্ড। ' else 'নিবন্ধিত কোম্পানি। ' end || 'পেমেন্ট ও ভ্যালুয়েশন যাচাইয়ের জন্য প্রস্তুত।', '/admin/', jsonb_build_object('company', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.submit_listing_payment(p_company uuid, p_method text, p_sender text, p_trx text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st text; owner_ uuid; fee numeric; m jsonb; trx text := upper(regexp_replace(coalesce(p_trx, ''), '\s', '', 'g')); snd text := regexp_replace(coalesce(p_sender, ''), '[\s-]', '', 'g'); inv text; n int; pid uuid; nm text;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('pay', 8, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  select c.status, cp.owner_id, c.name into st, owner_, nm from public.companies c join public.company_private cp on cp.company_id = c.id where c.id = p_company;
  if owner_ is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if st not in ('draft', 'changes_requested') then raise exception 'Payment is not needed for this application'; end if;
  select value -> p_method into m from public.site_settings where key = 'payment_methods';
  if m is null or coalesce((m ->> 'enabled')::boolean, false) is not true then raise exception 'This payment method is not available yet'; end if;
  if trx !~ '^[A-Z0-9]{8,14}$' then raise exception 'Enter the Transaction ID exactly as shown in your payment SMS (letters and numbers)'; end if;
  if snd !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter the mobile number you sent money from (01XXXXXXXXX)'; end if;
  snd := regexp_replace(snd, '^\+?88', '');
  select (value #>> '{}')::numeric into fee from public.site_settings where key = 'listing_fee';
  if exists (select 1 from public.listing_payments where company_id = p_company and status in ('pending', 'verified')) then raise exception 'A payment for this application is already recorded'; end if;
  n := (select count(*) from public.listing_payments where company_id = p_company) + 1;
  inv := 'VL-' || upper(left(replace(p_company::text, '-', ''), 8)) || case when n > 1 then '-' || n else '' end;
  begin
    insert into public.listing_payments (invoice_no, company_id, user_id, user_email, method, amount, sender_msisdn, trx_id)
    values (inv, p_company, uid, lower(auth.jwt() ->> 'email'), p_method, coalesce(fee, 1000), snd, trx) returning id into pid;
  exception when unique_violation then raise exception 'This Transaction ID has already been used';
  end;
  perform public._notify(null, true, 'payment_submitted', 'Payment to check: ' || inv, 'পেমেন্ট যাচাই করুন: ' || inv, p_method || ' · TrxID ' || trx || ' · ৳' || coalesce(fee, 1000)::text || ' · ' || coalesce(nm, ''), p_method || ' · TrxID ' || trx || ' · ৳' || coalesce(fee, 1000)::text || ' · ' || coalesce(nm, ''), '/admin/', jsonb_build_object('company', p_company, 'payment', pid));
  return jsonb_build_object('id', pid, 'invoice_no', inv, 'status', 'pending');
end $$;

create or replace function public.admin_set_payment_status(p_id uuid, p_status text, p_note text DEFAULT NULL)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.listing_payments; cst text; cnm text; own uuid; nt text := public._txt(p_note, 500);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('pending', 'verified', 'rejected') then raise exception 'bad status'; end if;
  if p_status = 'rejected' and nt is null then raise exception 'Please write the reason for the applicant'; end if;
  update public.listing_payments set status = p_status, note = coalesce(nt, note),
    verified_at = case when p_status = 'verified' then now() else null end,
    verified_by = case when p_status = 'verified' then lower(auth.jwt() ->> 'email') else null end
  where id = p_id returning * into r;
  if r.id is null then raise exception 'Payment not found'; end if;
  select c.status, c.name, cp.owner_id into cst, cnm, own from public.companies c join public.company_private cp on cp.company_id = c.id where c.id = r.company_id;
  if p_status = 'rejected' then
    if cst in ('submitted', 'in_review') then update public.companies set status = 'changes_requested' where id = r.company_id;
    elsif cst = 'published' then update public.companies set status = 'suspended' where id = r.company_id; end if;
    update public.company_private set review_note = 'Payment could not be verified: ' || nt where company_id = r.company_id;
    perform public._notify(own, false, 'payment_rejected', 'Payment could not be verified', 'পেমেন্ট যাচাই করা যায়নি', nt || ' Please submit the correct payment details again.', nt || ' অনুগ্রহ করে সঠিক পেমেন্ট তথ্য আবার দিন।', '/account', jsonb_build_object('company', r.company_id));
  elsif p_status = 'verified' then
    perform public._notify(own, false, 'payment_verified', 'Payment confirmed', 'পেমেন্ট নিশ্চিত হয়েছে', 'Your ৳' || r.amount::text || ' listing fee for ' || coalesce(cnm, 'your company') || ' is confirmed.', coalesce(cnm, 'আপনার কোম্পানি') || '-এর ৳' || r.amount::text || ' লিস্টিং ফি নিশ্চিত হয়েছে।', '/account', jsonb_build_object('company', r.company_id));
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status);
exception when unique_violation then raise exception 'Another payment with this Transaction ID or company is already active';
end $$;

create or replace function public.admin_waive_fee(p_company uuid, p_waive boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.admin_meta (scope, ref_id, data) values ('company', p_company, jsonb_build_object('fee_waived', coalesce(p_waive, false)))
  on conflict (scope, ref_id) do update set data = public.admin_meta.data || jsonb_build_object('fee_waived', coalesce(p_waive, false)), updated_at = now();
end $$;

create or replace function public.admin_set_company_status(p_id uuid, p_status text, p_note text DEFAULT NULL)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies; base text; s text; i int := 1; note text := public._txt(p_note, 2000); own uuid; reg text; waived boolean;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('submitted', 'in_review', 'changes_requested', 'rejected', 'published', 'suspended', 'draft') then raise exception 'bad status'; end if;
  if p_status in ('changes_requested', 'rejected') and note is null then raise exception 'Please write a note for the applicant'; end if;
  select * into c from public.companies where id = p_id;
  if c.id is null then raise exception 'Company not found'; end if;
  s := c.slug;
  if p_status = 'published' then
    if c.name is null or c.description is null then raise exception 'Name and description are required before publishing'; end if;
    waived := coalesce((select (data ->> 'fee_waived')::boolean from public.admin_meta where scope = 'company' and ref_id = p_id), false);
    if not waived and not exists (select 1 from public.listing_payments where company_id = p_id and status = 'verified') then
      raise exception 'Verify the listing payment first (or waive the fee) before publishing';
    end if;
    if s is null then
      base := left(trim(both '-' from regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g')), 60);
      if char_length(base) < 3 then base := 'company-' || left(replace(p_id::text, '-', ''), 8); end if;
      s := base;
      while exists (select 1 from public.companies where slug = s and id <> p_id) loop i := i + 1; s := base || '-' || i; end loop;
    end if;
  end if;
  select reg_type, owner_id into reg, own from public.company_private where company_id = p_id;
  update public.companies set status = p_status, slug = s, registered = (reg is distinct from 'not_registered'),
    published_at = case when p_status = 'published' and published_at is null then now() else published_at end
  where id = p_id;
  update public.company_private set review_note = case when p_status = 'published' then coalesce(note, null) else coalesce(note, review_note) end where company_id = p_id;
  if p_status in ('published', 'changes_requested', 'rejected', 'suspended', 'in_review') then
    perform public._notify(own, false, 'company_' || p_status,
      case p_status when 'published' then 'Your company is live' when 'changes_requested' then 'Changes requested' when 'rejected' then 'Application not approved' when 'suspended' then 'Listing paused' else 'Review started' end,
      case p_status when 'published' then 'আপনার কোম্পানি লাইভ হয়েছে' when 'changes_requested' then 'কিছু পরিবর্তন দরকার' when 'rejected' then 'আবেদন অনুমোদিত হয়নি' when 'suspended' then 'লিস্টিং সাময়িক বন্ধ' else 'রিভিউ শুরু হয়েছে' end,
      coalesce(note, coalesce(c.name, '')), coalesce(note, coalesce(c.name, '')), '/account', jsonb_build_object('company', p_id));
  end if;
  return jsonb_build_object('id', p_id, 'status', p_status, 'slug', s);
end $$;

create or replace function public.set_invest_open(p_company uuid, p_open boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); own uuid; nm text; adm boolean := public.is_admin();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('invopen', 30, 3600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  select cp.owner_id, c.name into own, nm from public.company_private cp join public.companies c on c.id = cp.company_id where cp.company_id = p_company;
  if own is null then raise exception 'Company not found'; end if;
  if not (adm or own = uid) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.companies set invest_open = coalesce(p_open, true) where id = p_company;
  if adm and own <> uid then
    perform public._notify(own, false, 'invest_toggle', case when p_open then 'Investment interest turned ON' else 'Investment interest turned OFF' end, case when p_open then 'বিনিয়োগ গ্রহণ চালু হয়েছে' else 'বিনিয়োগ গ্রহণ বন্ধ হয়েছে' end, 'Changed by VOSB for ' || coalesce(nm, ''), 'VOSB পরিবর্তন করেছে: ' || coalesce(nm, ''), '/account', jsonb_build_object('company', p_company));
  end if;
  return jsonb_build_object('invest_open', coalesce(p_open, true));
end $$;

create or replace function public.express_interest(p_company uuid, p_type text, p_min numeric, p_max numeric, p_message text, p_share boolean, p_phone text DEFAULT NULL)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; msg text := public._txt(p_message, 1000); ph text := public._txt(p_phone, 20); co public.companies; own uuid; ins boolean; amt text; nm text;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('interest', 10, 3600) then raise exception 'Too many requests, please try later' using errcode = '54000'; end if;
  if p_type not in ('angel', 'vc', 'individual', 'institution', 'other') then raise exception 'Choose the investor type'; end if;
  if msg is null or char_length(msg) < 10 then raise exception 'Please write a short message (at least 10 characters)'; end if;
  if ph is not null and ph !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid mobile number or leave it empty'; end if;
  select * into co from public.companies where id = p_company and status = 'published';
  if co.id is null then raise exception 'Company not found'; end if;
  if not co.invest_open then raise exception 'This company is not taking investor interest right now'; end if;
  select owner_id into own from public.company_private where company_id = p_company;
  if own = uid then raise exception 'You cannot invest in your own company'; end if;
  prof := public.ensure_profile();
  insert into public.company_interests (company_id, user_id, investor_name, investor_email, investor_phone, investor_type, ticket_min, ticket_max, message, share_contact)
  values (p_company, uid, prof.full_name, prof.email, coalesce(ph, prof.phone), p_type, greatest(0, least(p_min, 1e13)), greatest(0, least(p_max, 1e13)), msg, coalesce(p_share, false))
  on conflict (company_id, user_id) do update set investor_type = excluded.investor_type, ticket_min = excluded.ticket_min, ticket_max = excluded.ticket_max,
    message = excluded.message, share_contact = excluded.share_contact, investor_phone = excluded.investor_phone, investor_name = excluded.investor_name
  returning (xmax = 0) into ins;
  update public.companies set interest_count = (select count(*) from public.company_interests where company_id = p_company) where id = p_company;
  nm := coalesce(prof.full_name, split_part(prof.email, '@', 1));
  amt := case when p_min is not null or p_max is not null then ' · ৳' || coalesce(p_min, 0)::text || '–' || coalesce(p_max, 0)::text else '' end;
  perform public._notify(own, false, 'investor_interest', case when ins then 'New investor interest' else 'Investor updated their interest' end, case when ins then 'নতুন বিনিয়োগ আগ্রহ' else 'বিনিয়োগকারী আগ্রহ হালনাগাদ করেছেন' end, nm || ' (' || p_type || ')' || amt, nm || ' (' || p_type || ')' || amt, '/account', jsonb_build_object('company', p_company, 'investor', uid));
  perform public._notify(null, true, 'investor_interest', 'Investor interest: ' || coalesce(co.name, ''), 'বিনিয়োগ আগ্রহ: ' || coalesce(co.name, ''), nm || ' (' || p_type || ')' || amt, nm || ' (' || p_type || ')' || amt, '/admin/', jsonb_build_object('company', p_company, 'investor', uid));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.admin_waive_fee(uuid, boolean), public.set_invest_open(uuid, boolean) from public, anon;
grant execute on function public.admin_waive_fee(uuid, boolean), public.set_invest_open(uuid, boolean) to authenticated;
select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('submit_company_application','submit_listing_payment','admin_set_payment_status','admin_waive_fee','admin_set_company_status','set_invest_open','express_interest');

-- ======== part 12c-2 ========
-- 12c-2: investor overview, investments with two-sided confirmation, valuation update requests
create or replace function public._recalc_company_money(cid uuid)
returns void language sql security definer set search_path = public as $$
  update public.companies set
    raised_amount = coalesce((select sum(amount) from public.company_investments where company_id = cid and status = 'verified'), 0),
    investor_count = coalesce((select count(distinct investor_id) from public.company_investments where company_id = cid and status = 'verified'), 0)
  where id = cid $$;
revoke all on function public._recalc_company_money(uuid) from public, anon, authenticated;

create or replace function public.company_investor_overview(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not (adm or exists (select 1 from public.company_private where company_id = p_company and owner_id = auth.uid())) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'invest_open', (select invest_open from public.companies where id = p_company),
    'raised', (select raised_amount from public.companies where id = p_company),
    'interests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select i.id, i.user_id, i.investor_name, i.investor_type, i.ticket_min, i.ticket_max, i.message, i.status, i.created_at,
        case when i.share_contact or adm then i.investor_email end as email, case when i.share_contact or adm then i.investor_phone end as phone,
        p.avatar_url, p.headline, p.location,
        coalesce((select sum(v.amount) from public.company_investments v where v.company_id = i.company_id and v.investor_id = i.user_id and v.status in ('confirmed', 'verified')), 0) as invested
      from public.company_interests i left join public.profiles p on p.id = i.user_id where i.company_id = p_company) x), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(to_jsonb(y) order by y.created_at desc) from (
      select v.id, v.investor_id, coalesce(v.investor_name, p.full_name) as investor_name, p.avatar_url, v.amount, v.equity_pct, v.invested_on, v.status, v.recorded_by,
        v.investor_confirmed_at, v.owner_confirmed_at, v.verified_at, v.note, v.created_at
      from public.company_investments v left join public.profiles p on p.id = v.investor_id where v.company_id = p_company) y), '[]'::jsonb),
    'totals', jsonb_build_object(
      'interested', (select count(*) from public.company_interests where company_id = p_company),
      'confirmed', coalesce((select sum(amount) from public.company_investments where company_id = p_company and status in ('confirmed', 'verified')), 0),
      'verified', coalesce((select sum(amount) from public.company_investments where company_id = p_company and status = 'verified'), 0),
      'investors', (select count(distinct investor_id) from public.company_investments where company_id = p_company and status in ('confirmed', 'verified'))));
end $$;

create or replace function public.my_investments()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'interests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select i.id, i.company_id, c.name, c.slug, c.logo_url, i.investor_type, i.ticket_min, i.ticket_max, i.message, i.status, i.created_at, c.invest_open
      from public.company_interests i join public.companies c on c.id = i.company_id where i.user_id = uid) x), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(to_jsonb(y) order by y.created_at desc) from (
      select v.id, v.company_id, c.name, c.slug, v.amount, v.equity_pct, v.invested_on, v.status, v.recorded_by, v.investor_confirmed_at, v.owner_confirmed_at, v.verified_at, v.note, v.created_at
      from public.company_investments v join public.companies c on c.id = v.company_id where v.investor_id = uid) y), '[]'::jsonb),
    'total', coalesce((select sum(amount) from public.company_investments where investor_id = uid and status in ('confirmed', 'verified')), 0));
end $$;

create or replace function public.record_investment(p_company uuid, p_investor uuid, p_amount numeric, p_equity numeric, p_date date, p_note text DEFAULT NULL)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); own uuid; adm boolean := public.is_admin(); inv uuid; rec text; iid uuid; vid uuid; co public.companies; iname text; dt date := coalesce(p_date, current_date); st text := 'proposed';
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('invrec', 20, 3600) then raise exception 'Too many requests, please try later' using errcode = '54000'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1e13 then raise exception 'Enter the amount invested'; end if;
  if p_equity is not null and (p_equity <= 0 or p_equity > 100) then raise exception 'Equity must be between 0 and 100'; end if;
  if dt > current_date or dt < date '2000-01-01' then raise exception 'Check the date'; end if;
  select * into co from public.companies where id = p_company;
  if co.id is null then raise exception 'Company not found'; end if;
  select owner_id into own from public.company_private where company_id = p_company;
  if adm then inv := p_investor; rec := 'admin'; st := 'verified';
  elsif own = uid then inv := p_investor; rec := 'owner';
  else inv := uid; rec := 'investor'; end if;
  if inv is null then raise exception 'Choose the investor'; end if;
  if inv = own then raise exception 'The owner cannot be the investor'; end if;
  select id into iid from public.company_interests where company_id = p_company and user_id = inv;
  if iid is null and not adm then raise exception 'The investor must first show interest in this company'; end if;
  select coalesce(full_name, split_part(email, '@', 1)) into iname from public.profiles where id = inv;
  insert into public.company_investments (company_id, interest_id, investor_id, investor_name, amount, equity_pct, invested_on, recorded_by, investor_confirmed_at, owner_confirmed_at, status, verified_at, note)
  values (p_company, iid, inv, iname, p_amount, p_equity, dt, rec,
    case when rec in ('investor', 'admin') then now() end, case when rec in ('owner', 'admin') then now() end, st, case when adm then now() end, public._txt(p_note, 500)) returning id into vid;
  if adm then perform public._recalc_company_money(p_company); end if;
  if rec = 'investor' then
    perform public._notify(own, false, 'investment_proposed', 'Investment to confirm', 'বিনিয়োগ নিশ্চিত করুন', coalesce(iname, 'An investor') || ' recorded ৳' || p_amount::text || ' in ' || coalesce(co.name, '') || '. Please confirm if you received it.', coalesce(iname, 'একজন বিনিয়োগকারী') || ' ' || coalesce(co.name, '') || '-এ ৳' || p_amount::text || ' বিনিয়োগ লিখেছেন। পেয়ে থাকলে নিশ্চিত করুন।', '/account', jsonb_build_object('company', p_company, 'investment', vid));
  elsif rec = 'owner' then
    perform public._notify(inv, false, 'investment_proposed', 'Investment to confirm', 'বিনিয়োগ নিশ্চিত করুন', coalesce(co.name, 'The company') || ' recorded ৳' || p_amount::text || ' from you. Please confirm if it is correct.', coalesce(co.name, 'কোম্পানি') || ' আপনার কাছ থেকে ৳' || p_amount::text || ' পাওয়ার কথা লিখেছে। সঠিক হলে নিশ্চিত করুন।', '/account', jsonb_build_object('company', p_company, 'investment', vid));
  else
    perform public._notify(inv, false, 'investment_verified', 'Investment verified', 'বিনিয়োগ যাচাই হয়েছে', '৳' || p_amount::text || ' in ' || coalesce(co.name, '') || ' is verified by VOSB.', coalesce(co.name, '') || '-এ ৳' || p_amount::text || ' বিনিয়োগ VOSB যাচাই করেছে।', '/account', jsonb_build_object('company', p_company, 'investment', vid));
    perform public._notify(own, false, 'investment_verified', 'Investment verified', 'বিনিয়োগ যাচাই হয়েছে', '৳' || p_amount::text || ' from ' || coalesce(iname, 'an investor') || ' is verified by VOSB.', coalesce(iname, 'একজন বিনিয়োগকারী') || '-এর ৳' || p_amount::text || ' বিনিয়োগ VOSB যাচাই করেছে।', '/account', jsonb_build_object('company', p_company, 'investment', vid));
  end if;
  if not adm then
    perform public._notify(null, true, 'investment_proposed', 'Investment recorded: ' || coalesce(co.name, ''), 'বিনিয়োগ লেখা হয়েছে: ' || coalesce(co.name, ''), '৳' || p_amount::text || ' · ' || coalesce(iname, '') || ' · recorded by ' || rec || ' · waiting for the other side', '৳' || p_amount::text || ' · ' || coalesce(iname, '') || ' · অপর পক্ষের নিশ্চিতকরণের অপেক্ষায়', '/admin/', jsonb_build_object('company', p_company, 'investment', vid));
  end if;
  return vid;
end $$;

create or replace function public.confirm_investment(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v public.company_investments; own uuid; co public.companies;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v from public.company_investments where id = p_id;
  if v.id is null then raise exception 'Not found'; end if;
  if v.status <> 'proposed' then raise exception 'This record is already %', v.status; end if;
  select owner_id into own from public.company_private where company_id = v.company_id;
  select * into co from public.companies where id = v.company_id;
  if uid = v.investor_id and v.investor_confirmed_at is null then update public.company_investments set investor_confirmed_at = now() where id = p_id;
  elsif uid = own and v.owner_confirmed_at is null then update public.company_investments set owner_confirmed_at = now() where id = p_id;
  else raise exception 'Nothing for you to confirm here' using errcode = '42501'; end if;
  update public.company_investments set status = 'confirmed' where id = p_id and investor_confirmed_at is not null and owner_confirmed_at is not null;
  perform public._notify(case when uid = own then v.investor_id else own end, false, 'investment_confirmed', 'Investment confirmed by both sides', 'দুই পক্ষই বিনিয়োগ নিশ্চিত করেছে', '৳' || v.amount::text || ' · ' || coalesce(co.name, ''), '৳' || v.amount::text || ' · ' || coalesce(co.name, ''), '/account', jsonb_build_object('company', v.company_id, 'investment', p_id));
  perform public._notify(null, true, 'investment_confirmed', 'Ready to verify: ' || coalesce(co.name, ''), 'যাচাইয়ের জন্য প্রস্তুত: ' || coalesce(co.name, ''), '৳' || v.amount::text || ' confirmed by the owner and the investor.', '৳' || v.amount::text || ' মালিক ও বিনিয়োগকারী দুজনেই নিশ্চিত করেছেন।', '/admin/', jsonb_build_object('company', v.company_id, 'investment', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cancel_investment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v public.company_investments; own uuid; adm boolean := public.is_admin();
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into v from public.company_investments where id = p_id;
  if v.id is null then raise exception 'Not found'; end if;
  select owner_id into own from public.company_private where company_id = v.company_id;
  if not (adm or (v.status = 'proposed' and (uid = v.investor_id or uid = own))) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v.status = 'cancelled' then return; end if;
  update public.company_investments set status = 'cancelled' where id = p_id;
  perform public._recalc_company_money(v.company_id);
  perform public._notify(case when uid = own then v.investor_id else own end, false, 'investment_cancelled', 'Investment record cancelled', 'বিনিয়োগ রেকর্ড বাতিল', '৳' || v.amount::text, '৳' || v.amount::text, '/account', jsonb_build_object('company', v.company_id));
end $$;

create or replace function public.admin_verify_investment(p_id uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.company_investments; own uuid; co public.companies;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from public.company_investments where id = p_id;
  if v.id is null then raise exception 'Not found'; end if;
  if v.status = 'verified' then return jsonb_build_object('ok', true); end if;
  if v.status = 'cancelled' then raise exception 'This record was cancelled'; end if;
  if v.status = 'proposed' and not coalesce(p_force, false) then raise exception 'Only one side has confirmed so far'; end if;
  update public.company_investments set status = 'verified', verified_at = now(), investor_confirmed_at = coalesce(investor_confirmed_at, now()), owner_confirmed_at = coalesce(owner_confirmed_at, now()) where id = p_id;
  perform public._recalc_company_money(v.company_id);
  select owner_id into own from public.company_private where company_id = v.company_id;
  select * into co from public.companies where id = v.company_id;
  perform public._notify(v.investor_id, false, 'investment_verified', 'Investment verified', 'বিনিয়োগ যাচাই হয়েছে', '৳' || v.amount::text || ' in ' || coalesce(co.name, '') || ' is verified by VOSB.', coalesce(co.name, '') || '-এ ৳' || v.amount::text || ' বিনিয়োগ VOSB যাচাই করেছে।', '/account', jsonb_build_object('company', v.company_id));
  perform public._notify(own, false, 'investment_verified', 'Investment verified — you can request a valuation update', 'বিনিয়োগ যাচাই হয়েছে — ভ্যালুয়েশন আপডেটের অনুরোধ করতে পারেন', '৳' || v.amount::text || ' is verified by VOSB.', '৳' || v.amount::text || ' VOSB যাচাই করেছে।', '/account', jsonb_build_object('company', v.company_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_list_investments(p_status text default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select v.id, v.company_id, c.name as company, c.slug, v.investor_id, coalesce(v.investor_name, p.full_name) as investor, p.email, p.avatar_url, v.amount, v.equity_pct, v.invested_on, v.status, v.recorded_by,
      v.investor_confirmed_at, v.owner_confirmed_at, v.verified_at, v.note, v.created_at
    from public.company_investments v join public.companies c on c.id = v.company_id left join public.profiles p on p.id = v.investor_id
    where p_status is null or v.status = p_status order by (v.status = 'confirmed') desc, v.created_at desc limit least(greatest(p_limit, 1), 300)) x), '[]'::jsonb);
end $$;

create or replace function public.request_valuation_update(p_company uuid, p_reason text, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); co public.companies; own uuid; cur jsonb; inp jsonb := '{}'::jsonb; k text; rs text := public._txt(p_reason, 800); vid uuid;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('valreq', 5, 86400) then raise exception 'Too many requests today' using errcode = '54000'; end if;
  select * into co from public.companies where id = p_company;
  select owner_id into own from public.company_private where company_id = p_company;
  if co.id is null or own is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if co.status <> 'published' then raise exception 'Only published companies can request an update'; end if;
  if not exists (select 1 from public.company_investments where company_id = p_company and status in ('confirmed', 'verified')) then
    raise exception 'A valuation update can be requested after an investment is confirmed by both you and the investor';
  end if;
  if exists (select 1 from public.company_valuations where company_id = p_company and status = 'pending' and source = 'update_request') then raise exception 'You already have an update waiting for review'; end if;
  if rs is null then raise exception 'Please explain why the valuation should change'; end if;
  foreach k in array array['annual_revenue','monthly_revenue','growth_mom','gross_margin','annual_net_profit','monthly_burn','cash_in_bank','debt','assets_value','ip_value','customers','paying_customers','team_ft','total_raised','market_size'] loop
    if p ? k and public._num(p ->> k) is not null then inp := inp || jsonb_build_object(k, greatest(-1e13, least(public._num(p ->> k), 1e15))); end if;
  end loop;
  select to_jsonb(x) - 'company_id' - 'updated_at' - 'extra' - 'traction' - 'owner_note' into cur from public.company_financials x where company_id = p_company;
  vid := public._store_valuation(p_company, coalesce(cur, '{}'::jsonb) || inp, 'update_request', rs, uid);
  perform public._notify(null, true, 'valuation_request', 'Valuation update requested: ' || coalesce(co.name, ''), 'ভ্যালুয়েশন আপডেটের অনুরোধ: ' || coalesce(co.name, ''), rs, rs, '/admin/', jsonb_build_object('company', p_company, 'valuation', vid));
  perform public._notify(uid, false, 'valuation_request', 'Update request sent', 'আপডেটের অনুরোধ পাঠানো হয়েছে', 'VOSB will review the new figures.', 'VOSB নতুন তথ্য রিভিউ করবে।', '/account', jsonb_build_object('company', p_company));
  return vid;
end $$;

revoke execute on function public.company_investor_overview(uuid), public.my_investments(), public.record_investment(uuid, uuid, numeric, numeric, date, text), public.confirm_investment(uuid), public.cancel_investment(uuid),
  public.admin_verify_investment(uuid, boolean), public.admin_list_investments(text, int), public.request_valuation_update(uuid, text, jsonb) from public, anon;
grant execute on function public.company_investor_overview(uuid), public.my_investments(), public.record_investment(uuid, uuid, numeric, numeric, date, text), public.confirm_investment(uuid), public.cancel_investment(uuid),
  public.admin_verify_investment(uuid, boolean), public.admin_list_investments(text, int), public.request_valuation_update(uuid, text, jsonb) to authenticated;
select 1 as ok;

-- ======== part 12d ========
-- 12d: avatars, article comments + likes, avatar in comments/reviews
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

create or replace function public.update_my_profile(p jsonb)
returns profiles language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.profiles; nm text; ph text; av text;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('profile', 30, 600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  perform public.ensure_profile();
  nm := public._txt(p ->> 'full_name', 120);
  if p ? 'full_name' and (nm is null or char_length(nm) < 2) then raise exception 'Please enter your name'; end if;
  ph := public._txt(p ->> 'phone', 20);
  if ph is not null and ph !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)'; end if;
  av := public._own_img(p ->> 'avatar_url', 'avatars');
  update public.profiles set
    full_name = case when p ? 'full_name' then nm else full_name end,
    phone = case when p ? 'phone' then ph else phone end,
    headline = case when p ? 'headline' then public._txt(p ->> 'headline', 120) else headline end,
    bio = case when p ? 'bio' then public._txt(p ->> 'bio', 600) else bio end,
    location = case when p ? 'location' then public._txt(p ->> 'location', 80) else location end,
    avatar_url = case when p ? 'avatar_url' then av else avatar_url end,
    user_type = case when (p ->> 'user_type') in ('reader','founder','investor','other') then p ->> 'user_type' else user_type end
  where id = uid returning * into r;
  return r;
end $$;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) between 2 and 1000),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
drop policy if exists "Admin manages post comments" on public.post_comments;
create policy "Admin manages post comments" on public.post_comments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin reads post likes" on public.post_likes;
create policy "Admin reads post likes" on public.post_likes for select to authenticated using (public.is_admin());

create or replace function public.post_engagement(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'likes', (select count(*) from public.post_likes l where l.post_id = p.id),
    'comments', (select count(*) from public.post_comments m where m.post_id = p.id and m.status = 'published'),
    'liked', coalesce(exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()), false))
  from public.posts p where p.slug = p_slug and p.status = 'published' and p.publish_at <= now() $$;

create or replace function public.list_post_comments(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
    select m.id, m.parent_id, case when m.user_id is null then 'Deleted user' else m.author_name end as author_name, pr.avatar_url, m.body, m.created_at,
      coalesce(m.user_id = auth.uid(), false) as mine, (m.user_id = 'c9c7d62e-08ee-4b0b-a3d8-572b7ac66d38'::uuid) as staff
    from public.post_comments m join public.posts p on p.id = m.post_id left join public.profiles pr on pr.id = m.user_id
    where p.slug = p_slug and p.status = 'published' and m.status = 'published' order by m.created_at limit 300) x $$;

create or replace function public.add_post_comment(p_slug text, p_parent uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; b text := public._txt(p_body, 1000); pid uuid;
begin
  if uid is null then raise exception 'Please sign in to comment' using errcode = '28000'; end if;
  if not public.rl_user('pcomment', 20, 600) then raise exception 'Too many comments, please slow down' using errcode = '54000'; end if;
  if b is null or char_length(b) < 2 then raise exception 'Write a comment first'; end if;
  select id into pid from public.posts where slug = p_slug and status = 'published' and publish_at <= now();
  if pid is null then raise exception 'Article not found'; end if;
  if p_parent is not null and not exists (select 1 from public.post_comments where id = p_parent and post_id = pid and parent_id is null) then raise exception 'Reply target not found'; end if;
  prof := public.ensure_profile();
  insert into public.post_comments (post_id, parent_id, user_id, author_name, body) values (pid, p_parent, uid, public._display_name(prof.full_name, prof.email), b);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_my_post_comment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  delete from public.post_comments where id = p_id and (user_id = auth.uid() or public.is_admin());
end $$;

create or replace function public.toggle_post_like(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid; was boolean;
begin
  if uid is null then raise exception 'Please sign in to like' using errcode = '28000'; end if;
  if not public.rl_user('plike', 60, 600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  select id into pid from public.posts where slug = p_slug and status = 'published' and publish_at <= now();
  if pid is null then raise exception 'Article not found'; end if;
  delete from public.post_likes where post_id = pid and user_id = uid returning true into was;
  if was is null then insert into public.post_likes (post_id, user_id) values (pid, uid); end if;
  return jsonb_build_object('liked', was is null, 'likes', (select count(*) from public.post_likes where post_id = pid));
end $$;

create or replace function public.list_company_comments(p_company uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
    select m.id, m.parent_id, case when m.user_id is null then 'Deleted user' else m.author_name end as author_name, pr.avatar_url, m.by_owner, m.body, m.created_at, coalesce(m.user_id = auth.uid(), false) as mine
    from public.company_comments m join public.companies c on c.id = m.company_id left join public.profiles pr on pr.id = m.user_id
    where m.company_id = p_company and m.status = 'published' and c.status = 'published' order by m.created_at limit 300) x $$;

create or replace function public.list_company_reviews(p_company uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select r.id, case when r.user_id is null then 'Deleted user' else r.author_name end as author_name, pr.avatar_url, r.rating, r.title, r.body, r.created_at, coalesce(r.user_id = auth.uid(), false) as mine
        from public.company_reviews r join public.companies c on c.id = r.company_id left join public.profiles pr on pr.id = r.user_id
        where r.company_id = p_company and r.status = 'published' and c.status = 'published'
        order by r.created_at desc limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)) x), '[]'::jsonb),
    'count', coalesce((select rating_count from public.companies where id = p_company and status = 'published'), 0),
    'avg', coalesce((select rating_avg from public.companies where id = p_company and status = 'published'), 0),
    'dist', coalesce((select jsonb_object_agg(d.rating::text, d.n) from (select rating, count(*) as n from public.company_reviews where company_id = p_company and status = 'published' group by rating) d), '{}'::jsonb)) $$;

revoke execute on function public.add_post_comment(text, uuid, text), public.delete_my_post_comment(uuid), public.toggle_post_like(text) from public, anon;
grant execute on function public.add_post_comment(text, uuid, text), public.delete_my_post_comment(uuid), public.toggle_post_like(text) to authenticated;
grant execute on function public.post_engagement(text), public.list_post_comments(text) to anon, authenticated;
select (select count(*) from storage.buckets where id='avatars') b, (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('post_engagement','list_post_comments','add_post_comment','toggle_post_like','delete_my_post_comment')) f;

-- ======== part 12e ========
-- 12e: admin people view — roles, active/inactive, top investors, custom fields
drop function if exists public.admin_list_users(text, integer, integer);
create or replace function public.admin_list_users(p_q text default null, p_limit int default 50, p_offset int default 0, p_role text default null, p_active text default null, p_sort text default 'new')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := '%' || lower(coalesce(public._txt(p_q, 80), '')) || '%';
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (with base as (
    select u.id, u.email, p.full_name, p.phone, p.headline, p.location, p.user_type, p.avatar_url, coalesce(p.provider, u.raw_app_meta_data ->> 'provider') as provider,
      u.created_at, u.last_sign_in_at, p.last_seen_at, (u.email_confirmed_at is not null) as email_confirmed,
      (select count(*) from public.company_private cp where cp.owner_id = u.id) as companies,
      (select count(*) from public.company_reviews r where r.user_id = u.id) as reviews,
      (select count(*) from public.company_comments m where m.user_id = u.id) as comments,
      (select count(*) from public.post_comments m where m.user_id = u.id) as article_comments,
      (select count(*) from public.company_interests i where i.user_id = u.id) as interests,
      (select count(*) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')) as invest_count,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')), 0) as invested_total,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status = 'verified'), 0) as invested_verified,
      coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) as last_active,
      am.data as meta, am.note as admin_note
    from auth.users u left join public.profiles p on p.id = u.id left join public.admin_meta am on am.scope = 'user' and am.ref_id = u.id
    where lower(coalesce(u.email, '')) like q or lower(coalesce(p.full_name, '')) like q),
  roled as (select b.*, (case when b.invest_count > 0 or b.interests > 0 or b.user_type = 'investor' then 'investor' when b.companies > 0 or b.user_type = 'founder' then 'founder' when b.user_type = 'other' then 'other' else 'reader' end) as role,
      (b.last_active > now() - interval '30 days') as active from base b),
  filt as (select * from roled r where (p_role is null or r.role = p_role) and (p_active is null or (p_active = 'active' and r.active) or (p_active = 'inactive' and not r.active)))
  select jsonb_build_object('total', (select count(*) from filt), 'items', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select * from filt order by (case when p_sort = 'invested' then invested_total end) desc nulls last, (case when p_sort = 'active' then last_active end) desc nulls last, created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)));
end $$;

create or replace function public.admin_user_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (with r as (
    select u.id, p.full_name, u.email, p.avatar_url, u.created_at,
      (case when exists (select 1 from public.company_interests i where i.user_id = u.id) or exists (select 1 from public.company_investments v where v.investor_id = u.id) or p.user_type = 'investor' then 'investor'
            when exists (select 1 from public.company_private cp where cp.owner_id = u.id) or p.user_type = 'founder' then 'founder' when p.user_type = 'other' then 'other' else 'reader' end) as role,
      (coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) > now() - interval '30 days') as active
    from auth.users u left join public.profiles p on p.id = u.id)
  select jsonb_build_object(
    'total', (select count(*) from r), 'active', (select count(*) from r where active), 'inactive', (select count(*) from r where not active),
    'new7', (select count(*) from r where created_at > now() - interval '7 days'),
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*) n from r group by role) z),
    'top_investors', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select v.investor_id as id, coalesce(max(p.full_name), max(p.email)) as name, max(p.avatar_url) as avatar_url, sum(v.amount) as total, count(*) as deals, count(distinct v.company_id) as companies
      from public.company_investments v left join public.profiles p on p.id = v.investor_id where v.status in ('confirmed','verified') group by v.investor_id order by sum(v.amount) desc limit 5) t), '[]'::jsonb),
    'invested_total', coalesce((select sum(amount) from public.company_investments where status in ('confirmed','verified')), 0),
    'invested_verified', coalesce((select sum(amount) from public.company_investments where status = 'verified'), 0),
    'awaiting_verify', (select count(*) from public.company_investments where status = 'confirmed'),
    'open_requests', (select count(*) from public.company_valuations where status = 'pending')));
end $$;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user),
    'meta', (select to_jsonb(m) from public.admin_meta m where m.scope = 'user' and m.ref_id = p_user),
    'interests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select i.id, i.company_id, c.name as company, c.slug, i.investor_type, i.ticket_min, i.ticket_max, i.message, i.status, i.created_at from public.company_interests i join public.companies c on c.id = i.company_id where i.user_id = p_user) x), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(to_jsonb(y) order by y.created_at desc) from (
      select v.id, v.company_id, c.name as company, v.amount, v.equity_pct, v.invested_on, v.status, v.recorded_by, v.created_at from public.company_investments v join public.companies c on c.id = v.company_id where v.investor_id = p_user) y), '[]'::jsonb),
    'companies', coalesce((select jsonb_agg(to_jsonb(z)) from (
      select c.id, c.name, c.slug, c.status, c.registered, c.raised_amount, c.investor_count from public.company_private cp join public.companies c on c.id = cp.company_id where cp.owner_id = p_user) z), '[]'::jsonb));
end $$;

revoke execute on function public.admin_list_users(text, int, int, text, text, text), public.admin_user_stats(), public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_list_users(text, int, int, text, text, text), public.admin_user_stats(), public.admin_user_detail(uuid) to authenticated;
insert into public.admin_field_defs (scope, key, label_en, label_bn, kind, sort) values
  ('user','kyc_status','KYC / identity check','পরিচয় যাচাই','select',10),
  ('user','source','How they found us','কীভাবে জেনেছেন','text',20),
  ('company','sector_tag','Internal sector tag','অভ্যন্তরীণ সেক্টর ট্যাগ','text',10)
on conflict (scope, key) do nothing;
update public.admin_field_defs set options = '["Not checked","Checked","Needs documents"]'::jsonb where key = 'kyc_status' and scope = 'user';
select (public.admin_list_users(null, 5, 0, null, null, 'new')::jsonb ->> 'total') as users_total;

-- ======== part 12e-fix ========
drop function if exists public.admin_list_users(text, integer, integer);
create or replace function public.admin_list_users(p_q text default null, p_limit int default 50, p_offset int default 0, p_role text default null, p_active text default null, p_sort text default 'new')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := '%' || lower(coalesce(public._txt(p_q, 80), '')) || '%';
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (with base as (
    select u.id, u.email, p.full_name, p.phone, p.headline, p.location, p.user_type, p.avatar_url, coalesce(p.provider, u.raw_app_meta_data ->> 'provider') as provider,
      u.created_at, u.last_sign_in_at, p.last_seen_at, (u.email_confirmed_at is not null) as email_confirmed,
      (select count(*) from public.company_private cp where cp.owner_id = u.id) as companies,
      (select count(*) from public.company_reviews r where r.user_id = u.id) as reviews,
      (select count(*) from public.company_comments m where m.user_id = u.id) as comments,
      (select count(*) from public.post_comments m where m.user_id = u.id) as article_comments,
      (select count(*) from public.company_interests i where i.user_id = u.id) as interests,
      (select count(*) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')) as invest_count,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')), 0) as invested_total,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status = 'verified'), 0) as invested_verified,
      coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) as last_active,
      am.data as meta, am.note as admin_note
    from auth.users u left join public.profiles p on p.id = u.id left join public.admin_meta am on am.scope = 'user' and am.ref_id = u.id
    where lower(coalesce(u.email, '')) like q or lower(coalesce(p.full_name, '')) like q),
  roled as (select b.*, (case when b.invest_count > 0 or b.interests > 0 or b.user_type = 'investor' then 'investor' when b.companies > 0 or b.user_type = 'founder' then 'founder' when b.user_type = 'other' then 'other' else 'reader' end) as role,
      (b.last_active > now() - interval '30 days') as active from base b),
  filt as (select * from roled r where (p_role is null or r.role = p_role) and (p_active is null or (p_active = 'active' and r.active) or (p_active = 'inactive' and not r.active)))
  select jsonb_build_object('total', (select count(*) from filt), 'items', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select * from filt order by (case when p_sort = 'invested' then invested_total end) desc nulls last, (case when p_sort = 'active' then last_active end) desc nulls last, created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)));
end $$;

create or replace function public.admin_user_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (with r as (
    select u.id, p.full_name, u.email, p.avatar_url, u.created_at,
      (case when exists (select 1 from public.company_interests i where i.user_id = u.id) or exists (select 1 from public.company_investments v where v.investor_id = u.id) or p.user_type = 'investor' then 'investor'
            when exists (select 1 from public.company_private cp where cp.owner_id = u.id) or p.user_type = 'founder' then 'founder' when p.user_type = 'other' then 'other' else 'reader' end) as role,
      (coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) > now() - interval '30 days') as active
    from auth.users u left join public.profiles p on p.id = u.id)
  select jsonb_build_object(
    'total', (select count(*) from r), 'active', (select count(*) from r where active), 'inactive', (select count(*) from r where not active),
    'new7', (select count(*) from r where created_at > now() - interval '7 days'),
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*) n from r group by role) z),
    'top_investors', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select v.investor_id as id, coalesce(max(p.full_name), max(p.email)) as name, max(p.avatar_url) as avatar_url, sum(v.amount) as total, count(*) as deals, count(distinct v.company_id) as companies
      from public.company_investments v left join public.profiles p on p.id = v.investor_id where v.status in ('confirmed','verified') group by v.investor_id order by sum(v.amount) desc limit 5) t), '[]'::jsonb),
    'invested_total', coalesce((select sum(amount) from public.company_investments where status in ('confirmed','verified')), 0),
    'invested_verified', coalesce((select sum(amount) from public.company_investments where status = 'verified'), 0),
    'awaiting_verify', (select count(*) from public.company_investments where status = 'confirmed'),
    'open_requests', (select count(*) from public.company_valuations where status = 'pending')));
end $$;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user),
    'meta', (select to_jsonb(m) from public.admin_meta m where m.scope = 'user' and m.ref_id = p_user),
    'interests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select i.id, i.company_id, c.name as company, c.slug, i.investor_type, i.ticket_min, i.ticket_max, i.message, i.status, i.created_at from public.company_interests i join public.companies c on c.id = i.company_id where i.user_id = p_user) x), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(to_jsonb(y) order by y.created_at desc) from (
      select v.id, v.company_id, c.name as company, v.amount, v.equity_pct, v.invested_on, v.status, v.recorded_by, v.created_at from public.company_investments v join public.companies c on c.id = v.company_id where v.investor_id = p_user) y), '[]'::jsonb),
    'companies', coalesce((select jsonb_agg(to_jsonb(z)) from (
      select c.id, c.name, c.slug, c.status, c.registered, c.raised_amount, c.investor_count from public.company_private cp join public.companies c on c.id = cp.company_id where cp.owner_id = p_user) z), '[]'::jsonb));
end $$;

revoke execute on function public.admin_list_users(text, int, int, text, text, text), public.admin_user_stats(), public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_list_users(text, int, int, text, text, text), public.admin_user_stats(), public.admin_user_detail(uuid) to authenticated;
insert into public.admin_field_defs (scope, key, label_en, label_bn, kind, sort, options) values
  ('user','kyc_status','KYC / identity check','পরিচয় যাচাই','select',10,'["Not checked","Checked","Needs documents"]'::jsonb),
  ('user','source','How they found us','কীভাবে জেনেছেন','text',20,'[]'::jsonb),
  ('company','sector_tag','Internal sector tag','অভ্যন্তরীণ সেক্টর ট্যাগ','text',10,'[]'::jsonb)
on conflict (scope, key) do nothing;
select 1 as ok;
