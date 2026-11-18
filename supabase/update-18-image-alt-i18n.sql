-- VOSB update 18 — cover image description per language (additive; nothing deleted).
-- The editor now keeps title, summary, content (incl. links & picture captions) and the cover description
-- in both languages in step. Existing single-language descriptions are copied to the matching language.
alter table public.posts add column if not exists image_alt_bn text not null default '', add column if not exists image_alt_en text not null default '';
update public.posts set image_alt_bn = image_alt where coalesce(image_alt,'') <> '' and image_alt ~ '[ঀ-৿]' and image_alt_bn = '';
update public.posts set image_alt_en = image_alt where coalesce(image_alt,'') <> '' and image_alt !~ '[ঀ-৿]' and image_alt_en = '';
