# voiceofstartup.bd
Bangladesh Startup & Business News — Verified Insights, Funding Updates & Founder Stories

## Voice of Startup Bangladesh — Website

Static, mobile-first news/media site (Bangla by default, English toggle).
Colors come from the logo, banner and poster: orange `#ff7522`, black `#0b0b0b`, green `#0b8a4b`, red `#e8312f`, off-white `#f9f9f9`.

## Pages
`index.html` · `news.html` (category filters) · `article.html?id=…` · `about.html` · `contact.html` · `careers.html`

## Edit content
| What | Where |
| --- | --- |
| Emails, social links, sources, categories | `js/config.js` |
| News posts (currently **samples**) | `js/posts.js` |
| Colors / fonts | `:root` in `css/style.css` |

Before launch: replace the sample posts in `js/posts.js` with real, verified stories.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy
Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). Point `www.voiceofstartup.bd` at the host.

## Business emails
editor@ · partnerships@ · rakib@ · hello@ · careers@ — all `@voiceofstartup.bd`
