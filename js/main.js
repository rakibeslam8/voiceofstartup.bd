/* Voice of Startup Bangladesh — shared behaviour (header, footer, i18n, rendering) */
(function () {
  const C = window.VOSB;
  const POSTS = window.VOSB_POSTS || [];
  const renderers = [];
  let lang = "bn";
  try { lang = localStorage.getItem("vosb-lang") || "bn"; } catch (e) {}

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pick = (o) => (o && typeof o === "object" ? o[lang] || o.bn : o);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (bn, en) => (lang === "bn" ? bn : en);

  const ICON = {
    facebook: '<svg viewBox="0 0 24 24"><path fill="#1877f2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24"><path fill="#0a66c2" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>',
  };
  const LABEL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" };

  const NAV = [
    { href: "index.html", bn: "হোম", en: "Home" },
    { href: "news.html", bn: "সংবাদ", en: "News" },
    { href: "news.html?cat=funding", bn: "ফান্ডিং", en: "Funding" },
    { href: "news.html?cat=founder", bn: "ফাউন্ডার স্টোরি", en: "Founder Stories" },
    { href: "about.html", bn: "আমাদের সম্পর্কে", en: "About" },
    { href: "careers.html", bn: "ক্যারিয়ার", en: "Careers" },
    { href: "contact.html", bn: "যোগাযোগ", en: "Contact" },
  ];

  const formatDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  };

  /* ---------- Header / footer ---------- */
  function renderChrome() {
    const page = location.pathname.split("/").pop() || "index.html";
    const top = $("#site-top");
    if (top) {
      top.innerHTML = `
      <div class="topbar"><div class="container">
        <span class="flagline"><span class="flagdot"></span>${T("সরকার অনুমোদিত সংস্থার তথ্যসূত্রে যাচাইকৃত আপডেট", "Updates verified from government-approved sources")}</span>
        <span class="date">${new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div></div>
      <header class="site-header"><div class="container">
        <a class="brand" href="index.html" aria-label="Voice of Startup Bangladesh"><img src="assets/logo.png" alt="Voice of Startup BD logo"></a>
        <nav class="nav" id="nav" aria-label="Main">
          ${NAV.map((n) => `<a href="${n.href}" class="${n.href === page ? "active" : ""}">${esc(pick(n))}</a>`).join("")}
        </nav>
        <div class="header-actions">
          <button class="lang-toggle" id="lang" aria-label="Switch language">${lang === "bn" ? "EN" : "বাংলা"}</button>
          <a class="btn btn-green" href="#follow">${T("ফলো করুন", "Follow Now")}</a>
          <button class="menu-btn" id="menu" aria-label="Menu">☰</button>
        </div>
      </div></header>`;
      $("#menu").onclick = () => $("#nav").classList.toggle("open");
      $("#lang").onclick = () => {
        lang = lang === "bn" ? "en" : "bn";
        try { localStorage.setItem("vosb-lang", lang); } catch (e) {}
        renderAll();
      };
    }
    const bottom = $("#site-bottom");
    if (bottom) {
      const social = Object.keys(C.social).map((k) => `<a href="${C.social[k]}" target="_blank" rel="noopener" aria-label="${LABEL[k]}">${ICON[k].replace(/fill="[^"]*"/g, "").replace(/<defs>.*<\/defs>/, "")}</a>`).join("");
      bottom.innerHTML = `
      <footer class="site-footer"><div class="container">
        <div class="footer-grid">
          <div>
            <span class="footer-logo"><img src="assets/logo.png" alt="Voice of Startup BD"></span>
            <p style="margin-top:16px;color:#d6d6d6;max-width:40ch">${T("স্টার্টআপ, ব্যবসা ও বিনিয়োগের সব আপডেট সবার আগে।", "Startup, business & investment updates — first.")}</p>
            <div class="footer-socials">${social}</div>
          </div>
          <div>
            <h4>${T("এক্সপ্লোর", "Explore")}</h4>
            <ul>${C.categories.map((c) => `<li><a href="news.html?cat=${c.id}">${c.icon} ${esc(pick(c))}</a></li>`).join("")}
            <li><a href="about.html">${T("আমাদের সম্পর্কে", "About us")}</a></li>
            <li><a href="careers.html">${T("ক্যারিয়ার", "Careers")}</a></li></ul>
          </div>
          <div>
            <h4>${T("যোগাযোগ", "Contact")}</h4>
            <ul>${C.emails.map((e) => `<li><a href="mailto:${e.address}">${e.address}</a></li>`).join("")}</ul>
          </div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} Voice of Startup Bangladesh. ${T("সর্বস্বত্ব সংরক্ষিত।", "All rights reserved.")}</span><span>${C.site.domain}</span></div>
      </div></footer>`;
    }
  }

  /* ---------- Static [data-bn]/[data-en] text ---------- */
  function applyStatic() {
    $$("[data-bn]").forEach((el) => {
      const v = lang === "bn" ? el.dataset.bn : el.dataset.en;
      if (v !== undefined) el.innerHTML = v;
    });
    $$("[data-ph-bn]").forEach((el) => (el.placeholder = lang === "bn" ? el.dataset.phBn : el.dataset.phEn));
    document.documentElement.lang = lang === "bn" ? "bn" : "en";
  }

  /* ---------- Reusable renderers ---------- */
  const catOf = (id) => C.categories.find((c) => c.id === id);

  function postCard(p) {
    const c = catOf(p.cat);
    return `<a class="post-card" href="article.html?id=${p.id}">
      <div class="post-thumb ${p.cat}" aria-hidden="true">${c.icon}</div>
      <div class="post-body">
        <div class="post-meta"><span class="badge">${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
        <h3>${esc(pick(p.title))}</h3>
        <p>${esc(pick(p.excerpt))}</p>
        <span class="post-date">${formatDate(p.date)}</span>
      </div></a>`;
  }

  function mount(id, fn) {
    const el = document.getElementById(id);
    if (el) renderers.push(() => (el.innerHTML = fn()));
  }

  mount("ticker", () => {
    const items = POSTS.map((p) => esc(pick(p.title)));
    items.unshift(T("সব আপডেট সবার আগে", "All updates, first"));
    const html = items.map((t) => `<span>${t}</span>`).join("");
    return `<div class="ticker-track">${html}${html}</div>`;
  });

  mount("categories", () =>
    C.categories.map((c) => {
      const desc = {
        funding: T("ফান্ডিং রাউন্ড, গ্রান্ট ও স্টার্টআপ প্রতিযোগিতার সর্বশেষ আপডেট।", "Latest funding rounds, grants and startup competitions."),
        founder: T("সফল উদ্যোক্তাদের অনুপ্রেরণামূলক ফাউন্ডার স্টোরি।", "Inspiring stories from successful founders."),
        business: T("ব্যবসা, বিনিয়োগ ও নীতিমালার গুরুত্বপূর্ণ খবর।", "Key news on business, investment and policy."),
        opportunity: T("নতুন উদ্যোক্তাদের জন্য কাজের তথ্য ও সুযোগ।", "Practical info and opportunities for new entrepreneurs."),
      }[c.id];
      return `<a class="cat-card" href="news.html?cat=${c.id}"><div class="ic">${c.icon}</div><h3>${esc(pick(c))}</h3><p>${desc}</p></a>`;
    }).join(""));

  mount("latest", () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(postCard).join(""));

  mount("source-chips", () =>
    C.sources.map((s) => `<div class="chip"><b>${esc(s.short)}</b><small>${esc(pick(s))}</small></div>`).join(""));

  mount("hero-sources", () => C.sources.map((s) => `<span>${esc(s.short)}</span>`).join(""));

  mount("socials", () =>
    Object.keys(C.social).map((k) => `<a class="social-btn" href="${C.social[k]}" target="_blank" rel="noopener">${ICON[k]}${LABEL[k]}</a>`).join(""));

  mount("mail-cards", () =>
    C.emails.map((e) => `<a class="mail-card" href="mailto:${e.address}"><h3>✉️ ${esc(pick(e))}</h3><span class="addr">${e.address}</span></a>`).join(""));

  /* News listing with filters */
  function renderNews() {
    const list = $("#news-list");
    if (!list) return;
    const params = new URLSearchParams(location.search);
    const active = params.get("cat") || "all";
    const filters = [{ id: "all", bn: "সব", en: "All" }, ...C.categories];
    $("#filters").innerHTML = filters.map((f) => `<button class="filter ${f.id === active ? "active" : ""}" data-cat="${f.id}">${f.icon || ""} ${esc(pick(f))}</button>`).join("");
    $$(".filter").forEach((b) => (b.onclick = () => {
      const u = new URL(location.href);
      b.dataset.cat === "all" ? u.searchParams.delete("cat") : u.searchParams.set("cat", b.dataset.cat);
      history.replaceState(null, "", u);
      renderNews();
    }));
    const items = POSTS.filter((p) => active === "all" || p.cat === active).sort((a, b) => b.date.localeCompare(a.date));
    list.innerHTML = items.length ? items.map(postCard).join("") : `<p class="muted">${T("এই ক্যাটাগরিতে এখনো কোনো পোস্ট নেই।", "No posts in this category yet.")}</p>`;
  }
  renderers.push(renderNews);

  /* Single article */
  function renderArticle() {
    const box = $("#article");
    if (!box) return;
    const id = new URLSearchParams(location.search).get("id");
    const p = POSTS.find((x) => x.id === id);
    if (!p) { box.innerHTML = `<h1>${T("পোস্ট পাওয়া যায়নি", "Post not found")}</h1><p><a class="btn btn-orange" href="news.html">${T("সব সংবাদ", "All news")}</a></p>`; return; }
    const c = catOf(p.cat);
    document.title = pick(p.title) + " — Voice of Startup Bangladesh";
    box.innerHTML = `
      <div class="post-meta"><span class="badge">${c.icon} ${esc(pick(c))}</span><span class="badge verified">✔ ${T("যাচাইকৃত সূত্র", "Verified source")}: ${esc(p.source)}</span></div>
      <h1>${esc(pick(p.title))}</h1>
      <span class="muted">${formatDate(p.date)}</span>
      ${(p.body[lang] || p.body.bn).map((t) => `<p>${esc(t)}</p>`).join("")}
      <div class="src">${T("তথ্যসূত্র", "Source")}: ${esc(p.source)}</div>
      <p style="margin-top:28px"><a class="btn btn-outline" href="news.html">← ${T("সব সংবাদ", "All news")}</a></p>`;
  }
  renderers.push(renderArticle);

  /* Forms (mailto fallback — swap for Formspree/Netlify Forms later) */
  function wireForms() {
    const nl = $("#newsletter");
    if (nl) nl.onsubmit = (e) => {
      e.preventDefault();
      const v = $("input", nl).value;
      location.href = `mailto:hello@voiceofstartup.bd?subject=${encodeURIComponent("Newsletter signup")}&body=${encodeURIComponent("Please add me to the newsletter: " + v)}`;
    };
    const cf = $("#contact-form");
    if (cf) cf.onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(cf);
      const to = f.get("to");
      const body = `${f.get("message")}\n\n— ${f.get("name")} (${f.get("email")})`;
      location.href = `mailto:${to}?subject=${encodeURIComponent(f.get("subject") || "Message from website")}&body=${encodeURIComponent(body)}`;
    };
  }

  function renderAll() {
    renderChrome();
    renderers.forEach((r) => r());
    applyStatic();
    wireForms();
  }

  document.addEventListener("DOMContentLoaded", renderAll);
})();
