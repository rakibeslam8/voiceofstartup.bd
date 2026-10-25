#!/usr/bin/env node
/* Voice of Startup Bangladesh — static SEO builder.
 *
 * Reads the LIVE articles from Supabase (public anon key from js/config.js — the same data any visitor can read)
 * and writes plain HTML files that Google can crawl with a normal "200 OK":
 *     read/<slug>.html        Bangla article page      -> https://www.voiceofstartup.bd/read/<slug>
 *     en/read/<slug>.html     English article page     -> https://www.voiceofstartup.bd/en/read/<slug>
 *     sitemap.xml             every page (+ hreflang pairs, cover images)
 *     feed.xml, en/feed.xml   RSS feeds
 * Pages of deleted / unpublished articles are removed. Nothing changes (no commit) when nothing changed.
 * Run by .github/workflows/build-static.yml every 15 minutes, or by hand:  node tools/build_static.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD = require(path.join(ROOT, "js/md.js"));

/* ---- config: single source of truth is js/config.js ---- */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8"), sandbox);
const C = sandbox.window.VOSB;
const ORIGIN = C.site.origin;
const SB_URL = (process.env.SUPABASE_URL || C.supabase.url || "").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_ANON_KEY || C.supabase.anonKey;
if (!SB_URL || !SB_KEY) { console.error("Supabase is not configured in js/config.js"); process.exit(1); }

const esc = MD.esc;
const cats = C.categories;
const catOf = (id) => cats.find((c) => c.id === id) || cats[0];

/* cache-busting tag = hash of the public JS/CSS, so browsers always load the newest files */
function assetVersion() {
  const h = crypto.createHash("md5");
  for (const f of ["css/style.css", "js/config.js", "js/md.js", "js/api.js", "js/main.js"]) h.update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest("hex").slice(0, 8);
}
const V = assetVersion();

/* ---- fetch live posts ---- */
async function fetchPosts() {
  const now = new Date().toISOString();
  const all = [];
  // Supabase returns at most 1,000 rows per request, so read page by page
  for (let from = 0; from < 100000; from += 1000) {
    const url = `${SB_URL}/rest/v1/posts?select=*&status=eq.published&publish_at=lte.${encodeURIComponent(now)}&order=publish_at.desc,id.asc`;
    const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!res.ok) throw new Error("Supabase responded " + res.status + " " + (await res.text()).slice(0, 200));
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Unexpected response");
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

/* ---- helpers ---- */
const trim = (s) => String(s || "").trim();
function view(r, lang) {
  const other = lang === "bn" ? "en" : "bn";
  const title = trim(r["title_" + lang]) || trim(r["title_" + other]);
  const body = trim(r["body_" + lang]) || trim(r["body_" + other]);
  const excerpt = trim(r["excerpt_" + lang]) || MD.excerptFrom(body) || trim(r["excerpt_" + other]);
  return { title, body, excerpt };
}
const hasLang = (r, lang) => !!(trim(r["title_" + lang]) && trim(r["body_" + lang]));
const urlOf = (slug, lang) => `${ORIGIN}${lang === "en" ? "/en" : ""}/read/${slug}`;
const dateFmt = (iso, lang) => new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
const minsOf = (md, lang) => { const m = MD.readingMinutes(md); return lang === "bn" ? `${m.toLocaleString("bn-BD")} মিনিটে পড়া` : `${m} min read`; };
const T = (lang, bn, en) => (lang === "bn" ? bn : en);
const write = (rel, content) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8") === content) return false;
  fs.writeFileSync(f, content);
  return true;
};
const sameAs = Object.values(C.social);

/* ---- article page ---- */
function articlePage(r, lang, all) {
  const v = view(r, lang);
  const actualLang = (hasLang(r, lang) || !hasLang(r, lang === "bn" ? "en" : "bn")) ? lang : (lang === "bn" ? "en" : "bn");
  const c = catOf(r.category);
  const url = urlOf(r.slug, lang);
  const img = r.image_url || `${ORIGIN}/assets/og-image.png`;
  const pageTitle = `${v.title} | Voice of Startup Bangladesh`;
  const desc = v.excerpt;
  const bnOk = true, enOk = hasLang(r, "en");
  const alternates = [
    `<link rel="alternate" hreflang="bn" href="${urlOf(r.slug, "bn")}">`,
    enOk ? `<link rel="alternate" hreflang="en" href="${urlOf(r.slug, "en")}">` : "",
    `<link rel="alternate" hreflang="x-default" href="${urlOf(r.slug, "bn")}">`,
  ].filter(Boolean).join("\n  ");
  const ld = [
    {
      "@context": "https://schema.org", "@type": "NewsArticle",
      headline: v.title.slice(0, 110), description: desc, image: [img], inLanguage: actualLang,
      datePublished: r.publish_at, dateModified: r.updated_at || r.publish_at,
      articleSection: c.en, isAccessibleForFree: true,
      keywords: [c.en, c.bn, "Bangladesh startup", "startup news Bangladesh", "Voice of Startup Bangladesh"].join(", "),
      author: r.author && r.author !== "VOSB Desk" ? { "@type": "Person", name: r.author } : { "@type": "Organization", name: C.site.name, url: ORIGIN },
      publisher: { "@type": "Organization", name: C.site.name, url: ORIGIN, logo: { "@type": "ImageObject", url: `${ORIGIN}/assets/logo.png` }, sameAs },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: T(actualLang, "হোম", "Home"), item: ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: actualLang === "bn" ? c.bn : c.en, item: `${ORIGIN}/${c.slug}` },
        { "@type": "ListItem", position: 3, name: v.title, item: url },
      ],
    },
  ];
  const related = all.filter((x) => x.slug !== r.slug && x.category === r.category).slice(0, 4);
  const more = related.length < 4 ? all.filter((x) => x.slug !== r.slug && x.category !== r.category).slice(0, 4 - related.length) : [];
  const relHtml = [...related, ...more].map((x) => { const xv = view(x, actualLang); return `<li><a href="${actualLang === "en" ? "/en" : ""}/read/${esc(x.slug)}">${esc(xv.title)}</a></li>`; }).join("");
  const srcLine = r.source === "VOSB"
    ? T(actualLang, "মূল প্রতিবেদন: Voice of Startup Bangladesh", "Original reporting: Voice of Startup Bangladesh")
    : `${T(actualLang, "তথ্যসূত্র", "Source")}: ${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(r.source)} ↗</a>` : esc(r.source)}`;
  const auto = actualLang === "en" ? r.auto_translated_en : r.auto_translated_bn;
  const noteHtml = auto ? `<p class="tr-note">🌐 ${actualLang === "bn" ? "এই বাংলা সংস্করণটি স্বয়ংক্রিয়ভাবে অনুবাদ করা হয়েছে।" : "This English version was automatically translated from the original Bangla."}</p>` : "";
  const bodyHtml = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">${T(actualLang, "হোম", "Home")}</a><span>›</span><a href="/${c.slug}">${esc(actualLang === "bn" ? c.bn : c.en)}</a></nav>
      <div class="post-meta"><span class="badge">${c.icon} ${esc(actualLang === "bn" ? c.bn : c.en)}</span><span class="badge verified">✔ ${esc(r.source)}</span></div>
      <h1>${esc(v.title)}</h1>
      <div class="byline"><span>${T(actualLang, "লেখক", "By")} <b>${esc(r.author || "VOSB Desk")}</b></span><span>${esc(dateFmt(r.publish_at, actualLang))}</span><span>${esc(minsOf(v.body, actualLang))}</span></div>
      ${r.image_url ? `<figure class="cover"><div class="cv"><img class="cv-bg" src="${esc(r.image_url)}" alt="" aria-hidden="true" decoding="async"><img src="${esc(r.image_url)}" alt="${esc(r.image_alt || v.title)}" width="1200" height="675" decoding="async" fetchpriority="high"></div>${r.image_alt ? `<figcaption>${esc(r.image_alt)}</figcaption>` : ""}</figure>` : ""}
      <div class="prose">${MD.render(v.body)}</div>
      ${noteHtml}
      <div class="src">${srcLine}</div>
      <div id="related"><h2 class="related-h">${T(actualLang, "আরও পড়ুন", "Read more")}</h2><ul class="seo-related">${relHtml}</ul></div>
      <p style="margin-top:28px"><a class="btn btn-outline" href="/news">← ${T(actualLang, "সব সংবাদ", "All news")}</a></p>`;
  // embedded copy of the row so the page can show both languages instantly (no body for private fields)
  const embed = JSON.stringify({
    id: r.id, slug: r.slug, category: r.category, publish_at: r.publish_at, updated_at: r.updated_at, featured: r.featured,
    title_bn: r.title_bn, title_en: r.title_en, excerpt_bn: r.excerpt_bn, excerpt_en: r.excerpt_en, body_bn: r.body_bn, body_en: r.body_en,
    source: r.source, source_url: r.source_url, author: r.author, image_url: r.image_url, image_alt: r.image_alt,
    views: r.views, shares: r.shares, auto_translated_bn: r.auto_translated_bn, auto_translated_en: r.auto_translated_en,
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${actualLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#ff7522">
  <link rel="canonical" href="${esc(url)}">
  ${alternates}
  <meta property="og:site_name" content="Voice of Startup Bangladesh">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="${actualLang === "bn" ? "bn_BD" : "en_US"}">
  <meta property="og:title" content="${esc(v.title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(img)}">
  <meta property="article:published_time" content="${esc(r.publish_at)}">
  <meta property="article:modified_time" content="${esc(r.updated_at || r.publish_at)}">
  <meta property="article:section" content="${esc(c.en)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@vostartupbd">
  <meta name="twitter:title" content="${esc(v.title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(img)}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48.png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="Voice of Startup Bangladesh" href="/feed.xml">
  <script src="/js/splash.js?v=20261025b"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css?v=${V}">
  <script type="application/ld+json" id="ld-article">${JSON.stringify(ld[0]).replace(/</g, "\\u003c")}</script>
  <script type="application/ld+json">${JSON.stringify(ld[1]).replace(/</g, "\\u003c")}</script>
</head>
<body>
  <div id="site-top"></div>
  <main>
    <section class="section"><div class="container">
      <article class="article" id="article">${bodyHtml}
      </article>
    </div></section>
  </main>
  <div id="site-bottom"></div>
  <script type="application/json" id="post-data">${embed}</script>
  <script src="/js/config.js?v=${V}"></script>
  <script src="/js/md.js?v=${V}"></script>
  <script src="/js/api.js?v=${V}"></script>
  <script src="/js/main.js?v=${V}"></script>
</body>
</html>
`;
}

/* ---- sitemap + feeds ---- */
const STATIC = ["/", "/news", ...cats.map((c) => "/" + c.slug), "/about", "/contact", "/careers", "/privacy-policy", "/terms-of-service", "/cookie-policy", "/refund-policy", "/usage-policy"];
const day = (iso) => String(iso).slice(0, 10);
function sitemap(posts) {
  const newest = (list) => (list.length ? day(list.reduce((m, p) => ((p.updated_at || p.publish_at) > m ? (p.updated_at || p.publish_at) : m), list[0].updated_at || list[0].publish_at)) : null);
  const urls = [];
  for (const p of STATIC) {
    const hub = p === "/" || p === "/news" || cats.some((c) => "/" + c.slug === p);
    const cat = cats.find((c) => "/" + c.slug === p);
    const latest = newest(cat ? posts.filter((x) => x.category === cat.id) : posts);   // each topic page: date of ITS newest article
    urls.push(`  <url>\n    <loc>${ORIGIN}${p === "/" ? "/" : p}</loc>${hub && latest ? `\n    <lastmod>${latest}</lastmod>` : ""}\n    <changefreq>${hub ? "hourly" : "monthly"}</changefreq>\n    <priority>${p === "/" ? "1.0" : hub ? "0.8" : "0.4"}</priority>\n  </url>`);
  }
  for (const r of posts) {
    const en = hasLang(r, "en");
    const alts = `\n    <xhtml:link rel="alternate" hreflang="bn" href="${urlOf(r.slug, "bn")}"/>${en ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${urlOf(r.slug, "en")}"/>` : ""}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf(r.slug, "bn")}"/>`;
    const image = r.image_url ? `\n    <image:image><image:loc>${esc(r.image_url)}</image:loc></image:image>` : "";
    for (const lang of en ? ["bn", "en"] : ["bn"]) {
      urls.push(`  <url>\n    <loc>${urlOf(r.slug, lang)}</loc>\n    <lastmod>${day(r.updated_at || r.publish_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>${alts}${image}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`;
}
/* Google News sitemap: only articles published in the last 48 hours (Google's rule), one entry per language version */
function newsSitemap(posts) {
  const since = Date.now() - 48 * 3600e3;
  const urls = [];
  for (const r of posts) {
    if (new Date(r.publish_at).getTime() < since) continue;
    for (const lang of hasLang(r, "en") ? ["bn", "en"] : ["bn"]) {
      const v = view(r, lang);
      urls.push(`  <url>\n    <loc>${urlOf(r.slug, lang)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${esc(C.site.name)}</news:name>\n        <news:language>${lang}</news:language>\n      </news:publication>\n      <news:publication_date>${new Date(r.publish_at).toISOString()}</news:publication_date>\n      <news:title>${esc(v.title)}</news:title>\n    </news:news>\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
function feed(posts, lang) {
  const items = posts.slice(0, 30).map((r) => {
    const v = view(r, lang); const c = catOf(r.category);
    return `    <item>\n      <title>${esc(v.title)}</title>\n      <link>${urlOf(r.slug, lang)}</link>\n      <guid isPermaLink="true">${urlOf(r.slug, lang)}</guid>\n      <pubDate>${new Date(r.publish_at).toUTCString()}</pubDate>\n      <category>${esc(lang === "bn" ? c.bn : c.en)}</category>\n      <description>${esc(v.excerpt)}</description>\n    </item>`;
  }).join("\n");
  const last = posts.length ? new Date(posts[0].publish_at).toUTCString() : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${esc(C.site.name)}</title>\n    <link>${ORIGIN}/</link>\n    <atom:link href="${ORIGIN}${lang === "en" ? "/en" : ""}/feed.xml" rel="self" type="application/rss+xml"/>\n    <description>${lang === "bn" ? "বাংলাদেশের স্টার্টআপ, ব্যবসা ও বিনিয়োগের যাচাইকৃত খবর" : "Verified Bangladesh startup, business and investment news"}</description>\n    <language>${lang}</language>\n    <lastBuildDate>${last}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`;
}

/* ---- crawlable headline index on the home, news and topic pages ----
 * Article lists on those pages are drawn by js/main.js after the page loads. This adds a plain-HTML
 * "latest headlines" list (descriptive anchor = the article's own headline) so every hub page links to its
 * articles in the raw HTML. It lives between <!--hl--> markers right before </main>. */
function headlineIndex(posts, scope) {
  const list = (scope === "all" ? posts : posts.filter((p) => p.category === scope)).slice(0, scope === "all" ? 20 : 12);
  if (!list.length) return "";
  const cat = cats.find((c) => c.id === scope);
  const bnH = cat ? `সর্বশেষ শিরোনাম — ${cat.bn}` : "সর্বশেষ শিরোনাম", enH = cat ? `Latest headlines — ${cat.en}` : "Latest headlines";
  const li = list.map((r) => {
    const bn = view(r, "bn").title, en = view(r, "en").title || bn;
    return `<li><a href="/read/${esc(r.slug)}" data-bn="${esc(bn)}" data-en="${esc(en)}">${esc(bn)}</a></li>`;
  }).join("");
  return `<!--hl--><section class="headline-index"><div class="container"><h2 data-bn="${esc(bnH)}" data-en="${esc(enH)}">${esc(bnH)}</h2><ul>${li}</ul></div></section><!--/hl-->`;
}
function injectHeadlines(posts) {
  const targets = [["index.html", "all"], ["news.html", "all"], ...cats.map((c) => [c.slug + ".html", c.id])];
  let n = 0;
  for (const [file, scope] of targets) {
    const f = path.join(ROOT, file);
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    const block = headlineIndex(posts, scope);
    let out = s.replace(/<!--hl-->[\s\S]*?<!--\/hl-->\s*/, "");
    if (block) out = out.replace(/(\s*)<\/main>/, `\n  ${block}\n  </main>`);
    if (out !== s) { fs.writeFileSync(f, out); n++; }
  }
  return n;
}

/* ---- main ---- */
(async () => {
  const posts = await fetchPosts();
  let changed = 0;
  const keep = new Set();
  for (const r of posts) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) continue;
    const bn = `read/${r.slug}.html`;
    keep.add(bn); if (write(bn, articlePage(r, "bn", posts))) changed++;
    if (hasLang(r, "en")) { const en = `en/read/${r.slug}.html`; keep.add(en); if (write(en, articlePage(r, "en", posts))) changed++; }
  }
  // remove pages whose article is gone / unpublished / now only scheduled
  for (const dir of ["read", "en/read"]) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const rel = `${dir}/${f}`;
      if (f.endsWith(".html") && !keep.has(rel)) { fs.unlinkSync(path.join(ROOT, rel)); changed++; }
    }
  }
  changed += injectHeadlines(posts);
  if (write("sitemap.xml", sitemap(posts))) changed++;
  if (write("news-sitemap.xml", newsSitemap(posts))) changed++;
  if (write("feed.xml", feed(posts, "bn"))) changed++;
  if (write("en/feed.xml", feed(posts, "en"))) changed++;
  console.log(`Built ${posts.length} article(s); ${changed} file(s) changed.`);
})().catch((e) => { console.error("BUILD FAILED:", e.message); process.exit(1); });
