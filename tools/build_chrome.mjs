#!/usr/bin/env node
/* Voice of Startup Bangladesh — crawlable page chrome.
 *
 * The site's header, footer, headings and legal text are drawn by js/main.js for the visitor's language.
 * Search engines (and "sitelinks") work best when the same links and headings are ALSO in the raw HTML.
 * This script writes that static copy (Bangla = default language) into every page. main.js simply replaces it
 * when it runs, so nothing changes for visitors. It is safe to run any number of times (idempotent):
 *     node tools/build_chrome.mjs
 * Run automatically after tools/build_static.mjs by .github/workflows/build-static.yml.
 *
 * What it writes:
 *   - <div id="site-top"> / <div id="site-bottom">  main menu, footer with ALL topic links + legal links + contacts
 *   - text of every [data-bn] element (so <h1>/<h2>/paragraphs are never empty in the raw HTML)
 *   - visible breadcrumb + BreadcrumbList JSON-LD on inner pages
 *   - an <h2> above the article list on news / topic pages
 *   - full legal text inside the five policy pages
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD = createRequire(import.meta.url)(path.join(ROOT, "js/md.js"));
const esc = MD.esc;
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8"), sb);
const C = sb.window.VOSB, ORIGIN = C.site.origin;
const sbl = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/legal.js"), "utf8"), sbl);
const LEG = sbl.window.VOSB_LEGAL;

const NAV = [
  ["/", "হোম", "Home"], ["/news", "সংবাদ", "News"], ["/funding", "ফান্ডিং", "Funding"], ["/founder-stories", "ফাউন্ডার স্টোরি", "Founder Stories"],
  ["/about", "আমাদের সম্পর্কে", "About"], ["/careers", "ক্যারিয়ার", "Careers"], ["/contact", "যোগাযোগ", "Contact"],
];
const LEGAL = [
  ["/privacy-policy", "গোপনীয়তা নীতি", "Privacy Policy"], ["/terms-of-service", "ব্যবহারের শর্তাবলি", "Terms of Service"],
  ["/cookie-policy", "কুকি নীতি", "Cookie Policy"], ["/refund-policy", "রিফান্ড নীতি", "Refund Policy"], ["/usage-policy", "ব্যবহার নীতি", "Usage Policy"],
];
const LABEL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", x: "X (Twitter)" };
const PAGE_NAME = { "/news": ["সংবাদ", "News"], "/about": ["আমাদের সম্পর্কে", "About"], "/contact": ["যোগাযোগ", "Contact"], "/careers": ["ক্যারিয়ার", "Careers"] };
LEGAL.forEach(([h, bn, en]) => (PAGE_NAME[h] = [bn, en]));
C.categories.forEach((c) => (PAGE_NAME["/" + c.slug] = [c.bn, c.en]));

const T = (en, bn, a, b) => (en ? b : a);   // helper: T(isEn, ...)

function topics(en) {
  return `<details class="nav-dd"><summary>${en ? "Topics" : "বিষয়"}</summary><div class="dd-menu">${C.categories.map((c) => `<a href="/${c.slug}">${esc(en ? c.en : c.bn)}</a>`).join("")}</div></details>`;
}
function top(en) {
  const t = (bn, e) => (en ? e : bn);
  return `<!--s--><div class="topbar"><div class="container"><span class="flagline"><span class="flagdot"></span>${t("সরকার অনুমোদিত সংস্থার তথ্যসূত্রে যাচাইকৃত আপডেট", "Updates verified from government-approved sources")}</span></div></div>
      <header class="site-header"><div class="container">
        <a class="brand" href="/" aria-label="Voice of Startup Bangladesh"><img src="/assets/logo.png" alt="Voice of Startup BD logo"></a>
        <nav class="nav" id="nav" aria-label="Main">${NAV.map(([h, bn, e], i) => `<a href="${h}">${esc(t(bn, e))}</a>${i === 1 ? topics(en) : ""}`).join("")}</nav>
      </div></header><!--e-->`;
}
function bottom(en) {
  const t = (bn, e) => (en ? e : bn);
  const social = Object.keys(C.social).map((k) => `<a href="${C.social[k]}" target="_blank" rel="noopener">${LABEL[k]}</a>`).join(" ");
  return `<!--s--><footer class="site-footer"><div class="container">
        <div class="footer-grid">
          <div><p style="color:#d6d6d6;max-width:40ch">${t("স্টার্টআপ, ব্যবসা ও বিনিয়োগের সব আপডেট সবার আগে।", "Startup, business & investment updates — first.")}</p><div class="footer-socials">${social}</div></div>
          <div><h4>${t("এক্সপ্লোর", "Explore")}</h4><ul>${C.categories.map((c) => `<li><a href="/${c.slug}">${esc(t(c.bn, c.en))}</a></li>`).join("")}<li><a href="/about">${t("আমাদের সম্পর্কে", "About us")}</a></li><li><a href="/careers">${t("ক্যারিয়ার", "Careers")}</a></li></ul></div>
          <div><h4>${t("যোগাযোগ", "Contact")}</h4>${C.emails.map((e) => `<p><a href="mailto:${e.address}">${e.address}</a></p>`).join("")}</div>
        </div>
        <nav class="legal-links" aria-label="Legal">${LEGAL.map(([h, bn, e]) => `<a href="${h}">${esc(t(bn, e))}</a>`).join("")}</nav>
        <div class="footer-bottom"><span>© Voice of Startup Bangladesh. ${t("সর্বস্বত্ব সংরক্ষিত।", "All rights reserved.")}</span><span>${C.site.domain}</span></div>
      </div></footer><!--e-->`;
}

function legalBody(key) {
  const d = LEG[key]; if (!d) return null;
  const date = new Date(LEG.updated + "T00:00:00+06:00").toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", year: "numeric", month: "long", day: "numeric" });
  const secs = d.sections.map((s, i) => `<section id="s${i + 1}"><h2>${i + 1}. ${esc(s.h.bn)}</h2>${(s.p || []).map((x) => `<p>${esc(x.bn)}</p>`).join("")}${s.ul ? `<ul>${s.ul.map((x) => `<li>${esc(x.bn)}</li>`).join("")}</ul>` : ""}${(s.p2 || []).map((x) => `<p>${esc(x.bn)}</p>`).join("")}</section>`).join("");
  const toc = d.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.h.bn)}</a></li>`).join("");
  return `<!--s--><p class="eyebrow">আইনি তথ্য</p><h1>${esc(d.title.bn)}</h1><p class="muted legal-meta">কার্যকর ও সর্বশেষ হালনাগাদ: ${date}</p><p class="legal-intro">${esc(d.intro.bn)}</p><nav class="legal-toc" aria-label="সূচিপত্র"><b>সূচিপত্র</b><ol>${toc}</ol></nav>${secs}<div class="legal-contact"><b>প্রশ্ন আছে?</b> যোগাযোগ করুন <a href="mailto:hello@voiceofstartup.bd">hello@voiceofstartup.bd</a></div><!--e-->`;
}

const CAT_DESC = {
  funding: "ফান্ডিং রাউন্ড, গ্রান্ট ও স্টার্টআপ প্রতিযোগিতার সর্বশেষ আপডেট।", founder: "সফল উদ্যোক্তাদের অনুপ্রেরণামূলক ফাউন্ডার স্টোরি।",
  business: "ব্যবসা, বিনিয়োগ ও নীতিমালার গুরুত্বপূর্ণ খবর।", opportunity: "নতুন উদ্যোক্তাদের জন্য কাজের তথ্য ও সুযোগ।",
  tech: "ফিনটেক, এডটেক, SaaS ও এআই স্টার্টআপের খবর।", market: "বাজারের ট্রেন্ড, রিপোর্ট ও তথ্যভিত্তিক বিশ্লেষণ।",
  events: "স্টার্টআপ সামিট, বুটক্যাম্প ও ওয়ার্কশপের আপডেট।", guide: "ব্যবসা শুরু ও বড় করার ধাপে ধাপে গাইড।",
  international: "বিশ্ব স্টার্টআপ জগতের খবর ও শেখার বিষয়।", interview: "ফাউন্ডার ও বিশেষজ্ঞদের সাক্ষাৎকার ও মতামত।",
};
const catCardsStatic = () => C.categories.map((c) => `<a class="cat-card" href="/${c.slug}"><h3>${esc(c.bn)}</h3><p>${esc(CAT_DESC[c.key || c.id] || "")}</p></a>`).join("");

function crumbs(urlPath) {
  const items = [["/", "হোম", "Home"]];
  const isCat = C.categories.some((c) => "/" + c.slug === urlPath);
  if (isCat) items.push(["/news", "সংবাদ", "News"]);
  const nm = PAGE_NAME[urlPath]; items.push([urlPath, nm[0], nm[1]]);
  const html = `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([h, bn, en], i) => (i === items.length - 1 ? `<span aria-current="page" data-bn="${esc(bn)}" data-en="${esc(en)}">${esc(bn)}</span>` : `<a href="${h}" data-bn="${esc(bn)}" data-en="${esc(en)}">${esc(bn)}</a><span aria-hidden="true">›</span>`)).join("")}</nav>`;
  const ld = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([h, bn, en], i) => ({ "@type": "ListItem", position: i + 1, name: en, item: ORIGIN + (h === "/" ? "/" : h) })) };
  return { html, ld: `<script type="application/ld+json" id="ld-crumbs">${JSON.stringify(ld)}</script>` };
}

const replaceBlock = (s, id, inner) => s.replace(new RegExp(`<div id="${id}">(?:<!--s-->[\\s\\S]*?<!--e-->)?</div>`), `<div id="${id}">${inner}</div>`);

function processPage(file, { root }) {
  let s = fs.readFileSync(file, "utf8"), before = s;
  const en = /<html lang="en"/.test(s);
  if (!/<div id="site-top">/.test(s)) return;
  s = replaceBlock(s, "site-top", top(en));
  s = replaceBlock(s, "site-bottom", bottom(en));
  if (root) {
    const rel = "/" + path.basename(file, ".html");
    // raw text for every translated element (default language = Bangla)
    s = s.replace(/<(h1|h2|h3|p|span|a|button|li|small|b|label|summary|strong)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
      const bn = (attrs.match(/\sdata-bn="([^"]*)"/) || [])[1];
      if (bn === undefined || /data-ph-bn/.test(attrs)) return m;
      if (new RegExp(`<${tag}[\\s>]`).test(inner) || /<(div|section|form|ul|ol|table)[\s>]/.test(inner)) return m;
      return `<${tag}${attrs}>${bn}</${tag}>`;
    });
    // home page + About: topic cards as plain links (descriptive anchor text) in the raw HTML
    s = s.replace(/(<div class="cat-grid" id="(?:categories|about-cats)">)(?:<!--s-->[\s\S]*?<!--e-->)?(<\/div>)/g, `$1<!--s-->${catCardsStatic()}<!--e-->$2`);
    // legal pages: full text in raw HTML
    const key = (s.match(/<body[^>]*data-legal="([a-z]+)"/) || [])[1];
    if (key) s = s.replace(/<article class="legal" id="legal">[\s\S]*?<\/article>/, `<article class="legal" id="legal">${legalBody(key)}</article>`);
    // breadcrumb + JSON-LD on inner pages
    if (PAGE_NAME[rel] && !/class="crumbs"/.test(s)) {
      const c = crumbs(rel);
      s = s.replace(/(<section class="page-hero"><div class="container">)/, `$1${c.html}`).replace(/(<article class="legal" id="legal">)/, `$1${c.html}`);
      if (!/"@type":"BreadcrumbList"/.test(s)) s = s.replace("</head>", `  ${c.ld}\n</head>`);
    }
    // h2 above the article list
    if (/<div class="post-grid" id="news-list">/.test(s) && !/class="list-h"/.test(s)) {
      const cat = C.categories.find((c) => "/" + c.slug === rel);
      const bn = cat ? `সর্বশেষ ${cat.bn}` : "সর্বশেষ সংবাদ ও আপডেট", e = cat ? `Latest ${cat.en}` : "Latest news & updates";
      s = s.replace(/(<div class="filters-wrap")/, `<h2 class="list-h" data-bn="${esc(bn)}" data-en="${esc(e)}">${esc(bn)}</h2>\n      $1`);
    }
  }
  if (s !== before) { fs.writeFileSync(file, s); console.log("updated", path.relative(ROOT, file)); }
}

const rootPages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !["admin.html", "article.html"].includes(f)).map((f) => path.join(ROOT, f));
rootPages.forEach((f) => processPage(f, { root: true }));
for (const d of ["read", "en/read"]) {
  const dir = path.join(ROOT, d);
  if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.endsWith(".html")).forEach((f) => processPage(path.join(dir, f), { root: false }));
}
