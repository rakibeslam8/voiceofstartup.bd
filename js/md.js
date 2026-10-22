/* Tiny, safe Markdown-lite renderer used by the site, the admin preview and the
   static page builder (Node). Everything is HTML-escaped first, then a small set of
   formatting is applied, so pasted content cannot inject scripts.

   Supported:  ## Heading   ### Sub-heading   **bold**   *italic*
               [text](https://link)   ![alt](https://image)   - list   1. list
               > quote   ---   blank line = new paragraph, single newline = line break */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.VOSB_MD = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const safeUrl = (u) => {
    u = String(u).trim().replace(/&amp;/g, "&");
    if (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(u)) return esc(u);
    return "#";
  };

  function inline(raw) {
    let s = esc(raw);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
      `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" decoding="async">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const u = safeUrl(url);
      const ext = /^https?:/i.test(u.replace(/&amp;/g, "&"));
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
    return s;
  }

  function render(md) {
    const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [];
    let list = null; // {type:'ul'|'ol', items:[]}

    const flushPara = () => {
      if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; }
    };
    const flushList = () => {
      if (list) { out.push(`<${list.type}>` + list.items.map((i) => `<li>${inline(i)}</li>`).join("") + `</${list.type}>`); list = null; }
    };

    for (const line of lines) {
      const t = line.trim();
      let m;
      if (!t) { flushPara(); flushList(); continue; }
      if ((m = t.match(/^(#{2,3})\s+(.+)$/))) {
        flushPara(); flushList();
        const lv = m[1].length;
        out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      } else if (/^---+$/.test(t)) {
        flushPara(); flushList(); out.push("<hr>");
      } else if ((m = t.match(/^>\s?(.*)$/))) {
        flushPara(); flushList();
        out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      } else if ((m = t.match(/^[-*•]\s+(.+)$/))) {
        flushPara();
        if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = t.match(/^\d+[.)]\s+(.+)$/))) {
        flushPara();
        if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
        list.items.push(m[1]);
      } else {
        flushList();
        para.push(t);
      }
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  /* Plain text (for excerpts, reading time, JSON-LD) */
  function toText(md) {
    return String(md || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^[-*•]\s+/gm, "")
      .replace(/^\d+[.)]\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^---+$/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function excerptFrom(md, n) {
    const t = toText(md);
    n = n || 180;
    if (t.length <= n + 40) return t;
    // end on a COMPLETE sentence (। . ! ?) so a card's description never stops mid-sentence
    const win = t.slice(0, n + 40), re = /[।.!?]["”’)]?(?=\s|$)/g;
    let m, end = -1;
    while ((m = re.exec(win))) { const e = m.index + m[0].length; if (e >= n * 0.5) end = e; }
    if (end > 0) return win.slice(0, end).trim();
    const cut = t.slice(0, n), sp = cut.lastIndexOf(" ");
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trim() + "…";
  }

  function readingMinutes(md) {
    const words = toText(md).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }

  return { render, toText, excerptFrom, readingMinutes, esc };
});
