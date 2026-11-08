/* Voice of Startup Bangladesh — /reset-password and /auth-confirm
   Landing page for the links in our e-mails (forgot password, confirm e-mail).
   Handles, in this order:
     1. a ?token_hash=…&type=recovery|signup|email link (the safe e-mail-template format — e-mail scanners cannot "use up" the link)
     2. a #access_token=…&type=recovery link (Supabase's default format)
     3. an error in the link (#error_code=otp_expired …) -> friendly message + "send me a new link"
     4. a 6-digit code typed in by hand (works when the e-mail template shows {{ .Token }})
     5. no link at all -> "forgot password" form
   The session is stored under the same key as js/auth.js, so after the password is saved the person is already logged in. */
(function () {
  "use strict";
  const RAW = location.hash + (location.search || "");          // read before js/auth.js tidies the address bar
  const root = document.getElementById("rs-root");
  if (!root) return;
  const U = () => window.VOSB_UI, A = () => window.VOSB_AUTH;
  const T = (bn, en) => U().T(bn, en);
  const esc = (s) => U().esc(s == null ? "" : s);
  const $ = (s, r) => (r || document).querySelector(s);
  const param = (k) => { const m = RAW.match(new RegExp("[#&?]" + k + "=([^&]*)")); return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : ""; };
  const TYPE = param("type"), TOKEN_HASH = param("token_hash"), ERR_CODE = param("error_code"), ERR_DESC = param("error_description");
  const CONFIRM = location.pathname.replace(/\/$/, "") === "/auth-confirm" || (TYPE && TYPE !== "recovery");
  const st = { mode: "checking", email: "", msg: "", kind: "", busy: false, cool: 0, done: "" };

  const friendly = (e) => {
    const m = String((e && e.message) || e || "") + " " + String((e && e.code) || "");
    const wait = m.match(/after (\d+) seconds?/i);
    if (wait) return T(`নিরাপত্তার জন্য ${U().bnDigits(wait[1])} সেকেন্ড পরে আবার চেষ্টা করুন।`, `For security, please wait ${wait[1]} seconds and try again.`);
    if (/rate limit|too many|over_email_send|over_request/i.test(m)) return T("অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।", "Too many attempts. Please try again in a little while.");
    if (/different from the old|same as the old|should be different/i.test(m)) return T("নতুন পাসওয়ার্ড আগেরটির থেকে আলাদা হতে হবে।", "The new password must be different from the old one.");
    if (/weak|at least|characters/i.test(m)) return T("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "The password must be at least 8 characters.");
    if (/expired|invalid|otp|token/i.test(m)) return T("লিংক বা কোডটি ভুল অথবা মেয়াদ শেষ।", "The link or code is wrong or has expired.");
    if (/session.*missing|not authenticated|jwt/i.test(m)) return T("সেশন পাওয়া যায়নি — নতুন রিসেট লিংক নিন।", "No session found — please request a new reset link.");
    if (/fetch|network|failed to/i.test(m)) return T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.");
    return esc(String((e && e.message) || "")) || T("কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।", "Something went wrong. Please try again.");
  };
  const client = () => A().client();

  /* ---------- screens ---------- */
  const pwField = (id, label, ac) => `<div class="ac-fld"><label for="${id}">${label}</label><div class="rs-pw"><input id="${id}" type="password" autocomplete="${ac}" minlength="8" maxlength="72" required><button type="button" class="rs-eye" data-eye="${id}" aria-label="${T("পাসওয়ার্ড দেখুন", "Show password")}">👁</button></div></div>`;
  const msgBox = () => `<div class="ac-msg ${st.kind}" id="rs-msg" role="alert" aria-live="polite">${st.msg ? esc(st.msg) : ""}</div>`;
  const head = (ic, h, p) => `<div class="rs-ic" aria-hidden="true">${ic}</div><h2>${h}</h2>${p ? `<p class="muted">${p}</p>` : ""}`;

  function draw() {
    let h = "";
    if (st.mode === "checking") h = `<div class="ac-card ac-center rs-card">${head("⏳", T("যাচাই করা হচ্ছে…", "Checking your link…"))}<div class="pay-spin" aria-hidden="true"></div></div>`;
    else if (st.mode === "form") h = `<form class="ac-card rs-card" id="rs-form" novalidate>${head("🔐", T("নতুন পাসওয়ার্ড দিন", "Set a new password"), T("কমপক্ষে ৮ অক্ষর। এটি আপনার পুরোনো পাসওয়ার্ডের জায়গা নেবে।", "At least 8 characters. It replaces your old password."))}
      ${pwField("rs-p1", T("নতুন পাসওয়ার্ড", "New password"), "new-password")}${pwField("rs-p2", T("আবার লিখুন", "Confirm new password"), "new-password")}
      <ul class="rs-rules" id="rs-rules"><li data-r="len">${T("কমপক্ষে ৮ অক্ষর", "At least 8 characters")}</li><li data-r="match">${T("দুটি পাসওয়ার্ড মিলেছে", "Both passwords match")}</li></ul>
      ${msgBox()}<button class="btn btn-orange rs-go" type="submit" ${st.busy ? "disabled" : ""}>${T("পাসওয়ার্ড সংরক্ষণ করুন", "Save new password")}</button></form>`;
    else if (st.mode === "done") h = `<div class="ac-card ac-center rs-card rs-ok">${head("✅", st.done === "confirm" ? T("ইমেইল নিশ্চিত হয়েছে", "Email confirmed") : T("পাসওয়ার্ড বদলানো হয়েছে", "Password updated"),
      st.done === "confirm" ? T("আপনার অ্যাকাউন্ট চালু হয়েছে — আপনি এখন লগইন করা আছেন।", "Your account is active — you are now logged in.") : T("আপনি এখন লগইন করা আছেন। নতুন পাসওয়ার্ড দিয়ে যেকোনো সময় লগইন করতে পারবেন।", "You are now logged in. Use the new password next time you log in."))}
      <p><a class="btn btn-orange" href="/account">${T("আমার অ্যাকাউন্টে যান", "Go to my account")}</a> <a class="btn btn-outline" href="/">${T("হোম", "Home")}</a></p></div>`;
    else {   // "request": ask for a new link (expired / no link) and "code" fallback
      const expired = st.mode === "expired";
      h = `<div class="ac-card rs-card">${head(expired ? "⌛" : "✉️", expired ? T("লিংকটি আর কাজ করছে না", "This link no longer works") : T("পাসওয়ার্ড ভুলে গেছেন?", "Forgot your password?"),
        expired ? T("রিসেট লিংক একবারই ব্যবহার করা যায় এবং কিছুক্ষণ পরে মেয়াদ শেষ হয়। (কিছু ইমেইল অ্যাপ লিংক আগেই খুলে ফেলে।) নিচে নতুন লিংক নিন।", "A reset link can be used once and expires after a while (some e-mail apps open links before you do). Get a fresh one below.") : T("আপনার ইমেইল লিখুন — আমরা একটি রিসেট লিংক পাঠাব।", "Enter your e-mail and we will send you a reset link."))}
        <form id="rs-req" novalidate><div class="ac-fld"><label for="rs-email">${T("ইমেইল", "E-mail")}</label><input id="rs-email" type="email" autocomplete="email" inputmode="email" value="${esc(st.email)}" required></div>
        ${msgBox()}<button class="btn btn-orange rs-go" type="submit" ${st.busy || st.cool > 0 ? "disabled" : ""}>${st.cool > 0 ? T(`আবার পাঠাতে ${U().bnDigits(st.cool)} সেকেন্ড`, `Send again in ${st.cool}s`) : T("রিসেট লিংক পাঠান", "Send reset link")}</button></form>
        <details class="rs-code" ${st.mode === "code" ? "open" : ""}><summary>${T("লিংক কাজ করছে না? ইমেইলের ৬ অঙ্কের কোড দিন", "Link not working? Enter the 6-digit code from the e-mail")}</summary>
          <form id="rs-codeform" novalidate><div class="ac-fld"><label for="rs-code">${T("৬ অঙ্কের কোড", "6-digit code")}</label><input id="rs-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></div>${pwField("rs-cp", T("নতুন পাসওয়ার্ড", "New password"), "new-password")}
          <button class="btn btn-outline" type="submit" ${st.busy ? "disabled" : ""}>${T("কোড দিয়ে পাসওয়ার্ড বদলান", "Change password with code")}</button></form></details>
        <p class="muted rs-hint">${T("ইনবক্সে না পেলে স্প্যাম/প্রমোশন ফোল্ডার দেখুন। এরপরও না এলে ", "Not in your inbox? Check spam/promotions. Still nothing? Write to ")}<a href="mailto:hello@voiceofstartup.bd">hello@voiceofstartup.bd</a></p></div>`;
    }
    root.innerHTML = h;
    if (st.mode === "form") { const f = $("#rs-p1"); if (f) f.focus(); rules(); }
  }
  const setMsg = (m, k) => { st.msg = m; st.kind = k || ""; const el = $("#rs-msg"); if (el) { el.textContent = m; el.className = "ac-msg " + (k || ""); } };

  function rules() {
    const a = ($("#rs-p1") || {}).value || "", b = ($("#rs-p2") || {}).value || "";
    const set = (r, ok) => { const li = $(`[data-r="${r}"]`); if (li) li.classList.toggle("ok", ok); };
    set("len", a.length >= 8); set("match", a.length > 0 && a === b);
  }

  /* ---------- actions ---------- */
  async function savePassword(pw) {
    const c = await client();
    const { data: s } = await c.auth.getSession();
    if (!s || !s.session) throw new Error("session missing");
    const { error } = await c.auth.updateUser({ password: pw });
    if (error) throw error;
  }
  async function onSubmitForm(e) {
    e.preventDefault();
    const a = $("#rs-p1").value, b = $("#rs-p2").value;
    if (a.length < 8) return setMsg(T("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "The password must be at least 8 characters."), "err");
    if (a !== b) return setMsg(T("দুটি পাসওয়ার্ড মিলছে না।", "The two passwords do not match."), "err");
    st.busy = true; $(".rs-go").disabled = true; setMsg(T("সংরক্ষণ হচ্ছে…", "Saving…"));
    try { await savePassword(a); st.busy = false; st.mode = "done"; st.done = "reset"; draw(); try { history.replaceState(null, "", location.pathname); } catch (x) {} }
    catch (er) { st.busy = false; const gone = /session|expired|jwt/i.test(String(er && er.message)); if (gone) { st.mode = "expired"; draw(); } else { draw(); setMsg(friendly(er), "err"); } }
  }
  async function sendLink(email) {
    const c = await client();
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/reset-password" });
    if (error) throw error;
  }
  async function onRequest(e) {
    e.preventDefault();
    const email = ($("#rs-email").value || "").trim().toLowerCase(); st.email = email;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg(T("সঠিক ইমেইল ঠিকানা দিন।", "Please enter a valid e-mail address."), "err");
    st.busy = true; $(".rs-go").disabled = true; setMsg(T("পাঠানো হচ্ছে…", "Sending…"));
    try {
      await sendLink(email); st.busy = false; st.cool = 60; draw();
      setMsg(T("রিসেট লিংক পাঠানো হয়েছে — ইনবক্স (ও স্প্যাম) দেখুন। লিংকের বদলে কোড এলে নিচের ঘরে দিন।", "Reset link sent — check your inbox (and spam). If the e-mail shows a code instead, enter it below."), "ok");
      const t = setInterval(() => { st.cool--; if (st.cool <= 0 || !document.getElementById("rs-req")) { clearInterval(t); st.cool = 0; if (document.getElementById("rs-req")) { const keep = [st.msg, st.kind]; draw(); setMsg(keep[0], keep[1]); } } else { const b = $(".rs-go"); if (b) b.textContent = T(`আবার পাঠাতে ${U().bnDigits(st.cool)} সেকেন্ড`, `Send again in ${st.cool}s`); } }, 1000);
    } catch (er) { st.busy = false; draw(); setMsg(friendly(er), "err"); }
  }
  async function onCode(e) {
    e.preventDefault();
    const email = ($("#rs-email").value || "").trim().toLowerCase(), code = ($("#rs-code").value || "").replace(/\D/g, ""), pw = $("#rs-cp").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg(T("উপরে আপনার ইমেইল ঠিকানা লিখুন।", "Enter your e-mail address above."), "err");
    if (code.length < 6) return setMsg(T("ইমেইলে পাওয়া ৬ অঙ্কের কোড দিন।", "Enter the 6-digit code from the e-mail."), "err");
    if (pw.length < 8) return setMsg(T("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "The password must be at least 8 characters."), "err");
    st.busy = true; setMsg(T("যাচাই হচ্ছে…", "Verifying…"));
    try {
      const c = await client();
      const v = await c.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (v.error) throw v.error;
      await savePassword(pw); st.busy = false; st.mode = "done"; st.done = "reset"; draw();
    } catch (er) { st.busy = false; st.mode = "code"; st.email = email; draw(); setMsg(friendly(er), "err"); }
  }

  /* ---------- start ---------- */
  async function boot() {
    try {
      if (ERR_CODE || /error=/.test(RAW) && ERR_DESC) { st.mode = "expired"; return draw(); }
      const c = await client();
      if (TOKEN_HASH && TYPE) {                                   // safe e-mail-template format
        const { error } = await c.auth.verifyOtp({ token_hash: TOKEN_HASH, type: TYPE === "signup" ? "signup" : TYPE });
        if (error) { st.mode = "expired"; return draw(); }
        try { history.replaceState(null, "", location.pathname); } catch (x) {}
        if (TYPE === "recovery") { st.mode = "form"; return draw(); }
        st.mode = "done"; st.done = "confirm"; return draw();
      }
      if (/access_token=/.test(RAW)) {                            // Supabase default link — the library has read the hash for us
        let s = null;
        for (let i = 0; i < 12 && !s; i++) { const r = await c.auth.getSession(); s = r.data && r.data.session; if (!s) await new Promise((r2) => setTimeout(r2, 250)); }
        if (!s) { st.mode = "expired"; return draw(); }
        try { history.replaceState(null, "", location.pathname); } catch (x) {}
        if (TYPE === "recovery" || !CONFIRM) { st.mode = "form"; return draw(); }
        st.mode = "done"; st.done = "confirm"; return draw();
      }
      st.mode = "request"; draw();
    } catch (er) { st.mode = "request"; draw(); setMsg(friendly(er), "err"); }
  }

  root.addEventListener("submit", (e) => { if (e.target.id === "rs-form") onSubmitForm(e); else if (e.target.id === "rs-req") onRequest(e); else if (e.target.id === "rs-codeform") onCode(e); });
  root.addEventListener("input", (e) => { if (e.target.id === "rs-p1" || e.target.id === "rs-p2") rules(); });
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-eye]"); if (b) { const i = document.getElementById(b.dataset.eye); if (i) { i.type = i.type === "password" ? "text" : "password"; } } });
  const ready = () => { if (window.VOSB_UI && window.VOSB_AUTH) { draw(); boot(); U().onRender(() => { if (st.mode !== "checking") { const keep = [st.msg, st.kind]; draw(); if (keep[0]) setMsg(keep[0], keep[1]); } }); } else setTimeout(ready, 60); };
  ready();
})();
