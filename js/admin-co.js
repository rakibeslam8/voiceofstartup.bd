/* Voice of Startup Bangladesh — admin: Company Directory control centre.
   Loaded before admin.js. admin.js calls window.VOSB_ADMIN_CO(context) once and delegates these routes:
     companies · companies/all · companies/<id> · payments · reviews · interests · company-settings · users · deletions
   Security: this file is only a UI. Every read/write is checked by the database (RLS + admin-only functions).
   All text is escaped with esc(); links are limited to http(s) or site-relative; no inline event handlers. */
window.VOSB_ADMIN_CO = function (X) {
  "use strict";
  const { sb, esc, toast, modal, copyText, fmtDT, fmtD, fmtN, svg, $, $$, fetchAll } = X;
  const CFG = (window.VOSB && window.VOSB.companies) || {};
  const SITE = (window.VOSB && window.VOSB.site && window.VOSB.site.origin) || "";

  /* ---------------- small helpers ---------------- */
  const one = (x) => (Array.isArray(x) ? x[0] : x) || null;
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const safeHref = (u) => { u = String(u == null ? "" : u).trim(); return /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : "#"; };
  const isUrl = (u) => /^https?:\/\/[^\s<>"']+$/i.test(u);
  const lab = (list, id, fb) => { const x = (list || []).find((i) => i.id === id); return x ? x.en : (id || fb || "—"); };
  const num = (v) => { v = String(v == null ? "" : v).replace(/[,\s]/g, ""); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  const bdt = (n) => (n === null || n === undefined || n === "" ? "—" : "৳" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
  const bdtShort = (n) => {
    if (n === null || n === undefined || n === "") return "";
    n = Number(n); const a = Math.abs(n);
    if (a >= 1e7) return "৳" + (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " crore";
    if (a >= 1e5) return "৳" + (n / 1e5).toFixed(2).replace(/\.?0+$/, "") + " lakh";
    return "";
  };
  const money = (n) => { const s = bdtShort(n); return n === null || n === undefined || n === "" ? "—" : bdt(n) + (s ? ` <small class="muted">(${esc(s)})</small>` : ""); };
  const stars = (n) => "★".repeat(Math.max(0, Math.min(5, n | 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n | 0)));
  const fmtSize = (b) => (!b ? "" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  const errMsg = (e) => String((e && (e.message || e.details)) || e || "Something went wrong");
  const must = (res) => { if (res && res.error) throw new Error(errMsg(res.error)); return res ? res.data : null; };
  const ST = { draft: "Draft", submitted: "Submitted", in_review: "In review", changes_requested: "Changes requested", rejected: "Rejected", published: "Published", suspended: "Suspended" };
  const stPill = (s) => `<span class="pill p-${esc(s)}">${esc(ST[s] || s)}</span>`;
  const PAYST = { pending: "Payment waiting", verified: "Paid", rejected: "Payment rejected", none: "Unpaid" };
  const payState = (list) => { const l = arr(list); return l.some((p) => p.status === "verified") ? "verified" : l.some((p) => p.status === "pending") ? "pending" : l.length ? "rejected" : "none"; };
  const payPill = (s) => `<span class="pill pay-${esc(s)}">${esc(PAYST[s] || s)}</span>`;
  const simplePill = (s) => `<span class="pill p-${esc(s)}">${esc(s)}</span>`;
  const initial = (s) => esc(((s || "?").trim()[0] || "?").toUpperCase());

  /* the pill classes live in css/admin.css ("Company Directory" block) */
  async function busy(b, fn) {
    if (b) b.disabled = true;
    try { await fn(); } catch (e) { toast(errMsg(e), "err"); }
    finally { if (b && b.isConnected) b.disabled = false; }
  }

  /* a small dialog with a note box (the built-in modal() has no text input) */
  function ask({ title, body, label = "Note", required = false, ok = "Save", danger = false, value = "", hint = "" }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate><h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ""}
        <div class="fld" style="margin:12px 0 0"><label for="co-ask">${esc(label)}${required ? " *" : ""}${hint ? ` <span class="hint">${esc(hint)}</span>` : ""}</label><textarea class="txt" id="co-ask" rows="4" maxlength="2000">${esc(value)}</textarea></div>
        <div class="msg err" hidden style="margin:10px 0 0"></div>
        <div class="acts"><button type="button" class="b b-line" data-x="0">Cancel</button><button type="submit" class="b ${danger ? "b-red" : "b-orange"}">${esc(ok)}</button></div></form>`;
      const done = (v) => { bg.remove(); document.removeEventListener("keydown", key); resolve(v); };
      const key = (e) => { if (e.key === "Escape") done(null); };
      bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-x='0']")) done(null); });
      bg.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        const v = bg.querySelector("#co-ask").value.trim();
        if (required && !v) { const m = bg.querySelector(".msg"); m.hidden = false; m.textContent = "Please write a note first."; return; }
        done(v);
      });
      document.addEventListener("keydown", key);
      document.body.appendChild(bg);
      bg.querySelector("#co-ask").focus();
    });
  }

  /* one delegated click handler per view; each view fills view._h = { action: fn } */
  function bind(view) {
    view._h = {};
    if (view._bound) return;
    view._bound = true;
    view.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (!b || !view._h[b.dataset.a]) return;
      e.preventDefault();
      view._h[b.dataset.a](b, e);
    });
  }

  /* ---------------- counts (badges, dashboard, tab counters) ---------------- */
  let cc = null, ccAt = 0;
  async function counts(force) {
    if (!force && cc && Date.now() - ccAt < 8000) return cc;
    try {
      const r = await sb.rpc("admin_company_counts");
      if (!r.error && r.data && !Array.isArray(r.data)) { cc = r.data; ccAt = Date.now(); }
    } catch (e) { /* keep the last numbers */ }
    return cc;
  }
  const bs = (c, k) => Number(c && c.by_status && c.by_status[k]) || 0;
  const waiting = (c) => bs(c, "submitted") + bs(c, "in_review");
  async function refreshBadges(force) {
    const c = await counts(force);
    const n = c ? bs(c, "submitted") + Number(c.payments_pending || 0) : 0;
    $$("[data-badge='companies']").forEach((b) => { b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n); });
  }
  function dashSection(c) {
    if (!c) return "";
    const t = (cls, href, label, val) => `<a class="tile ${cls}" href="${href}" style="text-decoration:none;color:inherit"><small>${label}</small><b>${val}</b></a>`;
    return `<h2 class="sec-h">Company Directory <span>applications, payments &amp; users</span></h2>
      <div class="tiles">
        ${t("r", "#/companies", "Applications waiting", fmtN(waiting(c)))}
        ${t("", "#/payments", "Payments waiting", fmtN(c.payments_pending))}
        ${t("g", "#/companies/all", "Published companies", fmtN(bs(c, "published")))}
        ${t("k", "#/payments", "Verified revenue", esc(bdt(c.revenue_verified)))}
        ${t("", "#/users", "Registered users", fmtN(c.users))}
        ${t("", "#/interests", "New investor interests", fmtN(c.interests_new))}
      </div>`;
  }

  /* ---------------- shared page furniture ---------------- */
  const COTABS = [["apps", "Applications", "#/companies"], ["all", "All companies", "#/companies/all"], ["pay", "Payments", "#/payments"], ["rev", "Reviews & comments", "#/reviews"], ["int", "Investor interest", "#/interests"], ["set", "Listing settings", "#/company-settings"]];
  function tabs(active, c) {
    const badge = { apps: waiting(c), pay: Number(c && c.payments_pending) || 0, int: Number(c && c.interests_new) || 0 };
    return `<div class="co-tabs" role="tablist" aria-label="Company Directory">${COTABS.map(([k, t, h]) => `<a href="${h}" role="tab" class="${k === active ? "on" : ""}" ${k === active ? 'aria-selected="true"' : ""}>${esc(t)}${badge[k] ? `<i>${badge[k] > 99 ? "99+" : badge[k]}</i>` : ""}</a>`).join("")}</div>`;
  }
  function userTabs(active, c) {
    const d = Number(c && c.deletions) || 0, u = Number(c && c.users) || 0;
    return `<div class="co-tabs" role="tablist" aria-label="Users"><a href="#/users" role="tab" class="${active === "users" ? "on" : ""}">Users${u ? `<i class="soft">${fmtN(u)}</i>` : ""}</a><a href="#/deletions" role="tab" class="${active === "del" ? "on" : ""}">Deleted accounts${d ? `<i class="soft">${fmtN(d)}</i>` : ""}</a></div>`;
  }
  const loadingCard = () => `<div class="card"><p class="muted">Loading…</p></div>`;
  const errorCard = (e) => `<div class="card"><div class="msg err">${esc(errMsg(e))}</div><p class="muted" style="font-size:.85rem">If this says "permission denied" or "relation does not exist", the Company Directory SQL (supabase/update-11-companies.sql) has not been applied to this project.</p></div>`;
  const kv = (pairs) => `<dl class="kv">${pairs.filter((p) => p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v === null || v === undefined || v === "" ? "—" : v}</dd>`).join("")}</dl>`;
  const copyBtn = (text, label) => (text ? `<button type="button" class="b b-ghost b-sm co-copy" data-a="copy" data-v="${esc(text)}" title="Copy" aria-label="Copy ${esc(label || "")}">⧉</button>` : "");

  /* ======================================================================
     Companies list  (Applications = needs action by default · All companies = everything)
     ====================================================================== */
  const LIST_COLS = "id,slug,name,tagline,status,category,stage,division,district,logo_url,verified,featured,rating_avg,rating_count,views,interest_count,submitted_at,published_at,created_at,company_private(owner_name,owner_email),listing_payments(status,amount),company_documents(id)";
  async function viewList(view, kind) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${tabs(kind, cc)}${loadingCard()}`;
    let rows, c;
    try {
      [rows, c] = await Promise.all([fetchAll(() => sb.from("companies").select(LIST_COLS).order("created_at", { ascending: false }).order("id")), counts(true)]);
      rows = must(rows) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    refreshBadges();
    const st = { q: "", status: kind === "apps" ? "action" : "all", sort: kind === "apps" ? "oldest" : "newest" };
    view.innerHTML = `<div class="page-h"><h1>Companies</h1><a class="b b-line b-sm" href="#/company-settings">Listing settings</a></div>${tabs(kind, c)}
      <div class="co-tiles tiles">
        <div class="tile r"><small>Waiting for review</small><b>${fmtN(waiting(c))}</b></div>
        <div class="tile"><small>Changes requested</small><b>${fmtN(bs(c, "changes_requested"))}</b></div>
        <div class="tile g"><small>Published</small><b>${fmtN(bs(c, "published"))}</b></div>
        <div class="tile k"><small>Total applications</small><b>${fmtN(rows.length)}</b></div>
      </div>
      <div class="co-filters">
        <input class="inp" id="q" type="search" placeholder="Search company, owner or e-mail…" aria-label="Search" autocomplete="off">
        <select class="sel" id="fs" aria-label="Status"><option value="action">Needs action (submitted + in review)</option><option value="all">All statuses</option>${Object.keys(ST).map((k) => `<option value="${k}">${ST[k]}</option>`).join("")}</select>
        <select class="sel" id="so" aria-label="Sort"><option value="newest">Newest first</option><option value="oldest">Oldest first (waiting longest)</option><option value="name">Name A–Z</option><option value="rating">Best rated</option><option value="views">Most viewed</option></select>
      </div>
      <p class="muted co-count" id="cnt" aria-live="polite"></p><div class="rows" id="list"></div>`;
    $("#fs", view).value = st.status; $("#so", view).value = st.sort;
    const paint = () => {
      const q = st.q.toLowerCase();
      let l = rows.filter((r) => {
        if (st.status === "action" ? !["submitted", "in_review"].includes(r.status) : st.status !== "all" && r.status !== st.status) return false;
        if (!q) return true;
        const p = one(r.company_private) || {};
        return [r.name, r.tagline, r.slug, p.owner_name, p.owner_email].some((x) => (x || "").toLowerCase().includes(q));
      });
      const key = { newest: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""), oldest: (a, b) => (a.submitted_at || a.created_at || "").localeCompare(b.submitted_at || b.created_at || ""),
        name: (a, b) => (a.name || "").localeCompare(b.name || ""), rating: (a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count, views: (a, b) => b.views - a.views }[st.sort];
      l = l.slice().sort(key);
      $("#cnt", view).textContent = `${l.length} ${l.length === 1 ? "company" : "companies"}`;
      $("#list", view).innerHTML = l.length ? l.map((r) => {
        const p = one(r.company_private) || {}, docs = arr(r.company_documents).length;
        return `<a class="row co-row" href="#/companies/${esc(r.id)}"><div class="th co-logo">${r.logo_url && isUrl(r.logo_url) ? `<img src="${esc(r.logo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : initial(r.name)}</div>
          <div class="ti"><h3>${esc(r.name || "(no name yet)")}${r.verified ? ' <span class="co-vf" title="Verified by VOSB">✔</span>' : ""}${r.featured ? ' <span class="co-ft" title="Featured">★</span>' : ""}</h3>
            <div class="meta">${stPill(r.status)}${payPill(payState(r.listing_payments))}<span>${esc(p.owner_name || p.owner_email || "no owner")}</span><span>${esc(lab(CFG.industries, r.category, ""))}${r.division ? " · " + esc(r.division) : ""}</span><span>📎 ${docs}</span>${r.rating_count ? `<span>★ ${Number(r.rating_avg).toFixed(1)} (${fmtN(r.rating_count)})</span>` : ""}<span>👁 ${fmtN(r.views)}</span><span>${esc(fmtD(r.submitted_at || r.created_at))}</span></div></div>
          <div class="acts"><span class="b b-line b-sm">Open →</span></div></a>`;
      }).join("") : `<div class="empty"><b>Nothing here</b>${st.status === "action" ? "No applications are waiting for review." : "No companies match these filters."}</div>`;
    };
    $("#q", view).addEventListener("input", (e) => { st.q = e.target.value.trim(); paint(); });
    $("#fs", view).addEventListener("change", (e) => { st.status = e.target.value; paint(); });
    $("#so", view).addEventListener("change", (e) => { st.sort = e.target.value; paint(); });
    view._h.copy = (b) => copyV(b);
    paint();
  }
  async function copyV(b) { toast((await copyText(b.dataset.v)) ? "Copied" : "Copy failed", "ok"); }

  /* ======================================================================
     Company detail
     ====================================================================== */
  const opt = (list, cur, blank = "— not set —") => `<option value="">${esc(blank)}</option>` + (list || []).map((o) => { const v = typeof o === "string" ? o : o.id, t = typeof o === "string" ? o : o.en; return `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(t)}</option>`; }).join("") +
    (cur && !(list || []).some((o) => (typeof o === "string" ? o : o.id) === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : "");
  const fld = (id, label, inner, hint, cls) => `<div class="fld ${cls || ""}"><label for="${id}">${esc(label)}${hint ? ` <span class="hint">${hint}</span>` : ""}</label>${inner}</div>`;
  const inp = (id, label, val, o = {}) => fld(id, label, `<input class="inp" id="${id}" type="${o.type || "text"}" value="${esc(val == null ? "" : val)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.max ? ` maxlength="${o.max}"` : ""}${o.mode ? ` inputmode="${o.mode}"` : ""} autocomplete="off">`, o.hint, o.cls);
  const area = (id, label, val, rows, max, hint) => fld(id, label, `<textarea class="txt" id="${id}" rows="${rows}" maxlength="${max}">${esc(val == null ? "" : val)}</textarea>`, hint);
  const sel = (id, label, inner, hint) => fld(id, label, `<select class="sel" id="${id}">${inner}</select>`, hint);

  function transitions(s) {
    const T = {
      submitted: [["in_review", "Start review", "b-dark"], ["published", "Publish", "b-green"], ["changes_requested", "Request changes", "b-line"], ["rejected", "Reject", "b-red"]],
      in_review: [["published", "Publish", "b-green"], ["changes_requested", "Request changes", "b-line"], ["rejected", "Reject", "b-red"]],
      changes_requested: [["in_review", "Move to review", "b-dark"], ["published", "Publish", "b-green"], ["rejected", "Reject", "b-red"]],
      rejected: [["in_review", "Re-open for review", "b-dark"]],
      published: [["suspended", "Suspend", "b-red"], ["in_review", "Unpublish → in review", "b-line"], ["changes_requested", "Request changes", "b-line"]],
      suspended: [["published", "Re-publish", "b-green"], ["in_review", "Unpublish → in review", "b-line"]],
      draft: [["in_review", "Move to review", "b-dark"], ["published", "Publish now", "b-green"]],
    };
    return T[s] || [];
  }

  async function viewCompany(view, id) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Company</h1></div>${loadingCard()}`;
    let c, reviews, comments, interests;
    try {
      const [a, r, m, i] = await Promise.all([
        sb.from("companies").select("*, company_private(*), listing_payments(*), company_documents(*), company_admin_notes(*)").eq("id", id).maybeSingle(),
        sb.from("company_reviews").select("*").eq("company_id", id).order("created_at", { ascending: false }),
        sb.from("company_comments").select("*").eq("company_id", id).order("created_at", { ascending: true }),
        sb.from("company_interests").select("*").eq("company_id", id).order("created_at", { ascending: false }),
      ]);
      c = must(a); reviews = must(r) || []; comments = must(m) || []; interests = must(i) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Company</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    if (!c) { view.innerHTML = `<div class="page-h"><h1>Company</h1></div><div class="card"><div class="empty"><b>Company not found</b><a class="b b-line" href="#/companies">← Back to companies</a></div></div>`; return; }
    const p = one(c.company_private) || {}, note = one(c.company_admin_notes) || {};
    const pays = arr(c.listing_payments).sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
    const docs = arr(c.company_documents).sort((x, y) => (x.created_at || "").localeCompare(y.created_at || ""));
    const soc = c.social && typeof c.social === "object" ? c.social : {};
    const team = Array.isArray(c.team) ? c.team : [];
    const divs = Object.keys(CFG.divisions || {});
    const dists = (CFG.divisions && CFG.divisions[c.division]) || [];
    const reqMissing = (CFG.docTypes || []).filter((d) => d.required && !docs.some((x) => x.doc_type === d.id));
    const pub = c.status === "published" && c.slug;

    const payCard = pays.length ? pays.map((x) => `<div class="co-pay">
        <div class="co-pay-h"><b>${esc(bdt(x.amount))}</b> ${simplePay(x.status)}<span class="muted">${esc(String(x.method || "").toUpperCase())} · ${esc(fmtDT(x.created_at))}</span></div>
        ${kv([["Invoice", `<code>${esc(x.invoice_no)}</code> ${copyBtn(x.invoice_no, "invoice")}`], ["TrxID", `<code class="co-trx">${esc(x.trx_id)}</code> ${copyBtn(x.trx_id, "TrxID")}`], ["Sent from", `${esc(x.sender_msisdn)} ${copyBtn(x.sender_msisdn, "number")}`], ["Account", esc(x.user_email || "")], x.verified_at ? ["Verified", `${esc(fmtDT(x.verified_at))}${x.verified_by ? " · " + esc(x.verified_by) : ""}`] : null, x.note ? ["Note", esc(x.note)] : null])}
        <div class="acts co-acts">${x.status !== "verified" ? `<button type="button" class="b b-green b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="verified">${x.status === "rejected" ? "Verify anyway" : "Verify payment"}</button>` : ""}
          ${x.status === "pending" ? `<button type="button" class="b b-red b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="rejected">Reject</button>` : ""}
          ${x.status === "verified" ? `<button type="button" class="b b-line b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="pending">Undo → waiting</button>` : ""}
          ${x.status === "rejected" ? `<button type="button" class="b b-line b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="pending">Re-open</button>` : ""}</div></div>`).join("")
      : `<p class="muted">No payment yet. The applicant must pay the one-time listing fee (${esc(bdt(CFG.fee))}) before they can submit.</p>`;

    const docRows = docs.length ? docs.map((d) => `<div class="co-doc" data-doc="${esc(d.id)}">
        <div class="co-doc-i"><b>${esc(lab(CFG.docTypes, d.doc_type))}</b><span class="meta">${esc(d.file_name || "file")} ${d.file_size ? "· " + esc(fmtSize(d.file_size)) : ""} · ${esc(fmtD(d.created_at))}</span>${d.note ? `<span class="meta">Note: ${esc(d.note)}</span>` : ""}</div>
        <div class="co-doc-s">${simplePill(d.status)}</div>
        <div class="acts"><button type="button" class="b b-line b-sm" data-a="doc-view" data-path="${esc(d.file_path)}">View</button>
          <button type="button" class="b b-green b-sm" data-a="doc-set" data-id="${esc(d.id)}" data-s="accepted"${d.status === "accepted" ? " disabled" : ""}>Accept</button>
          <button type="button" class="b b-red b-sm" data-a="doc-set" data-id="${esc(d.id)}" data-s="rejected"${d.status === "rejected" ? " disabled" : ""}>Reject</button></div></div>`).join("")
      : `<p class="muted">No documents uploaded yet.</p>`;

    view.innerHTML = `
      <div class="page-h"><div><a class="muted" href="#/companies" style="font-size:.88rem">← All applications</a><h1 style="margin-top:2px">${esc(c.name || "(no name yet)")}</h1></div>
        <div class="co-top-acts">${stPill(c.status)}${payPill(payState(pays))}${pub ? `<a class="b b-line b-sm" href="${esc(safeHref("/company/" + c.slug))}" target="_blank" rel="noopener">View public page ↗</a>` : ""}</div></div>
      ${p.review_note ? `<div class="msg info"><b>Last note to the applicant:</b> ${esc(p.review_note)}</div>` : ""}
      ${reqMissing.length && ["draft", "changes_requested", "submitted", "in_review"].includes(c.status) ? `<div class="msg err">Required documents missing: ${reqMissing.map((d) => esc(d.en)).join(", ")}.</div>` : ""}
      <form id="cof" novalidate>
      <div class="co-grid">
        <div class="co-main">
          <div class="card"><h2>Public profile</h2><p class="muted co-sub">Shown on the company page (admin can edit anything).</p>
            <div class="co-2">${inp("f-name", "Company / brand name", c.name, { max: 120 })}${inp("f-tag", "Tagline", c.tagline, { max: 160 })}</div>
            ${area("f-desc", "About the company", c.description, 6, 6000)}
            <div class="co-3">${sel("f-cat", "Industry", opt(CFG.industries, c.category))}${sel("f-stage", "Stage", opt(CFG.stages, c.stage))}${inp("f-year", "Founded (year)", c.founded_year, { mode: "numeric", max: 4 })}</div>
            <div class="co-3">${sel("f-div", "Division", opt(divs, c.division))}${sel("f-dist", "District", opt(dists, c.district))}${sel("f-size", "Team size", opt(CFG.teamSizes, c.team_size))}</div>
            <div class="co-2">${inp("f-web", "Website", c.website, { type: "url", ph: "https://", max: 300 })}${sel("f-rev", "Revenue", opt(CFG.revenueRanges, c.revenue_range))}</div>
            ${area("f-model", "Business model", c.business_model, 3, 1500)}${area("f-high", "Highlights / traction", c.highlights, 3, 1500)}
            ${area("f-team", "Team (one per line:  Name | Role)", team.map((t) => `${t.name || ""} | ${t.role || ""}`).join("\n"), 4, 1200)}
          </div>
          <div class="card"><h2>Funding</h2>
            <div class="co-3">${inp("f-seek", "Seeking (৳)", c.seeking_amount, { mode: "decimal" })}${inp("f-eq", "Equity offered (%)", c.equity_offered, { mode: "decimal" })}${inp("f-exv", "Founder's valuation (৳)", c.expected_valuation, { mode: "decimal" })}</div>
            ${area("f-use", "Use of funds", c.use_of_funds, 3, 1500)}</div>
          <div class="card"><h2>Images &amp; links</h2>
            <div class="co-2">${inp("f-logo", "Logo URL", c.logo_url, { type: "url", ph: "https://", max: 400 })}${inp("f-cover", "Cover image URL", c.cover_url, { type: "url", ph: "https://", max: 400 })}</div>
            <div class="co-3">${["facebook", "linkedin", "x", "instagram", "youtube"].map((k) => inp("f-s-" + k, k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1), soc[k], { type: "url", ph: "https://", max: 300 })).join("")}</div></div>
          <div class="card"><h2>Legal &amp; contact <span class="pill p-draft" style="vertical-align:middle">PRIVATE</span></h2><p class="muted co-sub">Only the owner and you can see this. Never shown on the site.</p>
            <div class="co-2">${inp("f-legal", "Registered legal name", p.legal_name, { max: 160 })}${inp("f-regt", "Registration type", p.reg_type, { max: 40, ph: "e.g. Limited company, Partnership, Sole proprietorship" })}</div>
            <div class="co-3">${inp("f-regn", "Registration no.", p.reg_no, { max: 60 })}${inp("f-tin", "TIN", p.tin, { max: 40 })}${inp("f-bin", "BIN (VAT)", p.bin, { max: 40 })}</div>
            <div class="co-2">${inp("f-cmail", "Contact e-mail", p.contact_email, { type: "email", max: 200 })}${inp("f-cph", "Contact phone", p.contact_phone, { max: 30 })}</div>
            ${area("f-addr", "Address", p.address, 2, 400)}</div>
        </div>
        <div class="co-side">
          <div class="card"><h2>Review &amp; status</h2>
            <p>${stPill(c.status)} ${c.submitted_at ? `<span class="muted" style="font-size:.82rem">submitted ${esc(fmtDT(c.submitted_at))}</span>` : ""}</p>
            <div class="co-wf">${transitions(c.status).map(([s, t, cls]) => `<button type="button" class="b ${cls} b-sm" data-a="st" data-s="${s}">${esc(t)}</button>`).join("")}</div>
            <p class="muted co-sub" style="margin-top:10px">“Request changes” and “Reject” need a note — the applicant sees it. Publishing makes the company page live.</p></div>
          <div class="card"><h2>Payment</h2>${payCard}</div>
          <div class="card"><h2>Documents</h2>${docRows}<p class="muted co-sub" id="doclink"></p></div>
          <div class="card"><h2>VOSB assessment</h2><p class="muted co-sub">Shown publicly as “VOSB assessed valuation (indicative)”.</p>
            ${inp("f-vv", "VOSB valuation (৳)", c.vosb_valuation, { mode: "decimal" })}
            ${inp("f-vd", "Valuation date", c.valuation_date, { type: "date" })}
            ${area("f-vn", "Basis / note (public)", c.valuation_note, 3, 1000)}
            <label class="chk"><input type="checkbox" id="f-ver"${c.verified ? " checked" : ""}> Verified by VOSB ✔${c.verified_at ? ` <span class="muted" style="font-weight:500">since ${esc(fmtD(c.verified_at))}</span>` : ""}</label>
            <label class="chk" style="margin-top:8px"><input type="checkbox" id="f-feat"${c.featured ? " checked" : ""}> Featured on the directory</label>
            ${inp("f-slug", "Page address (slug)", c.slug, { max: 80, ph: "created on publish", hint: "a–z, 0–9, hyphens", cls: "co-slug" })}</div>
          <div class="card"><h2>Owner</h2>${kv([["Name", esc(p.owner_name)], ["E-mail", p.owner_email ? `<a href="mailto:${esc(p.owner_email)}">${esc(p.owner_email)}</a>` : ""], ["Phone", esc(p.owner_phone)], ["Account ID", p.owner_id ? `<code>${esc(String(p.owner_id).slice(0, 8))}…</code> ${copyBtn(p.owner_id, "id")}` : "<span class='muted'>account deleted</span>"], ["Terms accepted", p.accepted_terms ? "Yes" + (p.accepted_at ? " · " + esc(fmtD(p.accepted_at)) : "") : "No"], ["Created", esc(fmtDT(c.created_at))], c.published_at ? ["Published", esc(fmtDT(c.published_at))] : null, ["Views", fmtN(c.views)], ["Rating", c.rating_count ? `${Number(c.rating_avg).toFixed(2)} (${fmtN(c.rating_count)})` : "—"], ["Investor interests", fmtN(c.interest_count)]])}</div>
          <div class="card"><h2>Admin note <span class="pill p-draft" style="vertical-align:middle">ONLY YOU</span></h2>
            <textarea class="txt" id="f-note" rows="4" maxlength="4000" placeholder="Private notes: what you checked, calls made, red flags…" aria-label="Admin note">${esc(note.note || "")}</textarea>
            <p style="margin-top:8px"><button type="button" class="b b-line b-sm" data-a="note">Save note</button> ${note.updated_at ? `<span class="muted" style="font-size:.8rem">saved ${esc(fmtDT(note.updated_at))}</span>` : ""}</p></div>
        </div>
      </div>
      <div class="co-savebar"><span class="muted" id="dirty">All changes saved</span><button class="b b-orange" id="savebtn" type="submit">Save changes</button></div>
      </form>
      <div class="card co-sec"><h2>Reviews <span class="muted">(${fmtN(reviews.length)})</span></h2>${reviews.length ? reviews.map((r) => reviewItem(r)).join("") : `<p class="muted">No reviews yet.</p>`}</div>
      <div class="card co-sec"><h2>Comments <span class="muted">(${fmtN(comments.length)})</span></h2>${comments.length ? comments.map((r) => commentItem(r)).join("") : `<p class="muted">No comments yet.</p>`}</div>
      <div class="card co-sec"><h2>Investor interest <span class="muted">(${fmtN(interests.length)})</span></h2>${interests.length ? interests.map((r) => interestItem(r)).join("") : `<p class="muted">No investor has shown interest yet.</p>`}</div>`;

    /* ---- form state ---- */
    const form = $("#cof", view);
    let dirty = false;
    const setDirty = (v) => { dirty = v; const d = $("#dirty", view); if (d) { d.textContent = v ? "Unsaved changes" : "All changes saved"; d.classList.toggle("is-dirty", v); } };
    form.addEventListener("input", () => setDirty(true));
    form.addEventListener("change", () => setDirty(true));
    $("#f-div", view).addEventListener("change", (e) => { const l = (CFG.divisions && CFG.divisions[e.target.value]) || []; $("#f-dist", view).innerHTML = opt(l, ""); });
    const v = (sid) => ($("#" + sid, view).value || "").trim();

    function collect() {
      const bad = (m, fid) => { const e = new Error(m); e.fid = fid; throw e; };
      const urls = { "f-web": "Website", "f-logo": "Logo URL", "f-cover": "Cover image URL" };
      ["facebook", "linkedin", "x", "instagram", "youtube"].forEach((k) => (urls["f-s-" + k] = k + " link"));
      for (const fid of Object.keys(urls)) { const x = v(fid); if (x && !isUrl(x)) bad(`${urls[fid]} must start with http:// or https://`, fid); }
      const ns = {}; [["f-seek", "Seeking amount", 1e13], ["f-eq", "Equity offered", 100], ["f-exv", "Founder's valuation", 1e13], ["f-vv", "VOSB valuation", 1e13]].forEach(([fid, t, max]) => {
        const n = num(v(fid)); if (Number.isNaN(n) || (n !== null && (n < 0 || n > max))) bad(`${t} must be a number between 0 and ${max.toLocaleString("en-IN")}`, fid); ns[fid] = n; });
      const yr = num(v("f-year")); if (Number.isNaN(yr) || (yr !== null && (yr < 1900 || yr > 2100 || yr % 1))) bad("Founded year must be between 1900 and 2100", "f-year");
      const cm = v("f-cmail"); if (cm && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cm)) bad("Contact e-mail is not valid", "f-cmail");
      const slug = v("f-slug").toLowerCase(); if (slug && !/^[a-z0-9][a-z0-9-]{1,78}$/.test(slug)) bad("Slug: use a–z, 0–9 and hyphens (2–79 characters)", "f-slug");
      if (c.status === "published" && !slug) bad("A published company needs a page address (slug)", "f-slug");
      const social = {}; ["facebook", "linkedin", "x", "instagram", "youtube"].forEach((k) => { const x = v("f-s-" + k); if (x) social[k] = x; });
      const tm = v("f-team").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => { const [n, ...r] = l.split("|"); return { name: n.trim().slice(0, 80), role: r.join("|").trim().slice(0, 80) }; }).filter((t) => t.name);
      const ver = $("#f-ver", view).checked, vd = v("f-vd");
      const nz = (x) => (x === "" ? null : x);
      return {
        pub: { name: nz(v("f-name")), tagline: nz(v("f-tag")), description: nz(v("f-desc")), category: nz(v("f-cat")), stage: nz(v("f-stage")), founded_year: yr, website: nz(v("f-web")), social, team: tm,
          logo_url: nz(v("f-logo")), cover_url: nz(v("f-cover")), team_size: nz(v("f-size")), business_model: nz(v("f-model")), division: nz(v("f-div")), district: nz(v("f-dist")), revenue_range: nz(v("f-rev")),
          seeking_amount: ns["f-seek"], equity_offered: ns["f-eq"], expected_valuation: ns["f-exv"], use_of_funds: nz(v("f-use")), highlights: nz(v("f-high")),
          vosb_valuation: ns["f-vv"], valuation_date: nz(vd), valuation_note: nz(v("f-vn")), verified: ver, verified_at: ver ? (c.verified_at || new Date().toISOString()) : null,
          featured: $("#f-feat", view).checked, slug: nz(slug) },
        priv: { legal_name: nz(v("f-legal")), reg_type: nz(v("f-regt")), reg_no: nz(v("f-regn")), tin: nz(v("f-tin")), bin: nz(v("f-bin")), contact_email: nz(cm.toLowerCase()), contact_phone: nz(v("f-cph")), address: nz(v("f-addr")) },
      };
    }
    async function save(quiet) {
      let d;
      try { d = collect(); } catch (e) { toast(errMsg(e), "err"); if (e.fid) { const el = $("#" + e.fid, view); if (el) el.focus(); } return false; }
      const a = await sb.from("companies").update(d.pub).eq("id", id).select("id");
      if (a.error) throw new Error(errMsg(a.error));
      if (!a.data || !a.data.length) throw new Error("Nothing was saved (permission denied). Sign in again as the administrator.");
      const b = await sb.from("company_private").update(d.priv).eq("company_id", id).select("company_id");
      if (b.error) throw new Error(errMsg(b.error));
      setDirty(false);
      if (!quiet) toast("Saved", "ok");
      return true;
    }
    const reload = async () => { const y = window.scrollY; await viewCompany(view, id); window.scrollTo(0, y); refreshBadges(true); };
    form.addEventListener("submit", (e) => { e.preventDefault(); busy($("#savebtn", view), async () => { if (await save()) await reload(); }); });

    /* ---- actions ---- */
    view._h.copy = (b) => copyV(b);
    view._h.note = (b) => busy(b, async () => {
      const t = v("f-note");
      must(await sb.from("company_admin_notes").upsert({ company_id: id, note: t || null, updated_at: new Date().toISOString() }, { onConflict: "company_id" }));
      toast("Note saved", "ok");
    });
    view._h.st = (b) => busy(b, async () => {
      const s = b.dataset.s;
      let n = null;
      if (s === "changes_requested") { n = await ask({ title: "Request changes", body: "Tell the applicant exactly what to fix. They will see this note and can edit and re-submit (no new payment needed).", label: "Note to applicant", required: true, ok: "Send request" }); if (n === null) return; }
      else if (s === "rejected") { n = await ask({ title: "Reject this application", body: "The applicant will see this reason. Rejected applications are closed.", label: "Reason", required: true, ok: "Reject", danger: true }); if (n === null) return; }
      else if (s === "suspended") { n = await ask({ title: "Suspend this company", body: "It disappears from the public directory until you re-publish. The owner sees your note.", label: "Reason (optional)", ok: "Suspend", danger: true }); if (n === null) return; }
      else if (s === "published") { if (!(await modal({ title: c.status === "published" ? "Publish again?" : "Publish this company?", body: "The company page becomes public and appears in the directory.", ok: "Publish" }))) return; }
      else if (s === "in_review" && c.status === "published") { if (!(await modal({ title: "Unpublish?", body: "The company page is hidden and the application goes back to “In review”.", ok: "Unpublish" }))) return; }
      if (dirty && !(await save(true))) return;
      must(await sb.rpc("admin_set_company_status", { p_id: id, p_status: s, p_note: n || null }));
      toast("Status: " + (ST[s] || s), "ok");
      await reload();
    });
    view._h.pay = (b) => busy(b, async () => {
      const s = b.dataset.s; let n = null;
      if (s === "rejected") { n = await ask({ title: "Reject this payment", body: "The applicant sees this note on their payment screen (e.g. “TrxID not found in our bKash account”).", label: "Reason", required: true, ok: "Reject payment", danger: true }); if (n === null) return; }
      else if (s === "verified") { if (!(await modal({ title: "Confirm payment received?", body: "Only verify after you see this exact TrxID and amount in the bKash account. The applicant can then submit the application.", ok: "Yes, verified" }))) return; }
      must(await sb.rpc("admin_set_payment_status", { p_id: b.dataset.id, p_status: s, p_note: n || null }));
      toast(s === "verified" ? "Payment verified" : s === "rejected" ? "Payment rejected" : "Payment set to waiting", "ok");
      await reload();
    });
    view._h["doc-view"] = (b) => busy(b, async () => {
      const r = await sb.storage.from("company-docs").createSignedUrl(b.dataset.path, 300);
      if (r.error || !r.data || !r.data.signedUrl) throw new Error(errMsg(r.error || "Could not open the file"));
      const a = document.createElement("a"); a.href = r.data.signedUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
      const dl = $("#doclink", view); if (dl) dl.innerHTML = `If the file did not open, <a href="${esc(r.data.signedUrl)}" target="_blank" rel="noopener noreferrer">tap here</a> (private link, valid for 5 minutes).`;
    });
    view._h["doc-set"] = (b) => busy(b, async () => {
      const s = b.dataset.s; let n = null;
      if (s === "rejected") { n = await ask({ title: "Reject this document", body: "Say what is wrong (unclear scan, expired licence…). The applicant sees it.", label: "Reason", required: true, ok: "Reject document", danger: true }); if (n === null) return; }
      const r = await sb.from("company_documents").update({ status: s, note: n || null }).eq("id", b.dataset.id).select("id");
      if (r.error) throw new Error(errMsg(r.error));
      toast("Document " + s, "ok"); await reload();
    });
    modActions(view, reload);
  }
  const simplePay = (s) => `<span class="pill pay-${esc(s)}">${esc({ pending: "Waiting", verified: "Verified", rejected: "Rejected" }[s] || s)}</span>`;

  /* ---- reviews / comments / interests (shared by detail page + hubs) ---- */
  function reviewItem(r, co) {
    return `<div class="co-item${r.status === "hidden" ? " is-hidden" : ""}"><div class="co-item-h"><b class="co-stars" aria-label="${esc(r.rating)} of 5">${stars(r.rating)}</b>${r.title ? `<span>${esc(r.title)}</span>` : ""}${r.status === "hidden" ? simplePill("hidden") : ""}</div>
      ${r.body ? `<p>${esc(r.body)}</p>` : ""}<div class="meta">${esc(r.author_name)} · ${esc(fmtDT(r.created_at))}${co ? ` · <a href="#/companies/${esc(r.company_id)}">${esc((one(r.companies) || {}).name || "company")}</a>` : ""}</div>
      <div class="acts"><button type="button" class="b b-line b-sm" data-a="mod" data-t="company_reviews" data-id="${esc(r.id)}" data-s="${r.status === "hidden" ? "published" : "hidden"}">${r.status === "hidden" ? "Show" : "Hide"}</button><button type="button" class="b b-red b-sm" data-a="mod-del" data-t="company_reviews" data-id="${esc(r.id)}">Delete</button></div></div>`;
  }
  function commentItem(r, co) {
    return `<div class="co-item${r.status === "hidden" ? " is-hidden" : ""}"><div class="co-item-h"><b>${esc(r.author_name)}</b>${r.by_owner ? '<span class="pill p-published">OWNER</span>' : ""}${r.parent_id ? '<span class="muted">↳ reply</span>' : ""}${r.status === "hidden" ? simplePill("hidden") : ""}</div>
      <p>${esc(r.body)}</p><div class="meta">${esc(fmtDT(r.created_at))}${co ? ` · <a href="#/companies/${esc(r.company_id)}">${esc((one(r.companies) || {}).name || "company")}</a>` : ""}</div>
      <div class="acts"><button type="button" class="b b-line b-sm" data-a="mod" data-t="company_comments" data-id="${esc(r.id)}" data-s="${r.status === "hidden" ? "published" : "hidden"}">${r.status === "hidden" ? "Show" : "Hide"}</button><button type="button" class="b b-red b-sm" data-a="mod-del" data-t="company_comments" data-id="${esc(r.id)}">Delete</button></div></div>`;
  }
  function interestItem(r, co) {
    const range = r.ticket_min || r.ticket_max ? `${bdt(r.ticket_min || 0)} – ${bdt(r.ticket_max || 0)}` : "not stated";
    return `<div class="co-item"><div class="co-item-h"><b>${esc(r.investor_name || "Investor")}</b><span class="pill p-in_review">${esc(lab(CFG.investorTypes, r.investor_type))}</span>${r.share_contact ? '<span class="pill p-published">contact shared with company</span>' : '<span class="pill p-draft">contact hidden from company</span>'}</div>
      <p>${esc(r.message)}</p>
      <div class="meta"><span>Ticket: ${esc(range)}</span>${r.investor_email ? `<span><a href="mailto:${esc(r.investor_email)}">${esc(r.investor_email)}</a></span>` : ""}${r.investor_phone ? `<span>${esc(r.investor_phone)}</span>` : ""}<span>${esc(fmtDT(r.created_at))}</span>${co ? `<a href="#/companies/${esc(r.company_id)}">${esc((one(r.companies) || {}).name || "company")}</a>` : ""}</div>
      <div class="acts"><label class="co-st">Status <select class="sel" data-c="int" data-id="${esc(r.id)}" aria-label="Status">${["new", "contacted", "closed"].map((s) => `<option value="${s}"${r.status === s ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}</select></label></div></div>`;
  }
  function modActions(view, reload) {
    view._h.mod = (b) => busy(b, async () => {
      const t = b.dataset.t; if (!["company_reviews", "company_comments"].includes(t)) return;
      const r = await sb.from(t).update({ status: b.dataset.s }).eq("id", b.dataset.id).select("id");
      if (r.error) throw new Error(errMsg(r.error));
      toast(b.dataset.s === "hidden" ? "Hidden from the public" : "Visible again", "ok"); await reload();
    });
    view._h["mod-del"] = (b) => busy(b, async () => {
      const t = b.dataset.t; if (!["company_reviews", "company_comments"].includes(t)) return;
      if (!(await modal({ title: "Delete permanently?", body: t === "company_reviews" ? "This review is removed and the rating is recalculated. This cannot be undone. (Tip: “Hide” keeps it but removes it from the public page.)" : "This comment (and any replies under it) is removed. This cannot be undone. (Tip: “Hide” keeps it.)", ok: "Delete", danger: true }))) return;
      const r = await sb.from(t).delete().eq("id", b.dataset.id).select("id");
      if (r.error) throw new Error(errMsg(r.error));
      toast("Deleted", "ok"); await reload();
    });
    if (!view._cBound) {
      view._cBound = true;
      view.addEventListener("change", (e) => {
        const el = e.target.closest("[data-c='int']"); if (!el) return;
        busy(el, async () => {
          const r = await sb.from("company_interests").update({ status: el.value }).eq("id", el.dataset.id).select("id");
          if (r.error) throw new Error(errMsg(r.error));
          toast("Status updated", "ok"); refreshBadges(true);
        });
      });
    }
  }

  /* ======================================================================
     Payments hub
     ====================================================================== */
  async function viewPayments(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${tabs("pay", cc)}${loadingCard()}`;
    let rows, c;
    try {
      [rows, c] = await Promise.all([fetchAll(() => sb.from("listing_payments").select("*, companies(id,name,slug)").order("created_at", { ascending: false }).order("id")), counts(true)]);
      rows = must(rows) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    refreshBadges();
    const st = { q: "", s: "all" };
    view.innerHTML = `<div class="page-h"><h1>Payments</h1></div>${tabs("pay", c)}
      <div class="tiles co-tiles"><div class="tile r"><small>Waiting for verification</small><b>${fmtN(c ? c.payments_pending : 0)}</b></div><div class="tile g"><small>Verified payments</small><b>${fmtN(c ? c.payments_verified : 0)}</b></div><div class="tile k"><small>Verified revenue</small><b>${esc(bdt(c ? c.revenue_verified : 0))}</b></div></div>
      <div class="msg info">bKash “Send Money” cannot be confirmed automatically. Open your bKash app/SMS, find the TrxID shown below with the same amount, then press <b>Verify</b>. The applicant's screen unlocks by itself.</div>
      <div class="co-filters"><input class="inp" id="q" type="search" placeholder="Search TrxID, invoice, number, e-mail, company…" aria-label="Search" autocomplete="off">
        <select class="sel" id="fs" aria-label="Status"><option value="all">All payments</option><option value="pending">Waiting</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></div>
      <p class="muted co-count" id="cnt" aria-live="polite"></p><div class="rows" id="list"></div>`;
    const order = { pending: 0, verified: 1, rejected: 2 };
    const paint = () => {
      const q = st.q.toLowerCase();
      const l = rows.filter((r) => (st.s === "all" || r.status === st.s) && (!q || [r.trx_id, r.invoice_no, r.sender_msisdn, r.user_email, (one(r.companies) || {}).name].some((x) => (x || "").toLowerCase().includes(q))))
        .sort((a, b) => order[a.status] - order[b.status] || (a.status === "pending" ? (a.created_at || "").localeCompare(b.created_at || "") : (b.created_at || "").localeCompare(a.created_at || "")));
      $("#cnt", view).textContent = `${l.length} payment${l.length === 1 ? "" : "s"}`;
      $("#list", view).innerHTML = l.length ? l.map((x) => { const co = one(x.companies);
        return `<div class="row co-pay-row"><div class="th co-logo">৳</div><div class="ti"><h3>${esc(bdt(x.amount))} <small>· ${esc(String(x.method).toUpperCase())}</small> ${simplePay(x.status)}</h3>
          <div class="meta"><span>TrxID <code class="co-trx">${esc(x.trx_id)}</code> ${copyBtn(x.trx_id, "TrxID")}</span><span>from ${esc(x.sender_msisdn)}</span><span>${esc(x.user_email || "")}</span><span>${esc(fmtDT(x.created_at))}</span></div>
          <div class="meta">${co ? `<a href="#/companies/${esc(co.id)}">${esc(co.name || "(no name yet)")} →</a>` : "<span>company removed</span>"}<span>Invoice ${esc(x.invoice_no)}</span>${x.note ? `<span>Note: ${esc(x.note)}</span>` : ""}${x.verified_at ? `<span>verified ${esc(fmtD(x.verified_at))}</span>` : ""}</div></div>
          <div class="acts">${x.status !== "verified" ? `<button type="button" class="b b-green b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="verified">Verify</button>` : ""}${x.status === "pending" ? `<button type="button" class="b b-red b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="rejected">Reject</button>` : ""}${x.status === "verified" ? `<button type="button" class="b b-line b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="pending">Undo</button>` : ""}${x.status === "rejected" ? `<button type="button" class="b b-line b-sm" data-a="pay" data-id="${esc(x.id)}" data-s="pending">Re-open</button>` : ""}</div></div>`; }).join("")
        : `<div class="empty"><b>No payments</b>Nothing matches these filters.</div>`;
    };
    $("#q", view).addEventListener("input", (e) => { st.q = e.target.value.trim(); paint(); });
    $("#fs", view).addEventListener("change", (e) => { st.s = e.target.value; paint(); });
    view._h.copy = (b) => copyV(b);
    view._h.pay = (b) => busy(b, async () => {
      const s = b.dataset.s; let n = null;
      if (s === "rejected") { n = await ask({ title: "Reject this payment", body: "The applicant sees this note (e.g. “TrxID not found in our bKash account”).", label: "Reason", required: true, ok: "Reject payment", danger: true }); if (n === null) return; }
      else if (s === "verified") { if (!(await modal({ title: "Confirm payment received?", body: "Only verify after you see this exact TrxID and amount in the bKash account.", ok: "Yes, verified" }))) return; }
      must(await sb.rpc("admin_set_payment_status", { p_id: b.dataset.id, p_status: s, p_note: n || null }));
      toast(s === "verified" ? "Payment verified" : s === "rejected" ? "Payment rejected" : "Payment set to waiting", "ok");
      await viewPayments(view); refreshBadges(true);
    });
    paint();
  }

  /* ======================================================================
     Reviews & comments moderation hub
     ====================================================================== */
  async function viewReviews(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${tabs("rev", cc)}${loadingCard()}`;
    let revs, coms, c;
    try {
      [revs, coms, c] = await Promise.all([
        fetchAll(() => sb.from("company_reviews").select("*, companies(id,name,slug)").order("created_at", { ascending: false }).order("id")),
        fetchAll(() => sb.from("company_comments").select("*, companies(id,name,slug)").order("created_at", { ascending: false }).order("id")), counts()]);
      revs = must(revs) || []; coms = must(coms) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const st = { kind: view._kind || "reviews", s: "all", q: "" };
    view.innerHTML = `<div class="page-h"><h1>Reviews &amp; comments</h1></div>${tabs("rev", c)}
      <div class="co-filters"><div class="seg" id="kind" role="group" aria-label="Type"><button type="button" data-k="reviews">Reviews (${fmtN(revs.length)})</button><button type="button" data-k="comments">Comments (${fmtN(coms.length)})</button></div>
        <input class="inp" id="q" type="search" placeholder="Search text, author, company…" aria-label="Search" autocomplete="off">
        <select class="sel" id="fs" aria-label="Visibility"><option value="all">Everything</option><option value="published">Visible</option><option value="hidden">Hidden</option></select></div>
      <p class="muted co-count" id="cnt" aria-live="polite"></p><div class="co-list" id="list"></div>`;
    const paint = () => {
      $$("#kind button", view).forEach((b) => b.classList.toggle("on", b.dataset.k === st.kind));
      const src = st.kind === "reviews" ? revs : coms, q = st.q.toLowerCase();
      const l = src.filter((r) => (st.s === "all" || r.status === st.s) && (!q || [r.body, r.title, r.author_name, (one(r.companies) || {}).name].some((x) => (x || "").toLowerCase().includes(q))));
      $("#cnt", view).textContent = `${l.length} ${st.kind === "reviews" ? "review" : "comment"}${l.length === 1 ? "" : "s"}`;
      $("#list", view).innerHTML = l.length ? l.map((r) => `<div class="card co-card">${st.kind === "reviews" ? reviewItem(r, true) : commentItem(r, true)}</div>`).join("") : `<div class="empty"><b>Nothing here</b>No ${st.kind} match.</div>`;
    };
    $$("#kind button", view).forEach((b) => b.addEventListener("click", () => { st.kind = b.dataset.k; paint(); }));
    $("#q", view).addEventListener("input", (e) => { st.q = e.target.value.trim(); paint(); });
    $("#fs", view).addEventListener("change", (e) => { st.s = e.target.value; paint(); });
    modActions(view, async () => { const k = st.kind; view._kind = k; await viewReviews(view); });
    paint();
  }

  /* ======================================================================
     Investor interest hub
     ====================================================================== */
  async function viewInterests(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${tabs("int", cc)}${loadingCard()}`;
    let rows, c;
    try {
      [rows, c] = await Promise.all([fetchAll(() => sb.from("company_interests").select("*, companies(id,name,slug)").order("created_at", { ascending: false }).order("id")), counts(true)]);
      rows = must(rows) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    refreshBadges();
    const st = { s: "all", q: "" };
    view.innerHTML = `<div class="page-h"><h1>Investor interest</h1></div>${tabs("int", c)}
      <div class="msg info">You always see the investor's contact details. The company owner only sees them when the investor ticked “share my contact”.</div>
      <div class="co-filters"><input class="inp" id="q" type="search" placeholder="Search investor, company, message…" aria-label="Search" autocomplete="off">
        <select class="sel" id="fs" aria-label="Status"><option value="all">All</option><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></div>
      <p class="muted co-count" id="cnt" aria-live="polite"></p><div class="co-list" id="list"></div>`;
    const paint = () => {
      const q = st.q.toLowerCase();
      const l = rows.filter((r) => (st.s === "all" || r.status === st.s) && (!q || [r.investor_name, r.investor_email, r.message, (one(r.companies) || {}).name].some((x) => (x || "").toLowerCase().includes(q))));
      $("#cnt", view).textContent = `${l.length} interest${l.length === 1 ? "" : "s"}`;
      $("#list", view).innerHTML = l.length ? l.map((r) => `<div class="card co-card">${interestItem(r, true)}</div>`).join("") : `<div class="empty"><b>Nothing here</b>No investor interest yet.</div>`;
    };
    $("#q", view).addEventListener("input", (e) => { st.q = e.target.value.trim(); paint(); });
    $("#fs", view).addEventListener("change", (e) => { st.s = e.target.value; paint(); });
    modActions(view, () => viewInterests(view));
    paint();
  }

  /* ======================================================================
     Listing settings (fee + payment methods)
     ====================================================================== */
  async function viewSettings(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${tabs("set", cc)}${loadingCard()}`;
    let fee = CFG.fee || 1000, methods = {}, c;
    try {
      const [r, cn] = await Promise.all([sb.from("site_settings").select("key,value").in("key", ["listing_fee", "payment_methods"]), counts()]);
      c = cn; const d = must(r) || [];
      d.forEach((x) => { if (x.key === "listing_fee") fee = Number(x.value); if (x.key === "payment_methods" && x.value && typeof x.value === "object") methods = x.value; });
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Companies</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const pm = CFG.payMethods || [{ id: "bkash", name: "bKash" }];
    view.innerHTML = `<div class="page-h"><h1>Listing settings</h1></div>${tabs("set", c)}
      <form class="co-settings" id="sf" novalidate>
        <div class="card"><h2>Listing fee</h2><p class="muted co-sub">One-time fee a company pays to be listed. It is permanent — no renewal.</p>
          <div class="fld" style="max-width:260px"><label for="fee">Amount (৳)</label><input class="inp" id="fee" inputmode="numeric" value="${esc(fee)}" autocomplete="off"></div></div>
        <div class="card"><h2>Payment methods</h2><p class="muted co-sub">Customers see the number only after they sign in. <b>bKash is live now</b>; the other wallets stay “Coming soon” until you switch them on and add a number.</p>
          <div class="co-pm">${pm.map((m) => { const v = methods[m.id] || {}; const live = m.id === "bkash";
            return `<div class="co-pm-row" data-m="${esc(m.id)}"><div class="co-pm-h"><span class="co-pm-dot" style="background:${esc(m.color || "#999")}"></span><b>${esc(m.name)}</b>${live ? '<span class="pill p-published">LIVE</span>' : v.enabled ? '<span class="pill p-published">ON</span>' : '<span class="pill p-draft">COMING SOON</span>'}
              <label class="chk co-pm-sw"><input type="checkbox" class="m-en"${v.enabled ? " checked" : ""}> Enabled</label></div>
              <div class="co-2"><div class="fld"><label>Receiving number</label><input class="inp m-num" inputmode="tel" maxlength="14" value="${esc(v.number || "")}" placeholder="01XXXXXXXXX" autocomplete="off"></div>
              <div class="fld"><label>Account type</label><select class="sel m-kind">${["Personal", "Agent", "Merchant"].map((k) => `<option${(v.kind || "Personal") === k ? " selected" : ""}>${k}</option>`).join("")}</select></div></div></div>`; }).join("")}</div></div>
        <div class="msg err" id="smsg" hidden></div>
        <p><button class="b b-orange" id="ssave" type="submit">Save settings</button></p>
      </form>`;
    $("#sf", view).addEventListener("submit", (e) => {
      e.preventDefault();
      busy($("#ssave", view), async () => {
        const m = $("#smsg", view); m.hidden = true;
        const f = num($("#fee", view).value);
        if (f === null || Number.isNaN(f) || f < 0 || f > 1e6 || f % 1) { m.hidden = false; m.textContent = "Listing fee must be a whole number of taka (0 – 1,000,000)."; return; }
        const out = {};
        for (const row of $$(".co-pm-row", view)) {
          const id = row.dataset.m, en = row.querySelector(".m-en").checked, n = row.querySelector(".m-num").value.trim().replace(/[\s-]/g, "");
          if (en && !/^01[3-9][0-9]{8}$/.test(n)) { m.hidden = false; m.textContent = `${id}: enter an 11-digit mobile number (01XXXXXXXXX) before switching it on.`; return; }
          if (n && !/^01[3-9][0-9]{8}$/.test(n)) { m.hidden = false; m.textContent = `${id}: the number must look like 01XXXXXXXXX.`; return; }
          out[id] = { enabled: en, number: n, kind: row.querySelector(".m-kind").value };
        }
        if (!out.bkash || !out.bkash.enabled) { if (!(await modal({ title: "bKash is switched off", body: "Nobody will be able to pay the listing fee until a payment method is on. Save anyway?", ok: "Save anyway", danger: true }))) return; }
        const now = new Date().toISOString();
        must(await sb.from("site_settings").upsert([{ key: "listing_fee", value: f, updated_at: now }, { key: "payment_methods", value: out, updated_at: now }], { onConflict: "key" }));
        toast("Settings saved", "ok");
      });
    });
  }

  /* ======================================================================
     Users hub + deleted accounts
     ====================================================================== */
  async function viewUsers(view) {
    bind(view);
    const st = view._ust || (view._ust = { q: "", page: 0 }); const PER = 50;
    view.innerHTML = `<div class="page-h"><h1>Users</h1></div>${userTabs("users", cc)}${loadingCard()}`;
    const load = async () => {
      const r = await sb.rpc("admin_list_users", { p_q: st.q || null, p_limit: PER, p_offset: st.page * PER });
      return must(r) || { total: 0, items: [] };
    };
    let d, c;
    try { [d, c] = await Promise.all([load(), counts()]); } catch (e) { view.innerHTML = `<div class="page-h"><h1>Users</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const total = Number(d.total) || 0, items = d.items || [], pages = Math.max(1, Math.ceil(total / PER));
    view.innerHTML = `<div class="page-h"><h1>Users</h1></div>${userTabs("users", c)}
      <form class="co-filters" id="uf"><input class="inp" id="q" type="search" placeholder="Search name or e-mail…" aria-label="Search" value="${esc(st.q)}" autocomplete="off"><button class="b b-dark b-sm" type="submit">Search</button></form>
      <p class="muted co-count">${fmtN(total)} registered user${total === 1 ? "" : "s"}${st.q ? ` matching “${esc(st.q)}”` : ""} · page ${st.page + 1} of ${pages}</p>
      <div class="co-list">${items.length ? items.map((u) => `<details class="card co-user" data-uid="${esc(u.id)}"><summary>
          <span class="co-av">${initial(u.full_name || u.email)}</span>
          <span class="co-u-main"><b>${esc(u.full_name || "(no name)")}</b><small>${esc(u.email || "")}</small></span>
          <span class="co-u-meta"><span class="pill ${u.provider === "google" ? "p-in_review" : "p-draft"}">${esc(u.provider || "email")}</span>${u.email_confirmed ? "" : '<span class="pill p-changes_requested">unconfirmed</span>'}</span>
          <span class="co-u-counts" title="companies · reviews · comments · interests"><i>🏢 ${fmtN(u.companies)}</i><i>★ ${fmtN(u.reviews)}</i><i>💬 ${fmtN(u.comments)}</i><i>💰 ${fmtN(u.interests)}</i></span></summary>
          <div class="co-u-body"><p class="muted">Joined ${esc(fmtDT(u.created_at))} · last sign-in ${u.last_sign_in_at ? esc(fmtDT(u.last_sign_in_at)) : "never"}</p><div class="co-u-prof muted">Loading profile…</div>
            <p class="acts" style="justify-content:flex-start">${u.email ? `<a class="b b-line b-sm" href="mailto:${esc(u.email)}">E-mail</a>` : ""}<button type="button" class="b b-line b-sm" data-a="copy" data-v="${esc(u.id)}">Copy user ID</button>${u.email ? `<button type="button" class="b b-line b-sm" data-a="copy" data-v="${esc(u.email)}">Copy e-mail</button>` : ""}</p></div></details>`).join("")
        : `<div class="empty"><b>No users</b>${st.q ? "Nobody matches this search." : "Nobody has signed up yet."}</div>`}</div>
      <div class="co-pager"><button type="button" class="b b-line b-sm" data-a="pg" data-d="-1"${st.page <= 0 ? " disabled" : ""}>← Previous</button><span class="muted">${st.page + 1} / ${pages}</span><button type="button" class="b b-line b-sm" data-a="pg" data-d="1"${st.page + 1 >= pages ? " disabled" : ""}>Next →</button></div>`;
    view._h.copy = (b) => copyV(b);
    view._h.pg = (b) => { st.page = Math.max(0, st.page + Number(b.dataset.d)); viewUsers(view); };
    $("#uf", view).addEventListener("submit", (e) => { e.preventDefault(); st.q = $("#q", view).value.trim(); st.page = 0; viewUsers(view); });
    view.addEventListener("toggle", async (e) => {
      const el = e.target; if (!el.matches || !el.matches("details.co-user") || !el.open || el.dataset.loaded) return;
      el.dataset.loaded = "1";
      const box = el.querySelector(".co-u-prof");
      try {
        const p = one(must(await sb.from("profiles").select("*").eq("id", el.dataset.uid).maybeSingle()));
        box.classList.remove("muted");
        box.innerHTML = p ? kv([["Phone", esc(p.phone)], ["Type", esc(p.user_type)], ["Headline", esc(p.headline)], ["Location", esc(p.location)], ["About", esc(p.bio)], ["Signed up with", esc(p.provider)], ["Last seen", p.last_seen_at ? esc(fmtDT(p.last_seen_at)) : ""], ["Profile photo", p.avatar_url && isUrl(p.avatar_url) ? `<a href="${esc(p.avatar_url)}" target="_blank" rel="noopener noreferrer">open</a>` : ""]]) : `<span class="muted">No profile saved yet (the person has not opened My account).</span>`;
      } catch (err) { box.textContent = errMsg(err); }
    }, true);
  }

  async function viewDeletions(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Users</h1></div>${userTabs("del", cc)}${loadingCard()}`;
    let rows, c;
    try { [rows, c] = await Promise.all([fetchAll(() => sb.from("account_deletions").select("*").order("deleted_at", { ascending: false }).order("id")), counts()]); rows = must(rows) || []; }
    catch (e) { view.innerHTML = `<div class="page-h"><h1>Users</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const by = {}; rows.forEach((r) => (by[r.reason] = (by[r.reason] || 0) + 1));
    view.innerHTML = `<div class="page-h"><h1>Deleted accounts</h1></div>${userTabs("del", c)}
      <div class="msg info">When someone deletes their account they must give a reason. A copy of their details is kept here for you. Their reviews and comments stay as “Deleted user”.</div>
      ${rows.length ? `<div class="card"><h2>Why people leave</h2><div class="bl">${Object.keys(by).sort((a, b) => by[b] - by[a]).map((k) => `<div class="bl-r"><div class="bl-t"><span class="bl-l">${esc(lab(CFG.deletionReasons, k))}</span><b>${fmtN(by[k])}</b></div><div class="bl-b"><i style="width:${Math.round((by[k] / rows.length) * 100)}%"></i></div></div>`).join("")}</div></div>` : ""}
      <div class="co-list" style="margin-top:14px">${rows.length ? rows.map((r) => {
        const s = r.snapshot || {}, cos = arr(s.companies), pays = arr(s.payments);
        return `<details class="card co-user"><summary><span class="co-av">${initial(r.full_name || r.email)}</span><span class="co-u-main"><b>${esc(r.full_name || "(no name)")}</b><small>${esc(r.email || "")}</small></span>
          <span class="co-u-meta"><span class="pill p-rejected">${esc(lab(CFG.deletionReasons, r.reason))}</span></span><span class="co-u-counts"><i>${esc(fmtD(r.deleted_at))}</i></span></summary>
          <div class="co-u-body">${r.reason_detail ? `<p class="co-quote">“${esc(r.reason_detail)}”</p>` : `<p class="muted">No extra comment.</p>`}
            ${kv([["Phone", esc(r.phone)], ["Signed up with", esc(r.provider)], ["Joined", r.joined_at ? esc(fmtDT(r.joined_at)) : ""], ["Deleted", esc(fmtDT(r.deleted_at))], ["Reviews written", fmtN(s.reviews || 0)], ["Comments written", fmtN(s.comments || 0)], ["Investor interests", fmtN(s.interests || 0)], ["Companies", fmtN(cos.length)], ["Payments", fmtN(pays.length)]])}
            ${cos.length ? `<h3 class="co-h3">Companies they owned</h3><ul class="co-ul">${cos.map((x) => `<li>${x.id ? `<a href="#/companies/${esc(x.id)}">${esc(x.name || "(no name)")}</a>` : esc(x.name || "(no name)")} · ${stPill(x.status)}</li>`).join("")}</ul>` : ""}
            ${pays.length ? `<h3 class="co-h3">Payments</h3><ul class="co-ul">${pays.map((x) => `<li>${esc(bdt(x.amount))} · TrxID <code>${esc(x.trx_id)}</code> · ${esc(x.invoice_no)} · ${simplePay(x.status)}</li>`).join("")}</ul>` : ""}
            <p class="muted" style="font-size:.8rem">Former user ID: <code>${esc(r.user_id || "")}</code></p></div></details>`; }).join("")
        : `<div class="empty"><b>No deleted accounts</b>Nobody has deleted their account.</div>`}</div>`;
  }

  /* ---------------- router entry ---------------- */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function handles(h) {
    return ["companies", "companies/all", "payments", "reviews", "interests", "company-settings", "users", "deletions"].includes(h) || (h.startsWith("companies/") && UUID.test(h.slice(10)));
  }
  async function render(h, view) {
    refreshBadges();
    if (h === "companies") return viewList(view, "apps");
    if (h === "companies/all") return viewList(view, "all");
    if (h.startsWith("companies/")) return viewCompany(view, h.slice(10));
    if (h === "payments") return viewPayments(view);
    if (h === "reviews") return viewReviews(view);
    if (h === "interests") return viewInterests(view);
    if (h === "company-settings") return viewSettings(view);
    if (h === "users") return viewUsers(view);
    if (h === "deletions") return viewDeletions(view);
  }
  return { handles, render, refreshBadges, counts, dashSection };
};
