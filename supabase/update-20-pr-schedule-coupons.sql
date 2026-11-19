-- Voice of Startup Bangladesh — update 20: PR booking calendar, custom order fields, central coupons (PR + company listing), PR revenue in totals.
-- Safe to run more than once. Nothing is deleted. Applied as migrations pr_schedule_part1 / pr_schedule_part2.

-- =====================================================================================================
-- PART 1 — tables, helpers
-- =====================================================================================================

-- ---------- booking groups: how many items of a kind can be published per day ----------
create table if not exists public.pr_slot_groups (
  key text primary key check (key ~ '^[a-z0-9_-]{2,30}$'),
  name_bn text not null check (char_length(name_bn) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  daily_cap int not null default 1 check (daily_cap between 1 and 200),
  lead_days int not null default 1 check (lead_days between 0 and 60),        -- earliest bookable day = today + lead_days
  horizon_days int not null default 60 check (horizon_days between 7 and 365), -- latest bookable day = today + horizon_days
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  check (horizon_days > lead_days)
);
insert into public.pr_slot_groups (key, name_bn, name_en, daily_cap, lead_days, horizon_days, sort) values
  ('article', 'স্পনসর্ড আর্টিকেল', 'Sponsored articles', 10, 1, 60, 10),
  ('post',    'ফেসবুক পোস্ট',       'Facebook posts',      1,  1, 60, 20),
  ('reel',    'রিলস / ভিডিও',       'Reels / videos',      1,  1, 60, 30)
on conflict (key) do nothing;

alter table public.pr_services
  add column if not exists slot_group text references public.pr_slot_groups(key) on update cascade,
  add column if not exists extra_fields jsonb not null default '[]'::jsonb,
  add column if not exists notice_bn text,
  add column if not exists notice_en text;
do $$ begin
  alter table public.pr_services add constraint pr_services_extra_chk check (jsonb_typeof(extra_fields) = 'array' and jsonb_array_length(extra_fields) <= 12);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pr_services add constraint pr_services_notice_chk check (char_length(coalesce(notice_bn, '')) <= 500 and char_length(coalesce(notice_en, '')) <= 500);
exception when duplicate_object then null; end $$;
update public.pr_services set slot_group = key where key in ('article', 'post', 'reel') and slot_group is null;
update public.pr_services set max_qty = 10 where slot_group is not null and max_qty > 10;

-- ---------- closed days / seats reserved by hand (offline bookings, holidays) ----------
create table if not exists public.pr_blackouts (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  slot_group text references public.pr_slot_groups(key) on update cascade,   -- null = every group
  seats int check (seats is null or seats >= 1),                              -- null = the whole day is closed
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pr_blackouts_day on public.pr_blackouts (day) where deleted_at is null;

-- ---------- one row per booked item ----------
create table if not exists public.pr_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pr_orders(id),
  slot_group text not null references public.pr_slot_groups(key) on update cascade,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists pr_bookings_slot on public.pr_bookings (slot_group, day);
create index if not exists pr_bookings_order on public.pr_bookings (order_id);

alter table public.pr_slot_groups enable row level security;
alter table public.pr_blackouts   enable row level security;
alter table public.pr_bookings    enable row level security;
drop policy if exists "Admin manages pr slot groups" on public.pr_slot_groups;
drop policy if exists "Admin manages pr blackouts" on public.pr_blackouts;
drop policy if exists "Admin manages pr bookings" on public.pr_bookings;
drop policy if exists "Read own pr bookings" on public.pr_bookings;
create policy "Admin manages pr slot groups" on public.pr_slot_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages pr blackouts"   on public.pr_blackouts   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages pr bookings"    on public.pr_bookings    for select to authenticated using (public.is_admin());
create policy "Read own pr bookings" on public.pr_bookings for select to authenticated using (exists (select 1 from public.pr_orders o where o.id = order_id and o.user_id = (select auth.uid())));
revoke all on public.pr_slot_groups, public.pr_blackouts, public.pr_bookings from anon;
revoke insert, update, delete on public.pr_bookings from authenticated;

-- ---------- listing payments can carry a coupon (and a "free by coupon" method) ----------
alter table public.listing_payments add column if not exists coupon_code text, add column if not exists discount numeric not null default 0, add column if not exists base_amount numeric;
alter table public.listing_payments drop constraint if exists listing_payments_method_check;
alter table public.listing_payments add constraint listing_payments_method_check check (method in ('bkash','nagad','rocket','upay','cellfin','tap','coupon'));
create index if not exists listing_payments_coupon on public.listing_payments (coupon_code) where coupon_code is not null;

-- ---------- seats taken on one day for one group (bookings of live orders + closed / reserved seats) ----------
create or replace function public._pr_seats(p_group text, p_day date)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.pr_bookings b join public.pr_orders o on o.id = b.order_id
                    where b.slot_group = p_group and b.day = p_day and o.deleted_at is null and o.status not in ('cancelled','rejected')), 0)
       + coalesce((select sum(coalesce(x.seats, 100000)) from public.pr_blackouts x
                    where x.day = p_day and x.deleted_at is null and (x.slot_group is null or x.slot_group = p_group)), 0)
$$;

-- ---------- availability of every group (signed-in users only) ----------
create or replace function public.get_pr_slots()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Dhaka')::date; r jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  with g as (select * from public.pr_slot_groups where active),
  taken as (select b.slot_group, b.day, count(*) n from public.pr_bookings b join public.pr_orders o on o.id = b.order_id
             where b.day >= today and o.deleted_at is null and o.status not in ('cancelled','rejected') group by 1, 2),
  blk as (select g.key as slot_group, x.day, sum(coalesce(x.seats, 100000)) n from public.pr_blackouts x join g on (x.slot_group is null or x.slot_group = g.key)
           where x.deleted_at is null and x.day >= today group by 1, 2)
  select coalesce(jsonb_object_agg(g.key, jsonb_build_object('name_bn', g.name_bn, 'name_en', g.name_en, 'cap', g.daily_cap, 'lead', g.lead_days, 'horizon', g.horizon_days,
      'days', (select jsonb_agg(jsonb_build_object('d', to_char(today + g.lead_days + i, 'YYYY-MM-DD'),
                 'left', greatest(g.daily_cap - coalesce(t.n, 0) - coalesce(k.n, 0), 0)) order by i)
               from generate_series(0, g.horizon_days - g.lead_days) i
               left join taken t on t.slot_group = g.key and t.day = today + g.lead_days + i
               left join blk k on k.slot_group = g.key and k.day = today + g.lead_days + i))), '{}'::jsonb)
    into r from g;
  return jsonb_build_object('today', to_char(today, 'YYYY-MM-DD'), 'groups', r);
end $$;

-- ---------- reserve the chosen days for an order (internal) ----------
create or replace function public._pr_book(p_order uuid, p_group text, p_days date[])
returns void language plpgsql security definer set search_path = public as $$
declare g public.pr_slot_groups; today date := (now() at time zone 'Asia/Dhaka')::date; d date; r record;
begin
  select * into g from public.pr_slot_groups where key = p_group and active;
  if g.key is null then raise exception 'PR: service_unavailable'; end if;
  perform pg_advisory_xact_lock(hashtext('prslot:' || p_group));
  foreach d in array p_days loop
    if d < today + g.lead_days or d > today + g.horizon_days then raise exception 'PR: date_invalid'; end if;
  end loop;
  for r in select x as day, count(*) as n from unnest(p_days) x group by x loop
    if public._pr_seats(p_group, r.day) + r.n > g.daily_cap then raise exception 'PR: date_full %', to_char(r.day, 'YYYY-MM-DD'); end if;
  end loop;
  insert into public.pr_bookings (order_id, slot_group, day) select p_order, p_group, x from unnest(p_days) x;
end $$;

-- ---------- admin: move one booked item to another day ----------
create or replace function public.admin_pr_move_booking(p_id uuid, p_day date, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.pr_bookings; o public.pr_orders; g public.pr_slot_groups; old date;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from public.pr_bookings where id = p_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  if p_day is null then raise exception 'Pick a date'; end if;
  select * into g from public.pr_slot_groups where key = b.slot_group;
  select * into o from public.pr_orders where id = b.order_id;
  perform pg_advisory_xact_lock(hashtext('prslot:' || b.slot_group));
  if p_day = b.day then return jsonb_build_object('id', b.id, 'day', b.day); end if;
  if not coalesce(p_force, false) and public._pr_seats(b.slot_group, p_day) + 1 > g.daily_cap then raise exception 'That day is already full for %', g.name_en; end if;
  old := b.day;
  update public.pr_bookings set day = p_day where id = p_id;
  if o.status not in ('cancelled', 'rejected') then
    perform public._notify(o.user_id, false, 'pr_status', 'Publish date changed: ' || o.order_no, 'প্রকাশের তারিখ বদলেছে: ' || o.order_no,
      'Your ' || o.service_name_en || ' moves from ' || to_char(old, 'DD Mon YYYY') || ' to ' || to_char(p_day, 'DD Mon YYYY') || '.',
      'আপনার ' || o.service_name_bn || ' ' || to_char(old, 'DD/MM/YYYY') || ' থেকে ' || to_char(p_day, 'DD/MM/YYYY') || '-এ সরানো হয়েছে।', '/pr#orders', jsonb_build_object('order', o.id));
  end if;
  return jsonb_build_object('id', b.id, 'day', p_day);
end $$;

-- ---------- one coupon check for everything (PR services and company listing) ----------
create or replace function public._coupon_check(p_uid uuid, p_code text, p_target text, p_base numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cc text := upper(btrim(coalesce(p_code, ''))); cd public.pr_coupons; used int; usedu int; disc numeric; keys_ok boolean; ok boolean;
begin
  if cc = '' then return jsonb_build_object('coupon', null, 'discount', 0, 'error', null); end if;
  select * into cd from public.pr_coupons where code = cc and deleted_at is null;
  if cd.id is null or not cd.active then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_invalid'); end if;
  keys_ok := cd.service_keys is null or cardinality(cd.service_keys) = 0 or p_target = any(cd.service_keys);
  ok := case cd.scope when 'listing' then p_target = 'listing' when 'pr' then p_target <> 'listing' and keys_ok else keys_ok end;
  if not ok then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_not_for_service'); end if;
  if cd.starts_at is not null and cd.starts_at > now() then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_not_started'); end if;
  if cd.expires_at is not null and cd.expires_at <= now() then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_expired'); end if;
  if p_base < cd.min_amount then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_min_amount'); end if;
  select (select count(*) from public.pr_orders where coupon_code = cc and status not in ('cancelled','rejected') and deleted_at is null)
       + (select count(*) from public.listing_payments where coupon_code = cc and status in ('pending','verified')),
         (select count(*) from public.pr_orders where coupon_code = cc and user_id = p_uid and status not in ('cancelled','rejected') and deleted_at is null)
       + (select count(*) from public.listing_payments where coupon_code = cc and user_id = p_uid and status in ('pending','verified'))
    into used, usedu;
  if cd.max_uses is not null and used >= cd.max_uses then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_used_up'); end if;
  if usedu >= cd.per_user then return jsonb_build_object('coupon', null, 'discount', 0, 'error', 'coupon_already_used'); end if;
  disc := case when cd.kind = 'percent' then round(p_base * cd.value / 100) else least(cd.value, p_base) end;
  if cd.max_discount is not null then disc := least(disc, cd.max_discount); end if;
  disc := least(greatest(disc, 0), p_base);
  return jsonb_build_object('coupon', cc, 'discount', disc, 'error', null);
end $$;

-- the PR price now uses the shared coupon check
create or replace function public._pr_price(p_uid uuid, p_service uuid, p_qty integer, p_code text, p_free boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.pr_services; cp public.pr_campaigns; q int; unit numeric; sub numeric; cc text := upper(btrim(coalesce(p_code, ''))); ck jsonb := '{"coupon":null,"discount":0,"error":null}'::jsonb;
begin
  select * into s from public.pr_services where id = p_service and active and deleted_at is null;
  if s.id is null then return jsonb_build_object('ok', false, 'code', 'service_unavailable'); end if;
  if p_free then
    cp := public._pr_live_campaign(s.key);
    if cp.id is null then return jsonb_build_object('ok', false, 'code', 'campaign_unavailable'); end if;
    if exists (select 1 from public.pr_orders where user_id = p_uid and campaign_id = cp.id and status not in ('cancelled','rejected') and deleted_at is null) then
      return jsonb_build_object('ok', false, 'code', 'campaign_used'); end if;
    return jsonb_build_object('ok', true, 'kind', 'free', 'qty', 1, 'unit', 0, 'subtotal', 0, 'discount', 0, 'amount', 0, 'campaign', cp.id);
  end if;
  q := greatest(s.min_qty, least(s.max_qty, coalesce(p_qty, 1)));
  if s.price is null then
    return jsonb_build_object('ok', true, 'kind', 'quote', 'qty', q, 'unit', null, 'subtotal', null, 'discount', 0, 'amount', null, 'coupon_error', case when cc <> '' then 'not_for_quote' end);
  end if;
  unit := s.price; sub := unit * q;
  if cc <> '' then ck := public._coupon_check(p_uid, cc, s.key, sub); end if;
  return jsonb_build_object('ok', true, 'kind', 'paid', 'qty', q, 'unit', unit, 'subtotal', sub, 'discount', (ck ->> 'discount')::numeric, 'amount', greatest(sub - (ck ->> 'discount')::numeric, 0),
    'coupon', ck ->> 'coupon', 'coupon_error', ck ->> 'error');
end $$;

revoke all on function public._pr_seats(text, date), public._pr_book(uuid, text, date[]), public._coupon_check(uuid, text, text, numeric), public._pr_price(uuid, uuid, int, text, boolean) from public, anon, authenticated;
revoke all on function public.get_pr_slots(), public.admin_pr_move_booking(uuid, date, boolean) from public, anon;
grant execute on function public.get_pr_slots(), public.admin_pr_move_booking(uuid, date, boolean) to authenticated;

-- =====================================================================================================
-- PART 2 — orders with dates + custom fields, public data, listing coupons, revenue
-- =====================================================================================================

create or replace function public.get_pr_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'page', coalesce((select value from public.site_settings where key = 'pr_page'), '{}'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'key', key, 'category', category, 'icon', icon, 'name_bn', name_bn, 'name_en', name_en, 'desc_bn', desc_bn, 'desc_en', desc_en,
        'unit_bn', unit_bn, 'unit_en', unit_en, 'price', price, 'min_qty', min_qty, 'max_qty', max_qty, 'popular', popular, 'slot_group', slot_group, 'notice_bn', notice_bn, 'notice_en', notice_en, 'extra_fields', extra_fields) order by sort, created_at)
        from public.pr_services where active and deleted_at is null), '[]'::jsonb),
    'campaign', (select jsonb_build_object('id', c.id, 'title_bn', c.title_bn, 'title_en', c.title_en, 'text_bn', c.text_bn, 'text_en', c.text_en, 'service_keys', c.service_keys, 'ends_at', c.ends_at,
        'slots_left', case when c.max_slots is null then null else greatest(c.max_slots - (select count(*) from public.pr_orders o where o.campaign_id = c.id and o.status not in ('cancelled','rejected') and o.deleted_at is null), 0) end)
      from public._pr_live_campaign(null) c where c.id is not null),
    'methods', (select value from public.site_settings where key = 'payment_methods')) $$;
-- the page is for signed-in people only (prices, payment numbers and dates are not public)
revoke all on function public.get_pr_public() from public, anon;
grant execute on function public.get_pr_public() to authenticated;

create or replace function public.pr_submit_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b jsonb := case when jsonb_typeof(p -> 'brief') = 'object' then p -> 'brief' else '{}'::jsonb end; brief jsonb := '{}'::jsonb; r record; v text;
        pr jsonb; s public.pr_services; oid uuid; ono text; knd text; amt numeric; free boolean := coalesce((p ->> 'free')::boolean, false); cc text := upper(btrim(coalesce(p ->> 'coupon', '')));
        nm text; ph text; em text; br text; wh text; pe boolean := (public._txt(p ->> 'trx', 40) is not null);
        dts date[] := '{}'; fld jsonb; fv text; extra jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('prorder', 8, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  for r in select * from (values ('name',80),('phone',20),('email',120),('brand',120),('website',200),('social_url',200),('what',1500),('goal',40),('audience',200),('lang',10),('date',10),
      ('key_points',1200),('assets',600),('content_by',20),('article_link',200),('keywords',200),('concept',1200),('footage',20),('duration',20),('location',120),('budget',60),
      ('event_date',10),('venue',160),('prize',200),('handles',200),('notes',1200)) as t(k, mx) loop
    v := public._txt(b ->> r.k, r.mx);
    if v is not null then brief := brief || jsonb_build_object(r.k, v); end if;
  end loop;
  nm := brief ->> 'name'; ph := regexp_replace(coalesce(brief ->> 'phone', ''), '[\s-]', '', 'g'); em := lower(coalesce(brief ->> 'email', '')); br := brief ->> 'brand'; wh := brief ->> 'what';
  if nm is null or char_length(nm) < 2 then raise exception 'Please enter your name'; end if;
  if ph !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail address'; end if;
  if br is null or char_length(br) < 2 then raise exception 'Please enter your brand or company name'; end if;
  if wh is null or char_length(wh) < 20 then raise exception 'Please describe what you want to promote (at least 20 characters)'; end if;
  brief := brief || jsonb_build_object('phone', regexp_replace(ph, '^\+?88', ''), 'email', em);
  foreach v in array array['website','social_url','article_link'] loop
    if brief ->> v is not null and (brief ->> v) !~* '^https?://' then brief := brief || jsonb_build_object(v, 'https://' || (brief ->> v)); end if;
  end loop;
  foreach v in array array['date','event_date'] loop
    if brief ->> v is not null and (brief ->> v) !~ '^\d{4}-\d{2}-\d{2}$' then brief := brief - v; end if;
  end loop;
  if cc <> '' then perform pg_advisory_xact_lock(hashtext('prcoupon:' || cc)); end if;
  perform pg_advisory_xact_lock(hashtext('pruser:' || uid::text));
  pr := public._pr_price(uid, (p ->> 'service')::uuid, coalesce((p ->> 'qty')::int, 1), cc, free);
  if coalesce((pr ->> 'ok')::boolean, false) is not true then raise exception 'PR: %', pr ->> 'code'; end if;
  if pr ->> 'coupon_error' is not null and cc <> '' and (pr ->> 'kind') = 'paid' then raise exception 'PR: %', pr ->> 'coupon_error'; end if;
  select * into s from public.pr_services where id = (p ->> 'service')::uuid;
  knd := pr ->> 'kind'; amt := (pr ->> 'amount')::numeric;
  -- publish dates (only for services that are booked on a calendar)
  if s.slot_group is not null then
    begin
      select coalesce(array_agg(t::date order by t), '{}') into dts from jsonb_array_elements_text(case when jsonb_typeof(p -> 'dates') = 'array' then p -> 'dates' else '[]'::jsonb end) t;
    exception when others then raise exception 'PR: date_invalid';
    end;
    if coalesce(array_length(dts, 1), 0) <> (pr ->> 'qty')::int then raise exception 'PR: dates_required'; end if;
    brief := brief - 'date';
  end if;
  -- fields the admin added for this service
  for fld in select * from jsonb_array_elements(s.extra_fields) loop
    fv := public._txt(b #>> array['extra', fld ->> 'id'], case when fld ->> 'type' = 'textarea' then 1200 else 300 end);
    if fv is null then
      if coalesce((fld ->> 'required')::boolean, false) then raise exception 'PR: field_required %', coalesce(fld ->> 'en', fld ->> 'id'); end if;
      continue;
    end if;
    if fld ->> 'type' = 'select' and not exists (select 1 from jsonb_array_elements(coalesce(fld -> 'options', '[]'::jsonb)) o where o ->> 'en' = fv) then raise exception 'PR: field_invalid'; end if;
    if fld ->> 'type' = 'number' and fv !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'PR: field_invalid'; end if;
    if fld ->> 'type' = 'date' and fv !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'PR: field_invalid'; end if;
    if fld ->> 'type' = 'url' and fv !~* '^https?://' then fv := 'https://' || fv; end if;
    extra := extra || jsonb_build_array(jsonb_build_object('id', fld ->> 'id', 'bn', fld ->> 'bn', 'en', fld ->> 'en', 'v', fv));
  end loop;
  if jsonb_array_length(extra) > 0 then brief := brief || jsonb_build_object('extra', extra); end if;
  ono := 'PR-' || to_char(timezone('Asia/Dhaka', now()), 'YYMM') || '-' || lpad(nextval('public.pr_order_seq')::text, 4, '0');
  insert into public.pr_orders (order_no, user_id, user_email, service_id, service_key, service_name_en, service_name_bn, qty, unit_price, subtotal, coupon_code, discount, amount, campaign_id, kind, brief, pay_status, paid_at, verified_by)
  values (ono, uid, lower(auth.jwt() ->> 'email'), s.id, s.key, s.name_en, s.name_bn, (pr ->> 'qty')::int, (pr ->> 'unit')::numeric, (pr ->> 'subtotal')::numeric, nullif(pr ->> 'coupon', ''), coalesce((pr ->> 'discount')::numeric, 0), amt,
          nullif(pr ->> 'campaign', '')::uuid, knd, brief, case when knd = 'paid' and amt = 0 then 'verified' else 'none' end, case when knd = 'paid' and amt = 0 then now() end, case when knd = 'paid' and amt = 0 then 'coupon' end)
  returning id into oid;
  if s.slot_group is not null then perform public._pr_book(oid, s.slot_group, dts); end if;
  if knd = 'paid' and amt > 0 and pe then perform public._pr_apply_payment(oid, coalesce(p ->> 'method', ''), p ->> 'sender', p ->> 'trx'); end if;
  perform public._notify(null, true, 'pr_order', 'New PR order: ' || ono, 'নতুন পিআর অর্ডার: ' || ono,
    s.name_en || ' × ' || (pr ->> 'qty') || ' · ' || coalesce('৳' || amt::text, 'quote request') || ' · ' || br, s.name_bn || ' × ' || (pr ->> 'qty') || ' · ' || coalesce('৳' || amt::text, 'কোটেশন অনুরোধ') || ' · ' || br, '/admin/#/pr', jsonb_build_object('order', oid));
  return jsonb_build_object('id', oid, 'order_no', ono, 'kind', knd, 'amount', amt, 'pay_status', (select pay_status from public.pr_orders where id = oid), 'dates', to_jsonb(dts));
end $$;

-- ---------- company listing fee: coupon support ----------
create or replace function public.listing_quote(p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); fee numeric; ck jsonb;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select coalesce((value #>> '{}')::numeric, 1000) into fee from public.site_settings where key = 'listing_fee';
  fee := coalesce(fee, 1000);
  ck := public._coupon_check(uid, p_code, 'listing', fee);
  return jsonb_build_object('fee', fee, 'discount', (ck ->> 'discount')::numeric, 'amount', greatest(fee - (ck ->> 'discount')::numeric, 0), 'coupon', ck ->> 'coupon', 'coupon_error', ck ->> 'error');
end $$;

drop function if exists public.submit_listing_payment(uuid, text, text, text);
create or replace function public.submit_listing_payment(p_company uuid, p_method text, p_sender text, p_trx text, p_coupon text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st text; owner_ uuid; fee numeric; m jsonb; trx text := upper(regexp_replace(coalesce(p_trx, ''), '\s', '', 'g')); snd text := regexp_replace(coalesce(p_sender, ''), '[\s-]', '', 'g'); inv text; n int; pid uuid; nm text;
        cc text := upper(btrim(coalesce(p_coupon, ''))); ck jsonb; disc numeric := 0; net numeric;
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
  fee := coalesce(fee, 1000);
  if cc <> '' then
    perform pg_advisory_xact_lock(hashtext('prcoupon:' || cc));
    ck := public._coupon_check(uid, cc, 'listing', fee);
    if ck ->> 'error' is not null then raise exception 'PR: %', ck ->> 'error'; end if;
    disc := (ck ->> 'discount')::numeric;
  end if;
  net := greatest(fee - disc, 0);
  if net <= 0 then raise exception 'This coupon covers the whole fee — apply it without a payment'; end if;
  if exists (select 1 from public.listing_payments where company_id = p_company and status in ('pending', 'verified')) then raise exception 'A payment for this application is already recorded'; end if;
  n := (select count(*) from public.listing_payments where company_id = p_company) + 1;
  inv := 'VL-' || upper(left(replace(p_company::text, '-', ''), 8)) || case when n > 1 then '-' || n else '' end;
  begin
    insert into public.listing_payments (invoice_no, company_id, user_id, user_email, method, amount, sender_msisdn, trx_id, coupon_code, discount, base_amount)
    values (inv, p_company, uid, lower(auth.jwt() ->> 'email'), p_method, net, snd, trx, nullif(cc, ''), disc, fee) returning id into pid;
  exception when unique_violation then raise exception 'This Transaction ID has already been used';
  end;
  perform public._notify(null, true, 'payment_submitted', 'Payment to check: ' || inv, 'পেমেন্ট যাচাই করুন: ' || inv, p_method || ' · TrxID ' || trx || ' · ৳' || net::text || ' · ' || coalesce(nm, ''), p_method || ' · TrxID ' || trx || ' · ৳' || net::text || ' · ' || coalesce(nm, ''), '/admin/', jsonb_build_object('company', p_company, 'payment', pid));
  return jsonb_build_object('id', pid, 'invoice_no', inv, 'status', 'pending', 'amount', net);
end $$;

-- a coupon that covers the whole listing fee: no payment, the fee is recorded as paid (৳0)
create or replace function public.apply_listing_free(p_company uuid, p_coupon text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st text; owner_ uuid; fee numeric; cc text := upper(btrim(coalesce(p_coupon, ''))); ck jsonb; inv text; n int; pid uuid; nm text;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('pay', 8, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  select c.status, cp.owner_id, c.name into st, owner_, nm from public.companies c join public.company_private cp on cp.company_id = c.id where c.id = p_company;
  if owner_ is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if st not in ('draft', 'changes_requested') then raise exception 'Payment is not needed for this application'; end if;
  if cc = '' then raise exception 'PR: coupon_invalid'; end if;
  select (value #>> '{}')::numeric into fee from public.site_settings where key = 'listing_fee';
  fee := coalesce(fee, 1000);
  perform pg_advisory_xact_lock(hashtext('prcoupon:' || cc));
  ck := public._coupon_check(uid, cc, 'listing', fee);
  if ck ->> 'error' is not null then raise exception 'PR: %', ck ->> 'error'; end if;
  if fee - (ck ->> 'discount')::numeric > 0 then raise exception 'This coupon does not cover the whole fee'; end if;
  if exists (select 1 from public.listing_payments where company_id = p_company and status in ('pending', 'verified')) then raise exception 'A payment for this application is already recorded'; end if;
  n := (select count(*) from public.listing_payments where company_id = p_company) + 1;
  inv := 'VL-' || upper(left(replace(p_company::text, '-', ''), 8)) || case when n > 1 then '-' || n else '' end;
  insert into public.listing_payments (invoice_no, company_id, user_id, user_email, method, amount, sender_msisdn, trx_id, status, verified_at, verified_by, coupon_code, discount, base_amount)
  values (inv, p_company, uid, lower(auth.jwt() ->> 'email'), 'coupon', 0, '-', 'CPN-' || cc || '-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 6)), 'verified', now(), 'coupon', cc, fee, fee) returning id into pid;
  perform public._notify(null, true, 'payment_submitted', 'Listing fee waived by coupon: ' || inv, 'কুপনে লিস্টিং ফি মওকুফ: ' || inv, cc || ' · ' || coalesce(nm, ''), cc || ' · ' || coalesce(nm, ''), '/admin/', jsonb_build_object('company', p_company, 'payment', pid));
  return jsonb_build_object('id', pid, 'invoice_no', inv, 'status', 'verified', 'amount', 0);
end $$;

-- ---------- revenue totals now include PR ----------
do $$ begin
  if exists (select 1 from pg_proc where proname = 'admin_overview_totals' and pronamespace = 'public'::regnamespace)
     and not exists (select 1 from pg_proc where proname = '_admin_overview_totals_base' and pronamespace = 'public'::regnamespace) then
    alter function public.admin_overview_totals() rename to _admin_overview_totals_base;
  end if;
end $$;
create or replace function public.admin_overview_totals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare base jsonb := public._admin_overview_totals_base(); today date := (now() at time zone 'Asia/Dhaka')::date; rv jsonb; prv jsonb;
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
  rv := rv || prv || jsonb_build_object(
    'total_verified', coalesce((rv ->> 'listing_verified')::numeric, 0) + (prv ->> 'pr_verified')::numeric,
    'total_30d', coalesce((rv ->> 'listing_30d')::numeric, 0) + (prv ->> 'pr_30d')::numeric,
    'total_today', coalesce((rv ->> 'listing_today')::numeric, 0) + (prv ->> 'pr_today')::numeric,
    'total_pending', coalesce((rv ->> 'listing_pending')::numeric, 0) + (prv ->> 'pr_pending')::numeric);
  return base || jsonb_build_object('revenue', rv);
end $$;

revoke all on function public._admin_overview_totals_base() from public, anon, authenticated;
revoke all on function public.admin_overview_totals() from public, anon;
grant execute on function public.admin_overview_totals() to authenticated;
revoke all on function public.pr_submit_order(jsonb) from public, anon;
grant execute on function public.pr_submit_order(jsonb) to authenticated;
revoke all on function public.listing_quote(text), public.apply_listing_free(uuid, text), public.submit_listing_payment(uuid, text, text, text, text) from public, anon;
grant execute on function public.listing_quote(text), public.apply_listing_free(uuid, text), public.submit_listing_payment(uuid, text, text, text, text) to authenticated;
