/* Voice of Startup Bangladesh — admin: Paid promotion (PR) control centre.
   Loaded before admin.js. admin.js calls window.VOSB_ADMIN_PR(context) once and delegates these routes:
     pr (orders) · pr/services · pr/coupons · pr/campaigns · pr/settings
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
  function dialog({ title, html, ok = "Save", wide = false, onSave }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.innerHTML = `<form class="modal pr-modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate><h2>${esc(title)}</h2><div class="pr-mbody">${html}</div>
        <div class="msg err" hidden style="margin:10px 0 0"></div>
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
      const first = bg.querySelector("input:not([type=hidden]):not([disabled]),select,textarea"); if (first) first.focus();
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
  const TABS = [["ads", "Ads", "#/ads"], ["orders", "PR orders", "#/pr"], ["services", "Services", "#/pr/services"], ["coupons", "Coupons", "#/pr/coupons"], ["campaigns", "Free campaigns", "#/pr/campaigns"], ["settings", "Page & stats", "#/pr/settings"]];
  const tabs = (active) => `<div class="co-tabs" role="tablist" aria-label="Ads and PR">${TABS.map(([k, t, h]) => `<a href="${h}" role="tab" class="${k === active ? "on" : ""}" ${k === active ? 'aria-selected="true"' : ""}>${esc(t)}${k === "orders" && attn && attn.total ? `<i>${attn.total > 99 ? "99+" : attn.total}</i>` : ""}</a>`).join("")}</div>`;

  const handles = (h) => h === "pr" || h.indexOf("pr/") === 0;
  function render(h, view) {
    if (h === "pr") return viewOrders(view);
    if (h === "pr/services") return viewServices(view);
    if (h === "pr/coupons") return viewCoupons(view);
    if (h === "pr/campaigns") return viewCampaigns(view);
    if (h === "pr/settings") return viewSettings(view);
    location.hash = "#/pr";
  }
  const head = (title, extra) => `<div class="page-h"><h1>${esc(title)}</h1>${extra || ""}</div>`;

  /* ---------------- ORDERS ---------------- */
  async function viewOrders(view) {
    bind(view);
    view.innerHTML = head("PR orders") + tabs("orders") + loadingCard();
    let rows, svcs;
    try {
      [rows, svcs] = await Promise.all([fetchAll(() => sb.from("pr_orders").select("*").is("deleted_at", null).order("created_at", { ascending: false }).order("id")), sb.from("pr_services").select("id,icon,key")]);
      rows = must(rows) || []; svcs = must(svcs) || [];
    } catch (e) { view.innerHTML = head("PR orders") + tabs("orders") + errorCard(e); return; }
    if (!view.isConnected) return;
    await attention(true); refreshBadges();
    const ico = {}; svcs.forEach((s) => (ico[s.id] = s.icon));
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
    view._h.manage = (b) => busy(b, async () => { const o = byId(b.dataset.id); if (o && (await manage(o))) { toast("Order saved", "ok"); await reload(); } });
  }

  async function manage(o) {
    let priv = ""; try { const r = must(await sb.from("pr_order_private").select("internal_note").eq("order_id", o.id).maybeSingle()); priv = (r && r.internal_note) || ""; } catch (e) { /* none yet */ }
    const br = o.brief || {}, setKey = F.SET_OF[o.service_key] || "other", order = F.CORE.concat(["what"], F.SETS[setKey] || [], ["notes"]);
    const lab = (k) => { const ov = (F.OVR[o.service_key] || {})[k], d = F.F[k]; return ov ? ov[1] : d ? d[1] : k; };
    const shown = order.filter((k) => br[k]).concat(Object.keys(br).filter((k) => !order.includes(k)));
    const opt = (k, v) => { const d = F.F[k]; const m = d && d[5] ? d[5].find((x) => x[0] === v) : null; return m ? m[2] : v; };
    const rowsHtml = shown.map((k) => { const v = String(br[k]); const link = /^https?:\/\//i.test(v) ? `<a href="${esc(safeHref(v))}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>` : esc(opt(k, v)); return `<div class="pr-kv"><span>${esc(lab(k))}</span><div>${link}</div></div>`; }).join("");
    const verified = o.pay_status === "verified";
    const html = `<div class="pr-sumline"><b>${esc(o.order_no)}</b> · ${esc(o.service_name_en)} × ${o.qty} · ${o.kind === "quote" && o.amount == null ? "quote not given yet" : esc(bdt(o.amount))}${o.coupon_code ? ` · coupon ${esc(o.coupon_code)} (−${esc(bdt(o.discount))})` : ""}<br><small class="muted">${esc(o.user_email || "")} · ${esc(fmtDT(o.created_at))}${o.trx_id ? ` · TrxID <span class="co-trx">${esc(o.trx_id)}</span> <button type="button" class="b b-ghost b-sm" data-copyv="${esc(o.trx_id)}">⧉</button> from ${esc(o.sender_msisdn || "")}` : ""}</small></div>
      <details class="pr-brief" open><summary>Client brief</summary>${rowsHtml || '<p class="muted">No details.</p>'}</details>
      <div class="pr-two">${fld("m-amt", o.kind === "quote" ? "Price (৳) — set the quote" : "Amount (৳)", inp("m-amt", o.amount == null ? "" : o.amount, `inputmode="decimal" ${verified ? "disabled" : ""}`), verified ? "locked: payment verified" : "")}
        ${fld("m-st", "Order status", sel("m-st", ORD_ST.map((s) => [s, ORD_L[s]]), o.status))}</div>
      ${fld("m-pay", "Payment status", sel("m-pay", PAY_ST.map((s) => [s, PAY_L[s]]), o.pay_status), "changing it notifies the buyer")}
      ${fld("m-note", "Message to the buyer", txt("m-note", o.admin_note || "", 3, 600), "shown on their “My orders” page")}
      ${fld("m-url", "Published link", inp("m-url", o.delivered_url || "", 'placeholder="https://…" inputmode="url"'), "shown to the buyer when the work is delivered")}
      ${fld("m-int", "Internal note", txt("m-int", priv, 3, 1000), "only admins see this")}`;
    return dialog({ title: "Manage order", html, wide: true, onSave: async (bg) => {
      const p = {}, st = val(bg, "m-st"), ps = val(bg, "m-pay"), amtRaw = val(bg, "m-amt");
      if (st !== o.status) p.status = st;
      if (ps !== o.pay_status) p.pay_status = ps;
      if (!verified) { const a = num(amtRaw); if (Number.isNaN(a)) throw new Error("Amount must be a number."); if ((a == null ? null : a) !== (o.amount == null ? null : Number(o.amount))) p.amount = a == null ? "" : String(a); }
      p.admin_note = val(bg, "m-note"); p.delivered_url = val(bg, "m-url"); p.internal_note = val(bg, "m-int");
      must(await sb.rpc("admin_pr_set_order", { p_id: o.id, p }));
    } });
  }

  /* ---------------- SERVICES ---------------- */
  async function viewServices(view) {
    bind(view);
    view.innerHTML = head("Services & prices") + tabs("services") + loadingCard();
    let rows;
    try { rows = must(await sb.from("pr_services").select("*").order("sort").order("name_en")) || []; } catch (e) { view.innerHTML = head("Services & prices") + tabs("services") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const st = { removed: false };
    view.innerHTML = head("Services & prices", `<button type="button" class="b b-orange" data-a="add">➕ New service</button>`) + tabs("services") + `
      <div class="msg info">Leave the price empty to show “Get a quote” — the buyer then waits for your price. Services that are switched off are hidden from the page. Prices are in Bangladeshi Taka (৳).</div>
      <label class="chk" style="margin:0 2px 12px"><input type="checkbox" id="rm"> Show removed services</label><div class="rows" id="list"></div>`;
    const paint = () => {
      const l = rows.filter((s) => (st.removed ? !!s.deleted_at : !s.deleted_at));
      $("#list", view).innerHTML = l.length ? l.map((s) => `<div class="row pr-row"><div class="th co-logo">${esc(s.icon)}</div><div class="ti"><h3>${esc(s.name_en)} <small>· ${s.price == null ? "Quote" : esc(bdt(s.price)) + " " + esc(s.unit_en)}</small> ${s.active ? pill("verified", "On") : pill("none", "Off")}${s.popular ? " " + pill("new", "Popular") : ""}</h3>
        <div class="meta"><span>${esc(s.name_bn)}</span><span>key: <code>${esc(s.key)}</code></span><span>${esc((CATS.find((c) => c[0] === s.category) || [0, s.category])[1])}</span><span>qty ${s.min_qty}–${s.max_qty}</span><span>order ${s.sort}</span></div></div>
        <div class="acts">${s.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(s.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="toggle" data-id="${esc(s.id)}">${s.active ? "Turn off" : "Turn on"}</button><button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(s.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(s.id)}">Remove</button>`}</div></div>`).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No services yet"}</b></div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    const reload = async () => { const y = window.scrollY; await viewServices(view); window.scrollTo(0, y); };
    const byId = (id) => rows.find((s) => s.id === id);
    const upd = async (id, patch) => { must(await sb.from("pr_services").update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq("id", id)); };
    view._h.toggle = (b) => busy(b, async () => { const s = byId(b.dataset.id); await upd(s.id, { active: !s.active }); await reload(); });
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this service?", body: "It disappears from the page. Old orders keep their details and you can restore it any time.", ok: "Remove", danger: true }))) return; await upd(b.dataset.id, { deleted_at: new Date().toISOString(), active: false }); await reload(); });
    view._h.restore = (b) => busy(b, async () => { await upd(b.dataset.id, { deleted_at: null }); await reload(); });
    view._h.add = () => svcForm(null).then((ok) => ok && reload());
    view._h.edit = (b) => svcForm(byId(b.dataset.id)).then((ok) => ok && reload());
  }
  function svcForm(s) {
    const n = !s; s = s || { key: "", category: "content", icon: "📣", name_bn: "", name_en: "", desc_bn: "", desc_en: "", unit_bn: "প্রতি আইটেম", unit_en: "per item", price: null, min_qty: 1, max_qty: 10, active: true, popular: false, sort: 100 };
    const html = `<div class="pr-two">${fld("s-ne", "Name (English) *", inp("s-ne", s.name_en, 'maxlength="120"'))}${fld("s-nb", "Name (Bangla) *", inp("s-nb", s.name_bn, 'maxlength="120"'))}</div>
      <div class="pr-two">${fld("s-de", "Description (English)", txt("s-de", s.desc_en, 3, 600))}${fld("s-db", "Description (Bangla)", txt("s-db", s.desc_bn, 3, 600))}</div>
      <div class="pr-two">${fld("s-ue", "Unit (English)", inp("s-ue", s.unit_en, 'maxlength="40" placeholder="per article"'))}${fld("s-ub", "Unit (Bangla)", inp("s-ub", s.unit_bn, 'maxlength="40" placeholder="প্রতি আর্টিকেল"'))}</div>
      <div class="pr-three">${fld("s-pr", "Price (৳)", inp("s-pr", s.price == null ? "" : s.price, 'inputmode="decimal" placeholder="empty = quote"'), "empty = “Get a quote”")}${fld("s-mn", "Min quantity", inp("s-mn", s.min_qty, 'inputmode="numeric"'))}${fld("s-mx", "Max quantity", inp("s-mx", s.max_qty, 'inputmode="numeric"'))}</div>
      <div class="pr-three">${fld("s-cat", "Group", sel("s-cat", CATS, s.category))}${fld("s-ic", "Icon (emoji)", inp("s-ic", s.icon, 'maxlength="8"'))}${fld("s-so", "Order (small = first)", inp("s-so", s.sort, 'inputmode="numeric"'))}</div>
      ${n ? fld("s-key", "Short key *", inp("s-key", "", 'maxlength="40" placeholder="e.g. podcast_ad" autocapitalize="off"'), "letters, numbers, - and _ only; cannot be changed later") : `<p class="muted" style="margin:0 0 10px">Key: <code>${esc(s.key)}</code></p>`}
      ${chk("s-ac", "Show this service on the page", s.active)}${chk("s-po", "Mark as “Popular”", s.popular)}`;
    return dialog({ title: n ? "New service" : "Edit service", html, wide: true, onSave: async (bg) => {
      const price = num(val(bg, "s-pr")), mn = num(val(bg, "s-mn")), mx = num(val(bg, "s-mx")), so = num(val(bg, "s-so"));
      if (val(bg, "s-ne").length < 2 || val(bg, "s-nb").length < 2) throw new Error("Please give the name in both English and Bangla.");
      if (Number.isNaN(price) || (price != null && price < 0)) throw new Error("Price must be a number (or empty for a quote).");
      if (!mn || !mx || mn < 1 || mx > 50 || mx < mn) throw new Error("Quantity must be between 1 and 50 (max not below min).");
      const row = { name_en: val(bg, "s-ne"), name_bn: val(bg, "s-nb"), desc_en: val(bg, "s-de") || null, desc_bn: val(bg, "s-db") || null, unit_en: val(bg, "s-ue") || "per item", unit_bn: val(bg, "s-ub") || "প্রতি আইটেম",
        price, min_qty: mn, max_qty: mx, category: val(bg, "s-cat"), icon: val(bg, "s-ic") || "📣", sort: so == null || Number.isNaN(so) ? 100 : so, active: val(bg, "s-ac"), popular: val(bg, "s-po"), updated_at: new Date().toISOString() };
      if (n) { const key = val(bg, "s-key").toLowerCase(); if (!/^[a-z0-9_-]{2,40}$/.test(key)) throw new Error("Key: 2–40 letters, numbers, - or _."); must(await sb.from("pr_services").insert(Object.assign({ key }, row))); }
      else must(await sb.from("pr_services").update(row).eq("id", s.id));
    } });
  }

  /* ---------------- COUPONS ---------------- */
  async function viewCoupons(view) {
    bind(view);
    view.innerHTML = head("Coupons") + tabs("coupons") + loadingCard();
    let rows, used, svcs;
    try {
      [rows, used, svcs] = await Promise.all([sb.from("pr_coupons").select("*").order("created_at", { ascending: false }), fetchAll(() => sb.from("pr_orders").select("coupon_code,status").not("coupon_code", "is", null).order("id")), sb.from("pr_services").select("key,name_en").is("deleted_at", null).order("sort")]);
      rows = must(rows) || []; used = must(used) || []; svcs = must(svcs) || [];
    } catch (e) { view.innerHTML = head("Coupons") + tabs("coupons") + errorCard(e); return; }
    if (!view.isConnected) return;
    attention(); refreshBadges();
    const uses = {}; used.forEach((o) => { if (!["cancelled", "rejected"].includes(o.status)) uses[o.coupon_code] = (uses[o.coupon_code] || 0) + 1; });
    const st = { removed: false };
    view.innerHTML = head("Coupons", `<button type="button" class="b b-orange" data-a="add">➕ New coupon</button>`) + tabs("coupons") + `
      <div class="msg info">Buyers type the code in the order summary and see the discount at once. A coupon works on priced services (not on “Get a quote” until you set the price). A code counts as used once an order with it is placed; cancelled or rejected orders give the use back.</div>
      <label class="chk" style="margin:0 2px 12px"><input type="checkbox" id="rm"> Show removed coupons</label><div class="rows" id="list"></div>`;
    const now = Date.now();
    const state = (c) => c.deleted_at ? "removed" : !c.active ? "off" : c.expires_at && new Date(c.expires_at) < now ? "expired" : c.starts_at && new Date(c.starts_at) > now ? "scheduled" : c.max_uses && (uses[c.code] || 0) >= c.max_uses ? "used up" : "live";
    const paint = () => {
      const l = rows.filter((c) => (st.removed ? !!c.deleted_at : !c.deleted_at));
      $("#list", view).innerHTML = l.length ? l.map((c) => { const s = state(c); return `<div class="row pr-row"><div class="th co-logo">🏷️</div><div class="ti"><h3><code class="co-trx">${esc(c.code)}</code> <small>· ${c.kind === "percent" ? esc(String(Number(c.value))) + "% off" + (c.max_discount ? " (max " + esc(bdt(c.max_discount)) + ")" : "") : esc(bdt(c.value)) + " off"}</small> ${pill(s === "live" ? "verified" : s === "scheduled" ? "pending" : "none", s)}</h3>
        <div class="meta"><span>Used ${uses[c.code] || 0}${c.max_uses ? " / " + c.max_uses : ""}</span><span>${c.per_user}× per person</span>${c.min_amount > 0 ? `<span>min order ${esc(bdt(c.min_amount))}</span>` : ""}<span>${c.service_keys && c.service_keys.length ? "only: " + esc(c.service_keys.join(", ")) : "all services"}</span><span>${c.starts_at ? "from " + esc(fmtDT(c.starts_at)) : ""}${c.expires_at ? " until " + esc(fmtDT(c.expires_at)) : ""}</span>${c.note ? `<span>${esc(c.note)}</span>` : ""}</div></div>
        <div class="acts">${c.deleted_at ? `<button type="button" class="b b-green b-sm" data-a="restore" data-id="${esc(c.id)}">Restore</button>` : `<button type="button" class="b b-line b-sm" data-a="toggle" data-id="${esc(c.id)}">${c.active ? "Turn off" : "Turn on"}</button><button type="button" class="b b-line b-sm" data-a="edit" data-id="${esc(c.id)}">Edit</button><button type="button" class="b b-ghost b-sm" data-a="remove" data-id="${esc(c.id)}">Remove</button>`}</div></div>`; }).join("")
        : `<div class="empty"><b>${st.removed ? "Nothing removed" : "No coupons yet"}</b>${st.removed ? "" : "Create one with “New coupon”."}</div>`;
    };
    paint();
    $("#rm", view).addEventListener("change", (e) => { st.removed = e.target.checked; paint(); });
    const reload = async () => { const y = window.scrollY; await viewCoupons(view); window.scrollTo(0, y); };
    const byId = (id) => rows.find((c) => c.id === id);
    const upd = async (id, patch) => must(await sb.from("pr_coupons").update(patch).eq("id", id));
    view._h.toggle = (b) => busy(b, async () => { const c = byId(b.dataset.id); await upd(c.id, { active: !c.active }); await reload(); });
    view._h.remove = (b) => busy(b, async () => { if (!(await modal({ title: "Remove this coupon?", body: "It stops working. Past orders keep their discount, and you can restore it any time.", ok: "Remove", danger: true }))) return; await upd(b.dataset.id, { deleted_at: new Date().toISOString(), active: false }); await reload(); });
    view._h.restore = (b) => busy(b, async () => { await upd(b.dataset.id, { deleted_at: null }); await reload(); });
    view._h.add = () => cpnForm(null, svcs).then((ok) => ok && reload());
    view._h.edit = (b) => cpnForm(byId(b.dataset.id), svcs).then((ok) => ok && reload());
  }
  function cpnForm(c, svcs) {
    const n = !c; c = c || { code: "", kind: "percent", value: "", min_amount: 0, max_discount: null, scope: "pr", service_keys: [], starts_at: null, expires_at: null, max_uses: null, per_user: 1, active: true, note: "" };
    const picked = new Set(c.service_keys || []);
    const html = `<div class="pr-three">${fld("c-code", "Code *", inp("c-code", c.code, 'maxlength="24" autocapitalize="characters" placeholder="WELCOME10" style="text-transform:uppercase"' + (n ? "" : " disabled")), "A–Z, 0–9, - _ (3–24)")}${fld("c-kind", "Type", sel("c-kind", [["percent", "Percent (%)"], ["fixed", "Fixed amount (৳)"]], c.kind))}${fld("c-val", "Value *", inp("c-val", c.value, 'inputmode="decimal"'), "10 = 10% or ৳10")}</div>
      <div class="pr-three">${fld("c-min", "Minimum order (৳)", inp("c-min", c.min_amount || 0, 'inputmode="decimal"'))}${fld("c-max", "Max discount (৳)", inp("c-max", c.max_discount == null ? "" : c.max_discount, 'inputmode="decimal" placeholder="optional"'), "for % coupons")}${fld("c-pu", "Uses per person", inp("c-pu", c.per_user, 'inputmode="numeric"'))}</div>
      <div class="pr-three">${fld("c-mu", "Total uses", inp("c-mu", c.max_uses == null ? "" : c.max_uses, 'inputmode="numeric" placeholder="unlimited"'))}${fld("c-st", "Starts (Dhaka time)", inp("c-st", toLocal(c.starts_at), 'type="datetime-local"'))}${fld("c-ex", "Expires (Dhaka time)", inp("c-ex", toLocal(c.expires_at), 'type="datetime-local"'))}</div>
      ${fld("c-sc", "Works on", sel("c-sc", [["pr", "PR services"], ["all", "PR services + company listing"], ["listing", "Company listing only"]], c.scope), "today coupons apply to PR orders; listing support can be switched on later")}
      <div class="fld"><label>Only for these services <span class="hint">none ticked = every service</span></label><div class="pr-checks">${svcs.map((s) => `<label class="chk"><input type="checkbox" data-sk="${esc(s.key)}"${picked.has(s.key) ? " checked" : ""}> ${esc(s.name_en)}</label>`).join("")}</div></div>
      ${fld("c-note", "Note (private)", inp("c-note", c.note || "", 'maxlength="200"'))}${chk("c-ac", "Coupon is active", c.active)}`;
    return dialog({ title: n ? "New coupon" : "Edit coupon", html, wide: true, onSave: async (bg) => {
      const code = n ? val(bg, "c-code").toUpperCase() : c.code, value = num(val(bg, "c-val")), kind = val(bg, "c-kind"), mu = num(val(bg, "c-mu")), pu = num(val(bg, "c-pu")), mn = num(val(bg, "c-min")), mxd = num(val(bg, "c-max"));
      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error("Code must be 3–24 characters: A–Z, 0–9, - or _.");
      if (!value || Number.isNaN(value) || value <= 0) throw new Error("Enter the discount value.");
      if (kind === "percent" && value > 100) throw new Error("A percent coupon cannot be more than 100.");
      if ([mu, pu, mn, mxd].some((x) => Number.isNaN(x))) throw new Error("Please check the numbers.");
      const row = { kind, value, min_amount: mn || 0, max_discount: kind === "percent" ? mxd : null, scope: val(bg, "c-sc"), per_user: pu || 1, max_uses: mu || null, starts_at: fromLocal(val(bg, "c-st")), expires_at: fromLocal(val(bg, "c-ex")),
        service_keys: [...bg.querySelectorAll("[data-sk]:checked")].map((x) => x.dataset.sk), active: val(bg, "c-ac"), note: val(bg, "c-note") || null };
      if (!row.service_keys.length) row.service_keys = null;
      if (row.starts_at && row.expires_at && row.expires_at <= row.starts_at) throw new Error("The expiry must be after the start.");
      try { if (n) must(await sb.from("pr_coupons").insert(Object.assign({ code }, row))); else must(await sb.from("pr_coupons").update(row).eq("id", c.id)); }
      catch (e) { if (/duplicate|unique/i.test(errMsg(e))) throw new Error("This code already exists."); throw e; }
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
