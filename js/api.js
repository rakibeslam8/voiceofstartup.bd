/* Voice of Startup Bangladesh — public data layer.
   Plain fetch against the Supabase REST API with the public "anon" key. Row Level
   Security in the database guarantees visitors can only ever read LIVE posts
   (published + publish time passed) and can only add +1 to view/share counters. */
(function () {
  const C = window.VOSB || {};
  const S = C.supabase || {};
  const MD = window.VOSB_MD;
  const configured = !!(S.url && S.anonKey);
  const base = configured ? S.url.replace(/\/+$/, "") : "";

  const headers = (extra) => Object.assign({ apikey: S.anonKey, Authorization: "Bearer " + S.anonKey }, extra || {});
  const rest = (path, init) => fetch(base + "/rest/v1/" + path, Object.assign({ headers: headers() }, init || {}));

  const LIST_COLS = "id,slug,category,publish_at,updated_at,featured,title_bn,title_en,excerpt_bn,excerpt_en,source,source_url,author,image_url,image_alt,auto_translated_bn,auto_translated_en";

  /* DB row -> object the site renders */
  function normalize(r) {
    const bodyBn = r.body_bn || "";
    const bodyEn = r.body_en || "";
    const titleBn = r.title_bn || r.title_en || "";
    const titleEn = r.title_en || r.title_bn || "";
    const exBn = r.excerpt_bn || (MD ? MD.excerptFrom(bodyBn || bodyEn) : "");
    const exEn = r.excerpt_en || (MD ? MD.excerptFrom(bodyEn || bodyBn) : "");
    return {
      id: r.slug,
      uuid: r.id,
      slug: r.slug,
      cat: r.category,
      date: r.publish_at,
      updated: r.updated_at,
      featured: !!r.featured,
      source: r.source || "VOSB",
      sourceUrl: r.source_url || "",
      author: r.author || "VOSB Desk",
      image: r.image_url || "",
      imageAlt: r.image_alt || "",
      title: { bn: titleBn, en: titleEn },
      excerpt: { bn: exBn || exEn, en: exEn || exBn },
      bodyMd: { bn: bodyBn || bodyEn, en: bodyEn || bodyBn },
      views: r.views,
      shares: r.shares,
      autoBn: !!r.auto_translated_bn,
      autoEn: !!r.auto_translated_en,
    };
  }

  async function listPosts(limit) {
    if (!configured) return [];
    const res = await rest(`posts?select=${LIST_COLS}&order=publish_at.desc&limit=${limit || 200}`);
    if (!res.ok) throw new Error("posts " + res.status);
    return (await res.json()).map(normalize);
  }

  async function getPost(slug) {
    if (!configured || !/^[a-z0-9-]+$/.test(slug || "")) return null;
    const res = await rest(`posts?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    if (!res.ok) throw new Error("post " + res.status);
    const rows = await res.json();
    return rows.length ? normalize(rows[0]) : null;
  }

  function rpc(fn, body) {
    if (!configured) return Promise.resolve();
    return fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }

  /* Count one view per browser per article per 6 hours. Skips bots, local previews and the
     admin's own browser so the numbers reflect real readers. */
  function trackView(slug) {
    try {
      const isBot = navigator.webdriver || /bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent || "");
      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
      let isAdmin = false;
      try { isAdmin = !!localStorage.getItem("vosb-admin-auth"); } catch (e) {}
      if (!window.VOSB_FORCE_TRACK && (isBot || isLocal || isAdmin)) return Promise.resolve();
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem("vosb-seen") || "{}"); } catch (e) {}
      const now = Date.now();
      if (seen[slug] && now - seen[slug] < 6 * 3600 * 1000) return Promise.resolve();
      seen[slug] = now;
      for (const k of Object.keys(seen)) if (now - seen[k] > 48 * 3600 * 1000) delete seen[k];
      try { localStorage.setItem("vosb-seen", JSON.stringify(seen)); } catch (e) {}
    } catch (e) {}
    return rpc("increment_view", { p_slug: slug });
  }

  function trackShare(slug) { return rpc("increment_share", { p_slug: slug }); }

  /* ---------- site-wide visitor analytics (anonymous) ----------
     A random id kept in this browser tells us "unique visitors"; no name, email or IP is stored. */
  const rid = () => {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  };
  function skipTracking() {
    const isBot = navigator.webdriver || /bot|crawl|spider|headless|lighthouse|preview|facebookexternalhit|slurp/i.test(navigator.userAgent || "");
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    let isAdmin = false;
    try { isAdmin = !!localStorage.getItem("vosb-admin-auth"); } catch (e) {}
    return !window.VOSB_FORCE_TRACK && (isBot || isLocal || isAdmin);
  }
  function trackVisit(lang) {
    try {
      if (!configured || skipTracking()) return Promise.resolve();
      let visitor = "", isNew = false;
      try { visitor = localStorage.getItem("vosb-vid") || ""; if (!visitor) { visitor = rid(); isNew = true; localStorage.setItem("vosb-vid", visitor); } } catch (e) { visitor = rid(); }
      let sid = "", first = false;
      try { sid = sessionStorage.getItem("vosb-sid") || ""; if (!sid) { sid = rid(); first = true; sessionStorage.setItem("vosb-sid", sid); } } catch (e) { sid = rid(); first = true; }
      let ref = "";
      if (first && document.referrer) {
        try { const h = new URL(document.referrer).hostname.replace(/^www\./, "").toLowerCase(); if (h && h !== location.hostname.replace(/^www\./, "")) ref = h; } catch (e) {}
      }
      const ua = navigator.userAgent || "";
      const device = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet" : /Mobi|iPhone|iPod|Android/i.test(ua) ? "mobile" : "desktop";
      const path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "") || "/";
      return rpc("track_visit", { p_path: path, p_visitor: visitor, p_session: sid, p_referrer: ref, p_device: device, p_lang: lang === "en" ? "en" : "bn", p_new: isNew });
    } catch (e) { return Promise.resolve(); }
  }

  /* ---------- ads ---------- */
  const ADS_CACHE = "vosb-ads-cache";
  function cachedAds() { try { const c = JSON.parse(sessionStorage.getItem(ADS_CACHE) || "null"); return c && Array.isArray(c.a) ? c.a : []; } catch (e) { return []; } }
  async function listAds() {
    if (!configured) return [];
    const res = await rest("ads?select=id,placement,kind,image_url,link_url,headline,body,cta,lang,category,priority,freq_hours,start_at,end_at&order=priority.desc&limit=100");
    if (!res.ok) throw new Error("ads " + res.status);
    const rows = await res.json();
    try { sessionStorage.setItem(ADS_CACHE, JSON.stringify({ t: Date.now(), a: rows })); } catch (e) {}
    return rows;
  }
  const adImpression = (id) => (skipTracking() ? Promise.resolve() : rpc("ad_impression", { p_id: id }));
  const adClick = (id) => (skipTracking() ? Promise.resolve() : rpc("ad_click", { p_id: id }));

  window.VOSB_API = { configured, normalize, listPosts, getPost, trackView, trackShare, trackVisit, listAds, cachedAds, adImpression, adClick };
})();
