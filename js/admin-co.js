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
  const ST = { draft: "Draft", submitted: "Submitted", in_review: "In review", changes_requested: "Changes requested", rejected: "Rejected", published: "Published", suspended: "Suspended", deleted: "Removed" };
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
  const COTABS = [["apps", "Applications", "#/companies"], ["all", "All companies", "#/companies/all"], ["pay", "Payments", "#/payments"], ["rev", "Reviews & comments", "#/reviews"], ["val", "Valuations", "#/valuations"], ["deals", "Investments", "#/deals"], ["int", "Investor interest", "#/interests"], ["set", "Listing settings", "#/company-settings"], ["trash", "Trash", "#/trash"]];
  function tabs(active, c) {
    const badge = { apps: waiting(c), pay: Number(c && c.payments_pending) || 0, int: Number(c && c.interests_new) || 0 };
    return `<div class="co-tabs" role="tablist" aria-label="Company Directory">${COTABS.map(([k, t, h]) => `<a href="${h}" role="tab" class="${k === active ? "on" : ""}" ${k === active ? 'aria-selected="true"' : ""}>${esc(t)}${badge[k] ? `<i>${badge[k] > 99 ? "99+" : badge[k]}</i>` : ""}</a>`).join("")}</div>`;
  }
  function userTabs(active, c) {
    const d = Number(c && c.deletions) || 0, u = Number(c && c.users) || 0;
    return `<div class="co-tabs" role="tablist" aria-label="Users"><a href="#/users" role="tab" class="${active === "users" ? "on" : ""}">People${u ? `<i class="soft">${fmtN(u)}</i>` : ""}</a><a href="#/deletions" role="tab" class="${active === "del" ? "on" : ""}">Deleted accounts${d ? `<i class="soft">${fmtN(d)}</i>` : ""}</a><a href="#/trash" role="tab">Trash &amp; suspended</a></div>`;
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
        if (st.status === "action" ? !["submitted", "in_review"].includes(r.status) : st.status === "all" ? r.status === "deleted" : r.status !== st.status) return false;
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
      deleted: [],
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
    const unreg = p.reg_type === "not_registered";
    const reqMissing = unreg ? (docs.some((x) => x.doc_type === "founder_id") ? [] : [{ en: "Founder's NID / passport" }]) : (CFG.docTypes || []).filter((d) => d.required && !docs.some((x) => x.doc_type === d.id));
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
        <div class="co-top-acts">${stPill(c.status)}${payPill(payState(pays))}${unreg ? '<span class="pill p-changes_requested">Not registered</span>' : ""}${c.invest_open === false ? '<span class="pill p-draft">Investing off</span>' : ""}${pub ? `<a class="b b-line b-sm" href="${esc(safeHref("/company/" + c.slug))}" target="_blank" rel="noopener">View public page ↗</a>` : ""}</div></div>
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
            ${c.status === "deleted" ? `<div class="msg info" style="margin-top:10px">Removed ${c.deleted_at ? esc(fmtDT(c.deleted_at)) : ""}${c.delete_reason ? " — " + esc(c.delete_reason) : ""}. Nothing is erased: the owner's data, payments and reviews are all kept.</div><p><button type="button" class="b b-green" data-a="restore">↩ Restore this company</button></p>`
              : `<p style="margin-top:10px"><button type="button" class="b b-line b-sm co-trashbtn" data-a="trash">🗑 Move to trash</button></p>`}
            <p class="muted co-sub" style="margin-top:10px">“Request changes” and “Reject” need a note — the applicant sees it. Publishing makes the company page live.</p></div>
          <div class="card"><h2>Payment</h2>${payCard}</div>
          <div class="card" id="co-valcard"><h2>Valuation</h2><p class="muted">Loading…</p></div>
          <div class="card" id="co-invcard"><h2>Investors &amp; fees</h2><p class="muted">Loading…</p></div>
          <div class="card"><h2>Your private fields</h2><div id="co-meta"><p class="muted">Loading…</p></div></div>
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

    companyMoney(view, c, pays); metaBox("company", c.id, $("#co-meta", view));

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
    view._h.trash = (b) => busy(b, async () => {
      const n = await ask({ title: "Move to trash", body: "The company disappears from the site and from the owner's account. Nothing is erased — you can restore it any time from Trash.", label: "Reason (the owner sees it)", ok: "Move to trash", danger: true });
      if (n === null) return;
      must(await sb.rpc("admin_set_company_deleted", { p_company: id, p_deleted: true, p_reason: n || null }));
      toast("Moved to trash", "ok"); await reload();
    });
    view._h.restore = (b) => busy(b, async () => {
      if (!(await modal({ title: "Restore this company?", body: "It returns to the status it had before (published companies go live again).", ok: "Restore" }))) return;
      must(await sb.rpc("admin_set_company_deleted", { p_company: id, p_deleted: false }));
      toast("Restored", "ok"); await reload();
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
  /* ======================================================================
     Valuation · Investments · People (investor / founder / reader) — added in update 12
     ====================================================================== */
  const FLAG = {
    no_financials: ["No financial figures provided", "bad"], thin_financials: ["Few financial figures given", "warn"], runway_short: ["Cash runway under 6 months", "warn"], not_registered: ["Not legally registered yet", "warn"],
    no_documents: ["No documents uploaded", "bad"], documents_unverified: ["Documents not checked yet", "warn"], burn_exceeds_revenue: ["Burn is high compared with revenue", "warn"],
    expectation_high: ["Owner expects much more than the estimate", "bad"], expectation_low: ["Owner expects less than the estimate", "info"], expectation_reasonable: ["Owner's expectation is in line", "good"],
  };
  const ADJ = { runway_lt_3m: "Cash runway < 3 months", runway_lt_6m: "Cash runway < 6 months", burn_exceeds_revenue: "Burn > 1.5× revenue", not_registered: "Not registered (−20%)", no_documents: "No documents (−10%)", private_company_discount: "Private-company / illiquidity discount" };
  const MISSLBL = { revenue: "Revenue", growth_mom: "Monthly growth", gross_margin: "Gross margin", annual_net_profit: "Net profit", monthly_burn: "Monthly burn", cash_in_bank: "Cash in bank", customers: "Customers", team_ft: "Full-time team" };
  const NP = '<span class="np">Not provided</span>';
  const ROLE = { investor: "Investor", founder: "Founder", reader: "Reader", other: "Other" };
  const rolePill = (r) => `<span class="pill role-${esc(r)}">${esc(ROLE[r] || r)}</span>`;
  const dealPill = (s) => `<span class="pill deal-${esc(s)}">${esc(({ proposed: "Waiting for other side", confirmed: "Both confirmed", verified: "Verified by VOSB", cancelled: "Cancelled" })[s] || s)}</span>`;
  const rel = (iso) => { if (!iso) return "never"; const d = (Date.now() - new Date(iso).getTime()) / 86400000; return d < 1 ? "today" : d < 2 ? "yesterday" : d < 60 ? Math.floor(d) + " days ago" : fmtD(iso); };

  /* the calculation, laid out so the admin can see why the number is what it is */
  function valBody(v) {
    const r = v.result || {}, m = r.methods || {}, flags = arr(r.flags), adj = arr(r.adjustments);
    const row = (name, o, extra) => o && Number(o.value) > 0 ? `<tr><td>${name}</td><td>${esc(bdt(o.value))}</td><td>${Math.round((Number(o.weight) || 0) * 100)}%</td><td class="muted">${extra || ""}</td></tr>` : "";
    const missing = arr(r.missing).map((k) => MISSLBL[k] || k);
    const missBox = missing.length ? `<p class="co-miss"><b>Not provided by the owner:</b> ${missing.map((m) => `<span class="np">${esc(m)}</span>`).join(" ")} <span class="muted">— nothing was assumed for these; they add no credit to the estimate.</span></p>` : "";
    if (v.mid === null || v.mid === undefined) return `<div class="msg warn"><b>No estimate — the owner gave no financial figures.</b> The system does not guess. Check the documents, then either enter your own estimate (“Approve with my number…”) or decline and ask for the figures.</div>${missBox}${flags.length ? `<div class="co-flags">${flags.map((f) => { const x = FLAG[f] || [f, "info"]; return `<span class="flag f-${x[1]}">${esc(x[0])}</span>`; }).join("")}</div>` : ""}`;
    return `${missBox}<div class="co-valrange"><div><small>Low</small><b>${money(v.low)}</b></div><div class="mid"><small>Estimate</small><b>${money(v.mid)}</b></div><div><small>High</small><b>${money(v.high)}</b></div></div>
      <p class="muted co-sub">Confidence <b>${esc(v.confidence)}%</b> — the more figures and documents the owner gives, the narrower the range.${v.expected_by_owner ? ` Owner expects <b>${esc(bdt(v.expected_by_owner))}</b>${r.expected_ratio ? ` (${Number(r.expected_ratio).toFixed(1)}× the estimate)` : ""}.` : ""}</p>
      ${flags.length ? `<div class="co-flags">${flags.map((f) => { const x = FLAG[f] || [f, "info"]; return `<span class="flag f-${x[1]}">${esc(x[0])}</span>`; }).join("")}</div>` : ""}
      <details class="co-how"><summary>How this was calculated</summary>
        <table class="co-tbl"><thead><tr><th>Method</th><th>Value</th><th>Weight</th><th>Basis</th></tr></thead><tbody>
          ${row("Revenue multiple", m.revenue, `${esc(m.revenue && m.revenue.multiple)}× sector × margin ${esc(m.revenue && m.revenue.margin_factor)}`)}
          ${row("Earnings (profit multiple)", m.earnings, "")}
          ${row("Scorecard (idea · stage · team · strategy · rollout)", m.scorecard, "")}
          ${m.floor && Number(m.floor.value) > 0 ? `<tr><td>Asset / cash floor</td><td>${esc(bdt(m.floor.value))}</td><td>—</td><td class="muted">estimate is never below this</td></tr>` : ""}
        </tbody></table>
        ${adj.length ? `<p class="muted co-sub">Adjustments applied: ${adj.map((a) => `${esc(ADJ[a.k] || a.k)} ×${esc(a.f)}`).join(" · ")}</p>` : ""}
        ${m.runway_months != null ? `<p class="muted co-sub">Cash runway: ${esc(m.runway_months)} months</p>` : ""}</details>`;
  }
  async function decideVal(b, view, reload) {
    await busy(b, async () => {
      const approve = b.dataset.ok === "1"; let mid = null, note = null;
      if (approve && b.dataset.edit === "1") {
        const v = await ask({ title: "Approve with a different estimate", body: `${b.dataset.mid ? "Calculated estimate: " + bdt(b.dataset.mid) + ". " : "No calculated estimate (no figures given). "}Enter your own estimate (the range moves with it), or leave as is.`, label: "Estimate (৳)", value: String(b.dataset.mid || ""), ok: "Approve" });
        if (v === null) return; const n = num(v); if (n === null || !(n > 0)) throw new Error("Enter a valid amount"); mid = n;
        note = await ask({ title: "Public note (optional)", body: "Shown on the company page under the valuation.", label: "Note", ok: "Save" }); if (note === null) return;
      } else if (approve) { if (!(await modal({ title: "Approve this valuation?", body: "The range will go live on the company page and the owner is notified.", ok: "Approve" }))) return; }
      else { note = await ask({ title: "Decline this valuation", body: "The owner sees your note.", label: "Reason", required: true, ok: "Decline", danger: true }); if (note === null) return; }
      must(await sb.rpc("admin_decide_valuation", { p_id: b.dataset.id, p_approve: approve, p_mid: mid, p_note: note || null }));
      toast(approve ? "Valuation approved" : "Valuation declined", "ok"); await reload();
    });
  }

  async function viewValuations(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Valuations</h1></div>${tabs("val", cc)}${loadingCard()}`;
    let pend, done;
    try {
      const [a, d] = await Promise.all([
        sb.from("company_valuations").select("*, companies(id,name,slug,registered,category,stage)").eq("status", "pending").order("created_at", { ascending: true }),
        sb.from("company_valuations").select("*, companies(id,name,slug)").neq("status", "pending").order("decided_at", { ascending: false, nullsFirst: false }).limit(15)]);
      pend = must(a) || []; done = must(d) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Valuations</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const card = (v) => { const co = one(v.companies) || {};
      return `<div class="card co-valcard"><div class="co-pay-h"><b><a href="#/companies/${esc(co.id)}">${esc(co.name || "(company)")}</a></b>${simplePill(v.status)}<span class="pill p-draft">${v.source === "update_request" ? "Update requested by owner" : v.source === "admin" ? "Recalculated" : "New application"}</span><span class="muted">${esc(fmtDT(v.created_at))}</span></div>
        ${v.reason ? `<p class="co-quote">“${esc(v.reason)}”</p>` : ""}${valBody(v)}
        ${v.status === "pending" ? `<div class="acts co-acts">${v.mid != null ? `<button type="button" class="b b-green" data-a="vok" data-ok="1" data-id="${esc(v.id)}" data-mid="${esc(v.mid)}">✓ Approve</button>` : ""}<button type="button" class="b b-line" data-a="vok" data-ok="1" data-edit="1" data-id="${esc(v.id)}" data-mid="${esc(v.mid)}">Approve with my number…</button><button type="button" class="b b-red" data-a="vok" data-ok="0" data-id="${esc(v.id)}">Decline</button></div>` : v.note ? `<p class="muted co-sub">Note: ${esc(v.note)}</p>` : ""}</div>`; };
    view.innerHTML = `<div class="page-h"><h1>Valuations</h1></div>${tabs("val", cc)}
      <div class="msg info">The system calculates every valuation from the owner's figures and documents. Check the flags, then press <b>Approve</b> — nothing else is needed. Owners can ask for an update after an investment is confirmed.</div>
      <h2 class="sec-h">Waiting for approval <span>${fmtN(pend.length)}</span></h2>${pend.length ? pend.map(card).join("") : `<div class="card"><div class="empty"><b>All caught up</b>No valuation is waiting.</div></div>`}
      ${done.length ? `<h2 class="sec-h" style="margin-top:22px">Recently decided</h2>${done.map(card).join("")}` : ""}`;
    view._h.vok = (b) => decideVal(b, view, () => viewValuations(view));
  }

  async function viewDeals(view) {
    bind(view);
    const st = view._dst || (view._dst = { s: "" });
    view.innerHTML = `<div class="page-h"><h1>Investments</h1></div>${tabs("deals", cc)}${loadingCard()}`;
    let rows;
    try { rows = must(await sb.rpc("admin_list_investments", { p_status: st.s || null, p_limit: 200 })) || []; } catch (e) { view.innerHTML = `<div class="page-h"><h1>Investments</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const sum = (f) => rows.filter(f).reduce((a, r) => a + Number(r.amount || 0), 0);
    view.innerHTML = `<div class="page-h"><h1>Investments</h1></div>${tabs("deals", cc)}
      <div class="tiles co-tiles"><div class="tile r"><small>Both sides confirmed — verify</small><b>${fmtN(rows.filter((r) => r.status === "confirmed").length)}</b></div><div class="tile g"><small>Verified by VOSB</small><b>${esc(bdt(sum((r) => r.status === "verified")))}</b></div><div class="tile"><small>Confirmed total</small><b>${esc(bdt(sum((r) => r.status === "confirmed" || r.status === "verified")))}</b></div></div>
      <div class="msg info">An investment is <b>recorded</b> by the owner or the investor and must be <b>confirmed by the other side</b>. Then you verify it with one click — after that the owner may ask for a valuation update.</div>
      <div class="co-filters"><select class="sel" id="ds" aria-label="Status"><option value="">All records</option>${["proposed", "confirmed", "verified", "cancelled"].map((k) => `<option value="${k}"${st.s === k ? " selected" : ""}>${esc(({ proposed: "Waiting for other side", confirmed: "Both confirmed", verified: "Verified", cancelled: "Cancelled" })[k])}</option>`).join("")}</select></div>
      <div class="rows" style="margin-top:12px">${rows.length ? rows.map((r) => `<div class="row"><div class="th co-logo">৳</div><div class="ti"><h3>${esc(bdt(r.amount))} → <a href="#/companies/${esc(r.company_id)}">${esc(r.company || "")}</a> ${dealPill(r.status)}</h3>
          <div class="meta"><span>Investor <b>${esc(r.investor || "—")}</b>${r.email ? ` · ${esc(r.email)}` : ""}</span>${r.equity_pct != null ? `<span>${esc(r.equity_pct)}% equity</span>` : ""}${r.invested_on ? `<span>${esc(fmtD(r.invested_on))}</span>` : ""}<span>recorded by ${esc(r.recorded_by || "—")}</span></div>
          <div class="meta"><span>${r.investor_confirmed_at ? "✓" : "○"} Investor confirmed</span><span>${r.owner_confirmed_at ? "✓" : "○"} Owner confirmed</span>${r.verified_at ? `<span>✓ Verified ${esc(fmtD(r.verified_at))}</span>` : ""}${r.note ? `<span>Note: ${esc(r.note)}</span>` : ""}</div></div>
          <div class="acts">${r.status === "confirmed" ? `<button type="button" class="b b-green b-sm" data-a="dv" data-id="${esc(r.id)}">Verify</button>` : r.status === "proposed" ? `<button type="button" class="b b-line b-sm" data-a="dv" data-force="1" data-id="${esc(r.id)}">Verify anyway</button>` : ""}</div></div>`).join("") : `<div class="empty"><b>No investments yet</b>They appear here when an owner or investor records one.</div>`}</div>`;
    $("#ds", view).addEventListener("change", (e) => { st.s = e.target.value; viewDeals(view); });
    view._h.dv = (b) => busy(b, async () => {
      if (b.dataset.force === "1" && !(await modal({ title: "Verify without the other side?", body: "Only one side has confirmed. Verify only if you have checked the payment yourself.", ok: "Verify anyway" }))) return;
      must(await sb.rpc("admin_verify_investment", { p_id: b.dataset.id, p_force: b.dataset.force === "1" })); toast("Investment verified", "ok"); viewDeals(view);
    });
  }

  /* extra fields the admin defines (e.g. "KYC status") — stored privately, never shown on the public site */
  async function metaBox(scope, refId, host) {
    let defs = [], meta = null;
    try { [defs, meta] = await Promise.all([sb.from("admin_field_defs").select("*").eq("scope", scope).eq("active", true).order("sort").order("created_at").then(must), sb.from("admin_meta").select("*").eq("scope", scope).eq("ref_id", refId).maybeSingle().then(must)]); }
    catch (e) { host.innerHTML = `<p class="msg err">${esc(errMsg(e))}</p>`; return; }
    defs = defs || []; const data = (meta && meta.data) || {};
    const field = (d) => { const id = "mf-" + d.key, v = data[d.key] == null ? "" : data[d.key], lbl = esc(d.label_en);
      if (d.kind === "select") return `<div class="fld"><label for="${id}">${lbl}</label><select class="sel" id="${id}" data-k="${esc(d.key)}"><option value=""></option>${arr(d.options).map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
      if (d.kind === "bool") return `<label class="chk"><input type="checkbox" id="${id}" data-k="${esc(d.key)}"${v === true ? " checked" : ""}> ${lbl}</label>`;
      return `<div class="fld"><label for="${id}">${lbl}</label><input class="inp" id="${id}" data-k="${esc(d.key)}" type="${d.kind === "number" ? "number" : d.kind === "date" ? "date" : "text"}" maxlength="300" value="${esc(v)}"></div>`; };
    host.innerHTML = `${defs.length ? defs.map(field).join("") : `<p class="muted">No extra fields yet. Add one from <a href="#/users">People → Custom fields</a>.</p>`}
      <div class="fld"><label for="mf-note">Private note</label><textarea class="txt" id="mf-note" rows="3" maxlength="2000">${esc((meta && meta.note) || "")}</textarea></div>
      <p><button type="button" class="b b-dark b-sm" data-mf-save>Save</button> <span class="muted" data-mf-msg></span></p>`;
    $("[data-mf-save]", host).addEventListener("click", (e) => busy(e.currentTarget, async () => {
      const out = {}; $$("[data-k]", host).forEach((el) => { const k = el.dataset.k; out[k] = el.type === "checkbox" ? el.checked : el.value.trim() === "" ? null : (el.type === "number" ? Number(el.value) : el.value.trim()); });
      Object.keys(out).forEach((k) => out[k] === null && delete out[k]);
      must(await sb.from("admin_meta").upsert({ scope, ref_id: refId, data: out, note: $("#mf-note", host).value.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "scope,ref_id" }));
      $("[data-mf-msg]", host).textContent = "Saved ✓";
    }));
  }

  /* company page: valuation + investment control cards */
  async function companyMoney(view, c, pays) {
    const val = $("#co-valcard", view), inv = $("#co-invcard", view);
    if (!val || !inv) return;
    const reload = () => companyMoney(view, c, pays);
    let V = null, O = null;
    try { [V, O] = await Promise.all([sb.rpc("my_valuations", { p_company: c.id }).then(must), sb.rpc("company_investor_overview", { p_company: c.id }).then(must)]); } catch (e) { val.innerHTML = `<h2>Valuation</h2><p class="msg err">${esc(errMsg(e))}</p>`; return; }
    if (!view.isConnected) return;
    const items = (V && V.items) || [], pend = items.find((x) => x.status === "pending"), appr = items.find((x) => x.status === "approved"), fin = V && V.financials;
    val.innerHTML = `<h2>Valuation <span class="muted" style="font-weight:600;font-size:.8rem">system-calculated</span></h2>
      ${pend ? `<p><span class="pill p-submitted">Waiting for your approval</span></p>${valBody(pend)}<div class="acts co-acts">${pend.mid != null ? `<button type="button" class="b b-green b-sm" data-a="vok" data-ok="1" data-id="${esc(pend.id)}" data-mid="${esc(pend.mid)}">✓ Approve</button>` : ""}<button type="button" class="b b-line b-sm" data-a="vok" data-ok="1" data-edit="1" data-id="${esc(pend.id)}" data-mid="${esc(pend.mid)}">My number…</button><button type="button" class="b b-red b-sm" data-a="vok" data-ok="0" data-id="${esc(pend.id)}">Decline</button></div>`
        : appr ? `<p><span class="pill p-published">Approved ${esc(fmtD(appr.decided_at))}</span></p>${valBody(appr)}` : `<p class="muted">${fin ? "No valuation calculated yet." : "The owner has not given any financial figures yet."}</p>`}
      ${(() => { const f2 = fin || {}; const N = (x, fn) => (x === null || x === undefined || x === "" ? NP : fn ? fn(x) : esc(x));
        const rows = kv([["Annual revenue", N(f2.annual_revenue, bdt)], ["Monthly revenue", N(f2.monthly_revenue, bdt)], ["Monthly growth", N(f2.growth_mom, (x) => esc(x) + "%")], ["Gross margin", N(f2.gross_margin, (x) => esc(x) + "%")], ["Annual net profit", N(f2.annual_net_profit, bdt)], ["Monthly burn", N(f2.monthly_burn, bdt)], ["Cash in bank", N(f2.cash_in_bank, bdt)], ["Debt", N(f2.debt, bdt)], ["Assets", N(f2.assets_value, bdt)], ["IP value", N(f2.ip_value, bdt)], ["Customers (paying)", N(f2.customers, (x) => esc(x) + " (" + (f2.paying_customers ?? "?") + ")")], ["Full-time team", N(f2.team_ft)], ["Raised before", N(f2.total_raised, bdt)], ["Market size", N(f2.market_size, bdt)], ["Traction", N(f2.traction)], ["Owner's note", N(f2.owner_note)]]);
        return `<details class="co-how" ${fin ? "" : "open"}><summary>Figures the owner gave</summary>${fin ? "" : '<p class="muted co-sub">The owner has not saved any financial figures.</p>'}${rows}</details>`; })()}
      <p style="margin-top:10px"><button type="button" class="b b-line b-sm" data-a="vre">↻ Recalculate</button></p>`;
    const T = O.totals || {};
    inv.innerHTML = `<h2>Investors &amp; fees</h2>
      <div class="co-switch"><div><b>Open for investment</b><small class="muted">${O.invest_open ? "Investors can send interest." : "Closed — investors cannot send interest."}</small></div><button type="button" class="b ${O.invest_open ? "b-green" : "b-line"} b-sm" data-a="iopen" data-v="${O.invest_open ? "0" : "1"}">${O.invest_open ? "On — turn off" : "Off — turn on"}</button></div>
      <div class="co-switch"><div><b>Listing fee</b><small class="muted">${pays.some((p) => p.status === "verified") ? "Paid" : "Not paid (or waiting)"}</small></div><span class="co-sw-b"><button type="button" class="b b-line b-sm" data-a="waive" data-v="1">Waive</button><button type="button" class="b b-line b-sm" data-a="waive" data-v="0">Undo</button></span></div>
      ${kv([["Interested investors", fmtN(T.interested)], ["Confirmed investors", fmtN(T.investors)], ["Confirmed amount", bdt(T.confirmed)], ["Verified amount", bdt(T.verified)]])}
      ${arr(O.investments).length ? `<h3 class="co-h3">Deals</h3><ul class="co-ul">${O.investments.map((d) => `<li>${esc(bdt(d.amount))} · ${esc(d.investor_name || "—")} ${dealPill(d.status)} ${d.status === "confirmed" ? `<button type="button" class="b b-green b-sm" data-a="dv2" data-id="${esc(d.id)}">Verify</button>` : ""}</li>`).join("")}</ul>` : ""}`;
    view._h.vok = (b) => decideVal(b, view, reload);
    view._h.vre = (b) => busy(b, async () => { must(await sb.rpc("admin_recompute_valuation", { p_company: c.id })); toast("Recalculated", "ok"); await reload(); });
    view._h.iopen = (b) => busy(b, async () => { must(await sb.rpc("set_invest_open", { p_company: c.id, p_open: b.dataset.v === "1" })); toast("Saved", "ok"); await reload(); });
    view._h.waive = (b) => busy(b, async () => { must(await sb.rpc("admin_waive_fee", { p_company: c.id, p_waive: b.dataset.v === "1" })); toast(b.dataset.v === "1" ? "Fee waived — you can publish without payment" : "Waiver removed", "ok"); });
    view._h.dv2 = (b) => busy(b, async () => { must(await sb.rpc("admin_verify_investment", { p_id: b.dataset.id, p_force: false })); toast("Verified", "ok"); await reload(); });
  }

  /* People: who is investor / founder / reader, active or not, top investors, custom fields */
  async function viewUsers(view) {
    bind(view);
    const st = view._ust || (view._ust = { q: "", page: 0, role: "", active: "", sort: "new" }); const PER = 40;
    view.innerHTML = `<div class="page-h"><h1>People</h1></div>${userTabs("users", cc)}${loadingCard()}`;
    let d, c, S;
    try {
      [d, c, S] = await Promise.all([sb.rpc("admin_list_users", { p_q: st.q || null, p_limit: PER, p_offset: st.page * PER, p_role: st.role || null, p_active: st.active || null, p_sort: st.sort }).then(must), counts(), sb.rpc("admin_user_stats").then(must)]);
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>People</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    d = d || { total: 0, items: [] }; S = S || {};
    const total = Number(d.total) || 0, items = d.items || [], pages = Math.max(1, Math.ceil(total / PER)), R = S.roles || {};
    const chip = (k, label, n) => `<button type="button" class="co-chip${st.role === k ? " on" : ""}" data-a="role" data-v="${k}">${label}${n != null ? ` <i>${fmtN(n)}</i>` : ""}</button>`;
    view.innerHTML = `<div class="page-h"><h1>People</h1></div>${userTabs("users", c)}
      <div class="tiles co-tiles"><div class="tile"><small>Registered</small><b>${fmtN(S.total)}</b></div><div class="tile g"><small>Active (30 days)</small><b>${fmtN(S.active)}</b></div><div class="tile"><small>Inactive</small><b>${fmtN(S.inactive)}</b></div><div class="tile k"><small>Invested (confirmed)</small><b>${esc(bdt(S.invested_total))}</b></div><div class="tile r"><small>Deals to verify</small><b>${fmtN(S.awaiting_verify)}</b></div><div class="tile"><small>Joined this week</small><b>${fmtN(S.new7)}</b></div></div>
      ${arr(S.top_investors).length ? `<div class="card"><h2>🏆 Top investors</h2><ol class="co-top">${S.top_investors.map((t, i) => `<li><span class="co-rank">${i + 1}</span><span class="co-av">${t.avatar_url && isUrl(t.avatar_url) ? `<img src="${esc(t.avatar_url)}" alt="" referrerpolicy="no-referrer">` : initial(t.name)}</span><span class="co-u-main"><b>${esc(t.name || "—")}</b><small>${fmtN(t.deals)} deal${t.deals == 1 ? "" : "s"} · ${fmtN(t.companies)} company</small></span><b>${esc(bdt(t.total))}</b></li>`).join("")}</ol></div>` : ""}
      <div class="co-chips">${chip("", "Everyone", S.total)}${chip("investor", "Investors", R.investor || 0)}${chip("founder", "Founders", R.founder || 0)}${chip("reader", "Readers", R.reader || 0)}${chip("other", "Others", R.other || 0)}</div>
      <form class="co-filters" id="uf"><input class="inp" id="q" type="search" placeholder="Search name or e-mail…" aria-label="Search" value="${esc(st.q)}" autocomplete="off">
        <select class="sel" id="fa" aria-label="Activity"><option value="">Active &amp; inactive</option><option value="active"${st.active === "active" ? " selected" : ""}>Active (30 days)</option><option value="inactive"${st.active === "inactive" ? " selected" : ""}>Inactive</option></select>
        <select class="sel" id="fo" aria-label="Sort"><option value="new">Newest</option><option value="invested"${st.sort === "invested" ? " selected" : ""}>Highest investor</option><option value="active"${st.sort === "active" ? " selected" : ""}>Recently active</option></select>
        <button class="b b-dark b-sm" type="submit">Apply</button></form>
      <p class="muted co-count">${fmtN(total)} ${total === 1 ? "person" : "people"} · page ${st.page + 1} of ${pages}</p>
      <div class="co-list">${items.length ? items.map((u) => `<details class="card co-user" data-uid="${esc(u.id)}"><summary>
          <span class="co-av">${u.avatar_url && isUrl(u.avatar_url) ? `<img src="${esc(u.avatar_url)}" alt="" referrerpolicy="no-referrer">` : initial(u.full_name || u.email)}</span>
          <span class="co-u-main"><b>${esc(u.full_name || "(no name)")}</b><small>${esc(u.email || "")}</small></span>
          <span class="co-u-meta">${rolePill(u.role)}<span class="co-dot ${u.active ? "on" : ""}" title="Last active ${esc(rel(u.last_active))}"></span><small class="muted">${u.active ? "Active" : "Inactive"} · ${esc(rel(u.last_active))}</small>${u.email_confirmed ? "" : '<span class="pill p-changes_requested">unconfirmed</span>'}</span>
          <span class="co-u-counts" title="invested · interests · companies · reviews · comments">${Number(u.invested_total) > 0 ? `<i class="inv">${esc(bdtShort(u.invested_total) || fmtN(u.invested_total))}</i>` : ""}<i>💰 ${fmtN(u.interests)}</i><i>🏢 ${fmtN(u.companies)}</i><i>★ ${fmtN(u.reviews)}</i><i>💬 ${fmtN(Number(u.comments) + Number(u.article_comments || 0))}</i></span></summary>
          <div class="co-u-body"><p class="muted">Joined ${esc(fmtDT(u.created_at))} · last sign-in ${u.last_sign_in_at ? esc(fmtDT(u.last_sign_in_at)) : "never"} · signed up with ${esc(u.provider || "email")}</p><div class="co-u-prof muted">Loading…</div></div></details>`).join("")
        : `<div class="empty"><b>Nobody here</b>No one matches these filters.</div>`}</div>
      <div class="co-pager"><button type="button" class="b b-line b-sm" data-a="pg" data-d="-1"${st.page <= 0 ? " disabled" : ""}>← Previous</button><span class="muted">${st.page + 1} / ${pages}</span><button type="button" class="b b-line b-sm" data-a="pg" data-d="1"${st.page + 1 >= pages ? " disabled" : ""}>Next →</button></div>
      <div class="card" style="margin-top:18px" id="fdefs"></div>`;
    view._h.copy = (b) => copyV(b);
    view._h.uoff = (b) => busy(b, async () => {
      const off = b.dataset.off === "1";
      let n = null;
      if (off) { n = await ask({ title: "Suspend this account", body: "They are signed out and cannot sign in or post anything. Their data is kept. You can restore the account any time from Trash.", label: "Reason (only you see it)", ok: "Suspend account", danger: true }); if (n === null) return; }
      must(await sb.rpc("admin_set_user_disabled", { p_user: b.dataset.id, p_disabled: off, p_reason: n || null }));
      toast(off ? "Account suspended" : "Account restored", "ok"); viewUsers(view);
    });
    view._h.pg = (b) => { st.page = Math.max(0, st.page + Number(b.dataset.d)); viewUsers(view); };
    view._h.role = (b) => { st.role = b.dataset.v; st.page = 0; viewUsers(view); };
    $("#uf", view).addEventListener("submit", (e) => { e.preventDefault(); st.q = $("#q", view).value.trim(); st.active = $("#fa", view).value; st.sort = $("#fo", view).value; st.page = 0; viewUsers(view); });
    fieldDefs($("#fdefs", view), () => viewUsers(view));
    if (view._tg) view.removeEventListener("toggle", view._tg, true);
    view._tg = async (e) => {
      const el = e.target; if (!el.matches || !el.matches("details.co-user") || !el.open || el.dataset.loaded) return;
      el.dataset.loaded = "1";
      const box = el.querySelector(".co-u-prof"), uid = el.dataset.uid;
      try {
        const D = must(await sb.rpc("admin_user_detail", { p_user: uid })) || {}, p = D.profile || {};
        box.classList.remove("muted");
        box.innerHTML = `<div class="co-2x"><div>${kv([["Phone", esc(p.phone)], ["Type chosen", esc(p.user_type)], ["Headline", esc(p.headline)], ["Location", esc(p.location)], ["About", esc(p.bio)]])}
            <p class="acts" style="justify-content:flex-start">${p.email ? `<a class="b b-line b-sm" href="mailto:${esc(p.email)}">E-mail</a>` : ""}<button type="button" class="b b-line b-sm" data-a="copy" data-v="${esc(uid)}">Copy user ID</button>${p.disabled_at ? `<button type="button" class="b b-green b-sm" data-a="uoff" data-id="${esc(uid)}" data-off="0">↩ Restore account</button>` : `<button type="button" class="b b-line b-sm co-trashbtn" data-a="uoff" data-id="${esc(uid)}" data-off="1">🗑 Suspend account</button>`}</p>${p.disabled_at ? `<p class="msg err">Suspended ${esc(fmtDT(p.disabled_at))}${p.disabled_reason ? " — " + esc(p.disabled_reason) : ""}. They cannot sign in or write anything.</p>` : ""}</div>
          <div><h3 class="co-h3">Your private fields</h3><div data-meta></div></div></div>
          ${arr(D.investments).length ? `<h3 class="co-h3">Investments</h3><ul class="co-ul">${D.investments.map((x) => `<li><b>${esc(bdt(x.amount))}</b> in <a href="#/companies/${esc(x.company_id)}">${esc(x.company)}</a> ${x.equity_pct != null ? `· ${esc(x.equity_pct)}%` : ""} ${dealPill(x.status)}</li>`).join("")}</ul>` : ""}
          ${arr(D.interests).length ? `<h3 class="co-h3">Showed interest in</h3><ul class="co-ul">${D.interests.map((x) => `<li><a href="#/companies/${esc(x.company_id)}">${esc(x.company)}</a> · ${esc(bdt(x.ticket_min))}–${esc(bdt(x.ticket_max))} · ${esc(x.investor_type)} · ${simplePill(x.status)}</li>`).join("")}</ul>` : ""}
          ${arr(D.companies).length ? `<h3 class="co-h3">Companies</h3><ul class="co-ul">${D.companies.map((x) => `<li><a href="#/companies/${esc(x.id)}">${esc(x.name || "(no name)")}</a> ${stPill(x.status)} ${x.registered === false ? '<span class="pill p-changes_requested">not registered</span>' : ""} ${Number(x.raised_amount) > 0 ? `· raised ${esc(bdt(x.raised_amount))} from ${fmtN(x.investor_count)}` : ""}</li>`).join("")}</ul>` : ""}`;
        metaBox("user", uid, $("[data-meta]", box));
      } catch (err) { box.textContent = errMsg(err); }
    };
    view.addEventListener("toggle", view._tg, true);
  }

  /* admin can add more data fields whenever needed */
  async function fieldDefs(host, after) {
    let defs = [];
    try { defs = must(await sb.from("admin_field_defs").select("*").order("scope").order("sort").order("created_at")) || []; } catch (e) { host.innerHTML = `<p class="msg err">${esc(errMsg(e))}</p>`; return; }
    host.innerHTML = `<h2>Custom fields</h2><p class="muted co-sub">Need to track something new about people or companies (e.g. “KYC status”, “Referred by”)? Add a field here — it appears in the private box on every user / company page. Visitors never see it.</p>
      ${defs.length ? `<ul class="co-ul co-defs">${defs.map((f) => `<li><b>${esc(f.label_en)}</b> <span class="pill p-draft">${esc(f.scope)}</span> <span class="muted">${esc(f.kind)}${arr(f.options).length ? " · " + esc(arr(f.options).join(", ")) : ""}</span> <button type="button" class="b b-line b-sm" data-a="fdt" data-id="${esc(f.id)}" data-v="${f.active ? "0" : "1"}">${f.active ? "Hide" : "Show"}</button></li>`).join("")}</ul>` : ""}
      <form id="fdf" class="co-fdf"><select class="sel" name="scope" aria-label="Where"><option value="user">People</option><option value="company">Companies</option></select><input class="inp" name="label" placeholder="Field name, e.g. KYC status" maxlength="60" required>
        <select class="sel" name="kind" aria-label="Type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="bool">Yes / No</option><option value="select">Choice list</option></select>
        <input class="inp" name="opts" placeholder="Choices, comma separated (for Choice list)" maxlength="300"><button class="b b-dark b-sm" type="submit">Add field</button></form><div class="msg err" hidden id="fdm"></div>`;
    host.addEventListener("click", (e) => { const b = e.target.closest("[data-a='fdt']"); if (!b) return; busy(b, async () => { must(await sb.from("admin_field_defs").update({ active: b.dataset.v === "1" }).eq("id", b.dataset.id)); after(); }); });
    $("#fdf", host).addEventListener("submit", (e) => { e.preventDefault(); const f = e.target, m = $("#fdm", host); m.hidden = true;
      const label = f.label.value.trim(), key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      if (!/^[a-z][a-z0-9_]{1,40}$/.test(key)) { m.hidden = false; m.textContent = "Use a name that starts with a letter."; return; }
      busy(f.querySelector("[type=submit]"), async () => { try { must(await sb.from("admin_field_defs").insert({ scope: f.scope.value, key, label_en: label, label_bn: label, kind: f.kind.value, options: f.kind.value === "select" ? f.opts.value.split(",").map((s) => s.trim()).filter(Boolean) : [], sort: 100 })); toast("Field added", "ok"); after(); } catch (er) { m.hidden = false; m.textContent = /duplicate/i.test(errMsg(er)) ? "A field with this name already exists." : errMsg(er); } }); });
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

  /* ======================================================================
     Trash: removal requests from owners, removed companies, suspended users — all restorable
     ====================================================================== */
  async function viewTrash(view) {
    bind(view);
    view.innerHTML = `<div class="page-h"><h1>Trash</h1></div>${tabs("trash", cc)}${loadingCard()}`;
    let T;
    try { T = must(await sb.rpc("admin_trash")) || {}; } catch (e) { view.innerHTML = `<div class="page-h"><h1>Trash</h1></div>${errorCard(e)}`; return; }
    if (!view.isConnected) return;
    const reqs = arr(T.requests), cos = arr(T.companies), us = arr(T.users);
    view.innerHTML = `<div class="page-h"><h1>Trash</h1></div>${tabs("trash", cc)}
      <div class="msg info">Nothing here is ever erased. Removed companies and suspended people can be brought back with one click.</div>
      <div class="card"><h2>Removal requests from owners <span class="pill p-submitted">${reqs.length}</span></h2>
        ${reqs.length ? `<div class="co-trows">${reqs.map((r) => `<div class="co-trow"><div class="ti"><h3><a href="#/companies/${esc(r.company_id)}">${esc(r.company || "(company)")}</a></h3><div class="meta"><span>${esc(r.owner || "")}</span><span>${esc(fmtDT(r.created_at))}</span></div><p class="co-quote">“${esc(r.reason)}”</p></div>
          <div class="acts"><button type="button" class="b b-red b-sm" data-a="dok" data-id="${esc(r.id)}" data-ok="1">Approve &amp; remove</button><button type="button" class="b b-line b-sm" data-a="dok" data-id="${esc(r.id)}" data-ok="0">Decline</button></div></div>`).join("")}</div>` : `<p class="muted">No owner is waiting for a decision.</p>`}</div>
      <div class="card"><h2>Removed companies <span class="pill p-draft">${cos.length}</span></h2>
        ${cos.length ? `<div class="co-trows">${cos.map((c) => `<div class="co-trow"><div class="ti"><h3><a href="#/companies/${esc(c.id)}">${esc(c.name || "(no name)")}</a></h3><div class="meta"><span>was ${esc(ST[c.prev_status] || c.prev_status || "—")}</span><span>removed ${esc(fmtDT(c.deleted_at))}</span></div>${c.reason ? `<p class="muted co-sub">${esc(c.reason)}</p>` : ""}</div>
          <div class="acts"><button type="button" class="b b-green b-sm" data-a="rco" data-id="${esc(c.id)}">↩ Restore</button></div></div>`).join("")}</div>` : `<p class="muted">The trash is empty.</p>`}</div>
      <div class="card"><h2>Suspended people <span class="pill p-draft">${us.length}</span></h2>
        ${us.length ? `<div class="co-trows">${us.map((u) => `<div class="co-trow"><div class="ti"><h3>${esc(u.name || "(no name)")}</h3><div class="meta"><span>${esc(u.email || "")}</span><span>suspended ${esc(fmtDT(u.disabled_at))}</span></div>${u.reason ? `<p class="muted co-sub">${esc(u.reason)}</p>` : ""}</div>
          <div class="acts"><button type="button" class="b b-green b-sm" data-a="rus" data-id="${esc(u.id)}">↩ Restore account</button></div></div>`).join("")}</div>` : `<p class="muted">Nobody is suspended.</p>`}</div>`;
    view._h.dok = (b) => busy(b, async () => {
      const ok = b.dataset.ok === "1";
      const n = await ask({ title: ok ? "Approve removal" : "Decline removal", body: ok ? "The company is moved to the trash and disappears from the site. You can restore it later." : "The owner sees your note and the company stays as it is.", label: ok ? "Note to owner (optional)" : "Reason", required: !ok, ok: ok ? "Approve & remove" : "Decline", danger: ok });
      if (n === null) return;
      must(await sb.rpc("admin_decide_company_deletion", { p_id: b.dataset.id, p_approve: ok, p_note: n || null }));
      toast(ok ? "Company removed" : "Request declined", "ok"); refreshBadges(true); viewTrash(view);
    });
    view._h.rco = (b) => busy(b, async () => { must(await sb.rpc("admin_set_company_deleted", { p_company: b.dataset.id, p_deleted: false })); toast("Restored", "ok"); viewTrash(view); });
    view._h.rus = (b) => busy(b, async () => { must(await sb.rpc("admin_set_user_disabled", { p_user: b.dataset.id, p_disabled: false })); toast("Account restored", "ok"); viewTrash(view); });
  }

  /* ---------------- router entry ---------------- */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function handles(h) {
    return ["companies", "companies/all", "payments", "reviews", "interests", "company-settings", "users", "deletions", "valuations", "deals", "trash"].includes(h) || (h.startsWith("companies/") && UUID.test(h.slice(10)));
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
    if (h === "valuations") return viewValuations(view);
    if (h === "deals") return viewDeals(view);
    if (h === "trash") return viewTrash(view);
    if (h === "deletions") return viewDeletions(view);
  }
  return { handles, render, refreshBadges, counts, dashSection };
};
