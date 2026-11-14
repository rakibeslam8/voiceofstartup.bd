-- VOSB update 16 — bilingual company profiles, richer member profiles, daily-active tracking, overview totals, CSV export data.
-- Safe to re-run. Adds columns/functions only — nothing is deleted or rewritten.

-------------------------------------------------------------------- 1. member profile extras (all optional, set by the member)
alter table public.profiles
  add column if not exists organization text,
  add column if not exists division text,
  add column if not exists district text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists heard_from text,
  add column if not exists marketing_ok boolean not null default false,
  add column if not exists invest_min numeric,
  add column if not exists invest_max numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_extra_chk') then
    alter table public.profiles add constraint profiles_extra_chk check (
      char_length(coalesce(organization, '')) <= 120 and char_length(coalesce(division, '')) <= 60 and char_length(coalesce(district, '')) <= 60
      and char_length(coalesce(heard_from, '')) <= 40 and cardinality(interests) <= 12
      and (invest_min is null or (invest_min >= 0 and invest_min <= 1e13)) and (invest_max is null or (invest_max >= 0 and invest_max <= 1e13)));
  end if;
end $$;

-------------------------------------------------------------------- 2. bilingual company text
-- base columns (tagline, description …) keep what the founder typed; *_bn / *_en hold the two reading versions.
alter table public.companies
  add column if not exists name_en text, add column if not exists tagline_en text, add column if not exists description_en text,
  add column if not exists business_model_en text, add column if not exists highlights_en text,
  add column if not exists use_of_funds_en text, add column if not exists use_of_funds_bn text,
  add column if not exists i18n_stale boolean not null default true, add column if not exists i18n_at timestamptz,
  add column if not exists i18n_extra jsonb not null default '{}'::jsonb;   -- {"team":[{bn,en}…],"sig":"name|role;name|role"} (kept apart because save_company_draft rebuilds `team`)

create or replace function public._team_sig(t jsonb) returns text language sql immutable set search_path to 'public' as $$
  select coalesce(string_agg(coalesce(e ->> 'name', '') || '|' || coalesce(e ->> 'role', ''), ';' order by ord), '')
  from jsonb_array_elements(case when jsonb_typeof(t) = 'array' then t else '[]'::jsonb end) with ordinality as x(e, ord) $$;

-- whenever the founder's / admin's own wording changes, the two reading versions are marked "needs refresh"
create or replace function public.companies_i18n_flag() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.i18n_at is not distinct from old.i18n_at and (
       (new.name, new.tagline, new.description, new.business_model, new.highlights, new.use_of_funds, public._team_sig(new.team))
       is distinct from (old.name, old.tagline, old.description, old.business_model, old.highlights, old.use_of_funds, public._team_sig(old.team))) then
    new.i18n_stale := true;
  end if;
  return new;
end $$;
drop trigger if exists trg_companies_i18n_flag on public.companies;
create trigger trg_companies_i18n_flag before update on public.companies for each row execute function public.companies_i18n_flag();

create or replace function public.save_company_i18n(p_company uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); adm boolean := public.is_admin(); st text; own uuid; tm jsonb; ex jsonb;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Bad request'; end if;
  select c.status, cp.owner_id, c.team into st, own, tm from public.companies c left join public.company_private cp on cp.company_id = c.id where c.id = p_company;
  if st is null then raise exception 'Company not found'; end if;
  if not adm then
    if own is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
    if st in ('deleted', 'rejected', 'suspended') then raise exception 'This listing is closed'; end if;
    if not public.rl_user('co_i18n', 120, 600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  end if;
  if jsonb_typeof(p -> 'team_roles') = 'array' and jsonb_typeof(tm) = 'array' then
    ex := jsonb_build_object('sig', public._team_sig(tm), 'team', coalesce((select jsonb_agg(jsonb_build_object('bn', public._txt(e ->> 'bn', 80), 'en', public._txt(e ->> 'en', 80)) order by ord)
          from jsonb_array_elements(p -> 'team_roles') with ordinality as x(e, ord) where ord <= 8), '[]'::jsonb));
  end if;
  update public.companies set
    name_bn = case when p ? 'name_bn' then public._txt(p ->> 'name_bn', 120) else name_bn end,
    name_en = case when p ? 'name_en' then public._txt(p ->> 'name_en', 120) else name_en end,
    tagline_bn = case when p ? 'tagline_bn' then public._txt(p ->> 'tagline_bn', 160) else tagline_bn end,
    tagline_en = case when p ? 'tagline_en' then public._txt(p ->> 'tagline_en', 160) else tagline_en end,
    description_bn = case when p ? 'description_bn' then public._txt(p ->> 'description_bn', 6000) else description_bn end,
    description_en = case when p ? 'description_en' then public._txt(p ->> 'description_en', 6000) else description_en end,
    business_model_bn = case when p ? 'business_model_bn' then public._txt(p ->> 'business_model_bn', 1500) else business_model_bn end,
    business_model_en = case when p ? 'business_model_en' then public._txt(p ->> 'business_model_en', 1500) else business_model_en end,
    highlights_bn = case when p ? 'highlights_bn' then public._txt(p ->> 'highlights_bn', 1500) else highlights_bn end,
    highlights_en = case when p ? 'highlights_en' then public._txt(p ->> 'highlights_en', 1500) else highlights_en end,
    use_of_funds_bn = case when p ? 'use_of_funds_bn' then public._txt(p ->> 'use_of_funds_bn', 1500) else use_of_funds_bn end,
    use_of_funds_en = case when p ? 'use_of_funds_en' then public._txt(p ->> 'use_of_funds_en', 1500) else use_of_funds_en end,
    i18n_extra = coalesce(ex, i18n_extra), i18n_stale = false, i18n_at = now()
  where id = p_company;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.save_company_i18n(uuid, jsonb) from public, anon;
grant execute on function public.save_company_i18n(uuid, jsonb) to authenticated;

-------------------------------------------------------------------- 3. richer profile save + sign-up details
create or replace function public.update_my_profile(p jsonb) returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); r public.profiles; nm text; ph text; av text; ints text[]; hf text; imin numeric; imax numeric;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('profile', 30, 600) then raise exception 'Too many requests' using errcode = '54000'; end if;
  perform public.ensure_profile();
  nm := public._txt(p ->> 'full_name', 120);
  if p ? 'full_name' and (nm is null or char_length(nm) < 2) then raise exception 'Please enter your name'; end if;
  ph := public._txt(p ->> 'phone', 20);
  if ph is not null and ph !~ '^(\+?88)?01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladesh mobile number (01XXXXXXXXX)'; end if;
  av := public._own_img(p ->> 'avatar_url', 'avatars');
  if p ? 'interests' then
    if jsonb_typeof(p -> 'interests') = 'array' then
      select coalesce(array_agg(distinct x), '{}'::text[]) into ints from (select lower(btrim(v)) as x from jsonb_array_elements_text(p -> 'interests') v limit 12) s where x ~ '^[a-z0-9_-]{2,30}$';
    else ints := '{}'::text[]; end if;
  end if;
  hf := case when (p ->> 'heard_from') in ('google','facebook','linkedin','youtube','x','instagram','whatsapp','friend','news','event','other') then p ->> 'heard_from' end;
  imin := public._num(p ->> 'invest_min'); imax := public._num(p ->> 'invest_max');
  if (imin is not null and (imin < 0 or imin > 1e13)) or (imax is not null and (imax < 0 or imax > 1e13)) or (imin is not null and imax is not null and imin > imax) then raise exception 'Check the investment range'; end if;
  update public.profiles set
    full_name = case when p ? 'full_name' then nm else full_name end,
    phone = case when p ? 'phone' then ph else phone end,
    headline = case when p ? 'headline' then public._txt(p ->> 'headline', 120) else headline end,
    bio = case when p ? 'bio' then public._txt(p ->> 'bio', 600) else bio end,
    location = case when p ? 'location' then public._txt(p ->> 'location', 80) else location end,
    avatar_url = case when p ? 'avatar_url' then av else avatar_url end,
    user_type = case when (p ->> 'user_type') in ('reader','founder','investor','other') then p ->> 'user_type' else user_type end,
    organization = case when p ? 'organization' then public._txt(p ->> 'organization', 120) else organization end,
    division = case when p ? 'division' then public._txt(p ->> 'division', 60) else division end,
    district = case when p ? 'district' then public._txt(p ->> 'district', 60) else district end,
    interests = case when p ? 'interests' then ints else interests end,
    heard_from = case when p ? 'heard_from' then hf else heard_from end,
    marketing_ok = case when p ? 'marketing_ok' then (p ->> 'marketing_ok') in ('true','t','1') else marketing_ok end,
    invest_min = case when p ? 'invest_min' then imin else invest_min end,
    invest_max = case when p ? 'invest_max' then imax else invest_max end
  where id = uid returning * into r;
  return r;
end $$;

create or replace function public.ensure_profile() returns public.profiles language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); j jsonb := auth.jwt(); um jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb); am jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb); r public.profiles; ph text := public._txt(um ->> 'phone', 20);
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  insert into public.profiles (id, email, full_name, avatar_url, provider, user_type, phone, heard_from, marketing_ok)
  values (uid, lower(j ->> 'email'), public._txt(coalesce(um ->> 'full_name', um ->> 'name'), 120),
          case when (um ->> 'avatar_url') ~* '^https://' then left(um ->> 'avatar_url', 500) when (um ->> 'picture') ~* '^https://' then left(um ->> 'picture', 500) end,
          coalesce(am ->> 'provider', 'email'),
          case when (um ->> 'user_type') in ('reader','founder','investor','other') then um ->> 'user_type' end,
          case when ph ~ '^(\+?88)?01[3-9][0-9]{8}$' then ph end,
          case when (um ->> 'heard_from') in ('google','facebook','linkedin','youtube','x','instagram','whatsapp','friend','news','event','other') then um ->> 'heard_from' end,
          coalesce((um ->> 'marketing_ok') in ('true','t','1'), false))
  on conflict (id) do update set last_seen_at = now(), email = excluded.email
  returning * into r;
  return r;
end $$;

create or replace function public.admin_list_users(p_q text default null, p_limit integer default 50, p_offset integer default 0, p_role text default null, p_active text default null, p_sort text default 'new')
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare q text := '%' || lower(coalesce(public._txt(p_q, 80), '')) || '%';
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (with base as (
    select u.id, u.email, p.full_name, p.phone, p.headline, p.location, p.user_type, p.avatar_url, coalesce(p.provider, u.raw_app_meta_data ->> 'provider') as provider,
      p.organization, p.division, p.district, p.interests, p.heard_from, p.marketing_ok, p.invest_min, p.invest_max, (p.disabled_at is not null) as disabled,
      u.created_at, u.last_sign_in_at, p.last_seen_at, (u.email_confirmed_at is not null) as email_confirmed,
      (select count(*) from public.company_private cp where cp.owner_id = u.id) as companies,
      (select count(*) from public.company_reviews r where r.user_id = u.id) as reviews,
      (select count(*) from public.company_comments m where m.user_id = u.id) as comments,
      (select count(*) from public.post_comments m where m.user_id = u.id) as article_comments,
      (select count(*) from public.company_interests i where i.user_id = u.id) as interests_n,
      (select count(*) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')) as invest_count,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status in ('confirmed','verified')), 0) as invested_total,
      coalesce((select sum(v.amount) from public.company_investments v where v.investor_id = u.id and v.status = 'verified'), 0) as invested_verified,
      (select count(*) from public.user_activity_daily a where a.user_id = u.id) as active_days,
      coalesce(greatest(p.last_seen_at, u.last_sign_in_at), u.last_sign_in_at, u.created_at) as last_active,
      am.data as meta, am.note as admin_note
    from auth.users u left join public.profiles p on p.id = u.id left join public.admin_meta am on am.scope = 'user' and am.ref_id = u.id
    where lower(coalesce(u.email, '')) like q or lower(coalesce(p.full_name, '')) like q or coalesce(p.phone, '') like q),
  roled as (select b.*, b.interests_n as interests_count, (case when b.invest_count > 0 or b.interests_n > 0 or b.user_type = 'investor' then 'investor' when b.companies > 0 or b.user_type = 'founder' then 'founder' when b.user_type = 'other' then 'other' else 'reader' end) as role,
      (b.last_active > now() - interval '30 days') as active from base b),
  filt as (select * from roled r where (p_role is null or r.role = p_role) and (p_active is null or (p_active = 'active' and r.active) or (p_active = 'inactive' and not r.active)))
  select jsonb_build_object('total', (select count(*) from filt), 'items', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select * from filt order by (case when p_sort = 'invested' then invested_total end) desc nulls last, (case when p_sort = 'active' then last_active end) desc nulls last, created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)));
end $$;
