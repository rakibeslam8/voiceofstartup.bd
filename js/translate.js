/* Voice of Startup Bangladesh — automatic Bangla <-> English translation for the admin editor.
   Used only when the editor leaves one language empty. The result is saved with the article, so
   readers and Google receive normal static text (no translation happens on the public site).
   Engines tried in order: Google Translate web endpoint, then MyMemory (free). Both are called
   straight from the admin's browser. If both fail, the article is still saved (original language only). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.VOSB_TR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const CHUNK = 1400;

  /* ---- engines (each: async (text, from, to) => translated text) ---- */
  async function google(text, from, to, f) {
    const body = new URLSearchParams({ client: "gtx", sl: from, tl: to, dt: "t", q: text });
    const res = await f("https://translate.googleapis.com/translate_a/single", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: body.toString(),
    });
    if (!res.ok) throw new Error("google " + res.status);
    const j = await res.json();
    if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error("google format");
    return j[0].map((s) => (s && s[0]) || "").join("");
  }
  async function myMemory(text, from, to, f) {
    // MyMemory accepts at most ~500 characters per request, so split on sentence ends.
    const parts = [];
    let cur = "";
    text.split(/(?<=[।.!?\n])/).forEach((s) => {
      if ((cur + s).length > 450) { if (cur) parts.push(cur); cur = s.length > 450 ? (parts.push(...s.match(/[\s\S]{1,450}/g)), "") : s; }
      else cur += s;
    });
    if (cur) parts.push(cur);
    let out = "";
    for (const p of parts) {
      if (!p.trim()) { out += p; continue; }
      const res = await f(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${from}|${to}`);
      if (!res.ok) throw new Error("mymemory " + res.status);
      const j = await res.json();
      const t = j && j.responseData && j.responseData.translatedText;
      if (!t || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error("mymemory limit");
      out += t + (/\s$/.test(p) ? p.match(/\s+$/)[0] : "");
    }
    return out;
  }

  async function plain(text, from, to, opts) {
    const f = (opts && opts.fetch) || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    if (!f) throw new Error("no fetch");
    const engines = (opts && opts.engines) || [google, myMemory];
    let lastErr;
    for (const e of engines) {
      try { const r = await e(text, from, to, f); if (r && r.trim()) return r; } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error("translation failed");
  }

  /* ---- Markdown-aware translation ---- */
  const FILELIKE = /^(image|img|photo|picture)?[\s_-]*\d*(\.(png|jpe?g|webp|gif))?$|\.(png|jpe?g|webp|gif)$/i;   // same test the page uses to hide "captions" that are only a file name
  function protect(md) {
    const urls = [], imgs = [];
    let s = String(md || "").replace(/\r\n?/g, "\n");
    // pictures (own line or inline) -> placeholder; the description (alt/caption) is translated separately, the address is kept
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => { imgs.push({ alt, url: u }); return `QQIMG${imgs.length}QQ`; });
    // links: remember URL, keep [text]
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => { urls.push(u); return `[${t}]`; });
    return { text: s, urls, imgs };
  }
  function restore(text, p) {
    let s = text;
    // translators sometimes add spaces inside ** ** and * *
    s = s.replace(/\*\*\s+([^*\n]+?)\s*\*\*/g, "**$1**").replace(/\*\*([^*\n]+?)\s+\*\*/g, "**$1**");
    // headings / lists / quotes: make sure a space follows the marker
    s = s.replace(/^(\s*)(#{2,3})(?=\S)/gm, "$1$2 ").replace(/^(\s*)([-*•])(?=[^\s*-])/gm, "$1$2 ").replace(/^(\s*>)(?=\S)/gm, "$1 ");
    let k = 0;
    s = s.replace(/\[([^\]]+)\](?!\()/g, (m, t) => (k < p.urls.length ? `[${t}](${p.urls[k++]})` : m));
    s = s.replace(/QQ\s*IMG\s*(\d+)\s*QQ/gi, (m, n) => { const i = p.imgs[+n - 1]; return i ? `![${(i.alt2 != null ? i.alt2 : i.alt).replace(/[\]\[()]/g, "")}](${i.url})` : ""; });
    return s.replace(/(\S) {2,}/g, "$1 ");
  }
  function chunks(text) {
    const paras = text.split(/\n{2,}/);
    const out = [];
    let cur = "";
    for (const para of paras) {
      if (para.length > CHUNK) {
        if (cur) { out.push(cur); cur = ""; }
        (para.match(/[\s\S]{1,1400}(?:\s|$)/g) || [para]).forEach((x) => out.push(x));
      } else if ((cur + "\n\n" + para).length > CHUNK && cur) { out.push(cur); cur = para; }
      else cur = cur ? cur + "\n\n" + para : para;
    }
    if (cur) out.push(cur);
    return out;
  }
  const nLinks = (t) => (t.match(/\[[^\]]+\](?!\()/g) || []).length;

  /* a short text (title, summary, picture description) */
  async function title(t, from, to, opts) {
    const r = await plain(String(t || "").trim(), from, to, opts);
    return r.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  }
  /* a list of short texts in one request (falls back to one by one if the lines do not come back 1:1) */
  async function list(items, from, to, opts) {
    const idx = [], txt = [];
    items.forEach((t, i) => { t = String(t || "").replace(/\s+/g, " ").trim(); if (t && !FILELIKE.test(t)) { idx.push(i); txt.push(t); } });
    const out = items.slice();
    if (!txt.length) return out;
    let res;
    try { const r = (await plain(txt.join("\n"), from, to, opts)).split("\n").map((x) => x.replace(/\s+/g, " ").trim()); if (r.length === txt.length && r.every(Boolean)) res = r; } catch (e) {}
    if (!res) { res = []; for (const t of txt) res.push(await title(t, from, to, opts)); }
    idx.forEach((i, k) => (out[i] = res[k].replace(/^["“]|["”]$/g, "")));
    return out;
  }
  /* a paragraph whose links got lost in translation: translate the text between/inside the links on its own, keep every address */
  async function viaSegments(part, from, to, opts) {
    const segs = part.split(/(\[[^\]]+\](?!\())/);
    const out = [];
    for (const sg of segs) {
      if (/^\[[^\]]+\]$/.test(sg)) out.push("[" + (await title(sg.slice(1, -1), from, to, opts)) + "]");
      else if (/\S/.test(sg) && !/^\s*QQIMG\d+QQ\s*$/.test(sg)) { const lead = sg.match(/^\s*/)[0], tail = sg.match(/\s*$/)[0]; out.push(lead + (await plain(sg.trim(), from, to, opts)) + tail); }
      else out.push(sg);
    }
    return out.join("");
  }

  async function markdown(md, from, to, opts) {
    const src = String(md || "");
    if (!src.trim()) return "";
    const p = protect(src);
    // picture descriptions / captions (these are shown under the pictures)
    if (p.imgs.length) { const alts = await list(p.imgs.map((i) => i.alt), from, to, opts); p.imgs.forEach((i, k) => (i.alt2 = alts[k])); }
    const parts = chunks(p.text);
    const done = [];
    for (const part of parts) {
      if (!/\S/.test(part) || /^(\s*QQIMG\d+QQ\s*)+$/.test(part)) { done.push(part); continue; }
      let t = await plain(part, from, to, opts);
      if (nLinks(t) !== nLinks(part)) t = await viaSegments(part, from, to, opts);   // keep every link working
      done.push(t);
    }
    return restore(done.join("\n\n"), p).trim();
  }

  /* update the other language after an edit: only the changed paragraphs are translated again, every untouched
     paragraph of the other language stays exactly as it is. Falls back to translating everything when the two
     versions no longer line up paragraph by paragraph. */
  const blocks = (t) => String(t || "").replace(/\r\n?/g, "\n").trim().split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  async function sync(oldSrc, newSrc, oldTgt, from, to, opts) {
    const oS = blocks(oldSrc), nS = blocks(newSrc), oT = blocks(oldTgt);
    if (!nS.length) return String(oldTgt || "");
    if (!oS.length || !oT.length || oT.length !== oS.length) return markdown(newSrc, from, to, opts);
    let pre = 0; while (pre < oS.length && pre < nS.length && oS[pre] === nS[pre]) pre++;
    let suf = 0; while (suf < oS.length - pre && suf < nS.length - pre && oS[oS.length - 1 - suf] === nS[nS.length - 1 - suf]) suf++;
    const mid = nS.slice(pre, nS.length - suf);
    const head = oT.slice(0, pre), tail = suf ? oT.slice(oT.length - suf) : [];
    const mt = mid.length ? await markdown(mid.join("\n\n"), from, to, opts) : "";
    return [...head, ...(mt ? [mt] : []), ...tail].join("\n\n");
  }
  /* translate only the picture descriptions inside a text (used to repair older articles) */
  async function altsOnly(md, from, to, opts) {
    const src = String(md || "");
    const wrong = (alt) => { alt = alt.trim(); if (!alt || FILELIKE.test(alt)) return false; const bn = /[ঀ-৿]/.test(alt); return to === "en" ? bn : !bn && /[A-Za-z]{3}/.test(alt); };
    const alts = []; src.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt) => (alts.push(alt), m));
    const todo = alts.filter(wrong);
    if (!todo.length) return { text: src, changed: 0 };
    const tr = await list(todo, from, to, opts), map = new Map(todo.map((a, i) => [a, tr[i]]));
    let n = 0;
    const text = src.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => { const t = map.get(alt); if (t && t !== alt) { n++; return `![${t.replace(/[\]\[()]/g, "")}](${u})`; } return m; });
    return { text, changed: n };
  }

  return { plain, markdown, title, list, sync, altsOnly, protect, restore, chunks, engines: { google, myMemory } };
});
