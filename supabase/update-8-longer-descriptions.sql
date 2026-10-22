-- =====================================================================
-- Voice of Startup Bangladesh — update 8: fuller card descriptions for older articles
--
-- Run ONCE in Supabase → SQL Editor (after update-7). Safe to run again.
--
-- Older articles have a very short card description (one sentence, 1–2 lines), so their cards look empty next to
-- newer ones. This extends them to 2–3 lines using the article's own opening sentences — ending on a complete
-- sentence, never cut in the middle.
--
--   * Nothing is deleted. The original text is kept in posts_excerpt_backup (made in update-7).
--   * Only descriptions that are short AND are the start of the article text are extended; anything you wrote
--     differently is never touched.
--   * The "updated" date of an article / the sitemap date does NOT change.
-- =====================================================================

-- backup rows for articles added since update-7 (existing backup rows are kept as they are)
create table if not exists public.posts_excerpt_backup as
  select id, excerpt_bn, excerpt_en, now() as saved_at from public.posts;
insert into public.posts_excerpt_backup (id, excerpt_bn, excerpt_en, saved_at)
  select p.id, p.excerpt_bn, p.excerpt_en, now() from public.posts p
   where not exists (select 1 from public.posts_excerpt_backup b where b.id = p.id);

-- same sentence rule as update-7 (re-created so this file works on its own)
create or replace function public.vosb_card_excerpt(md text, n int default 180)
returns text
language plpgsql
immutable
as $$
declare
  t   text := coalesce(md, '');
  win text;
  s   text;
  cut text;
  sp  int;
begin
  t := regexp_replace(t, '!\[[^\]]*\]\([^)]*\)', '', 'g');
  t := regexp_replace(t, '\[([^\]]+)\]\([^)]*\)', '\1', 'g');
  t := regexp_replace(t, '^#{1,3}\s+', '', 'gn');
  t := regexp_replace(t, '^>\s?', '', 'gn');
  t := regexp_replace(t, '^[-*•]\s+', '', 'gn');
  t := regexp_replace(t, '^\d+[.)]\s+', '', 'gn');
  t := regexp_replace(t, '\*\*([^*]+)\*\*', '\1', 'g');
  t := regexp_replace(t, '\*([^*]+)\*', '\1', 'g');
  t := regexp_replace(t, '^---+$', '', 'gn');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  if length(t) <= n + 40 then return t; end if;

  win := left(t, n + 40);
  s := substring(win from '^(.*[।.!?]["”’)]?)(?=\s|$)');
  if s is not null and length(s) >= n * 0.5 then return btrim(s); end if;

  cut := left(t, n);
  sp  := length(cut) - position(' ' in reverse(cut)) + 1;
  if position(' ' in cut) > 0 and sp > n * 0.6 then cut := left(cut, sp - 1); end if;
  return btrim(cut) || '…';
end;
$$;
revoke all on function public.vosb_card_excerpt(text, int) from public, anon, authenticated;

alter table public.posts disable trigger posts_set_updated_at;

-- Bangla: short description that starts the article text -> extend (never shorten, never change the start)
update public.posts p
   set excerpt_bn = x.nw
  from (select id, public.vosb_card_excerpt(body_bn) as nw from public.posts where btrim(coalesce(body_bn, '')) <> '') x
 where x.id = p.id
   and btrim(coalesce(p.excerpt_bn, '')) <> ''
   and p.excerpt_bn not like '%…'
   and length(p.excerpt_bn) < 170
   and length(x.nw) > length(p.excerpt_bn) + 15
   and left(x.nw, 30) = left(p.excerpt_bn, 30);

-- English: same rule
update public.posts p
   set excerpt_en = x.nw
  from (select id, public.vosb_card_excerpt(body_en) as nw from public.posts where btrim(coalesce(body_en, '')) <> '') x
 where x.id = p.id
   and btrim(coalesce(p.excerpt_en, '')) <> ''
   and p.excerpt_en not like '%…'
   and length(p.excerpt_en) < 170
   and length(x.nw) > length(p.excerpt_en) + 15
   and left(x.nw, 30) = left(p.excerpt_en, 30);

alter table public.posts enable trigger posts_set_updated_at;

-- check: how long are the descriptions now? (Bangla characters)
select min(length(excerpt_bn)) as shortest, round(avg(length(excerpt_bn))) as average, max(length(excerpt_bn)) as longest,
       count(*) filter (where length(excerpt_bn) < 150) as still_short, count(*) as articles
  from public.posts;

-- To restore the original descriptions at any time:
--   update public.posts p set excerpt_bn = b.excerpt_bn, excerpt_en = b.excerpt_en
--     from public.posts_excerpt_backup b where b.id = p.id;
