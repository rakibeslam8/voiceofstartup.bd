/* Voice of Startup Bangladesh — admin: Paid promotion (PR) control centre.
   Loaded before admin.js. admin.js calls window.VOSB_ADMIN_PR(context) once and delegates these routes:
     pr (orders) · pr/revenue · pr/schedule · pr/services · pr/coupons (all services + company listing) · pr/campaigns · pr/settings
   Security: this file is only a UI. Every read/write is checked by the database (RLS + admin-only functions such as admin_pr_set_order).
   Nothing is ever hard-deleted: services, coupons and campaigns are removed with deleted_at and can be restored; orders are cancelled / rejected. */
window.VOSB_ADMIN_PR = function (X) {
  "use strict";
  const { sb, esc, toast, modal, copyText, fmtDT, fmtN, $, $$, fetchAll } = X;
  const F = window.VOSB_PRF || { F: {}, SETS: {}, SET_OF: {}, OVR: {}, CORE: [] };

  const errMsg = (e) => String((e && (e.message || e.details)) || e || "Something went wrong");
  const must = (res) => { if (res && res.error) throw new Error(errMsg(res.error)); return res ? res.data : null; };
  const bdt = (n) => (n === null || n === undefined || n === "" ? "—" : "৳" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
  const num = (v) => { v = String(v == null ? "" : v).replace(/[,\s]/g, ""); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  const safeHref = (u) => { u = String(u == null ? "" : u).trim(); return /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : "#"; };
  const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 16) : "");        // Bangladesh time (UTC+6) for <input type=datetime-local>
  const fromLocal = (s) => (s ? new Date(s + ":00+06:00").toISOString() : null);
  const loadingCard = () => `<div class="card"><p class="muted">Loading…</p></div>`;
  const errorCard = (e) => `<div class="card"><div class="msg err">${esc(errMsg(e))}</div></div>`;
  const copyBtn = (text, label) => (text ? `<button type="button" class="b b-ghost b-sm co-copy" data-a="copy" data-v="${esc(text)}" title="Copy ${esc(label || "")}" aria-label="Copy ${esc(label || "")}">⧉</button>` : "");
  const ORD_ST = ["new", "confirmed", "in_progress", "delivered", "cancelled", "rejected"];
  const PAY_ST = ["none", "pending", "verified", "rejected"];
  const ORD_L = { new: "New", confirmed: "Confirmed", in_progress: "In progress", delivered: "Delivered", cancelled: "Cancelled", rejected: "Rejected" };
  const PAY_L = { none: "Unpaid", pending: "Payment waiting", verified: "Paid", rejected: "Payment rejected" };
  const pill = (cls, t) => `<span class="pill pr-${esc(cls)}">${esc(t)}</span>`;
  const CATS = [["content", "Content"], ["video", "Video"], ["campaign", "Campaign"], ["partner", "Partnership"], ["other", "More"]];

  async function busy(b, fn) {
    if (b) b.disabled = true;
    try { await fn(); } catch (e) { toast(errMsg(e), "err"); }
    finally { if (b && b.isConnected) b.disabled = false; }
  }
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
  /* a generic dialog: body html + a function that reads the fields and saves; resolves true when saved */
  function dialog({ title, html, ok = "Save", wide = false, cls = "", onSave, onOpen }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.innerHTML = `<form class="modal pr-modal${wide ? " wide" : ""}${cls ? " " + cls : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate><div class="pr-mh"><h2>${esc(title)}</h2><button type="button" class="pr-mx" data-x="0" aria-label="Close">✕</button></div><div class="pr-mbody">${html}</div>
        <div class="msg err" hidden></div>
        <div class="acts"><button type="button" class="b b-line" data-x="0">Cancel</button><button type="submit" class="b b-orange">${esc(ok)}</button></div></form>`;
      const done = (v) => { bg.remove(); document.removeEventListener("keydown", key); resolve(v); };
      const key = (e) => { if (e.key === "Escape") done(false); };
      bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-x='0']")) done(false); const c = e.target.closest("[data-copyv]"); if (c) copyText(c.dataset.copyv).then(() => toast("Copied", "ok")); });
      bg.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const m = bg.querySelector(".msg"), sbtn = bg.querySelector("[type=submit]");
        m.hidden = true; sbtn.disabled = true;
        try { await onSave(bg); done(true); } catch (er) { m.hidden = false; m.textContent = errMsg(er); sbtn.disabled = false; }
      });
      document.addEventListener("keydown", key);
      document.body.appendChild(bg);
      if (onOpen) onOpen(bg);
      const first = cls === "mo" ? null : bg.querySelector("input:not([type=hidden]):not([disabled]),select,textarea"); if (first) first.focus();
    });
  }
  const val = (bg, id) => { const el = bg.querySelector("#" + id); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : ""; };
  const fld = (id, label, inner, hint) => `<div class="fld"><label for="${id}">${esc(label)}${hint ? ` <span class="hint">${hint}</span>` : ""}</label>${inner}</div>`;
  const inp = (id, v, extra) => `<input class="inp" id="${id}" value="${esc(v == null ? "" : v)}" ${extra || ""}>`;
  const txt = (id, v, rows, max) => `<textarea class="txt" id="${id}" rows="${rows || 3}" maxlength="${max || 1000}">${esc(v == null ? "" : v)}</textarea>`;
  const sel = (id, opts, cur) => `<select class="sel" id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  const chk = (id, label, on) => `<label class="chk" style="margin:4px 0 12px"><input type="checkbox" id="${id}"${on ? " checked" : ""}> ${esc(label)}</label>`;

  /* ---------------- tabs + badge ---------------- */
  let attn = null, attnAt = 0;
  async function attention(force) {
    if (!force && attn !== null && Date.now() - attnAt < 8000) return attn;
    try {
      const rows = must(await sb.from("pr_orders").select("pay_status,kind,amount,status").is("deleted_at", null).in("status", ["new", "confirmed", "in_progress"])) || [];
      attn = { pay: rows.filter((o) => o.pay_status === "pending").length, quote: rows.filter((o) => o.kind === "quote" && o.amount == null && o.status === "new").length, fresh: rows.filter((o) => o.status === "new" && o.kind === "free").length };
      attn.total = attn.pay + attn.quote + attn.fresh; attnAt = Date.now();
    } catch (e) { /* keep the last numbers */ }
    return attn;
  }
  async function refreshBadges(force) {
    const a = await attention(force), n = a ? a.total : 0;
    $$("[data-badge='ads']").forEach((b) => { b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n); });
  }
  const TABS = [["ads", "Ads", "#/ads"], ["orders", "PR orders", "#/pr"], ["revenue", "Revenue & charges", "#/pr/revenue"], ["schedule", "Schedule", "#/pr/schedule"], ["services", "Services", "#/pr/services"], ["coupons", "Coupons", "#/pr/coupons"], ["campaigns", "Free campaigns", "#/pr/campaigns"], ["settings", "Page & stats", "#/pr/settings"]];
  const tabs = (active) => `<div class="co-tabs" role="tablist" aria-label="Ads and PR">${TABS.map(([k, t, h]) => `<a href="${h}" role="tab" class="${k === active ? "on" : ""}" ${k === active ? 'aria-selected="true"' : ""}>${esc(t)}${k === "orders" && attn && attn.total ? `<i>${attn.total > 99 ? "99+" : attn.total}</i>` : ""}</a>`).join("")}</div>`;

  const handles = (h) => h === "pr" || h.indexOf("pr/") === 0 || h === "company-coupons";
  function render(h, view) {
    if (h === "pr") return viewOrders(view);
    if (h === "pr/revenue") return viewRevenue(view);
    if (h === "pr/schedule") return viewSchedule(view);
    if (h === "pr/services") return viewServices(view);
    if (h === "pr/coupons") return viewCoupons(view, "pr");
    if (h === "company-coupons") return viewCoupons(view, "listing");
    if (h === "pr/campaigns") return viewCampaigns(view);
    if (h === "pr/settings") return viewSettings(view);
    location.hash = "#/pr";
  }
  const head = (title, extra) => `<div class="page-h"><h1>${esc(title)}</h1>${extra || ""}</div>`;

  const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const shiftDay = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fmtDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fmtDayS = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const liveOrder = (o) => o && !o.deleted_at && !["cancelled", "rejected"].includes(o.status);
  /* move one booked item to another day (the database checks the seats; “override” lets you go over the limit on purpose) */
  function moveDialog(b, label) {
    return new Promise((resolve) => {
      let moved = false;
      dialog({ title: "Change publish date", ok: "Move", html: `<p><b>${esc(label || "")}</b><br><span class="muted">Now: ${esc(fmtDay(b.day))}. The buyer is notified.</span></p>${fld("mv-d", "New date", inp("mv-d", b.day, 'type="date"'))}${chk("mv-f", "Allow even if that day is already full (override)", false)}`,
        onSave: async (bg) => { const d = val(bg, "mv-d"); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Pick a date."); must(await sb.rpc("admin_pr_move_booking", { p_id: b.id, p_day: d, p_force: val(bg, "mv-f") })); moved = d; } }).then((ok) => resolve(ok ? moved : false));
    });
  }

  /* ---------------- ORDERS ---------------- */
  async function viewOrders(view) {
    bind(view);
    view.innerHTML = head("PR orders") + tabs("orders") + loadingCard();
    let rows, svcs, bkAll;
    try {
      [rows, svcs, bkAll] = await Promise.all([fetchAll(() => sb.from("pr_orders").select("*").is("deleted_at", null).order("created_at", { ascending: false }).order("id")), sb.from("pr_services").select("id,icon,key"), fetchAll(() => sb.from("pr_bookings").select("id,order_id,day,slot_group").order("day").order("id"))]);
      rows = must(rows) || []; svcs = must(svcs) || []; bkAll = must(bkAll) || [];
    } catch (e) { view.innerHTML = head("PR orders") + tabs("orders") + errorCard(e); return; }
    if (!view.isConnected) return;
    await attention(true); refreshBadges();
    const ico = {}; svcs.forEach((s) => (ico[s.id] = s.icon));
    const bks = {}; bkAll.forEach((b) => (bks[b.order_id] = bks[b.order_id] || []).push(b));
    const live = rows.filter((o) => !["cancelled", "rejected"].includes(o.status));
    const paidSum = rows.filter((o) => o.pay_status === "verified" && o.kind !== "free").reduce((n, o) => n + Number(o.amount || 0), 0);
    const waiting = rows.filter((o) => o.pay_status === "pending").length, quotes = rows.filter((o) => o.kind === "quote" && o.amount == null && o.status === "new").length;
    const st = { q: "", s: "all", p: "all", v: "all" };
    const svcNames = [...new Map(rows.map((o) => [o.service_key, o.service_name_en])).entries()];
    view.innerHTML = head("PR orders", `<span class="exp-row"><button type="button" class="b b-line b-sm" data-exp="pr_clients" data-act="1" title="Clients with an order that is not cancelled or rejected">⬇ Active clients (CSV)</button><button type="button" class="b b-line b-sm" data-exp="pr_clients" data-act="0">⬇ All clients (CSV)</button></span>`) + tabs("orders") + `
      <div class="tiles">
        <div class="tile r"><small>Payments to verify</small><b>${fmtN(waiting)}</b></div>
        <div class="tile"><small>Quotes to price</small><b>${fmtN(quotes)}</b></div>
        <div class="tile g"><small>Revenue (verified)</small><b>${esc(bdt(paidSum))}</b></div>
        <div class="tile k"><small>Active orders</small><b>${fmtN(live.length)}</b></div>
      </div>
      <div class="msg info">bKash “Send Money” cannot be confirmed automatically: open your bKash app/SMS, find the TrxID shown below with the same amount, then press <b>Verify</b>. For quote orders, press <b>Manage</b> and type the price — the buyer is notified and can pay from their “My orders” page.</div>
      <div class="co-filters pr-filters"><input class="inp" id="q" type="search" placeholder="Search order no., brand, name, phone, e-mail, TrxID…" aria-label="Search" autocomplete="off">
        <select class="sel" id="fs" aria-label="Order status"><option value="all">All statuses</option>${ORD_ST.map((s) => `<option value="${s}">${ORD_L[s]}</option>`).join("")}</select>
        <select class="sel" id="fp" aria-label="Payment"><option value="all">All payments</option>${PAY_ST.map((s) => `<option value="${s}">${PAY_L[s]}</option>`).join("")}</select>
        <select class="sel" id="fv" aria-label="Service"><option value="all">All services</option>${svcNames.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join("")}</select></div>
      <p class="muted co-count" id="cnt" aria-live="polite"></p><div class="rows" id="list"></div>`;
    const rank = (o) => (o.pay_status === "pending" ? 0 : o.kind === "quote" && o.amount == null && o.status === "new" ? 1 : o.status === "new" ? 2 : ["confirmed", "in_progress"].includes(o.status) ? 3 : 4);
    const paint = () => {
      const q = st.q.toLowerCase();
      const l = rows.filter((o) => (st.s === "all" || o.status === st.s) && (st.p === "all" || o.pay_status === st.p) && (st.v === "all" || o.service_key === st.v)
        && (!q || [o.order_no, o.user_email, o.trx_id, o.sender_msisdn, o.brief && o.brief.brand, o.brief && o.brief.name, o.brief && o.brief.phone, o.brief && o.brief.email].some((x) => (x || "").toLowerCase().includes(q))))
        .sort((a, b) => rank(a) - rank(b) || (b.created_at || "").localeCompare(a.created_at || ""));
      $("#cnt", view).textContent = `${l.length} order${l.length === 1 ? "" : "s"}`;
      $("#list", view).innerHTML = l.length ? l.map((o) => {
        const br = o.brief || {}, quote = o.kind === "quote" && o.amount == null;
        const amt = quote ? `<span class="pill pr-pending">Needs price</span>` : o.kind === "free" ? pill("verified", "Free campaign") : `${esc(bdt(o.amount))}`;
        return `<div class="row pr-row"><div class="th co-logo">${esc(ico[o.service_id] || "📣")}</div><div class="ti"><h3>${esc(o.service_name_en)}${o.qty > 1 ? " × " + o.qty : ""} <small>· ${amt}</small> ${pill(o.status, ORD_L[o.status])}${o.kind !== "free" && !quote ? " " + pill(o.pay_status, PAY_L[o.pay_status]) : ""}</h3>
          <div class="meta"><span><b>${esc(o.order_no)}</b></span><span>${esc(br.brand || "—")}</span><span>${esc(br.name || "")}</span><span>${br.phone ? `<a href="tel:${esc(br.phone)}">${esc(br.phone)}</a>` : ""}</span><span>${br.email ? `<a href="mailto:${esc(br.email)}">${esc(br.email)}</a>` : ""}</span><span>${esc(fmtDT(o.created_at))}</span></div>
          ${(bks[o.id] || []).length ? `<div class="meta"><span>📅 <b>Publish:</b> ${bks[o.id].map((b) => esc(fmtDayS(b.day))).join(" · ")}</span></div>` : ""}
          <div class="meta">${o.trx_id ? `<span>TrxID <code class="co-trx">${esc(o.trx_id)}</code> ${copyBtn(o.trx_id, "TrxID")}</span><span>${esc(String(o.pay_method || "").toUpperCase())} from ${esc(o.sender_msisdn || "")}</span>` : ""}${o.coupon_code ? `<span>Coupon <b>${esc(o.coupon_code)}</b> −${esc(bdt(o.discount))}</span>` : ""}${o.admin_note ? `<span>Note: ${esc(o.admin_note)}</span>` : ""}</div></div>
          <div class="acts">${o.pay_status === "pending" ? `<button type="button" class="b b-green b-sm" data-a="verify" data-id="${esc(o.id)}">Verify</button><button type="button" class="b b-red b-sm" data-a="reject" data-id="${esc(o.id)}">Reject</button>` : ""}<button type="button" class="b b-line b-sm" data-a="manage" data-id="${esc(o.id)}">Manage</button></div></div>`;
      }).join("") : `<div class="empty"><b>No orders</b>Nothing matches these filters.</div>`;
    };
    paint();
    $("#q", view).addEventListener("input", (e) => { st.q = e.target.value.trim(); paint(); });
    $("#fs", view).addEventListener("change", (e) => { st.s = e.target.value; paint(); });
    $("#fp", view).addEventListener("change", (e) => { st.p = e.target.value; paint(); });
    $("#fv", view).addEventListener("change", (e) => { st.v = e.target.value; paint(); });
    const reload = async () => { const y = window.scrollY; await viewOrders(view); window.scrollTo(0, y); refreshBadges(true); };
    const byId = (id) => rows.find((o) => o.id === id);
    view._h.copy = (b) => copyText(b.dataset.v).then(() => toast("Copied", "ok"));
    view._h.verify = (b) => busy(b, async () => {
      if (!(await modal({ title: "Confirm payment received?", body: "Only verify after you see this exact TrxID and amount in the bKash account.", ok: "Yes, verified" }))) return;
      must(await sb.rpc("admin_pr_set_order", { p_id: b.dataset.id, p: { pay_status: "verified" } }));
      toast("Payment verified — buyer notified", "ok"); await reload();
    });
    view._h.reject = (b) => busy(b, async () => {
      const ok = await dialog({ title: "Reject this payment", ok: "Reject payment", html: `<p>The buyer sees this note (e.g. “TrxID not found in our bKash account”).</p>${fld("rj", "Reason *", txt("rj", "", 3, 600))}`,
        onSave: async (bg) => { const r = val(bg, "rj"); if (!r) throw new Error("Please write the reason first."); must(await sb.rpc("admin_pr_set_order", { p_id: b.dataset.id, p: { pay_status: "rejected", admin_note: r } })); } });
      if (ok) { toast("Payment rejected — buyer notified", "ok"); await reload(); }
    });
    view._h.manage = (b) => busy(b, async () => { const o = byId(b.dataset.id); if (!o) return; const r = await manage(Object.assign({ service_icon: ico[o.service_id] }, o), bks[o.id] || []); if (r) { toast(r === "moved" ? "Date changed" : "Order saved", "ok"); await reload(); } });
  }

  async function manage(o, bookings) {
    let moved = false;
    let priv = ""; try { const r = must(await sb.from("pr_order_private").select("internal_note").eq("order_id", o.id).maybeSingle()); priv = (r && r.internal_note) || ""; } catch (e) { /* none yet */ }
    const br = o.brief || {}, setKey = F.SET_OF[o.service_key] || "other", order = F.CORE.concat(["what"], F.SETS[setKey] || [], ["notes"]);
    const lab = (k) => { const ov = (F.OVR[o.service_key] || {})[k], d = F.F[k]; return ov ? ov[1] : d ? d[1] : k; };
    const shown = order.filter((k) => br[k]).concat(Object.keys(br).filter((k) => !order.includes(k) && k !== "extra"));
    const opt = (k, v) => { const d = F.F[k]; const m = d && d[5] ? d[5].find((x) => x[0] === v) : null; return m ? m[2] : v; };
    const val2 = (k) => { const v = String(br[k]); if (/^https?:\/\//i.test(v)) return `<a href="${esc(safeHref(v))}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`; if (k === "phone") return `<a href="tel:${esc(v.replace(/[^\d+]/g, ""))}">${esc(v)}</a>`; if (k === "email") return `<a href="mailto:${esc(v)}">${esc(v)}</a>`; return esc(opt(k, v)); };
    const kv = (k) => `<div class="mo-kv${String(br[k]).length > 60 ? " long" : ""}"><span>${esc(lab(k))}</span><div>${val2(k)}</div></div>`;
    const contactKeys = shown.filter((k) => F.CORE.includes(k)), briefKeys = shown.filter((k) => !F.CORE.includes(k));
    const extras = (Array.isArray(br.extra) ? br.extra : []).map((x) => `<div class="mo-kv${String(x.v || "").length > 60 ? " long" : ""}"><span>${esc(x.en || x.id)}</span><div>${/^https?:\/\//i.test(x.v) ? `<a href="${esc(safeHref(x.v))}" target="_blank" rel="noopener noreferrer">${esc(x.v)}</a>` : esc(x.v)}</div></div>`).join("");
    const verified = o.pay_status === "verified";
    const dates = (bookings || []).length ? `<section class="mo-card"><h3>📅 Publish dates</h3><p class="muted mo-sub">The buyer is notified when you change a date.</p><div class="pr-bks">${bookings.map((b) => `<span class="pr-bk" data-bk="${esc(b.id)}"><b>${esc(fmtDay(b.day))}</b> <button type="button" class="b b-line b-sm" data-mv="${esc(b.id)}">Change</button></span>`).join("")}</div></section>` : "";
    const quote = o.kind === "quote" && o.amount == null;
    const html = `<div class="mo-head"><div class="mo-ic">${esc((o.service_icon) || "📣")}</div><div class="mo-ht"><b>${esc(o.service_name_en)}${o.qty > 1 ? " × " + o.qty : ""}</b><span class="muted">${esc(o.order_no)} · ${esc(fmtDT(o.created_at))}</span></div>
        <div class="mo-pills">${pill(o.status, ORD_L[o.status] || o.status)}${pill(o.pay_status, PAY_L[o.pay_status] || o.pay_status)}</div></div>
      <div class="mo-stats"><div><small>${quote ? "Price" : "Amount"}</small><b>${quote ? "Not set" : esc(bdt(o.amount))}</b></div>${o.coupon_code ? `<div><small>Coupon</small><b>${esc(o.coupon_code)} <span class="muted">−${esc(bdt(o.discount))}</span></b></div>` : ""}<div><small>Buyer</small><b class="mo-em">${esc(o.user_email || "—")}</b></div>${o.trx_id ? `<div><small>bKash TrxID</small><b><span class="co-trx">${esc(o.trx_id)}</span> <button type="button" class="b b-ghost b-sm" data-copyv="${esc(o.trx_id)}" aria-label="Copy TrxID">⧉</button><br><span class="muted mo-sm">from ${esc(o.sender_msisdn || "")}</span></b></div>` : ""}</div>
      <div class="mo-grid">
        <div class="mo-col">
          <section class="mo-card"><h3>👤 Contact</h3>${contactKeys.map(kv).join("") || '<p class="muted">No details.</p>'}</section>
          <section class="mo-card"><h3>📝 Brief</h3>${briefKeys.map(kv).join("") + extras || '<p class="muted">No details.</p>'}</section>
          ${dates}
        </div>
        <div class="mo-col">
          <section class="mo-card mo-form"><h3>⚙️ Manage</h3>
            <div class="pr-two">${fld("m-amt", quote ? "Price (৳) — set the quote" : "Amount (৳)", inp("m-amt", o.amount == null ? "" : o.amount, `inputmode="decimal" ${verified ? "disabled" : ""}`), verified ? "locked: payment verified" : "")}
              ${fld("m-st", "Order status", sel("m-st", ORD_ST.map((s) => [s, ORD_L[s]]), o.status))}</div>
            ${fld("m-pay", "Payment status", sel("m-pay", PAY_ST.map((s) => [s, PAY_L[s]]), o.pay_status), "changing it notifies the buyer")}
            ${fld("m-note", "Message to the buyer", txt("m-note", o.admin_note || "", 3, 600), "shown on their “My orders” page")}
            ${fld("m-url", "Published link", inp("m-url", o.delivered_url || "", 'placeholder="https://…" inputmode="url"'), "shown to the buyer when delivered")}
            ${fld("m-int", "Internal note", txt("m-int", priv, 3, 1000), "only admins see this")}</section>
        </div>
      </div>`;
    const res = await dialog({ title: "Manage order", html, wide: true, cls: "mo", ok: "Save changes",
      onOpen: (bg) => bg.addEventListener("click", async (e) => {
        const m = e.target.closest("[data-mv]"); if (!m) return; e.preventDefault();
        const b = (bookings || []).find((x) => x.id === m.dataset.mv); if (!b) return;
        const d = await moveDialog(b, o.order_no + " · " + o.service_name_en);
        if (d) { b.day = d; moved = true; const t = bg.querySelector(`[data-bk="${b.id}"] b`); if (t) t.textContent = fmtDay(d); toast("Date changed — buyer notified", "ok"); }
      }),
      onSave: async (bg) => {
      const p = {}, st = val(bg, "m-st"), ps = val(bg, "m-pay"), amtRaw = val(bg, "m-amt");
      if (st !== o.status) p.status = st;
      if (ps !== o.pay_status) p.pay_status = ps;
      if (!verified) { const a = num(amtRaw); if (Number.isNaN(a)) throw new Error("Amount must be a number."); if ((a == null ? null : a) !== (o.amount == null ? null : Number(o.amount))) p.amount = a == null ? "" : String(a); }
      p.admin_note = val(bg, "m-note"); p.delivered_url = val(bg, "m-url"); p.internal_note = val(bg, "m-int");
      must(await sb.rpc("admin_pr_set_order", { p_id: o.id, p }));
    } });
    return res ? true : moved ? "moved" : false;
  }

  /* ---------------- SERVICES ---------------- */
  async function viewServices(view) {
    bind(view);
    view.innerHTML = head("Services & prices") + tabs("services") + loadingCard();
    let rows, groups;
    try { [rows, groups] = await Promise.all([sb.from("pr_services").select("*").order("sort").order("name_en"), sb.from("pr_slot_groups").select("*").order("sort")]); rows = must(rows) || []; groups = must(groups) || []; } catch (e) { view.innerHTML = head("Services & prices") + tabs("services") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const gname = {}; groups.forEach((g) => (gname[g.key] = g.name_en));
    const st = { removed: false, all: false };
    view.innerHTML = head("Services & prices", `<button type="button" class="b b-orange" data-a="add">➕ New service</button>`) + tabs("services") + `
      <div class="msg info"><b>Change a price fast:</b> type the new amount in the box and press <b>Save price</b> (empty = “Get a quote”). Use <b>Edit</b> for everything else — description, notice for buyers, <b>extra questions</b> to collect, and the <b>booking calendar group</b>. Prices are in Bangladeshi Taka (৳). Services that are switched off are hidden from the page.</div>
      <label class="chk" style="margin:0 2px 12px"><input type="checkbox" id="rm"> Show removed services</label><div class="rows" id="list"></div>`;
    const paint = () => {
      const l = rows.filter((s) => (st.removed ? !!s.deleted_at : !s.deleted_at));
      $("#list", view).innerHTML = l.length ? l.map((s) => { const xf = Array.isArray(s.extra_fields) ? s.extra_fields.length : 0; return `<div class="row pr-row"><div class="th co-logo">${esc(s.icon)}</div><div class="ti"><h3>${esc(s.name_en)} <small>· ${s.price == null ? "Quote" : esc(bdt(s.price)) + " " + esc(s.unit_en)}</small> ${s.active ? pill("verified", "On") : pill("none", "Off")}${s.popular ? " " + pill("new", "Popular") : ""}</h3>
        <div class="meta"><span>${esc(s.name_bn)}</span><span>key: <code>${esc(s.key)}</code></span><span>${esc((CATS.find((c) => c[0] === s.category) || [0, s.category])[1])}</span><span>qty ${s.min_qty}–${s.max_qty}</span><span>order ${s.sort}</span><span>${s.slot_group ? "📅 " + esc(gname[s.slot_group] || s.slot_group) : "no calendar"}</span>${xf ? `<span>${xf} extra question${xf > 1 ? "s" : ""}</span>` : ""}${s.notice_en || s.notice_bn ? `<span>ℹ️ notice</span>` : ""}</div>
        ${s.deleted_at ? "" : `<div class="pr-qp"><b>৳</b><input class="inp" data-qp="${esc(s.id)}" value="${s.price == null ? "" : esc(s.price)}" inputmode="decimal" placeholder="quote" aria-label="Price of ${esc(s.name_en)}"><button type="button" class="b b-line b-sm" data-a="qp" data-id="${esc(s.id)}">Save price</button></div>`}</div>
        <div class="acts">${s.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(s.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="toggle" data-id="${esc(s.id)}">${s.active ? "Turn off" : "Turn on"}</button><button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(s.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(s.id)}">Remove</button>`}</div></div>`; }).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No services yet"}</b></div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    if (!view._qpk) { view._qpk = true; view.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.qp) { e.preventDefault(); const b = view.querySelector(`[data-a="qp"][data-id="${e.target.dataset.qp}"]`); if (b) b.click(); } }); }
    const reload = async () => { const y = window.scrollY; await viewServices(view); window.scrollTo(0, y); };
    const byId = (id) => rows.find((s) => s.id === id);
    const upd = async (id, patch) => { must(await sb.from("pr_services").update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq("id", id)); };
    view._h.qp = (b) => busy(b, async () => {
      const s = byId(b.dataset.id), i = view.querySelector(`[data-qp="${b.dataset.id}"]`), v = num(i.value);
      if (Number.isNaN(v) || (v != null && (v < 0 || v > 1e8))) throw new Error("Price must be a number (or empty for a quote).");
      if ((v == null ? null : v) === (s.price == null ? null : Number(s.price))) { toast("Price unchanged", ""); return; }
      await upd(s.id, { price: v }); toast(`${s.name_en}: ${v == null ? "now “Get a quote”" : "price set to " + bdt(v)} — live on /pr`, "ok"); await reload();
    });
    view._h.toggle = (b) => busy(b, async () => { const s = byId(b.dataset.id); await upd(s.id, { active: !s.active }); await reload(); });
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this service?", body: "It disappears from the page. Old orders keep their details and you can restore it any time.", ok: "Remove", danger: true }))) return; await upd(b.dataset.id, { deleted_at: new Date().toISOString(), active: false }); await reload(); });
    view._h.restore = (b) => busy(b, async () => { await upd(b.dataset.id, { deleted_at: null }); await reload(); });
    view._h.add = () => svcForm(null, groups).then((ok) => ok && reload());
    view._h.edit = (b) => svcForm(byId(b.dataset.id), groups).then((ok) => ok && reload());
  }
  const XF_TYPES = [["text", "Short text"], ["textarea", "Long text"], ["select", "Choice list"], ["number", "Number"], ["url", "Link (URL)"], ["date", "Date"]];
  const xfRow = (f) => `<div class="pr-xf" data-xf data-id="${esc(f.id || "")}"><div class="pr-xf-r1"><input class="inp" data-k="en" maxlength="80" placeholder="Question (English) *" aria-label="Question in English" value="${esc(f.en || "")}"><input class="inp" data-k="bn" maxlength="80" placeholder="প্রশ্ন (Bangla)" aria-label="Question in Bangla" value="${esc(f.bn || "")}"></div>
    <div class="pr-xf-r2"><select class="sel" data-k="type" aria-label="Field type">${XF_TYPES.map(([v, t]) => `<option value="${v}"${(f.type || "text") === v ? " selected" : ""}>${t}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" data-k="req"${f.required ? " checked" : ""}> Required</label><button type="button" class="b b-ghost b-sm" data-xr>✕ Remove</button></div>
    <textarea class="txt" data-k="opts" rows="3" maxlength="600" placeholder="One choice per line — English | বাংলা&#10;Image | ছবি&#10;Video | ভিডিও"${(f.type || "text") === "select" ? "" : " hidden"}>${esc((f.options || []).map((o) => o.en + (o.bn && o.bn !== o.en ? " | " + o.bn : "")).join("\n"))}</textarea></div>`;
  function readXf(bg) {
    const out = [], seen = new Set();
    bg.querySelectorAll("[data-xf]").forEach((r, i) => {
      const g = (k) => r.querySelector(`[data-k="${k}"]`), en = g("en").value.trim(), bn = g("bn").value.trim(), type = g("type").value;
      if (!en && !bn && !g("opts").value.trim()) return;
      if (en.length < 2) throw new Error(`Question ${i + 1}: please write the English question.`);
      let id = r.dataset.id; if (!/^[a-z0-9_]{1,24}$/.test(id || "")) { id = "f" + Date.now().toString(36) + i; }
      while (seen.has(id)) id += "x"; seen.add(id);
      const f = { id, type, en, bn: bn || en, required: g("req").checked };
      if (type === "select") {
        f.options = g("opts").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split("|").map((x) => x.trim()); return { en: p[0], bn: p[1] || p[0] }; }).filter((o) => o.en);
        if (f.options.length < 2) throw new Error(`“${en}”: add at least two choices (one per line).`);
        if (new Set(f.options.map((o) => o.en)).size !== f.options.length) throw new Error(`“${en}”: choices must be different.`);
      }
      out.push(f);
    });
    if (out.length > 12) throw new Error("At most 12 extra questions per service.");
    return out;
  }
  function svcForm(s, groups) {
    const n = !s; s = s || { key: "", category: "content", icon: "📣", name_bn: "", name_en: "", desc_bn: "", desc_en: "", unit_bn: "প্রতি আইটেম", unit_en: "per item", price: null, min_qty: 1, max_qty: 10, active: true, popular: false, sort: 100, slot_group: "article", notice_bn: "", notice_en: "", extra_fields: [] };
    const xf = Array.isArray(s.extra_fields) ? s.extra_fields : [];
    const html = `<div class="pr-two">${fld("s-ne", "Name (English) *", inp("s-ne", s.name_en, 'maxlength="120"'))}${fld("s-nb", "Name (Bangla) *", inp("s-nb", s.name_bn, 'maxlength="120"'))}</div>
      <div class="pr-two">${fld("s-de", "Description (English)", txt("s-de", s.desc_en, 3, 600))}${fld("s-db", "Description (Bangla)", txt("s-db", s.desc_bn, 3, 600))}</div>
      <div class="pr-two">${fld("s-ue", "Unit (English)", inp("s-ue", s.unit_en, 'maxlength="40" placeholder="per article"'))}${fld("s-ub", "Unit (Bangla)", inp("s-ub", s.unit_bn, 'maxlength="40" placeholder="প্রতি আর্টিকেল"'))}</div>
      <div class="pr-three">${fld("s-pr", "Price (৳)", inp("s-pr", s.price == null ? "" : s.price, 'inputmode="decimal" placeholder="empty = quote"'), "empty = “Get a quote”")}${fld("s-mn", "Min quantity", inp("s-mn", s.min_qty, 'inputmode="numeric"'))}${fld("s-mx", "Max quantity", inp("s-mx", s.max_qty, 'inputmode="numeric"'))}</div>
      <div class="pr-three">${fld("s-cat", "Group", sel("s-cat", CATS, s.category))}${fld("s-ic", "Icon (emoji)", inp("s-ic", s.icon, 'maxlength="8"'))}${fld("s-so", "Order (small = first)", inp("s-so", s.sort, 'inputmode="numeric"'))}</div>
      ${n ? fld("s-key", "Short key *", inp("s-key", "", 'maxlength="40" placeholder="e.g. podcast_ad" autocapitalize="off"'), "letters, numbers, - and _ only; cannot be changed later") : `<p class="muted" style="margin:0 0 10px">Key: <code>${esc(s.key)}</code></p>`}
      <div class="pr-sec-a"><h3>📅 Booking calendar</h3>${fld("s-sg", "Publishing group", sel("s-sg", [["", "— No calendar (buyer just writes a preferred date) —"]].concat(groups.map((g) => [g.key, `${g.name_en} · max ${g.daily_cap} per day`])), s.slot_group || ""), "services in the same group share the daily seats, so the same date can never be double-booked — set seats per day under Schedule")}</div>
      <div class="pr-sec-a"><h3>ℹ️ Notice for buyers</h3><div class="pr-two">${fld("s-ne2", "Notice (English)", txt("s-ne2", s.notice_en || "", 2, 500), "shown on the service card and the order form")}${fld("s-nb2", "Notice (Bangla)", txt("s-nb2", s.notice_bn || "", 2, 500))}</div></div>
      <div class="pr-sec-a"><h3>📝 Extra questions for this service</h3><p class="muted" style="margin:0 0 8px">Anything else you need from the buyer — e.g. “Page link to tag”, “Preferred time”, “Choose a package”. Answers appear in the order, next to the brief.</p>
        <div id="xf-list">${xf.map(xfRow).join("")}</div><button type="button" class="b b-line b-sm" id="xf-add">➕ Add a question</button></div>
      ${chk("s-ac", "Show this service on the page", s.active)}${chk("s-po", "Mark as “Popular”", s.popular)}`;
    return dialog({ title: n ? "New service" : "Edit service", html, wide: true,
      onOpen: (bg) => {
        bg.addEventListener("click", (e) => {
          if (e.target.closest("#xf-add")) { const l = bg.querySelector("#xf-list"); if (l.children.length >= 12) return toast("At most 12 questions", "err"); l.insertAdjacentHTML("beforeend", xfRow({})); const last = l.lastElementChild.querySelector("input"); if (last) last.focus(); }
          const r = e.target.closest("[data-xr]"); if (r) r.closest("[data-xf]").remove();
        });
        bg.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.k === "type") { const row = e.target.closest("[data-xf]"), o = row.querySelector('[data-k="opts"]'); o.hidden = e.target.value !== "select"; } });
      },
      onSave: async (bg) => {
      const price = num(val(bg, "s-pr")), mn = num(val(bg, "s-mn")), mx = num(val(bg, "s-mx")), so = num(val(bg, "s-so"));
      if (val(bg, "s-ne").length < 2 || val(bg, "s-nb").length < 2) throw new Error("Please give the name in both English and Bangla.");
      if (Number.isNaN(price) || (price != null && price < 0)) throw new Error("Price must be a number (or empty for a quote).");
      if (!mn || !mx || mn < 1 || mx > 50 || mx < mn) throw new Error("Quantity must be between 1 and 50 (max not below min).");
      const row = { name_en: val(bg, "s-ne"), name_bn: val(bg, "s-nb"), desc_en: val(bg, "s-de") || null, desc_bn: val(bg, "s-db") || null, unit_en: val(bg, "s-ue") || "per item", unit_bn: val(bg, "s-ub") || "প্রতি আইটেম",
        price, min_qty: mn, max_qty: mx, category: val(bg, "s-cat"), icon: val(bg, "s-ic") || "📣", sort: so == null || Number.isNaN(so) ? 100 : so, active: val(bg, "s-ac"), popular: val(bg, "s-po"),
        slot_group: val(bg, "s-sg") || null, notice_en: val(bg, "s-ne2") || null, notice_bn: val(bg, "s-nb2") || null, extra_fields: readXf(bg), updated_at: new Date().toISOString() };
      if (n) { const key = val(bg, "s-key").toLowerCase(); if (!/^[a-z0-9_-]{2,40}$/.test(key)) throw new Error("Key: 2–40 letters, numbers, - or _."); must(await sb.from("pr_services").insert(Object.assign({ key }, row))); }
      else must(await sb.from("pr_services").update(row).eq("id", s.id));
    } });
  }

  /* ---------------- COUPONS (central: every PR service + company listing) ---------------- */
  /* “Applies to” is stored as scope + service_keys:
       Everything → scope all, no keys · Company listing only → scope listing · All PR services → scope pr, no keys · Selected → scope all + the ticked keys (“listing” = company listing fee) */
  const appMode = (c) => c.scope === "listing" ? "listing" : !(c.service_keys && c.service_keys.length) ? (c.scope === "pr" ? "pr" : "all") : "sel";
  const appliesTo = (c, name) => { const m = appMode(c); return m === "all" ? "Everything (PR + company listing)" : m === "pr" ? "All PR services" : m === "listing" ? "Company listing only" : "Only: " + c.service_keys.map((k) => k === "listing" ? "Company listing" : name[k] || k).join(", "); };
  /* The same coupon manager is used in two places: Ads & PR → Coupons (ctx "pr") and Companies → Coupons (ctx "listing").
     Both read and write the same central list; each one opens inside its own section (its own tab strip), lists the coupons that work
     there, and starts a new coupon with that section pre-selected. “All coupons” in the filter shows every code from either place. */
  const worksIn = (c, ctx) => { const m = appMode(c); return m === "all" || (ctx === "listing" ? m === "listing" || (m === "sel" && c.service_keys.includes("listing")) : m === "pr" || (m === "sel" && c.service_keys.some((k) => k !== "listing"))); };
  async function viewCoupons(view, ctx) {
    ctx = ctx === "listing" ? "listing" : "pr";
    bind(view);
    const L = ctx === "listing", hd = (extra) => head(L ? "Company coupons" : "Coupons", extra);
    const tb = async () => (L && X.coTabs ? await X.coTabs("cpn") : tabs("coupons"));
    view.innerHTML = hd() + (await tb()) + loadingCard();
    let rows, used, lused, svcs;
    try {
      [rows, used, lused, svcs] = await Promise.all([sb.from("pr_coupons").select("*").order("created_at", { ascending: false }), fetchAll(() => sb.from("pr_orders").select("coupon_code,status,discount").not("coupon_code", "is", null).order("id")), fetchAll(() => sb.from("listing_payments").select("coupon_code,status,discount").not("coupon_code", "is", null).order("id")), sb.from("pr_services").select("key,name_en").is("deleted_at", null).order("sort")]);
      rows = must(rows) || []; used = must(used) || []; lused = must(lused) || []; svcs = must(svcs) || [];
    } catch (e) { view.innerHTML = hd() + (await tb()) + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const uses = {}, given = {}, usesAll = {}; let totalUses = 0, totalDisc = 0;
    const tally = (o, here) => { const k = o.coupon_code, d = Number(o.discount || 0); usesAll[k] = (usesAll[k] || 0) + 1; if (here) { uses[k] = (uses[k] || 0) + 1; given[k] = (given[k] || 0) + d; totalUses++; totalDisc += d; } };
    used.forEach((o) => { if (!["cancelled", "rejected"].includes(o.status)) tally(o, !L); });
    lused.forEach((o) => { if (["pending", "verified"].includes(o.status)) tally(o, L); });
    const name = {}; svcs.forEach((s) => (name[s.key] = s.name_en));
    const st = { removed: false };
    const now = Date.now();
    const state = (c) => c.deleted_at ? "removed" : !c.active ? "off" : c.expires_at && new Date(c.expires_at) < now ? "expired" : c.starts_at && new Date(c.starts_at) > now ? "scheduled" : c.max_uses && (uses[c.code] || 0) >= c.max_uses ? "used up" : "live";
    const mine = (c) => st.all || worksIn(c, ctx);
    const liveN = rows.filter((c) => state(c) === "live" && worksIn(c, ctx)).length;
    view.innerHTML = hd(`<button type="button" class="b b-orange" data-a="add">➕ New coupon</button>`) + (await tb()) + `
      <div class="tiles"><div class="tile g"><small>Live coupons</small><b>${fmtN(liveN)}</b></div><div class="tile"><small>Times used ${L ? "on listing fees" : "on PR orders"}</small><b>${fmtN(totalUses)}</b></div><div class="tile k"><small>Discount given</small><b>${esc(bdt(totalDisc))}</b></div></div>
      <div class="msg info"><b>${L ? "Coupons for the company-listing fee." : "Coupons for PR services."}</b> The same coupon list is managed here and in ${L ? "Ads &amp; PR → Coupons" : "Companies → Coupons"} — a code you create in either place works wherever you let it. For each code choose <b>where it works</b>: everything, only the company-listing fee, all PR services, or just the services you tick. Buyers type the code on the order screen (PR) or on the listing payment screen and see the discount at once. A code counts as used once an order or payment with it exists; cancelled / rejected ones give the use back. A 100% coupon on the listing fee skips the payment step.</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin:0 2px 12px"><label class="chk"><input type="checkbox" id="al"> Also show coupons that only work in ${L ? "Ads &amp; PR" : "Companies"}</label><label class="chk"><input type="checkbox" id="rm"> Show removed coupons</label></div><div class="rows" id="list"></div>`;
    const paint = () => {
      const l = rows.filter((c) => (st.removed ? !!c.deleted_at : !c.deleted_at) && mine(c));
      $("#list", view).innerHTML = l.length ? l.map((c) => { const s = state(c); return `<div class="row pr-row"><div class="th co-logo">🏷️</div><div class="ti"><h3><code class="co-trx">${esc(c.code)}</code> <small>· ${c.kind === "percent" ? esc(String(Number(c.value))) + "% off" + (c.max_discount ? " (max " + esc(bdt(c.max_discount)) + ")" : "") : esc(bdt(c.value)) + " off"}</small> ${pill(s === "live" ? "verified" : s === "scheduled" ? "pending" : "none", s)}</h3>
        <div class="meta"><span class="pr-ap">🎯 ${esc(appliesTo(c, name))}</span><span>Used ${uses[c.code] || 0} here${c.max_uses ? " · " + (usesAll[c.code] || 0) + " / " + c.max_uses + " in total" : ""}</span>${given[c.code] ? `<span>saved buyers ${esc(bdt(given[c.code]))}</span>` : ""}<span>${c.per_user}× per person</span>${c.min_amount > 0 ? `<span>min order ${esc(bdt(c.min_amount))}</span>` : ""}<span>${c.starts_at ? "from " + esc(fmtDT(c.starts_at)) : ""}${c.expires_at ? " until " + esc(fmtDT(c.expires_at)) : ""}</span>${c.note ? `<span>${esc(c.note)}</span>` : ""}</div></div>
        <div class="acts">${c.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(c.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="toggle" data-id="${esc(c.id)}">${c.active ? "Turn off" : "Turn on"}</button><button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(c.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(c.id)}">Remove</button>`}</div></div>`; }).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No coupons here yet"}</b>${st.removed ? "" : "Create one with “New coupon”."}</div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    $("#al", view).addEventListener("change", (e) => { st.all = e.target.checked; paint(); });
    const reload = async () => { const y = window.scrollY; await viewCoupons(view, ctx); window.scrollTo(0, y); };
    const byId = (id) => rows.find((c) => c.id === id);
    const upd = async (id, patch) => must(await sb.from("pr_coupons").update(patch).eq("id", id));
    view._h.toggle = (b) => busy(b, async () => { const c = byId(b.dataset.id); await upd(c.id, { active: !c.active }); await reload(); });
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this coupon?", body: "It stops working. Past orders keep their discount, and you can restore it any time.", ok: "Remove", danger: true }))) return; await upd(b.dataset.id, { deleted_at: new Date().toISOString(), active: false }); await reload(); });
    view._h.restore = (b) => busy(b, async () => { await upd(b.dataset.id, { deleted_at: null }); await reload(); });
    view._h.add = () => cpnForm(null, svcs, ctx).then((ok) => ok && reload());
    view._h.edit = (b) => cpnForm(byId(b.dataset.id), svcs).then((ok) => ok && reload());
  }
  function cpnForm(c, svcs, ctx) {
    const n = !c; c = c || { code: "", kind: "percent", value: "", min_amount: 0, max_discount: null, scope: ctx === "listing" ? "listing" : "pr", service_keys: [], starts_at: null, expires_at: null, max_uses: null, per_user: 1, active: true, note: "" };
    const picked = new Set(c.service_keys || []), mode = appMode(c);
    const html = `<div class="pr-three">${fld("c-code", "Code *", inp("c-code", c.code, 'maxlength="24" autocapitalize="characters" placeholder="WELCOME10" style="text-transform:uppercase"' + (n ? "" : " disabled")), "A–Z, 0–9, - _ (3–24)")}${fld("c-kind", "Type", sel("c-kind", [["percent", "Percent (%)"], ["fixed", "Fixed amount (৳)"]], c.kind))}${fld("c-val", "Value *", inp("c-val", c.value, 'inputmode="decimal"'), "10 = 10% or ৳10")}</div>
      <div class="pr-three">${fld("c-min", "Minimum order (৳)", inp("c-min", c.min_amount || 0, 'inputmode="decimal"'))}${fld("c-max", "Max discount (৳)", inp("c-max", c.max_discount == null ? "" : c.max_discount, 'inputmode="decimal" placeholder="optional"'), "for % coupons")}${fld("c-pu", "Uses per person", inp("c-pu", c.per_user, 'inputmode="numeric"'))}</div>
      <div class="pr-three">${fld("c-mu", "Total uses", inp("c-mu", c.max_uses == null ? "" : c.max_uses, 'inputmode="numeric" placeholder="unlimited"'))}${fld("c-st", "Starts (Dhaka time)", inp("c-st", toLocal(c.starts_at), 'type="datetime-local"'))}${fld("c-ex", "Expires (Dhaka time)", inp("c-ex", toLocal(c.expires_at), 'type="datetime-local"'))}</div>
      <div class="pr-sec-a"><h3>🎯 Where does this coupon work?</h3>${fld("c-ap", "Applies to", sel("c-ap", [["all", "Everything — all PR services and the company-listing fee"], ["pr", "All PR services (not company listing)"], ["listing", "Company listing fee only"], ["sel", "Only the services I tick below…"]], mode))}
        <div class="pr-checks" id="c-selbox"${mode === "sel" ? "" : " hidden"}><label class="chk"><input type="checkbox" data-sk="listing"${picked.has("listing") ? " checked" : ""}> 🏢 Company listing fee</label>${svcs.map((s) => `<label class="chk"><input type="checkbox" data-sk="${esc(s.key)}"${picked.has(s.key) ? " checked" : ""}> ${esc(s.name_en)}</label>`).join("")}</div></div>
      ${fld("c-note", "Note (private)", inp("c-note", c.note || "", 'maxlength="200"'))}${chk("c-ac", "Coupon is active", c.active)}`;
    return dialog({ title: n ? "New coupon" : "Edit coupon", html, wide: true,
      onOpen: (bg) => bg.addEventListener("change", (e) => { if (e.target.id === "c-ap") bg.querySelector("#c-selbox").hidden = e.target.value !== "sel"; }),
      onSave: async (bg) => {
      const code = n ? val(bg, "c-code").toUpperCase() : c.code, value = num(val(bg, "c-val")), kind = val(bg, "c-kind"), mu = num(val(bg, "c-mu")), pu = num(val(bg, "c-pu")), mn = num(val(bg, "c-min")), mxd = num(val(bg, "c-max")), ap = val(bg, "c-ap");
      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error("Code must be 3–24 characters: A–Z, 0–9, - or _.");
      if (!value || Number.isNaN(value) || value <= 0) throw new Error("Enter the discount value.");
      if (kind === "percent" && value > 100) throw new Error("A percent coupon cannot be more than 100.");
      if ([mu, pu, mn, mxd].some((x) => Number.isNaN(x))) throw new Error("Please check the numbers.");
      const keys = ap === "sel" ? [...bg.querySelectorAll("[data-sk]:checked")].map((x) => x.dataset.sk) : [];
      if (ap === "sel" && !keys.length) throw new Error("Tick at least one service (or pick another option in “Applies to”).");
      const row = { kind, value, min_amount: mn || 0, max_discount: kind === "percent" ? mxd : null, scope: ap === "listing" ? "listing" : ap === "pr" ? "pr" : "all", per_user: pu || 1, max_uses: mu || null, starts_at: fromLocal(val(bg, "c-st")), expires_at: fromLocal(val(bg, "c-ex")),
        service_keys: keys.length ? keys : null, active: val(bg, "c-ac"), note: val(bg, "c-note") || null };
      if (row.starts_at && row.expires_at && row.expires_at <= row.starts_at) throw new Error("The expiry must be after the start.");
      try { if (n) must(await sb.from("pr_coupons").insert(Object.assign({ code }, row))); else must(await sb.from("pr_coupons").update(row).eq("id", c.id)); }
      catch (e) { if (/duplicate|unique/i.test(errMsg(e))) throw new Error("This code already exists."); throw e; }
    } });
  }

  /* ---------------- SCHEDULE: who is booked on which day (seats per group) ---------------- */
  async function viewSchedule(view) {
    bind(view);
    const keep = view._sch || (view._sch = { m: dhakaToday().slice(0, 7), sel: dhakaToday() });
    view.innerHTML = head("Publishing schedule") + tabs("schedule") + loadingCard();
    const today = dhakaToday();
    let groups, bks, blk;
    try {
      [groups, bks, blk] = await Promise.all([sb.from("pr_slot_groups").select("*").order("sort"), fetchAll(() => sb.from("pr_bookings").select("id,day,slot_group,order_id,pr_orders(order_no,service_name_en,status,user_email,brief,deleted_at)").gte("day", shiftDay(today, -62)).order("day").order("id")), sb.from("pr_blackouts").select("*").is("deleted_at", null).gte("day", shiftDay(today, -62)).order("day")]);
      groups = must(groups) || []; bks = (must(bks) || []).filter((b) => liveOrder(b.pr_orders)); blk = must(blk) || [];
    } catch (e) { view.innerHTML = head("Publishing schedule") + tabs("schedule") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const act = groups.filter((g) => g.active);
    const bookedOn = (iso, g) => bks.filter((b) => b.day === iso && b.slot_group === g.key);
    const blockedOn = (iso, g) => blk.filter((x) => x.day === iso && (!x.slot_group || x.slot_group === g.key));
    const heldOf = (iso, g) => !!g.hold_days && iso >= shiftDay(today, g.lead_days) && iso < shiftDay(today, g.lead_days + g.hold_days);
    const realOf = (iso, g) => bookedOn(iso, g).length + blockedOn(iso, g).reduce((n, x) => n + (x.seats == null ? g.daily_cap : x.seats), 0);
    const usedOf = (iso, g) => heldOf(iso, g) ? Math.max(g.daily_cap, realOf(iso, g)) : realOf(iso, g);
    view.innerHTML = head("Publishing schedule", `<button type="button" class="b b-orange" data-a="blk-add">🚫 Close a day / reserve seats</button>`) + tabs("schedule") + `
      <div class="msg info">Each day has a limited number of seats per group — for example <b>1 Facebook post, 1 reel and 10 paid articles</b>. Buyers can only pick days that still have a seat, so the same date can never be booked twice. Click a day to see who is booked, move a booking, or close the day (holiday, offline booking). Seats are released automatically when an order is cancelled or rejected.</div>
      <div class="card sc-groups"><div class="sc-gh"><h2>Seats per day</h2><button type="button" class="b b-line b-sm" data-a="grp-add">➕ New group</button></div>
        <div class="sc-glist">${groups.map((g) => `<div class="sc-g-row"><div><b>${esc(g.name_en)}</b> <small class="muted">· ${esc(g.name_bn)} · <code>${esc(g.key)}</code></small>${g.active ? "" : " " + pill("none", "Off")}</div><div class="muted">max <b>${g.daily_cap}</b> per day · earliest = today + ${g.lead_days} day${g.lead_days === 1 ? "" : "s"} · ${g.hold_days ? `next <b>${g.hold_days}</b> day${g.hold_days === 1 ? "" : "s"} always show as booked · ` : ""}up to ${g.horizon_days} days ahead</div><button type="button" class="b b-line b-sm" data-a="grp-edit" data-k="${esc(g.key)}">Edit</button></div>`).join("") || '<p class="muted">No groups.</p>'}</div></div>
      <div class="card sc-cal"><div class="sc-top"><button type="button" class="b b-line b-sm" data-a="nav" data-n="-1" aria-label="Previous month">‹</button><h2 id="sc-title"></h2><button type="button" class="b b-line b-sm" data-a="nav" data-n="1" aria-label="Next month">›</button><button type="button" class="b b-line b-sm" data-a="now">Today</button></div>
        <div class="sc-w" aria-hidden="true">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => `<span>${w}</span>`).join("")}</div><div class="sc-grid" id="sc-grid"></div>
        <div class="sc-leg"><span><i class="o"></i>Some seats taken</span><span><i class="r"></i>Full / closed</span></div></div>
      <div class="card" id="sc-day"></div>`;
    const paint = () => {
      const [Y, M] = keep.m.split("-").map(Number), dow = new Date(Date.UTC(Y, M - 1, 1)).getUTCDay(), dim = new Date(Date.UTC(Y, M, 0)).getUTCDate();
      $("#sc-title", view).textContent = MONTHS[M - 1] + " " + Y;
      let c = ""; for (let i = 0; i < dow; i++) c += `<span class="sc-d pad"></span>`;
      for (let d = 1; d <= dim; d++) {
        const iso = `${Y}-${String(M).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        c += `<button type="button" class="sc-d${iso === today ? " today" : ""}${iso === keep.sel ? " sel" : ""}${iso < today ? " past" : ""}" data-a="day" data-d="${iso}"><b>${d}</b>${act.map((g) => { const u = usedOf(iso, g); return `<span class="sc-c ${u >= g.daily_cap ? "full" : u ? "part" : ""}" title="${esc(g.name_en)}">${esc(g.key.slice(0, 4))} ${u}/${g.daily_cap}</span>`; }).join("")}</button>`;
      }
      $("#sc-grid", view).innerHTML = c;
      const iso = keep.sel;
      $("#sc-day", view).innerHTML = `<div class="sc-gh"><h2>${esc(fmtDay(iso))}</h2><button type="button" class="b b-line b-sm" data-a="blk-add" data-d="${iso}">🚫 Close / reserve on this day</button></div>` + groups.map((g) => {
        const bl = bookedOn(iso, g), cl = blockedOn(iso, g), u = usedOf(iso, g);
        return `<div class="sc-dg"><h3>${esc(g.name_en)} <small class="${u >= g.daily_cap ? "sc-full" : "muted"}">${u} / ${g.daily_cap} seats${u > g.daily_cap ? " (over limit)" : ""}</small>${g.active ? "" : " " + pill("none", "Off")}</h3>
          ${bl.map((b) => { const o = b.pr_orders || {}, br = o.brief || {}; return `<div class="sc-bk"><div><b>${esc(o.order_no || "")}</b> · ${esc(o.service_name_en || "")} <span class="muted">· ${esc(br.brand || "")} · ${esc(br.name || o.user_email || "")}</span> ${pill(o.status, ORD_L[o.status] || o.status)}</div><button type="button" class="b b-line b-sm" data-a="move" data-id="${esc(b.id)}">Move</button></div>`; }).join("")}
          ${cl.map((x) => `<div class="sc-bk sc-blk"><div>🚫 ${x.seats == null ? "Closed all day" : x.seats + " seat" + (x.seats > 1 ? "s" : "") + " reserved"}${x.slot_group ? "" : " <span class=\"muted\">(all groups)</span>"}${x.note ? ` <span class="muted">· ${esc(x.note)}</span>` : ""}</div><button type="button" class="b b-ghost b-sm" data-a="blk-rm" data-id="${esc(x.id)}">Reopen</button></div>`).join("")}
          ${heldOf(iso, g) ? `<div class="sc-bk sc-blk"><div>🔒 Always shown as booked <span class="muted">· buyers cannot pick this day (change “Always shown as booked” in Edit)</span></div></div>` : ""}
          ${!bl.length && !cl.length && !heldOf(iso, g) ? '<p class="muted" style="margin:2px 0 0">Nothing booked.</p>' : ""}</div>`;
      }).join("");
    };
    paint();
    const reload = async () => { const y = window.scrollY; await viewSchedule(view); window.scrollTo(0, y); };
    view._h.nav = (b) => { const [Y, M] = keep.m.split("-").map(Number), d = new Date(Date.UTC(Y, M - 1 + Number(b.dataset.n), 1)); keep.m = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); paint(); };
    view._h.now = () => { keep.m = today.slice(0, 7); keep.sel = today; paint(); };
    view._h.day = (b) => { keep.sel = b.dataset.d; paint(); const el = $("#sc-day", view); if (el && window.innerWidth < 900) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
    view._h.move = (b) => busy(b, async () => { const bk = bks.find((x) => x.id === b.dataset.id), o = bk.pr_orders || {}; const d = await moveDialog(bk, (o.order_no || "") + " · " + (o.service_name_en || "")); if (d) { toast("Moved — buyer notified", "ok"); keep.sel = d; keep.m = d.slice(0, 7); await reload(); } });
    view._h["blk-rm"] = (b) => busy(b, async () => { must(await sb.from("pr_blackouts").update({ deleted_at: new Date().toISOString() }).eq("id", b.dataset.id)); toast("Reopened", "ok"); await reload(); });
    view._h["blk-add"] = (b) => blkDialog(groups, b.dataset.d || keep.sel).then((ok) => ok && reload());
    view._h["grp-add"] = () => grpForm(null).then((ok) => ok && reload());
    view._h["grp-edit"] = (b) => grpForm(groups.find((g) => g.key === b.dataset.k)).then((ok) => ok && reload());
  }
  function blkDialog(groups, day) {
    return dialog({ title: "Close a day / reserve seats", ok: "Save", html: `<p class="muted" style="margin-top:0">Use this for public holidays, days you are away, or seats already sold offline. Buyers will not be able to book these seats. You can reopen later.</p>
      ${fld("b-g", "Group", sel("b-g", [["", "All groups"]].concat(groups.map((g) => [g.key, g.name_en])), ""))}
      <div class="pr-two">${fld("b-f", "From date", inp("b-f", day, 'type="date"'))}${fld("b-t", "To date (optional)", inp("b-t", "", 'type="date"'), "for several days in a row")}</div>
      ${fld("b-s", "Seats to reserve", inp("b-s", "", 'inputmode="numeric" placeholder="empty = close the whole day"'), "e.g. 3 = keep 3 seats for an offline client")}${fld("b-n", "Note (private)", inp("b-n", "", 'maxlength="200" placeholder="Eid holiday"'))}`,
      onSave: async (bg) => {
        const f = val(bg, "b-f"), t = val(bg, "b-t") || f, sv = num(val(bg, "b-s"));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error("Pick the date(s).");
        if (t < f) throw new Error("“To” must not be before “From”.");
        if (Number.isNaN(sv) || (sv != null && (sv < 1 || sv > 200))) throw new Error("Seats must be 1 or more (or empty for the whole day).");
        const out = []; for (let d = f, i = 0; d <= t && i < 92; d = shiftDay(d, 1), i++) out.push({ day: d, slot_group: val(bg, "b-g") || null, seats: sv, note: val(bg, "b-n") || null });
        must(await sb.from("pr_blackouts").insert(out));
      } });
  }
  function grpForm(g) {
    const n = !g; g = g || { key: "", name_en: "", name_bn: "", daily_cap: 1, lead_days: 1, hold_days: 0, horizon_days: 60, active: true, sort: 100 };
    return dialog({ title: n ? "New booking group" : "Edit seats — " + g.name_en, html: `<div class="pr-two">${fld("g-ne", "Name (English) *", inp("g-ne", g.name_en, 'maxlength="80"'))}${fld("g-nb", "Name (Bangla) *", inp("g-nb", g.name_bn, 'maxlength="80"'))}</div>
      <div class="pr-three">${fld("g-cap", "Seats per day *", inp("g-cap", g.daily_cap, 'inputmode="numeric"'), "e.g. 1 post, 10 articles")}${fld("g-lead", "Earliest: today + (days)", inp("g-lead", g.lead_days, 'inputmode="numeric"'), "1 = from tomorrow")}${fld("g-hor", "Bookable up to (days ahead)", inp("g-hor", g.horizon_days, 'inputmode="numeric"'))}</div>
      ${fld("g-hold", "Always shown as booked (days)", inp("g-hold", g.hold_days == null ? 0 : g.hold_days, 'inputmode="numeric"'), "The next N days after “earliest” always look booked to buyers, even if nothing is booked. 0 = off. Real bookings stay booked.")}
      ${n ? fld("g-key", "Short key *", inp("g-key", "", 'maxlength="30" autocapitalize="off" placeholder="e.g. newsletter"'), "letters, numbers, - and _; cannot be changed later") : `<p class="muted" style="margin:0 0 10px">Key: <code>${esc(g.key)}</code></p>`}
      ${fld("g-so", "Order (small = first)", inp("g-so", g.sort, 'inputmode="numeric"'))}${chk("g-ac", "Group is open for booking", g.active)}
      <div class="msg info" style="margin:0">Lowering the seats never removes existing bookings — it only stops new ones on days that are already over the new limit. Assign services to a group under <b>Services → Edit → Booking calendar</b>.</div>`,
      onSave: async (bg) => {
        const hold = num(val(bg, "g-hold")), cap = num(val(bg, "g-cap")), lead = num(val(bg, "g-lead")), hor = num(val(bg, "g-hor")), so = num(val(bg, "g-so"));
        if (val(bg, "g-ne").length < 2 || val(bg, "g-nb").length < 2) throw new Error("Please give the name in both English and Bangla.");
        if (!cap || cap < 1 || cap > 200) throw new Error("Seats per day must be between 1 and 200.");
        if (hold == null || Number.isNaN(hold) || hold < 0 || hold > 60) throw new Error("Always-booked days must be between 0 and 60.");
        if (lead == null || Number.isNaN(lead) || lead < 0 || lead > 60) throw new Error("Earliest day must be between 0 and 60.");
        if (!hor || Number.isNaN(hor) || hor < 7 || hor > 365 || hor <= lead) throw new Error("“Up to” must be 7–365 days and more than the earliest day.");
        const row = { name_en: val(bg, "g-ne"), name_bn: val(bg, "g-nb"), daily_cap: cap, lead_days: lead, hold_days: hold, horizon_days: hor, active: val(bg, "g-ac"), sort: so == null || Number.isNaN(so) ? 100 : so };
        if (n) { const key = val(bg, "g-key").toLowerCase(); if (!/^[a-z0-9_-]{2,30}$/.test(key)) throw new Error("Key: 2–30 letters, numbers, - or _."); must(await sb.from("pr_slot_groups").insert(Object.assign({ key }, row))); }
        else must(await sb.from("pr_slot_groups").update(row).eq("key", g.key));
      } });
  }

  /* ---------------- REVENUE & CHARGES: every source counts; ads / admin charges are subtracted to show the net ---------------- */
  const CH_KINDS = [["ads", "Ads / boost spend"], ["admin", "Admin charge"], ["other", "Other"]];
  const CH_L = Object.fromEntries(CH_KINDS);
  async function viewRevenue(view) {
    bind(view);
    view.innerHTML = head("Revenue & charges") + tabs("revenue") + loadingCard();
    let T, rows;
    try { [T, rows] = await Promise.all([sb.rpc("admin_overview_totals"), sb.from("admin_charges").select("*").order("day", { ascending: false }).order("created_at", { ascending: false })]); T = must(T); rows = must(rows) || []; } catch (e) { view.innerHTML = head("Revenue & charges") + tabs("revenue") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const r = (T && T.revenue) || {}, st = { removed: false };
    const by = Array.isArray(r.by_service) ? r.by_service : [];
    const prRev = Number(r.pr_verified || 0), pr30 = Number(r.pr_30d || 0), net = Number(r.pr_net != null ? r.pr_net : prRev - Number(r.charges_total || 0)), net30 = Number(r.pr_net_30d != null ? r.pr_net_30d : pr30 - Number(r.charges_30d || 0));
    view.innerHTML = head("Revenue & charges", `<button type="button" class="b b-orange" data-a="add">➕ Add ads / admin charge</button>`) + tabs("revenue") + `
      <div class="tiles">
        <div class="tile g"><small>PR &amp; ads revenue (verified)</small><b>${esc(bdt(prRev))}</b></div>
        <div class="tile r"><small>Ads &amp; admin charges</small><b>${esc(bdt(r.charges_total))}</b></div>
        <div class="tile ${net >= 0 ? "g" : "r"}"><small>Net after charges</small><b>${esc(bdt(net))}</b></div>
        <div class="tile"><small>Last 30 days · revenue / net</small><b>${esc(bdt(pr30))} <span class="muted" style="font-size:.7em">/ ${esc(bdt(net30))}</span></b></div>
      </div>
      <div class="msg info">This page is about <b>PR &amp; ads only</b>: revenue is counted automatically from every verified PR payment, <b>including services you add later</b>. Free-campaign and fully-discounted orders add ৳0. Record what you pay for ads or admin work below and the <b>net</b> is worked out for you. Company listing fees are counted separately — see the Dashboard (Overall) and Companies → Payments.</div>
      <div class="card"><h2>PR &amp; ads revenue by service</h2><div class="rv-tab">
        ${by.map((x) => `<div class="rv-r"><span>📣 ${esc(x.name)}</span><span class="muted">${fmtN(x.n)} order${x.n > 1 ? "s" : ""}</span><b>${esc(bdt(x.amount))}</b></div>`).join("")}
        ${by.length ? "" : `<div class="rv-r"><span class="muted">No paid PR orders yet</span><span></span><b>${esc(bdt(0))}</b></div>`}
        <div class="rv-r rv-sum"><span>PR &amp; ads revenue</span><span></span><b>${esc(bdt(prRev))}</b></div>
        <div class="rv-r"><span class="muted">Waiting to be verified (not counted yet)</span><span></span><span class="muted">${esc(bdt(r.pr_pending))}</span></div></div></div>
      <div class="card" style="margin-top:16px"><div class="sc-gh"><h2>Ads &amp; admin charges</h2><label class="chk" style="margin:0"><input type="checkbox" id="rm"> Show removed</label></div>
        <p class="muted" style="margin:0 0 6px">Ads / boost spend: ${esc(bdt(r.charges_ads))} · Admin charges: ${esc(bdt(r.charges_admin))} · Last 30 days: ${esc(bdt(r.charges_30d))}</p><div class="rows" id="list"></div></div>`;
    const paint = () => {
      const l = rows.filter((c) => (st.removed ? !!c.deleted_at : !c.deleted_at));
      $("#list", view).innerHTML = l.length ? l.map((c) => `<div class="row pr-row"><div class="th co-logo">${c.kind === "ads" ? "📢" : c.kind === "admin" ? "🧾" : "➖"}</div><div class="ti"><h3>${esc(bdt(c.amount))} <small>· ${esc(CH_L[c.kind] || c.kind)}</small></h3><div class="meta"><span>${esc(fmtDayS(c.day))} ${esc(String(c.day).slice(0, 4))}</span>${c.note ? `<span>${esc(c.note)}</span>` : ""}</div></div>
        <div class="acts">${c.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(c.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(c.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(c.id)}">Remove</button>`}</div></div>`).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No charges recorded"}</b>${st.removed ? "" : "Use “Add ads / admin charge” to record what you spend."}</div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    const reload = async () => { const y = window.scrollY; await viewRevenue(view); window.scrollTo(0, y); };
    const byId = (id) => rows.find((c) => c.id === id);
    view._h.add = () => chargeForm(null).then((ok) => ok && reload());
    view._h.edit = (b) => chargeForm(byId(b.dataset.id)).then((ok) => ok && reload());
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this charge?", body: "It stops counting in the net. You can restore it any time.", ok: "Remove", danger: true }))) return; must(await sb.from("admin_charges").update({ deleted_at: new Date().toISOString() }).eq("id", b.dataset.id)); await reload(); });
    view._h.restore = (b) => busy(b, async () => { must(await sb.from("admin_charges").update({ deleted_at: null }).eq("id", b.dataset.id)); await reload(); });
  }
  function chargeForm(c) {
    const n = !c; c = c || { kind: "ads", amount: "", day: dhakaToday(), note: "" };
    return dialog({ title: n ? "Add ads / admin charge" : "Edit charge", html: `<div class="pr-two">${fld("h-k", "Type", sel("h-k", CH_KINDS, c.kind))}${fld("h-a", "Amount (৳) *", inp("h-a", c.amount, 'inputmode="decimal"'))}</div>
      ${fld("h-d", "Date", inp("h-d", c.day, 'type="date"'))}${fld("h-n", "Note", inp("h-n", c.note || "", 'maxlength="300" placeholder="e.g. Facebook boost for the Eid campaign"'))}`,
      onSave: async (bg) => {
        const a = num(val(bg, "h-a")), d = val(bg, "h-d");
        if (a == null || Number.isNaN(a) || a <= 0 || a >= 1e9) throw new Error("Enter the amount (more than 0).");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Pick the date.");
        const row = { kind: val(bg, "h-k"), amount: a, day: d, note: val(bg, "h-n") || null };
        if (n) must(await sb.from("admin_charges").insert(row)); else must(await sb.from("admin_charges").update(row).eq("id", c.id));
      } });
  }

  /* ---------------- FREE CAMPAIGNS ---------------- */
  async function viewCampaigns(view) {
    bind(view);
    view.innerHTML = head("Free campaigns") + tabs("campaigns") + loadingCard();
    let rows, used, svcs;
    try {
      [rows, used, svcs] = await Promise.all([sb.from("pr_campaigns").select("*").order("created_at", { ascending: false }), fetchAll(() => sb.from("pr_orders").select("campaign_id,status").not("campaign_id", "is", null).order("id")), sb.from("pr_services").select("key,name_en").is("deleted_at", null).order("sort")]);
      rows = must(rows) || []; used = must(used) || []; svcs = must(svcs) || [];
    } catch (e) { view.innerHTML = head("Free campaigns") + tabs("campaigns") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const taken = {}; used.forEach((o) => { if (!["cancelled", "rejected"].includes(o.status)) taken[o.campaign_id] = (taken[o.campaign_id] || 0) + 1; });
    const name = {}; svcs.forEach((s) => (name[s.key] = s.name_en));
    const st = { removed: false };
    view.innerHTML = head("Free campaigns", `<button type="button" class="b b-orange" data-a="add">➕ New campaign</button>`) + tabs("campaigns") + `
      <div class="msg info">Sometimes you run a free article or post campaign. While a campaign is <b>on</b>, inside its dates and with slots left, the banner shows on the page and each person can claim one free slot for the chosen services. Free orders arrive here as “Free campaign” and appear in PR orders.</div>
      <label class="chk" style="margin:0 2px 12px"><input type="checkbox" id="rm"> Show removed campaigns</label><div class="rows" id="list"></div>`;
    const now = Date.now();
    const state = (c) => c.deleted_at ? "removed" : !c.active ? "off" : c.ends_at && new Date(c.ends_at) < now ? "ended" : c.starts_at && new Date(c.starts_at) > now ? "scheduled" : c.max_slots && (taken[c.id] || 0) >= c.max_slots ? "full" : "live";
    const paint = () => {
      const l = rows.filter((c) => (st.removed ? !!c.deleted_at : !c.deleted_at));
      $("#list", view).innerHTML = l.length ? l.map((c) => { const s = state(c); return `<div class="row pr-row"><div class="th co-logo">🎁</div><div class="ti"><h3>${esc(c.title_en)} ${pill(s === "live" ? "verified" : s === "scheduled" ? "pending" : "none", s)}</h3>
        <div class="meta"><span>${esc(c.title_bn)}</span><span>Claimed ${taken[c.id] || 0}${c.max_slots ? " / " + c.max_slots : ""}</span><span>${(c.service_keys || []).map((k) => esc(name[k] || k)).join(", ") || "no services"}</span><span>${c.starts_at ? "from " + esc(fmtDT(c.starts_at)) : ""}${c.ends_at ? " until " + esc(fmtDT(c.ends_at)) : ""}</span></div></div>
        <div class="acts">${c.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(c.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="toggle" data-id="${esc(c.id)}">${c.active ? "Turn off" : "Turn on"}</button><button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(c.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(c.id)}">Remove</button>`}</div></div>`; }).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No campaigns yet"}</b>${st.removed ? "" : "Create one with “New campaign”."}</div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    const reload = async () => { const y = window.scrollY; await viewCampaigns(view); window.scrollTo(0, y); };
    const byId = (id) => rows.find((c) => c.id === id);
    const upd = async (id, patch) => must(await sb.from("pr_campaigns").update(patch).eq("id", id));
    view._h.toggle = (b) => busy(b, async () => { const c = byId(b.dataset.id); await upd(c.id, { active: !c.active }); await reload(); });
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this campaign?", body: "The banner disappears. Orders already placed keep their details; you can restore it later.", ok: "Remove", danger: true }))) return; await upd(b.dataset.id, { deleted_at: new Date().toISOString(), active: false }); await reload(); });
    view._h.restore = (b) => busy(b, async () => { await upd(b.dataset.id, { deleted_at: null }); await reload(); });
    view._h.add = () => campForm(null, svcs).then((ok) => ok && reload());
    view._h.edit = (b) => campForm(byId(b.dataset.id), svcs).then((ok) => ok && reload());
  }
  function campForm(c, svcs) {
    const n = !c; c = c || { title_bn: "", title_en: "", text_bn: "", text_en: "", service_keys: ["article"], starts_at: null, ends_at: null, max_slots: null, active: true };
    const picked = new Set(c.service_keys || []);
    const html = `<div class="pr-two">${fld("g-te", "Title (English) *", inp("g-te", c.title_en, 'maxlength="140" placeholder="Free article campaign"'))}${fld("g-tb", "Title (Bangla) *", inp("g-tb", c.title_bn, 'maxlength="140"'))}</div>
      <div class="pr-two">${fld("g-xe", "Text (English)", txt("g-xe", c.text_en, 3, 800))}${fld("g-xb", "Text (Bangla)", txt("g-xb", c.text_bn, 3, 800))}</div>
      <div class="fld"><label>Free for these services *</label><div class="pr-checks">${svcs.map((s) => `<label class="chk"><input type="checkbox" data-sk="${esc(s.key)}"${picked.has(s.key) ? " checked" : ""}> ${esc(s.name_en)}</label>`).join("")}</div></div>
      <div class="pr-three">${fld("g-sl", "Free slots", inp("g-sl", c.max_slots == null ? "" : c.max_slots, 'inputmode="numeric" placeholder="unlimited"'), "total across everyone")}${fld("g-st", "Starts (Dhaka time)", inp("g-st", toLocal(c.starts_at), 'type="datetime-local"'))}${fld("g-en", "Ends (Dhaka time)", inp("g-en", toLocal(c.ends_at), 'type="datetime-local"'))}</div>
      ${chk("g-ac", "Campaign is on", c.active)}`;
    return dialog({ title: n ? "New free campaign" : "Edit campaign", html, wide: true, onSave: async (bg) => {
      const keys = [...bg.querySelectorAll("[data-sk]:checked")].map((x) => x.dataset.sk), sl = num(val(bg, "g-sl"));
      if (val(bg, "g-te").length < 2 || val(bg, "g-tb").length < 2) throw new Error("Please give the title in both English and Bangla.");
      if (!keys.length) throw new Error("Pick at least one service.");
      if (Number.isNaN(sl) || (sl != null && sl < 1)) throw new Error("Free slots must be 1 or more (or empty for unlimited).");
      const row = { title_en: val(bg, "g-te"), title_bn: val(bg, "g-tb"), text_en: val(bg, "g-xe") || null, text_bn: val(bg, "g-xb") || null, service_keys: keys, max_slots: sl || null, starts_at: fromLocal(val(bg, "g-st")), ends_at: fromLocal(val(bg, "g-en")), active: val(bg, "g-ac") };
      if (row.starts_at && row.ends_at && row.ends_at <= row.starts_at) throw new Error("The end must be after the start.");
      if (n) must(await sb.from("pr_campaigns").insert(row)); else must(await sb.from("pr_campaigns").update(row).eq("id", c.id));
    } });
  }

  /* ---------------- PAGE & STATS ---------------- */
  async function viewSettings(view) {
    bind(view);
    view.innerHTML = head("Page & stats") + tabs("settings") + loadingCard();
    let cur = {};
    try { const r = must(await sb.from("site_settings").select("value").eq("key", "pr_page").maybeSingle()); cur = (r && r.value) || {}; } catch (e) { view.innerHTML = head("Page & stats") + tabs("settings") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const s = cur.stats || {};
    view.innerHTML = head("Page & stats") + tabs("settings") + `<form class="card" id="f" novalidate>
      <h2>Reach numbers shown on /pr</h2>
      <p class="muted" style="margin-top:-6px">Keep these honest — they are shown to advertisers. Update them whenever your page grows.</p>
      <div class="pr-three">${fld("p-av", "Average views per post", inp("p-av", s.avg_views == null ? "" : s.avg_views, 'inputmode="numeric"'))}${fld("p-mn", "Top posts: from (views)", inp("p-mn", s.peak_min == null ? "" : s.peak_min, 'inputmode="numeric"'))}${fld("p-mx", "Top posts: up to (views)", inp("p-mx", s.peak_max == null ? "" : s.peak_max, 'inputmode="numeric"'))}</div>
      <div class="pr-three">${fld("p-vi", "Website visitors / month", inp("p-vi", s.monthly_visitors == null ? "" : s.monthly_visitors, 'inputmode="numeric"'))}${fld("p-em", "Contact e-mail", inp("p-em", cur.contact_email || "", 'type="email" placeholder="partnerships@voiceofstartup.bd"'))}${fld("p-wa", "WhatsApp number (optional)", inp("p-wa", cur.whatsapp || "", 'inputmode="tel" placeholder="8801XXXXXXXXX"'), "with country code; empty = hidden")}</div>
      <div class="pr-two">${fld("p-ib", "Intro line (Bangla, optional)", txt("p-ib", cur.intro_bn || "", 3, 400), "shown above the numbers")}${fld("p-ie", "Intro line (English, optional)", txt("p-ie", cur.intro_en || "", 3, 400))}</div>
      ${chk("p-on", "PR page is open for orders", cur.enabled !== false)}
      <div class="msg err" hidden id="pm"></div>
      <div class="acts"><button type="submit" class="b b-orange">Save</button><a class="b b-line" href="/pr" target="_blank" rel="noopener">Open /pr ↗</a></div></form>
      <div class="msg info">Payment numbers and on/off for bKash, Nagad and others are shared with the company listing fee — change them in <a href="#/company-settings">Companies → Settings</a>. Orders always show the TrxID so you can match it in your bKash account.</div>`;
    $("#f", view).addEventListener("submit", (e) => {
      e.preventDefault();
      const b = e.submitter || $("button[type=submit]", view), pm = $("#pm", view); pm.hidden = true;
      busy(b, async () => {
        const g = (id) => { const el = $("#" + id, view); return el.type === "checkbox" ? el.checked : el.value.trim(); };
        const n = (id) => { const v = num(g(id)); if (Number.isNaN(v) || (v != null && (v < 0 || v > 1e10))) throw new Error("Please check the numbers."); return v; };
        try {
          const mn = n("p-mn"), mx = n("p-mx"); if (mn != null && mx != null && mx < mn) throw new Error("“Up to” views must not be less than “from”.");
          const em = g("p-em"); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error("Enter a valid contact e-mail.");
          const wa = g("p-wa").replace(/[^\d]/g, "");
          const value = { enabled: g("p-on"), stats: { avg_views: n("p-av"), peak_min: mn, peak_max: mx, monthly_visitors: n("p-vi") }, contact_email: em, whatsapp: wa, intro_bn: g("p-ib"), intro_en: g("p-ie") };
          must(await sb.from("site_settings").upsert({ key: "pr_page", value, updated_at: new Date().toISOString() }, { onConflict: "key" }));
          toast("Saved — the /pr page is updated", "ok");
        } catch (er) { pm.hidden = false; pm.textContent = errMsg(er); }
      });
    });
  }

  return { handles, render, refreshBadges, tabs, attention };
};
