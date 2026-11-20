# Media kit (PDF) — status, 2026-11-20

**Live files:** `/media-kit-en.pdf` and `/media-kit-bn.pdf` (site root, 4 A4 pages each, one language per file). robots.txt disallows both (they are not meant to rank). Linked from the PR page hero ("Media kit (PDF)" button, signed-in members only; follows the site language). The PDF URLs themselves are public, so anyone with the link can open them.

**Contents:** cover (Facebook 28-day views / engagement / new follows with growth, who we are, what we cover) · audience & performance (last 9 posts bar chart, website 30-day numbers, newsletter, articles, company directory, "how to read these numbers") · 4 example posts with Meta views/reactions/comments/shares · service table (price column says "Quoted per brief" — no real prices are set yet) + how booking works + why partner + contact.

**Where the numbers come from (as of 20 Nov 2026):**
- Facebook: Meta page insights screenshots from the owner (28 days: 1.2M views ↑11x, 47,134 engagement ↑631%, 3,666 new follows ↑180%; per-post views for 6–16 Nov; per-post reactions/comments/shares from the post screenshots).
- Website: first-party database (9,312 unique visitors and 19,890 page views in the last 30 days; 1,413 active newsletter subscribers; 169 published articles, 126 in the last 30 days; 27 published company profiles).
- Services/booking facts: `pr_services`, `pr_slot_groups` (articles 10/day, posts 1/day, horizon 60 days).

**Rebuild each month:** edit the DATA block at the top of `tools/media-kit/build.cjs`, then run `node tools/media-kit/build.cjs` (Playwright) — it rewrites both PDFs. Post images are cropped from screenshots into `tools/media-kit/img/`; fonts (Hind Siliguri, OFL) in `tools/media-kit/fonts/`. Never type a number that is not in a screenshot or a query.

**Open items / owner decisions**
- Set real prices in Admin → Services, then ask to regenerate (the table is built to show them; currently every service shows "Quoted per brief").
- `founder_story` has price `0` in the database (the seed had none): the PR page may show it as free. Confirm that is intended; the kit does not show it as free.
- The PR page says "20K+ visitors / month", but the database shows ~9.3K unique visitors (~19.9K page views) in 30 days — the 20K figure matches page views. Fix the wording/number in Admin → Page & stats before a client compares it with the kit.
- Total Facebook follower count and a WhatsApp number are not in the kit (not provided; "New follows" is the period gain, not total followers).
