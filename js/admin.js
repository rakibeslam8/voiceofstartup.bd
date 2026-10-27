/* Voice of Startup Bangladesh — admin panel.
   Security model: this page is only a UI. All protection is enforced by the database
   (Supabase Row Level Security): only the admin account's token can read drafts or write.
   No password is stored anywhere in this repository. */
(function () {
  "use strict";
  const C = window.VOSB || {};
  const S = C.supabase || {};
  const MD = window.VOSB_MD;
  const app = document.getElementById("app");
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = MD.esc;
  const fmtN = (n) => Number(n || 0).toLocaleString("en-IN");
  /* Short form for big numbers, e.g. 1,234,567 -> "1.23M" (shown next to the exact figure, never instead of it) */
  const fmtC = (n) => { n = Number(n || 0); const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2) + "B" : a >= 1e6 ? (n / 1e6).toFixed(2) + "M" : (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K"; };
  /* Every stat tile: keep the exact number, add a short "≈ 1.23M" hint from 100,000 up, and shrink the digits
     so even 10-digit numbers fit a phone-sized tile without overflowing. */
  function fitTiles(root) {
    $$(".tile b", root).forEach((b) => {
      if (!b.dataset.fit) {
        b.dataset.fit = "1";
        const txt = b.textContent.trim(), m = /^[≈\s]*([\d,]+)$/.exec(txt);
        const n = m ? Number(m[1].replace(/,/g, "")) : NaN;
        if (n >= 100000) b.insertAdjacentHTML("afterend", `<em class="tile-hint">≈ ${fmtC(n)}</em>`);
      }
      b.style.fontSize = "";
      let size = parseFloat(getComputedStyle(b).fontSize);
      while (b.scrollWidth > b.clientWidth + 1 && size > 14) { size -= 1; b.style.fontSize = size + "px"; }
    });
  }
  /* Supabase returns at most 1,000 rows per request, so long lists are read page by page.
     make() must build a fresh query each time, e.g. () => sb.from("subscribers").select("*").order("id") */
  async function fetchAll(make) {
    const out = [];
    for (let from = 0; from < 200000; from += 1000) {
      const { data, error } = await make().range(from, from + 999);
      if (error) return { data: null, error };
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { data: out, error: null };
  }
  const ADMIN_EMAIL = ((C.admin && C.admin.userId) + "@" + (C.admin && C.admin.loginDomain)).toLowerCase();
  const STORE_FAIL = "vosb-admin-fail";
  const IDLE_MS = 30 * 60 * 1000;

  if (!S.url || !S.anonKey || !window.supabase) {
    app.innerHTML = `<div class="login-wrap"><div class="login"><h1>Not connected</h1><p class="sub">The database address is missing in <code>js/config.js</code>.</p></div></div>`;
    return;
  }

  const sb = window.supabase.createClient(S.url, S.anonKey, {
    auth: { storageKey: "vosb-admin-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const cats = C.categories;
  const catOf = (id) => cats.find((c) => c.id === id) || cats[0];
  const SOURCES = ["VOSB", ...C.sources.map((s) => s.short), "Other"];
  const liveUrl = (slug) => `${C.site.origin}/read/${slug}`;

  let session = null;
  let posts = [];
  let postsLoaded = false;
  let lastActive = Date.now();

  /* ---------------- helpers ---------------- */
  function toast(msg, kind) {
    $$(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function modal({ title, body, ok = "OK", cancel = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2><p>${esc(body)}</p>
        <div class="acts">${cancel ? `<button class="b b-line" data-x="0">${esc(cancel)}</button>` : ""}<button class="b ${danger ? "b-red" : "b-orange"}" data-x="1">${esc(ok)}</button></div></div>`;
      const done = (v) => { bg.remove(); document.removeEventListener("keydown", key); resolve(v); };
      const key = (e) => { if (e.key === "Escape") done(false); };
      bg.addEventListener("click", (e) => { if (e.target === bg) done(false); const b = e.target.closest("[data-x]"); if (b) done(b.dataset.x === "1"); });
      document.addEventListener("keydown", key);
      document.body.appendChild(bg);
      const first = $("[data-x='1']", bg); if (first) first.focus();
    });
  }

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {}
      ta.remove(); return ok;
    }
  };

  /* Bangladesh time (UTC+6, no DST) <-> <input type=datetime-local> */
  const DHAKA_MS = 6 * 3600 * 1000;
  const toLocalInput = (iso) => new Date(new Date(iso).getTime() + DHAKA_MS).toISOString().slice(0, 16);
  const fromLocalInput = (v) => new Date(v + ":00+06:00").toISOString();
  const nowLocalInput = () => toLocalInput(new Date().toISOString());
  const fmtDT = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  const fmtD = (iso) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric" });

  const stateOf = (p) => (p.status !== "published" ? "draft" : new Date(p.publish_at) > new Date() ? "sched" : "live");
  const pillOf = (p) => {
    const s = stateOf(p);
    return s === "live" ? `<span class="pill live">LIVE</span>` : s === "sched" ? `<span class="pill sched">SCHEDULED</span>` : `<span class="pill draft">DRAFT</span>`;
  };

  function slugify(t) {
    const s = String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "");
    return s;
  }
  const randSlug = () => "post-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  /* ---------------- images ---------------- */
  async function compress(file) {
    if (file.type === "image/gif" && file.size <= 5 * 1024 * 1024) return { blob: file, ext: "gif", type: "image/gif" };
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) { if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 5 * 1024 * 1024) return { blob: file, ext: file.type.split("/")[1].replace("jpeg", "jpg"), type: file.type }; throw new Error("Could not read this image"); }
    const max = 1600, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const toBlob = (t, q) => new Promise((r) => cv.toBlob(r, t, q));
    let blob = await toBlob("image/webp", 0.82), type = "image/webp", ext = "webp";
    if (!blob || blob.type !== "image/webp") { blob = await toBlob("image/jpeg", 0.84); type = "image/jpeg"; ext = "jpg"; }
    if (blob.size > 5 * 1024 * 1024) throw new Error("Image is still over 5 MB after compression");
    return { blob, ext, type };
  }

  async function uploadImage(file, folder) {
    const { blob, ext, type } = await compress(file);
    const d = new Date();
    const path = `${folder}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await sb.storage.from("post-images").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  }

  /* ---------------- data ---------------- */
  const LIST_COLS = "id,slug,category,status,publish_at,featured,title_bn,title_en,source,author,image_url,views,shares,updated_at";
  async function loadPosts(force) {
    if (postsLoaded && !force) return posts;
    const { data, error } = await fetchAll(() => sb.from("posts").select(LIST_COLS).order("publish_at", { ascending: false }).order("id"));
    if (error) throw error;
    posts = data || [];
    postsLoaded = true;
    return posts;
  }

  /* ---------------- auth ---------------- */
  function failState() { try { return JSON.parse(localStorage.getItem(STORE_FAIL) || "{}"); } catch (e) { return {}; } }
  function setFail(v) { try { localStorage.setItem(STORE_FAIL, JSON.stringify(v)); } catch (e) {} }

  function renderLogin(note) {
    app.innerHTML = `<div class="login-wrap"><form class="login" id="lf" autocomplete="on" novalidate>
      <img src="/assets/logo.png" alt="Voice of Startup Bangladesh" width="160" height="54">
      <h1>Admin Panel</h1>
      <p class="sub">Voice of Startup Bangladesh — authorised access only</p>
      <div id="lmsg">${note ? `<div class="msg info">${esc(note)}</div>` : ""}</div>
      <div class="fld"><label for="u">User ID</label><input class="inp" id="u" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
      <div class="fld"><label for="p">Password</label><div class="pw"><input class="inp" id="p" type="password" name="password" autocomplete="current-password" required><button type="button" class="b b-ghost b-sm" id="show">Show</button></div></div>
      <button class="b b-orange" style="width:100%" id="go" type="submit">Sign in</button>
      <p class="lock-note">🔒 Protected connection · Auto sign-out after 30 min idle</p>
    </form></div>`;
    $("#show").onclick = () => { const p = $("#p"); const h = p.type === "password"; p.type = h ? "text" : "password"; $("#show").textContent = h ? "Hide" : "Show"; };
    $("#lf").onsubmit = async (e) => {
      e.preventDefault();
      const msg = $("#lmsg");
      const f = failState();
      if (f.until && Date.now() < f.until) {
        msg.innerHTML = `<div class="msg err">Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} min.</div>`; return;
      }
      let id = $("#u").value.trim().toLowerCase();
      const pw = $("#p").value;
      if (!id || !pw) { msg.innerHTML = `<div class="msg err">Enter your User ID and password.</div>`; return; }
      const email = id.includes("@") ? id : `${id}@${C.admin.loginDomain}`;
      const btn = $("#go"); btn.disabled = true; btn.textContent = "Signing in…";
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error || !data.session) {
        const n = (f.n || 0) + 1;
        setFail(n >= 5 ? { n: 0, until: Date.now() + 5 * 60000 } : { n });
        msg.innerHTML = `<div class="msg err">${n >= 5 ? "Too many attempts. Locked for 5 minutes." : "Wrong User ID or password."}</div>`;
        btn.disabled = false; btn.textContent = "Sign in"; $("#p").value = ""; $("#p").focus();
        return;
      }
      if ((data.session.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        await sb.auth.signOut();
        msg.innerHTML = `<div class="msg err">This account is not an administrator.</div>`;
        btn.disabled = false; btn.textContent = "Sign in";
        return;
      }
      setFail({});
      session = data.session;
      start();
    };
    $("#u").focus();
  }

  async function logout(note) {
    try { await sb.auth.signOut(); } catch (e) {}
    session = null; posts = []; postsLoaded = false;
    renderLogin(note);
  }

  /* ---------------- shell & routing ---------------- */
  const IC = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    visitors: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.2M18 14.8c1.9.7 3.2 2.5 3.5 5.2"/>',
    posts: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M18 9h1.5A1.5 1.5 0 0 1 21 10.500V18a2 2 0 0 1-2 2h-1"/><path d="M8.500 8.500h6M8.500 12h6M8.500 15.500h4"/>',
    "edit/new": '<path d="M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17z"/><path d="m14.500 7.500 3 3"/>',
    ads: '<path d="M3.500 10v4a1 1 0 0 0 1 1H7l5.500 4V5L7 9H4.500a1 1 0 0 0-1 1z"/><path d="M16 9.200a4 4 0 0 1 0 5.600M18.500 6.700a7.500 7.500 0 0 1 0 10.600"/>',
    subscribers: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="m3.500 7.500 8.500 6 8.500-6"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.200"/><circle cx="9" cy="17" r="2.200"/>',
    out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    site: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  };
  const svg = (k, cls) => `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  const NAV = [
    { r: "dashboard", t: "Dashboard", s: "Home" },
    { r: "visitors", t: "Visitors" },
    { r: "posts", t: "Articles" },
    { r: "edit/new", t: "New article", s: "New" },
    { r: "ads", t: "Ads" },
    { r: "subscribers", t: "Subscribers", s: "Mail" },
    { r: "settings", t: "Settings" },
  ];
  let shellOn = false;
  function shell() {
    const email = session.user.email || "";
    const ini = (email.trim()[0] || "A").toUpperCase();
    app.innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <a class="brand" href="#/dashboard" aria-label="Dashboard"><img src="/assets/logo.png" alt="Voice of Startup Bangladesh" width="90" height="36"></a>
        <span class="tag">Admin</span>
        <nav class="tabs" id="tabs" aria-label="Admin">${NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}" title="${n.t}">${svg(n.r)}<span class="lbl">${n.t}</span></a>`).join("")}</nav>
        <span class="sp"></span>
        <a class="site-link" href="/" target="_blank" rel="noopener" title="Open the public website">${svg("site", "sm")}<span>View site</span></a>
        <div class="acct" id="acct">
          <button class="acct-btn" id="acctBtn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu"><span class="av">${esc(ini)}</span><svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="acct-menu" id="acctMenu" role="menu" hidden>
            <div class="acct-id"><span class="av lg">${esc(ini)}</span><div><b>Administrator</b><small title="${esc(email)}">${esc(email)}</small></div></div>
            <a role="menuitem" href="/" target="_blank" rel="noopener">${svg("site", "sm")}View website</a>
            <a role="menuitem" href="#/settings">${svg("settings", "sm")}Settings</a>
            <button role="menuitem" class="danger" id="out">${svg("out", "sm")}Sign out</button>
          </div>
        </div>
      </div></header>
      <main class="main" id="view"></main>
      <nav class="bottom-nav" id="bnav" aria-label="Admin">${NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${svg(n.r)}<em>${n.s || n.t}</em></a>`).join("")}</nav>`;
    const btn = $("#acctBtn"), menu = $("#acctMenu");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.onclick = (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#acct")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); } });
    $("#out").onclick = () => { close(); logout("You have been signed out."); };
    shellOn = true;
  }

  function markNav(r) {
    const base = r.startsWith("edit") ? "edit/new" : r.startsWith("ads") ? "ads" : r.startsWith("newsletter") ? "subscribers" : r;
    $$("[data-r]").forEach((a) => a.classList.toggle("on", a.dataset.r === base || (base === "edit/new" && a.dataset.r === "edit/new")));
  }

  async function router() {
    if (!session) return;
    if (!shellOn) shell();
    const h = (location.hash || "#/dashboard").replace(/^#\/?/, "") || "dashboard";
    const old = $("#view");
    const view = old.cloneNode(false);   // fresh container so event listeners never pile up
    old.replaceWith(view);
    window.scrollTo(0, 0);
    markNav(h);
    // every page: keep stat-tile numbers fitting (and add the short "≈ 1.2M" hint) whenever tiles are drawn
    try { let tm; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => fitTiles(view), 30); }).observe(view, { childList: true, subtree: true }); } catch (e) {}
    try {
      if (h === "dashboard") await viewDashboard(view);
      else if (h === "visitors") await viewVisitors(view);
      else if (h === "ads") await viewAds(view);
      else if (h === "subscribers") await viewSubscribers(view);
      else if (h === "newsletter" || h.startsWith("newsletter/")) await viewNewsletter(view, h.slice(11));
      else if (h.startsWith("ads/")) await viewAdEditor(view, h.slice(4));
      else if (h === "posts") await viewPosts(view);
      else if (h === "settings") viewSettings(view);
      else if (h.startsWith("edit/")) await viewEditor(view, h.slice(5));
      else { location.hash = "#/dashboard"; }
    } catch (e) {
      console.error(e);
      if (/JWT|expired|401/i.test(String(e.message || e))) { logout("Session expired. Please sign in again."); return; }
      view.innerHTML = `<div class="card"><div class="msg err">Something went wrong: ${esc(e.message || e)}</div><button class="b b-orange" onclick="location.reload()">Reload</button></div>`;
    }
  }

  /* ---------------- dashboard ---------------- */
  let daily = [];
  async function loadDaily() {
    const { data, error } = await sb.rpc("admin_daily_views", { p_days: 1095 });
    if (error) throw error;
    daily = (data || []).map((d) => ({ day: d.day, views: Number(d.views) }));
  }

  async function loadSite(days) {
    const { data, error } = await sb.rpc("admin_site_stats", { p_days: days });
    if (error) throw error;
    return data;
  }

  function chartSvg(rows, showTable) {
    if (showTable) {
      const vis = rows.length && rows[0].visitors !== undefined, rd = rows.length && rows[0].reads !== undefined;
      return `<table class="t"><thead><tr><th>${rows.length && rows[0].grouped ? "Period" : "Date"}</th><th class="n">${vis ? "Page views" : "Views"}</th>${vis ? `<th class="n">Visitors</th>` : ""}${rd ? `<th class="n">Article reads</th>` : ""}</tr></thead><tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(r.label || fmtD(r.day + "T12:00:00+06:00"))}</td><td class="n">${fmtN(r.views)}</td>${vis ? `<td class="n">${fmtN(r.visitors)}</td>` : ""}${rd ? `<td class="n">${fmtN(r.reads)}</td>` : ""}</tr>`).join("")}</tbody></table>`;
    }
    const W = 640, H = 220, L = 34, B = 26, T = 10, R = 6;
    const hasVis = rows.length && rows[0].visitors !== undefined;
    const max = Math.max(4, ...rows.map((r) => Math.max(r.views, r.visitors || 0)));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const iw = W - L - R, ih = H - T - B;
    const bw = iw / rows.length;
    const barW = Math.max(2, Math.min(22, bw - 3));
    let g = "";
    for (let v = 0; v <= top; v += step) {
      const y = T + ih - (v / top) * ih;
      g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
    }
    const every = rows.length > 80 ? 14 : rows.length > 40 ? 10 : rows.length > 14 ? 5 : 1;
    let bars = "", labs = "";
    rows.forEach((r, i) => {
      const x = L + i * bw + (bw - barW) / 2;
      const h = (r.views / top) * ih;
      const y = T + ih - h;
      bars += `<g data-i="${i}"><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${ih}"/>`
        + (r.views ? `<path class="bar" d="M${x},${T + ih} V${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, barW / 2)},${y} H${x + barW - Math.min(4, barW / 2)} Q${x + barW},${y} ${x + barW},${y + Math.min(4, h)} V${T + ih} Z"/>` : `<rect class="bar" x="${x}" y="${T + ih - 2}" width="${barW}" height="2" opacity=".35"/>`)
        + `</g>`;
      if (i % every === 0 || i === rows.length - 1) labs += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${r.axis || new Date(r.day + "T12:00:00+06:00").toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}</text>`;
    });
    let line = "";
    if (hasVis) {
      const pts = rows.map((r, i) => [L + i * bw + bw / 2, T + ih - (r.visitors / top) * ih]);
      line = `<path class="ln" d="M${pts.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" L")}"/>` + (rows.length <= 45 ? pts.map((q) => `<circle class="dot" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3"/>`).join("") : "");
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${hasVis ? "Daily page views and visitors" : "Daily article views"}">${g}${bars}${line}${labs}</svg>`;
  }
  /* ---------- date-range picker (7d / 30d / 90d / 1y / All / Custom) + long-range bucketing ---------- */
  const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5) + 1;
  const dLong = (iso) => fmtD(iso + "T12:00:00+06:00");
  const PRESETS = [["7", "7d"], ["30", "30d"], ["90", "90d"], ["365", "1 year"], ["all", "All"], ["custom", "Custom"]];
  function resolveRange(sel) {
    const to = dhakaToday();
    if (sel.mode === "custom") return { from: sel.from, to: sel.to };
    if (sel.mode === "all") return { from: null, to };
    return { from: addDays(to, -(+sel.mode - 1)), to };
  }
  function rangeLabel(sel, from, to) {
    if (sel.mode === "all") return "All time";
    if (sel.mode === "365") return "Last 12 months";
    if (sel.mode === "custom") return from === to ? dLong(from) : `${dLong(from)} → ${dLong(to)}`;
    return `Last ${sel.mode} days`;
  }
  function mountPicker(box, sel, onApply) {
    const paint = () => {
      const today = dhakaToday();
      box.innerHTML = `<div class="rangebar"><div class="range" id="rng">${PRESETS.map(([m, t]) => `<button data-m="${m}" class="${m === sel.mode ? "on" : ""}">${t}</button>`).join("")}</div>
        ${sel.mode === "custom" ? `<div class="range-custom"><label>From <input type="date" id="rc-f" value="${esc(sel.from)}" max="${today}"></label><label>To <input type="date" id="rc-t" value="${esc(sel.to)}" max="${today}"></label><button class="b b-orange b-sm" id="rc-go">Show</button></div>` : ""}</div>`;
      $("#rng", box).onclick = (e) => {
        const b = e.target.closest("[data-m]"); if (!b) return;
        sel.mode = b.dataset.m;
        if (sel.mode === "custom" && !sel.from) { sel.to = today; sel.from = addDays(today, -29); }
        paint(); onApply();
      };
      const go = $("#rc-go", box);
      if (go) go.onclick = () => {
        let f = $("#rc-f", box).value, t = $("#rc-t", box).value;
        if (!f || !t) return toast("Pick both dates", "err");
        if (f > t) [f, t] = [t, f];
        if (t > today) t = today;
        if (daysBetween(f, t) > 1095) return toast("Please choose up to 3 years at a time", "err");
        sel.from = f; sel.to = t; paint(); onApply();
      };
    };
    paint();
  }
  /* Long ranges are grouped (weekly up to ~13 months, monthly beyond) so the chart stays readable */
  function bucketRows(rows) {
    if (rows.length <= 92) return rows;
    const monthly = rows.length > 400, out = []; let cur = null;
    rows.forEach((r) => {
      let start;
      if (monthly) start = r.day.slice(0, 7) + "-01";
      else { const dow = (new Date(r.day + "T00:00:00Z").getUTCDay() + 6) % 7; start = addDays(r.day, -dow); if (start < rows[0].day) start = rows[0].day; }
      if (!cur || cur.key !== start) {
        const d = new Date(start + "T12:00:00+06:00");
        cur = { key: start, day: start, views: 0, visitors: r.visitors === undefined ? undefined : 0, reads: r.reads === undefined ? undefined : 0,
          label: monthly ? d.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", month: "long", year: "numeric" }) : "Week of " + dLong(start),
          axis: monthly ? d.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", month: "short", year: "2-digit" }) : null, grouped: true };
        out.push(cur);
      }
      cur.views += r.views; if (cur.visitors !== undefined) cur.visitors += r.visitors; if (cur.reads !== undefined) cur.reads += r.reads;
    });
    return out;
  }
  const isMissingFn = (e) => /could not find the function|PGRST202|42883|does not exist/i.test(String((e && (e.message || "")) + (e && e.code || "")));

  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

  async function viewDashboard(view) {
    view.innerHTML = `<div class="page-h"><h1>Dashboard</h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    let site = null, subs = null, subsNew = null;
    /* one exact server-side count (update-6 SQL); falls back to two plain counts if that update isn't installed yet */
    const loadSubs = async () => {
      try {
        const r = await sb.rpc("admin_subscriber_stats");
        if (!r.error && r.data) return { active: Number(r.data.active), new7: Number(r.data.new_7d) };
      } catch (e) {}
      try {
        const a = await sb.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active");
        const b = await sb.from("subscribers").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString());
        if (!a.error) return { active: a.count, new7: b.error ? 0 : b.count };
      } catch (e) {}
      return null;
    };
    await Promise.all([loadPosts(true), loadDaily(), loadSite(7).then((x) => { site = x; }).catch(() => {}),
      loadSubs().then((x) => { if (x) { subs = x.active; subsNew = x.new7; } })]);
    if (!view.isConnected) return;   // user navigated away while loading
    const total = posts.reduce((a, p) => a + Number(p.views || 0), 0);
    const shares = posts.reduce((a, p) => a + Number(p.shares || 0), 0);
    const live = posts.filter((p) => stateOf(p) === "live").length;
    const sched = posts.filter((p) => stateOf(p) === "sched").length;
    const drafts = posts.filter((p) => stateOf(p) === "draft").length;
    const today = daily.length ? daily[daily.length - 1].views : 0;
    const d7 = daily.slice(-7).reduce((a, r) => a + r.views, 0);
    const top = [...posts].sort((a, b) => b.views - a.views).filter((p) => p.views > 0).slice(0, 6);
    const sel = { mode: "30", from: "", to: "" };
    let table = false;

    view.innerHTML = `
      <div class="page-h"><h1>Dashboard</h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div>
      <h2 class="sec-h">Overall <span>all time</span></h2>
      <div class="tiles">
        ${site ? `<div class="tile g"><small>Total visitors</small><b>${fmtN(site.totals.visitors_all)}</b></div>
        <div class="tile"><small>Total page views</small><b>${fmtN(site.totals.views_all)}</b></div>` : ""}
        <div class="tile k"><small>Total article reads</small><b>${fmtN(total)}</b></div>
        <div class="tile r"><small>Total shares</small><b>${fmtN(shares)}</b></div>
        <div class="tile"><small>Total articles</small><b>${fmtN(posts.length)}</b></div>
        <div class="tile g"><small>Live articles</small><b>${fmtN(live)}</b></div>
        ${subs !== null ? `<a class="tile k" href="#/subscribers" style="text-decoration:none;color:inherit"><small>Newsletter subscribers</small><b>${fmtN(subs)}</b></a>` : ""}
        <div class="tile r"><small>Scheduled · Drafts</small><b>${fmtN(sched)} · ${fmtN(drafts)}</b></div>
      </div>
      <h2 class="sec-h">Recent activity <span>Bangladesh time</span></h2>
      <div class="tiles">
        ${site ? `<div class="tile g"><small>Online now</small><b>${fmtN(site.totals.online_now)}</b></div>
        <div class="tile"><small>Visitors today</small><b>${fmtN(site.totals.visitors_today)}</b></div>
        <div class="tile k"><small>Page views today</small><b>${fmtN(site.totals.views_today)}</b></div>` : ""}
        <div class="tile r"><small>Reads today</small><b>${fmtN(today)}</b></div>
        ${site ? `<div class="tile"><small>Visitors · 7 days</small><b>${site.exact && site.exact.visitors_7d === false ? "≈ " : ""}${fmtN(site.totals.visitors_7d)}</b></div>` : ""}
        <div class="tile g"><small>Reads · 7 days</small><b>${fmtN(d7)}</b></div>
        ${site ? `<div class="tile k"><small>Visitors · 30 days</small><b>${site.exact && site.exact.visitors_30d === false ? "≈ " : ""}${fmtN(site.totals.visitors_30d)}</b></div>` : ""}
        ${subs !== null ? `<a class="tile r" href="#/subscribers" style="text-decoration:none;color:inherit"><small>New subscribers · 7 days</small><b>${fmtN(subsNew || 0)}</b></a>` : ""}
      </div>
      <div class="dash-cols">
        <div class="card">
          <div class="chart-h"><h2>Daily reads</h2>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div id="rp"></div>
              <button class="link-btn" id="tv">Table view</button>
            </div></div>
          <p class="muted" id="rl" style="font-size:.85rem;margin:2px 0 6px"></p>
          <div class="chart" id="chart"></div>
          <p class="muted" style="font-size:.8rem;margin-top:8px">Counts one read per visitor per article per 6 hours. Everyone is counted, including your own visits and bots (see Visitors for the split). Bangladesh time.<span id="grp"></span></p>
        </div>
        <div class="card">
          <h2>Most read</h2>
          ${top.length ? `<div class="top-list">${top.map((p, i) => `<a class="top-item" href="#/edit/${p.id}"><span class="rank">${i + 1}</span><span class="tt">${esc(p.title_bn || p.title_en)}</span><span class="vv">${fmtN(p.views)}</span></a>`).join("")}</div>`
            : `<div class="empty"><b>No reads yet</b>Publish an article and share it — reads show up here.</div>`}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="chart-h"><h2>Latest articles</h2><a class="link-btn" href="#/posts">View all</a></div>
        ${posts.length ? `<div class="rows">${posts.slice(0, 5).map(rowHtml).join("")}</div>` : `<div class="empty"><b>No articles yet</b>Click “Write new article” to publish your first one.</div>`}
      </div>`;

    fitTiles(view);
    const draw = () => {
      let { from, to } = resolveRange(sel);
      if (!from) { const f = daily.find((d) => d.views > 0); from = f ? f.day : to; }
      const base = daily.filter((d) => d.day >= from && d.day <= to);
      const rows = bucketRows(base);
      $("#rl").textContent = `${rangeLabel(sel, from, to)} · ${fmtN(base.reduce((a, r) => a + r.views, 0))} reads`;
      $("#grp").textContent = rows.length !== base.length ? ` Long ranges are grouped by ${rows.length && rows[0].axis ? "month" : "week"}.` : "";
      $("#chart").innerHTML = chartSvg(rows, table);
      $("#tv").textContent = table ? "Chart view" : "Table view";
      if (!table) wireTip($("#chart"), rows);
    };
    mountPicker($("#rp"), sel, draw);
    $("#tv").onclick = () => { table = !table; draw(); };
    draw();
    wireRows(view);
  }

  function wireTip(box, rows) {
    let tip = null;
    const svg = $("svg", box);
    if (!svg) return;
    box.addEventListener("pointerleave", () => { if (tip) { tip.remove(); tip = null; } $$(".bar.hot", box).forEach((b) => b.classList.remove("hot")); });
    $$("g[data-i]", svg).forEach((g) => {
      const show = () => {
        const r = rows[+g.dataset.i];
        if (!tip) { tip = document.createElement("div"); tip.className = "tip"; box.appendChild(tip); }
        const dl = esc(r.label || fmtD(r.day + "T12:00:00+06:00"));
        tip.innerHTML = r.visitors !== undefined ? `${dl}<br><b>${fmtN(r.views)}</b> page views · <b>${fmtN(r.visitors)}</b> visitors${r.reads !== undefined ? ` · <b>${fmtN(r.reads)}</b> reads` : ""}` : `${dl}<br><b>${fmtN(r.views)}</b> reads`;
        const gb = g.getBoundingClientRect(), bb = box.getBoundingClientRect();
        tip.style.left = Math.min(Math.max(gb.left - bb.left + gb.width / 2, 50), bb.width - 50) + "px";
        tip.style.top = "6px";
        $$(".bar.hot", box).forEach((b) => b.classList.remove("hot"));
        const bar = $(".bar", g); if (bar) bar.classList.add("hot");
      };
      g.addEventListener("pointerenter", show);
      g.addEventListener("pointerdown", show);
    });
  }

  /* ---------------- posts list ---------------- */
  function rowHtml(p) {
    const c = catOf(p.category);
    const title = p.title_bn || p.title_en || "(untitled)";
    return `<div class="row" data-id="${p.id}">
      <div class="th">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : c.icon}</div>
      <div class="ti"><h3>${esc(title)}</h3>
        <div class="meta">${pillOf(p)}${p.featured ? `<span class="pill top">★ TOP</span>` : ""}<span>${esc(c.en)}</span><span>${esc(fmtDT(p.publish_at))}</span>
          <span>👁 <span class="stat">${fmtN(p.views)}</span></span><span>↗ <span class="stat">${fmtN(p.shares)}</span></span></div></div>
      <div class="acts">
        <a class="b b-line b-sm" href="#/edit/${p.id}">Edit</a>
        ${stateOf(p) === "live" ? `<a class="b b-line b-sm" href="${liveUrl(p.slug)}" target="_blank" rel="noopener">View ↗</a>` : ""}
        <button class="b b-line b-sm" data-a="copy" title="Copy link">🔗 Link</button>
        <button class="b b-line b-sm" data-a="toggle">${p.status === "published" ? "Unpublish" : "Publish"}</button>
        <button class="b b-line b-sm" data-a="dup">Duplicate</button>
        <button class="b b-sm" style="color:var(--red);border-color:var(--line);background:#fff" data-a="del">Delete</button>
      </div></div>`;
  }

  function wireRows(root) {
    root.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-a]");
      if (!btn) return;
      const id = btn.closest(".row").dataset.id;
      const p = posts.find((x) => x.id === id);
      if (!p) return;
      const a = btn.dataset.a;
      if (a === "copy") { toast((await copyText(liveUrl(p.slug))) ? "Link copied" : liveUrl(p.slug), "ok"); }
      if (a === "toggle") {
        btn.disabled = true;
        const next = p.status === "published" ? "draft" : "published";
        const patch = { status: next };
        if (next === "published" && new Date(p.publish_at) > new Date() && !(await modal({ title: "Publish scheduled article?", body: `It is scheduled for ${fmtDT(p.publish_at)}. It will go live at that time. Continue?`, ok: "Yes, keep schedule" }))) { btn.disabled = false; return; }
        const { error } = await sb.from("posts").update(patch).eq("id", id);
        if (error) { toast(error.message, "err"); btn.disabled = false; return; }
        toast(next === "published" ? "Published" : "Moved to drafts", "ok");
        await refreshList();
      }
      if (a === "dup") {
        const { data, error } = await sb.from("posts").select("*").eq("id", id).single();
        if (error) return toast(error.message, "err");
        const copy = Object.assign({}, data); delete copy.id; delete copy.views; delete copy.shares; delete copy.created_at; delete copy.updated_at;
        copy.status = "draft"; copy.featured = false; copy.slug = (data.slug.slice(0, 60) + "-copy-" + Math.random().toString(36).slice(2, 5));
        copy.publish_at = new Date().toISOString();
        const r = await sb.from("posts").insert(copy).select("id").single();
        if (r.error) return toast(r.error.message, "err");
        toast("Duplicated as draft", "ok");
        location.hash = "#/edit/" + r.data.id;
      }
      if (a === "del") {
        if (!(await modal({ title: "Delete article?", body: `“${p.title_bn || p.title_en}” and its view history will be permanently deleted.`, ok: "Delete", danger: true }))) return;
        const { error } = await sb.from("posts").delete().eq("id", id);
        if (error) return toast(error.message, "err");
        toast("Deleted", "ok");
        await refreshList();
      }
    });
  }
  async function refreshList() { await loadPosts(true); router(); }

  async function viewPosts(view) {
    view.innerHTML = `<div class="page-h"><h1>Articles</h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    await loadPosts(true);
    if (!view.isConnected) return;
    const f = { q: "", st: "all", cat: "all" };
    view.innerHTML = `
      <div class="page-h"><h1>Articles <span class="muted" style="font-size:1rem">(${posts.length})</span></h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div>
      <div class="filters">
        <input class="inp" id="q" type="search" placeholder="Search title…" aria-label="Search">
        <select class="sel" id="st" aria-label="Status"><option value="all">All status</option><option value="live">Live</option><option value="sched">Scheduled</option><option value="draft">Drafts</option></select>
        <select class="sel" id="ct" aria-label="Category"><option value="all">All categories</option>${cats.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.en)}</option>`).join("")}</select>
      </div>
      <div class="rows" id="rows"></div>`;
    const draw = () => {
      const q = f.q.toLowerCase();
      const items = posts.filter((p) => (f.st === "all" || stateOf(p) === f.st) && (f.cat === "all" || p.category === f.cat) && (!q || (p.title_bn + " " + p.title_en + " " + p.slug).toLowerCase().includes(q)));
      $("#rows").innerHTML = items.length ? items.map(rowHtml).join("") : `<div class="card empty"><b>${posts.length ? "No matching articles" : "No articles yet"}</b>${posts.length ? "Try a different search or filter." : "Click “Write new article” to publish your first one."}</div>`;
    };
    $("#q").oninput = (e) => { f.q = e.target.value; draw(); };
    $("#st").onchange = (e) => { f.st = e.target.value; draw(); };
    $("#ct").onchange = (e) => { f.cat = e.target.value; draw(); };
    draw();
    wireRows($("#rows"));
  }

  /* ---------------- editor ---------------- */
  const BLANK = () => ({
    id: null, slug: "", slugTouched: false, category: "funding", status: "draft", publish_at: nowLocalInput(), featured: false,
    title_bn: "", title_en: "", excerpt_bn: "", excerpt_en: "", body_bn: "", body_en: "",
    source: "VOSB", source_url: "", author: "VOSB Desk", image_url: "", image_alt: "",
    auto_translated_bn: false, auto_translated_en: false,
  });
  const FIELDS = ["category", "publish_at", "featured", "title_bn", "title_en", "excerpt_bn", "excerpt_en", "body_bn", "body_en", "source", "source_url", "author", "image_url", "image_alt", "slug"];

  async function viewEditor(view, idOrNew) {
    let ed = BLANK();
    const isNew = idOrNew === "new";
    const draftKey = "vosb-draft-" + (isNew ? "new" : idOrNew);
    let restored = false;
    if (!isNew) {
      view.innerHTML = `<div class="card"><p class="muted">Loading article…</p></div>`;
      const { data, error } = await sb.from("posts").select("*").eq("id", idOrNew).maybeSingle();
      if (error) throw error;
      if (!view.isConnected) return;
      if (!data) { view.innerHTML = `<div class="card empty"><b>Article not found</b><a class="b b-orange" href="#/posts">Back to articles</a></div>`; return; }
      ed = Object.assign(BLANK(), data, { publish_at: toLocalInput(data.publish_at), slugTouched: true, source_url: data.source_url || "", image_url: data.image_url || "" });
    }
    const original = JSON.stringify(pickFields(ed));
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const d = JSON.parse(raw); if (d && d.t && JSON.stringify(d.f) !== original) { Object.assign(ed, d.f); restored = true; } }
    } catch (e) {}

    const touched = { bn: false, en: false };      // language the editor typed in (so it is no longer "machine translated")
    let tab = ed.title_bn || !ed.title_en ? "bn" : "en";
    let mode = "write";
    let dirty = restored;
    let saving = false;

    view.innerHTML = `
      <div class="page-h"><h1>${isNew ? "New article" : "Edit article"}</h1><a class="b b-line" href="#/posts">← Articles</a></div>
      <div id="restore"></div>
      <div class="ed-grid">
        <div class="grid">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
              <div class="seg" id="lt" role="tablist" aria-label="Language"><button data-l="bn" role="tab">বাংলা</button><button data-l="en" role="tab">English</button></div>
              <span class="muted" style="font-size:.82rem">Write in Bangla <b>or</b> English — the other language and the short summary are created automatically when you publish.</span>
            </div>
            <div class="auto-row"><button type="button" class="b b-line b-sm" id="retr">🌐 Auto-translate this tab</button><span class="muted" id="auto-note" style="font-size:.82rem"></span></div>
            <div class="fld"><label for="f-title">Title <span class="hint" id="title-l"></span></label><input class="inp" id="f-title" maxlength="200"></div>
            <div class="fld"><label for="f-ex">Short summary <span class="hint">(shown on cards & Google — leave empty to auto-create)</span></label><textarea class="txt" id="f-ex" rows="2" maxlength="300"></textarea><div class="cnt" id="ex-c"></div></div>
            <div class="lbl" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><span>Article content</span>
              <div class="seg" id="md-m"><button data-m="write" class="on">Write</button><button data-m="preview">Preview</button></div></div>
            <div class="tb" id="tb">
              <button type="button" data-t="b" title="Bold"><b>B</b></button><button type="button" data-t="i" title="Italic"><i>I</i></button>
              <button type="button" data-t="h2" title="Heading">H2</button><button type="button" data-t="h3" title="Sub-heading">H3</button>
              <button type="button" data-t="ul" title="Bullet list">• List</button><button type="button" data-t="ol" title="Numbered list">1. List</button>
              <button type="button" data-t="q" title="Quote">❝</button><button type="button" data-t="link" title="Link">🔗</button>
              <button type="button" data-t="img" title="Insert image">🖼 Image</button><button type="button" data-t="hr" title="Divider">―</button>
            </div>
            <textarea class="txt body-txt" id="f-body" placeholder="Write your article here. Press Enter twice for a new paragraph." aria-label="Article content"></textarea>
            <div class="preview prose" id="pv" hidden></div>
            <div class="cnt" id="body-c"></div>
            <input type="file" id="body-file" accept="image/*" hidden>
          </div>
        </div>
        <aside class="ed-side">
          <div class="card savebar" id="savebar"></div>
          <div class="card">
            <h2>Cover image</h2>
            <div class="cover-box" id="cover"></div>
            <div class="fld" style="margin-top:12px;margin-bottom:0"><label for="f-alt">Image description <span class="hint">(for accessibility & SEO)</span></label><input class="inp" id="f-alt" maxlength="160"></div>
          </div>
          <div class="card">
            <h2>Details</h2>
            <div class="fld"><label for="f-cat">Topic</label><select class="sel" id="f-cat">${cats.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.en)} — ${esc(c.bn)}</option>`).join("")}</select></div>
            <div class="fld"><label for="f-date">Publish date & time <span class="hint">(Bangladesh time)</span></label>
              <input class="inp" id="f-date" type="datetime-local">
              <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="b b-line b-sm" id="now">Now</button><button type="button" class="b b-line b-sm" data-add="60">+1 hour</button><button type="button" class="b b-line b-sm" data-add="1440">Tomorrow</button></div>
              <span class="hint" id="date-h"></span></div>
            <div class="fld"><label for="f-src">Source</label><select class="sel" id="f-src">${SOURCES.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
            <div class="fld"><label for="f-srcu">Source link <span class="hint">(optional)</span></label><input class="inp" id="f-srcu" type="url" placeholder="https://…" inputmode="url"></div>
            <div class="fld"><label for="f-au">Author</label><input class="inp" id="f-au" maxlength="80"></div>
            <label class="chk"><input type="checkbox" id="f-feat"> ★ Show as top story on homepage</label>
          </div>
          <div class="card">
            <h2>Web address</h2>
            <div class="fld" style="margin-bottom:6px"><input class="inp" id="f-slug" maxlength="80" placeholder="auto-from-english-title" aria-label="Slug" autocapitalize="off"></div>
            <div class="slugline">Link: <code id="slug-url"></code></div>
          </div>
        </aside>
      </div>`;

    const $f = (id) => $("#" + id);
    const set = (k, v) => { ed[k] = v; dirty = true; persist(); };
    let persistTimer;
    const persist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(() => { if (!dirty) return; try { localStorage.setItem(draftKey, JSON.stringify({ t: Date.now(), f: pickFields(ed) })); } catch (e) {} }, 500); };

    function fillStatic() {
      if (ed.source && !SOURCES.includes(ed.source)) $f("f-src").insertAdjacentHTML("beforeend", `<option>${esc(ed.source)}</option>`);
      $f("f-cat").value = ed.category; $f("f-date").value = ed.publish_at; $f("f-src").value = ed.source || "VOSB";
      $f("f-srcu").value = ed.source_url; $f("f-au").value = ed.author; $f("f-feat").checked = ed.featured; $f("f-alt").value = ed.image_alt; $f("f-slug").value = ed.slug;
    }
    function fillLang() {
      $$("#lt button").forEach((b) => { b.classList.toggle("on", b.dataset.l === tab); b.classList.toggle("has", !!(ed["title_" + b.dataset.l] || ed["body_" + b.dataset.l])); b.setAttribute("aria-selected", b.dataset.l === tab); });
      $f("f-title").value = ed["title_" + tab]; $f("f-ex").value = ed["excerpt_" + tab]; $f("f-body").value = ed["body_" + tab];
      $f("title-l").textContent = tab === "bn" ? "(বাংলা)" : "(English)";
      autoNote();
      $f("f-title").placeholder = tab === "bn" ? "আর্টিকেলের শিরোনাম" : "Article headline";
      counts(); renderPv();
    }
    function counts() {
      $f("ex-c").textContent = `${$f("f-ex").value.length}/300`;
      const w = MD.toText($f("f-body").value).split(/\s+/).filter(Boolean).length;
      $f("body-c").textContent = `${w} words · ~${MD.readingMinutes($f("f-body").value)} min read`;
    }
    function renderPv() { if (mode === "preview") $f("pv").innerHTML = $f("f-body").value.trim() ? MD.render($f("f-body").value) : `<p class="muted">Nothing to preview yet.</p>`; }
    function slugUrl() { $f("slug-url").textContent = `${C.site.origin}/read/${ed.slug || "…"}`; }
    function dateHint() {
      const v = $f("f-date").value; const future = v && fromLocalInput(v) > new Date().toISOString();
      $f("date-h").textContent = future ? "⏰ Future date — the article will appear automatically at this time." : "Past or present date — the article shows immediately when published.";
    }
    function cover() {
      const box = $f("cover");
      box.innerHTML = ed.image_url
        ? `<img src="${esc(ed.image_url)}" alt="Cover preview"><div class="row-b"><button type="button" class="b b-line b-sm" id="c-pick">Replace</button><button type="button" class="b b-line b-sm" id="c-del">Remove</button></div>`
        : `<p class="muted" style="margin-bottom:10px">Drag a photo here, or choose one.<br><small>JPG, PNG, WebP · auto-optimised</small></p><button type="button" class="b b-orange b-sm" id="c-pick">📷 Choose image</button><p style="margin-top:8px"><button type="button" class="link-btn" id="c-url" style="font-size:.85rem">or paste an image link</button></p>`;
      box.insertAdjacentHTML("beforeend", `<div class="prog" id="prog" hidden><i></i></div><input type="file" id="c-file" accept="image/*" hidden>`);
      $("#c-pick", box).onclick = () => $("#c-file").click();
      const del = $("#c-del", box); if (del) del.onclick = () => { set("image_url", ""); cover(); };
      const u = $("#c-url", box); if (u) u.onclick = () => { const v = prompt("Paste image link (https://…)"); if (v && /^https:\/\//i.test(v.trim())) { set("image_url", v.trim()); cover(); } else if (v) toast("Link must start with https://", "err"); };
      $("#c-file").onchange = (e) => { const f = e.target.files[0]; if (f) upload(f, "cover"); };
    }
    function saveBar() {
      const future = ed.publish_at && fromLocalInput(ed.publish_at) > new Date().toISOString();
      const isLive = ed.status === "published";
      const sb2 = $f("savebar");
      sb2.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>Status:</b> ${!ed.id ? `<span class="pill draft">NEW</span>` : pillOf({ status: ed.status, publish_at: fromLocalInput(ed.publish_at) })}${dirty ? `<span class="muted" style="font-size:.8rem">· unsaved changes</span>` : ""}</div>
        <button class="b b-green" id="pub" ${saving ? "disabled" : ""}>${isLive ? (future ? "⏰ Update (scheduled)" : "✅ Update live article") : future ? "⏰ Schedule article" : "🚀 Publish now"}</button>
        <button class="b b-line" id="draft" ${saving ? "disabled" : ""}>${isLive ? "Unpublish → save as draft" : "💾 Save draft"}</button>
        ${ed.id ? `<button class="b b-line b-sm" id="prev-live" ${isLive ? "" : "disabled"}>${isLive ? "Open live page ↗" : "Open live page (after publish)"}</button>` : ""}`;
      $("#pub").onclick = () => save("published");
      $("#draft").onclick = () => save("draft");
      const pl = $("#prev-live"); if (pl && isLive) pl.onclick = () => window.open(liveUrl(ed.slug), "_blank", "noopener");
    }

    /* bindings */
    $("#lt").onclick = (e) => { const b = e.target.closest("[data-l]"); if (b) { tab = b.dataset.l; fillLang(); } };
    $f("f-title").oninput = (e) => {
      set("title_" + tab, e.target.value); touched[tab] = true;
      if (!ed.slugTouched && tab === "en") { ed.slug = slugify(ed.title_en); $f("f-slug").value = ed.slug; slugUrl(); }
      fillLangTabsOnly(); saveBar();
    };
    function fillLangTabsOnly() { $$("#lt button").forEach((b) => b.classList.toggle("has", !!(ed["title_" + b.dataset.l] || ed["body_" + b.dataset.l]))); }
    $f("f-ex").oninput = (e) => { set("excerpt_" + tab, e.target.value); touched[tab] = true; counts(); };
    $f("f-body").oninput = (e) => { set("body_" + tab, e.target.value); touched[tab] = true; counts(); fillLangTabsOnly(); saveBar(); };
    $f("f-cat").onchange = (e) => set("category", e.target.value);
    $f("f-date").oninput = (e) => { set("publish_at", e.target.value); dateHint(); saveBar(); };
    $f("now").onclick = () => { set("publish_at", nowLocalInput()); $f("f-date").value = ed.publish_at; dateHint(); saveBar(); };
    $$("[data-add]").forEach((b) => (b.onclick = () => { const d = new Date(Date.now() + (+b.dataset.add) * 60000).toISOString(); set("publish_at", toLocalInput(d)); $f("f-date").value = ed.publish_at; dateHint(); saveBar(); }));
    $f("f-src").onchange = (e) => set("source", e.target.value);
    $f("f-srcu").oninput = (e) => set("source_url", e.target.value.trim());
    $f("f-au").oninput = (e) => set("author", e.target.value);
    $f("f-feat").onchange = (e) => set("featured", e.target.checked);
    $f("f-alt").oninput = (e) => set("image_alt", e.target.value);
    $f("f-slug").oninput = (e) => { ed.slugTouched = true; set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-")); slugUrl(); };
    $f("f-slug").onblur = () => { ed.slug = ed.slug.replace(/^-+|-+$/g, ""); $f("f-slug").value = ed.slug; slugUrl(); };
    $("#md-m").onclick = (e) => {
      const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m;
      $$("#md-m button").forEach((x) => x.classList.toggle("on", x === b));
      $f("f-body").hidden = mode === "preview"; $f("pv").hidden = mode !== "preview"; $f("tb").style.display = mode === "preview" ? "none" : ""; renderPv();
    };

    /* toolbar */
    const ta = $f("f-body");
    function wrap(a, b, ph) {
      const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e) || ph;
      ta.value = v.slice(0, s) + a + sel + b + v.slice(e);
      ta.focus(); ta.setSelectionRange(s + a.length, s + a.length + sel.length); ta.dispatchEvent(new Event("input"));
    }
    function linePrefix(p, ph) {
      const s = ta.selectionStart, v = ta.value, ls = v.lastIndexOf("\n", s - 1) + 1;
      let le = v.indexOf("\n", ta.selectionEnd); if (le < 0) le = v.length;
      const block = v.slice(ls, le) || ph;
      const out = block.split("\n").map((l, i) => (typeof p === "function" ? p(i) : p) + l).join("\n");
      ta.value = v.slice(0, ls) + out + v.slice(le);
      ta.focus(); ta.setSelectionRange(ls, ls + out.length); ta.dispatchEvent(new Event("input"));
    }
    $f("tb").onclick = (e) => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      const t = b.dataset.t;
      if (t === "b") wrap("**", "**", "bold text");
      else if (t === "i") wrap("*", "*", "italic text");
      else if (t === "h2") linePrefix("## ", "Heading");
      else if (t === "h3") linePrefix("### ", "Sub-heading");
      else if (t === "ul") linePrefix("- ", "List item");
      else if (t === "ol") linePrefix((i) => `${i + 1}. `, "List item");
      else if (t === "q") linePrefix("> ", "Quote");
      else if (t === "hr") wrap("\n\n---\n\n", "", "");
      else if (t === "link") { const u = prompt("Link address (https://…)"); if (u && /^(https?:\/\/|mailto:)/i.test(u.trim())) wrap("[", `](${u.trim()})`, "link text"); else if (u) toast("Link must start with https://", "err"); }
      else if (t === "img") $f("body-file").click();
    };
    $f("body-file").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) upload(f, "body"); };

    /* image upload (compress in the browser, then store in Supabase Storage) */
    async function upload(file, where) {
      if (!/^image\//.test(file.type)) return toast("Please choose an image file", "err");
      const prog = $("#prog"); if (prog && where === "cover") { prog.hidden = false; $("i", prog).style.width = "30%"; }
      try {
        toast("Optimising & uploading image…");
        const { blob, ext, type } = await compress(file);
        if (prog) $("i", prog).style.width = "65%";
        const d = new Date();
        const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await sb.storage.from("post-images").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const url = sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
        if (where === "cover") { set("image_url", url); if (!ed.image_alt && ed["title_" + tab]) { /* leave alt for the editor to write */ } cover(); }
        else { const alt = prompt("Describe this image (short):", "") || ""; const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + `\n\n![${alt.replace(/[\]\[()]/g, "")}](${url})\n\n` + ta.value.slice(s); ta.dispatchEvent(new Event("input")); }
        toast("Image uploaded", "ok");
      } catch (e) { toast("Upload failed: " + (e.message || e), "err"); if (prog) prog.hidden = true; }
    }
    const cb = $f("cover");
    ["dragenter", "dragover"].forEach((n) => cb.addEventListener(n, (e) => { e.preventDefault(); cb.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((n) => cb.addEventListener(n, (e) => { e.preventDefault(); cb.classList.remove("drag"); }));
    cb.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) upload(f, "cover"); });

    /* ---- automatic translation + summary ---- */
    const TR = window.VOSB_TR;
    const LN = { bn: "Bangla", en: "English" };
    function autoNote() {
      const n = $f("auto-note"); if (!n) return;
      const flagged = ed["auto_translated_" + tab] && !touched[tab];
      n.textContent = flagged ? `This ${LN[tab]} version was machine-translated — please check it.` : "";
    }
    async function autoFill() {
      const out = { done: [], failed: false };
      const flags = { bn: !!ed.auto_translated_bn && !touched.bn, en: !!ed.auto_translated_en && !touched.en };
      for (const to of ["bn", "en"]) {
        const from = to === "bn" ? "en" : "bn";
        const needT = !ed["title_" + to].trim() && ed["title_" + from].trim();
        const needB = !ed["body_" + to].trim() && ed["body_" + from].trim();
        let gen = false;
        if ((needT || needB) && TR) {
          try {
            if (needT) ed["title_" + to] = await TR.title(ed["title_" + from], from, to);
            if (needB) ed["body_" + to] = await TR.markdown(ed["body_" + from], from, to);
            gen = true; out.done.push(to);
          } catch (e) { out.failed = true; }
        }
        if (gen) flags[to] = true;
        if (!ed["excerpt_" + to].trim()) {
          const fromEx = ed["excerpt_" + from].trim();
          if (gen && fromEx && TR) { try { ed["excerpt_" + to] = (await TR.title(fromEx, from, to)).slice(0, 300); } catch (e) {} }
          if (!ed["excerpt_" + to].trim() && ed["body_" + to].trim()) ed["excerpt_" + to] = MD.excerptFrom(ed["body_" + to]);
        }
      }
      ed.auto_translated_bn = flags.bn; ed.auto_translated_en = flags.en;
      return out;
    }
    $f("retr").onclick = async () => {
      const from = tab === "bn" ? "en" : "bn";
      if (!TR) return toast("Translator not loaded", "err");
      if (!(ed["title_" + from].trim() || ed["body_" + from].trim())) return toast(`Write the ${LN[from]} version first`, "err");
      if ((ed["title_" + tab].trim() || ed["body_" + tab].trim()) && !(await modal({ title: `Replace the ${LN[tab]} text?`, body: `The ${LN[tab]} title, summary and content will be replaced by an automatic translation of the ${LN[from]} version.`, ok: "Translate & replace" }))) return;
      const btn = $f("retr"); btn.disabled = true; btn.textContent = "Translating…";
      try {
        if (ed["title_" + from].trim()) ed["title_" + tab] = await TR.title(ed["title_" + from], from, tab);
        if (ed["body_" + from].trim()) ed["body_" + tab] = await TR.markdown(ed["body_" + from], from, tab);
        ed["excerpt_" + tab] = ed["excerpt_" + from].trim() ? (await TR.title(ed["excerpt_" + from], from, tab)).slice(0, 400) : MD.excerptFrom(ed["body_" + tab]);
        ed["auto_translated_" + tab] = true; touched[tab] = false; dirty = true; persist();
        fillLang(); saveBar(); autoNote(); toast("Translated — please read it once", "ok");
      } catch (e) { toast("Translation service is unavailable right now. Try again in a minute.", "err"); }
      btn.disabled = false; btn.textContent = "🌐 Auto-translate this tab";
    };

    /* save */
    async function save(status) {
      if (saving) return;
      const t = ed.title_bn.trim() || ed.title_en.trim();
      if (!t) return toast("Please write a title first", "err");
      if (status === "published" && !(ed.body_bn.trim() || ed.body_en.trim())) return toast("Add some article content before publishing", "err");
      if (!ed.publish_at) return toast("Choose a publish date & time", "err");
      let slug = (ed.slug || "").replace(/^-+|-+$/g, "");
      const autoSlug = !slug;   // no address typed: build a readable one from the English title (after translation)
      if (!slug) slug = slugify(ed.title_en) || "";
      if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return toast("Web address can use only a–z, 0–9 and hyphens", "err");
      if (ed.source_url && !/^https?:\/\//i.test(ed.source_url)) return toast("Source link must start with https://", "err");
      saving = true; saveBar();
      let tr = { done: [], failed: false };
      if (!(ed.title_bn.trim() && ed.title_en.trim() && ed.body_bn.trim() && ed.body_en.trim() && ed.excerpt_bn.trim() && ed.excerpt_en.trim())) {
        toast("Creating the other language & summary…");
        tr = await autoFill();
        fillLang();
      } else { ed.auto_translated_bn = ed.auto_translated_bn && !touched.bn; ed.auto_translated_en = ed.auto_translated_en && !touched.en; }
      if (autoSlug && !slug) {
        slug = slugify(ed.title_en);
        if (!slug) slug = randSlug();
        if (postsLoaded && posts.some((x) => x.slug === slug && x.id !== ed.id)) slug += "-" + Math.random().toString(36).slice(2, 5);
      }
      ed.slug = slug; $f("f-slug").value = slug; slugUrl();
      const row = {
        slug, category: ed.category, status, publish_at: fromLocalInput(ed.publish_at), featured: ed.featured,
        title_bn: ed.title_bn.trim(), title_en: ed.title_en.trim(), excerpt_bn: ed.excerpt_bn.trim(), excerpt_en: ed.excerpt_en.trim(),
        body_bn: ed.body_bn, body_en: ed.body_en,
        source: ed.source === "Other" ? "Other" : ed.source, source_url: ed.source_url || null, author: ed.author.trim() || "VOSB Desk",
        image_url: ed.image_url || null, image_alt: ed.image_alt.trim(),
        auto_translated_bn: !!ed.auto_translated_bn, auto_translated_en: !!ed.auto_translated_en,
      };
      let res;
      try {
        res = ed.id ? await sb.from("posts").update(row).eq("id", ed.id).select("id,slug,status,publish_at").single()
                    : await sb.from("posts").insert(row).select("id,slug,status,publish_at").single();
      } catch (e) { res = { error: e }; }
      saving = false;
      if (res.error) {
        const m = res.error.code === "23505" ? "That web address is already used by another article. Change the address below." : (res.error.message || String(res.error));
        saveBar(); return toast(m, "err");
      }
      ed.id = res.data.id; ed.status = status; dirty = false; clearTimeout(persistTimer);
      try { localStorage.removeItem(draftKey); localStorage.removeItem("vosb-draft-new"); } catch (e) {}
      postsLoaded = false;
      if (tr.failed) toast("Saved, but automatic translation was unavailable — the article shows in the language you wrote. Use “Auto-translate” later.", "err");
      else if (tr.done.length) toast(`${tr.done.map((l) => LN[l]).join(" & ")} version created automatically`, "ok");
      if (status === "published") showDone(res.data); else { toast("Draft saved", "ok"); saveBar(); if (isNew && location.hash !== "#/edit/" + ed.id) history.replaceState(null, "", "#/edit/" + ed.id); }
    }
    function showDone(r) {
      const future = new Date(r.publish_at) > new Date();
      const url = liveUrl(r.slug), e = encodeURIComponent;
      const bg = document.createElement("div"); bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal done-box" role="dialog" aria-modal="true"><div class="big">${future ? "⏰" : "🎉"}</div>
        <h2>${future ? "Scheduled!" : "Published!"}</h2>
        <p>${future ? `It will appear on the website at <b>${esc(fmtDT(r.publish_at))}</b>.` : "Your article is live on the website now."}</p>
        <div class="url">${esc(url)}</div>
        <div class="share-row">
          <button class="b b-line b-sm" id="dn-copy">🔗 Copy link</button>
          <a class="b b-line b-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${e(url)}">WhatsApp</a>
          <a class="b b-line b-sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${e(url)}">Facebook</a>
          <a class="b b-line b-sm" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}">LinkedIn</a>
        </div>
        <div class="acts" style="justify-content:center">
          ${future ? "" : `<a class="b b-green" target="_blank" rel="noopener" href="${esc(url)}">Open article ↗</a>`}
          <button class="b b-line" id="dn-ed">Keep editing</button>
          <a class="b b-orange" href="#/posts" id="dn-list">All articles</a>
        </div></div>`;
      document.body.appendChild(bg);
      $("#dn-copy", bg).onclick = async () => toast((await copyText(url)) ? "Link copied" : url, "ok");
      $("#dn-ed", bg).onclick = () => { bg.remove(); saveBar(); if (isNew) history.replaceState(null, "", "#/edit/" + ed.id); };
      $("#dn-list", bg).onclick = () => bg.remove();
      bg.addEventListener("click", (e2) => { if (e2.target === bg) { bg.remove(); saveBar(); } });
    }

    window.onbeforeunload = () => (dirty ? "Unsaved changes" : undefined);
    window.addEventListener("hashchange", () => { window.onbeforeunload = null; }, { once: true });

    fillStatic(); fillLang(); cover(); slugUrl(); dateHint(); saveBar(); autoNote();
    if (restored) {
      $("#restore").innerHTML = `<div class="msg info">Restored your unsaved changes from this device. <button class="link-btn" id="discard">Discard them</button></div>`;
      $("#discard").onclick = () => { try { localStorage.removeItem(draftKey); } catch (e) {} dirty = false; window.onbeforeunload = null; router(); };
    }
  }
  function pickFields(ed) { const o = {}; FIELDS.forEach((k) => (o[k] = ed[k])); return o; }

  /* ---------------- visitors / site analytics ---------------- */
  const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);
  function barList(items, valueKey, labelFn, emptyMsg) {
    if (!items || !items.length) return `<div class="empty"><b>No data yet</b>${esc(emptyMsg || "Numbers appear after the first visits.")}</div>`;
    const total = items.reduce((a, x) => a + Number(x[valueKey] || 0), 0);
    const max = Math.max(...items.map((x) => Number(x[valueKey] || 0)), 1);
    return `<div class="bl">${items.map((x) => `<div class="bl-r"><div class="bl-t"><span class="bl-l">${labelFn(x)}</span><b>${fmtN(x[valueKey])} <small>${pct(Number(x[valueKey]), total)}%</small></b></div><div class="bl-b"><i style="width:${Math.max(2, (Number(x[valueKey]) / max) * 100)}%"></i></div></div>`).join("")}</div>`;
  }
  function pageLabel(path) {
    const m = /^\/read\/([a-z0-9-]+)$/.exec(path);
    if (m) { const p = posts.find((x) => x.slug === m[1]); return p ? `📰 ${esc((p.title_bn || p.title_en || m[1]).slice(0, 70))}` : `📰 ${esc(path)}`; }
    if (path === "/") return "🏠 Home";
    const c = cats.find((x) => "/" + x.slug === path);
    if (c) return `${c.icon} ${esc(c.en)}`;
    const names = { "/news": "📰 News", "/about": "ℹ️ About", "/contact": "✉️ Contact", "/careers": "💼 Careers" };
    return esc(names[path] || path);
  }

  /* Who is behind the numbers: real readers, the owner (this admin browser) and bots */
  function kindsCard(k) {
    const names = { human: ["👥 Real readers", "People on their own browsers"], owner: ["🧑‍💻 You (owner)", "Browsers signed in to this admin panel"], bot: ["🤖 Bots & crawlers", "Search engines, link previews, automated tools"] };
    const v = {}, r = {};
    (k.visits || []).forEach((x) => (v[x.kind] = x));
    (k.reads || []).forEach((x) => (r[x.kind] = x));
    const row = (id) => `<div class="tile"><small>${names[id][0]}</small><b>${fmtN(v[id] ? v[id].visitors : 0)}</b><span class="muted" style="font-size:.78rem">visitors · ${fmtN(v[id] ? v[id].views : 0)} page views · ${fmtN(r[id] ? r[id].reads : 0)} article reads</span></div>`;
    return `<div class="card" style="margin-top:16px"><h2>Who is visiting</h2>
      <div class="tiles">${row("human")}${row("owner")}${row("bot")}</div>
      <p class="muted" style="font-size:.8rem;margin-top:8px">The totals above include all three. Article view numbers shown to the public count real readers and you, not bots. Owner and bot visits were only counted from 26 Oct 2026; earlier ones were never sent to the database, so they cannot be recovered. Visits recorded before that are all shown as real readers — use the review below to relabel the ones that were really you or a bot.</p>
      <div class="rv-box" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="b b-line b-sm" id="rv-mine">🧑‍💻 Mark this browser’s past visits as mine</button>
        <button class="b b-line b-sm" id="rv-load">🔎 Review most active visitors</button>
      </div>
      <div id="rv-list" style="margin-top:10px"></div></div>`;
  }

  async function viewVisitors(view) {
    view.innerHTML = `<div class="page-h"><h1>Visitors</h1></div><div class="card"><p class="muted">Loading…</p></div>`;
    await loadPosts(true);
    const sel = { mode: "30", from: "", to: "" };
    let table = false, stats = null, legacy = false, subsNew = null, kinds = null;
    const load = async () => {
      const r = resolveRange(sel);
      subsNew = null;
      if (!legacy) {
        const { data, error, status } = await sb.rpc("admin_site_stats_range", { p_from: r.from, p_to: r.to });
        if (!error) {
          stats = data;
          const q = sb.from("subscribers").select("id", { count: "exact", head: true }).gte("created_at", new Date(data.from + "T00:00:00+06:00").toISOString()).lt("created_at", new Date(addDays(data.to, 1) + "T00:00:00+06:00").toISOString());
          try { const x = await q; if (!x.error) subsNew = x.count; } catch (e) {}
          kinds = null;
          try { const k = await sb.rpc("admin_site_kinds", { p_from: r.from, p_to: r.to }); if (!k.error) kinds = k.data; } catch (e) {}
          return;
        }
        if (!isMissingFn(error) && status !== 404) throw error;
        legacy = true;
      }
      /* The range function isn't installed yet: fall back to the older 7/30/90/365-day report */
      if (sel.mode === "custom" || sel.mode === "all") { sel.mode = "365"; toast("Custom dates and “All” need the update-4 SQL — showing the last 12 months for now.", "err"); }
      const days = +sel.mode, o = await loadSite(days), t = o.totals || {};
      stats = Object.assign({}, o, {
        from: addDays(dhakaToday(), -(days - 1)), to: dhakaToday(), legacy: true, top_articles: [],
        range: { views: o.daily.reduce((a, d) => a + Number(d.views), 0), visitors: days === 7 ? t.visitors_7d : days === 30 ? t.visitors_30d : null, sessions: null, article_reads: null },
        totals: Object.assign({}, t, { reads_today: null }),
      });
    };
    await load();
    if (!view.isConnected) return;
    const catViews = cats.map((c) => ({ c, v: posts.filter((p) => p.category === c.id).reduce((a, p) => a + Number(p.views || 0), 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const dash = (n) => (n === null || n === undefined ? "—" : fmtN(n));
    const reload = async () => {
      view.style.opacity = ".55";
      try { await load(); } catch (err) { view.style.opacity = ""; return toast(err.message, "err"); }
      view.style.opacity = "";
      if (view.isConnected) draw();
    };

    const draw = () => {
      const t = stats.totals, R = stats.range, nDays = daysBetween(stats.from, stats.to);
      const devName = { mobile: "📱 Mobile", desktop: "💻 Desktop", tablet: "📲 Tablet" };
      const allRows = stats.daily.map((d) => ({ day: d.day, views: Number(d.views), visitors: Number(d.visitors), reads: d.reads === undefined ? undefined : Number(d.reads) }));
      const rows = bucketRows(allRows);
      const busiest = allRows.reduce((m, r) => (r.views > (m ? m.views : 0) ? r : m), null);
      const label = rangeLabel(sel, stats.from, stats.to);
      const ex = stats.exact || {}, apV = ex.visitors === false ? "≈ " : "", apS = ex.sessions === false ? "≈ " : "", apB = ex.breakdowns === false;
      const anyApprox = ex.visitors === false || ex.sessions === false || apB;
      view.innerHTML = `
      <div class="page-h"><h1>Visitors</h1><div id="rp"></div></div>
      <p class="period-line"><b>${esc(label)}</b> <span class="muted">${sel.mode === "custom" ? "" : `· ${esc(dLong(stats.from))} → ${esc(dLong(stats.to))} `}· ${fmtN(nDays)} day${nDays === 1 ? "" : "s"}</span>
        <button class="link-btn" id="csv" style="margin-left:8px">⬇ Export CSV</button></p>
      ${stats.legacy ? `<div class="msg err" style="margin-bottom:14px">Custom dates, “All”, and article reads per period need one small database update. Open Supabase → SQL Editor, paste <b>supabase/update-4-range-import.sql</b> from the website repository and press Run. Until then you can use 7d / 30d / 90d / 1 year.</div>` : ""}
      <div class="tiles">
        <div class="tile g"><small>Online now (last 5 min)</small><b>${fmtN(t.online_now)}</b></div>
        <div class="tile"><small>Visitors today</small><b>${fmtN(t.visitors_today)}</b></div>
        <div class="tile k"><small>Page views today</small><b>${fmtN(t.views_today)}</b></div>
        <div class="tile r"><small>Article reads today</small><b>${dash(t.reads_today)}</b></div>
        <div class="tile g"><small>Visitors · this period</small><b>${apV}${dash(R.visitors)}</b></div>
        <div class="tile"><small>Page views · this period</small><b>${dash(R.views)}</b></div>
        <div class="tile k"><small>Sessions · this period</small><b>${apS}${dash(R.sessions)}</b></div>
        <div class="tile r"><small>Article reads · this period</small><b>${dash(R.article_reads)}</b></div>
      </div>
      <div class="card">
        <div class="chart-h"><h2>Traffic</h2>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="legend"><i class="lg-b"></i>Page views <i class="lg-l"></i>Visitors</span><button class="link-btn" id="tv">${table ? "Chart view" : "Table view"}</button></div></div>
        <div class="chart" id="chart"></div>
        <p class="muted" style="font-size:.8rem;margin-top:8px">A “visitor” is one browser (counted by a random ID stored on the visitor's device — no name, email or IP address is saved). A “page view” is one page opened, so one visitor can make many page views. Everyone is counted — real readers, your own visits and bots — and the card below splits them. Bangladesh time.${anyApprox ? ` <b>≈</b> marks a figure for a very large period (more than ${fmtN(ex.visitors === false ? 400000 : 40000)} page views) where each day's unique visitors are added up, so a person who came on several days is counted once per day. Page views, article reads and every per-day number stay exact; narrow the dates to see exact visitor figures.` : ""}${rows.length !== allRows.length ? ` Long ranges are grouped by ${rows[0].axis ? "month" : "week"}; the visitors line there adds up each day's unique visitors.` : ""}</p>
      </div>
      ${kinds ? kindsCard(kinds) : ""}
      <div class="dash-cols" style="margin-top:16px">
        <div class="card"><h2>Most visited pages</h2>${barList(stats.top_pages, "views", (x) => pageLabel(x.path), "Page views appear after the first visits.")}</div>
        <div class="card"><h2>Where visitors come from</h2>${barList(stats.referrers, "views", (x) => esc(x.source))}</div>
      </div>
      <div class="dash-cols" style="margin-top:16px">
        <div class="card"><h2>Most read articles <span class="muted" style="font-size:.8rem;font-weight:500">(this period)</span></h2>${barList((stats.top_articles || []).map((a) => ({ k: a.title_bn || a.title_en || a.slug, v: a.reads })), "v", (x) => `📰 ${esc(String(x.k).slice(0, 80))}`, stats.legacy ? "Needs the update-4 SQL." : "Article reads in this period appear here.")}</div>
        <div class="card"><h2>Highlights</h2>
          <dl class="kv"><dt>Busiest day</dt><dd>${busiest && busiest.views ? `${esc(dLong(busiest.day))} · ${fmtN(busiest.views)} views` : "—"}</dd>
            <dt>Avg visitors / day</dt><dd>${R.visitors == null ? "—" : apV + fmtN(Math.round(allRows.reduce((a, r) => a + r.visitors, 0) / Math.max(1, nDays)))}</dd>
            <dt>Pages per visit</dt><dd>${R.sessions ? (R.views / R.sessions).toFixed(1) : "—"}</dd>
            <dt>New visitors</dt><dd>${fmtN(stats.new_visitors)}</dd><dt>Returning</dt><dd>${apV}${fmtN(stats.returning_visitors)}</dd>${subsNew !== null ? `<dt>New subscribers</dt><dd><a href="#/subscribers">${fmtN(subsNew)}</a></dd>` : ""}</dl></div>
      </div>
      <div class="dash-cols" style="margin-top:16px;grid-template-columns:1fr 1fr 1fr">
        <div class="card"><h2>Devices</h2>${barList(stats.devices, "visitors", (x) => devName[x.device] || esc(x.device))}</div>
        <div class="card"><h2>Reading language</h2>${barList(stats.langs, "visitors", (x) => (x.lang === "en" ? "🇬🇧 English" : "🇧🇩 বাংলা"))}</div>
        <div class="card"><h2>New vs returning</h2>${barList([{ k: "🆕 New visitors", v: stats.new_visitors }, { k: "🔁 Returning", v: stats.returning_visitors }].filter((x) => x.v > 0), "v", (x) => x.k)}</div>
      </div>
      <div class="dash-cols" style="margin-top:16px">
        <div class="card"><h2>Most read topics <span class="muted" style="font-size:.8rem;font-weight:500">(all-time article reads)</span></h2>${barList(catViews.map((x) => ({ k: `${x.c.icon} ${x.c.en}`, v: x.v })), "v", (x) => esc(x.k), "Topic reads appear after articles are read.")}</div>
        <div class="card"><h2>All-time</h2>
          <dl class="kv"><dt>Page views</dt><dd>${fmtN(t.views_all)}</dd><dt>Unique visitors</dt><dd>${fmtN(t.visitors_all)}</dd><dt>Article reads</dt><dd>${fmtN(posts.reduce((a, p) => a + Number(p.views || 0), 0))}</dd><dt>Shares</dt><dd>${fmtN(posts.reduce((a, p) => a + Number(p.shares || 0), 0))}</dd></dl>
          <p class="muted" style="font-size:.8rem;margin-top:10px">Tip: for search keywords and Google rankings, also open Google Search Console.</p>
        </div>
      </div>`;
      mountPicker($("#rp"), sel, reload);
      fitTiles(view);
      $("#csv").onclick = () => {
        downloadCsv(`vosb-traffic-${stats.from}_to_${stats.to}.csv`, [["date", "page_views", "visitors", "article_reads"]].concat(allRows.map((r) => [r.day, r.views, r.visitors, r.reads === undefined ? "" : r.reads])));
        toast("Exported " + fmtN(allRows.length) + " days", "ok");
      };
      const paint = () => { $("#chart").innerHTML = chartSvg(rows, table); $("#tv").textContent = table ? "Chart view" : "Table view"; if (!table) wireTip($("#chart"), rows); };
      $("#tv").onclick = () => { table = !table; paint(); };
      paint();
      if ($("#rv-mine")) {
        const relabel = async (id, kind) => {
          const { data, error } = await sb.rpc("admin_set_visitor_kind", { p_visitor: id, p_kind: kind });
          if (error) return toast(error.message, "err");
          toast(`Updated ${fmtN(data)} visit${data === 1 ? "" : "s"}`, "ok");
          await reload();
        };
        $("#rv-mine").onclick = () => {
          let id = "";
          try { id = localStorage.getItem("vosb-vid") || ""; } catch (e) {}
          if (!id) return toast("This browser has no visitor ID yet — open the public website once in this browser, then try again.", "err");
          relabel(id, "owner");
        };
        $("#rv-load").onclick = async () => {
          const r = resolveRange(sel), box = $("#rv-list");
          box.innerHTML = `<p class="muted">Loading…</p>`;
          const { data, error } = await sb.rpc("admin_top_visitors", { p_from: r.from, p_to: r.to, p_limit: 15 });
          if (error) { box.innerHTML = ""; return toast(error.message, "err"); }
          const nm = { human: "Real reader", owner: "Me (owner)", bot: "Bot" };
          box.innerHTML = data.length ? `<div class="rows">${data.map((v, i) => `<div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><b>Visitor #${i + 1}</b> <span class="muted">· ${esc(v.device)} · ${esc(String(v.visitor).slice(0, 6))}…</span><br>
              <span class="muted" style="font-size:.85rem">${fmtN(v.views)} page views · ${fmtN(v.sessions)} sessions · ${fmtN(v.pages)} pages · ${esc(fmtD(v.first_at))} → ${esc(fmtD(v.last_at))}</span></div>
            <select class="sel" data-i="${i}" aria-label="Who is this visitor">${["human", "owner", "bot"].map((k) => `<option value="${k}"${v.kind === k ? " selected" : ""}>${nm[k]}</option>`).join("")}</select></div>`).join("")}</div>
            <p class="muted" style="font-size:.8rem;margin-top:6px">Someone who opened many pages over several days on one device is often you or a crawler. Changing the label moves all of that browser’s visits.</p>` : `<p class="muted">No visitors in this period.</p>`;
          $$("select[data-i]", box).forEach((el) => { el.onchange = () => relabel(data[+el.dataset.i].visitor, el.value); });
        };
      }
    };
    draw();
  }

  /* ---------------- ads ---------------- */
  const PLACES = {
    popup:         { t: "Pop-up when a visitor opens the website", icon: "💬", d: "Shown once (then not again for the chosen hours) after about 3 seconds on the home, news and topic pages. Easy to close with ✕ or Esc. Never shown on article pages.", size: "Best size: 800 × 800 px (square) or 800 × 1000 px" },
    header:        { t: "Top banner — every page", icon: "🔝", d: "A slim banner just under the menu on every page.", size: "Best size: 970 × 250 px or 728 × 90 px" },
    feed:          { t: "Between news cards", icon: "📰", d: "Between the stories on the home page and the news lists (after the 6th story, then every 12).", size: "Best size: 970 × 250 px" },
    in_article:    { t: "Inside articles", icon: "📖", d: "Between paragraphs of an article (after the 3rd block; long articles get a second one). Never right after a heading.", size: "Best size: 800 × 450 px" },
    after_article: { t: "After the article (below share buttons)", icon: "⬇️", d: "At the end of every article, after the share buttons — readers see it when they finish.", size: "Best size: 970 × 250 px" },
    footer:        { t: "Footer banner — every page", icon: "🔚", d: "A banner above the footer on every page.", size: "Best size: 970 × 250 px" },
  };
  let ads = [], adsLoaded = false;
  async function loadAds(force) {
    if (adsLoaded && !force) return ads;
    const { data, error } = await sb.from("ads").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    ads = data || []; adsLoaded = true; return ads;
  }
  const adState = (a) => (!a.is_active ? "paused" : a.start_at && new Date(a.start_at) > new Date() ? "sched" : a.end_at && new Date(a.end_at) <= new Date() ? "ended" : "live");
  const adPill = (a) => ({ live: `<span class="pill live">LIVE</span>`, sched: `<span class="pill sched">SCHEDULED</span>`, ended: `<span class="pill draft">ENDED</span>`, paused: `<span class="pill paused">PAUSED</span>` })[adState(a)];
  const ctr = (a) => (a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(2) + "%" : "—");

  function adPreview(a) {
    const label = `<span class="ad-label">Ad</span>`;
    if (a.kind === "image" && a.image_url) return `<div class="ad-prev">${label}<img src="${esc(a.image_url)}" alt=""></div>`;
    if (a.kind === "text" && a.headline) return `<div class="ad-prev ad-prev-t">${label}<b>${esc(a.headline)}</b>${a.body ? `<span>${esc(a.body)}</span>` : ""}<em>${esc(a.cta || "Learn more")} →</em></div>`;
    return `<div class="ad-prev empty-prev">Preview appears here</div>`;
  }

  async function viewAds(view) {
    view.innerHTML = `<div class="page-h"><h1>Ads</h1><a class="b b-orange" href="#/ads/new">➕ New ad</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    await loadAds(true);
    if (!view.isConnected) return;
    const live = ads.filter((a) => adState(a) === "live").length;
    const imp = ads.reduce((n, a) => n + Number(a.impressions || 0), 0), clk = ads.reduce((n, a) => n + Number(a.clicks || 0), 0);
    view.innerHTML = `
      <div class="page-h"><h1>Ads <span class="muted" style="font-size:1rem">(${ads.length})</span></h1><a class="b b-orange" href="#/ads/new">➕ New ad</a></div>
      <div class="tiles">
        <div class="tile g"><small>Live ads</small><b>${fmtN(live)}</b></div>
        <div class="tile"><small>Times shown</small><b>${fmtN(imp)}</b></div>
        <div class="tile k"><small>Clicks</small><b>${fmtN(clk)}</b></div>
        <div class="tile r"><small>Click rate</small><b>${imp ? ((clk / imp) * 100).toFixed(2) + "%" : "—"}</b></div>
      </div>
      <p class="muted" style="font-size:.88rem;margin:-4px 2px 14px">Only real visitors are counted. Your own visits and clicks are ignored while you are signed in to this admin panel (and bots are ignored too). To test the counting yourself, <a href="${C.site.origin}/?track=1" target="_blank" rel="noopener" style="color:var(--orange-dark);font-weight:700">open the website in test-count mode ↗</a>, wait for the ad, click it, then press reload here.</p>
      <div class="rows" id="ad-rows">${ads.length ? ads.map((a) => `
        <div class="row" data-id="${a.id}">
          <div class="th">${a.kind === "image" && a.image_url ? `<img src="${esc(a.image_url)}" alt="" loading="lazy">` : "📣"}</div>
          <div class="ti"><h3>${esc(a.name)}</h3>
            <div class="meta">${adPill(a)}<span>${PLACES[a.placement].icon} ${esc(PLACES[a.placement].t)}</span><span>${a.lang === "all" ? "All languages" : a.lang === "bn" ? "বাংলা only" : "English only"}</span>
              <span>👁 <span class="stat">${fmtN(a.impressions)}</span> shown</span><span>🖱 <span class="stat">${fmtN(a.clicks)}</span> clicks</span><span>CTR <span class="stat">${ctr(a)}</span></span>
              ${a.start_at || a.end_at ? `<span>🗓 ${a.start_at ? esc(fmtD(a.start_at)) : "now"} → ${a.end_at ? esc(fmtD(a.end_at)) : "no end"}</span>` : ""}</div></div>
          <div class="acts"><a class="b b-line b-sm" href="#/ads/${a.id}">Edit</a>
            <button class="b b-line b-sm" data-a="toggle">${a.is_active ? "Pause" : "Resume"}</button>
            <button class="b b-line b-sm" data-a="dup">Duplicate</button>
            <button class="b b-sm" style="color:var(--red);border-color:var(--line);background:#fff" data-a="del">Delete</button></div></div>`).join("")
        : `<div class="card empty"><b>No ads yet</b>Click “New ad” to add a pop-up, banner or in-article ad. Ads always show an “Ad” label to readers.</div>`}</div>
      <div class="card" style="margin-top:16px"><h2>Where ads appear</h2>
        <div class="place-grid">${Object.keys(PLACES).map((k) => `<div class="place"><b>${PLACES[k].icon} ${esc(PLACES[k].t)}</b><p>${esc(PLACES[k].d)}</p><small>${esc(PLACES[k].size)}</small></div>`).join("")}</div>
        <p class="muted" style="margin-top:12px;font-size:.88rem"><b>Reader-friendly by design:</b> ads are always labelled “Ad”, the pop-up can be closed instantly and is limited to once per visitor per chosen period, nothing covers the article text while reading, and ads open in a new tab. Bots and your own admin visits are not counted in the numbers.</p></div>`;
    $("#ad-rows").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-a]"); if (!btn) return;
      const a = ads.find((x) => x.id === btn.closest(".row").dataset.id); if (!a) return;
      if (btn.dataset.a === "toggle") {
        const { error } = await sb.from("ads").update({ is_active: !a.is_active }).eq("id", a.id);
        if (error) return toast(error.message, "err");
        toast(a.is_active ? "Ad paused" : "Ad resumed", "ok"); adsLoaded = false; return router();
      }
      if (btn.dataset.a === "dup") {
        const c = Object.assign({}, a); ["id", "impressions", "clicks", "created_at", "updated_at"].forEach((k) => delete c[k]);
        c.name = a.name + " (copy)"; c.is_active = false;
        const r = await sb.from("ads").insert(c).select("id").single();
        if (r.error) return toast(r.error.message, "err");
        toast("Duplicated (paused)", "ok"); location.hash = "#/ads/" + r.data.id; return;
      }
      if (btn.dataset.a === "del") {
        if (!(await modal({ title: "Delete this ad?", body: `“${a.name}” will be removed from the website and its numbers deleted.`, ok: "Delete", danger: true }))) return;
        const { error } = await sb.from("ads").delete().eq("id", a.id);
        if (error) return toast(error.message, "err");
        toast("Deleted", "ok"); adsLoaded = false; router();
      }
    });
  }

  /* make pasted links work: "example.com/x" -> https://example.com/x, "/#subscribe" -> this website */
  function normLink(v) {
    v = String(v || "").trim();
    if (!v) return v;
    if (/^\/(?!\/)/.test(v) || /^#/.test(v)) return (C.site && C.site.origin ? C.site.origin : "https://www.voiceofstartup.bd") + (v[0] === "#" ? "/" : "") + v;
    if (/^\/\//.test(v)) return "https:" + v;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return "https://" + v;
    return v;
  }
  async function viewAdEditor(view, idOrNew) {
    const isNew = idOrNew === "new";
    let a = { name: "", placement: "popup", kind: "image", image_url: "", link_url: "", headline: "", body: "", cta: "", lang: "all", category: "", is_active: true, start_at: "", end_at: "", priority: 5, freq_hours: 12 };
    if (!isNew) {
      view.innerHTML = `<div class="card"><p class="muted">Loading…</p></div>`;
      const { data, error } = await sb.from("ads").select("*").eq("id", idOrNew).maybeSingle();
      if (error) throw error;
      if (!view.isConnected) return;
      if (!data) { view.innerHTML = `<div class="card empty"><b>Ad not found</b><a class="b b-orange" href="#/ads">Back to ads</a></div>`; return; }
      a = Object.assign(a, data, { category: data.category || "", image_url: data.image_url || "", start_at: data.start_at ? toLocalInput(data.start_at) : "", end_at: data.end_at ? toLocalInput(data.end_at) : "" });
    }
    let saving = false;
    view.innerHTML = `
      <div class="page-h"><h1>${isNew ? "New ad" : "Edit ad"}</h1><a class="b b-line" href="#/ads">← Ads</a></div>
      <div class="ed-grid"><div class="grid">
        <div class="card">
          <div class="fld"><label for="a-name">Ad name <span class="hint">(only you see this)</span></label><input class="inp" id="a-name" maxlength="80" placeholder="e.g. Summit sponsor — November"></div>
          <div class="fld"><label for="a-place">Where should it appear?</label><select class="sel" id="a-place">${Object.keys(PLACES).map((k) => `<option value="${k}">${PLACES[k].icon} ${esc(PLACES[k].t)}</option>`).join("")}</select><span class="hint" id="a-place-h"></span></div>
          <div class="fld"><label>Ad type</label><div class="seg" id="a-kind"><button type="button" data-k="image">🖼 Image</button><button type="button" data-k="text">📝 Text</button></div></div>
          <div id="a-img-box" class="fld"><label>Ad image</label><div class="cover-box" id="a-cover"></div><span class="hint" id="a-size"></span></div>
          <div class="fld"><label for="a-head">Headline <span class="hint" id="a-head-h"></span></label><input class="inp" id="a-head" maxlength="90"></div>
          <div id="a-text-box"><div class="fld"><label for="a-body">Message <span class="hint">(optional)</span></label><textarea class="txt" id="a-body" rows="2" maxlength="220"></textarea></div>
          <div class="fld"><label for="a-cta">Button text <span class="hint">(optional, e.g. Register now)</span></label><input class="inp" id="a-cta" maxlength="30"></div></div>
          <div class="fld"><label for="a-link">Link — where the ad goes when clicked</label><input class="inp" id="a-link" type="url" inputmode="url" placeholder="https://…"></div>
        </div>
        <div class="card"><h2>Preview</h2><div id="a-prev"></div><p class="muted" style="font-size:.8rem;margin-top:8px">Readers always see a small “Ad” label on it.</p></div>
      </div>
      <aside class="ed-side">
        <div class="card savebar"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>Status:</b> <span id="a-pill"></span></div>
          <label class="chk"><input type="checkbox" id="a-active"> Active (show on the website)</label>
          <button class="b b-green" id="a-save">💾 Save ad</button></div>
        <div class="card"><h2>Targeting & schedule</h2>
          <div class="fld"><label for="a-lang">Language</label><select class="sel" id="a-lang"><option value="all">All readers</option><option value="bn">বাংলা readers only</option><option value="en">English readers only</option></select></div>
          <div class="fld"><label for="a-cat">Topic</label><select class="sel" id="a-cat"><option value="">All topics</option>${cats.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.en)}</option>`).join("")}</select><span class="hint">Only on that topic's pages and articles.</span></div>
          <div class="fld"><label for="a-start">Start <span class="hint">(optional, Bangladesh time)</span></label><input class="inp" id="a-start" type="datetime-local"></div>
          <div class="fld"><label for="a-end">End <span class="hint">(optional)</span></label><input class="inp" id="a-end" type="datetime-local"></div>
          <div class="fld"><label for="a-pri">Priority <span class="hint">(1–10, higher = shown more when several ads share a place)</span></label><input class="inp" id="a-pri" type="number" min="1" max="10"></div>
          <div class="fld" id="a-freq-box"><label for="a-freq">Pop-up frequency</label><select class="sel" id="a-freq"><option value="0">Every visit</option><option value="6">Once every 6 hours</option><option value="12">Once every 12 hours</option><option value="24">Once a day</option><option value="72">Once every 3 days</option><option value="168">Once a week</option></select></div>
        </div></aside></div>`;
    const $a = (id) => $("#" + id);
    const read = () => {
      a.name = $a("a-name").value.trim(); a.placement = $a("a-place").value; a.headline = $a("a-head").value.trim(); a.body = $a("a-body").value.trim();
      a.cta = $a("a-cta").value.trim(); a.link_url = $a("a-link").value.trim(); a.lang = $a("a-lang").value; a.category = $a("a-cat").value;
      a.is_active = $a("a-active").checked; a.start_at = $a("a-start").value; a.end_at = $a("a-end").value;
      a.priority = Math.min(10, Math.max(1, parseInt($a("a-pri").value, 10) || 5)); a.freq_hours = +$a("a-freq").value;
    };
    const sync = () => {
      const pl = PLACES[a.placement];
      $a("a-place-h").textContent = pl.d; $a("a-size").textContent = pl.size;
      $$("#a-kind button").forEach((b) => b.classList.toggle("on", b.dataset.k === a.kind));
      $a("a-img-box").hidden = a.kind !== "image"; $a("a-text-box").hidden = a.kind !== "text";
      $a("a-freq-box").hidden = a.placement !== "popup";
      $a("a-head-h").textContent = a.kind === "image" ? "(optional — used as the image description)" : "(required)";
      $a("a-prev").innerHTML = adPreview(a);
      $a("a-pill").innerHTML = isNew && !a.id ? `<span class="pill draft">NEW</span>` : adPill(Object.assign({}, a, { start_at: a.start_at ? fromLocalInput(a.start_at) : null, end_at: a.end_at ? fromLocalInput(a.end_at) : null }));
    };
    const cover = () => {
      const box = $a("a-cover");
      box.innerHTML = a.image_url ? `<img src="${esc(a.image_url)}" alt="Ad image"><div class="row-b"><button type="button" class="b b-line b-sm" id="ac-pick">Replace</button><button type="button" class="b b-line b-sm" id="ac-del">Remove</button></div>`
        : `<p class="muted" style="margin-bottom:10px">Drag an image here, or choose one.<br><small>JPG, PNG, WebP · auto-optimised</small></p><button type="button" class="b b-orange b-sm" id="ac-pick">📷 Choose image</button>`;
      box.insertAdjacentHTML("beforeend", `<input type="file" id="ac-file" accept="image/*" hidden>`);
      $("#ac-pick", box).onclick = () => $("#ac-file").click();
      const d = $("#ac-del", box); if (d) d.onclick = () => { a.image_url = ""; cover(); sync(); };
      $("#ac-file").onchange = (e) => { const f = e.target.files[0]; if (f) up(f); };
    };
    async function up(f) {
      if (!/^image\//.test(f.type)) return toast("Please choose an image file", "err");
      try { toast("Optimising & uploading…"); a.image_url = await uploadImage(f, "ads"); cover(); sync(); toast("Image uploaded", "ok"); }
      catch (e) { toast("Upload failed: " + (e.message || e), "err"); }
    }
    const cb = $a("a-cover");
    ["dragenter", "dragover"].forEach((n) => cb.addEventListener(n, (e) => { e.preventDefault(); cb.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((n) => cb.addEventListener(n, (e) => { e.preventDefault(); cb.classList.remove("drag"); }));
    cb.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) up(f); });

    $a("a-name").value = a.name; $a("a-place").value = a.placement; $a("a-head").value = a.headline; $a("a-body").value = a.body; $a("a-cta").value = a.cta;
    $a("a-link").value = a.link_url; $a("a-lang").value = a.lang; $a("a-cat").value = a.category; $a("a-active").checked = a.is_active;
    $a("a-start").value = a.start_at; $a("a-end").value = a.end_at; $a("a-pri").value = a.priority; $a("a-freq").value = String(a.freq_hours);
    if (![...$a("a-freq").options].some((o) => o.value === String(a.freq_hours))) $a("a-freq").insertAdjacentHTML("beforeend", `<option value="${a.freq_hours}">Once every ${a.freq_hours} hours</option>`), $a("a-freq").value = String(a.freq_hours);
    $("#a-kind").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; read(); a.kind = b.dataset.k; sync(); };
    ["a-name", "a-place", "a-head", "a-body", "a-cta", "a-link", "a-lang", "a-cat", "a-active", "a-start", "a-end", "a-pri", "a-freq"].forEach((id) => { $a(id).addEventListener("input", () => { read(); sync(); }); $a(id).addEventListener("change", () => { read(); sync(); }); });
    cover(); sync();

    $a("a-save").onclick = async () => {
      if (saving) return; read();
      if (!a.name) return toast("Give the ad a name (only you see it)", "err");
      a.link_url = normLink(a.link_url); $a("a-link").value = a.link_url;
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(a.link_url) && !/^https?:\/\/localhost/i.test(a.link_url)) return toast("Enter a valid link, e.g. https://example.com/page", "err");
      if (a.kind === "image" && !a.image_url) return toast("Add the ad image", "err");
      if (a.kind === "text" && !a.headline) return toast("Write a headline for the text ad", "err");
      if (a.start_at && a.end_at && fromLocalInput(a.end_at) <= fromLocalInput(a.start_at)) return toast("The end must be after the start", "err");
      const row = { name: a.name, placement: a.placement, kind: a.kind, image_url: a.kind === "image" ? a.image_url : (a.image_url || null), link_url: a.link_url, headline: a.headline, body: a.kind === "text" ? a.body : "", cta: a.kind === "text" ? a.cta : "",
        lang: a.lang, category: a.category || null, is_active: a.is_active, start_at: a.start_at ? fromLocalInput(a.start_at) : null, end_at: a.end_at ? fromLocalInput(a.end_at) : null, priority: a.priority, freq_hours: a.freq_hours };
      saving = true; $a("a-save").disabled = true;
      const r = a.id ? await sb.from("ads").update(row).eq("id", a.id).select("id").single() : await sb.from("ads").insert(row).select("id").single();
      saving = false; $a("a-save").disabled = false;
      if (r.error) return toast(r.error.message, "err");
      a.id = r.data.id; adsLoaded = false; toast(a.is_active ? "Ad saved — it is live on the website" : "Ad saved (paused)", "ok");
      if (isNew) history.replaceState(null, "", "#/ads/" + a.id);
      sync();
    };
  }


  /* ---------------- newsletter subscribers ---------------- */
  let subsList = [], lastImportMsg = "";
  const extractEmails = (text) => {
    const found = String(text || "").match(/[A-Za-z0-9._%+'\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g) || [];
    const all = found.map((e) => e.toLowerCase());
    const uniq = Array.from(new Set(all)).filter((e) => e.length <= 254);
    return { uniq, dup: all.length - Array.from(new Set(all)).length };
  };
  const csvCell = (v) => { v = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  function downloadCsv(name, rows) {
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------------- newsletter sender (compose -> preview -> test -> one-click send) ---------------- */
  const SEND_FN = "send-newsletter";
  const SITE_ORIGIN = () => (C.site && C.site.origin) || "https://www.voiceofstartup.bd";

  /* Turns the Markdown message into a finished, email-safe HTML page (inline styles, 600px table layout).
     {{UNSUB_URL}} and {{EMAIL}} are filled in per subscriber by the send function. */
  function buildEmail({ subject, preview, md }) {
    const O = "#ff7522", OD = "#e55f0f", K = "#0b0b0b", G = "#0b8a4b", R = "#e8312f";
    const font = `'Hind Siliguri','Noto Sans Bengali','Segoe UI',Arial,sans-serif`;
    let h = MD.render(md || "");
    const btn = `display:inline-block;background:${O};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:999px;font-size:16px`;
    h = h.replace(/<p>(<a [^>]*>[^<]*[→»][^<]*<\/a>)<\/p>/g, (m, a) => `<p style="margin:22px 0;text-align:center">${a.replace("<a ", `<a style="${btn}" `)}</p>`)
      .replace(/<h2>/g, `<h2 style="font-family:${font};font-size:22px;line-height:1.35;margin:28px 0 10px;color:${K}">`)
      .replace(/<h3>/g, `<h3 style="font-family:${font};font-size:18px;line-height:1.4;margin:22px 0 8px;color:${K}">`)
      .replace(/<p>/g, `<p style="margin:0 0 16px">`)
      .replace(/<a (?![^>]*style=)/g, `<a style="color:${OD};text-decoration:underline;font-weight:600" `)
      .replace(/<ul>/g, `<ul style="margin:0 0 16px;padding-left:22px">`).replace(/<ol>/g, `<ol style="margin:0 0 16px;padding-left:22px">`)
      .replace(/<li>/g, `<li style="margin:0 0 8px">`)
      .replace(/<img /g, `<img style="max-width:100%;height:auto;border-radius:12px;display:block;margin:18px auto" `)
      .replace(/<blockquote>/g, `<blockquote style="margin:18px 0;padding:6px 18px;border-left:4px solid ${O};color:#444;background:#fff7f1">`)
      .replace(/<hr\s*\/?>/g, `<hr style="border:0;border-top:1px solid #e4e4e0;margin:26px 0">`);
    const pre = esc(preview || "");
    return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject || "Voice of Startup Bangladesh")}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:${font};color:#1b1b1b">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f4f4f2">${pre}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:22px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4e4e0">
<tr><td style="height:6px;line-height:6px;font-size:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" style="background:${O};height:6px;font-size:0">&nbsp;</td><td width="30%" style="background:${G};height:6px;font-size:0">&nbsp;</td><td width="20%" style="background:${R};height:6px;font-size:0">&nbsp;</td></tr></table></td></tr>
<tr><td align="center" style="padding:26px 24px 8px"><a href="${SITE_ORIGIN()}/"><img src="${SITE_ORIGIN()}/assets/logo.png" alt="Voice of Startup Bangladesh" width="150" style="width:150px;height:auto;border:0;display:block"></a></td></tr>
<tr><td align="center" style="padding:0 24px 8px;font-size:13px;color:#777;letter-spacing:.04em">Bangladesh Startup &amp; Business News</td></tr>
<tr><td style="padding:14px 30px 8px;font-size:16.5px;line-height:1.7;font-family:${font};color:#1b1b1b">${h}</td></tr>
<tr><td style="padding:10px 30px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e4e4e0;padding-top:16px;font-size:14px;color:#555;line-height:1.6">— Voice of Startup Bangladesh<br><a href="${SITE_ORIGIN()}/" style="color:${OD};text-decoration:none;font-weight:600">www.voiceofstartup.bd</a></td></tr></table></td></tr>
<tr><td style="background:${K};padding:20px 28px;text-align:center;font-size:12.5px;line-height:1.7;color:#bdbdbd">আপনি Voice of Startup Bangladesh-এর নিউজলেটার সাবস্ক্রাইব করেছেন ({{EMAIL}})।<br>You are receiving this email because you subscribed on voiceofstartup.bd.<br><a href="{{UNSUB_URL}}" style="color:#ffffff;text-decoration:underline;font-weight:600">আনসাবস্ক্রাইব / Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
  }

  const CAMP_COLS = "id,subject,preview,audience,body_md,status,total,sent,failed,last_error,created_at,sent_at";
  const campPill = (c) => ({ draft: `<span class="pill draft">DRAFT</span>`, sending: `<span class="pill sched">SENDING</span>`, paused: `<span class="pill paused">PAUSED</span>`, sent: `<span class="pill live">SENT</span>`, failed: `<span class="pill paused">FAILED</span>` }[c.status] || "");

  /* calls the send function and turns every kind of failure into a readable message */
  async function callSender(body) {
    const { data, error } = await sb.functions.invoke(SEND_FN, { body });
    if (error) {
      const st = error.context && error.context.status;
      if (st === 404) return { ok: false, error: "not_deployed", message: "The sending function is not deployed yet (see the setup steps above)." };
      if (st === 403) return { ok: false, error: "forbidden", message: "This account is not allowed to send newsletters." };
      if (st === 401) return { ok: false, error: "auth", message: "Session expired — please sign in again." };
      return { ok: false, error: "network", message: "Could not reach the sending service. Check your connection and try again." };
    }
    return data || { ok: false, error: "empty", message: "No answer from the sending service." };
  }

  async function viewNewsletter(view, idOrNew) {
    view.innerHTML = `<div class="page-h"><h1>Send newsletter</h1></div><div class="card"><p class="muted">Loading…</p></div>`;
    const [subRes, histRes, posts_] = await Promise.all([
      Promise.all(["all", "bn", "en"].map((k) => { let q = sb.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active"); if (k !== "all") q = q.eq("lang", k); return q; })),
      sb.from("campaigns").select(CAMP_COLS).order("created_at", { ascending: false }).limit(60),
      loadPosts().catch(() => []),
    ]);
    if (!view.isConnected) return;
    const missing = (e) => e && /relation|does not exist|schema cache|PGRST205|42P01/i.test(e.message + (e.code || ""));
    const subErr = subRes.find((x) => x.error);
    if (subErr || histRes.error) {
      const e = subErr ? subErr.error : histRes.error;
      view.innerHTML = `<div class="page-h"><h1>Send newsletter</h1></div><div class="card"><div class="msg err">${missing(e) ? "The newsletter sender tables have not been created yet. Open Supabase → SQL Editor, paste the contents of <b>supabase/update-5-newsletter-sender.sql</b> from the website repository, press Run, then reload this page." : "Could not load: " + esc(e.message)}</div></div>`;
      return;
    }
    const aud = { all: subRes[0].count || 0, bn: subRes[1].count || 0, en: subRes[2].count || 0 };
    let hist = histRes.data || [];
    let cur = { id: null, subject: "", preview: "", audience: "all", body_md: "", status: "draft", sent: 0, failed: 0, total: 0 };
    if (idOrNew && idOrNew !== "new") {
      const { data } = await sb.from("campaigns").select(CAMP_COLS).eq("id", idOrNew).maybeSingle();
      if (data) cur = data; else toast("That newsletter was not found", "err");
    }
    let locked = cur.status === "sent";
    let senderState = null;        // result of {action:"status"} (null = checking)
    let busy = false, tab = "edit";

    const $n = (id) => $("#" + id, view);
    const audLabel = { all: "Everyone", bn: "Bangla readers", en: "English readers" };

    function draw() {
      locked = cur.status === "sent";
      const n = aud[cur.audience] || 0;
      const resume = cur.id && (cur.status === "sending" || cur.status === "paused");
      view.innerHTML = `
      <div class="page-h"><h1>Send newsletter</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="b b-line" href="#/subscribers">← Subscribers</a>${cur.id ? `<a class="b b-line" href="#/newsletter">＋ New message</a>` : ""}</div></div>
      <div id="nl-setup">${setupHtml()}</div>
      <div class="nl-grid">
        <div class="card nl-edit">
          <h2>${locked ? "Sent message" : cur.id ? "Edit message" : "Write your message"} ${cur.id ? campPill(cur) : ""}</h2>
          <div class="fld"><label for="nl-subject">Subject <span class="hint">— what people see in their inbox</span></label><input class="inp" id="nl-subject" maxlength="150" placeholder="e.g. এই সপ্তাহের সেরা স্টার্টআপ আপডেট" value="${esc(cur.subject)}" ${locked ? "disabled" : ""}></div>
          <div class="fld"><label for="nl-pre">Preview text <span class="hint">— the grey line after the subject (optional)</span></label><input class="inp" id="nl-pre" maxlength="140" placeholder="Short teaser…" value="${esc(cur.preview)}" ${locked ? "disabled" : ""}></div>
          <div class="fld"><label for="nl-aud">Send to</label><select class="sel" id="nl-aud" ${locked || cur.status === "sending" || cur.status === "paused" ? "disabled" : ""}>
            ${["all", "bn", "en"].map((k) => `<option value="${k}" ${cur.audience === k ? "selected" : ""}>${audLabel[k]} — ${fmtN(aud[k])} active subscribers</option>`).join("")}</select></div>
          <div class="fld"><label for="nl-body">Message</label>
            ${locked ? "" : `<div class="nl-tools" role="toolbar" aria-label="Formatting"><button type="button" class="b b-line b-sm" data-t="b" title="Bold"><b>B</b></button><button type="button" class="b b-line b-sm" data-t="i" title="Italic"><i>I</i></button><button type="button" class="b b-line b-sm" data-t="h" title="Heading">H</button><button type="button" class="b b-line b-sm" data-t="l" title="Link">🔗 Link</button><button type="button" class="b b-line b-sm" data-t="ul" title="List">• List</button><button type="button" class="b b-line b-sm" data-t="btn" title="Orange button">🔘 Button</button><button type="button" class="b b-line b-sm" data-t="posts" title="Add the latest published articles">📰 Latest articles</button></div>`}
            <textarea class="txt nl-body" id="nl-body" rows="14" placeholder="Write in Bangla or English. Use the buttons above for headings, links and lists." ${locked ? "disabled" : ""}>${esc(cur.body_md)}</textarea>
            <span class="hint">A link on its own line that ends with → becomes an orange button, e.g. <code>[সব খবর পড়ুন →](https://www.voiceofstartup.bd/news)</code>. The unsubscribe link and your logo are added automatically.</span></div>
          <div class="nl-test"><input class="inp" id="nl-to" type="email" inputmode="email" placeholder="Send a test to…" value="${esc(session.user.email || "")}"><button class="b b-line" id="nl-test" ${busy ? "disabled" : ""}>Send test</button></div>
          <div id="nl-msg" class="msg" hidden></div>
          <div class="nl-actions">
            ${locked ? `<button class="b b-line" id="nl-dup">Duplicate as new</button>` : `<button class="b b-line" id="nl-save" ${busy ? "disabled" : ""}>Save draft</button><button class="b b-orange b-lg" id="nl-send" ${busy ? "disabled" : ""}>${resume ? "▶ Continue sending" : "✉️ Send to " + fmtN(n) + " subscriber" + (n === 1 ? "" : "s")}</button>`}
          </div>
          <div id="nl-prog" ${cur.status === "sending" || cur.status === "paused" || locked ? "" : "hidden"}>${progHtml()}</div>
        </div>
        <div class="card nl-prev"><h2>Email preview <span class="muted" style="font-weight:500;font-size:.85rem">(exactly what subscribers get)</span></h2><iframe id="nl-frame" title="Email preview" sandbox="" class="nl-frame"></iframe></div>
      </div>
      <div class="card" style="margin-top:16px"><h2>Past newsletters</h2>${histHtml()}</div>`;
      wire(); preview();
    }

    function setupHtml() {
      if (senderState === null) return `<div class="card nl-info"><span class="muted">Checking the email service…</span></div>`;
      if (senderState.configured) return `<div class="card nl-info ok"><b>✓ Ready to send</b> via ${esc(senderState.provider)} · from <code>${esc(senderState.from)}</code>${senderState.daily_limit ? ` · daily limit <b>${fmtN(senderState.daily_limit)}</b> (sent today: ${fmtN(senderState.sent_today)})` : ""}</div>`;
      const why = senderState.error === "not_deployed" ? "The sending function has not been deployed yet."
        : senderState.error === "not_configured" ? "The email service is not connected yet." : esc(senderState.message || "The email service is not available.");
      return `<div class="card nl-info warn"><b>⚙️ One-time setup needed</b> — ${why}
        <ol><li>Create a free account at <b>resend.com</b> (or brevo.com), add the domain <b>voiceofstartup.bd</b> and add the DNS records they show (this lets your emails reach the inbox, not spam).</li>
        <li>Create an API key. In <b>Supabase → Edge Functions → Secrets</b> add <code>RESEND_API_KEY</code> and <code>MAIL_FROM</code> = <code>Voice of Startup Bangladesh &lt;newsletter@voiceofstartup.bd&gt;</code> (optional: <code>DAILY_LIMIT</code> = 100 for Resend's free plan).</li>
        <li>Reload this page — this box turns green. After that, sending is one click.</li></ol></div>`;
    }

    function progHtml() {
      const t = cur.total || 0, done = (cur.sent || 0) + (cur.failed || 0), pct = t ? Math.min(100, Math.round((done / t) * 100)) : 0;
      if (!t && cur.status === "draft") return "";
      return `<div class="nl-bar" aria-hidden="true"><i style="width:${pct}%"></i></div><p class="muted" style="margin:6px 0 0;font-size:.9rem"><b>${fmtN(cur.sent)}</b> sent${cur.failed ? ` · <b style="color:var(--red)">${fmtN(cur.failed)}</b> failed` : ""} of ${fmtN(t)}${cur.status === "paused" ? " — paused (press Continue to carry on)" : ""}${cur.status === "sent" ? " — finished" : ""}${cur.last_error && cur.status !== "sent" ? `<br><span style="color:var(--red)">${esc(cur.last_error)}</span>` : ""}</p>${cur.failed && cur.id ? `<button class="b b-line b-sm" id="nl-retry" style="margin-top:8px">Retry the ${fmtN(cur.failed)} failed</button>` : ""}`;
    }

    function histHtml() {
      if (!hist.length) return `<p class="muted">Nothing sent yet. Your first newsletter will appear here.</p>`;
      return `<div class="rows">${hist.map((c) => `<div class="row sub" data-c="${c.id}"><div class="ti"><h3>${esc(c.subject)}</h3><div class="meta">${campPill(c)}<span>${audLabel[c.audience] || ""}</span><span>${c.status === "sent" && c.sent_at ? fmtDT(c.sent_at) : fmtDT(c.created_at)}</span>${c.total ? `<span><b>${fmtN(c.sent)}</b>/${fmtN(c.total)} delivered${c.failed ? ` · ${fmtN(c.failed)} failed` : ""}</span>` : ""}</div></div>
        <div class="acts"><a class="b b-line b-sm" href="#/newsletter/${c.id}">${c.status === "sent" ? "View" : "Open"}</a><button class="b b-line b-sm" data-del="${c.id}">Delete</button></div></div>`).join("")}</div>`;
    }

    function read() {
      if (locked) return;
      cur.subject = $n("nl-subject").value.trim(); cur.preview = $n("nl-pre").value.trim(); cur.body_md = $n("nl-body").value;
      const a = $n("nl-aud"); if (a) cur.audience = a.value;
    }
    function html() { return buildEmail({ subject: cur.subject, preview: cur.preview, md: cur.body_md }); }
    function preview() {
      const f = $n("nl-frame"); if (!f) return;
      f.srcdoc = html().replace(/\{\{EMAIL\}\}/g, "subscriber@example.com").replace(/\{\{UNSUB_URL\}\}/g, "#");
    }
    function say(text, kind) { const m = $n("nl-msg"); if (!m) return; m.hidden = !text; m.className = "msg " + (kind || ""); m.textContent = text || ""; }
    function lockUi(on) { busy = on; ["nl-save", "nl-send", "nl-test"].forEach((id) => { const b = $n(id); if (b) b.disabled = on; }); }

    async function save(quiet) {
      read();
      if (!cur.subject) { say("Write a subject first.", "err"); $n("nl-subject").focus(); return false; }
      if (!cur.body_md.trim()) { say("The message is empty.", "err"); $n("nl-body").focus(); return false; }
      const row = { subject: cur.subject, preview: cur.preview, audience: cur.audience, body_md: cur.body_md, body_html: html(), updated_at: new Date().toISOString() };
      const r = cur.id ? await sb.from("campaigns").update(row).eq("id", cur.id).select(CAMP_COLS).single() : await sb.from("campaigns").insert(row).select(CAMP_COLS).single();
      if (r.error) { say("Could not save: " + r.error.message, "err"); return false; }
      const fresh = !cur.id; cur = r.data;
      hist = [cur, ...hist.filter((x) => x.id !== cur.id)];
      if (fresh) history.replaceState(null, "", "#/newsletter/" + cur.id);
      if (!quiet) { say("Draft saved ✓", "ok"); toast("Draft saved", "ok"); }
      return true;
    }

    async function send() {
      read();
      if (!(await save(true))) return;
      const n = aud[cur.audience] || 0;
      if (!n && cur.status === "draft") return say("There are no active subscribers for this audience.", "err");
      if (!senderState || !senderState.configured) return say("Finish the one-time setup above first.", "err");
      const resuming = cur.status === "sending" || cur.status === "paused";
      const ok = await modal({ title: resuming ? "Continue sending?" : "Send this newsletter?", body: resuming ? `The rest of "${cur.subject}" will be sent now. People who already got it will not get it twice.` : `"${cur.subject}" will be emailed to ${fmtN(n)} active subscriber${n === 1 ? "" : "s"} (${audLabel[cur.audience]}). This cannot be undone — make sure you sent yourself a test first.`, ok: resuming ? "Continue" : `Send to ${fmtN(n)}`, cancel: "Not yet" });
      if (!ok) return;
      lockUi(true); say("", ""); $n("nl-prog").hidden = false; $n("nl-send").textContent = "Sending… keep this page open";
      let guard = 0, final = { t: "", k: "" };
      while (view.isConnected && guard++ < 400) {
        const r = await callSender({ action: "send", campaign_id: cur.id });
        if (!view.isConnected) return;
        if (!r.ok) { final = { t: r.message || "Sending stopped.", k: "err" }; break; }
        cur = { ...cur, sent: r.sent, failed: r.failed, total: r.total, status: r.done ? "sent" : r.paused ? "paused" : "sending", last_error: r.error || null };
        $n("nl-prog").innerHTML = progHtml();
        if (r.done) { final = { t: `Done ✓ ${fmtN(r.sent)} email${r.sent === 1 ? "" : "s"} sent${r.failed ? `, ${fmtN(r.failed)} failed` : ""}.`, k: "ok" }; toast("Newsletter sent", "ok"); break; }
        if (r.paused) { final = r.paused === "daily_limit" ? { t: "Daily sending limit reached. The rest will go out when you press Continue tomorrow (people are never emailed twice).", k: "" } : { t: "Stopped: " + (r.error || "the email service refused the request. Check the API key and the verified domain."), k: "err" }; break; }
      }
      hist = [cur, ...hist.filter((x) => x.id !== cur.id)];
      draw();
      if (final.t) say(final.t, final.k);
    }

    function wire() {
      if (locked) {
        $n("nl-dup").onclick = () => { try { sessionStorage.setItem("vosb-nl-dup", JSON.stringify({ subject: cur.subject, preview: cur.preview, audience: cur.audience, body_md: cur.body_md })); } catch (e) {} location.hash = "#/newsletter"; };
      } else {
        ["nl-subject", "nl-pre", "nl-body"].forEach((id) => $n(id).addEventListener("input", () => { read(); clearTimeout(wire.t); wire.t = setTimeout(preview, 250); }));
        $n("nl-aud").addEventListener("change", () => { read(); draw(); });
        $n("nl-save").onclick = async () => { lockUi(true); await save(); lockUi(false); draw(); };
        $n("nl-send").onclick = send;
        $$(".nl-tools [data-t]", view).forEach((b) => (b.onclick = () => tool(b.dataset.t)));
      }
      $n("nl-test").onclick = async () => {
        read();
        const to = $n("nl-to").value.trim();
        if (!cur.subject) return say("Write a subject first.", "err");
        if (!cur.body_md.trim()) return say("The message is empty.", "err");
        if (!senderState || !senderState.configured) return say("Finish the one-time setup above first.", "err");
        lockUi(true); say("Sending test…", "");
        const r = await callSender({ action: "test", to, subject: cur.subject, html: html() });
        lockUi(false); say(r.ok ? `Test sent to ${to} ✓ (check the spam folder the first time)` : r.message || "Could not send the test.", r.ok ? "ok" : "err");
      };
      const rt = $n("nl-retry"); if (rt) rt.onclick = async () => { lockUi(true); await callSender({ action: "retry", campaign_id: cur.id }); cur.failed = 0; cur.status = "paused"; lockUi(false); draw(); say("Failed addresses will be tried again — press Continue sending.", ""); };
      $$("[data-del]", view).forEach((b) => (b.onclick = async () => {
        const c = hist.find((x) => x.id === b.dataset.del);
        if (!(await modal({ title: "Delete this newsletter?", body: `"${c.subject}" and its sending history will be removed. Emails already delivered cannot be recalled.`, ok: "Delete", danger: true }))) return;
        const { error } = await sb.from("campaigns").delete().eq("id", c.id);
        if (error) return toast("Could not delete: " + error.message, "err");
        hist = hist.filter((x) => x.id !== c.id); toast("Deleted", "ok");
        if (cur.id === c.id) location.hash = "#/newsletter"; else draw();
      }));
    }

    function tool(t) {
      const ta = $n("nl-body"), a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
      const put = (text, from, to) => { ta.setRangeText(text, a, b, "end"); ta.focus(); if (from !== undefined) ta.setSelectionRange(a + from, a + to); read(); preview(); };
      if (t === "b") { const x = sel || "bold text"; put(`**${x}**`, 2, 2 + x.length); }
      else if (t === "i") { const x = sel || "italic text"; put(`*${x}*`, 1, 1 + x.length); }
      else if (t === "h") { const x = sel || "Heading"; put(`${a && ta.value[a - 1] !== "\n" ? "\n\n" : ""}## ${x}\n\n`); }
      else if (t === "l") { const x = sel || "link text"; put(`[${x}](https://)`, x.length + 3, x.length + 11); }
      else if (t === "ul") { put(`${a && ta.value[a - 1] !== "\n" ? "\n" : ""}- ${sel || "item"}\n- item\n`); }
      else if (t === "btn") { put(`${a && ta.value[a - 1] !== "\n" ? "\n\n" : ""}[${sel || "বিস্তারিত পড়ুন"} →](${SITE_ORIGIN()}/news)\n\n`); }
      else if (t === "posts") {
        const live = (posts_ || []).filter((p) => stateOf(p) === "live").sort((x, y) => new Date(y.publish_at) - new Date(x.publish_at)).slice(0, 5);
        if (!live.length) return toast("No published articles yet", "err");
        put(`${a && ta.value[a - 1] !== "\n" ? "\n\n" : ""}## সর্বশেষ আপডেট\n\n${live.map((p) => `- [${(p.title_bn || p.title_en || "").replace(/[\[\]]/g, "")}](${liveUrl(p.slug)})`).join("\n")}\n\n[সব খবর পড়ুন →](${SITE_ORIGIN()}/news)\n\n`);
      }
    }

    // "Duplicate as new" hand-over
    if (!cur.id) { try { const d = JSON.parse(sessionStorage.getItem("vosb-nl-dup") || "null"); if (d) { cur = { ...cur, ...d }; sessionStorage.removeItem("vosb-nl-dup"); } } catch (e) {} }
    draw();
    callSender({ action: "status" }).then((r) => {
      if (!view.isConnected) return;
      senderState = r.ok ? r : { configured: false, error: r.error, message: r.message };
      const box = $n("nl-setup"); if (box) box.innerHTML = setupHtml();
    });
  }

  async function viewSubscribers(view) {
    view.innerHTML = `<div class="page-h"><h1>Subscribers</h1></div><div class="card"><p class="muted">Loading…</p></div>`;
    const { data, error } = await fetchAll(() => sb.from("subscribers").select("id,email,status,lang,source,token,created_at,unsubscribed_at").order("created_at", { ascending: false }).order("id"));
    if (!view.isConnected) return;
    if (error) {
      const missing = /relation|does not exist|schema cache|PGRST205|42P01/i.test(error.message + (error.code || ""));
      view.innerHTML = `<div class="page-h"><h1>Subscribers</h1></div><div class="card"><div class="msg err">${missing ? "The newsletter table has not been created yet. Open Supabase → SQL Editor, paste the contents of <b>supabase/update-3-newsletter.sql</b> from the website repository, press Run, then reload this page." : "Could not load subscribers: " + esc(error.message)}</div></div>`;
      return;
    }
    subsList = data || [];
    let flash = lastImportMsg; lastImportMsg = "";
    let q = "", st = "all", impOpen = false, impText = "", impLang = "bn", impOk = false, impBusy = false;
    const origin = (window.VOSB && window.VOSB.origin) || "https://www.voiceofstartup.bd";
    const unsubUrl = (x) => `${origin}/unsubscribe?t=${x.token}`;
    const activeNow = () => subsList.filter((x) => x.status === "active");
    const week = Date.now() - 7 * 864e5;
    const draw = () => {
      const active = activeNow();
      const list = subsList.filter((x) => (st === "all" || x.status === st) && (!q || x.email.includes(q)));
      view.innerHTML = `
      <div class="page-h"><h1>Subscribers <span class="muted" style="font-size:1rem">(${fmtN(subsList.length)})</span></h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="b b-orange" href="#/newsletter">✉️ Send newsletter</a><button class="b b-line" id="imp-t">⬆ Import emails</button><button class="b b-line" id="copy">Copy active emails</button><button class="b b-line" id="csv">⬇ Export CSV</button></div></div>
      ${flash ? `<div class="msg ok" style="margin-bottom:14px">${esc(flash)}</div>` : ""}
      ${impOpen ? `<div class="card imp-box" style="margin-bottom:16px"><h2>Import existing emails</h2>
        <p class="muted" style="font-size:.9rem;line-height:1.55;margin:4px 0 10px">Paste email addresses (separated by commas, spaces or new lines) or upload a <b>.csv</b> / <b>.txt</b> file — for example a contacts export from Gmail or Google Contacts. Other columns are ignored; duplicates and people already on the list are skipped.</p>
        <textarea id="imp-ta" placeholder="name@example.com, another@example.com&#10;third@example.com">${esc(impText)}</textarea>
        <div class="imp-row"><input type="file" id="imp-file" accept=".csv,.txt,.tsv,.vcf,text/*">
          <label>Language <select id="imp-lang"><option value="bn" ${impLang === "bn" ? "selected" : ""}>বাংলা</option><option value="en" ${impLang === "en" ? "selected" : ""}>English</option></select></label>
          <span class="muted" id="imp-n" style="font-size:.88rem"></span></div>
        <label class="imp-check"><input type="checkbox" id="imp-ok" ${impOk ? "checked" : ""}><span>I confirm these people agreed to receive emails from Voice of Startup Bangladesh (for example they gave me their address to get updates). I will not import purchased or scraped lists.</span></label>
        <div class="imp-row"><button class="b b-orange" id="imp-go" ${impBusy ? "disabled" : ""}>${impBusy ? "Importing…" : "Import"}</button><button class="b b-line" id="imp-x">Cancel</button></div></div>` : ""}
      <div class="tiles">
        <div class="tile g"><small>Active</small><b>${fmtN(active.length)}</b></div>
        <div class="tile"><small>New · 7 days</small><b>${fmtN(subsList.filter((x) => new Date(x.created_at) > week).length)}</b></div>
        <div class="tile k"><small>বাংলা · English</small><b>${fmtN(active.filter((x) => x.lang === "bn").length)} · ${fmtN(active.filter((x) => x.lang === "en").length)}</b></div>
        <div class="tile r"><small>Unsubscribed</small><b>${fmtN(subsList.length - active.length)}</b></div>
      </div>
      <div class="card">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <input id="sq" type="search" placeholder="Search email…" value="${esc(q)}" style="flex:1 1 200px;min-width:0;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font:inherit">
          <select id="sf" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit">${[["all", "All"], ["active", "Active"], ["unsubscribed", "Unsubscribed"]].map(([v, t]) => `<option value="${v}" ${v === st ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        ${list.length ? `<div class="rows" id="sub-rows">${list.slice(0, 500).map((x) => `
          <div class="row sub" data-id="${x.id}">
            <div class="ti" style="min-width:0"><h3 style="overflow-wrap:anywhere;-webkit-line-clamp:3">${esc(x.email)}</h3>
              <div class="meta">${x.status === "active" ? `<span class="pill live">ACTIVE</span>` : `<span class="pill paused">UNSUBSCRIBED</span>`}<span>${x.lang === "en" ? "English" : "বাংলা"}</span><span>${esc(x.source)}</span><span>🗓 ${esc(fmtD(x.created_at))}</span></div></div>
            <div class="acts"><button class="b b-line b-sm" data-a="toggle">${x.status === "active" ? "Unsubscribe" : "Re-subscribe"}</button>
              <button class="b b-sm" style="color:var(--red);border-color:var(--line);background:#fff" data-a="del">Delete</button></div></div>`).join("")}</div>
          ${list.length > 500 ? `<p class="muted" style="margin-top:10px">Showing the newest 500 of ${fmtN(list.length)}. Use search, or export the CSV for the full list.</p>` : ""}`
          : `<div class="empty"><b>${subsList.length ? "No matches" : "No subscribers yet"}</b>${subsList.length ? "Try a different search." : "People who subscribe from the website homepage appear here."}</div>`}
      </div>
      <div class="card" style="margin-top:16px"><h2>Sending the newsletter</h2>
        <p class="muted" style="font-size:.92rem;line-height:1.6">This page is your own subscriber list. Click <b>Export CSV</b> (active subscribers only; includes each person's private unsubscribe link) and import it into a mailing service such as Brevo or Mailchimp to design and send your weekly digest. Anyone who clicks an unsubscribe link <i>from the website</i> is marked “Unsubscribed” here automatically; if you send from a separate service, re-export before each send so unsubscribed people are left out.</p></div>`;
      $("#imp-t", view).onclick = () => { impOpen = !impOpen; flash = ""; draw(); };
      if (impOpen) {
        const ta = $("#imp-ta", view), n = $("#imp-n", view);
        const count = () => { const r = extractEmails(impText); n.textContent = impText.trim() ? `${fmtN(r.uniq.length)} email address${r.uniq.length === 1 ? "" : "es"} found${r.dup ? ` (${fmtN(r.dup)} repeated)` : ""}` : ""; };
        count();
        ta.oninput = () => { impText = ta.value; count(); };
        $("#imp-lang", view).onchange = (e) => { impLang = e.target.value; };
        $("#imp-ok", view).onchange = (e) => { impOk = e.target.checked; };
        $("#imp-x", view).onclick = () => { impOpen = false; impText = ""; impOk = false; draw(); };
        $("#imp-file", view).onchange = (e) => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          if (f.size > 5 * 1024 * 1024) return toast("File is too large (max 5 MB)", "err");
          const fr = new FileReader();
          fr.onload = () => { impText = (impText ? impText + "\n" : "") + String(fr.result || ""); draw(); toast("File loaded", "ok"); };
          fr.onerror = () => toast("Could not read that file", "err");
          fr.readAsText(f);
        };
        $("#imp-go", view).onclick = async () => {
          const { uniq } = extractEmails(impText);
          if (!uniq.length) return toast("No email addresses found", "err");
          if (!impOk) return toast("Please tick the confirmation box first", "err");
          impBusy = true; draw();
          const sum = { added: 0, existing: 0, invalid: 0 };
          try {
            for (let i = 0; i < uniq.length; i += 2000) {
              const { data: r, error: er } = await sb.rpc("admin_import_subscribers", { p_emails: uniq.slice(i, i + 2000), p_lang: impLang });
              if (er) throw er;
              sum.added += r.added; sum.existing += r.existing; sum.invalid += r.invalid;
            }
          } catch (er) {
            impBusy = false; draw();
            return toast(isMissingFn(er) ? "Import needs the update-4 SQL — run supabase/update-4-range-import.sql in the Supabase SQL Editor first." : er.message, "err");
          }
          lastImportMsg = `Imported ${fmtN(sum.added)} new subscriber${sum.added === 1 ? "" : "s"}` + (sum.existing ? `, ${fmtN(sum.existing)} already on the list` : "") + (sum.invalid ? `, ${fmtN(sum.invalid)} invalid skipped` : "") + ".";
          toast("Import finished", "ok"); router();
        };
      }
      const sq = $("#sq", view);
      sq.oninput = () => { q = sq.value.trim().toLowerCase(); const pos = sq.selectionStart; draw(); const n = $("#sq", view); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
      $("#sf", view).onchange = (e) => { st = e.target.value; draw(); };
      $("#csv", view).onclick = () => {
        const rows = [["email", "language", "subscribed_at", "source", "unsubscribe_url"]].concat(active.map((x) => [x.email, x.lang, x.created_at, x.source, unsubUrl(x)]));
        downloadCsv(`vosb-subscribers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
        toast(`Exported ${fmtN(active.length)} active subscribers`, "ok");
      };
      $("#copy", view).onclick = async () => { toast((await copyText(active.map((x) => x.email).join(", "))) ? "Copied" : "Copy failed", "ok"); };
      const rowsEl = $("#sub-rows", view);
      if (rowsEl) rowsEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-a]"); if (!btn) return;
        const x = subsList.find((r) => r.id === btn.closest(".row").dataset.id); if (!x) return;
        if (btn.dataset.a === "toggle") {
          const on = x.status !== "active";
          const { error: er } = await sb.from("subscribers").update({ status: on ? "active" : "unsubscribed", unsubscribed_at: on ? null : new Date().toISOString() }).eq("id", x.id);
          if (er) return toast(er.message, "err");
          x.status = on ? "active" : "unsubscribed"; x.unsubscribed_at = on ? null : new Date().toISOString();
          toast(on ? "Re-subscribed" : "Unsubscribed", "ok"); return draw();
        }
        if (btn.dataset.a === "del") {
          if (!(await modal({ title: "Delete this subscriber?", body: `${x.email} will be permanently removed from your list.`, ok: "Delete", danger: true }))) return;
          const { error: er } = await sb.from("subscribers").delete().eq("id", x.id);
          if (er) return toast(er.message, "err");
          subsList = subsList.filter((r) => r.id !== x.id);
          toast("Deleted", "ok"); draw();
        }
      });
    };
    draw();
  }

  /* ---------------- settings ---------------- */
  function viewSettings(view) {
    view.innerHTML = `
      <div class="page-h"><h1>Settings</h1></div>
      <div class="set-grid">
        <form class="card" id="pwf" autocomplete="off" novalidate>
          <h2>Change password</h2>
          <div id="pmsg"></div>
          <div class="fld"><label for="np">New password <span class="hint">(10+ characters, letters & numbers)</span></label><input class="inp" id="np" type="password" autocomplete="new-password" minlength="10" required></div>
          <div class="fld"><label for="np2">Repeat new password</label><input class="inp" id="np2" type="password" autocomplete="new-password" required></div>
          <button class="b b-orange" type="submit">Update password</button>
        </form>
        <div class="card"><h2>Account</h2>
          <dl class="kv"><dt>Signed in as</dt><dd>${esc(session.user.email)}</dd><dt>User ID</dt><dd>${esc(C.admin.userId)}</dd><dt>Website</dt><dd><a href="${esc(C.site.origin)}" target="_blank" rel="noopener" style="color:var(--orange-dark)">${esc(C.site.domain)}</a></dd><dt>Idle sign-out</dt><dd>30 minutes</dd></dl>
          <p style="margin-top:14px"><button class="b b-line" id="so">Sign out on this device</button></p>
        </div>
        <div class="card"><h2>Google Search Console</h2>
          <p class="muted" style="margin-bottom:10px">Submit this link once in Search Console. New articles can be found by Google through the site's links, and are shared instantly via their own article link.</p>
          <div class="url" style="background:#f6f6f3;padding:9px 12px;border-radius:10px;overflow-wrap:anywhere;font-size:.9rem">${esc(C.site.origin)}/sitemap.xml</div>
          <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="b b-line b-sm" id="cs">Copy sitemap link</button><a class="b b-line b-sm" href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Search Console ↗</a></p>
        </div>
        <div class="card"><h2>Quick guide</h2>
          <ol class="steps"><li><b>New article</b> → write title & content (Bangla and/or English).</li><li>Add a cover image (auto-optimised).</li><li>Pick topic, date & time. Future time = scheduled.</li><li>Press <b>Publish now</b> — it appears on the website instantly.</li><li>Share the link on WhatsApp / Facebook / LinkedIn / X.</li></ol>
          <p class="muted" style="margin-top:10px;font-size:.88rem"><b>Bangla ↔ English:</b> write in one language only — the other language and the short summary are created automatically when you publish (marked “machine-translated” for readers). <b>Ads</b> and <b>Visitors</b> have their own pages in the menu.</p>
          <p class="muted" style="margin-top:10px;font-size:.88rem">Formatting: <code>**bold**</code> · <code>*italic*</code> · <code>## Heading</code> · <code>- list</code> · <code>[text](link)</code></p>
        </div>
      </div>`;
    $("#so").onclick = () => logout("You have been signed out.");
    $("#cs").onclick = async () => toast((await copyText(C.site.origin + "/sitemap.xml")) ? "Sitemap link copied" : "Copy failed", "ok");
    $("#pwf").onsubmit = async (e) => {
      e.preventDefault();
      const a = $("#np").value, b = $("#np2").value, m = $("#pmsg");
      const bad = a.length < 10 ? "Use at least 10 characters." : !/[A-Za-z]/.test(a) || !/\d/.test(a) ? "Include both letters and numbers." : a !== b ? "The two passwords do not match." : "";
      if (bad) { m.innerHTML = `<div class="msg err">${bad}</div>`; return; }
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { m.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
      $("#pwf").reset(); m.innerHTML = `<div class="msg ok">Password updated.</div>`;
    };
  }

  /* ---------------- boot ---------------- */
  function start() {
    shellOn = false;
    if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
    router();
  }
  window.addEventListener("hashchange", router);
  ["click", "keydown", "pointerdown", "touchstart"].forEach((n) => window.addEventListener(n, () => (lastActive = Date.now()), { passive: true }));
  setInterval(() => { if (session && Date.now() - lastActive > IDLE_MS) logout("Signed out after 30 minutes of inactivity."); }, 30000);
  sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_OUT" && session) { session = null; renderLogin("You have been signed out."); } });

  (async function init() {
    try {
      const { data } = await sb.auth.getSession();
      if (data.session && (data.session.user.email || "").toLowerCase() === ADMIN_EMAIL) { session = data.session; start(); }
      else { if (data.session) await sb.auth.signOut(); renderLogin(); }
    } catch (e) { renderLogin(); }
  })();
})();
