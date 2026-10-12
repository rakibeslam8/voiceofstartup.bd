# voiceofstartup.bd
Bangladesh Startup & Business News — Verified Insights, Funding Updates & Founder Stories

## Voice of Startup Bangladesh — Website

Static, mobile-first news/media site (Bangla by default, English toggle).
Colors come from the logo, banner and poster: orange `#ff7522`, black `#0b0b0b`, green `#0b8a4b`, red `#e8312f`, off-white `#f9f9f9`.

## Pages
Home `/` · `/news` (category filters) · `/article?id=…` · `/about` · `/contact` · `/careers` · legal: `/privacy-policy` · `/terms-of-service` · `/cookie-policy` · `/refund-policy` · `/usage-policy`

URLs are extensionless (GitHub Pages serves `about.html` at `/about`). Legal text lives in `js/legal.js`.

## Edit content
| What | Where |
| --- | --- |
| Emails, social links, sources, categories | `js/config.js` |
| News posts (empty = “coming soon” state) | `js/posts.js` |
| Legal pages text (Bangla + English) | `js/legal.js` |
| Colors / fonts | `:root` in `css/style.css` |

## SEO
`sitemap.xml` and `robots.txt` are in the root. After adding posts run `python3 tools/generate_sitemap.py`, commit, and submit `https://voiceofstartup.bd/sitemap.xml` in Google Search Console.

## Run locally
```bash
python3 -m http.server 8000   # open http://localhost:8000 (note: extensionless URLs like /about only work on GitHub Pages; locally use /about.html)
```

## Deploy
Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). Point `www.voiceofstartup.bd` at the host.

## Business emails
editor@ · partnerships@ · rakib@ · hello@ · careers@ — all `@voiceofstartup.bd`
