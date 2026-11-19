/* Voice of Startup Bangladesh — Web Push (notifications that reach the phone / computer even when the site is closed).
   Loaded lazily by main.js (and by the admin page). Public API: window.VOSB_PUSH
     support()  -> { ok, reason }   reason: "ok" | "unsupported" | "ios-install" | "denied"
     state()    -> "on" | "off" | "denied" | "ios" | "unsupported"
     enable()   -> Promise<{ ok, reason }>   (must be called from a tap / click)
     disable()  -> Promise<void>
     sync()     -> re-registers this device (adds the signed-in member, language) — runs by itself
   The visitor chooses to turn it on; nothing is asked on first visit before the person has read a few pages. */
(function () {
  "use strict";
  if (window.VOSB_PUSH) return;
  const PUB = "BLvqIHPie61IYrnzPDQzbWDNkmPjHWL4R4nIGyVInXCj8jm01Vv8OO6TPapUNmuC-EHuIgJe0WbkgPGsDpQ6BSE";
  const SB = ((window.VOSB || {}).supabase) || {};
  const K = { dismissed: "vosb-push-no", views: "vosb-push-views", sync: "vosb-push-sync", on: "vosb-push-on" };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const lang = () => { try { return (window.VOSB_UI && window.VOSB_UI.lang) || ls.get("vosb-lang") || "bn"; } catch (e) { return "bn"; } };
  const T = (bn, en) => (lang() === "en" ? en : bn);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const standalone = () => { try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; } };
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let rpcOverride = null;

  function support() {
    const has = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!has) return { ok: false, reason: isIOS() && !standalone() ? "ios-install" : "unsupported" };
    if (Notification.permission === "denied") return { ok: false, reason: "denied" };
    return { ok: true, reason: "ok" };
  }
  function state() {
    const s = support();
    if (!s.ok) return s.reason === "denied" ? "denied" : s.reason === "ios-install" ? "ios" : "unsupported";
    return Notification.permission === "granted" && ls.get(K.on) === "1" ? "on" : "off";
  }

  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
  async function registration() {
    let r = null; try { r = await navigator.serviceWorker.getRegistration("/"); } catch (e) {}
    if (!r) r = await navigator.serviceWorker.register("/sw.js");
    return navigator.serviceWorker.ready;
  }
  async function send(sub) {
    const j = sub.toJSON(); if (!j.endpoint || !j.keys) throw new Error("no keys");
    const args = { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_lang: lang() === "en" ? "en" : "bn", p_ua: String(navigator.userAgent || "").slice(0, 280), p_installed: standalone() };
    const A = window.VOSB_AUTH;
    if (rpcOverride) { const r = await rpcOverride("push_subscribe", args); if (r && r.error) throw r.error; }
    else if (A && A.isIn && A.isIn() && A.rpc) { const r = await A.rpc("push_subscribe", args); if (r && r.error) throw r.error; }
    else {
      const r = await fetch(SB.url + "/rest/v1/rpc/push_subscribe", { method: "POST", headers: { apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(args) });
      if (!r.ok) throw new Error("subscribe " + r.status);
    }
    ls.set(K.sync, JSON.stringify({ t: Date.now(), l: args.p_lang, u: (A && A.user && A.user() && A.user().id) || "" }));
  }
  async function subscribe(reg) {
    let sub = await reg.pushManager.getSubscription();
    if (sub) { try { const k = sub.options && sub.options.applicationServerKey; if (k && btoa(String.fromCharCode(...new Uint8Array(k))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== PUB) { await sub.unsubscribe(); sub = null; } } catch (e) {} }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(PUB) });
    await send(sub);
    return sub;
  }

  async function enable() {
    const s = support();
    if (!s.ok) return { ok: false, reason: s.reason };
    try {
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") { if (perm === "denied") return { ok: false, reason: "denied" }; return { ok: false, reason: "dismissed" }; }
      const reg = await registration();
      await subscribe(reg);
      ls.set(K.on, "1"); ls.del(K.dismissed);
      try { await reg.showNotification(T("নোটিফিকেশন চালু হয়েছে ✓", "Notifications are on ✓"), { body: T("নতুন খবর প্রকাশ হলেই এখানে জানতে পারবেন।", "You'll hear about new stories here as soon as they go live."), icon: "/assets/icon-192.png", badge: "/assets/favicon-96.png", tag: "vosb-welcome", data: { url: "/news" }, lang: lang() }); } catch (e) {}
      paint(); hidePrompt();
      return { ok: true, reason: "ok" };
    } catch (e) { console.warn("push enable failed", e); return { ok: false, reason: "error" }; }
  }
  async function disable() {
    try { const reg = await navigator.serviceWorker.getRegistration("/"); const sub = reg && (await reg.pushManager.getSubscription()); if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); try { const A = window.VOSB_AUTH; const args = { p_endpoint: ep }; if (rpcOverride) await rpcOverride("push_unsubscribe", args); else if (A && A.isIn && A.isIn() && A.rpc) await A.rpc("push_unsubscribe", args); else await fetch(SB.url + "/rest/v1/rpc/push_unsubscribe", { method: "POST", headers: { apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(args) }); } catch (e) {} } } catch (e) {}
    ls.del(K.on); paint();
  }

  /* keep this device's record fresh: language, signed-in member, renewed subscriptions */
  let syncing = false;
  async function sync(force) {
    if (syncing) return; const s = support(); if (!s.ok || Notification.permission !== "granted" || ls.get(K.on) !== "1") return;
    let last = {}; try { last = JSON.parse(ls.get(K.sync) || "{}"); } catch (e) {}
    const A = window.VOSB_AUTH, uid = (A && A.user && A.user() && A.user().id) || "";
    if (!force && last.t && Date.now() - last.t < 12 * 3600e3 && last.l === lang() && (last.u || "") === uid) return;
    syncing = true;
    try { const reg = await registration(); await subscribe(reg); } catch (e) { /* try again on the next visit */ } finally { syncing = false; }
  }

  /* ---------- small UI: prompt card + rows that show / flip the state ---------- */
  let promptEl = null;
  function hidePrompt() { if (promptEl) { promptEl.classList.remove("on"); const e = promptEl; promptEl = null; setTimeout(() => e.remove(), 260); } }
  function showPrompt() {
    if (promptEl || state() !== "off" || document.querySelector(".pushp")) return;
    const el = document.createElement("div"); el.className = "pushp"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", T("নোটিফিকেশন", "Notifications"));
    el.innerHTML = `<div class="pushp-ic" aria-hidden="true">🔔</div><div class="pushp-t"><b>${T("নতুন খবর সবার আগে পান", "Get the news first")}</b><span>${T("ফান্ডিং, স্টার্টআপ ও ব্যবসার নতুন খবর প্রকাশ হলেই আপনার ডিভাইসে নোটিফিকেশন পাবেন।", "We'll notify you the moment new funding, startup and business stories go live.")}</span></div>
      <div class="pushp-a"><button type="button" class="pushp-y" data-push-on>${T("চালু করুন", "Turn on")}</button><button type="button" class="pushp-n" data-push-no>${T("এখন নয়", "Not now")}</button></div>`;
    document.body.appendChild(el); promptEl = el; requestAnimationFrame(() => el.classList.add("on"));
  }
  function maybePrompt() {
    if (/^\/admin/.test(location.pathname) || state() !== "off") return;
    const no = Number(ls.get(K.dismissed) || 0); if (no && Date.now() - no < 14 * 864e5) return;
    const v = Number(ls.get(K.views) || 0) + 1; ls.set(K.views, String(v));   // pages this device has opened
    if (v < 2 && !standalone()) return;                      // a first-time reader gets a few pages before we ask (installed app: right away)
    setTimeout(showPrompt, standalone() ? 2500 : 9000);
  }
  function stateText() {
    const s = state();
    return s === "on" ? T("চালু ✓", "On ✓") : s === "off" ? T("বন্ধ — চালু করুন", "Off — turn on") : s === "denied" ? T("ব্লক করা আছে", "Blocked") : s === "ios" ? T("হোম স্ক্রিনে যোগ করুন", "Add to Home Screen first") : T("এই ব্রাউজারে নেই", "Not supported here");
  }
  function paint() {
    const txt = stateText();
    document.querySelectorAll("[data-push-row] .push-st").forEach((e) => { if (e.textContent !== txt) e.textContent = txt; });
    document.querySelectorAll("[data-push-strip]").forEach((e) => {
      const s = state(); if (s !== "off" && s !== "ios") { if (e.innerHTML !== "") e.innerHTML = ""; e.hidden = true; return; }
      const h = `<span>🔔 ${s === "ios" ? T("পুশ নোটিফিকেশন পেতে অ্যাপটি হোম স্ক্রিনে যোগ করুন।", "Add the app to your Home Screen to get push notifications.") : T("এই ডিভাইসে নতুন খবরের নোটিফিকেশন পান", "Get new-story notifications on this device")}</span><button type="button" data-push-on>${s === "ios" ? T("কীভাবে", "How") : T("চালু করুন", "Turn on")}</button>`;
      e.hidden = false; if (e.innerHTML !== h) e.innerHTML = h;
    });
  }
  function explain(r) {
    const A = window.VOSB_AUTH, say = (m) => { try { (A && A.toast ? A.toast : (x) => alert(x))(m); } catch (e) { alert(m); } };
    if (r.reason === "denied") say(T("নোটিফিকেশন ব্লক করা আছে — ব্রাউজারের সাইট সেটিংসে (🔒 আইকন) অনুমতি দিন, তারপর আবার চেষ্টা করুন।", "Notifications are blocked — allow them in the browser's site settings (🔒 icon), then try again."));
    else if (r.reason === "ios-install") { const b = document.querySelector('[data-act="install"]'); if (b) b.click(); else say(T("iPhone-এ Safari-র Share বাটন থেকে “Add to Home Screen” দিয়ে অ্যাপ যোগ করুন, তারপর অ্যাপ থেকে চালু করুন।", "On iPhone: use Safari's Share button → “Add to Home Screen”, then open the app and turn notifications on.")); }
    else if (r.reason === "unsupported") say(T("এই ব্রাউজারে পুশ নোটিফিকেশন চলে না। Chrome বা Edge ব্যবহার করুন।", "This browser doesn't support push notifications. Try Chrome or Edge."));
    else if (r.reason === "error") say(T("চালু করা যায়নি — একটু পরে আবার চেষ্টা করুন।", "Could not turn it on — please try again in a moment."));
  }
  async function toggle() { if (state() === "on") { await disable(); return; } const r = await enable(); if (!r.ok && r.reason !== "dismissed") explain(r); }

  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-push-no]")) { ls.set(K.dismissed, String(Date.now())); hidePrompt(); return; }
    if (e.target.closest("[data-push-on]")) { e.preventDefault(); const s = state(); if (s === "ios" || s === "denied" || s === "unsupported") { explain({ reason: s === "ios" ? "ios-install" : s }); return; } const r = await enable(); if (!r.ok && r.reason !== "dismissed") explain(r); return; }
    if (e.target.closest('[data-act="push-toggle"]')) { e.preventDefault(); const s = state(); if (s === "ios" || s === "denied" || s === "unsupported") explain({ reason: s === "ios" ? "ios-install" : s }); else await toggle(); }
  });
  try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "push-resync") sync(true); }); } catch (e) {}
  try { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); }); } catch (e) {}
  try { let pt; new MutationObserver(() => { clearTimeout(pt); pt = setTimeout(paint, 60); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  try { window.addEventListener("appinstalled", () => setTimeout(() => { if (state() === "off") showPrompt(); }, 2500)); } catch (e) {}
  const boot = () => { paint(); sync(); maybePrompt(); try { const A = window.VOSB_AUTH; if (A && A.onChange) A.onChange(() => sync()); } catch (e) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.VOSB_PUSH = { support, state, enable, disable, sync, toggle, paint, setRpc(fn) { rpcOverride = fn; }, stateText };
})();
