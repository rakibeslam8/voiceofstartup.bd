-- update-28 (20 Nov 2026): /pr is open to everyone (no login to VIEW services, prices, free dates).
-- Ordering, quotes, payments and "My orders" still need an account (their RPCs stay authenticated-only).
-- Signed-out callers: per-IP rate limit 600 requests/hour via rl_hit(); payment account numbers are removed
-- from 'methods' (v - 'number'). Signed-in users get the full payment_methods value (needed to pay).
-- Already applied to the live project as migration "pr_page_public_read".

create or replace function public.get_pr_public()
returns jsonb language plpgsql security definer set search_path = public as $f$
declare r jsonb;
begin
  if auth.uid() is null and not public.rl_hit('prpub', 600, 3600) then raise exception 'Too many requests, please try again later' using errcode = '54000'; end if;
  select jsonb_build_object(
    'page', coalesce((select value from public.site_settings where key = 'pr_page'), '{}'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'key', key, 'category', category, 'icon', icon, 'name_bn', name_bn, 'name_en', name_en, 'desc_bn', desc_bn, 'desc_en', desc_en,
        'unit_bn', unit_bn, 'unit_en', unit_en, 'price', price, 'min_qty', min_qty, 'max_qty', max_qty, 'popular', popular, 'slot_group', slot_group, 'notice_bn', notice_bn, 'notice_en', notice_en, 'extra_fields', extra_fields) order by sort, created_at)
        from public.pr_services where active and deleted_at is null), '[]'::jsonb),
    'campaign', (select jsonb_build_object('id', c.id, 'title_bn', c.title_bn, 'title_en', c.title_en, 'text_bn', c.text_bn, 'text_en', c.text_en, 'service_keys', c.service_keys, 'ends_at', c.ends_at,
        'slots_left', case when c.max_slots is null then null else greatest(c.max_slots - (select count(*) from public.pr_orders o where o.campaign_id = c.id and o.status not in ('cancelled','rejected') and o.deleted_at is null), 0) end)
      from public._pr_live_campaign(null) c where c.id is not null),
    'methods', case when auth.uid() is null
      then (select coalesce(jsonb_object_agg(k, v - 'number'), '{}'::jsonb) from jsonb_each(coalesce((select value from public.site_settings where key = 'payment_methods'), '{}'::jsonb)) as t(k, v))
      else (select value from public.site_settings where key = 'payment_methods') end)
  into r;
  return r;
end $f$;

create or replace function public.get_pr_slots()
returns jsonb language plpgsql security definer set search_path = public as $f$
declare today date := (now() at time zone 'Asia/Dhaka')::date; r jsonb;
begin
  if auth.uid() is null and not public.rl_hit('prslots', 600, 3600) then raise exception 'Too many requests, please try again later' using errcode = '54000'; end if;
  with g as (select * from public.pr_slot_groups where active),
  taken as (select b.slot_group, b.day, count(*) n from public.pr_bookings b join public.pr_orders o on o.id = b.order_id
             where b.day >= today and o.deleted_at is null and o.status not in ('cancelled','rejected') group by 1, 2),
  blk as (select g.key as slot_group, x.day, sum(coalesce(x.seats, 100000)) n from public.pr_blackouts x join g on (x.slot_group is null or x.slot_group = g.key)
           where x.deleted_at is null and x.day >= today group by 1, 2)
  select coalesce(jsonb_object_agg(g.key, jsonb_build_object('name_bn', g.name_bn, 'name_en', g.name_en, 'cap', g.daily_cap, 'lead', g.lead_days, 'hold', g.hold_days, 'horizon', g.horizon_days,
      'days', (select jsonb_agg(jsonb_build_object('d', to_char(today + g.lead_days + i, 'YYYY-MM-DD'),
                 'left', case when i < g.hold_days then 0 else greatest(g.daily_cap - coalesce(t.n, 0) - coalesce(k.n, 0), 0) end) order by i)
               from generate_series(0, g.horizon_days - g.lead_days) i
               left join taken t on t.slot_group = g.key and t.day = today + g.lead_days + i
               left join blk k on k.slot_group = g.key and k.day = today + g.lead_days + i))), '{}'::jsonb)
    into r from g;
  return jsonb_build_object('today', to_char(today, 'YYYY-MM-DD'), 'groups', r);
end $f$;

revoke all on function public.get_pr_public() from public;
revoke all on function public.get_pr_slots() from public;
grant execute on function public.get_pr_public() to anon, authenticated;
grant execute on function public.get_pr_slots() to anon, authenticated;
