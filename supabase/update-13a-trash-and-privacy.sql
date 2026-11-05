-- VOSB update 13a — soft delete + restore (companies, users), owner delete-requests,
-- valuation privacy (owner sees nothing until admin approves), columns for curated profiles.
-- Additive only. Nothing is ever physically deleted by these functions. Safe to re-run.

-- ---------- columns ----------
alter table public.companies add column if not exists deleted_at timestamptz;
alter table public.companies add column if not exists prev_status text;
alter table public.companies add column if not exists delete_reason text;
alter table public.companies add column if not exists curated boolean not null default false;
alter table public.companies add column if not exists name_bn text;
alter table public.companies add column if not exists tagline_bn text;
alter table public.companies add column if not exists description_bn text;
alter table public.companies add column if not exists highlights_bn text;
alter table public.companies add column if not exists business_model_bn text;
alter table public.companies add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists info_as_of date;
alter table public.companies add column if not exists ticker text;
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists disabled_reason text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'companies_bn_len_check') then
    alter table public.companies add constraint companies_bn_len_check check (
      char_length(name_bn) <= 120 and char_length(tagline_bn) <= 200 and char_length(description_bn) <= 6000
      and char_length(highlights_bn) <= 1500 and char_length(business_model_bn) <= 1500 and char_length(ticker) <= 20);
  end if;
end $$;

alter table public.companies drop constraint if exists companies_status_check;
alter table public.companies add constraint companies_status_check check (status = any (array[
  'draft','submitted','in_review','changes_requested','rejected','published','suspended','deleted']));

-- owners never see a deleted company; the public already only sees 'published'
drop policy if exists "Owner reads own company" on public.companies;
create policy "Owner reads own company" on public.companies for select to authenticated
  using (status <> 'deleted' and exists (select 1 from public.company_private cp where cp.company_id = companies.id and cp.owner_id = (select auth.uid())));

-- ---------- valuation privacy: owner may only read APPROVED valuations ----------
drop policy if exists "Owner or admin reads valuations" on public.company_valuations;
create policy "Owner reads approved valuations" on public.company_valuations for select to authenticated
  using (status = 'approved' and exists (select 1 from public.company_private cp where cp.company_id = company_valuations.company_id and cp.owner_id = (select auth.uid())));

create or replace function public.my_valuations(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not (adm or exists (select 1 from public.company_private where company_id = p_company and owner_id = auth.uid())) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'financials', (select to_jsonb(f) from public.company_financials f where f.company_id = p_company),
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select v.id, v.version, v.status, v.source, v.created_at, v.decided_at, v.reason,
             case when adm or v.status = 'approved' then v.low end as low,
             case when adm or v.status = 'approved' then v.mid end as mid,
             case when adm or v.status = 'approved' then v.high end as high,
             case when adm or v.status = 'approved' then v.confidence end as confidence,
             case when adm or v.status = 'approved' then v.result end as result,
             v.expected_by_owner,
             case when adm or v.status in ('approved', 'rejected') then v.note end as note
      from public.company_valuations v where v.company_id = p_company and (adm or v.status <> 'superseded') order by v.created_at desc limit 20) x), '[]'::jsonb));
end $$;

-- ---------- owner delete requests ----------
create table if not exists public.company_delete_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 800),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create unique index if not exists company_delete_requests_one_pending on public.company_delete_requests (company_id) where status = 'pending';
alter table public.company_delete_requests enable row level security;
drop policy if exists "Owner or admin reads delete requests" on public.company_delete_requests;
create policy "Owner or admin reads delete requests" on public.company_delete_requests for select to authenticated
  using (public.is_admin() or user_id = (select auth.uid()));

create or replace function public._soft_delete_company(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.companies set prev_status = case when status = 'deleted' then prev_status else status end, status = 'deleted',
    deleted_at = coalesce(deleted_at, now()), delete_reason = coalesce(public._txt(p_reason, 800), delete_reason) where id = p_id;
end $$;
revoke all on function public._soft_delete_company(uuid, text) from public, anon, authenticated;

create or replace function public.request_company_deletion(p_company uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.companies; own uuid; rs text := public._txt(p_reason, 800); rid uuid;
begin
  if uid is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  if not public.rl_user('delreq', 6, 3600) then raise exception 'Too many requests, please try later' using errcode = '54000'; end if;
  select * into c from public.companies where id = p_company;
  select owner_id into own from public.company_private where company_id = p_company;
  if c.id is null or own is distinct from uid then raise exception 'Not allowed' using errcode = '42501'; end if;
  if c.status = 'deleted' then raise exception 'This company is already removed'; end if;
  if rs is null or char_length(rs) < 5 then raise exception 'Please tell us why you want to remove the company'; end if;
  begin
    insert into public.company_delete_requests (company_id, user_id, reason) values (p_company, uid, rs) returning id into rid;
  exception when unique_violation then raise exception 'A removal request is already waiting for the admin';
  end;
  perform public._notify(null, true, 'delete_request', 'Company removal requested: ' || coalesce(c.name, 'company'), 'কোম্পানি সরানোর অনুরোধ: ' || coalesce(c.name, 'কোম্পানি'), rs, rs, '/admin#/deletions', jsonb_build_object('company', p_company, 'request', rid));
  perform public._notify(uid, false, 'delete_request_sent', 'Removal request sent', 'সরানোর অনুরোধ পাঠানো হয়েছে', 'The VOSB admin will review it. Your company stays as it is until then.', 'VOSB অ্যাডমিন অনুরোধটি দেখবেন। ততক্ষণ আপনার কোম্পানি যেমন আছে তেমনই থাকবে।', '/account#companies', jsonb_build_object('company', p_company));
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.cancel_company_deletion(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  update public.company_delete_requests set status = 'cancelled', decided_at = now(), decided_by = 'owner' where company_id = p_company and user_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.my_deletion_requests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'company_id', r.company_id, 'status', r.status, 'reason', r.reason, 'admin_note', r.admin_note, 'created_at', r.created_at, 'decided_at', r.decided_at) order by r.created_at desc)
    from public.company_delete_requests r where r.user_id = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.admin_decide_company_deletion(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.company_delete_requests; c public.companies; nt text := public._txt(p_note, 800);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from public.company_delete_requests where id = p_id;
  if r.id is null or r.status <> 'pending' then raise exception 'Request not found or already decided'; end if;
  select * into c from public.companies where id = r.company_id;
  if p_approve then
    perform public._soft_delete_company(r.company_id, 'Owner request: ' || r.reason);
    update public.company_delete_requests set status = 'approved', admin_note = nt, decided_at = now(), decided_by = lower(auth.jwt() ->> 'email') where id = p_id;
    perform public._notify(r.user_id, false, 'delete_approved', 'Company removed', 'কোম্পানি সরানো হয়েছে', coalesce(c.name, 'Your company') || ' was removed as you asked. You can ask us to restore it any time.', coalesce(c.name, 'আপনার কোম্পানি') || ' আপনার অনুরোধে সরানো হয়েছে। চাইলে যেকোনো সময় ফিরিয়ে আনার অনুরোধ করতে পারবেন।', '/account#companies', jsonb_build_object('company', r.company_id));
  else
    if nt is null then raise exception 'Please write a note for the owner'; end if;
    update public.company_delete_requests set status = 'rejected', admin_note = nt, decided_at = now(), decided_by = lower(auth.jwt() ->> 'email') where id = p_id;
    perform public._notify(r.user_id, false, 'delete_rejected', 'Removal request not approved', 'সরানোর অনুরোধ অনুমোদিত হয়নি', nt, nt, '/account#companies', jsonb_build_object('company', r.company_id));
  end if;
  return jsonb_build_object('ok', true, 'status', case when p_approve then 'approved' else 'rejected' end);
end $$;

-- admin: move any company to the trash / bring it back (nothing is erased)
create or replace function public.admin_set_company_deleted(p_company uuid, p_deleted boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies; own uuid; back text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into c from public.companies where id = p_company;
  if c.id is null then raise exception 'Company not found'; end if;
  select owner_id into own from public.company_private where company_id = p_company;
  if p_deleted then
    if c.status = 'deleted' then return jsonb_build_object('ok', true, 'status', 'deleted'); end if;
    perform public._soft_delete_company(p_company, p_reason);
    update public.company_delete_requests set status = 'approved', decided_at = now(), decided_by = lower(auth.jwt() ->> 'email') where company_id = p_company and status = 'pending';
    perform public._notify(own, false, 'company_removed', 'Company removed', 'কোম্পানি সরানো হয়েছে', coalesce(public._txt(p_reason, 300), 'Removed by the VOSB admin.'), coalesce(public._txt(p_reason, 300), 'VOSB অ্যাডমিন সরিয়ে দিয়েছেন।'), '/account#companies', jsonb_build_object('company', p_company));
    return jsonb_build_object('ok', true, 'status', 'deleted');
  end if;
  if c.status <> 'deleted' then return jsonb_build_object('ok', true, 'status', c.status); end if;
  back := coalesce(nullif(c.prev_status, 'deleted'), 'in_review');
  update public.companies set status = back, deleted_at = null, delete_reason = null, prev_status = null where id = p_company;
  perform public._notify(own, false, 'company_restored', 'Company restored', 'কোম্পানি ফিরিয়ে আনা হয়েছে', coalesce(c.name, 'Your company') || ' is back.', coalesce(c.name, 'আপনার কোম্পানি') || ' ফিরিয়ে আনা হয়েছে।', '/account#companies', jsonb_build_object('company', p_company));
  return jsonb_build_object('ok', true, 'status', back);
end $$;

-- ---------- users: suspend (soft delete) and restore ----------
create or replace function public.admin_set_user_disabled(p_user uuid, p_disabled boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare em text; rs text := public._txt(p_reason, 300);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (auth.jwt() ->> 'sub')::uuid then raise exception 'You cannot suspend your own admin account'; end if;
  select email into em from auth.users where id = p_user;
  if em is null then raise exception 'User not found'; end if;
  insert into public.profiles (id, email) values (p_user, lower(em)) on conflict (id) do nothing;
  update public.profiles set disabled_at = case when p_disabled then now() else null end, disabled_reason = case when p_disabled then rs else null end where id = p_user;
  update auth.users set banned_until = case when p_disabled then 'infinity'::timestamptz else null end where id = p_user;
  return jsonb_build_object('ok', true, 'disabled', p_disabled);
end $$;

-- a suspended account can no longer write anything (every write goes through rl_user)
create or replace function public.rl_user(p_scope text, p_limit integer, p_secs integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int; b bigint := floor(extract(epoch from now()) / greatest(p_secs, 1))::bigint;
begin
  if auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid() and disabled_at is not null) then
    raise exception 'This account is suspended. Please contact VOSB.' using errcode = '42501';
  end if;
  insert into public.rate_limits as r (k, bucket, n) values ('u:' || p_scope || ':' || coalesce(auth.uid()::text, 'anon'), b, 1)
  on conflict (k, bucket) do update set n = r.n + 1 returning r.n into c;
  return c <= p_limit;
end $$;

-- admin: the trash can (deleted companies + suspended users)
create or replace function public.admin_trash()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'companies', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'prev_status', c.prev_status, 'deleted_at', c.deleted_at, 'reason', c.delete_reason) order by c.deleted_at desc) from public.companies c where c.status = 'deleted'), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'name', p.full_name, 'disabled_at', p.disabled_at, 'reason', p.disabled_reason) order by p.disabled_at desc) from public.profiles p where p.disabled_at is not null), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'company_id', r.company_id, 'company', c.name, 'reason', r.reason, 'created_at', r.created_at, 'owner', cp.owner_email) order by r.created_at) from public.company_delete_requests r join public.companies c on c.id = r.company_id left join public.company_private cp on cp.company_id = r.company_id where r.status = 'pending'), '[]'::jsonb));
end $$;

-- ---------- grants ----------
revoke execute on function public.request_company_deletion(uuid, text), public.cancel_company_deletion(uuid), public.my_deletion_requests(),
  public.admin_decide_company_deletion(uuid, boolean, text), public.admin_set_company_deleted(uuid, boolean, text), public.admin_set_user_disabled(uuid, boolean, text),
  public.admin_trash(), public.my_valuations(uuid) from public, anon;
grant execute on function public.request_company_deletion(uuid, text), public.cancel_company_deletion(uuid), public.my_deletion_requests(),
  public.admin_decide_company_deletion(uuid, boolean, text), public.admin_set_company_deleted(uuid, boolean, text), public.admin_set_user_disabled(uuid, boolean, text),
  public.admin_trash(), public.my_valuations(uuid) to authenticated;
