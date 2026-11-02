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
  const isIn = () => !!user;

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
        user = nu;
        if (ev === "PASSWORD_RECOVERY") { open("reset"); }
        if (changed) { profileRow = null; profileP = null; paint(); listeners.slice().forEach((f) => { try { f(user); } catch (e) {} }); document.dispatchEvent(new CustomEvent("vosb:auth", { detail: user })); }
        if (changed && nu) { closeModal(); resolvePending(nu); }
      });
      return sb;
    }).catch((e) => { sbP = null; throw e; });
    return sbP;
  }
  const rpc = async (name, args) => { const c = await client(); return c.rpc(name, args || {}); };
  const onChange = (fn) => { listeners.push(fn); };
  function profile(force) {
    if (!user) return Promise.resolve(null);
    if (profileP && !force) return profileP;
    profileP = rpc("ensure_profile").then((r) => { profileRow = r.error ? null : r.data; return profileRow; }).catch(() => null);
    return profileP;
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
        ${mode !== "reset" ? `<label>${T("ইমেইল", "Email")}<input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>` : ""}
        ${mode !== "forgot" ? `<label>${mode === "reset" ? T("নতুন পাসওয়ার্ড", "New password") : T("পাসওয়ার্ড", "Password")}<span class="au-pw"><input name="pw" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" maxlength="72" minlength="8" required><button type="button" class="au-show" data-show>${EYE}</button></span></label>` : ""}
        <input type="text" name="website" class="au-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${mode === "signup" ? `<label class="au-check"><input type="checkbox" name="ok" required><span>${T('আমি <a href="/terms-of-service" target="_blank" rel="noopener">শর্তাবলি</a> ও <a href="/privacy-policy" target="_blank" rel="noopener">গোপনীয়তা নীতি</a> মেনে নিচ্ছি।', 'I agree to the <a href="/terms-of-service" target="_blank" rel="noopener">Terms</a> and <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.')}</span></label>` : ""}
        <button class="au-go" type="submit">${{ login: T("লগইন", "Login"), signup: T("অ্যাকাউন্ট খুলুন", "Create account"), forgot: T("রিসেট লিংক পাঠান", "Send reset link"), reset: T("পাসওয়ার্ড সংরক্ষণ", "Save password") }[mode]}</button>
      </form>
      <p class="au-foot">${mode === "login" ? `<button type="button" class="au-link" data-m="forgot">${T("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}</button>` : mode === "forgot" ? `<button type="button" class="au-link" data-m="login">← ${T("লগইনে ফিরুন", "Back to login")}</button>` : ""}</p>`;
    if (mode === "signup" && noSignup) setMsg(T("এই মুহূর্তে নতুন অ্যাকাউন্ট খোলা বন্ধ আছে।", "New sign-ups are paused right now."), "err");
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
    const first = card.querySelector("input:not(.au-hp)"); if (first) first.focus();
  }

  function setMsg(t, kind) { const m = modal && modal.querySelector("#au-msg"); if (m) m.innerHTML = t ? `<div class="au-note ${kind || ""}">${t}</div>` : ""; }
  function friendly(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    if (/invalid login/i.test(m)) return T("ইমেইল বা পাসওয়ার্ড ঠিক নয়।", "Wrong email or password.");
    if (/not confirmed/i.test(m)) return T("আগে ইমেইলের লিংকে ক্লিক করে অ্যাকাউন্ট কনফার্ম করুন।", "Please confirm your email first (check your inbox).");
    if (/already registered|already been registered/i.test(m)) return T("এই ইমেইলে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This email already has an account — please log in.");
    if (/signups? not allowed|signup.*disabled/i.test(m)) return T("এই মুহূর্তে নতুন অ্যাকাউন্ট খোলা বন্ধ আছে।", "New sign-ups are paused right now.");
    if (/rate limit|too many|over_email_send/i.test(m)) return T("অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।", "Too many attempts. Please try again in a little while.");
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
        const { data, error } = await c.auth.signUp({ email, password: pw, options: { data: { full_name: name }, emailRedirectTo: location.origin + "/account" } });
        if (error) throw error;
        if (!data.session) {   // e-mail confirmation is switched on in Supabase
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("already registered");
          modal.querySelector(".au-card").innerHTML = `<button type="button" class="au-x" data-au-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><div class="au-done"><div class="au-ic">✉️</div><h2>${T("ইমেইল চেক করুন", "Check your email")}</h2><p>${T(`<b>${esc(email)}</b> ঠিকানায় একটি কনফার্মেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করলেই অ্যাকাউন্ট চালু হবে।`, `We sent a confirmation link to <b>${esc(email)}</b>. Click it to activate your account.`)}</p></div>`;
          return;
        }
        toast(T("অ্যাকাউন্ট তৈরি হয়েছে। স্বাগতম!", "Account created. Welcome!"), "ok");
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
    try { const c = await client(); await c.auth.signOut(); } catch (e) { try { localStorage.removeItem(KEY); } catch (e2) {} user = null; paint(); }
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
  function paint() {
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
          <div class="ab-acct-row"><a href="/account#companies">${T("আমার কোম্পানি", "My companies")}</a><button type="button" data-act="signout">${T("লগআউট", "Log out")}</button></div>`;
      } else {
        el.innerHTML = `<div class="au-menu"><button type="button" class="au-avb" aria-haspopup="menu" aria-expanded="false" aria-label="${T("অ্যাকাউন্ট মেনু", "Account menu")}">${avatar(user, "au-av")}</button>
          <div class="au-dd" role="menu" hidden><div class="au-who">${avatar(user, "au-av lg")}<div><b>${esc(nm)}</b><small>${esc(user.email)}</small></div></div>
            <a role="menuitem" href="/account">${T("আমার অ্যাকাউন্ট", "My account")}</a><a role="menuitem" href="/account#companies">${T("আমার কোম্পানি", "My companies")}</a>
            <a role="menuitem" href="/list-your-company">${T("কোম্পানি লিস্ট করুন", "List your company")}</a><button role="menuitem" type="button" data-act="signout">${T("লগআউট", "Log out")}</button></div></div>`;
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

  window.VOSB_AUTH = { user: () => user, isIn, onChange, client, rpc, requireLogin, open, signOut, profile, paint, toast };
  paint();
})();
