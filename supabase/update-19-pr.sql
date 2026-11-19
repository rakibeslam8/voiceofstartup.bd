-- Voice of Startup Bangladesh — update 19: PR / paid-promotion orders (page /pr)
-- Additive only. Nothing is ever physically deleted (soft delete via deleted_at / status).
-- Money is collected the same way as the company listing fee: the buyer sends money by bKash (or another enabled method
-- from site_settings.payment_methods) and enters the TrxID; the admin matches it in the mobile-wallet app and verifies.

create sequence if not exists public.pr_order_seq;

-- ---------- service catalogue (admin edits everything) ----------
create table if not exists public.pr_services (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_-]{2,40}$'),
  category text not null default 'content' check (category in ('content','video','campaign','partner','other')),
  icon text not null default '📰' check (char_length(icon) <= 8),
  name_bn text not null check (char_length(name_bn) between 2 and 120),
  name_en text not null check (char_length(name_en) between 2 and 120),
  desc_bn text check (char_length(desc_bn) <= 600),
  desc_en text check (char_length(desc_en) <= 600),
  unit_bn text not null default 'প্রতি আইটেম' check (char_length(unit_bn) <= 40),
  unit_en text not null default 'per item' check (char_length(unit_en) <= 40),
  price numeric check (price is null or (price >= 0 and price <= 100000000)),   -- null = "get a quote"
  min_qty int not null default 1 check (min_qty between 1 and 50),
  max_qty int not null default 10 check (max_qty between 1 and 50),
  active boolean not null default true,
  popular boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (max_qty >= min_qty)
);

-- ---------- free campaigns (sometimes we run a free article / post campaign) ----------
create table if not exists public.pr_campaigns (
  id uuid primary key default gen_random_uuid(),
  title_bn text not null check (char_length(title_bn) between 2 and 140),
  title_en text not null check (char_length(title_en) between 2 and 140),
  text_bn text check (char_length(text_bn) <= 800),
  text_en text check (char_length(text_en) <= 800),
  service_keys text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  max_slots int check (max_slots is null or max_slots >= 1),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- coupons (generic: scope says where a code works) ----------
create table if not exists public.pr_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind text not null check (kind in ('percent','fixed')),
  value numeric not null check (value > 0 and value <= 100000000),
  min_amount numeric not null default 0 check (min_amount >= 0),
  max_discount numeric check (max_discount is null or max_discount > 0),
  scope text not null default 'pr' check (scope in ('pr','listing','all')),
  service_keys text[],                                  -- null / empty = every service
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses >= 1),
  per_user int not null default 1 check (per_user >= 1),
  active boolean not null default true,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (kind <> 'percent' or value <= 100)
);

-- ---------- orders ----------
create table if not exists public.pr_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null,
  user_email text,
  service_id uuid references public.pr_services(id),
  service_key text not null,
  service_name_en text not null,
  service_name_bn text not null,
  qty int not null default 1 check (qty between 1 and 50),
  unit_price numeric,
  subtotal numeric,
  coupon_code text,
  discount numeric not null default 0,
  amount numeric check (amount is null or amount >= 0),     -- null = quote not given yet
  campaign_id uuid references public.pr_campaigns(id),
  kind text not null check (kind in ('paid','quote','free')),
  brief jsonb not null default '{}'::jsonb,
  pay_method text,
  sender_msisdn text,
  trx_id text,
  pay_status text not null default 'none' check (pay_status in ('none','pending','verified','rejected')),
  paid_at timestamptz,
  verified_by text,
  status text not null default 'new' check (status in ('new','confirmed','in_progress','delivered','cancelled','rejected')),
  admin_note text,                 -- shown to the buyer
  delivered_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists pr_orders_trx_active on public.pr_orders (trx_id) where trx_id is not null and pay_status in ('pending','verified');
create index if not exists pr_orders_user on public.pr_orders (user_id, created_at desc);
create index if not exists pr_orders_status on public.pr_orders (status, created_at desc);
create index if not exists pr_orders_coupon on public.pr_orders (coupon_code) where coupon_code is not null;
create index if not exists pr_orders_campaign on public.pr_orders (campaign_id) where campaign_id is not null;
create index if not exists pr_orders_service on public.pr_orders (service_id);

-- admin-only notes live in their own table so a buyer can never read them through the API
create table if not exists public.pr_order_private (
  order_id uuid primary key references public.pr_orders(id),
  internal_note text check (char_length(internal_note) <= 1000),
  updated_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table public.pr_services  enable row level security;
alter table public.pr_campaigns enable row level security;
alter table public.pr_coupons   enable row level security;
alter table public.pr_orders    enable row level security;
alter table public.pr_order_private enable row level security;
drop policy if exists "Admin manages pr order notes" on public.pr_order_private;
create policy "Admin manages pr order notes" on public.pr_order_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin manages pr services" on public.pr_services;
drop policy if exists "Admin manages pr campaigns" on public.pr_campaigns;
drop policy if exists "Admin manages pr coupons" on public.pr_coupons;
drop policy if exists "Read own pr orders" on public.pr_orders;
create policy "Admin manages pr services"  on public.pr_services  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages pr campaigns" on public.pr_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages pr coupons"   on public.pr_coupons   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Read own pr orders" on public.pr_orders for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke all on public.pr_services, public.pr_campaigns, public.pr_coupons, public.pr_orders, public.pr_order_private from anon;
revoke insert, update, delete on public.pr_orders from authenticated;      -- orders change only through the checked functions below

-- ---------- default page settings (admin edits these in Admin → Ads & PR → Page) ----------
insert into public.site_settings (key, value) values ('pr_page', jsonb_build_object(
  'enabled', true,
  'stats', jsonb_build_object('avg_views', 30000, 'peak_min', 70000, 'peak_max', 130000, 'monthly_visitors', 20000),
  'contact_email', 'partnerships@voiceofstartup.bd', 'whatsapp', '',
  'intro_bn', '', 'intro_en', '')) on conflict (key) do nothing;

-- ---------- starting service list (prices from the owner; the rest are "get a quote" until the admin sets a price) ----------
insert into public.pr_services (key, category, icon, name_bn, name_en, desc_bn, desc_en, unit_bn, unit_en, price, max_qty, popular, sort) values
 ('article','content','📰','স্পনসর্ড আর্টিকেল','Sponsored article','আপনার ব্র্যান্ড বা গল্প নিয়ে লেখা আর্টিকেল VOSB ওয়েবসাইটে বাংলা ও ইংরেজি দুই ভাষায় প্রকাশ হবে। “Sponsored” লেবেল সহ।','Your brand or story as an article on the VOSB website in Bangla and English, clearly labelled Sponsored.','প্রতি আর্টিকেল','per article',4000,10,true,10),
 ('post','content','📣','ফেসবুক পোস্ট','Facebook post','Voice of Startup Bangladesh ফেসবুক পেজে প্রমোশনাল পোস্ট। গড়ে প্রতি পোস্টে ৩০ হাজার ভিউ; ভালো পোস্টে ৭০ হাজার–১.৩ লাখ।','A promotional post on the Voice of Startup Bangladesh Facebook page. Average 30K views per post; strong posts reach 70K–130K.','প্রতি পোস্ট','per post',4000,20,true,20),
 ('reel','video','🎬','রিলস / শর্ট ভিডিও','Reel / short video','ছোট ভিডিও বা রিলস আকারে আপনার পণ্য, সেবা বা ইভেন্টের প্রচার।','Your product, service or event promoted as a short vertical video / Reel.','প্রতি রিলস','per reel',7000,10,true,30),
 ('combo','campaign','🚀','প্যাকেজ: আর্টিকেল + পোস্ট + রিলস','Package: article + post + reel','একই ক্যাম্পেইনে ওয়েবসাইট, পেজ ও ভিডিও — একসাথে বেশি রিচ।','One campaign across the website, the page and video — more reach together.','প্রতি প্যাকেজ','per package',null,5,false,40),
 ('founder_story','content','🎙️','ফাউন্ডার স্টোরি / ইন্টারভিউ','Founder story / interview','আপনার উদ্যোক্তা-যাত্রা নিয়ে বিস্তারিত ফিচার বা ইন্টারভিউ।','An in-depth feature or interview about your founder journey.','প্রতি ফিচার','per feature',null,5,false,50),
 ('press_release','content','📄','প্রেস রিলিজ প্রকাশ','Press release publishing','আপনার প্রেস রিলিজ সম্পাদনা করে ওয়েবসাইটে প্রকাশ।','Your press release edited and published on the website.','প্রতি রিলিজ','per release',null,10,false,60),
 ('hiring','content','💼','নিয়োগ / চাকরির প্রচার','Job & hiring promotion','আপনার নিয়োগ বিজ্ঞপ্তি ওয়েবসাইট ও পেজে প্রচার।','Promote your job openings on the website and the page.','প্রতি বিজ্ঞপ্তি','per opening',null,10,false,70),
 ('newsletter','content','✉️','নিউজলেটার স্পনসরশিপ','Newsletter sponsorship','আমাদের নিউজলেটার সাবস্ক্রাইবারদের কাছে আপনার মেসেজ।','Your message to our newsletter subscribers.','প্রতি সংখ্যা','per issue',null,10,false,80),
 ('banner','other','🖼️','ওয়েবসাইট ব্যানার বিজ্ঞাপন','Website banner ad','ওয়েবসাইটের নির্দিষ্ট জায়গায় মাসিক ব্যানার বিজ্ঞাপন।','A monthly banner ad in a chosen spot on the website.','প্রতি মাস','per month',null,12,false,90),
 ('top_story','other','⭐','টপ স্টোরি / হোমপেজ প্লেসমেন্ট','Top story / homepage placement','আপনার আর্টিকেল হোমপেজের টপ স্টোরি হিসেবে বেশি সময় দৃশ্যমান।','Keep your article visible as a top story on the homepage for longer.','প্রতি সপ্তাহ','per week',null,8,false,100),
 ('event','campaign','🎪','ইভেন্ট / লঞ্চ কভারেজ','Event / launch coverage','আপনার ইভেন্ট, প্রোডাক্ট বা অ্যাপ লঞ্চের কভারেজ ও প্রচার।','Coverage and promotion for your event, product or app launch.','প্রতি ইভেন্ট','per event',null,5,false,110),
 ('giveaway','campaign','🎁','গিভঅ্যাওয়ে / কনটেস্ট কোলাব','Giveaway / contest collaboration','আপনার ব্র্যান্ডের সাথে যৌথ গিভঅ্যাওয়ে বা প্রতিযোগিতা।','A joint giveaway or contest with your brand.','প্রতি ক্যাম্পেইন','per campaign',null,5,false,120),
 ('research','content','📊','স্পনসর্ড সার্ভে / রিপোর্ট','Sponsored survey / report','স্টার্টআপ ও ব্যবসা নিয়ে সার্ভে বা রিপোর্টের স্পনসরশিপ।','Sponsor a startup or business survey / report.','প্রতি রিপোর্ট','per report',null,3,false,130),
 ('collab','partner','🤝','ব্র্যান্ড কোলাবরেশন / দীর্ঘমেয়াদি পার্টনারশিপ','Brand collaboration / long-term partnership','মাসিক বা বার্ষিক পার্টনারশিপ — নিয়মিত কনটেন্ট ও প্রচার।','Monthly or yearly partnership with regular content and promotion.','প্রতি মাস','per month',null,12,false,140),
 ('other','other','💬','অন্য কোনো আইডিয়া','Something else','আপনার আলাদা আইডিয়া বা প্রয়োজন থাকলে জানান — আমরা প্রস্তাব দেব।','Have another idea or need? Tell us and we will propose a plan.','প্রতি প্রজেক্ট','per project',null,1,false,900)
on conflict (key) do nothing;

-- ---------- helpers ----------
create or replace function public._pr_live_campaign(p_service_key text)
returns public.pr_campaigns language sql stable security definer set search_path = public as $$
  select c.* from public.pr_campaigns c
  where c.active and c.deleted_at is null
    and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
    and (p_service_key is null or p_service_key = any(c.service_keys))
    and (c.max_slots is null or (select count(*) from public.pr_orders o where o.campaign_id = c.id and o.status not in ('cancelled','rejected') and o.deleted_at is null) < c.max_slots)
  order by c.created_at desc limit 1 $$;

-- price (and coupon) calculator used by the page preview AND by the order function, so both always agree
create or replace function public._pr_price(p_uid uuid, p_service uuid, p_qty int, p_code text, p_free boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.pr_services; cp public.pr_campaigns; q int; unit numeric; sub numeric; disc numeric := 0; cd public.pr_coupons;
        cc text := upper(btrim(coalesce(p_code, ''))); cerr text; used int; usedu int;
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
  if cc <> '' then
    select * into cd from public.pr_coupons where code = cc and deleted_at is null;
    if cd.id is null or not cd.active or cd.scope not in ('pr','all') then cerr := 'coupon_invalid';
    elsif cd.starts_at is not null and cd.starts_at > now() then cerr := 'coupon_not_started';
    elsif cd.expires_at is not null and cd.expires_at <= now() then cerr := 'coupon_expired';
    elsif cd.service_keys is not null and cardinality(cd.service_keys) > 0 and not (s.key = any(cd.service_keys)) then cerr := 'coupon_not_for_service';
    elsif sub < cd.min_amount then cerr := 'coupon_min_amount';
    else
      select count(*), count(*) filter (where user_id = p_uid) into used, usedu from public.pr_orders where coupon_code = cc and status not in ('cancelled','rejected') and deleted_at is null;
      if cd.max_uses is not null and used >= cd.max_uses then cerr := 'coupon_used_up';
      elsif usedu >= cd.per_user then cerr := 'coupon_already_used';
      end if;
    end if;
    if cerr is null then
      disc := case when cd.kind = 'percent' then round(sub * cd.value / 100) else least(cd.value, sub) end;
      if cd.max_discount is not null then disc := least(disc, cd.max_discount); end if;
      disc := least(greatest(disc, 0), sub);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'kind', 'paid', 'qty', q, 'unit', unit, 'subtotal', sub, 'discount', disc, 'amount', greatest(sub - disc, 0),
    'coupon', case when cerr is null and cc <> '' then cc end, 'coupon_error', cerr);
end $$;

-- validates and records the mobile-wallet payment details on an order (internal)
create or replace function public._pr_apply_payment(p_order uuid, p_method text, p_sender text, p_trx text)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; trx text := upper(regexp_replace(coalesce(p_trx, ''), '\s', '', 'g')); snd text := regexp_replace(coalesce(p_sender, ''), '[\s-]', '', 'g'); o public.pr_orders;
begin
  select * into o from public.pr_orders where id = p_order;
  select value -> p_method into m from public.site_settings where key = 'payment_methods';
  if m is null or coalesce((m ->> 'enabled')::boolean, false) is not true then raise exception 'This payment method is not available yet'; end if;
  if trx !~ '^[A-Z0-9]{8,14}$' then raise exception 'Enter the Transaction ID exactly as shown in your payment SMS (letters and numbers)'; end if;
  if snd !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter the mobile number you sent money from (01XXXXXXXXX)'; end if;
  snd := regexp_replace(snd, '^\+?88', '');
  if exists (select 1 from public.listing_payments where trx_id = trx) then raise exception 'This Transaction ID has already been used'; end if;
  begin
    update public.pr_orders set pay_method = p_method, sender_msisdn = snd, trx_id = trx, pay_status = 'pending', updated_at = now() where id = p_order;
  exception when unique_violation then raise exception 'This Transaction ID has already been used';
  end;
  perform public._notify(null, true, 'pr_payment', 'PR payment to check: ' || o.order_no, 'পিআর পেমেন্ট যাচাই করুন: ' || o.order_no,
    p_method || ' · TrxID ' || trx || ' · ৳' || coalesce(o.amount, 0)::text, p_method || ' · TrxID ' || trx || ' · ৳' || coalesce(o.amount, 0)::text, '/admin/#/pr', jsonb_build_object('order', p_order));
end $$;

-- ---------- public data for the page ----------
create or replace function public.get_pr_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'page', coalesce((select value from public.site_settings where key = 'pr_page'), '{}'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'key', key, 'category', category, 'icon', icon, 'name_bn', name_bn, 'name_en', name_en, 'desc_bn', desc_bn, 'desc_en', desc_en,
        'unit_bn', unit_bn, 'unit_en', unit_en, 'price', price, 'min_qty', min_qty, 'max_qty', max_qty, 'popular', popular) order by sort, created_at) from public.pr_services where active and deleted_at is null), '[]'::jsonb),
    'campaign', (select jsonb_build_object('id', c.id, 'title_bn', c.title_bn, 'title_en', c.title_en, 'text_bn', c.text_bn, 'text_en', c.text_en, 'service_keys', c.service_keys, 'ends_at', c.ends_at,
        'slots_left', case when c.max_slots is null then null else greatest(c.max_slots - (select count(*) from public.pr_orders o where o.campaign_id = c.id and o.status not in ('cancelled','rejected') and o.deleted_at is null), 0) end)
      from public._pr_live_campaign(null) c where c.id is not null),
    'methods', case when auth.uid() is null
      then (select jsonb_object_agg(k, v - 'number') from jsonb_each((select value from public.site_settings where key = 'payment_methods')) as t(k, v))
      else (select value from public.site_settings where key = 'payment_methods') end) $$;

create or replace function public.pr_quote(p_service uuid, p_qty int, p_code text default null, p_free boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('prquote', 80, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  return public._pr_price(auth.uid(), p_service, p_qty, p_code, coalesce(p_free, false));
end $$;

-- ---------- place an order ----------
create or replace function public.pr_submit_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b jsonb := case when jsonb_typeof(p -> 'brief') = 'object' then p -> 'brief' else '{}'::jsonb end; brief jsonb := '{}'::jsonb; r record; v text;
        pr jsonb; s public.pr_services; oid uuid; ono text; knd text; amt numeric; free boolean := coalesce((p ->> 'free')::boolean, false); cc text := upper(btrim(coalesce(p ->> 'coupon', '')));
        nm text; ph text; em text; br text; wh text; pe boolean := (public._txt(p ->> 'trx', 40) is not null);
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
  ono := 'PR-' || to_char(timezone('Asia/Dhaka', now()), 'YYMM') || '-' || lpad(nextval('public.pr_order_seq')::text, 4, '0');
  insert into public.pr_orders (order_no, user_id, user_email, service_id, service_key, service_name_en, service_name_bn, qty, unit_price, subtotal, coupon_code, discount, amount, campaign_id, kind, brief, pay_status, paid_at, verified_by)
  values (ono, uid, lower(auth.jwt() ->> 'email'), s.id, s.key, s.name_en, s.name_bn, (pr ->> 'qty')::int, (pr ->> 'unit')::numeric, (pr ->> 'subtotal')::numeric, nullif(pr ->> 'coupon', ''), coalesce((pr ->> 'discount')::numeric, 0), amt,
          nullif(pr ->> 'campaign', '')::uuid, knd, brief, case when knd = 'paid' and amt = 0 then 'verified' else 'none' end, case when knd = 'paid' and amt = 0 then now() end, case when knd = 'paid' and amt = 0 then 'coupon' end)
  returning id into oid;
  if knd = 'paid' and amt > 0 and pe then perform public._pr_apply_payment(oid, coalesce(p ->> 'method', ''), p ->> 'sender', p ->> 'trx'); end if;
  perform public._notify(null, true, 'pr_order', 'New PR order: ' || ono, 'নতুন পিআর অর্ডার: ' || ono,
    s.name_en || ' × ' || (pr ->> 'qty') || ' · ' || coalesce('৳' || amt::text, 'quote request') || ' · ' || br, s.name_bn || ' × ' || (pr ->> 'qty') || ' · ' || coalesce('৳' || amt::text, 'কোটেশন অনুরোধ') || ' · ' || br, '/admin/#/pr', jsonb_build_object('order', oid));
  return jsonb_build_object('id', oid, 'order_no', ono, 'kind', knd, 'amount', amt, 'pay_status', (select pay_status from public.pr_orders where id = oid));
end $$;

-- pay (or re-pay after a rejection / after a quote) for an order you own
create or replace function public.pr_pay_order(p_id uuid, p_method text, p_sender text, p_trx text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.pr_orders;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('prpay', 10, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  select * into o from public.pr_orders where id = p_id and deleted_at is null;
  if o.id is null or o.user_id <> uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if o.status not in ('new','confirmed') or coalesce(o.amount, 0) <= 0 or o.pay_status not in ('none','rejected') then raise exception 'Payment is not needed for this order'; end if;
  perform public._pr_apply_payment(p_id, p_method, p_sender, p_trx);
  return jsonb_build_object('id', p_id, 'pay_status', 'pending');
end $$;

create or replace function public.pr_cancel_order(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.pr_orders;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  select * into o from public.pr_orders where id = p_id and deleted_at is null;
  if o.id is null or o.user_id <> uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if o.status <> 'new' or o.pay_status in ('pending','verified') and coalesce(o.amount, 0) > 0 then raise exception 'This order can no longer be cancelled here — please contact VOSB'; end if;
  update public.pr_orders set status = 'cancelled', updated_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end $$;

-- ---------- admin: change an order (status, payment check, quote, note, delivered link) ----------
create or replace function public.admin_pr_set_order(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.pr_orders; n public.pr_orders; st text := nullif(p ->> 'status', ''); ps text := nullif(p ->> 'pay_status', ''); nt text := public._txt(p ->> 'admin_note', 600); du text := public._txt(p ->> 'delivered_url', 300);
        inn text := public._txt(p ->> 'internal_note', 1000); am numeric;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into o from public.pr_orders where id = p_id;
  if o.id is null then raise exception 'Order not found'; end if;
  if st is not null and st not in ('new','confirmed','in_progress','delivered','cancelled','rejected') then raise exception 'bad status'; end if;
  if ps is not null and ps not in ('none','pending','verified','rejected') then raise exception 'bad payment status'; end if;
  if du is not null and du !~* '^https?://' then raise exception 'Delivered link must start with https://'; end if;
  if (ps = 'rejected' or st = 'rejected') and nt is null and o.admin_note is null then raise exception 'Please write the reason for the buyer'; end if;
  if p ? 'amount' then
    am := nullif(p ->> 'amount', '')::numeric;
    if am is not null and (am < 0 or am > 100000000) then raise exception 'bad amount'; end if;
    if o.pay_status = 'verified' and am is distinct from o.amount then raise exception 'The payment is already verified — amount cannot change'; end if;
  else am := o.amount; end if;
  update public.pr_orders set
    status = coalesce(st, case when ps = 'verified' and status = 'new' then 'confirmed' end, status), pay_status = coalesce(ps, pay_status), amount = am,
    admin_note = case when p ? 'admin_note' then nt else admin_note end,
    delivered_url = case when p ? 'delivered_url' then du else delivered_url end,
    paid_at = case when ps = 'verified' then now() when ps in ('pending','rejected','none') then null else paid_at end,
    verified_by = case when ps = 'verified' then lower(auth.jwt() ->> 'email') when ps in ('pending','rejected','none') then null else verified_by end,
    updated_at = now()
  where id = p_id returning * into n;
  -- tell the buyer what changed
  if ps = 'verified' and o.pay_status <> 'verified' then
    perform public._notify(o.user_id, false, 'pr_paid', 'Payment confirmed: ' || o.order_no, 'পেমেন্ট নিশ্চিত: ' || o.order_no, 'We received your payment for ' || o.service_name_en || '. Our team will start now.', 'আপনার ' || o.service_name_bn || '-এর পেমেন্ট পেয়েছি। আমাদের টিম কাজ শুরু করবে।', '/pr#orders', jsonb_build_object('order', o.id));
  elsif ps = 'rejected' and o.pay_status <> 'rejected' then
    perform public._notify(o.user_id, false, 'pr_pay_rejected', 'Payment could not be verified: ' || o.order_no, 'পেমেন্ট যাচাই করা যায়নি: ' || o.order_no, coalesce(nt, 'Please send the correct payment details again.'), coalesce(nt, 'অনুগ্রহ করে সঠিক পেমেন্ট তথ্য আবার দিন।'), '/pr#orders', jsonb_build_object('order', o.id));
  end if;
  if p ? 'internal_note' then
    insert into public.pr_order_private (order_id, internal_note) values (p_id, inn) on conflict (order_id) do update set internal_note = excluded.internal_note, updated_at = now();
  end if;
  if o.kind = 'quote' and o.amount is null and n.amount is not null then
    perform public._notify(o.user_id, false, 'pr_quote', 'Your quote is ready: ' || o.order_no, 'আপনার কোটেশন তৈরি: ' || o.order_no, '৳' || n.amount::text || ' for ' || o.service_name_en || '. Open My orders to pay.', '৳' || n.amount::text || ' — ' || o.service_name_bn || '। পেমেন্ট করতে “আমার অর্ডার” দেখুন।', '/pr#orders', jsonb_build_object('order', o.id));
  end if;
  if st is not null and st <> o.status and st in ('confirmed','in_progress','delivered','cancelled','rejected') then
    perform public._notify(o.user_id, false, 'pr_status', 'Order ' || o.order_no || ': ' || replace(st, '_', ' '), 'অর্ডার ' || o.order_no || ': ' || case st when 'confirmed' then 'নিশ্চিত' when 'in_progress' then 'কাজ চলছে' when 'delivered' then 'সম্পন্ন' when 'cancelled' then 'বাতিল' else 'গৃহীত হয়নি' end,
      coalesce(nt, case when st = 'delivered' then 'Your order is complete.' else 'The status of your order was updated.' end), coalesce(nt, case when st = 'delivered' then 'আপনার অর্ডার সম্পন্ন হয়েছে।' else 'আপনার অর্ডারের অবস্থা আপডেট হয়েছে।' end), '/pr#orders', jsonb_build_object('order', o.id));
  end if;
  return jsonb_build_object('id', n.id, 'status', n.status, 'pay_status', n.pay_status, 'amount', n.amount);
exception when unique_violation then raise exception 'Another active order already uses this Transaction ID';
end $$;

-- ---------- CSV export of PR clients (e-mails & phones) ----------
create or replace function public.admin_export_contacts(p_kind text, p_active_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind = 'members' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.joined desc) from (
      select u.email, p.full_name as name, p.phone, p.user_type as role, p.organization, p.division, p.district, p.heard_from, p.marketing_ok,
        (u.email_confirmed_at is not null) as email_confirmed, u.created_at as joined, coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at) as last_active
      from auth.users u left join public.profiles p on p.id = u.id
      where (not p_active_only) or (u.email_confirmed_at is not null and p.disabled_at is null and coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) > now() - interval '30 days')) x), '[]'::jsonb);
  elsif p_kind = 'subscribers' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.joined desc) from (
      select email, lang, source, status, created_at as joined from public.subscribers where (not p_active_only) or status = 'active') x), '[]'::jsonb);
  elsif p_kind = 'company_contacts' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.company) from (
      select c.name as company, c.status, cp.owner_name, cp.owner_email, cp.owner_phone, cp.contact_email, cp.contact_phone, cp.address
      from public.companies c join public.company_private cp on cp.company_id = c.id
      where c.deleted_at is null and ((not p_active_only) or c.status in ('published','submitted','in_review','changes_requested'))) x), '[]'::jsonb);
  elsif p_kind = 'investors' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (
      select i.investor_name as name, i.investor_email as email, i.investor_phone as phone, i.investor_type, i.ticket_min, i.ticket_max, c.name as company, i.status, i.share_contact, i.created_at as at
      from public.company_interests i left join public.companies c on c.id = i.company_id where (not p_active_only) or i.status <> 'closed') x), '[]'::jsonb);
  elsif p_kind = 'payers' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (
      select p.user_email as email, p.sender_msisdn as phone, p.method, p.amount, p.trx_id, p.status, c.name as company, p.created_at as at
      from public.listing_payments p left join public.companies c on c.id = p.company_id where (not p_active_only) or p.status = 'verified') x), '[]'::jsonb);
  elsif p_kind = 'pr_clients' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (
      select o.user_email as account_email, o.brief ->> 'name' as name, o.brief ->> 'email' as email, o.brief ->> 'phone' as phone, o.brief ->> 'brand' as brand, o.service_name_en as service, o.qty, o.amount, o.pay_status, o.status, o.order_no, o.created_at as at
      from public.pr_orders o where o.deleted_at is null and ((not p_active_only) or o.status not in ('cancelled','rejected'))) x), '[]'::jsonb);
  end if;
  raise exception 'Unknown list';
end $$;

-- ---------- who can call what ----------
revoke all on function public._pr_live_campaign(text), public._pr_price(uuid, uuid, int, text, boolean), public._pr_apply_payment(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.pr_quote(uuid, int, text, boolean), public.pr_submit_order(jsonb), public.pr_pay_order(uuid, text, text, text), public.pr_cancel_order(uuid), public.admin_pr_set_order(uuid, jsonb) from public, anon;
grant execute on function public.pr_quote(uuid, int, text, boolean), public.pr_submit_order(jsonb), public.pr_pay_order(uuid, text, text, text), public.pr_cancel_order(uuid), public.admin_pr_set_order(uuid, jsonb) to authenticated;
grant execute on function public.get_pr_public() to anon, authenticated;
