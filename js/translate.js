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
  function protect(md) {
    const urls = [], imgs = [];
    let s = String(md || "").replace(/\r\n?/g, "\n");
    // whole-line images -> placeholder line
    s = s.replace(/^[ \t]*!\[[^\]]*\]\([^)\s]+\)[ \t]*$/gm, (m) => { imgs.push(m.trim()); return `QQIMG${imgs.length}QQ`; });
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
    s = s.replace(/QQ\s*IMG\s*(\d+)\s*QQ/gi, (m, n) => p.imgs[+n - 1] || "");
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

  async function markdown(md, from, to, opts) {
    const src = String(md || "");
    if (!src.trim()) return "";
    const p = protect(src);
    const parts = chunks(p.text);
    const done = [];
    for (const part of parts) done.push(/\S/.test(part) && !/^QQIMG\d+QQ$/.test(part.trim()) ? await plain(part, from, to, opts) : part);
    return restore(done.join("\n\n"), p).trim();
  }
  async function title(t, from, to, opts) {
    const r = await plain(String(t || "").trim(), from, to, opts);
    return r.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  }

  return { plain, markdown, title, protect, restore, chunks, engines: { google, myMemory } };
});
