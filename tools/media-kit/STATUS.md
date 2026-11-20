# Media kit (PDF) — status, 2026-11-20

**Live files:** `/media-kit-en.pdf` and `/media-kit-bn.pdf` (site root, 4 A4 pages each, one language per file). robots.txt disallows both (they are not meant to rank). Linked from the PR page hero ("Media kit (PDF)" button, signed-in members only; follows the site language). The PDF URLs themselves are public, so anyone with the link can open them.

**Contents:** cover (Facebook 28-day views / engagement / new follows with growth, who we are, what we cover) · audience & performance (last 9 posts bar chart, website 30-day numbers, newsletter, articles, company directory, "how to read these numbers") · 4 example posts with Meta views/reactions/comments/shares · service table (price column says "Quoted per brief" — no real prices are set yet) + how booking works + why partner + contact.

**Where the numbers come from (as of 20 Nov 2026):**
- Facebook: Meta page insights screenshots from the owner (28 days: 1.2M views ↑11x, 47,134 engagement ↑631%, 3,666 new follows ↑180%; per-post views for 6–16 Nov; per-post reactions/comments/shares from the post screenshots).
- Website: first-party database, **real readers only** (site_visits/post_views `kind='human'` — bots and the owner's own visits excluded): 8,286 unique visitors, 14,549 page views and 9,449 article reads in the last 30 days; 1,413 active newsletter subscribers; 169 published articles (126 in the last 30 days); 27 published companies; 269 article shares; 28 registered members (12 founders, 12 readers, 2 investors, 2 other); top-5 most-read articles by real-reader reads. NOTE: the admin dashboard tiles (9.8k visitors, 20.7k page views) include bots and the owner, so they look higher than the kit.
- Services/booking facts: `pr_services`, `pr_slot_groups` (articles 10/day, posts 1/day, horizon 60 days).

**Rebuild each month:** edit the DATA block at the top of `tools/media-kit/build.cjs`, then run `node tools/media-kit/build.cjs` (Playwright) — it rewrites both PDFs. Post images are cropped from screenshots into `tools/media-kit/img/`; fonts (Hind Siliguri, OFL) in `tools/media-kit/fonts/`. Never type a number that is not in a screenshot or a query.

**Owner decisions (20 Nov, later)**
- The old "20K visitors/month" on the PR page was only an idea: replaced by the real figure (`site_settings.pr_page.stats.monthly_visitors` = 8200 → shows "8.2K+").
- Founder story shows ৳0 only because of a free-campaign choice; it is NOT free normally. Kit does not show it as free.
- Price range for all services: ৳2,000–৳7,000 (shown as a note above the service table; per-service prices still "Quoted per brief").

**20K visitors — NOT used in the kit.** The PR page hero used to say "20K+ monthly website visitors" (and the owner called the new reach cards "actual data"). Real-reader analytics show 8,286 unique visitors / 14,549 page views in 30 days (dashboard all-time page views 20.7k include bots and the owner), so the kit shows the measured numbers. The PR page now shows 8.2K+ (Admin → Page & stats). Only add a 20K figure if there is a source (e.g. Google Analytics / Search Console screenshot) and label it with that source. The PR page's "30K+ average views per post" and "70K–1.3 lakh strong posts" ARE supported by Facebook data (average of last 9 posts 58,590; median 73,611; 5 of 9 above 70K; best 137,068) and the kit shows the measured values.

**Open items**
- Set per-service prices in Admin → Services if you want exact prices in the table; then rebuild.
- Dashboard says 29 users, its breakdown (2·12·12·2) adds to 28 — one user has no profile row.
- Total Facebook follower count and a WhatsApp number are not in the kit; "New follows" is the 28-day gain, not total followers.
