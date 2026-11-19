/* Voice of Startup Bangladesh — admin: Push notifications (the ones that appear on visitors' phones and computers).
   Loaded before admin.js. admin.js calls window.VOSB_ADMIN_PUSH(context) once and delegates the route:  push
   Everything is checked by the database (admin-only functions admin_push_stats / admin_push_send / admin_push_set; push_outbox is admin-read-only). */
window.VOSB_ADMIN_PUSH = function (X) {
  "use strict";
  const { sb, esc, toast, modal, fmtDT, fmtN, $ } = X;
  const errMsg = (e) => String((e && (e.message || e.details)) || e || "Something went wrong");
  const must = (res) => { if (res && res.error) throw new Error(errMsg(res.error)); return res ? res.data : null; };
  const busy = async (b, fn) => { if (b) b.disabled = true; try { await fn(); } catch (e) { toast(errMsg(e), "err"); } finally { if (b && b.isConnected) b.disabled = false; } };
  const handles = (h) => h === "push" || h === "alerts";
  const LINKS = [["/", "Home page"], ["/news", "News"], ["/funding", "Funding"], ["/founder-stories", "Founder stories"], ["/companies", "Company directory"], ["/opportunities", "Opportunities"]];
  const ACAT = [["orders", "🧾", "PR orders, quotes and PR payments"], ["payments", "💳", "Company listing payments"], ["companies", "🏢", "Company applications, removal and valuation requests"], ["investors", "📈", "Investor interest and investments"], ["members", "👤", "New members and deleted accounts"], ["subscribers", "✉️", "New newsletter subscribers"], ["feedback", "💬", "Reviews and comments (companies and articles)"], ["installs", "📲", "Public app installs"]];
  const KIND = { admin: ["🛎️", "Admin alert"], article: ["📰", "New article"], announce: ["📣", "Announcement"], user: ["👤", "Member update"], test: ["🧪", "Test"] };
  const ST = { pending: "Waiting", sending: "Sending…", sent: "Sent", failed: "Failed" };

  /* ---------------- Alerts inbox: everything that happened (the same events that are pushed to the phone) ---------------- */
  const AL = { pr_order: ["🧾", "#/pr"], pr_payment: ["💳", "#/pr"], payment_submitted: ["💳", "#/payments"], application_submitted: ["🏢", "#/companies"], delete_request: ["🗑️", "#/companies"], valuation_request: ["📊", "#/valuations"],
    investor_interest: ["📈", "#/interests"], investment_proposed: ["🤝", "#/deals"], investment_confirmed: ["🤝", "#/deals"], new_member: ["👤", "#/users"], account_deleted: ["👋", "#/deletions"],
    new_subscriber: ["✉️", "#/subscribers"], new_review: ["⭐", "#/reviews"], new_comment: ["💬", "#/reviews"], post_comment: ["💬", "#/posts"], app_installed: ["📲", "#/dashboard"] };
  const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : m < 10080 ? Math.round(m / 1440) + " d ago" : fmtDT(iso); };
  async function renderAlerts(view) {
    const st = view._st || (view._st = { unread: false });
    view.innerHTML = `<div class="page-h"><h1>Alerts</h1><a class="b b-line" href="#/push">🔔 Push settings</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    let items;
    try { const r = must(await sb.rpc("my_notifications", { p_limit: 100 })); items = (r && r.items || []).filter((x) => x.for_admin); } catch (e) { view.innerHTML = `<div class="page-h"><h1>Alerts</h1></div><div class="card"><div class="msg err">${esc(errMsg(e))}</div></div>`; return; }
    if (!view.isConnected) return;
    const unread = items.filter((x) => !x.read_at).length;
    const l = st.unread ? items.filter((x) => !x.read_at) : items;
    view.innerHTML = `<div class="page-h"><h1>Alerts${unread ? ` <span class="pill pr-pending" style="vertical-align:middle">${unread} new</span>` : ""}</h1><a class="b b-line" href="#/push">🔔 Push settings</a></div>
      <div class="card"><div class="sc-gh"><label class="chk" style="margin:0"><input type="checkbox" id="al-u"${st.unread ? " checked" : ""}> Unread only</label><button type="button" class="b b-line b-sm" data-a="all"${unread ? "" : " disabled"}>Mark all as read</button></div>
        <div class="rows">${l.length ? l.map((x) => { const k = AL[x.kind] || ["🔔", "#/dashboard"]; return `<a class="row pr-row al-row${x.read_at ? "" : " al-new"}" href="${k[1]}" data-a="open" data-id="${esc(x.id)}"><div class="th co-logo">${k[0]}</div><div class="ti"><h3>${esc(x.title_en || x.title_bn || x.kind)}</h3><div class="meta">${x.body_en ? `<span>${esc(x.body_en)}</span>` : ""}<span>${esc(ago(x.created_at))}</span></div></div>${x.read_at ? "" : `<i class="al-dot" aria-label="Unread"></i>`}</a>`; }).join("")
          : `<div class="empty"><b>${st.unread ? "No unread alerts" : "No alerts yet"}</b>New orders, payments, applications, sign-ups and comments will appear here.</div>`}</div>
        ${items.length >= 100 ? `<p class="muted" style="margin:10px 0 0">Showing the latest 100.</p>` : ""}</div>`;
    const done = () => { if (window.VOSB_ADMIN_ALERTS_REFRESH) window.VOSB_ADMIN_ALERTS_REFRESH(); };
    $("#al-u", view).addEventListener("change", (e) => { st.unread = e.target.checked; renderAlerts(view); });
    view._h = view._h || {};
    view._h.all = (b) => busy(b, async () => { must(await sb.rpc("mark_notifications_read", { p_ids: null })); done(); await renderAlerts(view); });
    view._h.open = (b) => { const id = b.dataset.id; if (b.classList.contains("al-new")) sb.rpc("mark_notifications_read", { p_ids: [id] }).then(done, () => {}); window.location.hash = b.getAttribute("href"); };
  }
  async function render(h, view) {
    if (h === "alerts") { if (!view._hb) { view._hb = true; view._h = {}; view.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b && view._h && view._h[b.dataset.a]) { e.preventDefault(); view._h[b.dataset.a](b, e); } }); } return renderAlerts(view); }
    if (!view._hb) {
      view._hb = true;
      view.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b && view._h && view._h[b.dataset.a]) { e.preventDefault(); view._h[b.dataset.a](b, e); } });
    }
    view._h = {};
    view.innerHTML = `<div class="page-h"><h1>Push notifications</h1><a class="b b-line" href="#/subscribers">← Subscribers</a></div><div class="card"><p class="muted">Loading…</p></div>`;
    let S, rows, posts;
    try {
      [S, rows, posts] = await Promise.all([
        sb.rpc("admin_push_stats"),
        sb.from("push_outbox").select("id,kind,audience,title_bn,title_en,url,status,sent_n,failed_n,total_n,created_at,sent_at").order("created_at", { ascending: false }).limit(30),
        sb.from("posts").select("slug,title_bn,title_en,excerpt_bn,excerpt_en,publish_at").eq("status", "published").lte("publish_at", new Date().toISOString()).order("publish_at", { ascending: false }).limit(12),
      ]);
      S = must(S) || {}; rows = must(rows) || []; posts = must(posts) || [];
    } catch (e) { view.innerHTML = `<div class="page-h"><h1>Push notifications</h1></div><div class="card"><div class="msg err">${esc(errMsg(e))}</div></div>`; return; }
    if (!view.isConnected) return;
    const P = window.VOSB_PUSH; if (P && P.setRpc) P.setRpc((n, a) => sb.rpc(n, a));
    const cfg = S.cfg || {}, mine = Number(S.mine || 0), here = P ? P.state() : "unsupported";
    const pending = rows.filter((r) => r.status === "pending" || r.status === "sending").length;
    view.innerHTML = `<div class="page-h"><h1>Push notifications</h1><a class="b b-line" href="#/subscribers">← Subscribers</a></div>
      <div class="tiles">
        <div class="tile g"><small>Devices subscribed</small><b>${fmtN(S.active || 0)}</b></div>
        <div class="tile"><small>Members · visitors</small><b>${fmtN(S.members || 0)} <span class="muted" style="font-size:.7em">· ${fmtN(S.visitors || 0)}</span></b></div>
        <div class="tile"><small>Installed app</small><b>${fmtN(S.installed || 0)}</b></div>
        <div class="tile"><small>New · last 7 days</small><b>${fmtN(S.new_7d || 0)}</b></div>
      </div>
      <div class="msg info">Visitors get a “Turn on notifications” prompt on their second page (and in Settings and the bell). When they turn it on, their phone or computer receives your news <b>even when the site is closed</b>. Bangla readers get the Bangla text, English readers the English text · Bangla ${fmtN(S.bn || 0)} · English ${fmtN(S.en || 0)} · switched off or removed ${fmtN(S.lost || 0)}.</div>
      <div class="card"><h2>Admin alerts — for you</h2>
        <p class="muted" style="margin:2px 0 10px">Every event below reaches <b>your own</b> devices (this browser and the installed admin app) the moment it happens — tap an alert to open the right admin page. Turn the devices on from “This device” below.</p>
        <label class="chk" style="margin:6px 0 8px"><input type="checkbox" id="pa-all"${cfg.auto_admin === false ? "" : " checked"}> <span><b>Send me admin alerts</b></span></label>
        <div class="pa-grid" id="pa-grid">${ACAT.map(([k, ic, t]) => `<label class="chk pa-i"><input type="checkbox" data-ac="${k}"${(cfg.admin_off || []).includes(k) ? "" : " checked"}> <span>${ic} ${esc(t)}</span></label>`).join("")}</div>
        <p class="muted" style="margin:10px 0 0">Changes save when you tick or untick. If a burst arrives (more than 15 in 5 minutes) the rest stay in the in-app list so your phone is not flooded.</p></div>
      <div class="card" style="margin-top:16px"><h2>Automatic notifications</h2>
        <label class="chk" style="margin:6px 0 4px"><input type="checkbox" id="pn-art"${cfg.auto_articles === false ? "" : " checked"}> <span><b>New articles</b> — everyone gets a notification about a minute after an article goes live (scheduled articles when their time comes; old or back-dated articles are skipped).</span></label>
        <label class="chk" style="margin:6px 0 0"><input type="checkbox" id="pn-mem"${cfg.auto_members === false ? "" : " checked"}> <span><b>Member updates</b> — order, payment, quote, company and deal updates reach that member's own devices (and yours for admin alerts).</span></label>
        <p class="muted" style="margin:10px 0 0">Changes save when you tick or untick.</p></div>
      <div class="card" style="margin-top:16px"><h2>This device</h2>
        <p style="margin:6px 0 10px">${here === "on" ? "✅ Notifications are <b>on</b> in this browser." : here === "denied" ? "⛔ This browser has blocked notifications — allow them in the site settings (🔒 icon next to the address)." : here === "unsupported" || here === "ios" ? "This browser cannot receive push notifications. Use Chrome or Edge." : "Notifications are <b>off</b> in this browser."} Your own devices registered: <b>${fmtN(mine)}</b>.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${here === "off" ? `<button type="button" class="b b-orange" data-a="here-on">🔔 Turn on for this device</button>` : ""}<button type="button" class="b b-line" data-a="test"${mine ? "" : " disabled"}>🧪 Send a test to my devices</button></div>
        ${mine ? "" : `<p class="muted" style="margin:8px 0 0">Turn it on here while signed in as admin, then you can send yourself a test.</p>`}</div>
      <div class="card" style="margin-top:16px"><h2>Send an announcement</h2>
        <p class="muted" style="margin:0 0 10px">For a new feature, an app update, an event, or any news you want everyone to see now. It appears on every subscribed device within about a minute.</p>
        <div class="fld"><label for="pn-art-sel">Fill from a recent article <span class="hint">optional</span></label><select class="sel" id="pn-art-sel"><option value="">— write my own —</option>${posts.map((p, i) => `<option value="${i}">${esc((p.title_en || p.title_bn || p.slug).slice(0, 90))}</option>`).join("")}</select></div>
        <div class="pr-two" style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px"><div class="fld"><label for="pn-tb">Title (Bangla)</label><input class="inp" id="pn-tb" maxlength="120" placeholder="যেমন: নতুন অ্যাপ আপডেট এসেছে"></div><div class="fld"><label for="pn-te">Title (English)</label><input class="inp" id="pn-te" maxlength="120" placeholder="e.g. A new app update is here"></div></div>
        <div class="pr-two" style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px"><div class="fld"><label for="pn-bb">Message (Bangla) <span class="hint" id="pn-bbc">0 / 180</span></label><textarea class="txt" id="pn-bb" rows="3" maxlength="180"></textarea></div><div class="fld"><label for="pn-be">Message (English) <span class="hint" id="pn-bec">0 / 180</span></label><textarea class="txt" id="pn-be" rows="3" maxlength="180"></textarea></div></div>
        <div class="pr-two" style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px"><div class="fld"><label for="pn-link">Opens this page <span class="hint">starts with /</span></label><input class="inp" id="pn-link" value="/" maxlength="200" list="pn-links"><datalist id="pn-links">${LINKS.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</datalist></div><div class="fld"><label for="pn-aud">Send to</label><select class="sel" id="pn-aud"><option value="all">Everyone who turned it on</option><option value="members">Signed-in members only</option></select></div></div>
        <div class="pn-prev" id="pn-prev" aria-live="polite"></div>
        <div class="msg err" id="pn-err" hidden></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="b b-orange" data-a="send">📣 Send now</button><button type="button" class="b b-line" data-a="send-test"${mine ? "" : " disabled"}>🧪 Send to me only</button></div></div>
      <div class="card" style="margin-top:16px"><div class="sc-gh"><h2>Recent notifications${pending ? ` <small class="muted">· ${pending} sending</small>` : ""}</h2><button type="button" class="b b-line b-sm" data-a="refresh">Refresh</button></div>
        <div class="rows">${rows.length ? rows.map((r) => { const k = KIND[r.kind] || ["🔔", r.kind]; return `<div class="row pr-row"><div class="th co-logo">${k[0]}</div><div class="ti"><h3>${esc(r.title_en || r.title_bn)} <small>· ${esc(k[1])}</small></h3><div class="meta"><span>${esc(fmtDT(r.created_at))}</span><span>${r.audience === "members" ? "Members" : r.audience === "user" ? "One member" : "Everyone"}</span><span>${esc(r.url)}</span></div></div><div class="acts"><span class="pill pr-${r.status === "sent" ? "verified" : r.status === "failed" ? "rejected" : "pending"}">${esc(ST[r.status] || r.status)}</span><span class="muted" style="font-size:.85rem">${fmtN(r.sent_n || 0)} delivered${r.failed_n ? " · " + fmtN(r.failed_n) + " failed" : ""}</span></div></div>`; }).join("") : `<div class="empty"><b>Nothing sent yet</b>New articles and announcements will be listed here.</div>`}</div></div>`;

    const val = (id) => ($("#" + id, view) || {}).value || "";
    const counters = () => { const b = $("#pn-bb", view), e = $("#pn-be", view); if (b) $("#pn-bbc", view).textContent = b.value.length + " / 180"; if (e) $("#pn-bec", view).textContent = e.value.length + " / 180"; };
    const preview = () => {
      const tb = val("pn-tb") || val("pn-te") || "…", te = val("pn-te") || val("pn-tb") || "…", bb = val("pn-bb"), be = val("pn-be");
      $("#pn-prev", view).innerHTML = [["Bangla readers see", tb, bb || be], ["English readers see", te, be || bb]].map(([h2, t, b]) => `<div class="pn-n"><small>${h2}</small><div class="pn-card"><img src="/assets/icon-192.png" alt="" width="40" height="40"><div><b>${esc(t)}</b>${b ? `<span>${esc(b)}</span>` : ""}<em>voiceofstartup.bd</em></div></div></div>`).join("");
    };
    ["pn-tb", "pn-te", "pn-bb", "pn-be"].forEach((id) => $("#" + id, view).addEventListener("input", () => { counters(); preview(); }));
    preview();
    $("#pn-art-sel", view).addEventListener("change", (e) => {
      const p = posts[Number(e.target.value)]; if (!p) return;
      $("#pn-tb", view).value = (p.title_bn || p.title_en || "").slice(0, 120); $("#pn-te", view).value = (p.title_en || p.title_bn || "").slice(0, 120);
      $("#pn-bb", view).value = (p.excerpt_bn || "").slice(0, 180); $("#pn-be", view).value = (p.excerpt_en || "").slice(0, 180); $("#pn-link", view).value = "/read/" + p.slug; counters(); preview();
    });
    const body = (test) => ({ title_bn: val("pn-tb"), title_en: val("pn-te"), body_bn: val("pn-bb"), body_en: val("pn-be"), url: val("pn-link").trim() || "/", audience: val("pn-aud") || "all", test: !!test });
    const err = (m) => { const e = $("#pn-err", view); e.hidden = !m; e.textContent = m || ""; };
    const reload = () => render(h, view);
    const saveAdm = (b) => busy(b, async () => { must(await sb.rpc("admin_push_set", { p: { auto_admin: $("#pa-all", view).checked, admin_off: [...view.querySelectorAll("[data-ac]")].filter((x) => !x.checked).map((x) => x.dataset.ac) } })); toast("Saved", "ok"); });
    $("#pa-all", view).addEventListener("change", (e) => { view.querySelectorAll("[data-ac]").forEach((x) => (x.disabled = !e.target.checked)); saveAdm(e.target); });
    view.querySelectorAll("[data-ac]").forEach((x) => { x.disabled = !$("#pa-all", view).checked; x.addEventListener("change", () => saveAdm(x)); });
    const saveCfg = (b) => busy(b, async () => { must(await sb.rpc("admin_push_set", { p: { auto_articles: $("#pn-art", view).checked, auto_members: $("#pn-mem", view).checked } })); toast("Saved", "ok"); });
    $("#pn-art", view).addEventListener("change", (e) => saveCfg(e.target)); $("#pn-mem", view).addEventListener("change", (e) => saveCfg(e.target));
    view._h["here-on"] = (b) => busy(b, async () => { const r = await P.enable(); if (!r.ok) { toast(r.reason === "denied" ? "Blocked in this browser — allow notifications in the site settings." : "Could not turn on — " + r.reason, "err"); return; } toast("Turned on for this device", "ok"); reload(); });
    view._h.test = (b) => busy(b, async () => { must(await sb.rpc("admin_push_send", { p: { test: true, title_bn: "টেস্ট নোটিফিকেশন ✓", title_en: "Test notification ✓", body_bn: "এটি আপনার ডিভাইসে পৌঁছেছে।", body_en: "This reached your device.", url: "/admin" } })); toast("Test sent — it should arrive in a few seconds", "ok"); setTimeout(reload, 6000); });
    view._h["send-test"] = (b) => busy(b, async () => { err(""); try { must(await sb.rpc("admin_push_send", { p: body(true) })); } catch (e) { err(errMsg(e)); return; } toast("Sent to your devices", "ok"); setTimeout(reload, 6000); });
    view._h.send = (b) => busy(b, async () => {
      err(""); if (!val("pn-tb").trim() && !val("pn-te").trim()) { err("Write a title (Bangla or English)."); return; }
      const aud = val("pn-aud") === "members" ? "signed-in members" : "everyone who turned notifications on", n = val("pn-aud") === "members" ? Number(S.members || 0) : Number(S.active || 0);
      if (!(await modal({ title: "Send this notification?", body: `It goes to ${fmtN(n)} device${n === 1 ? "" : "s"} (${aud}). It cannot be unsent.`, ok: "Send now" }))) return;
      try { must(await sb.rpc("admin_push_send", { p: body(false) })); } catch (e) { err(errMsg(e)); return; }
      toast("Sending — it reaches devices within a minute", "ok"); setTimeout(reload, 4000);
    });
    view._h.refresh = (b) => busy(b, async () => { await reload(); });
  }
  return { handles, render };
};
