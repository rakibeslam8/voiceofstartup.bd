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

  /* ---------------- data ---------------- */
  const LIST_COLS = "id,slug,category,status,publish_at,featured,title_bn,title_en,source,author,image_url,views,shares,updated_at";
  async function loadPosts(force) {
    if (postsLoaded && !force) return posts;
    const { data, error } = await sb.from("posts").select(LIST_COLS).order("publish_at", { ascending: false }).limit(2000);
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
  const NAV = [
    { r: "dashboard", ic: "📊", t: "Dashboard" },
    { r: "posts", ic: "📰", t: "Articles" },
    { r: "edit/new", ic: "✍️", t: "New" },
    { r: "settings", ic: "⚙️", t: "Settings" },
  ];
  let shellOn = false;
  function shell() {
    app.innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <a class="brand" href="#/dashboard"><img src="/assets/logo.png" alt="VOSB" width="90" height="36"></a>
        <span class="tag">Admin</span>
        <nav class="tabs" id="tabs" aria-label="Admin">${NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${n.ic} ${n.t === "New" ? "New article" : n.t}</a>`).join("")}</nav>
        <span class="sp"></span>
        <span class="who" title="${esc(session.user.email)}">${esc(session.user.email)}</span>
        <a class="b b-ghost b-sm" href="/" target="_blank" rel="noopener">View site ↗</a>
        <button class="b b-ghost b-sm" id="out">Sign out</button>
      </div></header>
      <main class="main" id="view"></main>
      <nav class="bottom-nav" id="bnav" aria-label="Admin">${NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}"><span>${n.ic}</span>${n.t}</a>`).join("")}</nav>`;
    $("#out").onclick = () => logout("You have been signed out.");
    shellOn = true;
  }

  function markNav(r) {
    const base = r.startsWith("edit") ? "edit/new" : r;
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
    try {
      if (h === "dashboard") await viewDashboard(view);
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
    const { data, error } = await sb.rpc("admin_daily_views", { p_days: 90 });
    if (error) throw error;
    daily = (data || []).map((d) => ({ day: d.day, views: Number(d.views) }));
  }

  function chartSvg(rows, showTable) {
    if (showTable) {
      return `<table class="t"><thead><tr><th>Date</th><th class="n">Views</th></tr></thead><tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(fmtD(r.day + "T12:00:00+06:00"))}</td><td class="n">${fmtN(r.views)}</td></tr>`).join("")}</tbody></table>`;
    }
    const W = 640, H = 220, L = 34, B = 26, T = 10, R = 6;
    const max = Math.max(4, ...rows.map((r) => r.views));
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
    const every = rows.length > 40 ? 10 : rows.length > 14 ? 5 : 1;
    let bars = "", labs = "";
    rows.forEach((r, i) => {
      const x = L + i * bw + (bw - barW) / 2;
      const h = (r.views / top) * ih;
      const y = T + ih - h;
      bars += `<g data-i="${i}"><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${ih}"/>`
        + (r.views ? `<path class="bar" d="M${x},${T + ih} V${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, barW / 2)},${y} H${x + barW - Math.min(4, barW / 2)} Q${x + barW},${y} ${x + barW},${y + Math.min(4, h)} V${T + ih} Z"/>` : `<rect class="bar" x="${x}" y="${T + ih - 2}" width="${barW}" height="2" opacity=".35"/>`)
        + `</g>`;
      if (i % every === 0 || i === rows.length - 1) labs += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${new Date(r.day + "T12:00:00+06:00").toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily article views">${g}${bars}${labs}</svg>`;
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

  async function viewDashboard(view) {
    view.innerHTML = `<div class="page-h"><h1>Dashboard</h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    await Promise.all([loadPosts(true), loadDaily()]);
    if (!view.isConnected) return;   // user navigated away while loading
    const total = posts.reduce((a, p) => a + Number(p.views || 0), 0);
    const shares = posts.reduce((a, p) => a + Number(p.shares || 0), 0);
    const live = posts.filter((p) => stateOf(p) === "live").length;
    const sched = posts.filter((p) => stateOf(p) === "sched").length;
    const drafts = posts.filter((p) => stateOf(p) === "draft").length;
    const today = daily.length ? daily[daily.length - 1].views : 0;
    const d7 = daily.slice(-7).reduce((a, r) => a + r.views, 0);
    const top = [...posts].sort((a, b) => b.views - a.views).filter((p) => p.views > 0).slice(0, 6);
    let range = 30, table = false;

    view.innerHTML = `
      <div class="page-h"><h1>Dashboard</h1><a class="b b-orange" href="#/edit/new">✍️ Write new article</a></div>
      <div class="tiles">
        <div class="tile"><small>Total reads</small><b>${fmtN(total)}</b></div>
        <div class="tile g"><small>Reads today</small><b>${fmtN(today)}</b></div>
        <div class="tile k"><small>Last 7 days</small><b>${fmtN(d7)}</b></div>
        <div class="tile r"><small>Shares</small><b>${fmtN(shares)}</b></div>
        <div class="tile g"><small>Live articles</small><b>${fmtN(live)}</b></div>
        <div class="tile"><small>Scheduled</small><b>${fmtN(sched)}</b></div>
        <div class="tile k"><small>Drafts</small><b>${fmtN(drafts)}</b></div>
        <div class="tile r"><small>Total articles</small><b>${fmtN(posts.length)}</b></div>
      </div>
      <div class="dash-cols">
        <div class="card">
          <div class="chart-h"><h2>Daily reads</h2>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div class="range" id="rng">${[7, 30, 90].map((n) => `<button data-n="${n}" class="${n === range ? "on" : ""}">${n}d</button>`).join("")}</div>
              <button class="link-btn" id="tv">Table view</button>
            </div></div>
          <div class="chart" id="chart"></div>
          <p class="muted" style="font-size:.8rem;margin-top:8px">Counts one read per visitor per article per 6 hours. Your own visits and bots are not counted. Bangladesh time.</p>
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

    const draw = () => {
      const rows = daily.slice(-range);
      $("#chart").innerHTML = chartSvg(rows, table);
      $("#tv").textContent = table ? "Chart view" : "Table view";
      if (!table) wireTip($("#chart"), rows);
    };
    $("#rng").onclick = (e) => { const b = e.target.closest("[data-n]"); if (!b) return; range = +b.dataset.n; $$("#rng button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
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
        tip.innerHTML = `${esc(fmtD(r.day + "T12:00:00+06:00"))}<br><b>${fmtN(r.views)}</b> reads`;
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
              <span class="muted" style="font-size:.82rem">Write in Bangla, English, or both. Visitors can switch language.</span>
            </div>
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
      set("title_" + tab, e.target.value);
      if (!ed.slugTouched && tab === "en") { ed.slug = slugify(ed.title_en); $f("f-slug").value = ed.slug; slugUrl(); }
      fillLangTabsOnly(); saveBar();
    };
    function fillLangTabsOnly() { $$("#lt button").forEach((b) => b.classList.toggle("has", !!(ed["title_" + b.dataset.l] || ed["body_" + b.dataset.l]))); }
    $f("f-ex").oninput = (e) => { set("excerpt_" + tab, e.target.value); counts(); };
    $f("f-body").oninput = (e) => { set("body_" + tab, e.target.value); counts(); fillLangTabsOnly(); saveBar(); };
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

    /* save */
    async function save(status) {
      if (saving) return;
      const t = ed.title_bn.trim() || ed.title_en.trim();
      if (!t) return toast("Please write a title first", "err");
      if (status === "published" && !(ed.body_bn.trim() || ed.body_en.trim())) return toast("Add some article content before publishing", "err");
      if (!ed.publish_at) return toast("Choose a publish date & time", "err");
      let slug = (ed.slug || "").replace(/^-+|-+$/g, "");
      if (!slug) slug = slugify(ed.title_en) || randSlug();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return toast("Web address can use only a–z, 0–9 and hyphens", "err");
      if (ed.source_url && !/^https?:\/\//i.test(ed.source_url)) return toast("Source link must start with https://", "err");
      ed.slug = slug; $f("f-slug").value = slug; slugUrl();
      const row = {
        slug, category: ed.category, status, publish_at: fromLocalInput(ed.publish_at), featured: ed.featured,
        title_bn: ed.title_bn.trim(), title_en: ed.title_en.trim(), excerpt_bn: ed.excerpt_bn.trim(), excerpt_en: ed.excerpt_en.trim(),
        body_bn: ed.body_bn, body_en: ed.body_en,
        source: ed.source === "Other" ? "Other" : ed.source, source_url: ed.source_url || null, author: ed.author.trim() || "VOSB Desk",
        image_url: ed.image_url || null, image_alt: ed.image_alt.trim(),
      };
      saving = true; saveBar();
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

    fillStatic(); fillLang(); cover(); slugUrl(); dateHint(); saveBar();
    if (restored) {
      $("#restore").innerHTML = `<div class="msg info">Restored your unsaved changes from this device. <button class="link-btn" id="discard">Discard them</button></div>`;
      $("#discard").onclick = () => { try { localStorage.removeItem(draftKey); } catch (e) {} dirty = false; window.onbeforeunload = null; router(); };
    }
  }
  function pickFields(ed) { const o = {}; FIELDS.forEach((k) => (o[k] = ed[k])); return o; }

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
          <p class="muted" style="margin-bottom:10px">New articles are added to the sitemap automatically (within ~15 minutes).</p>
          <div class="url" style="background:#f6f6f3;padding:9px 12px;border-radius:10px;overflow-wrap:anywhere;font-size:.9rem">${esc(C.site.origin)}/sitemap.xml</div>
          <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="b b-line b-sm" id="cs">Copy sitemap link</button><a class="b b-line b-sm" href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Search Console ↗</a></p>
        </div>
        <div class="card"><h2>Quick guide</h2>
          <ol class="steps"><li><b>New article</b> → write title & content (Bangla and/or English).</li><li>Add a cover image (auto-optimised).</li><li>Pick topic, date & time. Future time = scheduled.</li><li>Press <b>Publish now</b> — it appears on the website instantly.</li><li>Share the link on WhatsApp / Facebook / LinkedIn.</li></ol>
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
