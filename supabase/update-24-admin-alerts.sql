-- Admin alerts: the admin's own phone / computer / installed admin app gets a push for everything that happens on the site.
-- Run once in Supabase → SQL Editor (needs update-23-web-push.sql first). Safe to run again.

-- which admin page each kind of event opens, and which on/off switch ("category") it belongs to
create or replace function public._push_admin_cat(p_kind text) returns text language sql immutable as $$
  select case
    when p_kind in ('pr_order', 'pr_payment') then 'orders'
    when p_kind = 'payment_submitted' then 'payments'
    when p_kind in ('application_submitted', 'delete_request', 'valuation_request') then 'companies'
    when p_kind in ('investor_interest', 'investment_proposed', 'investment_confirmed') then 'investors'
    when p_kind in ('new_member', 'account_deleted') then 'members'
    when p_kind = 'new_subscriber' then 'subscribers'
    when p_kind in ('new_review', 'new_comment', 'post_comment') then 'feedback'
    when p_kind = 'app_installed' then 'installs'
    else 'other' end $$;
create or replace function public._push_admin_url(p_kind text) returns text language sql immutable as $$
  select '/admin' || case p_kind
    when 'pr_order' then '#/pr' when 'pr_payment' then '#/pr'
    when 'payment_submitted' then '#/payments'
    when 'application_submitted' then '#/companies' when 'delete_request' then '#/companies' when 'valuation_request' then '#/valuations'
    when 'investor_interest' then '#/interests' when 'investment_proposed' then '#/deals' when 'investment_confirmed' then '#/deals'
    when 'new_member' then '#/users' when 'account_deleted' then '#/deletions'
    when 'new_subscriber' then '#/subscribers'
    when 'new_review' then '#/reviews' when 'new_comment' then '#/reviews' when 'post_comment' then '#/reviews'
    when 'app_installed' then '#/dashboard'
    else '' end $$;
revoke all on function public._push_admin_cat(text), public._push_admin_url(text) from public, anon, authenticated;

-- _notify: member part unchanged (switch auto_members); admin part now has its own switches (auto_admin + admin_off list)
create or replace function public._notify(p_user uuid, p_admin boolean, p_kind text, p_t_en text, p_t_bn text, p_b_en text, p_b_bn text, p_link text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare adm uuid; cfg jsonb := public._push_cfg(); tbn text; ten text; recent int;
begin
  if p_user is null and not coalesce(p_admin, false) then return; end if;
  insert into public.notifications (user_id, for_admin, kind, title_en, title_bn, body_en, body_bn, link, data)
  values (p_user, coalesce(p_admin, false), p_kind, left(p_t_en, 160), left(p_t_bn, 160), left(p_b_en, 500), left(p_b_bn, 500), left(p_link, 200), coalesce(p_data, '{}'::jsonb));
  tbn := coalesce(nullif(left(p_t_bn, 120), ''), left(p_t_en, 120), 'VOSB');
  ten := coalesce(nullif(left(p_t_en, 120), ''), left(p_t_bn, 120), 'VOSB');
  if p_user is not null and coalesce((cfg ->> 'auto_members')::boolean, true)
     and exists (select 1 from public.push_subscriptions where user_id = p_user and disabled_at is null) then
    insert into public.push_outbox (kind, audience, user_id, title_bn, title_en, body_bn, body_en, url)
    values ('user', 'user', p_user, tbn, ten, left(p_b_bn, 180), left(p_b_en, 180),
            coalesce(nullif(case when p_link ~ '^/' and p_link !~ '^/admin' then left(p_link, 300) end, ''), '/account'));
  end if;
  if coalesce(p_admin, false) and coalesce((cfg ->> 'auto_admin')::boolean, true)
     and not coalesce((cfg -> 'admin_off') ? public._push_admin_cat(p_kind), false) then
    -- a flood (for example a bulk import) must not bury the phone: after 15 alerts in 5 minutes the rest stay in the in-app list only
    select count(*) into recent from public.push_outbox where kind = 'admin' and created_at > now() - interval '5 minutes';
    if recent < 15 then
      for adm in select s.user_id from public.push_subscriptions s join auth.users u on u.id = s.user_id
                 where s.disabled_at is null and lower(u.email) = 'rakib@voiceofstartup.bd' group by s.user_id loop
        insert into public.push_outbox (kind, audience, user_id, title_bn, title_en, body_bn, body_en, url)
        values ('admin', 'user', adm, tbn, ten, left(p_b_bn, 180), left(p_b_en, 180), public._push_admin_url(p_kind));
      end loop;
    end if;
  end if;
end $$;
revoke all on function public._notify(uuid, boolean, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- history list shows the new kind
alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in ('article', 'announce', 'user', 'test', 'admin'));

-- ---------- new admin alerts for things that had none ----------
create or replace function public.trg_admin_alert_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  perform public._notify(null, true, 'new_member', 'New member: ' || coalesce(nullif(new.full_name, ''), new.email, 'someone'), 'নতুন সদস্য: ' || coalesce(nullif(new.full_name, ''), new.email, ''),
    coalesce(new.email, '') || coalesce(' · ' || nullif(new.user_type, ''), ''), coalesce(new.email, '') || coalesce(' · ' || nullif(new.user_type, ''), ''), '#/users');
  return new;
end $$;
drop trigger if exists trg_admin_alert_member on public.profiles;
create trigger trg_admin_alert_member after insert on public.profiles for each row execute function public.trg_admin_alert_member();

create or replace function public.trg_admin_alert_subscriber() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or coalesce(new.source, '') = 'import' then return new; end if;
  perform public._notify(null, true, 'new_subscriber', 'New newsletter subscriber', 'নতুন নিউজলেটার সাবস্ক্রাইবার', new.email, new.email, '#/subscribers');
  return new;
end $$;
drop trigger if exists trg_admin_alert_subscriber on public.subscribers;
create trigger trg_admin_alert_subscriber after insert on public.subscribers for each row execute function public.trg_admin_alert_subscriber();

create or replace function public.trg_admin_alert_review() returns trigger language plpgsql security definer set search_path = public as $$
declare cn text;
begin
  select name into cn from public.companies where id = new.company_id;
  perform public._notify(null, true, 'new_review', 'New review: ' || coalesce(cn, 'company') || ' · ' || new.rating || '★', 'নতুন রিভিউ: ' || coalesce(cn, 'কোম্পানি') || ' · ' || new.rating || '★',
    coalesce(new.author_name, '') || ': ' || left(coalesce(new.title, new.body, ''), 120), coalesce(new.author_name, '') || ': ' || left(coalesce(new.title, new.body, ''), 120), '#/reviews');
  return new;
end $$;
drop trigger if exists trg_admin_alert_review on public.company_reviews;
create trigger trg_admin_alert_review after insert on public.company_reviews for each row execute function public.trg_admin_alert_review();

create or replace function public.trg_admin_alert_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare cn text;
begin
  if coalesce(new.by_owner, false) then return new; end if;
  select name into cn from public.companies where id = new.company_id;
  perform public._notify(null, true, 'new_comment', 'New comment on ' || coalesce(cn, 'a company'), coalesce(cn, 'কোম্পানি') || '-এ নতুন মন্তব্য',
    coalesce(new.author_name, '') || ': ' || left(coalesce(new.body, ''), 120), coalesce(new.author_name, '') || ': ' || left(coalesce(new.body, ''), 120), '#/reviews');
  return new;
end $$;
drop trigger if exists trg_admin_alert_comment on public.company_comments;
create trigger trg_admin_alert_comment after insert on public.company_comments for each row execute function public.trg_admin_alert_comment();

create or replace function public.trg_admin_alert_post_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare pt text;
begin
  if public.is_admin() then return new; end if;
  select coalesce(nullif(title_en, ''), title_bn) into pt from public.posts where id = new.post_id;
  perform public._notify(null, true, 'post_comment', 'New article comment', 'আর্টিকেলে নতুন মন্তব্য',
    coalesce(new.author_name, '') || ' on “' || left(coalesce(pt, ''), 70) || '”: ' || left(coalesce(new.body, ''), 100), coalesce(new.author_name, '') || ': ' || left(coalesce(new.body, ''), 100), '#/posts');
  return new;
end $$;
drop trigger if exists trg_admin_alert_post_comment on public.post_comments;
create trigger trg_admin_alert_post_comment after insert on public.post_comments for each row execute function public.trg_admin_alert_post_comment();

create or replace function public.trg_admin_alert_deletion() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._notify(null, true, 'account_deleted', 'Account deleted', 'অ্যাকাউন্ট মুছে ফেলা হয়েছে', coalesce(new.email, '') || coalesce(' · ' || nullif(new.reason, ''), ''), coalesce(new.email, '') || coalesce(' · ' || nullif(new.reason, ''), ''), '#/deletions');
  return new;
end $$;
drop trigger if exists trg_admin_alert_deletion on public.account_deletions;
create trigger trg_admin_alert_deletion after insert on public.account_deletions for each row execute function public.trg_admin_alert_deletion();

create or replace function public.trg_admin_alert_install() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event = 'installed' and coalesce(new.kind, 'human') = 'human' then
    perform public._notify(null, true, 'app_installed', 'App installed on ' || coalesce(new.platform, 'a device'), coalesce(new.platform, 'একটি ডিভাইসে') || '-এ অ্যাপ ইনস্টল হয়েছে', null, null, '#/dashboard');
  end if;
  return new;
end $$;
drop trigger if exists trg_admin_alert_install on public.app_events;
create trigger trg_admin_alert_install after insert on public.app_events for each row execute function public.trg_admin_alert_install();
revoke all on function public.trg_admin_alert_member(), public.trg_admin_alert_subscriber(), public.trg_admin_alert_review(), public.trg_admin_alert_comment(),
  public.trg_admin_alert_post_comment(), public.trg_admin_alert_deletion(), public.trg_admin_alert_install() from public, anon, authenticated;

-- admin_push_set also saves the admin-alert switches
create or replace function public.admin_push_set(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := public._push_cfg();
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  c := c || jsonb_build_object('auto_articles', coalesce((p ->> 'auto_articles')::boolean, (c ->> 'auto_articles')::boolean, true),
                               'auto_members', coalesce((p ->> 'auto_members')::boolean, (c ->> 'auto_members')::boolean, true),
                               'auto_admin', coalesce((p ->> 'auto_admin')::boolean, (c ->> 'auto_admin')::boolean, true));
  if jsonb_typeof(p -> 'admin_off') = 'array' then
    c := c || jsonb_build_object('admin_off', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(p -> 'admin_off') x where x in ('orders','payments','companies','investors','members','subscribers','feedback','installs','other')), '[]'::jsonb));
  end if;
  insert into public.site_settings (key, value) values ('push_cfg', c) on conflict (key) do update set value = excluded.value;
  return c;
end $$;
revoke all on function public.admin_push_set(jsonb) from public, anon;
grant execute on function public.admin_push_set(jsonb) to authenticated;
