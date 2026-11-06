-- VOSB update 13e — blank stays blank.
-- Bug found: in Postgres GREATEST()/LEAST() IGNORE NULLs, so greatest(0, least(NULL, 1e13)) = 1e13.
-- A figure the owner left empty was therefore saved as the upper limit (e.g. revenue ৳10 trillion).
-- Fix: null-safe clamps; the four functions that clamp owner input are rewritten to use them;
-- values that sit exactly on a limit (impossible to type by hand) are reset to empty. Nothing is deleted.

create or replace function public._gr(a numeric, b numeric) returns numeric language sql immutable as $$ select case when a is null or b is null then null else greatest(a, b) end $$;
create or replace function public._lt(a numeric, b numeric) returns numeric language sql immutable as $$ select case when a is null or b is null then null else least(a, b) end $$;
revoke all on function public._gr(numeric, numeric), public._lt(numeric, numeric) from public, anon;
grant execute on function public._gr(numeric, numeric), public._lt(numeric, numeric) to authenticated, service_role;

do $$
declare fn text; d text;
begin
  foreach fn in array array['save_company_financials','save_company_draft','express_interest','request_valuation_update'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = fn;
    if d is null then raise exception 'function % not found', fn; end if;
    if d !~ 'public\._gr\(' then
      d := regexp_replace(regexp_replace(d, '\mgreatest\(', 'public._gr(', 'g'), '\mleast\(', 'public._lt(', 'g');
      execute d;
    end if;
  end loop;
end $$;

-- reset auto-filled limit values (company_financials)
update public.company_financials set
  annual_revenue = nullif(annual_revenue, 1e13), monthly_revenue = nullif(monthly_revenue, 1e12), growth_mom = nullif(growth_mom, 1000),
  gross_margin = case when gross_margin = 100 and annual_revenue = 1e13 then null else gross_margin end,
  annual_net_profit = nullif(annual_net_profit, 1e13), monthly_burn = nullif(monthly_burn, 1e12), cash_in_bank = nullif(cash_in_bank, 1e13),
  debt = nullif(debt, 1e13), assets_value = nullif(assets_value, 1e13), ip_value = nullif(ip_value, 1e13),
  customers = nullif(customers, 1000000000), paying_customers = nullif(paying_customers, 1000000000), team_ft = nullif(team_ft, 100000),
  total_raised = nullif(total_raised, 1e13), market_size = nullif(market_size, 1e15)
where annual_revenue = 1e13 or monthly_burn = 1e12 or cash_in_bank = 1e13;
-- companies + interests
update public.companies set seeking_amount = nullif(seeking_amount, 1e13), expected_valuation = nullif(expected_valuation, 1e13),
  equity_offered = case when equity_offered = 100 and (seeking_amount = 1e13 or expected_valuation = 1e13) then null else equity_offered end
where seeking_amount = 1e13 or expected_valuation = 1e13;
update public.company_interests set ticket_min = nullif(ticket_min, 1e13), ticket_max = nullif(ticket_max, 1e13) where ticket_min = 1e13 or ticket_max = 1e13;
