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
    { href: "/about", bn: "আমাদের সম্পর্কে", en: "About" },
    { href: "/careers", bn: "ক্যারিয়ার", en: "Careers" },
    { href: "/contact", bn: "যোগাযোগ", en: "Contact" },
  ];

  const LEGAL = [
    { href: "/privacy-policy",   bn: "গোপনীয়তা নীতি", en: "Privacy Policy" },
    { href: "/terms-of-service", bn: "ব্যবহারের শর্তাবলি", en: "Terms of Service" },
    { href: "/cookie-policy",    bn: "কুকি নীতি", en: "Cookie Policy" },
    { href: "/refund-policy",    bn: "রিফান্ড নীতি", en: "Refund Policy" },
    { href: "/usage-policy",     bn: "ব্যবহার নীতি", en: "Usage Policy" },
  ];

  // Show clean URLs (/about instead of /about.html) if someone opens an old .html link
  try {
    if (/\.html$/.test(location.pathname)) {
      const clean = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
      history.replaceState(null, "", clean + location.search + location.hash);
    }
  } catch (e) {}

  const toDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00+06:00") : new Date(iso));
  const formatDate = (iso) =>
    toDate(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", year: "numeric", month: "long", day: "numeric" });
  const formatDateTime = (iso) =>
    toDate(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  /* ---------- Header / footer ---------- */
  function renderChrome() {
    const page = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
    const top = $("#site-top");
    if (top) {
      top.innerHTML = `
      <div class="topbar"><div class="container">
        <span class="flagline"><span class="flagdot"></span>${T("সরকার অনুমোদিত সংস্থার তথ্যসূত্রে যাচাইকৃত আপডেট", "Updates verified from government-approved sources")}</span>
        <span class="date">${new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div></div>
      <header class="site-header"><div class="container">
        <a class="brand" href="/" aria-label="Voice of Startup Bangladesh"><img src="/assets/logo.png" alt="Voice of Startup BD logo"></a>
        <nav class="nav" id="nav" aria-label="Main">
          ${NAV.map((n) => `<a href="${n.href}" class="${n.href === page ? "active" : ""}">${esc(pick(n))}</a>`).join("")}
        </nav>
        <div class="header-actions">
          <button class="lang-toggle" id="lang" aria-label="Switch language">${lang === "bn" ? "EN" : "বাংলা"}</button>
          <a class="btn btn-green" href="#follow">${T("ফলো করুন", "Follow Now")}</a>
          <button class="menu-btn" id="menu" aria-label="Menu">☰</button>
        </div>
      </div></header>
      <div class="container"><div class="ad-slot ad-header" data-slot="header" data-i="0"></div></div>`;
      $("#menu").onclick = () => $("#nav").classList.toggle("open");
      $("#lang").onclick = () => {
        lang = lang === "bn" ? "en" : "bn";
        try { localStorage.setItem("vosb-lang", lang); } catch (e) {}
        if (EN_EDITION && lang === "bn") { location.href = location.pathname.replace(/^\/en/, ""); return; }
        renderAll();
      };
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
        <span class="post-date">${formatDate(p.date)}</span>
      </div></a>`;
  }

  function featuredCard(p) {
    const c = catOf(p.cat) || C.categories[0];
    return `<a class="featured-card" href="${readUrl(p)}">
      ${p.image ? `<div class="fc-img"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" decoding="async" width="800" height="450"></div>` : `<div class="fc-img ${esc(p.cat)}" aria-hidden="true"><span>${c.icon}</span></div>`}
      <div class="fc-body">
        <div class="post-meta"><span class="badge top">★ ${T("প্রধান খবর", "Top story")}</span><span class="badge">${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
        <h3>${esc(pick(p.title))}</h3>
        <p>${esc(pick(p.excerpt))}</p>
        <span class="post-date">${formatDate(p.date)}</span>
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
      ? POSTS.slice(0, 12).map((p) => esc(pick(p.title)))
      : C.categories.map((c) => `${ci(c)} ${esc(pick(c))}`);
    items.unshift(T("সব আপডেট সবার আগে", "All updates, first"));
    const html = items.map((t) => `<span>${t}</span>`).join("");
    return `<div class="ticker-track">${html}${html}</div>`;
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
  mount("latest", () => {
    const f = topStory();
    const rest = [...POSTS].filter((p) => !f || p.slug !== f.slug).slice(0, 6);
    const html = postsBlock(rest, true);
    // featured alone still counts as content: don't show "coming soon" under it
    return f && !rest.length ? "" : html;
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
    }
    const items = POSTS.filter((p) => active === "all" || p.cat === active);
    const ready = postsState === "ready";
    list.classList.toggle("post-grid", !(ready && !items.length) && postsState !== "error");
    list.innerHTML = postsState === "ready" && items.length ? withFeedAds(items.slice(0, shown).map(postCard)) : postsBlock(items.slice(0, shown), true);
    const more = $("#load-more");
    if (more) {
      more.hidden = !(ready && items.length > shown);
      more.textContent = T("আরও দেখুন", "Load more");
      more.onclick = () => { shown += 12; renderNews(); };
    }
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
    box.innerHTML = all.length ? `<h2 class="related-h">${T("আরও পড়ুন", "Read more")}</h2><div class="post-grid related-grid">${all.map(postCard).join("")}</div>` : "";
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
      ${p.image ? `<figure class="cover"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" width="1200" height="675" decoding="async" fetchpriority="high">${p.imageAlt ? `<figcaption>${esc(p.imageAlt)}</figcaption>` : ""}</figure>` : ""}
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
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.ad[data-ad]");
    if (a && API) API.adClick(a.dataset.ad);
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
  let popupDone = false;
  function maybePopup() {
    if (popupDone || !API || !API.configured || document.getElementById("article") || /^\/(admin|read|en\/read)\b/.test(location.pathname)) return;
    const a = weightedPick(eligible("popup"));
    if (!a) return;
    popupDone = true;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("vosb-pop") || "{}"); } catch (e) {}
    const hrs = a.freq_hours === 0 ? 0 : (a.freq_hours || 12);
    if (hrs && seen[a.id] && Date.now() - seen[a.id] < hrs * 3600 * 1000) return;
    setTimeout(() => {
      if (document.hidden || document.querySelector(".ad-pop-bg")) return;
      const prevFocus = document.activeElement;
      const bg = document.createElement("div");
      bg.className = "ad-pop-bg";
      bg.innerHTML = `<div class="ad-pop" role="dialog" aria-label="${T("স্পনসরড বিজ্ঞাপন", "Sponsored advertisement")}"><button class="ad-pop-close" type="button" aria-label="${T("বন্ধ করুন", "Close")}">×</button>${adHtml(a)}</div>`;
      const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} };
      const onKey = (e) => { if (e.key === "Escape") close(); };
      bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest(".ad-pop-close")) close(); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(bg);
      bg.querySelector(".ad-pop-close").focus();
      try { seen[a.id] = Date.now(); localStorage.setItem("vosb-pop", JSON.stringify(seen)); } catch (e) {}
      observeAds();
    }, 5000);
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
