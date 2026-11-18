// Turns a web page (HTML text) into an article draft for the VOSB editor: title, summary, cover image, byline and the
// article body in the editor's Markdown-lite format (## heading, **bold**, *italic*, [link](url), ![caption](image), - list, > quote).
// Pure code (no network) so it can be tested on its own.
import { parseHTML } from "npm:linkedom@0.16.11";
import { Readability } from "npm:@mozilla/readability@0.5.0";

export type Extracted = {
  title: string; excerpt: string; markdown: string; cover: string; coverAlt: string; author: string; siteName: string;
  publishedAt: string; lang: "bn" | "en"; images: string[]; canonical: string;
};

const BN = /[ঀ-৿]/g;
const clean = (s: string) => String(s || "").replace(/[\u200b\ufeff]/g, "").replace(/\s+/g, " ").trim();
const FILEY = /^(image|img|photo|picture)?[\s_-]*\d*(\.(png|jpe?g|webp|gif))?$|\.(png|jpe?g|webp|gif)$/i;

export function absUrl(u: string | null | undefined, base: string): string {
  if (!u) return "";
  u = String(u).trim();
  if (!u || /^(data:|javascript:|blob:|#)/i.test(u)) return "";
  try { const x = new URL(u, base); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
}
function bestSrc(img: any, base: string): string {
  const cands: string[] = [];
  const ss = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
  if (ss) {
    const list = ss.split(",").map((p: string) => p.trim().split(/\s+/)).filter((p: string[]) => p[0]);
    list.sort((a: string[], b: string[]) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
    if (list[0]) cands.push(list[0][0]);
  }
  for (const a of ["data-src", "data-lazy-src", "data-original", "data-orig-file", "data-large-file", "src"]) { const v = img.getAttribute(a); if (v) cands.push(v); }
  for (const c of cands) { const u = absUrl(c, base); if (u) return u; }
  return "";
}
const tinyOrJunk = (img: any, u: string) => {
  const w = parseInt(img.getAttribute("width") || "0"), h = parseInt(img.getAttribute("height") || "0");
  if ((w && w < 60) || (h && h < 60)) return true;
  return /\.svg(\?|$)|pixel|spacer|blank\.|1x1|sprite|emoji|\/ads?\/|doubleclick|facebook\.com\/tr|gravatar/i.test(u);
};
const metaOf = (doc: any, ...keys: string[]) => {
  for (const k of keys) {
    const el = doc.querySelector(`meta[property="${k}"], meta[name="${k}"], meta[itemprop="${k}"]`);
    const v = el && clean(el.getAttribute("content") || "");
    if (v) return v;
  }
  return "";
};

/* ---------- HTML -> Markdown-lite ---------- */
export function toMarkdown(root: any, base: string, imgs: string[]): string {
  const blocks: string[] = [];
  let buf = "";
  const flush = () => { const t = buf.replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").replace(/ {2,}/g, " ").trim(); if (t) blocks.push(t); buf = ""; };
  const capOf = (s: string) => { s = clean(s).replace(/[\[\]()]/g, ""); return FILEY.test(s) ? "" : s.slice(0, 220); };
  const pushImg = (img: any, cap = "") => {
    const u = bestSrc(img, base); if (!u || tinyOrJunk(img, u)) return;
    flush(); imgs.push(u);
    blocks.push(`![${capOf(cap || img.getAttribute("alt") || img.getAttribute("title") || "")}](${u})`);
  };
  const isCapEl = (n: any) => /caption|credit|photo-?by|image-?desc|img-?desc/i.test(String(n.getAttribute && n.getAttribute("class") || "") + " " + String(n.getAttribute && n.getAttribute("id") || ""));
  const attachCap = (text: string): boolean => {
    const last = blocks.length - 1; const m = last >= 0 && blocks[last].match(/^!\[([^\]]*)\]\((.+)\)$/);
    const c = capOf(text);
    if (!m || !c) return false;
    blocks[last] = `![${m[1] ? m[1] + " " + c : c}](${m[2]})`; return true;
  };
  const inlineText = (el: any): string => {
    let s = "";
    for (const n of Array.from(el.childNodes) as any[]) {
      if (n.nodeType === 3) s += String(n.textContent).replace(/\s+/g, " ").replace(/[\[\]]/g, (c) => (c === "[" ? "(" : ")"));
      else if (n.nodeType === 1) {
        const t = String(n.tagName).toLowerCase();
        if (t === "br") s += "\n";
        else if (t === "strong" || t === "b") { const x = inlineText(n).trim(); s += x ? `**${x.replace(/\*+/g, "")}**` : ""; }
        else if (t === "em" || t === "i") { const x = inlineText(n).trim(); s += x ? `*${x.replace(/\*+/g, "")}*` : ""; }
        else if (t === "a") {
          const href = absUrl(n.getAttribute("href"), base) || (/^mailto:/i.test(n.getAttribute("href") || "") ? n.getAttribute("href") : "");
          const x = inlineText(n).replace(/\*+/g, "").trim();
          s += href && x && !/[()\s]/.test(href) ? `[${x}](${href})` : x;
        }
        else if (t === "img" || t === "figure" || t === "picture" || t === "script" || t === "style" || t === "noscript" || t === "svg" || t === "button") { /* handled elsewhere / skipped */ }
        else s += inlineText(n);
      }
    }
    return s;
  };
  const hasBlockKids = (el: any) => Array.from(el.children as any[]).some((c: any) => /^(p|div|section|article|ul|ol|blockquote|figure|h[1-6]|table|hr|pre)$/i.test(c.tagName));
  const hasImg = (el: any) => !!el.querySelector && !!el.querySelector("img");

  function walk(el: any) {
    for (const n of Array.from(el.childNodes) as any[]) {
      if (n.nodeType === 3) { buf += String(n.textContent).replace(/\s+/g, " ").replace(/[\[\]]/g, (c) => (c === "[" ? "(" : ")")); continue; }
      if (n.nodeType !== 1) continue;
      const t = String(n.tagName).toLowerCase();
      if (/^(script|style|noscript|svg|button|form|nav|aside|footer|header|iframe|input|select|textarea)$/.test(t)) {
        if (t === "iframe") { const src = absUrl(n.getAttribute("src"), base); if (/youtube\.com\/embed|youtu\.be|player\.vimeo\.com/i.test(src)) { flush(); blocks.push(`[${/vimeo/i.test(src) ? "Watch the video" : "Watch the video on YouTube"}](${src.replace("youtube.com/embed/", "youtube.com/watch?v=")})`); } }
        continue;
      }
      if (/^h[1-6]$/.test(t)) { flush(); const x = clean(inlineText(n)).replace(/\*+/g, ""); if (x) blocks.push(`${t === "h1" || t === "h2" ? "##" : "###"} ${x}`); continue; }
      if (t === "figcaption") { flush(); attachCap(n.textContent || ""); continue; }
      if (t === "figure") {
        const img = n.querySelector("img"); const cap = n.querySelector("figcaption");
        if (img) pushImg(img, cap ? cap.textContent : "");
        else walk(n);
        continue;
      }
      if (t === "picture") { const img = n.querySelector("img"); if (img) pushImg(img); continue; }
      if (t === "img") { pushImg(n); continue; }
      if (t === "ul" || t === "ol") {
        flush(); let i = 0;
        for (const li of Array.from(n.children) as any[]) { if (String(li.tagName).toLowerCase() !== "li") continue; const x = clean(inlineText(li)); if (x) blocks.push(`${t === "ol" ? ++i + "." : "-"} ${x}`); }
        // consecutive items must stay one list: join them with single newlines
        const items: string[] = []; while (blocks.length && /^(-|\d+\.) /.test(blocks[blocks.length - 1]) && items.length < 200) items.unshift(blocks.pop()!);
        if (items.length) blocks.push(items.join("\n"));
        continue;
      }
      if (t === "blockquote") { flush(); const x = clean(inlineText(n)); if (x) blocks.push("> " + x); continue; }
      if (t === "hr") { flush(); blocks.push("---"); continue; }
      if (t === "br") { buf += "\n"; continue; }
      if (t === "table") { flush(); for (const tr of Array.from(n.querySelectorAll("tr")) as any[]) { const cells = Array.from(tr.querySelectorAll("th,td")).map((c: any) => clean(inlineText(c))).filter(Boolean); if (cells.length) blocks.push("- " + cells.join(" | ")); } continue; }
      if (t === "p" || t === "pre") {
        flush();
        if (hasImg(n)) { walk(n); flush(); continue; }
        const x = inlineText(n).replace(/[ \t]+\n/g, "\n").trim();
        if (clean(x) && isCapEl(n) && attachCap(x)) continue;
        if (clean(x)) blocks.push(x.replace(/\n{2,}/g, "\n"));
        continue;
      }
      if (t === "div" || t === "section" || t === "article" || t === "main" || t === "span" || t === "li" || t === "center" || t === "font") {
        if (hasBlockKids(n) || hasImg(n)) { flush(); walk(n); flush(); }
        else { flush(); const x = inlineText(n).trim(); if (clean(x) && isCapEl(n) && attachCap(x)) continue; if (clean(x)) blocks.push(x.replace(/\n{2,}/g, "\n")); }
        continue;
      }
      // inline-ish leftovers (a, strong, em…): treat as text
      buf += inlineText({ childNodes: [n] });
    }
  }
  walk(root); flush();
  // a short "Photo: …" / "ছবি: …" line right under a picture is that picture's caption
  const CAPLINE = /(ছবি|ফটো|ছবিঃ|photo|image|picture|credit|photo credit|file photo|courtesy|সৌজন্যে|সূত্র)\s*[:：\-–]|সংগৃহীত\s*$/i;
  for (let i = 1; i < blocks.length; i++) {
    const m = blocks[i - 1].match(/^!\[([^\]]*)\]\((.+)\)$/);
    if (m && blocks[i].length < 220 && !blocks[i].includes("\n") && CAPLINE.test(blocks[i])) { const c = capOf(blocks[i]); blocks[i - 1] = `![${m[1] ? m[1] + " " + c : c}](${m[2]})`; blocks.splice(i, 1); i--; }
  }
  // never leave a paragraph that would be read as a list/heading/quote by mistake
  return blocks.map((b) => (/^(\*\*|\*)/.test(b) || /^(#{1,3} |> |- |\d+\. |!\[|\[|---)/.test(b) ? b : b.replace(/^([#>\-•])\s/, "$1\u200a"))).join("\n\n").slice(0, 80000);
}

/* ---------- whole page ---------- */
function fallbackRoot(doc: any): any {
  const sels = ['[itemprop="articleBody"]', "article", ".article-body", ".entry-content", ".post-content", ".story-body", ".news-details", ".details", ".content-details", "#content", "main"];
  for (const s of sels) { const el = doc.querySelector(s); if (el && clean(el.textContent).length > 300) return el; }
  let best: any = null, score = 0;
  for (const el of Array.from(doc.querySelectorAll("div,section")) as any[]) {
    const sc = Array.from(el.children as any[]).filter((c: any) => c.tagName === "P").reduce((a: number, p: any) => a + clean(p.textContent).length, 0);
    if (sc > score) { score = sc; best = el; }
  }
  return best;
}

/* ---------- news sites that load their pictures with JavaScript (Quintype: Prothom Alo and others) ----------
   The page HTML has empty picture frames; the real article (text blocks, pictures, captions, hero picture) sits in a JSON block. */
const capClean = (s: string) => clean(s).replace(/[\[\]()]/g, "").slice(0, 320);
function findStory(doc: any): { story: any; cdn: string } | null {
  for (const sc of Array.from(doc.querySelectorAll('script[type="application/json"], script#static-page')) as any[]) {
    const txt = String(sc.textContent || "");
    if (txt.length < 800 || !txt.includes("story-elements")) continue;
    let j: any; try { j = JSON.parse(txt); } catch { continue; }
    let found: any = null;
    const walk = (o: any, d: number) => {
      if (found || d > 9 || !o || typeof o !== "object") return;
      if (Array.isArray(o.cards) && o.cards.some((c: any) => c && Array.isArray(c["story-elements"]))) { found = o; return; }
      for (const k of Object.keys(o)) walk(o[k], d + 1);
    };
    walk(j, 0);
    if (found) {
      const cfg = (j && j.qt && j.qt.config) || {};
      const cdn = String(cfg["cdn-image"] || cfg.cdn_image || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      return { story: found, cdn };
    }
  }
  return null;
}
function fromStory(doc: any, base: string, pageUrl: string, ogTitle: string, siteName: string, desc: string): Extracted | null {
  const f = findStory(doc); if (!f) return null;
  const { story, cdn } = f;
  const pic = (key: string) => key && cdn ? `https://${cdn}/${String(key).replace(/^\/+/, "")}?w=1600` : "";
  const cap = (title: string, attr: string, alt: string) => {
    const t = capClean(title || alt || ""); const a = capClean(attr || "");
    return FILEY.test(t) ? a : (a && !t.includes(a) ? `${t} ${a}`.trim() : t);
  };
  const blocks: string[] = []; const images: string[] = [];
  for (const card of story.cards || []) {
    for (const el of (card && card["story-elements"]) || []) {
      if (!el || typeof el !== "object") continue;
      if (el.type === "text" && typeof el.text === "string") {
        const { document: d } = parseHTML(`<div id="r">${el.text}</div>`) as any; const root = d.querySelector("#r");
        if (el.subtype === "blockquote") {
          const q = root.querySelector("blockquote"); const at = root.querySelector(".attribution");
          const qt = clean(q ? q.textContent : root.textContent), a = clean(at ? at.textContent : "");
          if (qt) blocks.push("> " + qt.replace(/[\[\]]/g, "") + (a ? " — " + a.replace(/[\[\]]/g, "") : ""));
        } else { const m = toMarkdown(root, base, []); if (m) blocks.push(m); }
      } else if (el.type === "title" && clean(el.text || el.title || "")) {
        blocks.push("## " + clean(el.text || el.title).replace(/\*+/g, ""));
      } else if (el.type === "image" && el["image-s3-key"]) {
        const u = pic(el["image-s3-key"]); if (!u) continue;
        images.push(u); blocks.push(`![${cap(el.title, el["image-attribution"], el["alt-text"])}](${u})`);
      } else if (el.type === "youtube-video" && /^https?:/i.test(String(el.url || ""))) {
        blocks.push(`[Watch the video on YouTube](${el.url})`);
      }
    }
  }
  const md = blocks.join("\n\n").slice(0, 80000);
  if (clean(md.replace(/!\[[^\]]*\]\([^)]*\)/g, "")).length < 120) return null;
  const title = clean(story.headline || ogTitle || "");
  const cover = pic(story["hero-image-s3-key"]) || "";
  const coverAlt = cap(story["hero-image-caption"], story["hero-image-attribution"], story["hero-image-alt-text"]);
  const plain = md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*\-]/g, " ");
  const sample = title + " " + plain.slice(0, 1500);
  const bn = (sample.match(BN) || []).length, lat = (sample.match(/[A-Za-z]/g) || []).length;
  const when = Number(story["first-published-at"] || story["published-at"] || 0);
  const authorName = clean(String(story["author-name"] || (Array.isArray(story.authors) && story.authors[0] && story.authors[0].name) || ""));
  return {
    title, excerpt: (clean(typeof story.subheadline === "string" ? story.subheadline : "") || desc || clean(plain)).slice(0, 300),
    markdown: md, cover, coverAlt, author: authorName.slice(0, 80), siteName: siteName.slice(0, 60),
    publishedAt: when > 1e9 ? new Date(when).toISOString() : "", lang: bn > lat * 0.5 ? "bn" : "en",
    images: Array.from(new Set([cover, ...images].filter(Boolean))), canonical: absUrl(story.url, pageUrl) || "",
  };
}

export function extract(html: string, pageUrl: string): Extracted {
  const { document: doc } = parseHTML(html) as any;
  const base = absUrl((doc.querySelector("base[href]") || { getAttribute: () => "" }).getAttribute("href"), pageUrl) || pageUrl;
  const canonical = absUrl((doc.querySelector('link[rel="canonical"]') || { getAttribute: () => "" }).getAttribute("href"), pageUrl);
  const ogTitle = metaOf(doc, "og:title", "twitter:title");
  const docTitle = clean((doc.querySelector("title") || {}).textContent || "");
  const h1 = clean((doc.querySelector("h1") || {}).textContent || "");
  const siteName = metaOf(doc, "og:site_name", "application-name") || new URL(pageUrl).hostname.replace(/^www\./, "");
  let author = metaOf(doc, "author", "article:author", "twitter:creator");
  if (/^https?:/i.test(author)) author = "";
  const publishedAt = metaOf(doc, "article:published_time", "datePublished", "og:article:published_time");
  const cover = absUrl(metaOf(doc, "og:image", "twitter:image", "twitter:image:src"), base);
  const coverAlt = clean(metaOf(doc, "og:image:alt", "twitter:image:alt"));
  const desc = metaOf(doc, "og:description", "twitter:description", "description");

  // 0) pages whose pictures and captions are only in an embedded JSON block
  try { const st = fromStory(doc, base, pageUrl, ogTitle, siteName, desc); if (st) return st; } catch { /* fall back to the normal reader */ }

  // 1) the article text — Readability first, simple fallbacks second
  let contentRoot: any = null, rTitle = "", rByline = "";
  try {
    const { document: d2 } = parseHTML(html) as any;
    const art = new Readability(d2 as any, { charThreshold: 200, keepClasses: true }).parse();
    if (art && art.content && clean(art.textContent || "").length > 200) {
      const { document: cd } = parseHTML(`<div id="r">${art.content}</div>`) as any;
      contentRoot = cd.querySelector("#r"); rTitle = clean(art.title || ""); rByline = clean(art.byline || "");
    }
  } catch { /* fall through */ }
  if (!contentRoot) { const fb = fallbackRoot(doc); if (fb) { contentRoot = fb; } }
  if (!contentRoot) throw new Error("no-article");

  const imgs: string[] = [];
  let md = toMarkdown(contentRoot, base, imgs);
  let title = ogTitle || rTitle || h1 || docTitle;
  // "Headline | Site name" -> "Headline"
  title = clean(title.replace(new RegExp(`\\s*[|\\-–—•·:]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), ""));
  if (clean(md).length < 120) throw new Error("no-article");

  // drop a leading repeat of the headline
  const heads = [title, rTitle, h1, ogTitle].map(clean).filter(Boolean);
  const lines = md.split("\n\n"); if (lines[0] && /^#{1,3} /.test(lines[0]) && heads.includes(clean(lines[0].replace(/^#+\s*/, "")))) md = lines.slice(1).join("\n\n");
  // the picture at the very top of the article IS the cover: it leaves the text and its caption goes to the "cover image description" field
  let leadUrl = "", leadAlt = "";
  const first = md.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\n\n|$)/);
  if (first) { leadAlt = first[1]; leadUrl = first[2]; md = md.slice(first[0].length); imgs.shift(); }
  const coverUrl = leadUrl || cover;

  const plain = md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*\-]/g, " ");
  const sample = title + " " + plain.slice(0, 1500);
  const bn = (sample.match(BN) || []).length, lat = (sample.match(/[A-Za-z]/g) || []).length;
  const lang: "bn" | "en" = bn > lat * 0.5 ? "bn" : "en";
  const excerpt = (desc || clean(plain).slice(0, 300)).slice(0, 300);
  const cover2 = coverUrl || imgs[0] || "";
  const imgsAll = Array.from(new Set([cover2, ...imgs].filter(Boolean)));
  return { title, excerpt, markdown: md, cover: cover2, coverAlt: leadAlt || coverAlt || "", author: clean(author || rByline).slice(0, 80), siteName: siteName.slice(0, 60), publishedAt, lang, images: imgsAll, canonical };
}
