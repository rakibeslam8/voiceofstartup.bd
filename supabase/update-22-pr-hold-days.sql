-- Always-booked window: the first N days after "earliest" always show as booked (post/reel 5 days, article 3 days),
-- whatever the real bookings are. Real bookings stay booked too. Admin can change N per group (0 = off).
alter table public.pr_slot_groups add column if not exists hold_days int not null default 0 check (hold_days between 0 and 60);
update public.pr_slot_groups set hold_days = case key when 'post' then 5 when 'reel' then 5 when 'article' then 3 else hold_days end;

create or replace function public._pr_seats(p_group text, p_day date)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from public.pr_bookings b join public.pr_orders o on o.id = b.order_id
                    where b.slot_group = p_group and b.day = p_day and o.deleted_at is null and o.status not in ('cancelled','rejected')), 0)
       + coalesce((select sum(coalesce(x.seats, 100000)) from public.pr_blackouts x
                    where x.day = p_day and x.deleted_at is null and (x.slot_group is null or x.slot_group = p_group)), 0)
       + coalesce((select g.daily_cap from public.pr_slot_groups g
                    where g.key = p_group and g.hold_days > 0
                      and p_day < ((now() at time zone 'Asia/Dhaka')::date + g.lead_days + g.hold_days)), 0)
$$;
revoke all on function public._pr_seats(text, date) from public, anon, authenticated;

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
  select coalesce(jsonb_object_agg(g.key, jsonb_build_object('name_bn', g.name_bn, 'name_en', g.name_en, 'cap', g.daily_cap, 'lead', g.lead_days, 'hold', g.hold_days, 'horizon', g.horizon_days,
      'days', (select jsonb_agg(jsonb_build_object('d', to_char(today + g.lead_days + i, 'YYYY-MM-DD'),
                 'left', case when i < g.hold_days then 0 else greatest(g.daily_cap - coalesce(t.n, 0) - coalesce(k.n, 0), 0) end) order by i)
               from generate_series(0, g.horizon_days - g.lead_days) i
               left join taken t on t.slot_group = g.key and t.day = today + g.lead_days + i
               left join blk k on k.slot_group = g.key and k.day = today + g.lead_days + i))), '{}'::jsonb)
    into r from g;
  return jsonb_build_object('today', to_char(today, 'YYYY-MM-DD'), 'groups', r);
end $$;
revoke all on function public.get_pr_slots() from public, anon;
grant execute on function public.get_pr_slots() to authenticated;

-- every publishing service follows the booking rules
update public.pr_services set slot_group = 'article' where slot_group is null and key in ('founder_story','press_release','research','hiring','top_story','newsletter','banner','other');
update public.pr_services set slot_group = 'post' where slot_group is null and key in ('event','giveaway','collab');
update public.pr_services set slot_group = 'reel' where slot_group is null and key = 'combo';

-- an order with an unpaid amount can be paid in any open status (not only new / confirmed)
create or replace function public.pr_pay_order(p_id uuid, p_method text, p_sender text, p_trx text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); o public.pr_orders;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('prpay', 10, 3600) then raise exception 'Too many attempts, please try again later' using errcode = '54000'; end if;
  select * into o from public.pr_orders where id = p_id and deleted_at is null;
  if o.id is null or o.user_id <> uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if o.status in ('cancelled','rejected') or coalesce(o.amount, 0) <= 0 or o.pay_status not in ('none','rejected') then raise exception 'Payment is not needed for this order'; end if;
  perform public._pr_apply_payment(p_id, p_method, p_sender, p_trx);
  return jsonb_build_object('id', p_id, 'pay_status', 'pending');
end $function$;
revoke all on function public.pr_pay_order(uuid, text, text, text) from public, anon;
grant execute on function public.pr_pay_order(uuid, text, text, text) to authenticated;
