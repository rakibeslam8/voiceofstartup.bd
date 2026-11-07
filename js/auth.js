/* Voice of Startup Bangladesh — visitor accounts (login / sign-up / profile session).
   - Google login and e-mail + password, powered by Supabase Auth. Only the PUBLIC anon key is used here.
   - The big Supabase library is loaded only when it is really needed (login, a page that saves data, or coming back from Google).
   - Everything a signed-in person may do is enforced by the database (row-level security + checked functions), not by this file.
   Public API (window.VOSB_AUTH):
     user() -> {id,email,name,avatar}|null      isIn()                 onChange(fn)  (fn(user) on login / logout)
     client() -> Promise<supabase client>        rpc(name,args) -> Promise<{data,error}>
     requireLogin(bn,en) -> Promise<user|null>   open('login'|'signup'|'forgot')      signOut()
     profile(force) -> Promise<row|null>         paint()  (re-draw the header / phone-sheet login area) */
(function () {
  "use strict";
  const C = window.VOSB || {}, S = C.supabase || {};
  const KEY = "vosb-user-auth";
  const UI = () => window.VOSB_UI || {};
  const T = (bn, en) => (UI().T ? UI().T(bn, en) : bn);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let sb = null, sbP = null, settings = null, profileRow = null, profileP = null;
  const listeners = [];
  let pending = [];                // requireLogin() promises waiting for the modal

  /* ---------- session (readable without loading the library) ---------- */
  const mapUser = (u) => {
    if (!u) return null;
    const m = u.user_metadata || {};
    const av = m.avatar_url || m.picture || "";
    return { id: u.id, email: u.email || "", name: String(m.full_name || m.name || "").trim(), avatar: /^https:\/\//.test(av) ? av : "" };
  };
  function stored() { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && j.user && j.access_token ? j : null; } catch (e) { return null; } }
  let user = mapUser((stored() || {}).user);
  /* profile photo uploaded on VOSB wins over the Google picture; cached so every page can show it without a request */
  const AVK = "vosb-avatar";
  const avCached = () => { try { const j = JSON.parse(localStorage.getItem(AVK) || "null"); return j && user && j.id === user.id && /^https:\/\//.test(j.url) ? j.url : ""; } catch (e) { return ""; } };
  function setAvatar(url) {
    if (!user) return; try { if (url) localStorage.setItem(AVK, JSON.stringify({ id: user.id, url })); else localStorage.removeItem(AVK); } catch (e) {}
    const next = url || mapUser((stored() || {}).user).avatar || ""; if (next !== user.avatar) { user.avatar = next; paint(); }
  }
  if (user && avCached()) user.avatar = avCached();
  const isIn = () => !!user;

  /* what this person needs in their menu: founders see their companies, investors see their investments, readers just browse */
  const CTXK = "vosb-ctx";
  let ctx = (() => { try { const j = JSON.parse(localStorage.getItem(CTXK) || "null"); return j && user && j.id === user.id ? j : null; } catch (e) { return null; } })();
  function setCtx(d) {
    ctx = d && user ? { id: user.id, type: d.user_type || "", co: +d.companies > 0, inv: +d.investing > 0 } : null;
    try { if (ctx) localStorage.setItem(CTXK, JSON.stringify(ctx)); else localStorage.removeItem(CTXK); } catch (e) {}
    paint();
  }
  function links() {
    const L = [["/account", "👤", "আমার অ্যাকাউন্ট", "My account"]];
    if (!ctx) { L.push(["/companies", "🔎", "কোম্পানি দেখুন", "Browse companies"], ["/list-your-company", "➕", "কোম্পানি লিস্ট করুন", "List your company"]); return L; }
    const founder = ctx.type === "founder" || ctx.co, investor = ctx.type === "investor" || ctx.inv;
    if (founder) L.push(["/account#companies", "🏢", "আমার কোম্পানি", "My companies"]);
    if (investor) L.push(["/account#invest", "💼", "আমার বিনিয়োগ", "My investments"]);
    if (founder) L.push(["/list-your-company", "➕", "কোম্পানি লিস্ট করুন", "List your company"]);
    if (!founder || investor) L.push(["/companies", "🔎", "কোম্পানি দেখুন", "Browse companies"]);
    return L;
  }
  const linkHtml = (cls) => links().map((l) => `<a ${cls ? `class="${cls}" ` : ""}role="menuitem" href="${l[0]}"><span aria-hidden="true">${l[1]}</span> ${T(l[2], l[3])}</a>`).join("");

  /* a small, safe copy of a chosen photo (max 384px) */
  function shrink(file, max) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error(T("ছবির ফাইল বেছে নিন।", "Please choose an image file.")));
      if (file.size > 8 * 1024 * 1024) return rej(new Error(T("ছবিটি বড় (সর্বোচ্চ ৮ MB)।", "That photo is too big (max 8 MB).")));
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); const k = Math.min(1, max / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h); cv.toBlob((b) => (b ? res(b) : rej(new Error("image"))), "image/jpeg", 0.85); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error(T("ছবিটি পড়া যায়নি।", "Could not read this image."))); };
      im.src = u;
    });
  }
  async function uploadAvatarBlob(blob) {
    const c = await client(), path = `${user.id}/avatar-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const up = await c.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" }); if (up.error) throw up.error;
    const url = c.storage.from("avatars").getPublicUrl(path).data.publicUrl, r = await rpc("update_my_profile", { p: { avatar_url: url } }); if (r.error) throw r.error;
    setAvatar(url);
  }
  /* sign-up photo/role chosen before the e-mail was confirmed are applied at the first login */
  const PENDK = "vosb-signup";
  async function applyPending() {
    try {
      const j = JSON.parse(localStorage.getItem(PENDK) || "null"); if (!j || !user || String(j.email).toLowerCase() !== String(user.email).toLowerCase()) return;
      localStorage.removeItem(PENDK);
      if (j.role) await rpc("update_my_profile", { p: { user_type: j.role } });
      if (j.photo) { const b = await (await fetch(j.photo)).blob(); await uploadAvatarBlob(b); }
      profileP = null; profile(true);
    } catch (e) {}
  }

  /* ---------- library + client ---------- */
  function loadLib() {
    if (window.supabase) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "/js/vendor/supabase.js?v=2.45.4";
      s.onload = () => res();
      s.onerror = () => rej(new Error("Could not load the sign-in library. Check your internet and try again."));
      document.head.appendChild(s);
    });
  }
  function client() {
    if (sbP) return sbP;
    sbP = loadLib().then(() => {
      sb = window.supabase.createClient(S.url, S.anonKey, { auth: { storageKey: KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      sb.auth.onAuthStateChange((ev, sess) => {
        const nu = mapUser(sess && sess.user);
        const changed = (nu && nu.id) !== (user && user.id);
        if (nu) { const keep = (user && user.id === nu.id && user.avatar) || ""; user = nu; const c2 = avCached(); if (c2 || keep) user.avatar = c2 || keep; } else user = nu;
        if (ev === "PASSWORD_RECOVERY") { open("reset"); }
        if (changed) { profileRow = null; profileP = null; paint(); listeners.slice().forEach((f) => { try { f(user); } catch (e) {} }); document.dispatchEvent(new CustomEvent("vosb:auth", { detail: user })); }
        if (changed && nu) { if (ev !== "PASSWORD_RECOVERY") closeModal(); resolvePending(nu); }
      });
      return sb;
    }).catch((e) => { sbP = null; throw e; });
    return sbP;
  }
  const rpc = async (name, args) => { const c = await client(); return c.rpc(name, args || {}); };
  /* the calls the page needs to draw a signed-in person (profile, menu, bell) must survive a slow network, an expired
     token that is still being refreshed, or the auth library's tab lock: retry a few times, refresh the session once */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function rpcR(name, args, tries) {
    let last = null; tries = tries || 3;
    for (let i = 0; i < tries; i++) {
      try {
        const c = await client();
        if (i > 0) { try { await c.auth.getSession(); } catch (e) {} if (i === tries - 1) { try { await c.auth.refreshSession(); } catch (e) {} } }
        const r = await c.rpc(name, args || {});
        if (!r.error) return r;
        last = r;
        const m = String(r.error.message || "") + " " + String(r.error.code || "");
        if (/sign in|jwt|expired|401|28000|fetch|network|abort|lock|timeout|503|502|504/i.test(m)) { await sleep(450 * (i + 1)); continue; }
        return r;
      } catch (e) { last = { error: e }; await sleep(450 * (i + 1)); }
    }
    return last || { error: new Error("failed") };
  }
  const onChange = (fn) => { listeners.push(fn); };
  function profile(force) {
    if (!user) return Promise.resolve(null);
    if (profileP && !force) return profileP;
    const mine = rpcR("ensure_profile").then((r) => {
      profileRow = r.error ? null : r.data;
      if (profileRow) {
        rpcR("my_context").then((x) => { if (!x.error && x.data) setCtx(x.data); }).catch(() => {});
        applyPending();
        setAvatar(/^https:\/\//.test(profileRow.avatar_url || "") ? profileRow.avatar_url : "");
      }
      return profileRow;
    }).catch(() => null).then((row) => { if (!row && profileP === mine) profileP = null; return row; });   // a failed load is never remembered
    profileP = mine;
    return mine;
  }

  /* ---------- what the project allows (Google on? sign-up on?) ---------- */
  async function authSettings() {
    if (settings) return settings;
    try {
      const r = await fetch(S.url + "/auth/v1/settings", { headers: { apikey: S.anonKey } });
      settings = r.ok ? await r.json() : {};
    } catch (e) { settings = {}; }
    return settings;
  }

  /* ---------- small UI helpers ---------- */
  function toast(msg, kind) {
    document.querySelectorAll(".au-toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "au-toast " + (kind || ""); t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
  const GOOGLE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285f4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34a853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.100 0-5.700-2.100-6.600-4.900H1.400v3.100A12 12 0 0 0 12 24z"/><path fill="#fbbc05" d="M5.400 14.400a7.200 7.200 0 0 1 0-4.800V6.500H1.400a12 12 0 0 0 0 11z"/><path fill="#ea4335" d="M12 4.800c1.800 0 3.300.6 4.600 1.800l3.400-3.400A12 12 0 0 0 1.400 6.500l4 3.100C6.300 6.900 8.900 4.800 12 4.800z"/></svg>';
  const EYE = T("দেখান", "Show");

  /* ---------- the login / sign-up window ---------- */
  let modal = null, mode = "login";
  function closeModal() { if (modal) { modal.remove(); modal = null; document.body.classList.remove("au-lock"); document.removeEventListener("keydown", onKey); } }
  function onKey(e) { if (e.key === "Escape") { closeModal(); resolvePending(null); } }
  function resolvePending(u) { const p = pending; pending = []; p.forEach((f) => f(u)); }

  async function open(m, reasonHtml) {
    mode = m || "login";
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.className = "au-modal";
    document.body.appendChild(modal);
    document.body.classList.add("au-lock");
    document.addEventListener("keydown", onKey);
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-au-x]")) { closeModal(); resolvePending(null); } });
    modal.innerHTML = '<div class="au-card" role="dialog" aria-modal="true"><p class="au-load">…</p></div>';
    const cfg = await authSettings();
    if (!modal) return;
    draw(cfg, reasonHtml);
  }

  function draw(cfg, reasonHtml) {
    const google = !!(cfg.external && cfg.external.google);
    const noSignup = !!cfg.disable_signup;
    const card = modal.querySelector(".au-card");
    const title = { login: T("লগইন করুন", "Welcome back"), signup: T("অ্যাকাউন্ট খুলুন", "Create your account"), forgot: T("পাসওয়ার্ড রিসেট", "Reset your password"), reset: T("নতুন পাসওয়ার্ড দিন", "Set a new password") }[mode];
    const sub = { login: T("রিভিউ দিতে, কমেন্ট করতে ও কোম্পানি লিস্ট করতে লগইন করুন।", "Log in to review, comment and list your company."),
      signup: T("বিনামূল্যে অ্যাকাউন্ট খুলুন — এক মিনিটেই।", "Free and quick — it takes a minute."),
      forgot: T("আপনার ইমেইল দিন, রিসেট লিংক পাঠাব।", "Enter your email and we will send a reset link."), reset: T("কমপক্ষে ৮ অক্ষরের একটি পাসওয়ার্ড দিন।", "Choose a password of at least 8 characters.") }[mode];
    const showTabs = mode === "login" || mode === "signup";
    card.innerHTML = `
      <button type="button" class="au-x" data-au-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button>
      <img class="au-logo" src="/assets/logo.png" alt="Voice of Startup Bangladesh" width="132" height="44">
      <h2>${title}</h2><p class="au-sub">${reasonHtml ? reasonHtml : sub}</p>
      ${showTabs ? `<div class="au-tabs" role="tablist"><button type="button" role="tab" aria-selected="${mode === "login"}" data-m="login">${T("লগইন", "Login")}</button><button type="button" role="tab" aria-selected="${mode === "signup"}" data-m="signup">${T("সাইন আপ", "Sign up")}</button></div>` : ""}
      ${showTabs ? (google ? `<button type="button" class="au-google" data-google>${GOOGLE_SVG}<span>${T("Google দিয়ে চালিয়ে যান", "Continue with Google")}</span></button>` : `<button type="button" class="au-google au-soon" disabled aria-disabled="true">${GOOGLE_SVG}<span>${T("Google দিয়ে চালিয়ে যান", "Continue with Google")}</span><em>${T("শীঘ্রই আসছে", "Coming soon")}</em></button>`) + `<div class="au-or"><span>${T("অথবা ইমেইল দিয়ে", "or with email")}</span></div>` : ""}
      <div class="au-msg" id="au-msg" role="alert" aria-live="polite"></div>
      <form class="au-form" id="au-form" novalidate>
        ${mode === "signup" ? `<label>${T("আপনার নাম", "Your name")}<input name="name" autocomplete="name" maxlength="120" required></label>` : ""}
        ${mode === "signup" ? `<fieldset class="au-role"><legend>${T("আপনি কে?", "I am a…")}</legend><div class="au-chips">${[["reader", "পাঠক", "Reader"], ["founder", "প্রতিষ্ঠাতা", "Founder"], ["investor", "বিনিয়োগকারী", "Investor"], ["other", "অন্যান্য", "Other"]].map((r, i) => `<label class="au-chip"><input type="radio" name="role" value="${r[0]}" ${i === 0 ? "checked" : ""}><span>${T(r[1], r[2])}</span></label>`).join("")}</div></fieldset>
        <div class="au-photo"><span class="au-pv" id="au-pv" aria-hidden="true">📷</span><label class="au-pbtn"><span id="au-pt">${T("প্রোফাইল ছবি দিন (ঐচ্ছিক)", "Add a profile photo (optional)")}</span><input type="file" name="photo" accept="image/*" hidden></label></div>` : ""}
        ${mode !== "reset" ? `<label>${T("ইমেইল", "Email")}<input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>` : ""}
        ${mode !== "forgot" ? `<label>${mode === "reset" ? T("নতুন পাসওয়ার্ড", "New password") : T("পাসওয়ার্ড", "Password")}<span class="au-pw"><input name="pw" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" maxlength="72" minlength="8" required><button type="button" class="au-show" data-show>${EYE}</button></span></label>` : ""}
        <input type="text" name="website" class="au-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${mode === "signup" ? `<label class="au-check"><input type="checkbox" name="ok" required><span>${T('আমি <a href="/terms-of-service" target="_blank" rel="noopener">শর্তাবলি</a> ও <a href="/privacy-policy" target="_blank" rel="noopener">গোপনীয়তা নীতি</a> মেনে নিচ্ছি।', 'I agree to the <a href="/terms-of-service" target="_blank" rel="noopener">Terms</a> and <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.')}</span></label>` : ""}
        <button class="au-go" type="submit">${{ login: T("লগইন", "Login"), signup: T("অ্যাকাউন্ট খুলুন", "Create account"), forgot: T("রিসেট লিংক পাঠান", "Send reset link"), reset: T("পাসওয়ার্ড সংরক্ষণ", "Save password") }[mode]}</button>
      </form>
      <p class="au-foot">${mode === "login" ? `<button type="button" class="au-link" data-m="forgot">${T("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}</button>` : mode === "forgot" ? `<button type="button" class="au-link" data-m="login">← ${T("লগইনে ফিরুন", "Back to login")}</button>` : ""}</p>`;
    if (mode === "signup" && noSignup) setMsg(T("নতুন অ্যাকাউন্ট খোলা সাময়িকভাবে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন — অথবা editor@voiceofstartup.bd-এ জানান।", "New sign-ups are temporarily closed. Please try again shortly — or tell us at editor@voiceofstartup.bd."), "err");
    card.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.m; draw(cfg); }));
    const sh = card.querySelector("[data-show]");
    if (sh) sh.addEventListener("click", () => { const i = card.querySelector('[name="pw"]'); const h = i.type === "password"; i.type = h ? "text" : "password"; sh.textContent = h ? T("লুকান", "Hide") : EYE; });
    const g = card.querySelector("[data-google]");
    if (g) g.addEventListener("click", async () => {
      g.disabled = true;
      try {
        const c = await client();
        try { sessionStorage.setItem("vosb-after-login", location.pathname + location.search); } catch (e) {}
        const { error } = await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname + location.search } });
        if (error) throw error;
      } catch (e) { g.disabled = false; setMsg(friendly(e), "err"); }
    });
    card.querySelector("#au-form").addEventListener("submit", (e) => { e.preventDefault(); submit(cfg, new FormData(e.target)); });
    const ph = card.querySelector('input[name="photo"]');
    if (ph) ph.addEventListener("change", async () => {
      const pv = card.querySelector("#au-pv"), pt = card.querySelector("#au-pt");
      try { const b = await shrink(ph.files[0], 96); pv.textContent = ""; pv.style.backgroundImage = `url(${URL.createObjectURL(b)})`; pt.textContent = T("ছবি বদলান", "Change photo"); setMsg(""); }
      catch (e) { ph.value = ""; pv.style.backgroundImage = ""; pv.textContent = "📷"; setMsg(friendly(e), "err"); }
    });
    const first = card.querySelector("input:not(.au-hp)"); if (first) first.focus();
  }

  function setMsg(t, kind) { const m = modal && modal.querySelector("#au-msg"); if (m) m.innerHTML = t ? `<div class="au-note ${kind || ""}">${t}</div>` : ""; }
  function friendly(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    if (/invalid login/i.test(m)) return T("ইমেইল বা পাসওয়ার্ড ঠিক নয়।", "Wrong email or password.");
    if (/not confirmed/i.test(m)) return T("আগে ইমেইলের লিংকে ক্লিক করে অ্যাকাউন্ট কনফার্ম করুন।", "Please confirm your email first (check your inbox).");
    if (/already registered|already been registered/i.test(m)) return T("এই ইমেইলে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This email already has an account — please log in.");
    if (/signups? not allowed|signup.*disabled/i.test(m)) return T("নতুন অ্যাকাউন্ট খোলা সাময়িকভাবে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন — অথবা editor@voiceofstartup.bd-এ জানান।", "New sign-ups are temporarily closed. Please try again shortly — or tell us at editor@voiceofstartup.bd.");
    const wait = m.match(/after (\d+) seconds?/i);
    if (wait) return T(`নিরাপত্তার জন্য ${window.VOSB_UI && VOSB_UI.bnDigits ? VOSB_UI.bnDigits(wait[1]) : wait[1]} সেকেন্ড পরে আবার চেষ্টা করুন।`, `For security, please wait ${wait[1]} seconds and try again.`);
    if (/rate limit|too many|over_email_send|over_request/i.test(m)) return T("অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।", "Too many attempts. Please try again in a little while.");
    if (/different from the old|same as the old/i.test(m)) return T("নতুন পাসওয়ার্ড আগেরটির থেকে আলাদা হতে হবে।", "The new password must be different from the old one.");
    if (/invalid.*email|unable to validate email|email address.*invalid/i.test(m)) return T("সঠিক ইমেইল ঠিকানা দিন।", "Please enter a valid email address.");
    if (/session.*(missing|expired)|jwt expired|refresh token/i.test(m)) return T("সেশনের মেয়াদ শেষ — আবার লগইন করুন।", "Your session has expired — please log in again.");
    if (/provider is not enabled|unsupported provider/i.test(m)) return T("Google লগইন এখনও চালু হয়নি।", "Google login is not switched on yet.");
    if (/weak|password should|at least/i.test(m)) return T("পাসওয়ার্ড আরও শক্ত করুন (কমপক্ষে ৮ অক্ষর)।", "Please use a stronger password (at least 8 characters).");
    if (/network|fetch|load/i.test(m)) return T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.");
    return esc(m) || T("কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।", "Something went wrong. Please try again.");
  }

  async function submit(cfg, f) {
    if (f.get("website")) return;                       // spam trap
    const email = String(f.get("email") || "").trim().toLowerCase(), pw = String(f.get("pw") || ""), name = String(f.get("name") || "").trim();
    const btn = modal.querySelector(".au-go");
    setMsg("");
    if (mode !== "reset" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg(T("সঠিক ইমেইল দিন।", "Enter a valid email address."), "err");
    if (mode !== "forgot" && pw.length < 8) return setMsg(T("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "Password must be at least 8 characters."), "err");
    if (mode === "signup" && name.length < 2) return setMsg(T("আপনার নাম লিখুন।", "Please enter your name."), "err");
    if (mode === "signup" && !f.get("ok")) return setMsg(T("চালিয়ে যেতে শর্তাবলিতে সম্মতি দিন।", "Please accept the Terms to continue."), "err");
    btn.disabled = true;
    const label = btn.textContent; btn.textContent = "…";
    try {
      const c = await client();
      if (mode === "login") {
        const { error } = await c.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        toast(T("স্বাগতম!", "Welcome back!"), "ok");
      } else if (mode === "signup") {
        const role = ["reader", "founder", "investor", "other"].includes(f.get("role")) ? f.get("role") : "reader", photoFile = f.get("photo");
        let small = null; if (photoFile && photoFile.size) { try { small = await shrink(photoFile, 384); } catch (e) { throw e; } }
        const { data, error } = await c.auth.signUp({ email, password: pw, options: { data: { full_name: name, user_type: role }, emailRedirectTo: location.origin + "/account" } });
        if (error) throw error;
        if (!data.session) {   // e-mail confirmation is switched on in Supabase
          try {
            const photo = small && small.size < 400000 ? await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.onerror = () => r(""); fr.readAsDataURL(small); }) : "";
            localStorage.setItem(PENDK, JSON.stringify({ email, role, photo }));
          } catch (e) {}
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("already registered");
          modal.querySelector(".au-card").innerHTML = `<button type="button" class="au-x" data-au-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><div class="au-done"><div class="au-ic">✉️</div><h2>${T("ইমেইল চেক করুন", "Check your email")}</h2><p>${T(`<b>${esc(email)}</b> ঠিকানায় একটি কনফার্মেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করলেই অ্যাকাউন্ট চালু হবে।`, `We sent a confirmation link to <b>${esc(email)}</b>. Click it to activate your account.`)}</p></div>`;
          return;
        }
        toast(T("অ্যাকাউন্ট তৈরি হয়েছে। স্বাগতম!", "Account created. Welcome!"), "ok");
        if (small) { setTimeout(() => { uploadAvatarBlob(small).catch(() => {}); }, 1200); }
      } else if (mode === "forgot") {
        const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/account" });
        if (error) throw error;
        return setMsg(T("রিসেট লিংক পাঠানো হয়েছে — ইনবক্স চেক করুন।", "Reset link sent — please check your inbox."), "ok");
      } else if (mode === "reset") {
        const { error } = await c.auth.updateUser({ password: pw });
        if (error) throw error;
        closeModal(); toast(T("পাসওয়ার্ড বদলানো হয়েছে।", "Password updated."), "ok");
        return;
      }
    } catch (e) { setMsg(friendly(e), "err"); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
  }

  /* ---------- public actions ---------- */
  async function signOut() {
    try { const c = await client(); await Promise.race([c.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* cleaned up below either way */ }
    /* belt and braces: whatever the library did, this device must forget the user right now */
    try { localStorage.removeItem(KEY); localStorage.removeItem(AVK); localStorage.removeItem(CTXK); sessionStorage.removeItem("vosb-prof"); } catch (e) {}
    if (user) {
      user = null; ctx = null; profileRow = null; profileP = null; notif = { unread: 0, items: [], loaded: false };
      closeNotifs(); document.querySelectorAll(".ab-sheet.open").forEach((x) => x.classList.remove("open"));
      paint(); listeners.slice().forEach((f) => { try { f(user); } catch (e) {} }); document.dispatchEvent(new CustomEvent("vosb:auth", { detail: user }));
    }
    toast(T("লগআউট হয়েছে।", "You are logged out."), "ok");
    if (/^\/(account|apply)/.test(location.pathname)) setTimeout(() => { location.href = "/"; }, 500);
  }
  function requireLogin(bn, en) {
    if (user) return Promise.resolve(user);
    return new Promise((res) => { pending.push(res); open("login", bn ? T(bn, en || bn) : ""); });
  }

  /* ---------- header + phone sheet ---------- */
  const initial = (u) => esc(((u.name || u.email || "?").trim()[0] || "?").toUpperCase());
  const avatar = (u, cls) => u.avatar ? `<img class="${cls}" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="${cls}">${initial(u)}</span>`;

  /* ---------- notifications (bell) ---------- */
  let notif = { unread: 0, items: [], loaded: false };
  const ago = (d) => { const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000)); const nd = (n) => (UI().bnDigits ? UI().bnDigits(String(n)) : n); return m < 60 ? T(nd(m) + " মিনিট আগে", m + "m ago") : m < 1440 ? T(nd(Math.round(m / 60)) + " ঘণ্টা আগে", Math.round(m / 60) + "h ago") : T(nd(Math.round(m / 1440)) + " দিন আগে", Math.round(m / 1440) + "d ago"); };
  async function loadNotifs() {
    if (!user) { notif = { unread: 0, items: [], loaded: false }; return; }
    try { const r = await rpcR("my_notifications", { p_limit: 30 }); if (!r.error && r.data) { notif = { unread: r.data.unread || 0, items: r.data.items || [], loaded: true }; paintBell(); } } catch (e) {}
  }
  function paintBell() { document.querySelectorAll("[data-bell]").forEach((b) => { const n = notif.unread; b.querySelector(".au-dot").textContent = n > 9 ? "9+" : String(n); b.querySelector(".au-dot").hidden = !n; b.setAttribute("aria-label", T("নোটিফিকেশন", "Notifications") + (n ? " (" + n + ")" : "")); }); }
  function closeNotifs() { const p = document.getElementById("au-np"); if (p) p.remove(); document.removeEventListener("keydown", npKey); }
  function npKey(e) { if (e.key === "Escape") closeNotifs(); }
  async function openNotifs() {
    closeNotifs(); if (!notif.loaded) await loadNotifs();
    const list = notif.items.length ? notif.items.map((n) => `<a class="au-ni ${n.read_at ? "" : "un"}" href="${esc(n.link || "/account")}" data-nid="${esc(n.id)}"><span class="au-nk" aria-hidden="true">${({ investor_interest: "💼", investment_proposed: "🤝", investment_confirmed: "🤝", investment_verified: "✅", valuation_approved: "📊", valuation_rejected: "📊", valuation_request: "📊", payment_verified: "✅", payment_rejected: "⚠️", payment_submitted: "💳", company_published: "🎉", application_submitted: "📨" })[n.kind] || "🔔"}</span><span class="au-nb"><b>${esc(UI().lang === "en" ? n.title_en || n.title_bn : n.title_bn || n.title_en)}</b>${(UI().lang === "en" ? n.body_en : n.body_bn) ? `<small>${esc(UI().lang === "en" ? n.body_en : n.body_bn)}</small>` : ""}<em>${esc(ago(n.created_at))}</em></span></a>`).join("") : `<p class="au-ne">${T("এখনও কোনো নোটিফিকেশন নেই।", "No notifications yet.")}</p>`;
    const p = document.createElement("div"); p.id = "au-np"; p.className = "au-np"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", T("নোটিফিকেশন", "Notifications"));
    p.innerHTML = `<div class="au-np-bg" data-npclose></div><div class="au-np-box"><div class="au-np-h"><b>🔔 ${T("নোটিফিকেশন", "Notifications")}</b><span>${notif.unread ? `<button type="button" data-npall>${T("সব পড়া হয়েছে", "Mark all read")}</button>` : ""}<button type="button" data-npclose aria-label="${T("বন্ধ", "Close")}">✕</button></span></div><div class="au-np-l">${list}</div></div>`;
    document.body.appendChild(p); document.addEventListener("keydown", npKey);
  }
  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-npclose]")) { closeNotifs(); return; }
    if (e.target.closest("[data-npall]")) { try { await rpc("mark_notifications_read", { p_ids: null }); notif.items.forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); }); notif.unread = 0; paintBell(); openNotifs(); } catch (x) {} return; }
    const ni = e.target.closest("[data-nid]"); if (ni) { try { rpc("mark_notifications_read", { p_ids: [ni.dataset.nid] }); } catch (x) {} return; }
    if (e.target.closest("[data-bell]") || e.target.closest('[data-act="notifs"]')) { e.preventDefault(); document.querySelectorAll(".ab-sheet.open").forEach((x) => x.classList.remove("open")); openNotifs(); }
  });
  function paint() {
    document.documentElement.classList.toggle("has-user", !!user);
    document.querySelectorAll("[data-auth-slot]").forEach((el) => {
      const kind = el.dataset.authSlot;
      if (!user) {
        el.innerHTML = kind === "sheet"
          ? `<button class="ab-login" type="button" data-act="auth"><span class="ab-login-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.7-4 3.7-6 7.5-6s6.800 2 7.500 6"/></svg></span><span class="ab-login-tx"><b>${T("লগইন / সাইন আপ", "Login / Sign up")}</b><small>${T("রিভিউ, কমেন্ট ও কোম্পানি লিস্টিংয়ের জন্য", "To review, comment and list your company")}</small></span></button>`
          : `<button class="btn btn-green au-login" type="button" data-act="auth">${T("লগইন", "Login")}</button>`;
        return;
      }
      const nm = user.name || user.email;
      if (kind === "sheet") {
        el.innerHTML = `<a class="ab-login ab-in" href="/account">${avatar(user, "au-av")}<span class="ab-login-tx"><b>${esc(nm)}</b><small>${T("আমার অ্যাকাউন্ট", "My account")}</small></span></a>
          <div class="ab-acct-row"><button type="button" data-act="notifs">🔔 ${T("নোটিফিকেশন", "Notifications")} <i class="au-dot" ${notif.unread ? "" : "hidden"}>${notif.unread > 9 ? "9+" : notif.unread}</i></button><button type="button" data-act="signout">${T("লগআউট", "Log out")}</button></div>
          <div class="st-links">${links().slice(1).map((l) => `<a href="${l[0]}"><span aria-hidden="true">${l[1]}</span><span>${T(l[2], l[3])}</span></a>`).join("")}</div>`;
      } else {
        el.innerHTML = `<div class="au-bellwrap"><button type="button" class="au-bell" data-bell aria-label="${T("নোটিফিকেশন", "Notifications")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12l-1.5-2V11a4.500 4.500 0 0 0-9 0v4zM10 20a2 2 0 0 0 4 0"/></svg><i class="au-dot" ${notif.unread ? "" : "hidden"}>${notif.unread > 9 ? "9+" : notif.unread}</i></button></div><div class="au-menu"><button type="button" class="au-avb" aria-haspopup="menu" aria-expanded="false" aria-label="${T("অ্যাকাউন্ট মেনু", "Account menu")}">${avatar(user, "au-av")}</button>
          <div class="au-dd" role="menu" hidden><div class="au-who">${avatar(user, "au-av lg")}<div><b>${esc(nm)}</b><small>${esc(user.email)}</small></div></div>
            ${linkHtml()}
            <div class="au-pref"><button type="button" class="au-prefb" data-pref="theme"><span aria-hidden="true">🌓</span> ${T("ডার্ক / লাইট মোড", "Dark / light mode")}</button><button type="button" class="au-prefb" data-pref="lang"><span aria-hidden="true">🌐</span> ${T("ভাষা", "Language")}<em>${T("English", "বাংলা")}</em></button></div>
            <button role="menuitem" type="button" data-act="signout">${T("লগআউট", "Log out")}</button></div></div>`;
      }
    });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-act="auth"]');
    if (a) { e.preventDefault(); document.querySelectorAll(".ab-sheet.open").forEach((x) => x.classList.remove("open")); open("login"); return; }
    if (e.target.closest('[data-act="signout"]')) { e.preventDefault(); signOut(); return; }
    const b = e.target.closest(".au-avb");
    document.querySelectorAll(".au-dd").forEach((d) => { if (!b || !b.parentNode.contains(d)) d.hidden = true; });
    if (b) { const d = b.parentNode.querySelector(".au-dd"); d.hidden = !d.hidden; b.setAttribute("aria-expanded", String(!d.hidden)); }
  });

  /* ---------- start-up ---------- */
  const q = location.hash + location.search;
  if (/[#&?](access_token|code|error_description)=/.test(q) || /type=recovery/.test(q)) {    // coming back from Google / an e-mail link
    client().then(() => {
      if (/error_description=/.test(q)) toast(decodeURIComponent((q.match(/error_description=([^&]+)/) || [])[1] || "").replace(/\+/g, " "), "err");
      try { const back = sessionStorage.getItem("vosb-after-login"); if (back && user && back !== location.pathname + location.search) { sessionStorage.removeItem("vosb-after-login"); location.replace(back); } } catch (e) {}
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search.replace(/[?&]code=[^&]*/, ""));
    }).catch(() => {});
  } else if (user) {
    // keep the saved session fresh in the background (refreshes an expired token and signs out a deleted account)
    setTimeout(() => { client().then((c) => c.auth.getSession()).catch(() => {}); }, 1500);
  }

  window.VOSB_AUTH = { ctx: () => ctx, links, linkHtml, user: () => user, isIn, onChange, client, rpc, requireLogin, open, signOut, profile, paint, toast, setAvatar, loadNotifs, openNotifs, avatarHtml: (url, name, cls) => (url && /^https:\/\//.test(url) ? `<img class="${cls || "au-av"}" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls || "au-av"}">${esc(((name || "?").trim()[0] || "?").toUpperCase())}</span>`) };
  paint();
  if (user) { setTimeout(() => { loadNotifs(); try { if (!sessionStorage.getItem("vosb-prof")) { sessionStorage.setItem("vosb-prof", "1"); profile(); } } catch (e) { profile(); } }, 900); }
  onChange((u) => { if (u) { loadNotifs(); profile(true); } else { notif = { unread: 0, items: [], loaded: false }; try { localStorage.removeItem(AVK); sessionStorage.removeItem("vosb-prof"); } catch (e) {} } });
})();
