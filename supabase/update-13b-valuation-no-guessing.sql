-- VOSB update 13b — valuation never guesses: blank figures stay blank (admin sees "Not provided").
-- With no figures at all there is no automatic number; the admin may still enter one by hand.
-- Additive: replaces two functions only. Safe to re-run.

create or replace function public._calc_valuation(p_company uuid, f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.companies; cp public.company_private;
  cat text; lo numeric; hi numeric;
  rev numeric; g numeric; gg numeric; mult numeric; gm numeric; mf numeric;
  m_rev numeric := 0; m_earn numeric; m_ber numeric; m_floor numeric;
  profit numeric; burn numeric; cash numeric; runway numeric;
  s_idea numeric; s_prod numeric; s_team numeric; s_strat numeric; s_roll numeric;
  docs_ok int; docs_pend int; filled int := 0; k text; miss text[] := '{}'::text[]; gm_given boolean;
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

  -- nothing is guessed: every figure the owner left empty is listed as "not provided"
  if public._num(f ->> 'annual_revenue') is null and public._num(f ->> 'monthly_revenue') is null then miss := array_append(miss, 'revenue'); end if;
  foreach k in array array['growth_mom','gross_margin','annual_net_profit','monthly_burn','cash_in_bank','customers','team_ft'] loop
    if public._num(f ->> k) is null then miss := array_append(miss, k); end if;
  end loop;
  filled := 8 - coalesce(array_length(miss, 1), 0);
  if filled = 0 then
    return jsonb_build_object('low', null, 'mid', null, 'high', null, 'confidence', 0, 'flags', jsonb_build_array('no_financials'),
      'adjustments', '[]'::jsonb, 'missing', to_jsonb(miss), 'insufficient', true, 'methods', '{}'::jsonb);
  end if;

  rev := coalesce(public._num(f ->> 'annual_revenue'), coalesce(public._num(f ->> 'monthly_revenue'), 0) * 12, 0);
  g := greatest(-20, least(30, coalesce(public._num(f ->> 'growth_mom'), 0)));
  gg := greatest(-0.5, least(3, power(1 + g / 100, 12) - 1));
  mult := case when gg < 0 then lo * 0.7 else lo + (hi - lo) * least(1, gg / 2) end;
  gm_given := public._num(f ->> 'gross_margin') is not null;
  gm := greatest(0, least(100, coalesce(public._num(f ->> 'gross_margin'), 0)));
  mf := case when gm_given then 0.7 + 0.6 * gm / 100 else 1.0 end;
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
    'confidence', conf, 'flags', flags, 'missing', to_jsonb(miss), 'insufficient', false, 'adjustments', adjs, 'expected_ratio', ratio,
    'methods', jsonb_build_object(
      'revenue', jsonb_build_object('value', round(m_rev), 'multiple', round(mult, 2), 'margin_factor', round(mf, 2), 'weight', w_rev / wsum),
      'earnings', jsonb_build_object('value', round(coalesce(m_earn, 0)), 'weight', w_earn / wsum),
      'scorecard', jsonb_build_object('value', round(m_ber), 'weight', w_ber / wsum, 'parts', jsonb_build_object('idea', s_idea, 'product', s_prod, 'team', round(s_team, 2), 'strategic', round(s_strat, 2), 'rollout', s_roll)),
      'floor', jsonb_build_object('value', round(m_floor)),
      'runway_months', round(runway, 1)));
end $$;
revoke all on function public._calc_valuation(uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_decide_valuation(p_id uuid, p_approve boolean, p_mid numeric default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.company_valuations; own uuid; lo numeric; mi numeric; hi numeric; nt text := public._txt(p_note, 800); c public.companies;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from public.company_valuations where id = p_id;
  if v.id is null then raise exception 'Valuation not found'; end if;
  if v.status <> 'pending' then raise exception 'This valuation was already decided'; end if;
  if p_approve and v.mid is null and (p_mid is null or p_mid <= 0) then raise exception 'The owner gave no financial figures, so there is no calculated estimate. Enter your own estimate or decline.'; end if;
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
