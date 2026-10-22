-- =====================================================================
-- Voice of Startup Bangladesh — update 7: complete card descriptions
--
-- Run ONCE in Supabase → SQL Editor. Safe to run again.
--
-- Until now each article's short description (shown on cards) was auto-cut at 160 characters and always
-- ended with "…", often in the middle of a sentence. This update rewrites ONLY those auto-cut descriptions
-- (the ones that end with "…") so they end on a complete sentence (2–3 lines on a card).
--
--   * Nothing is deleted. The old text of every description is first copied to the table
--     posts_excerpt_backup (restore any time with the last query in this file).
--   * Descriptions you wrote yourself (not ending with "…") are never touched.
--   * The "updated" date of an article / the sitemap date does NOT change.
-- =====================================================================

-- 1) backup of the current descriptions (one row per article, made once)
create table if not exists public.posts_excerpt_backup as
  select id, excerpt_bn, excerpt_en, now() as saved_at from public.posts;
alter table public.posts_excerpt_backup enable row level security;      -- no policies: private
revoke all on public.posts_excerpt_backup from anon, authenticated;
insert into public.posts_excerpt_backup (id, excerpt_bn, excerpt_en, saved_at)
  select p.id, p.excerpt_bn, p.excerpt_en, now() from public.posts p
   where not exists (select 1 from public.posts_excerpt_backup b where b.id = p.id);

-- 2) the same rule the website now uses: plain text, then end on a complete sentence
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
  sp  := length(cut) - position(' ' in reverse(cut)) + 1;       -- position of the last space
  if position(' ' in cut) > 0 and sp > n * 0.6 then cut := left(cut, sp - 1); end if;
  return btrim(cut) || '…';
end;
$$;
revoke all on function public.vosb_card_excerpt(text, int) from public, anon, authenticated;

-- 3) rewrite only the auto-cut ones (keep the article's "updated" date unchanged)
alter table public.posts disable trigger posts_set_updated_at;

update public.posts
   set excerpt_bn = public.vosb_card_excerpt(body_bn)
 where excerpt_bn like '%…' and btrim(coalesce(body_bn, '')) <> ''
   and public.vosb_card_excerpt(body_bn) <> '';

update public.posts
   set excerpt_en = public.vosb_card_excerpt(body_en)
 where excerpt_en like '%…' and btrim(coalesce(body_en, '')) <> ''
   and public.vosb_card_excerpt(body_en) <> '';

alter table public.posts enable trigger posts_set_updated_at;

-- 4) check: how many descriptions still end with "…" (only ones with no clear sentence end remain)
select count(*) filter (where excerpt_bn like '%…') as bn_still_cut,
       count(*) filter (where excerpt_en like '%…') as en_still_cut,
       count(*) as articles
  from public.posts;

-- To restore the old descriptions at any time, run this:
--   update public.posts p set excerpt_bn = b.excerpt_bn, excerpt_en = b.excerpt_en
--     from public.posts_excerpt_backup b where b.id = p.id;
