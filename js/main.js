/* Voice of Startup Bangladesh — shared behaviour (header, footer, i18n, rendering) */
(function () {
  const C = window.VOSB;
  const API = window.VOSB_API;
  const MD = window.VOSB_MD;
  let POSTS = [];                 // live posts (list view, no body)
  let postsState = API && API.configured ? "loading" : "ready"; // loading | ready | error
  const renderers = [];
  let lang = "bn";
  try { lang = localStorage.getItem("vosb-lang") || "bn"; } catch (e) {}
  // /en/read/<slug> is the English edition of an article: always show English there (Google indexes it as English)
  const EN_EDITION = /^\/en\/read\/[a-z0-9-]+\/?$/.test(location.pathname);
  if (EN_EDITION) lang = "en";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pick = (o) => (o && typeof o === "object" ? o[lang] || o.bn : o);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (bn, en) => (lang === "bn" ? bn : en);

  const ICON = {
    facebook: '<svg viewBox="0 0 24 24"><path fill="#1877f2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24"><path fill="#0a66c2" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path fill="#111111" d="M18.2 2.2h3.3l-7.2 8.300 8.500 11.300h-6.700l-5.200-6.800-6 6.800H1.600l7.700-8.800L1.200 2.200h6.800l4.700 6.200 5.500-6.200zm-1.200 17.600h1.800L7 4.100H5.100l11.900 15.700z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>',
  };
  const LABEL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", x: "X (Twitter)" };

  const NAV = [
    { href: "/", bn: "হোম", en: "Home" },
    { href: "/news", bn: "সংবাদ", en: "News" },
    { href: "/funding", bn: "ফান্ডিং", en: "Funding" },
    { href: "/founder-stories", bn: "ফাউন্ডার স্টোরি", en: "Founder Stories" },
    { href: "/contact", bn: "যোগাযোগ", en: "Contact" },
  ];

  const LEGAL = [
    { href: "/privacy-policy",   bn: "গোপনীয়তা নীতি", en: "Privacy Policy" },
    { href: "/terms-of-service", bn: "ব্যবহারের শর্তাবলি", en: "Terms of Service" },
    { href: "/cookie-policy",    bn: "কুকি নীতি", en: "Cookie Policy" },
    { href: "/refund-policy",    bn: "রিফান্ড নীতি", en: "Refund Policy" },
    { href: "/usage-policy",     bn: "ব্যবহার নীতি", en: "Usage Policy" },
    { href: "/editorial-policy", bn: "সম্পাদকীয় নীতি", en: "Editorial Policy" },
  ];

  // Show clean URLs (/about instead of /about.html) if someone opens an old .html link
  try {
    if (/\.html$/.test(location.pathname)) {
      const clean = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
      history.replaceState(null, "", clean + location.search + location.hash);
    }
  } catch (e) {}

  const toDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00+06:00") : new Date(iso));
  const bnDigits = (s) => (lang === "bn" ? String(s).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : s);
  const formatDate = (iso) => bnDigits(
    toDate(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", year: "numeric", month: "long", day: "numeric" }));
  const formatDateTime = (iso) => bnDigits(
    toDate(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }));

  /* ---------- Header / footer ---------- */
  // "Topics" drop-down: every topic page is linked from the main menu (plain <details>, works without JS)
  function topicsMenu(page) {
    const on = C.categories.some((c) => "/" + c.slug === page);
    return `<details class="nav-dd${on ? " active" : ""}"><summary>${T("বিষয়", "Topics")}</summary><div class="dd-menu">${C.categories.map((c) => `<a href="/${c.slug}" class="${"/" + c.slug === page ? "active" : ""}">${esc(pick(c))}</a>`).join("")}</div></details>`;
  }
  function renderChrome() {
    const page = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
    const top = $("#site-top");
    if (top) {
      top.innerHTML = `
      <div class="topbar"><div class="container">
        <span class="date">${bnDigits(new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</span>
        <a class="tb-brand" href="/" aria-label="Voice of Startup Bangladesh">Voice of Startup Bangladesh</a>
        <span class="tb-soc">${Object.keys(C.social).map((k) => `<a href="${C.social[k]}" target="_blank" rel="noopener" aria-label="${LABEL[k]}">${ICON[k].replace(/fill="[^"]*"/g, "").replace(/<defs>.*<\/defs>/, "")}</a>`).join("")}</span>
      </div></div>
      <header class="site-header"><div class="container">
        <a class="brand" href="/" aria-label="Voice of Startup Bangladesh"><img src="/assets/logo.png" alt="Voice of Startup BD logo"></a>
        <nav class="nav" id="nav" aria-label="Main">
          ${NAV.map((n, i) => `<a href="${n.href}" class="${n.href === page ? "active" : ""}">${esc(pick(n))}</a>${i === 1 ? topicsMenu(page) : ""}`).join("")}
          <div class="nav-tools">
            <button class="nt-btn theme-toggle" data-act="theme" type="button"><svg class="ti-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg><svg class="ti-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg><span>${T("ডার্ক / লাইট", "Dark / Light")}</span></button>
            <button class="nt-btn" data-act="lang" type="button"><b>${lang === "bn" ? "EN" : "বা"}</b><span>${lang === "bn" ? "English" : "বাংলা"}</span></button>
          </div>
        </nav>
        <div class="header-actions">
          <a class="hdr-search" href="/news?s=1" aria-label="${T("খবর খুঁজুন", "Search stories")}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/></svg></a>
          <button class="theme-toggle" data-act="theme" type="button" aria-label="${T("ডার্ক / লাইট মোড", "Dark / light mode")}" title="${T("ডার্ক / লাইট মোড", "Dark / light mode")}"><svg class="ti-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg><svg class="ti-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg></button>
          <button class="lang-toggle" data-act="lang" aria-label="Switch language">${lang === "bn" ? "EN" : "বাংলা"}</button>
          <a class="btn btn-green" href="#follow">${T("ফলো করুন", "Follow Now")}</a>
          <button class="menu-btn" id="menu" aria-label="Menu">☰</button>
        </div>
      </div></header>
      <div class="container"><div class="ad-slot ad-header" data-slot="header" data-i="0"></div></div>`;
      $("#menu").onclick = () => $("#nav").classList.toggle("open");
      document.addEventListener("click", (e) => { document.querySelectorAll(".nav-dd[open]").forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); }); });
      const toggleTheme = () => {
        const dark = document.documentElement.dataset.theme !== "dark";
        if (dark) document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
        try { localStorage.setItem("vosb-theme", dark ? "dark" : "light"); } catch (e) {}
        const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#0e0f11" : "#ff7522");
      };
      document.querySelectorAll('[data-act="theme"]').forEach((b) => (b.onclick = toggleTheme));
      const toggleLang = () => {
        lang = lang === "bn" ? "en" : "bn";
        try { localStorage.setItem("vosb-lang", lang); } catch (e) {}
        if (EN_EDITION && lang === "bn") { location.href = location.pathname.replace(/^\/en/, ""); return; }
        renderAll();
      };
      document.querySelectorAll('[data-act="lang"]').forEach((b) => (b.onclick = toggleLang));
    }
    const bottom = $("#site-bottom");
    if (bottom) {
      const social = Object.keys(C.social).map((k) => `<a href="${C.social[k]}" target="_blank" rel="noopener" aria-label="${LABEL[k]}">${ICON[k].replace(/fill="[^"]*"/g, "").replace(/<defs>.*<\/defs>/, "")}</a>`).join("");
      bottom.innerHTML = `
      <div class="container"><div class="ad-slot ad-footer" data-slot="footer" data-i="0"></div></div>
      <footer class="site-footer"><div class="container">
        <div class="footer-grid">
          <div>
            <span class="footer-logo"><img src="/assets/logo.png" alt="Voice of Startup BD"></span>
            <p style="margin-top:16px;color:#d6d6d6;max-width:40ch">${T("স্টার্টআপ, ব্যবসা ও বিনিয়োগের সব আপডেট সবার আগে।", "Startup, business & investment updates — first.")}</p>
            <div class="footer-socials">${social}</div>
          </div>
          <div>
            <h4>${T("এক্সপ্লোর", "Explore")}</h4>
            <ul>${C.categories.map((c) => `<li><a href="/${c.slug}">${ci(c)} ${esc(pick(c))}</a></li>`).join("")}
            <li><a href="/about">${T("আমাদের সম্পর্কে", "About us")}</a></li>
            <li><a href="/careers">${T("ক্যারিয়ার", "Careers")}</a></li></ul>
          </div>
          <div>
            <h4>${T("যোগাযোগ", "Contact")}</h4>
            <div class="fc-list">${C.emails.map((e) => `<a class="fc" href="mailto:${e.address}"><span class="fc-ic" aria-hidden="true">${e.icon}</span><span class="fc-tx"><small>${esc(pick(e))}</small><b>${e.address}</b></span></a>`).join("")}</div>
          </div>
        </div>
        <nav class="legal-links" aria-label="Legal">${LEGAL.map((l) => `<a href="${l.href}">${esc(pick(l))}</a>`).join("")}</nav>
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
  /* One consistent line-icon set for topics (replaces emoji, which look different on every phone) */
  const CAT_SVG = {
    funding: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
    founder: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.600.500 1 1.200 1 2.100h5c0-.900.400-1.600 1-2.100A6 6 0 0 0 12 3z",
    business: "M3 17l6-6 4 4 8-8M15 7h6v6",
    opportunity: "M14.500 4.500c3-1.500 5.500-1.500 5.500-1.500s0 2.500-1.500 5.500L13 14l-3-3 4.500-6.500zM9 11l-3 .5L4 14l3.500.5M13 14l-.5 3.500L10 20l-.5-3.500M4.500 19.500c.5-1.500 1.500-2.500 3-3",
    tech: "M7 7h10v10H7zM10 10h4v4h-4zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3",
    market: "M4 20V11M10 20V4M16 20v-6M3 20h18",
    events: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
    guide: "M12 6c-2-1.500-5-2-8-2v13c3 0 6 .5 8 2 2-1.500 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v13",
    international: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.500 2.500 3.500 5.500 3.500 9s-1 6.500-3.500 9c-2.500-2.500-3.500-5.500-3.500-9s1-6.500 3.500-9z",
    interview: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6",
  };
  const ci = (c) => (c && CAT_SVG[c.id] ? `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${CAT_SVG[c.id]}"/></svg>` : (c && c.icon) || "");


  const readUrl = (p) => `/read/${p.slug}`;
  const thumb = (p, c) => p.image
    ? `<div class="post-thumb has-img"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" loading="lazy" decoding="async" width="640" height="360"></div>`
    : `<div class="post-thumb ${esc(p.cat)}" aria-hidden="true">${ci(c)}</div>`;

  function postCard(p) {
    const c = catOf(p.cat) || C.categories[0];
    return `<a class="post-card" href="${readUrl(p)}">
      ${thumb(p, c)}
      <div class="post-body">
        <div class="post-meta"><span class="badge">${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
        <h3>${esc(pick(p.title))}</h3>
        <p>${esc(pick(p.excerpt))}</p>
        <div class="post-foot"><span class="post-date">${formatDate(p.date)}</span><span class="post-go">${T("পড়ুন", "Read")} <i aria-hidden="true">→</i></span></div>
      </div></a>`;
  }

  function featuredCard(p, label) {
    const c = catOf(p.cat) || C.categories[0];
    return `<a class="featured-card" href="${readUrl(p)}">
      ${p.image ? `<div class="fc-img"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" decoding="async" width="800" height="450"></div>` : `<div class="fc-img ${esc(p.cat)}" aria-hidden="true"><span>${c.icon}</span></div>`}
      <div class="fc-body">
        <div class="post-meta"><span class="badge top">★ ${label || T("প্রধান খবর", "Top story")}</span><span class="badge">${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
        <h3>${esc(pick(p.title))}</h3>
        <p>${esc(pick(p.excerpt))}</p>
        <div class="post-foot"><span class="post-date">${formatDate(p.date)}</span><span class="post-go">${T("পুরো খবর পড়ুন", "Read the full story")} <i aria-hidden="true">→</i></span></div>
      </div></a>`;
  }

  const skeleton = (n) => Array.from({ length: n }, () => `<div class="post-card skeleton" aria-hidden="true"><div class="post-thumb"></div><div class="post-body"><span class="sk sk-s"></span><span class="sk"></span><span class="sk sk-m"></span></div></div>`).join("");

  const errorState = () => `<div class="empty-state" role="alert"><div class="es-ic" aria-hidden="true">⚠️</div>
      <h3>${T("আপডেট লোড করা যায়নি", "Couldn't load updates")}</h3>
      <p>${T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.")}</p>
      <p style="margin-top:16px"><button class="btn btn-orange" data-retry>${T("আবার চেষ্টা করুন", "Try again")}</button></p></div>`;

  function postsBlock(items, grid) {
    if (postsState === "loading") return skeleton(grid ? 3 : 3);
    if (postsState === "error") return errorState();
    return items.length ? items.map(postCard).join("") : emptyState();
  }

  function mount(id, fn) {
    const el = document.getElementById(id);
    if (el) renderers.push(() => (el.innerHTML = fn()));
  }

  mount("ticker", () => {
    const items = POSTS.length
      ? POSTS.slice(0, 12).map((p) => `<a href="${readUrl(p)}">${esc(pick(p.title))}</a>`)
      : C.categories.map((c) => `<span>${esc(pick(c))}</span>`);
    const html = items.map((t) => `<span class="tk">${t}</span>`).join("");
    return `<div class="container ticker-in"><span class="ticker-label"><i aria-hidden="true"></i>${T("সর্বশেষ", "Latest")}</span><div class="ticker-wrap"><div class="ticker-track">${html}${html}</div></div></div>`;
  });

  const catCards = () =>
    C.categories.map((c) => {
      const desc = {
        funding: T("ফান্ডিং রাউন্ড, গ্রান্ট ও স্টার্টআপ প্রতিযোগিতার সর্বশেষ আপডেট।", "Latest funding rounds, grants and startup competitions."),
        founder: T("সফল উদ্যোক্তাদের অনুপ্রেরণামূলক ফাউন্ডার স্টোরি।", "Inspiring stories from successful founders."),
        business: T("ব্যবসা, বিনিয়োগ ও নীতিমালার গুরুত্বপূর্ণ খবর।", "Key news on business, investment and policy."),
        opportunity: T("নতুন উদ্যোক্তাদের জন্য কাজের তথ্য ও সুযোগ।", "Practical info and opportunities for new entrepreneurs."),
        tech: T("ফিনটেক, এডটেক, SaaS ও এআই স্টার্টআপের খবর।", "Fintech, edtech, SaaS and AI startup news."),
        market: T("বাজারের ট্রেন্ড, রিপোর্ট ও তথ্যভিত্তিক বিশ্লেষণ।", "Market trends, reports and data-backed analysis."),
        events: T("স্টার্টআপ সামিট, বুটক্যাম্প ও ওয়ার্কশপের আপডেট।", "Startup summits, bootcamps and workshop updates."),
        guide: T("ব্যবসা শুরু ও বড় করার ধাপে ধাপে গাইড।", "Step-by-step guides to start and grow a business."),
        international: T("বিশ্ব স্টার্টআপ জগতের খবর ও শেখার বিষয়।", "Global startup news and lessons to learn."),
        interview: T("ফাউন্ডার ও বিশেষজ্ঞদের সাক্ষাৎকার ও মতামত।", "Interviews and opinion from founders and experts."),
      }[c.id];
      return `<a class="cat-card" href="/${c.slug}"><div class="ic">${ci(c)}</div><h3>${esc(pick(c))}</h3><p>${desc}</p></a>`;
    }).join("");
  mount("categories", catCards);
  mount("about-cats", catCards);   // About page: "Topics we cover"

  const emptyState = () => `<div class="empty-state">
      <div class="es-ic" aria-hidden="true">🔔</div>
      <h3>${T("প্রথম আপডেট শিগগিরই আসছে", "First updates are coming soon")}</h3>
      <p>${T("যাচাইকৃত ফান্ডিং, নীতিমালা ও সুযোগের খবর এখানে প্রকাশিত হবে। নোটিফিকেশন পেতে আমাদের পেজগুলো ফলো করুন।", "Verified funding, policy and opportunity news will appear here. Follow our pages to get notified.")}</p>
      <div class="socials es-socials">${Object.keys(C.social).map((k) => `<a class="social-btn" href="${C.social[k]}" target="_blank" rel="noopener">${ICON[k]}${LABEL[k]}</a>`).join("")}</div>
    </div>`;

  const topStory = () => (postsState === "ready" ? POSTS.find((p) => p.featured) || POSTS[0] : null) || null;
  mount("featured", () => { const f = topStory(); return f ? featuredCard(f) : ""; });
  /* ---------- home: news-portal layout ---------- */
  const homeSets = () => {
    const f = topStory();
    const rest = POSTS.filter((p) => !f || p.slug !== f.slug);
    const hero = (f ? [f] : []).concat(rest.slice(0, 4));
    const feed = rest.slice(4, 12);
    return { hero, feed, seen: new Set(hero.concat(feed).map((p) => p.slug)) };
  };
  const coverImg = (p, eager) => `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  const coverBox = (p, cls) => {
    const c = catOf(p.cat) || C.categories[0];
    return `<div class="${cls} ${p.image ? "has-img" : esc(p.cat)}" aria-hidden="${p.image ? "false" : "true"}">${p.image ? "" : `<span class="tile-ic">${ci(c)}</span>`}</div>`;
  };
  /* portal card: the photo on top, the text always BELOW it (never on top of the photo) */
  function tile(p, lead) {
    const c = catOf(p.cat) || C.categories[0];
    const img = p.image ? `<div class="pt-img has-img">${coverImg(p, lead)}</div>` : coverBox(p, "pt-img");
    return `<a class="pt${lead ? " pt-lead" : ""}" href="${readUrl(p)}">${img}
      <div class="pt-body"><span class="pt-cat">${esc(pick(c))}</span><h3>${esc(pick(p.title))}</h3>${lead ? `<p>${esc(pick(p.excerpt))}</p>` : ""}<span class="pt-meta">${formatDate(p.date)}</span></div></a>`;
  }
  function feedItem(p) {
    const c = catOf(p.cat) || C.categories[0];
    const img = p.image ? `<div class="fx-img has-img">${coverImg(p)}</div>` : coverBox(p, "fx-img");
    return `<a class="fx" href="${readUrl(p)}">${img}<div class="fx-body"><span class="fx-cat">${esc(pick(c))}</span><h3>${esc(pick(p.title))}</h3><p>${esc(pick(p.excerpt))}</p><span class="fx-date">${formatDate(p.date)}</span></div></a>`;
  }
  function smallCard(p) {
    const c = catOf(p.cat) || C.categories[0];
    const img = p.image ? `<div class="sc-img has-img">${coverImg(p)}</div>` : coverBox(p, "sc-img");
    return `<a class="sc" href="${readUrl(p)}">${img}<div class="sc-body"><h3>${esc(pick(p.title))}</h3><span class="sc-date">${formatDate(p.date)}</span></div></a>`;
  }
  function newsCard(p) {
    const c = catOf(p.cat) || C.categories[0];
    const img = p.image ? `<div class="nc-img has-img">${coverImg(p)}</div>` : coverBox(p, "nc-img");
    return `<a class="nc" href="${readUrl(p)}">${img}<div class="nc-body"><span class="nc-cat">${esc(pick(c))}</span><h3>${esc(pick(p.title))}</h3><p>${esc(pick(p.excerpt))}</p><span class="nc-date">${formatDate(p.date)}</span></div></a>`;
  }
  const newsLead = (p) => tile(p, true).replace('class="pt pt-lead"', 'class="pt pt-lead news-lead"');
  const skTile = (n) => Array.from({ length: n }, (_, i) => `<div class="pt pt-sk${i ? "" : " pt-lead"}" aria-hidden="true"><div class="pt-img"></div><div class="pt-body"><i></i><i></i></div></div>`).join("");


  mount("home-hero", () => {
    if (postsState === "loading") return skTile(5);
    if (postsState === "error") return errorState();
    const { hero } = homeSets();
    if (!hero.length) return emptyState();
    return hero.map((p, i) => tile(p, i === 0)).join("");
  });

  mount("home-latest", () => {
    if (postsState === "loading") return skeleton(3);
    if (postsState !== "ready") return "";
    const { feed } = homeSets();
    return feed.map(feedItem).join("");
  });

  mount("home-side", () => {
    if (postsState !== "ready") return "";
    const { seen, hero } = homeSets();
    const num = (n) => (lang === "bn" ? Number(n).toLocaleString("bn-BD") : String(n));
    let top = POSTS.filter((p) => (p.views || 0) > 0).sort((a, b) => b.views - a.views).slice(0, 5), title = T("সর্বাধিক পঠিত", "Most read");
    if (top.length < 3) { top = POSTS.filter((p) => !seen.has(p.slug)).slice(0, 5); title = T("আরও খবর", "More stories"); }
    const mr = top.length ? `<section class="side-card"><h2 class="side-h"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3-1 4.500-1 7 0 1.500 1 2.500 2 2.500s2-1 2-2.500c2 1.500 3 3.500 3 6a6 6 0 0 1-12 0c0-3 2-4.500 3.500-7C10 8 11.500 6 12 3z"/></svg>${title}</h2>
      <ol class="mr2">${top.map((p, i) => `<li><a href="${readUrl(p)}"><span class="mr2-n">${num(i + 1)}</span><span class="mr2-t">${esc(pick(p.title))}<small>${esc(pick(catOf(p.cat) || C.categories[0]))}</small></span></a></li>`).join("")}</ol></section>` : "";
    const src = `<section class="side-card side-src"><h2 class="side-h"><span class="side-ok" aria-hidden="true">✔</span>${T("যাচাইকৃত সূত্র", "Verified sources")}</h2>
      <p>${T("সরকার অনুমোদিত সংস্থার সূত্রে যাচাই করা তথ্য।", "Information checked against government-approved bodies.")}</p>
      <div class="ts-list">${C.sources.map((s) => `<span class="ts-chip" title="${esc(pick(s))}">${esc(s.short)}</span>`).join("")}</div></section>`;
    const fol = `<section class="side-card side-follow"><h2 class="side-h">${T("আমাদের ফলো করুন", "Follow us")}</h2><p>${T("নতুন ফান্ডিং ও সুযোগের খবর সবার আগে পান।", "Get new funding and opportunity news first.")}</p>
      <div class="sd-soc">${Object.keys(C.social).map((k) => `<a href="${C.social[k]}" target="_blank" rel="noopener" aria-label="${LABEL[k]}">${ICON[k]}</a>`).join("")}</div></section>`;
    return mr + src + fol;
  });

  mount("home-cats", () => {
    if (postsState !== "ready") return "";
    const { seen } = homeSets();
    const secs = C.categories.map((c) => {
      const all = POSTS.filter((p) => p.cat === c.id);
      if (all.length < 4) return null;
      const fresh = all.filter((p) => !seen.has(p.slug));
      if (fresh.length < 2) return null;                       // skip a topic whose stories are all shown above
      const n = all.length >= 8 ? 8 : 4;                         // two rows of four cards (one row when a topic has fewer stories)
      const arr = fresh.concat(all.filter((p) => seen.has(p.slug))).slice(0, n).sort((a, b) => toDate(b.date) - toDate(a.date));
      return { c, arr };
    }).filter(Boolean).slice(0, 6);
    return secs.map((x, i) => `<section class="cs cs-${i % 3}" aria-label="${esc(pick(x.c))}"><div class="sec-head"><h2>${esc(pick(x.c))}</h2><a href="/${x.c.slug}">${T("সব দেখুন", "See all")} →</a></div>
      <div class="cs-grid cs-${x.arr.length}">${x.arr.map((p) => tile(p, false).replace('class="pt"', 'class="pt pt-card"')).join("")}</div></section>`).join("");
  });

  mount("source-chips", () =>
    C.sources.map((s) => `<span class="ts-chip" title="${esc(pick(s))}">${esc(s.short)}</span>`).join(""));

  mount("hero-sources", () => C.sources.map((s) => `<span>${esc(s.short)}</span>`).join(""));

  mount("socials", () =>
    Object.keys(C.social).map((k) => `<a class="social-btn" href="${C.social[k]}" target="_blank" rel="noopener">${ICON[k]}${LABEL[k]}</a>`).join(""));

  mount("mail-cards", () =>
    C.emails.map((e) => `<a class="mail-card" href="mailto:${e.address}">
      <span class="mc-ic" aria-hidden="true">${e.icon}</span>
      <h3>${esc(pick(e))}</h3>
      <p>${esc(lang === "bn" ? e.useBn : e.useEn)}</p>
      <span class="addr">${e.address}</span>
      <span class="mc-go">${T("ইমেইল করুন", "Send email")} →</span>
    </a>`).join(""));

  /* News listing with filters */
  let shown = 12;
  function renderNews() {
    const list = $("#news-list");
    if (!list) return;
    const fixed = document.body.dataset.cat;                      // category landing pages
    const legacy = new URLSearchParams(location.search).get("cat"); // old /news?cat=x links
    const active = fixed || legacy || "all";
    const filters = [{ id: "all", slug: "news", bn: "সব", en: "All" }, ...C.categories];
    const fbox = $("#filters");
    if (fbox) {
      fbox.innerHTML = filters.map((f) => `<a class="filter ${f.id === active ? "active" : ""}" href="/${f.slug}"${f.id === active ? ' aria-current="page"' : ""}>${(f.icon) ? `<span class="fi" aria-hidden="true">${ci(f)}</span>` : ""}${esc(pick(f))}</a>`).join("");
      const wrap = fbox.parentElement;
      const sync = () => {
        const max = fbox.scrollWidth - fbox.clientWidth;
        wrap.classList.toggle("fade-l", fbox.scrollLeft > 6);
        wrap.classList.toggle("fade-r", max > 6 && fbox.scrollLeft < max - 6);
      };
      fbox.onscroll = sync;
      const on = fbox.querySelector(".filter.active");
      if (on && fbox.scrollWidth > fbox.clientWidth) fbox.scrollLeft = Math.max(0, on.offsetLeft - (fbox.clientWidth - on.offsetWidth) / 2);
      sync();
      if (window.ResizeObserver && !fbox._ro) { fbox._ro = new ResizeObserver(sync); fbox._ro.observe(fbox); }
      // desktop helpers (added once): arrow buttons, click-and-drag, mouse wheel
      if (!wrap.querySelector(".f-arrow")) {
        const step = (dir) => fbox.scrollBy({ left: dir * Math.max(240, fbox.clientWidth * 0.7), behavior: "smooth" });
        wrap.insertAdjacentHTML("afterbegin", `<button type="button" class="f-arrow f-prev" aria-label="${T("আগের বিষয়", "Previous topics")}">‹</button>`);
        wrap.insertAdjacentHTML("beforeend", `<button type="button" class="f-arrow f-next" aria-label="${T("পরের বিষয়", "Next topics")}">›</button>`);
        wrap.querySelector(".f-prev").onclick = () => step(-1);
        wrap.querySelector(".f-next").onclick = () => step(1);
        let down = false, moved = false, sx = 0, sl = 0;
        fbox.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = fbox.scrollLeft; });
        window.addEventListener("pointermove", (e) => {
          if (!down) return;
          const dx = e.clientX - sx;
          if (!moved && Math.abs(dx) > 5) { moved = true; fbox.classList.add("dragging"); }
          if (moved) fbox.scrollLeft = sl - dx;
        });
        window.addEventListener("pointerup", () => { if (!down) return; down = false; if (moved) setTimeout(() => fbox.classList.remove("dragging"), 0); });
        fbox.addEventListener("wheel", (e) => {
          if (fbox.scrollWidth <= fbox.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          const max = fbox.scrollWidth - fbox.clientWidth;
          if ((e.deltaY < 0 && fbox.scrollLeft <= 0) || (e.deltaY > 0 && fbox.scrollLeft >= max - 1)) return;   // at the ends let the page scroll
          e.preventDefault(); fbox.scrollLeft += e.deltaY;
        }, { passive: false });
      }
    }
    /* ---- reading aids: search, sort, month archive, most-read, pagination ---- */
    if (!ST.init) {
      const qs = new URLSearchParams(location.search);
      ST.q = (qs.get("q") || "").slice(0, 80);
      ST.sort = qs.get("sort") === "top" ? "top" : "new";
      ST.month = /^\d{4}-\d{2}$/.test(qs.get("month") || "") ? qs.get("month") : "";
      ST.page = Math.max(1, parseInt(qs.get("page") || "1", 10) || 1);
      ST.init = true;
    }
    const ready = postsState === "ready";
    const inCat = POSTS.filter((p) => active === "all" || p.cat === active);
    const norm = (t) => String(t || "").toLowerCase();
    const hay = (p) => norm([p.title.bn, p.title.en, p.excerpt.bn, p.excerpt.en, (catOf(p.cat) || {}).bn, (catOf(p.cat) || {}).en, p.source].join(" "));
    const words = norm(ST.q).split(/\s+/).filter(Boolean);
    let items = inCat;
    if (words.length) {
      items = inCat.filter((p) => { const h = hay(p); return words.every((w) => h.includes(w)); });
      const seen = new Set(items.map((p) => p.slug));
      ST.server.filter((p) => (active === "all" || p.cat === active) && !seen.has(p.slug)).forEach((p) => items.push(p));
    }
    const mKey = (iso) => toDate(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7);
    const mLabel = (k) => bnDigits(new Date(k + "-15T06:00:00Z").toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", month: "long", year: "numeric" }));
    const months = {};
    inCat.forEach((p) => { const k = mKey(p.date); months[k] = (months[k] || 0) + 1; });
    if (ST.month && !months[ST.month]) ST.month = "";
    if (ST.month) items = items.filter((p) => mKey(p.date) === ST.month);
    if (ST.sort === "top") items = items.slice().sort((a, b) => (b.views || 0) - (a.views || 0) || toDate(b.date) - toDate(a.date));
    const num = (n) => (lang === "bn" ? Number(n).toLocaleString("bn-BD") : String(n));
    const PER = 12;
    const pages = Math.max(1, Math.ceil(items.length / PER));
    ST.page = Math.min(Math.max(1, ST.page), pages);
    const pageItems = items.slice(0, ST.page * PER);                 // "Read more" adds the next batch under the ones already shown
    const filtered = !!(ST.q || ST.month);

    mountListTools(list, num);
    // toolbar: sort + month archive + search note
    const tools = $("#list-tools");
    if (tools) {
      tools.hidden = !(ready && POSTS.length);
      tools.innerHTML = `<div class="seg" role="group" aria-label="${T("সাজান", "Sort")}">
          <button type="button" data-sort="new" class="${ST.sort === "new" ? "on" : ""}" aria-pressed="${ST.sort === "new"}">${T("সর্বশেষ", "Latest")}</button>
          <button type="button" data-sort="top" class="${ST.sort === "top" ? "on" : ""}" aria-pressed="${ST.sort === "top"}">${T("সর্বাধিক পঠিত", "Most read")}</button></div>
        <label class="month-sel"><span>${T("সংরক্ষাগার", "Archive")}</span><select id="month-sel" aria-label="${T("মাস অনুযায়ী দেখুন", "Browse by month")}">
          <option value="">${T("সব সময়", "All time")}</option>${Object.keys(months).sort().reverse().map((k) => `<option value="${k}"${k === ST.month ? " selected" : ""}>${esc(mLabel(k))}</option>`).join("")}</select></label>
        ${filtered ? `<p class="search-note" role="status"><span class="sn-t">${ST.q ? (lang === "bn" ? `“<b>${esc(ST.q)}</b>” এর ফলাফল` : `Results for “<b>${esc(ST.q)}</b>”`) : T("মাস অনুযায়ী খবর", "Stories from")}${ST.month ? ` · ${esc(mLabel(ST.month))}` : ""}</span> <button type="button" class="clear-f" data-clear>${T("মুছুন", "Clear")} ✕</button></p>` : ""}`;
    }
    // most-read strip (only when it adds something)
    const mr = $("#most-read");
    let mrInGrid = false, mrGridHtml = "";
    if (mr) {
      const top = inCat.filter((p) => (p.views || 0) > 0).sort((a, b) => b.views - a.views).slice(0, 5);
      const show = ready && top.length >= 3 && !filtered && ST.sort === "new" && ST.page === 1;
      const phone = window.matchMedia("(max-width: 760px)").matches;
      mrInGrid = show && phone && items.length >= 4;                    // phones: story first, most-read right below it
      const mrHtml = show ? `<h2 class="mr-h"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3-1 4.500-1 7 0 1.500 1 2.500 2 2.500s2-1 2-2.500c2 1.500 3 3.500 3 6a6 6 0 0 1-12 0c0-3 2-4.500 3.500-7C10 8 11.500 6 12 3z"/></svg>${T("সর্বাধিক পঠিত", "Most read")}</h2>
        <ol class="mr-list">${top.map((p, i) => `<li><a href="${readUrl(p)}"><span class="mr-n">${num(i + 1)}</span><span class="mr-t">${esc(pick(p.title))}</span><small>${esc(pick(catOf(p.cat) || C.categories[0]))}</small></a></li>`).join("")}</ol>` : "";
      mr.hidden = !show || mrInGrid;
      mr.innerHTML = mrInGrid ? "" : mrHtml;
      mrGridHtml = mrInGrid ? `<section class="most-read in-grid" aria-label="Most read">${mrHtml}</section>` : "";
    }

    const lead = ready && !filtered && ST.sort === "new" && items.length >= 4 && window.matchMedia("(max-width: 760px)").matches;   // phones: newest story gets the big lead card; larger screens show equal cards
    list.classList.toggle("post-grid", !(ready && !items.length) && postsState !== "error");
    list.innerHTML = ready && items.length
      ? withFeedAds(pageItems.map((p, i) => (lead && i === 0 ? newsLead(p) + mrGridHtml : newsCard(p))))
      : (ready && filtered ? searchEmpty() : postsBlock(pageItems, true));
    const lh = document.querySelector(".list-h");
    if (lh) {
      let bar = lh.parentElement.classList.contains("list-bar") ? lh.parentElement : null;
      if (!bar) { bar = document.createElement("div"); bar.className = "list-bar"; lh.parentNode.insertBefore(bar, lh); bar.appendChild(lh); }
      const old = bar.querySelector(".list-count"); if (old) old.remove();
    }
    const more = $("#load-more");
    if (more) {
      const left = ready && ST.page < pages;
      more.hidden = !left;
      more.textContent = T("আরও পড়ুন", "Read more");
      if (!more.dataset.wired) {
        more.dataset.wired = "1";
        more.addEventListener("click", () => { ST.page += 1; syncUrl(); renderNews(); });
      }
    }
    const pg = $("#pager"); if (pg) { pg.hidden = true; pg.innerHTML = ""; }
  }
  if (!window.__vosbMq) { window.__vosbMq = window.matchMedia("(max-width: 760px)"); const f = () => { if (document.getElementById("news-list")) renderNews(); }; (window.__vosbMq.addEventListener ? window.__vosbMq.addEventListener("change", f) : window.__vosbMq.addListener(f)); }
  const ST = { init: false, q: "", sort: "new", month: "", page: 1, server: [], serverQ: "" };
  const searchEmpty = () => `<div class="empty-state"><div class="es-ic" aria-hidden="true">🔍</div>
      <h3>${T("কোনো ফলাফল পাওয়া যায়নি", "No matching stories")}</h3>
      <p>${T("অন্য শব্দ দিয়ে খুঁজুন, অথবা ফিল্টার মুছে সব খবর দেখুন।", "Try different words, or clear the filters to see every story.")}</p>
      <p style="margin-top:16px"><button class="btn btn-orange" type="button" data-clear>${T("সব খবর দেখুন", "Show all stories")}</button></p></div>`;
  const syncUrl = () => {
    const u = new URL(location.href);
    [["q", ST.q], ["sort", ST.sort === "top" ? "top" : ""], ["month", ST.month], ["page", ST.page > 1 ? String(ST.page) : ""]].forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k)));
    try { history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {}
  };
  let searchTimer = 0;
  function runServerSearch() {
    // only needed once the site has more stories than the page loads up front
    if (!ST.q || ST.q.length < 2 || POSTS.length < 200 || !API || !API.searchPosts || ST.serverQ === ST.q) return;
    const q = ST.q; ST.serverQ = q;
    API.searchPosts(q).then((rows) => { if (ST.q === q) { ST.server = rows; renderNews(); } }).catch(() => {});
  }
  function setQuery(v) {
    ST.q = v.slice(0, 80); ST.page = 1; if (!ST.q) { ST.server = []; ST.serverQ = ""; }
    syncUrl(); renderNews(); runServerSearch();
  }
  function mountListTools(list, num) {
    // hero: search box, popular searches, live stats (added once, texts refreshed on every render)
    const hero = document.querySelector(".page-hero .container");
    if (hero && !hero.querySelector(".hero-search")) {
      hero.insertAdjacentHTML("beforeend", `<form class="hero-search" role="search" autocomplete="off"><span class="hs-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/></svg></span><input id="q" type="search" enterkeyhint="search" maxlength="80"><button type="submit" class="btn btn-orange"></button></form>
        <div class="hero-pop" id="hero-pop"></div>`);
      const side = document.createElement("div"); side.className = "hero-side";
      hero.querySelectorAll(".hero-search, .hero-pop").forEach((el) => side.appendChild(el));
      hero.appendChild(side);
      const f = hero.querySelector(".hero-search"), inp = f.querySelector("input");
      f.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(searchTimer); setQuery(inp.value.trim()); document.querySelector("#list-tools")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
      inp.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => setQuery(inp.value.trim()), 220); });
      hero.querySelector("#hero-pop").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { inp.value = b.dataset.q; setQuery(b.dataset.q); document.querySelector("#list-tools")?.scrollIntoView({ behavior: "smooth", block: "start" }); } });
      inp.value = ST.q;
      if (/[?&]s=1(&|$)/.test(location.search) && !ST.q) setTimeout(() => { try { inp.focus({ preventScroll: false }); } catch (e) {} }, 120);
    }
    if (hero) {
      const inp = hero.querySelector("#q");
      inp.placeholder = T("খবর খুঁজুন…", "Search stories…");
      inp.setAttribute("aria-label", T("খবর খুঁজুন", "Search stories"));
      hero.querySelector(".hero-search button").textContent = T("খুঁজুন", "Search");
      hero.querySelector("#hero-pop").innerHTML = `<span>${T("জনপ্রিয় বিষয়:", "Popular:")}</span>` + [["ফান্ডিং", "Funding"], ["বিনিয়োগ", "Investment"], ["উদ্যোক্তা", "Founder"], ["এআই", "AI"], ["নীতিমালা", "Policy"]].map((k) => `<button type="button" data-q="${esc(lang === "bn" ? k[0] : k[1])}">${esc(lang === "bn" ? k[0] : k[1])}</button>`).join("");
    }
    // toolbar + most-read containers sit between the topic chips and the grid
    if (!$("#list-tools")) {
      list.insertAdjacentHTML("beforebegin", `<section id="most-read" class="most-read" hidden aria-label="Most read"></section><div id="list-tools" class="list-tools" hidden></div>`);
      const host = list.parentNode;
      host.addEventListener("click", (e) => {
        const sb = e.target.closest("[data-sort]"); if (sb) { ST.sort = sb.dataset.sort; ST.page = 1; syncUrl(); renderNews(); return; }
        if (e.target.closest("[data-clear]")) { ST.q = ""; ST.month = ""; ST.page = 1; ST.server = []; ST.serverQ = ""; const i = document.querySelector("#q"); if (i) i.value = ""; syncUrl(); renderNews(); }
      });
      host.addEventListener("change", (e) => { if (e.target.id === "month-sel") { ST.month = e.target.value; ST.page = 1; syncUrl(); renderNews(); } });
    }
    if (!$("#pager")) {
      const wrap = document.querySelector(".load-more-wrap");
      if (wrap) wrap.insertAdjacentHTML("afterend", `<nav id="pager" class="pager" aria-label="Pages" hidden></nav>`);
    }
  }
  function renderPager(pages) {
    const nav = $("#pager"); if (!nav) return;
    if (pages <= 1 || postsState !== "ready") { nav.hidden = true; nav.innerHTML = ""; return; }
    const cur = ST.page, nums = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…");
    const n = (v) => (lang === "bn" ? v.toLocaleString("bn-BD") : v);
    nav.hidden = false;
    nav.innerHTML = `<button type="button" data-pg="${cur - 1}" ${cur === 1 ? "disabled" : ""} aria-label="${T("আগের পৃষ্ঠা", "Previous page")}">‹ ${T("আগের", "Prev")}</button>`
      + nums.map((v) => (v === "…" ? `<span class="pg-gap">…</span>` : `<button type="button" data-pg="${v}" class="${v === cur ? "on" : ""}"${v === cur ? ' aria-current="page"' : ""}>${n(v)}</button>`)).join("")
      + `<button type="button" data-pg="${cur + 1}" ${cur === pages ? "disabled" : ""} aria-label="${T("পরের পৃষ্ঠা", "Next page")}">${T("পরের", "Next")} ›</button>`;
    nav.onclick = (e) => {
      const b = e.target.closest("[data-pg]"); if (!b || b.disabled) return;
      ST.page = +b.dataset.pg; syncUrl(); renderNews();
      const bar = document.querySelector("#list-tools"); if (bar) bar.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }
  renderers.push(renderNews);

  /* ---------- Single article ---------- */
  const SHARE = {
    whatsapp: { label: "WhatsApp", color: "#25d366", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-1.4-.7-2.3-1.2-3.2-2.7-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1 1.600-.9 2.500.3 1.200 1.100 2.400 2.500 3.600 1.800 1.600 3.200 2 4.400 2.200.8.100 1.700-.1 2.300-.8.200-.3.500-1 .5-1.500 0-.2-.1-.4-.2-.5z"/></svg>' },
    facebook: { label: "Facebook", color: "#1877f2", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>' },
    linkedin: { label: "LinkedIn", color: "#0a66c2", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.300 2.400 4.300 5.500v6.200zM5.300 7.400a2.100 2.100 0 1 1 0-4.200 2.100 2.100 0 0 1 0 4.200zM7.100 20.500H3.600V9h3.500v11.500z"/></svg>' },
    x: { label: "X", color: "#111111", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.2 2.2h3.3l-7.2 8.300 8.500 11.300h-6.700l-5.200-6.800-6 6.800H1.600l7.700-8.800L1.200 2.200h6.800l4.700 6.200 5.500-6.200zm-1.200 17.600h1.800L7 4.100H5.100l11.900 15.700z"/></svg>' },
    telegram: { label: "Telegram", color: "#229ed9", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.900 3.100 2.500 10.600c-1.300.5-1.300 1.300-.2 1.600l5 1.600 1.900 5.900c.2.600.1.800.7.800.5 0 .7-.2 1-.5l2.400-2.300 5 3.700c.9.500 1.600.2 1.800-.9l3.300-15.500c.3-1.400-.5-2-1.500-1.600zM9 14.100l9.500-6c.4-.3.8-.1.500.2l-7.800 7.100-.3 3.300L9 14.100z"/></svg>' },
    email: { label: "Email", color: "#6b6b6b", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.600V17h16V7.600l-8 5.400-8-5.400zM5.500 7 12 11.400 18.500 7h-13z"/></svg>' },
  };
  const COPY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h9a2 2 0 0 1 2 2v11h-2V5H9V3zM6 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h9V9H6z"/></svg>';
  const NATIVE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.200 1l-7-3.500a3 3 0 0 0 0-1l7-3.500A3 3 0 1 0 15 7a3 3 0 0 0 .1.700l-7 3.500a3 3 0 1 0 0 3.600l7 3.500A3 3 0 1 0 18 16z"/></svg>';

  let art = { slug: null, post: null, tracked: false, failed: false, drawn: "" };

  function articleSlug() {
    const m = location.pathname.match(/^\/(?:en\/)?read\/([a-z0-9-]+)\/?$/);
    return m ? m[1] : new URLSearchParams(location.search).get("id");
  }
  const articleUrl = (slug) => `${C.site.origin}${EN_EDITION ? "/en" : ""}/read/${slug}`;

  const notFoundHtml = () => `<h1>${T("পোস্ট পাওয়া যায়নি", "Post not found")}</h1>
    <p class="muted" style="margin-top:8px">${T("লিংকটি ভুল হতে পারে অথবা পোস্টটি সরানো হয়েছে।", "The link may be wrong or the post may have been removed.")}</p>
    <p style="margin-top:20px"><a class="btn btn-orange" href="/news">${T("সব সংবাদ", "All news")}</a></p>`;

  const articleSkeleton = () => `<div class="art-sk" aria-busy="true"><span class="sk sk-s"></span><span class="sk sk-h"></span><span class="sk sk-h sk-m"></span><span class="sk sk-img"></span><span class="sk"></span><span class="sk"></span><span class="sk sk-m"></span></div>`;

  function setAttr(sel, attr, val) { const el = $(sel); if (el) el.setAttribute(attr, val); }

  function updateHead(p) {
    const title = pick(p.title);
    const desc = pick(p.excerpt);
    const url = articleUrl(p.slug);
    const img = p.image || `${C.site.origin}/assets/og-image.png`;
    document.title = `${title} | Voice of Startup Bangladesh`;
    setAttr('meta[name="description"]', "content", desc);
    setAttr('link[rel="canonical"]', "href", url);
    setAttr('meta[property="og:title"]', "content", title);
    setAttr('meta[property="og:description"]', "content", desc);
    setAttr('meta[property="og:url"]', "content", url);
    setAttr('meta[property="og:image"]', "content", img);
    setAttr('meta[name="twitter:title"]', "content", title);
    setAttr('meta[name="twitter:description"]', "content", desc);
    setAttr('meta[name="twitter:image"]', "content", img);
    let ld = $("#ld-article");
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "ld-article"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "NewsArticle",
      headline: title, description: desc, image: [img], inLanguage: lang,
      datePublished: p.date, dateModified: p.updated || p.date,
      author: p.author && p.author !== "VOSB Desk" ? { "@type": "Person", name: p.author } : { "@type": "Organization", name: "Voice of Startup Bangladesh" },
      publisher: { "@type": "Organization", name: "Voice of Startup Bangladesh", logo: { "@type": "ImageObject", url: `${C.site.origin}/assets/logo.png` } },
      mainEntityOfPage: url,
    });
  }

  function drawRelated(p) {
    const box = $("#related");
    if (!box) return;
    const rel = POSTS.filter((x) => x.slug !== p.slug && x.cat === p.cat).slice(0, 3);
    const more = rel.length < 3 ? POSTS.filter((x) => x.slug !== p.slug && x.cat !== p.cat).slice(0, 3 - rel.length) : [];
    const all = [...rel, ...more];
    box.innerHTML = all.length ? `<h2 class="related-h">${T("আরও পড়ুন", "Read more")}</h2><div class="post-grid related-grid">${all.map(newsCard).join("")}</div>` : "";
  }

  function wireShare(p) {
    const bar = $("#share-bar");
    if (!bar) return;
    const url = articleUrl(p.slug);
    const title = pick(p.title);
    const e = encodeURIComponent;
    const hrefs = {
      whatsapp: `https://wa.me/?text=${e(title + "\n" + url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
      x: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`,
      telegram: `https://t.me/share/url?url=${e(url)}&text=${e(title)}`,
      email: `mailto:?subject=${e(title)}&body=${e(title + "\n\n" + url)}`,
    };
    $$("[data-share]", bar).forEach((a) => {
      a.href = hrefs[a.dataset.share];
      a.addEventListener("click", () => API.trackShare(p.slug));
    });
    const copy = $("[data-copy]", bar);
    if (copy) copy.onclick = async () => {
      API.trackShare(p.slug);
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch (err) {
        const ta = document.createElement("textarea"); ta.value = url; ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand("copy"); } catch (e2) {} ta.remove();
      }
      const lbl = $("span", copy);
      lbl.textContent = ok ? T("কপি হয়েছে ✓", "Copied ✓") : url;
      copy.classList.toggle("done", ok);
      setTimeout(() => { lbl.textContent = T("লিংক কপি", "Copy link"); copy.classList.remove("done"); }, 2200);
    };
    const nat = $("[data-native]", bar);
    if (nat) {
      if (navigator.share) nat.onclick = () => { navigator.share({ title, text: title, url }).then(() => API.trackShare(p.slug)).catch(() => {}); };
      else nat.remove();
    }
  }

  function drawArticle(box, p) {
    const key = `${p.slug}|${lang}|${p.updated}`;
    if (art.drawn === key) { drawRelated(p); return; }
    art.drawn = key;
    const c = catOf(p.cat) || C.categories[0];
    const bodyMd = p.bodyMd[lang] || p.bodyMd.bn;
    const mins = MD.readingMinutes(bodyMd);
    const minsTxt = lang === "bn" ? mins.toLocaleString("bn-BD") : mins;
    const src = p.source === "VOSB"
      ? T("মূল প্রতিবেদন: Voice of Startup Bangladesh", "Original reporting: Voice of Startup Bangladesh")
      : `${T("তথ্যসূত্র", "Source")}: ${p.sourceUrl ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(p.source)} ↗</a>` : esc(p.source)}`;
    box.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">${T("হোম", "Home")}</a><span>›</span><a href="/${c.slug}">${esc(pick(c))}</a></nav>
      <div class="post-meta"><span class="badge">${ci(c)} ${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
      <h1>${esc(pick(p.title))}</h1>
      <div class="byline"><span>${T("লেখক", "By")} <b>${esc(p.author)}</b></span><span>${formatDateTime(p.date)}</span><span>${T(`${minsTxt} মিনিটে পড়া`, `${minsTxt} min read`)}</span></div>
      ${p.image ? `<figure class="cover"><div class="cv"><img class="cv-bg" src="${esc(p.image)}" alt="" aria-hidden="true" decoding="async"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" width="1200" height="675" decoding="async" fetchpriority="high"></div>${p.imageAlt ? `<figcaption>${esc(p.imageAlt)}</figcaption>` : ""}</figure>` : ""}
      <div class="prose">${withArticleAds(MD.render(bodyMd))}</div>
      ${(lang === "bn" ? p.autoBn : p.autoEn) ? `<p class="tr-note">🌐 ${T("এই বাংলা সংস্করণটি স্বয়ংক্রিয়ভাবে অনুবাদ করা হয়েছে। কোনো ভুল চোখে পড়লে editor@voiceofstartup.bd-এ জানান।", "This English version was automatically translated from the original Bangla. If you spot a mistake, tell editor@voiceofstartup.bd.")}</p>` : ""}
      <div class="src">${src}</div>
      <div class="share-bar" id="share-bar" role="group" aria-label="${T("শেয়ার করুন", "Share")}">
        <b class="share-title">${T("শেয়ার করুন", "Share this article")}</b>
        <div class="share-btns">
          <button type="button" class="share-btn share-native" data-native style="--c:#ff7522">${NATIVE_SVG}<span>${T("শেয়ার", "Share")}</span></button>
          ${Object.keys(SHARE).map((k) => `<a class="share-btn" data-share="${k}" target="_blank" rel="noopener noreferrer" style="--c:${SHARE[k].color}" aria-label="${SHARE[k].label}">${SHARE[k].svg}<span>${SHARE[k].label}</span></a>`).join("")}
          <button type="button" class="share-btn" data-copy style="--c:#0b8a4b">${COPY_SVG}<span>${T("লিংক কপি", "Copy link")}</span></button>
        </div>
      </div>
      <div class="ad-slot" data-slot="after_article" data-i="0"></div>
      <div id="related"></div>
      <p style="margin-top:28px"><a class="btn btn-outline" href="/news">← ${T("সব সংবাদ", "All news")}</a></p>`;
    wireShare(p);
    drawRelated(p);
    updateHead(p);
    if (!art.tracked) { art.tracked = true; API.trackView(p.slug); }
  }

  async function loadFresh(slug) {
    try {
      const p = await API.getPost(slug);
      if (art.slug !== slug) return;
      if (p) { art.post = p; art.failed = false; }
      else if (!art.post) art.failed = true;
    } catch (e) { if (!art.post) art.failed = true; }
    renderArticle();
  }

  function renderArticle() {
    const box = $("#article");
    if (!box) return;
    const nf = $("#notfound-box"); // only on 404.html, which doubles as an instant viewer for new /read/<slug> links
    const slug = articleSlug();
    if (nf && !slug) return;
    if (!slug) { box.innerHTML = notFoundHtml(); return; }
    if (art.slug !== slug) {
      art = { slug, post: null, tracked: false, failed: false, drawn: "" };
      const emb = $("#post-data");   // present on statically built pages
      if (emb) { try { art.post = API.normalize(JSON.parse(emb.textContent)); } catch (e) {} }
      loadFresh(slug);
    }
    if (nf) { nf.hidden = !!art.post || !art.failed ? true : false; box.hidden = !(art.post || !art.failed); }
    if (art.post) drawArticle(box, art.post);
    else if (art.failed) { box.innerHTML = notFoundHtml(); }
    else { box.innerHTML = articleSkeleton(); }
  }
  renderers.push(renderArticle);


  /* ---------- Ads (managed in the admin panel; always labelled; never block reading) ---------- */
  let ADS = (API && API.configured && API.cachedAds) ? API.cachedAds() : [];
  const adMemo = new Map();      // keep the same ad in a slot across re-renders (language switch etc.)
  const adSeen = new Set();      // impressions counted once per page load
  const isLive = (a) => (!a.start_at || new Date(a.start_at) <= new Date()) && (!a.end_at || new Date(a.end_at) > new Date());
  const catOfPage = () => document.body.dataset.cat || (art && art.post ? art.post.cat : null);

  function eligible(place, exclude) {
    const cat = catOfPage();
    return ADS.filter((a) => a.placement === place && isLive(a) && /^https?:\/\//i.test(a.link_url || "")
      && (a.lang === "all" || a.lang === lang) && (!a.category || !cat || a.category === cat) && !(exclude || []).includes(a.id));
  }
  function weightedPick(list) {
    if (!list.length) return null;
    const total = list.reduce((n, a) => n + (a.priority || 5), 0);
    let r = Math.random() * total;
    for (const a of list) { r -= a.priority || 5; if (r <= 0) return a; }
    return list[0];
  }
  function adFor(place, i) {
    const key = place + ":" + i;
    const prev = adMemo.get(key);
    if (prev) { const still = eligible(place).find((a) => a.id === prev); if (still) return still; }
    const used = [];
    adMemo.forEach((id, k) => { if (k.startsWith(place + ":") && k !== key) used.push(id); });
    const a = weightedPick(eligible(place, used)) || weightedPick(eligible(place));
    if (a) adMemo.set(key, a.id); else adMemo.delete(key);
    return a;
  }
  function adHtml(a) {
    const label = `<span class="ad-label">${T("বিজ্ঞাপন", "Ad")}</span>`;
    const attrs = `href="${esc(a.link_url)}" target="_blank" rel="sponsored nofollow noopener" data-ad="${esc(a.id)}"`;
    if (a.kind === "image" && a.image_url) {
      return `<a class="ad" ${attrs} aria-label="${esc(a.headline || T("স্পনসরড", "Sponsored"))}">${label}<img src="${esc(a.image_url)}" alt="${esc(a.headline || T("বিজ্ঞাপন", "Advertisement"))}" loading="lazy" decoding="async"></a>`;
    }
    return `<a class="ad" ${attrs}>${label}<span class="ad-text"><b>${esc(a.headline)}</b>${a.body ? `<span class="ad-body">${esc(a.body)}</span>` : ""}<span class="ad-cta">${esc(a.cta || T("বিস্তারিত দেখুন", "Learn more"))} →</span></span></a>`;
  }
  function fillSlots() {
    $$("[data-slot]").forEach((el) => {
      const a = adFor(el.dataset.slot, +el.dataset.i || 0);
      el.innerHTML = a ? adHtml(a) : "";
    });
  }
  let io = null;
  function observeAds() {
    if (!API || !API.configured) return;
    const els = $$("a.ad[data-ad]").filter((el) => !adSeen.has(el.dataset.ad));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach((el) => { adSeen.add(el.dataset.ad); API.adImpression(el.dataset.ad); }); return; }
    if (!io) io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.dataset.ad;
      io.unobserve(en.target);
      if (!adSeen.has(id)) { adSeen.add(id); API.adImpression(id); }
    }), { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }
  /* Ad links: count the click, then open the link reliably.
     - links to this same website (www or not) stay in the page / same tab (e.g. the newsletter banner -> /#subscribe)
     - every other link opens in a new tab (plain anchor behaviour, works in in-app browsers too) */
  const siteHost = (h) => String(h || "").toLowerCase().replace(/^www\./, "");
  const cleanPath = (x) => x.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.ad");
    if (!a) return;
    if (a.dataset.ad && API) API.adClick(a.dataset.ad);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let u; try { u = new URL(a.getAttribute("href"), location.href); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol)) { e.preventDefault(); return; }
    if (siteHost(u.hostname) === siteHost(location.hostname)) {
      e.preventDefault();
      if (popClose) popClose();
      if (cleanPath(u.pathname) === cleanPath(location.pathname)) {
        const t = u.hash && document.querySelector(u.hash);
        if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); const f = t.querySelector("input[type=email]"); if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (x) {} }, 500); }
        else window.scrollTo({ top: 0, behavior: "smooth" });
      } else location.href = u.href;
    } else if (popClose) setTimeout(popClose, 300);   // opens in a new tab; tidy the pop-up behind it
  });

  /* feed ads: one after the 6th card, then every 12 cards */
  function withFeedAds(cards) {
    const out = [];
    let n = 0;
    cards.forEach((c, i) => {
      out.push(c);
      if (i === 5 || (i > 5 && (i - 5) % 12 === 0)) out.push(`<div class="ad-slot" data-slot="feed" data-i="${n++}"></div>`);
    });
    return out.join("");
  }
  /* in-article ads: after the 3rd block, and again after the 10th for long articles — never right after a heading */
  function withArticleAds(html) {
    const blocks = html.split("\n");
    if (blocks.length < 5) return html;
    const out = [];
    let n = 0, next = 3;
    blocks.forEach((b, i) => {
      out.push(b);
      const idx = i + 1;
      if (idx >= next && !/^<h[23]/.test(b) && idx < blocks.length - 1 && n < 2) {
        out.push(`<div class="ad-slot in-article" data-slot="in_article" data-i="${n++}"></div>`);
        next = idx + 7;
      }
    });
    return out.join("\n");
  }

  /* welcome pop-up: once per visitor per N hours, only after a short delay, never on article pages, easy to close */
  let popupDone = false, popClose = null;
  function maybePopup() {
    if (popupDone || !API || !API.configured || document.getElementById("article") || /^\/(admin|read|en\/read)\b/.test(location.pathname)) return;
    const a = weightedPick(eligible("popup"));
    if (!a) return;
    popupDone = true;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("vosb-pop") || "{}"); } catch (e) {}
    const hrs = a.freq_hours === 0 ? 0 : (a.freq_hours || 12);
    if (hrs && seen[a.id] && Date.now() - seen[a.id] < hrs * 3600 * 1000) return;
    const show = () => {
      if (document.querySelector(".ad-pop-bg")) return;
      if (document.hidden) { document.addEventListener("visibilitychange", function w() { if (!document.hidden) { document.removeEventListener("visibilitychange", w); show(); } }); return; }
      const prevFocus = document.activeElement;
      const bg = document.createElement("div");
      bg.className = "ad-pop-bg";
      bg.innerHTML = `<div class="ad-pop" role="dialog" aria-label="${T("স্পনসরড বিজ্ঞাপন", "Sponsored advertisement")}"><button class="ad-pop-close" type="button" aria-label="${T("বন্ধ করুন", "Close")}">×</button>${adHtml(a)}</div>`;
      let closing = false;
      const close = () => {
        if (closing) return; closing = true; popClose = null;
        document.removeEventListener("keydown", onKey);
        bg.classList.add("out");
        const done = () => { bg.remove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) {} };
        if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else setTimeout(done, 240);
      };
      popClose = close;
      const onKey = (e) => { if (e.key === "Escape") close(); };
      bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest(".ad-pop-close")) close(); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(bg);
      bg.querySelector(".ad-pop-close").focus();
      try { seen[a.id] = Date.now(); localStorage.setItem("vosb-pop", JSON.stringify(seen)); } catch (e) {}
      observeAds();
    };
    setTimeout(show, 3000);
  }

  async function loadAds() {
    if (!API || !API.configured) return;
    try { ADS = await API.listAds(); } catch (e) { return; }
    refresh();
    maybePopup();
  }

  /* Legal pages (content lives in js/legal.js) */
  function renderLegal() {
    const box = $("#legal");
    const key = document.body.dataset.legal;
    const doc = window.VOSB_LEGAL && window.VOSB_LEGAL[key];
    if (!box || !doc) return;
    document.title = `${pick(doc.title)} — Voice of Startup Bangladesh`;
    const sections = doc.sections.map((s, i) => `
      <section id="s${i + 1}">
        <h2>${i + 1}. ${esc(pick(s.h))}</h2>
        ${(s.p || []).map((x) => `<p>${esc(pick(x))}</p>`).join("")}
        ${s.ul ? `<ul>${s.ul.map((x) => `<li>${esc(pick(x))}</li>`).join("")}</ul>` : ""}
        ${(s.p2 || []).map((x) => `<p>${esc(pick(x))}</p>`).join("")}
      </section>`).join("");
    const toc = doc.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(pick(s.h))}</a></li>`).join("");
    box.innerHTML = `
      <p class="eyebrow">${T("আইনি তথ্য", "Legal")}</p>
      <h1>${esc(pick(doc.title))}</h1>
      <p class="muted legal-meta">${T("কার্যকর ও সর্বশেষ হালনাগাদ", "Effective & last updated")}: ${formatDate(window.VOSB_LEGAL.updated)}</p>
      <p class="legal-intro">${esc(pick(doc.intro))}</p>
      <nav class="legal-toc" aria-label="${T("সূচিপত্র", "Contents")}"><b>${T("সূচিপত্র", "Contents")}</b><ol>${toc}</ol></nav>
      ${sections}
      <div class="legal-contact"><b>${T("প্রশ্ন আছে?", "Questions?")}</b> ${T("যোগাযোগ করুন", "Contact us at")} <a href="mailto:hello@voiceofstartup.bd">hello@voiceofstartup.bd</a></div>
      <div class="legal-others">${LEGAL.filter((l) => l.href !== location.pathname.replace(/\.html$/, "")).map((l) => `<a href="${l.href}">${esc(pick(l))}</a>`).join("")}</div>`;
  }
  renderers.push(renderLegal);

  /* Newsletter: saves the address in Supabase (table `subscribers`) through a secure RPC */
  function wireNewsletter(nl) {
    const input = $("input[type=email]", nl), btn = $("button[type=submit]", nl), msg = $("#nl-msg");
    const say = (kind, bn, en) => { if (!msg) return; msg.className = "nl-msg " + kind; msg.textContent = T(bn, en); msg.hidden = false; };
    let done = "";
    try { done = localStorage.getItem("vosb-nl") || ""; } catch (e) {}
    if (done) say("ok", "আপনি ইতিমধ্যে সাবস্ক্রাইব করেছেন। ধন্যবাদ!", "You're already subscribed. Thank you!");
    nl.onsubmit = async (e) => {
      e.preventDefault();
      const hp = $("input[name=website]", nl);
      const email = (input.value || "").trim().toLowerCase();
      if (hp && hp.value) { say("ok", "ধন্যবাদ! আপনি সাবস্ক্রাইব করেছেন।", "Thank you! You're subscribed."); return; }   // bots fill the hidden field
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { say("err", "সঠিক ইমেইল ঠিকানা দিন।", "Please enter a valid email address."); input.focus(); return; }
      if (!API.configured) { location.href = `mailto:hello@voiceofstartup.bd?subject=${encodeURIComponent("Newsletter signup")}&body=${encodeURIComponent("Please add me to the newsletter: " + email)}`; return; }
      btn.disabled = true; input.disabled = true;
      const label = btn.textContent; btn.textContent = T("অপেক্ষা করুন…", "Please wait…");
      try {
        const r = await API.subscribe(email, lang, "home");
        if (r === "ok") {
          say("ok", "ধন্যবাদ! আপনি সাবস্ক্রাইব করেছেন। সাপ্তাহিক আপডেট আপনার ইমেইলে পৌঁছে যাবে।", "Thank you! You're subscribed. Our weekly update will reach your inbox.");
          input.value = "";
          try { localStorage.setItem("vosb-nl", "1"); } catch (e2) {}
        } else if (r === "invalid") say("err", "সঠিক ইমেইল ঠিকানা দিন।", "Please enter a valid email address.");
        else say("err", "এই মুহূর্তে অনেক অনুরোধ আসছে। একটু পরে আবার চেষ্টা করুন।", "We're getting a lot of requests right now. Please try again in a minute.");
      } catch (err) {
        say("err", "দুঃখিত, সাবস্ক্রাইব করা যায়নি। একটু পরে আবার চেষ্টা করুন অথবা hello@voiceofstartup.bd-এ লিখুন।", "Sorry, we couldn't subscribe you. Please try again shortly or write to hello@voiceofstartup.bd.");
      }
      btn.disabled = false; input.disabled = false; btn.textContent = label;
    };
  }

  /* /unsubscribe?t=<token> — one-click unsubscribe */
  async function renderUnsub() {
    const box = $("#unsub-box");
    if (!box) return;
    const token = new URLSearchParams(location.search).get("t") || "";
    const set = (h1, p) => { box.innerHTML = `<p class="eyebrow">${T("নিউজলেটার", "Newsletter")}</p><h1>${h1}</h1><p class="muted">${p}</p><p style="margin-top:24px"><a class="btn btn-green" href="/">${T("হোমে ফিরুন", "Back to home")}</a></p>`; };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return set(T("লিংকটি সঠিক নয়", "This link isn't valid"), T("নিউজলেটার থেকে সরে যেতে ইমেইলের ভেতরের “Unsubscribe” লিংকটি ব্যবহার করুন, অথবা hello@voiceofstartup.bd-এ লিখুন।", "Please use the “Unsubscribe” link inside the newsletter email, or write to hello@voiceofstartup.bd."));
    }
    set(T("অপেক্ষা করুন…", "One moment…"), "");
    try {
      const ok = await API.unsubscribe(token.toLowerCase());
      if (ok) {
        try { localStorage.removeItem("vosb-nl"); } catch (e) {}
        set(T("আপনি সরে গেছেন", "You've been unsubscribed"), T("আপনাকে আর নিউজলেটার পাঠানো হবে না। ভুল করে সরে গেলে সাইটে আবার সাবস্ক্রাইব করতে পারেন।", "You won't receive our newsletter any more. If this was a mistake you can subscribe again on the website."));
      } else set(T("লিংকটি সঠিক নয়", "This link isn't valid"), T("এই লিংকে কোনো সাবস্ক্রিপশন পাওয়া যায়নি।", "We couldn't find a subscription for this link."));
    } catch (e) {
      set(T("কিছু ভুল হয়েছে", "Something went wrong"), T("একটু পরে আবার চেষ্টা করুন অথবা hello@voiceofstartup.bd-এ লিখুন।", "Please try again shortly or write to hello@voiceofstartup.bd."));
    }
  }
  renderers.push(renderUnsub);

  /* Forms */
  function wireForms() {
    const nl = $("#newsletter");
    if (nl) wireNewsletter(nl);
    const cf = $("#contact-form");
    if (cf) $$("select[name=to] option", cf).forEach((o) => {
      const em = C.emails.find((x) => x.address === o.value);
      if (em) o.textContent = `${pick(em)} — ${em.address}`;
    });
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
    refresh();
    wireForms();
  }

  /* re-render page content (not the header) */
  function refresh() {
    renderers.forEach((r) => r());
    applyStatic();
    fillSlots();
    observeAds();
  }

  async function loadPosts() {
    if (!API || !API.configured) { postsState = "ready"; refresh(); return; }
    postsState = "loading";
    try { POSTS = await API.listPosts(); postsState = "ready"; }
    catch (e) { postsState = "error"; }
    refresh();
  }

  document.addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) loadPosts(); });

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    loadPosts();
    loadAds();
    if (API && API.trackVisit) API.trackVisit(lang);
  });
})();
