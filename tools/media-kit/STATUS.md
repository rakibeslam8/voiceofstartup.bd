# Media kit (PDF) — status, 2026-11-20

**Live files:** `/media-kit-en.pdf` and `/media-kit-bn.pdf` (site root, 4 A4 pages each, one language per file). robots.txt disallows both (they are not meant to rank). Linked from the PR page hero ("Media kit (PDF)" button, shown to everyone since 20 Nov; follows the site language). The PDF URLs themselves are public, so anyone with the link can open them.

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

**Update 20 Nov (9 AM): now 5 pages** — cover · reach/performance · NEW audience + directory page · example posts · services & prices.
- Prices (owner): sponsored article ৳3,000, Facebook post ৳4,000, founder story ৳2,000 (FREE until 31 Dec 2026 — rebuild the kit after that date and drop the "free until" line), event/launch coverage ৳5,000, brand collaboration = depends on discussion, other = custom quote. These are in the PDF only — the live PR page/database still has no prices (article/post/event/collab null, founder_story 0). Not yet pushed live.
- WhatsApp +880 1404-792132 (01404792132) is in the kit contact box only; `site_settings.pr_page.whatsapp` is still empty.
- "About 20,000 followers combined across all channels" — figure from the owner, not from a screenshot; no per-platform counts. Replace with a measured number when a Facebook follower-count screenshot is available.
- Audience page = Meta post-details screenshots for the 11 Nov post only (137,068 views, ~82K viewers): 96% non-followers, 76% men / 8% women / 16% unknown, 35–44 43.8%, 25–34 30.3%, 45–54 13.6%, other 12.3%, Bangladesh 92.9%, India 1.8%, other 4.2%, unknown 1.1%, views from Suggested 92.5%. Labelled as that post, not the whole page.
- Directory logos (Pathao, Grameenphone, bKash, Walton, Shikho, Nagad, PRAN-RFL, Akij, ACI, Chaldal) are cropped from the owner's screenshots into `tools/media-kit/logos/` and labelled "companies in our directory — editorial listings, not clients or partners". They are `curated` directory entries; do NOT call them clients unless they are.

**Open items**
- Set the same prices live in Admin → Services (and the WhatsApp number in Page & stats) if the owner wants the PR page to match the kit.
- Dashboard says 29 users, its breakdown (2·12·12·2) adds to 28 — one user has no profile row.
- Total Facebook follower count and a WhatsApp number are not in the kit; "New follows" is the 28-day gain, not total followers.

**Update 20 Nov (later):** /pr is now public (no login to view). Kit contact box says "Book online (free account to order)" (c_book). PDFs rebuilt.

**Update 20 Nov (9:20, owner correction):** the owner confirmed monthly website visitors = **20K**. Restored `site_settings.pr_page.stats.monthly_visitors` = 20000 (PR page shows 20K+) and the kit now shows "20,000+ monthly website visitors" (owner-reported; captions say so). The measured real-reader numbers remain in the DB for reference (8,286 unique / 14,549 page views, 30 days, human only); the kit no longer shows the page-views tile because it would be lower than the visitor figure. If a client asks for proof, attach a Google Analytics / Search Console screenshot.

**Update 20 Nov (9:25):** owner set monthly page views = **35K** → kit shows "35,000+ monthly page views" (cover + performance page), owner-reported like the 20K visitors. Measured human-only numbers (8,286 visitors / 14,549 page views, 30 days) stay in the DB only.

**Update 20 Nov (9:35): prices are now LIVE on /pr** (same as the kit): article ৳3,000 · Facebook post ৳4,000 · founder story ৳2,000 · event/launch ৳5,000 · brand collaboration & "something else" = get a quote (price null). Founder story: a free campaign "Founder story — free until 31 December" (pr_campaigns, ends 2027-01-01 00:00 Dhaka) makes it ৳0 at checkout until then, then ৳2,000 automatically (tested with _pr_price: free → 0, paid → 2000). WhatsApp +880 1404-792132 set in site_settings.pr_page.whatsapp (WhatsApp button on /pr). Monthly visitors on /pr = 20K (owner figure). Rebuild the kit after 31 Dec to drop the "free until" line.

**Update 20 Nov (10:00):** /pr now has a "Our work & how it performs" section (4 recent posts with Meta views/reactions/comments/shares + logo strip labelled "Companies featured in our directory — editorial listings, not clients or partners"; data constants PROOF/LOGOS at the top of the proof block in js/pr.js, images in img/pr/) and a "15K+ Facebook page followers" tile (site_settings.pr_page.stats.followers = 15000; editable in Admin → Page & stats). Kit cover now says "Facebook page: 15,000+ followers … about 20,000 combined". Owner said the 20K visitors / 35K page views have a source — add the source name to the kit when known.

**Update 20 Nov (10:30): /pr phone compact pass** (css/pr.css end block + js/pr.js `pr-sub` body class). Phone home page 6,857px → 4,740px: next-free-date card hidden on phones (the quick-fact chip has it), buttons side by side + small media-kit link, numbers 2×2, service cards compact (icon+name row, price+button row, description max 3 lines), recent posts and logos are swipe rows. Order form / My orders: hero hidden on phones, tighter fields (order page 5,149 → 4,613px). Tested 390px and 340px, light and dark, no horizontal overflow.

**Update 20 Nov (10:50): admin "Manage order" pop-up redesigned** (js/admin-pr.js `manage()`, css/admin.css `.mo-*`): summary strip (amount / buyer / coupon / TrxID), left = Contact + Brief (long answers in a soft box), right = sticky orange-outlined "Update this order" panel (order + payment status side by side, hints under each field instead of in the label), sticky Save bar; phone = single column. Logic/IDs unchanged.
