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
            <span class="footer-logo"><img src="/assets/logo.png" alt="Voice of Startup BD"></span>
            <p style="margin-top:16px;color:#d6d6d6;max-width:40ch">${T("স্টার্টআপ, ব্যবসা ও বিনিয়োগের সব আপডেট সবার আগে।", "Startup, business & investment updates — first.")}</p>
            <div class="footer-socials">${social}</div>
          </div>
          <div>
            <h4>${T("এক্সপ্লোর", "Explore")}</h4>
            <ul>${C.categories.map((c) => `<li><a href="/${c.slug}">${c.icon} ${esc(pick(c))}</a></li>`).join("")}
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

  const readUrl = (p) => `/read/${p.slug}`;
  const thumb = (p, c) => p.image
    ? `<div class="post-thumb has-img"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" loading="lazy" decoding="async" width="640" height="360"></div>`
    : `<div class="post-thumb ${esc(p.cat)}" aria-hidden="true">${c.icon}</div>`;

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
      : C.categories.map((c) => `${c.icon} ${esc(pick(c))}`);
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
      return `<a class="cat-card" href="/${c.slug}"><div class="ic">${c.icon}</div><h3>${esc(pick(c))}</h3><p>${desc}</p></a>`;
    }).join(""));

  const emptyState = () => `<div class="empty-state">
      <div class="es-ic" aria-hidden="true">🔔</div>
      <h3>${T("প্রথম আপডেট শিগগিরই আসছে", "First updates are coming soon")}</h3>
      <p>${T("যাচাইকৃত ফান্ডিং, নীতিমালা ও সুযোগের খবর এখানে প্রকাশিত হবে। নোটিফিকেশন পেতে আমাদের পেজগুলো ফলো করুন।", "Verified funding, policy and opportunity news will appear here. Follow our pages to get notified.")}</p>
      <div class="socials es-socials">${Object.keys(C.social).map((k) => `<a class="social-btn" href="${C.social[k]}" target="_blank" rel="noopener">${ICON[k]}${LABEL[k]}</a>`).join("")}</div>
    </div>`;

  const topStory = () => (postsState === "ready" ? POSTS.find((p) => p.featured) : null) || null;
  mount("featured", () => { const f = topStory(); return f ? featuredCard(f) : ""; });
  mount("latest", () => {
    const f = topStory();
    const rest = [...POSTS].filter((p) => !f || p.slug !== f.slug).slice(0, 6);
    const html = postsBlock(rest, true);
    // featured alone still counts as content: don't show "coming soon" under it
    return f && !rest.length ? "" : html;
  });

  mount("source-chips", () =>
    C.sources.map((s) => `<div class="chip"><b>${esc(s.short)}</b><small>${esc(pick(s))}</small></div>`).join(""));

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
    if (fbox) fbox.innerHTML = filters.map((f) => `<a class="filter ${f.id === active ? "active" : ""}" href="/${f.slug}">${f.icon || ""} ${esc(pick(f))}</a>`).join("");
    const items = POSTS.filter((p) => active === "all" || p.cat === active);
    const ready = postsState === "ready";
    list.classList.toggle("post-grid", !(ready && !items.length) && postsState !== "error");
    list.innerHTML = postsBlock(items.slice(0, shown), true);
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
    const m = location.pathname.match(/^\/read\/([a-z0-9-]+)\/?$/);
    return m ? m[1] : new URLSearchParams(location.search).get("id");
  }
  const articleUrl = (slug) => `${C.site.origin}/read/${slug}`;

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
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch (err) {
        const ta = document.createElement("textarea"); ta.value = url; ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand("copy"); } catch (e2) {} ta.remove();
      }
      const lbl = $("span", copy);
      lbl.textContent = ok ? T("কপি হয়েছে ✓", "Copied ✓") : url;
      copy.classList.toggle("done", ok);
      API.trackShare(p.slug);
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
      <div class="post-meta"><span class="badge">${c.icon} ${esc(pick(c))}</span><span class="badge verified">✔ ${esc(p.source)}</span></div>
      <h1>${esc(pick(p.title))}</h1>
      <div class="byline"><span>${T("লেখক", "By")} <b>${esc(p.author)}</b></span><span>${formatDateTime(p.date)}</span><span>${T(`${minsTxt} মিনিটে পড়া`, `${minsTxt} min read`)}</span></div>
      ${p.image ? `<figure class="cover"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || pick(p.title))}" width="1200" height="675" decoding="async" fetchpriority="high">${p.imageAlt ? `<figcaption>${esc(p.imageAlt)}</figcaption>` : ""}</figure>` : ""}
      <div class="prose">${MD.render(bodyMd)}</div>
      <div class="src">${src}</div>
      <div class="share-bar" id="share-bar" role="group" aria-label="${T("শেয়ার করুন", "Share")}">
        <b class="share-title">${T("শেয়ার করুন", "Share this article")}</b>
        <div class="share-btns">
          <button type="button" class="share-btn share-native" data-native style="--c:#ff7522">${NATIVE_SVG}<span>${T("শেয়ার", "Share")}</span></button>
          ${Object.keys(SHARE).map((k) => `<a class="share-btn" data-share="${k}" target="_blank" rel="noopener noreferrer" style="--c:${SHARE[k].color}" aria-label="${SHARE[k].label}">${SHARE[k].svg}<span>${SHARE[k].label}</span></a>`).join("")}
          <button type="button" class="share-btn" data-copy style="--c:#0b8a4b">${COPY_SVG}<span>${T("লিংক কপি", "Copy link")}</span></button>
        </div>
      </div>
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

  /* Forms (mailto fallback — swap for Formspree/Netlify Forms later) */
  function wireForms() {
    const nl = $("#newsletter");
    if (nl) nl.onsubmit = (e) => {
      e.preventDefault();
      const v = $("input", nl).value;
      location.href = `mailto:hello@voiceofstartup.bd?subject=${encodeURIComponent("Newsletter signup")}&body=${encodeURIComponent("Please add me to the newsletter: " + v)}`;
    };
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
  });
})();
