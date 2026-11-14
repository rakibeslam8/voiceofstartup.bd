-- VOSB update 16b — the company translator (edge function `company-i18n`) is called every minute by pg_cron when a company has changed wording.
-- Safe to re-run. Adds a secret, one helper function and one schedule — nothing is deleted.
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'i18n_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'i18n_cron_secret', 'shared secret between the pg_cron schedule and the company-i18n edge function');
  end if;
end $$;

create or replace function public.i18n_secret_ok(p text) returns boolean language sql stable security definer set search_path to 'public', 'vault' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'i18n_cron_secret' and decrypted_secret = p) $$;
revoke all on function public.i18n_secret_ok(text) from public, anon, authenticated;
grant execute on function public.i18n_secret_ok(text) to service_role;

select cron.schedule('company-i18n', '* * * * *', $job$
  select net.http_post(
    url := 'https://hpanuojuazdqolgkafqg.supabase.co/functions/v1/company-i18n',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'i18n_cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.companies where i18n_stale and i18n_tries < 12 and deleted_at is null);
$job$);
