/* Voice of Startup Bangladesh — "My account" page (profile, my companies, security, delete account)
   + small helpers shared with js/apply.js (window.VOSB_AC).
   Everything a person may do is enforced by the database (row-level security + checked functions); this file is only the screen. */
(function () {
  "use strict";
  const U = () => window.VOSB_UI;
  const A = () => window.VOSB_AUTH;
  const T = (bn, en) => U().T(bn, en);
  const esc = (s) => U().esc(s == null ? "" : s);
  const CFG = () => (window.VOSB || {}).companies || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pickL = (o) => (o ? (U().lang === "bn" ? o.bn : o.en) || o.en : "");

  /* ---------- shared helpers ---------- */
  const ERR = [
    [/already been used/i, "এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে।", "This Transaction ID has already been used."],
    [/Enter the Transaction ID/i, "পেমেন্টের SMS-এ যেমন আছে হুবহু ট্রানজেকশন আইডি লিখুন (শুধু ইংরেজি অক্ষর ও সংখ্যা)।", "Enter the Transaction ID exactly as in your payment SMS (letters and numbers only)."],
    [/mobile number/i, "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter a valid mobile number (01XXXXXXXXX)."],
    [/already recorded/i, "এই আবেদনের পেমেন্ট ইতিমধ্যে জমা দেওয়া আছে।", "A payment for this application is already recorded."],
    [/not available yet/i, "এই পেমেন্ট পদ্ধতি এখনও চালু হয়নি।", "This payment method is not available yet."],
    [/Too many|too fast/i, "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।", "Too many attempts. Please try again in a little while."],
    [/Please sign in|JWT|expired|not authenticated/i, "সেশন শেষ হয়ে গেছে — আবার লগইন করুন।", "Your session has expired — please log in again."],
    [/under review/i, "আবেদনটি এখন রিভিউতে আছে, তাই এখন সম্পাদনা করা যাবে না।", "This application is under review and cannot be edited right now."],
    [/listing is closed/i, "এই লিস্টিংটি বন্ধ আছে। অনুগ্রহ করে VOSB-এর সাথে যোগাযোগ করুন।", "This listing is closed. Please contact VOSB."],
    [/maximum number/i, "আপনি সর্বোচ্চ সংখ্যক কোম্পানি আবেদন করে ফেলেছেন।", "You have reached the maximum number of company applications."],
    [/Website must/i, "ওয়েবসাইটের লিংক http:// বা https:// দিয়ে শুরু হতে হবে।", "The website link must start with http:// or https://."],
    [/Documents can only/i, "ডকুমেন্ট শুধু জমা দেওয়ার আগে বা পরিবর্তন চাওয়া হলে বদলানো যায়।", "Documents can only be changed before submitting, or when changes are requested."],
    [/up to 12/i, "সর্বোচ্চ ১২টি ডকুমেন্ট যুক্ত করা যায়।", "You can attach up to 12 documents."],
    [/Please enter your name/i, "আপনার নাম লিখুন।", "Please enter your name."],
    [/valid Bangladesh mobile/i, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter a valid Bangladesh mobile number (01XXXXXXXXX)."],
    [/already submitted/i, "এই আবেদন আগেই জমা দেওয়া হয়েছে।", "This application was already submitted."],
    [/Payment is not needed/i, "এই আবেদনে এখন পেমেন্ট দরকার নেই।", "Payment is not needed for this application."],
    [/Not allowed/i, "এই কাজের অনুমতি নেই।", "You are not allowed to do this."],
    [/password.*(weak|short|at least)|at least 8/i, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের ও শক্ত হতে হবে।", "Use a stronger password (at least 8 characters)."],
    [/same password|different from the old/i, "নতুন পাসওয়ার্ড আগেরটির থেকে আলাদা হতে হবে।", "The new password must be different from the old one."],
    [/Failed to fetch|NetworkError|network/i, "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your internet connection and try again."],
  ];
  function friendly(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    for (const [re, bn, en] of ERR) if (re.test(m)) return T(bn, en);
    return m || T("কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।", "Something went wrong. Please try again.");
  }
  async function sb() { return A().client(); }
  async function rpc(name, args) {
    const { data, error } = await A().rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  const toast = (msg, kind) => { try { A().toast(msg, kind); } catch (e) {} };
  const one = (v) => (Array.isArray(v) ? v[0] : v) || null;
  const byNew = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));

  function whenReady(fn) {
    let n = 0;
    (function w() { if (window.VOSB_UI && window.VOSB_AUTH) return fn(); if (++n > 120) return fn(); setTimeout(w, 50); })();
  }
  function dialog(html) {
    const m = document.createElement("div");
    m.className = "ac-modal";
    m.innerHTML = `<div class="ac-dlg" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(m); document.body.classList.add("au-lock");
    const prev = document.activeElement;
    const key = (e) => { if (e.key === "Escape") close(); };
    const close = () => { m.remove(); document.body.classList.remove("au-lock"); document.removeEventListener("keydown", key); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    document.addEventListener("keydown", key);
    m.addEventListener("mousedown", (e) => { if (e.target === m) close(); });
    const f = m.querySelector("select,input,textarea,button"); if (f) f.focus();
    return { el: m, close };
  }
  const initialOf = (n) => (String(n || "?").trim()[0] || "?").toUpperCase();
  const logoBox = (url, name, cls) => url ? `<img class="${cls || "ac-logo"}" src="${esc(U().safeHref(url))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls || "ac-logo"} ph">${esc(initialOf(name))}</span>`;
  const label = (list, id) => { const o = (list || []).find((x) => x.id === id); return o ? pickL(o) : id || "—"; };
  window.VOSB_AC = { U, A, T, esc, CFG, $, $$, pickL, friendly, sb, rpc, toast, one, byNew, whenReady, dialog, initialOf, logoBox, label };

  /* ---------- status wording ---------- */
  const STATUS = {
    draft: { cls: "draft", bn: "ড্রাফট", en: "Draft", dbn: "আবেদন শেষ করে জমা দিন।", den: "Finish your application and submit it." },
    submitted: { cls: "wait", bn: "জমা হয়েছে", en: "Submitted", dbn: "VOSB টিম শীঘ্রই রিভিউ শুরু করবে।", den: "The VOSB team will start the review soon." },
    in_review: { cls: "wait", bn: "রিভিউ চলছে", en: "Under review", dbn: "আমরা আপনার ডকুমেন্ট যাচাই করছি।", den: "We are checking your documents." },
    changes_requested: { cls: "warn", bn: "পরিবর্তন দরকার", en: "Changes needed", dbn: "নিচের নোট দেখে তথ্য ঠিক করে আবার জমা দিন।", den: "Please fix what the note asks for and submit again." },
    rejected: { cls: "bad", bn: "অনুমোদন হয়নি", en: "Not approved", dbn: "এই আবেদনটি অনুমোদন করা যায়নি।", den: "This application could not be approved." },
    published: { cls: "ok", bn: "লাইভ", en: "Live", dbn: "আপনার কোম্পানি VOSB-তে প্রকাশিত আছে।", den: "Your company is live on VOSB." },
    suspended: { cls: "bad", bn: "স্থগিত", en: "Paused", dbn: "VOSB লিস্টিংটি সাময়িক স্থগিত করেছে।", den: "VOSB has paused this listing." },
  };
  const PAYST = {
    none: { cls: "draft", bn: "পেমেন্ট বাকি", en: "Payment due" },
    pending: { cls: "wait", bn: "পেমেন্ট যাচাই চলছে", en: "Payment checking" },
    verified: { cls: "ok", bn: "পেমেন্ট সম্পন্ন ✓", en: "Paid ✓" },
    rejected: { cls: "bad", bn: "পেমেন্ট গৃহীত হয়নি", en: "Payment not accepted" },
  };
  window.VOSB_AC.STATUS = STATUS; window.VOSB_AC.PAYST = PAYST;
  const pill = (o) => `<span class="ac-pill ${o.cls}">${esc(pickL(o))}</span>`;
  window.VOSB_AC.pill = pill;
  const latestPay = (arr) => [].concat(arr || []).sort(byNew)[0] || null;
  window.VOSB_AC.latestPay = latestPay;

  /* ================= ACCOUNT PAGE ================= */
  function accountPage() {
    const root = $("#app");
    if (!root) return;
    const st = { tab: "profile", prof: null, profErr: false, cos: null, cosErr: "", ints: {}, rendered: "" };
    const TABS = [["profile", "👤", "প্রোফাইল", "Profile"], ["companies", "🏢", "আমার কোম্পানি", "My companies"], ["security", "🔒", "নিরাপত্তা", "Security"]];
    const hashTab = () => { const h = (location.hash || "").slice(1); return TABS.some((t) => t[0] === h) ? h : "profile"; };

    function loginCard() {
      root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">🔐</div>
        <h2>${T("আপনার অ্যাকাউন্টে লগইন করুন", "Log in to your account")}</h2>
        <p class="muted">${T("প্রোফাইল, কোম্পানি লিস্টিং ও নিরাপত্তা দেখতে লগইন বা সাইন আপ করুন।", "Log in or sign up to see your profile, company listings and security settings.")}</p>
        <p><button type="button" class="btn btn-orange" data-act="login">${T("লগইন / সাইন আপ", "Login / Sign up")}</button></p></div>`;
    }

    function shell() {
      const u = A().user() || {}, p = st.prof || {};
      const nm = p.full_name || u.name || u.email;
      const av = u.avatar ? `<img class="ac-av lg" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="ac-av lg">${esc(initialOf(nm))}</span>`;
      root.innerHTML = `<div class="ac-me">${av}<div class="ac-me-tx"><h2>${esc(nm)}</h2><p class="muted">${esc(u.email)}</p></div>
          <a class="btn btn-orange ac-sm" href="/list-your-company">＋ ${T("কোম্পানি লিস্ট করুন", "List a company")}</a></div>
        <nav class="ac-tabs" role="tablist" aria-label="${T("অ্যাকাউন্ট", "Account")}">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t[0]}" aria-selected="${st.tab === t[0]}"><span aria-hidden="true">${t[1]}</span> ${T(t[2], t[3])}</button>`).join("")}</nav>
        <div class="ac-panel" id="ac-panel"></div>`;
      panel();
    }

    function panel() {
      const el = $("#ac-panel"); if (!el) return;
      $$("[data-tab]", root).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === st.tab)));
      if (st.tab === "profile") profileView(el);
      else if (st.tab === "companies") companiesView(el);
      else securityView(el);
    }

    /* ---- profile ---- */
    async function loadProfile(force) {
      try { st.prof = await A().profile(force); st.profErr = !st.prof; } catch (e) { st.profErr = true; }
    }
    function profileView(el) {
      if (st.profErr) { el.innerHTML = `<div class="ac-card ac-center"><p>${T("প্রোফাইল লোড করা যায়নি।", "Could not load your profile.")}</p><button class="btn btn-outline ac-sm" data-act="retry-profile">${T("আবার চেষ্টা করুন", "Try again")}</button></div>`; return; }
      if (!st.prof) { el.innerHTML = `<div class="ac-skel" aria-hidden="true"></div>`; return; }
      const p = st.prof, types = [["reader", "পাঠক", "Reader"], ["founder", "প্রতিষ্ঠাতা", "Founder"], ["investor", "বিনিয়োগকারী", "Investor"], ["other", "অন্যান্য", "Other"]];
      const prov = p.provider === "google" ? "Google" : T("ইমেইল ও পাসওয়ার্ড", "Email & password");
      el.innerHTML = `<form class="ac-card ac-form" data-form="profile" novalidate>
        <h3>${T("আপনার প্রোফাইল", "Your profile")}</h3>
        <div class="ac-grid2">
          <div class="ac-fld"><label for="p-email">${T("ইমেইল", "Email")}</label><input id="p-email" value="${esc(p.email || "")}" readonly><small class="ac-help">${T("লগইন পদ্ধতি", "Signed in with")}: ${esc(prov)}</small></div>
          <div class="ac-fld"><label for="p-name">${T("পুরো নাম", "Full name")} <i class="req">*</i></label><input id="p-name" name="full_name" maxlength="120" autocomplete="name" value="${esc(p.full_name || "")}" required></div>
          <div class="ac-fld"><label for="p-phone">${T("মোবাইল নম্বর", "Mobile number")}</label><input id="p-phone" name="phone" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="01XXXXXXXXX" value="${esc(p.phone || "")}"><small class="ac-help">${T("ঐচ্ছিক — শুধু আপনার অ্যাকাউন্টের জন্য।", "Optional — only for your account.")}</small></div>
          <div class="ac-fld"><label for="p-loc">${T("এলাকা / শহর", "Location")}</label><input id="p-loc" name="location" maxlength="80" placeholder="${T("যেমন: ঢাকা", "e.g. Dhaka")}" value="${esc(p.location || "")}"></div>
          <div class="ac-fld ac-span"><label for="p-head">${T("পরিচিতি (এক লাইন)", "Headline")}</label><input id="p-head" name="headline" maxlength="120" placeholder="${T("যেমন: ফাউন্ডার, ABC টেক", "e.g. Founder at ABC Tech")}" value="${esc(p.headline || "")}"></div>
          <div class="ac-fld ac-span"><label for="p-bio">${T("আপনার সম্পর্কে", "About you")}</label><textarea id="p-bio" name="bio" rows="3" maxlength="600">${esc(p.bio || "")}</textarea><small class="ac-cnt" data-cnt="bio">${(p.bio || "").length}/600</small></div>
          <fieldset class="ac-fld ac-span ac-chips"><legend>${T("আপনি কে?", "I am a…")}</legend>${types.map((t) => `<label class="ac-chip"><input type="radio" name="user_type" value="${t[0]}"${p.user_type === t[0] ? " checked" : ""}><span>${T(t[1], t[2])}</span></label>`).join("")}</fieldset>
        </div>
        <div class="ac-msg" role="alert" aria-live="polite"></div>
        <div class="ac-acts"><button class="btn btn-orange" type="submit">${T("পরিবর্তন সংরক্ষণ", "Save changes")}</button></div></form>`;
    }
    async function saveProfile(form) {
      const f = new FormData(form), msg = $(".ac-msg", form), btn = $("button[type=submit]", form);
      const name = String(f.get("full_name") || "").trim(), phone = String(f.get("phone") || "").trim().replace(/[\s-]/g, "");
      const say = (t, k) => { msg.className = "ac-msg " + (k || ""); msg.textContent = t; };
      if (name.length < 2) return say(T("আপনার নাম লিখুন।", "Please enter your name."), "err");
      if (phone && !/^(\+?88)?01[3-9]\d{8}$/.test(phone)) return say(T("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter a valid mobile number (01XXXXXXXXX)."), "err");
      btn.disabled = true; say("…");
      try {
        st.prof = await rpc("update_my_profile", { p: { full_name: name, phone: phone || null, headline: f.get("headline") || null, bio: f.get("bio") || null, location: f.get("location") || null, user_type: f.get("user_type") || "reader" } });
        try { const c = await sb(); await c.auth.updateUser({ data: { full_name: name } }); } catch (e) {}
        say(T("সংরক্ষণ হয়েছে ✓", "Saved ✓"), "ok"); toast(T("প্রোফাইল সংরক্ষণ হয়েছে", "Profile saved"), "ok");
        const h = $(".ac-me-tx h2"); if (h) h.textContent = name;
      } catch (e) { say(friendly(e), "err"); }
      btn.disabled = false;
    }

    /* ---- my companies ---- */
    async function loadCompanies() {
      st.cosErr = "";
      try {
        const c = await sb(), uid = (A().user() || {}).id;
        const { data, error } = await c.from("companies")
          .select("id,slug,status,name,tagline,logo_url,category,stage,created_at,updated_at,published_at,rating_avg,rating_count,views,interest_count,company_private!inner(owner_id,review_note),listing_payments(id,status,invoice_no,trx_id,note,created_at),company_documents(id,doc_type,status)")
          .eq("company_private.owner_id", uid).order("created_at", { ascending: false });
        if (error) throw error;
        st.cos = data || [];
      } catch (e) { st.cos = null; st.cosErr = friendly(e); }
    }
    function companiesView(el) {
      if (st.cosErr) { el.innerHTML = `<div class="ac-card ac-center"><p>${esc(st.cosErr)}</p><button class="btn btn-outline ac-sm" data-act="retry-cos">${T("আবার চেষ্টা করুন", "Try again")}</button></div>`; return; }
      if (!st.cos) { el.innerHTML = `<div class="ac-skel" aria-hidden="true"></div><div class="ac-skel" aria-hidden="true"></div>`; return; }
      if (!st.cos.length) {
        el.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">🏢</div><h3>${T("এখনও কোনো কোম্পানি লিস্ট করেননি", "You have not listed a company yet")}</h3>
          <p class="muted">${T("একবারের ফি দিয়ে আপনার কোম্পানি চিরদিনের জন্য VOSB-তে লিস্ট করুন — রিভিউ, মার্কেটিং ও বিনিয়োগকারীর নজর পান।", "Pay a one-time fee to list your company on VOSB for good — get reviews, exposure and investor attention.")}</p>
          <p><a class="btn btn-orange" href="/list-your-company">${T("কোম্পানি লিস্ট করুন", "List your company")}</a></p></div>`;
        return;
      }
      el.innerHTML = `<div class="ac-head"><h3>${T("আমার কোম্পানি", "My companies")} <span class="ac-count">${U().bnDigits(st.cos.length)}</span></h3><a class="btn btn-orange ac-sm" href="/list-your-company">＋ ${T("নতুন কোম্পানি লিস্ট করুন", "List a new company")}</a></div>
        <div class="ac-cos">${st.cos.map(coCard).join("")}</div>`;
    }
    function coCard(c) {
      const S = STATUS[c.status] || STATUS.draft, pr = latestPay(c.listing_payments), priv = one(c.company_private) || {};
      const payKey = pr ? pr.status : "none", docs = (c.company_documents || []);
      const edit = c.status === "draft" || c.status === "changes_requested";
      const note = priv.review_note && (c.status === "changes_requested" || c.status === "rejected" || c.status === "suspended") ? `<div class="ac-note ${c.status === "changes_requested" ? "warn" : "bad"}"><b>${T("VOSB-এর নোট", "Note from VOSB")}</b><p>${esc(priv.review_note)}</p></div>` : "";
      const ints = st.ints[c.id];
      const stats = c.status === "published" ? `<div class="ac-stats"><span>★ ${esc(Number(c.rating_avg || 0).toFixed(1))} <small>(${U().bnDigits(c.rating_count || 0)})</small></span><span>👁 ${U().bnDigits(c.views || 0)}</span><span>💼 ${U().bnDigits(c.interest_count || 0)}</span></div>` : "";
      return `<article class="ac-co" data-co="${esc(c.id)}">
        <div class="ac-co-top">${logoBox(c.logo_url, c.name)}<div class="ac-co-tx"><h4>${esc(c.name || T("নামহীন ড্রাফট", "Untitled draft"))}</h4><p class="muted">${esc(c.tagline || label(CFG().industries, c.category) || "")}</p></div></div>
        <div class="ac-pills">${pill(S)}${c.status === "draft" || c.status === "changes_requested" || pr ? pill(PAYST[payKey]) : ""}${docs.length ? `<span class="ac-pill draft">📎 ${U().bnDigits(docs.length)}</span>` : ""}</div>
        <p class="ac-desc">${T(S.dbn, S.den)}</p>${note}${stats}
        <div class="ac-btns">
          ${edit ? `<a class="btn btn-orange ac-sm" href="/apply?c=${esc(c.id)}">${T("আবেদন চালিয়ে যান", "Continue application")} →</a>` : ""}
          ${c.status === "submitted" || c.status === "in_review" || c.status === "rejected" || c.status === "suspended" ? `<a class="btn btn-outline ac-sm" href="/apply?c=${esc(c.id)}">${T("আবেদন দেখুন", "View application")}</a>` : ""}
          ${c.status === "published" ? `<a class="btn btn-green ac-sm" href="/company/${esc(c.slug)}">${T("পাবলিক পেজ দেখুন", "View public page")}</a><a class="btn btn-outline ac-sm" href="/apply?c=${esc(c.id)}">${T("পাবলিক প্রোফাইল এডিট", "Edit public profile")}</a><button type="button" class="btn btn-outline ac-sm" data-act="ints" data-id="${esc(c.id)}">💼 ${T("বিনিয়োগ আগ্রহ", "Investor interest")} (${U().bnDigits(c.interest_count || 0)})</button>` : ""}
        </div>
        ${ints ? `<div class="ac-ints">${ints === "loading" ? `<p class="muted">…</p>` : ints === "error" ? `<p class="ac-msg err">${T("লোড করা যায়নি।", "Could not load.")}</p>` : intsList(ints)}</div>` : ""}
      </article>`;
    }
    const inv = { individual: ["ব্যক্তিগত", "Individual"], angel: ["এঞ্জেল", "Angel"], vc: ["ভিসি", "VC"], institution: ["প্রতিষ্ঠান", "Institution"], other: ["অন্যান্য", "Other"] };
    function intsList(list) {
      if (!list.length) return `<p class="muted">${T("এখনও কোনো বিনিয়োগকারী আগ্রহ জানাননি।", "No investor has shown interest yet.")}</p>`;
      return list.map((i) => `<div class="ac-int"><div class="ac-int-h"><b>${esc(i.investor_name || T("বিনিয়োগকারী", "Investor"))}</b><span class="ac-pill draft">${esc(T((inv[i.investor_type] || inv.other)[0], (inv[i.investor_type] || inv.other)[1]))}</span><small class="muted">${U().formatDate(i.created_at)}</small></div>
        ${i.ticket_min || i.ticket_max ? `<p class="ac-int-t">💰 ${U().money(i.ticket_min)} – ${U().money(i.ticket_max)}</p>` : ""}<p>${esc(i.message)}</p>
        ${i.email || i.phone ? `<p class="ac-int-c">📇 ${i.email ? `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>` : ""} ${i.phone ? `<a href="tel:${esc(i.phone)}">${esc(i.phone)}</a>` : ""}</p>` : `<p class="muted"><small>${T("যোগাযোগের তথ্য শেয়ার করা হয়নি।", "Contact details were not shared.")}</small></p>`}</div>`).join("");
    }
    async function toggleInts(id) {
      if (st.ints[id]) { delete st.ints[id]; panel(); return; }
      st.ints[id] = "loading"; panel();
      try { st.ints[id] = (await rpc("my_company_interests", { p_company: id })) || []; } catch (e) { st.ints[id] = "error"; }
      panel();
    }

    /* ---- security + delete ---- */
    function securityView(el) {
      const email = !st.prof || st.prof.provider !== "google";
      el.innerHTML = `<div class="ac-card"><h3>${T("পাসওয়ার্ড", "Password")}</h3>
          ${email ? `<form class="ac-form" data-form="pw" novalidate><div class="ac-grid2">
            <div class="ac-fld"><label for="pw1">${T("নতুন পাসওয়ার্ড", "New password")}</label><input id="pw1" name="pw1" type="password" autocomplete="new-password" minlength="8" maxlength="72"></div>
            <div class="ac-fld"><label for="pw2">${T("আবার লিখুন", "Repeat the password")}</label><input id="pw2" name="pw2" type="password" autocomplete="new-password" minlength="8" maxlength="72"></div></div>
            <div class="ac-msg" role="alert" aria-live="polite"></div><div class="ac-acts"><button class="btn btn-orange" type="submit">${T("পাসওয়ার্ড বদলান", "Change password")}</button></div></form>`
            : `<p class="muted">${T("আপনি Google দিয়ে লগইন করেছেন — পাসওয়ার্ড আপনার Google অ্যাকাউন্টেই বদলাতে হবে।", "You signed in with Google — change your password in your Google account.")}</p>`}</div>
        <div class="ac-card"><h3>${T("লগআউট", "Log out")}</h3><p class="muted">${T("এই ডিভাইস থেকে বেরিয়ে যান।", "Sign out on this device.")}</p><button type="button" class="btn btn-outline" data-act="logout">${T("লগআউট করুন", "Log out")}</button></div>
        <div class="ac-card ac-danger"><h3>⚠️ ${T("ডেঞ্জার জোন", "Danger zone")}</h3>
          <p class="muted">${T("অ্যাকাউন্ট মুছে ফেললে আপনি আর লগইন করতে পারবেন না। আগে আমরা জানতে চাইব কেন চলে যাচ্ছেন।", "After you delete your account you can no longer log in. We will first ask why you are leaving.")}</p>
          <button type="button" class="btn ac-del" data-act="delete">${T("আমার অ্যাকাউন্ট মুছুন", "Delete my account")}</button></div>`;
    }
    async function changePw(form) {
      const f = new FormData(form), msg = $(".ac-msg", form), a = String(f.get("pw1") || ""), b = String(f.get("pw2") || "");
      const say = (t, k) => { msg.className = "ac-msg " + (k || ""); msg.textContent = t; };
      if (a.length < 8) return say(T("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "Password must be at least 8 characters."), "err");
      if (a !== b) return say(T("দুটি পাসওয়ার্ড মেলেনি।", "The two passwords do not match."), "err");
      const btn = $("button[type=submit]", form); btn.disabled = true; say("…");
      try { const c = await sb(); const { error } = await c.auth.updateUser({ password: a }); if (error) throw error; form.reset(); say(T("পাসওয়ার্ড বদলানো হয়েছে ✓", "Password updated ✓"), "ok"); }
      catch (e) { say(friendly(e), "err"); }
      btn.disabled = false;
    }

    function deleteDialog() {
      const reasons = CFG().deletionReasons || [{ id: "other", bn: "অন্য কারণ", en: "Other reason" }];
      const d = dialog(`<button type="button" class="ac-dlg-x" data-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button>
        <h2>${T("অ্যাকাউন্ট মুছে ফেলবেন?", "Delete your account?")}</h2>
        <p class="muted">${T("এটি ফেরানো যাবে না। মুছলে যা হবে:", "This cannot be undone. Here is exactly what happens:")}</p>
        <ul class="ac-bul"><li>${T("আপনার অ্যাকাউন্ট ও লগইন মুছে যাবে।", "Your account and login are removed.")}</li>
          <li>${T("আপনার রিভিউ ও কমেন্ট থাকবে, তবে লেখকের নাম হবে “Deleted user”।", "Your reviews and comments stay, shown as “Deleted user”.")}</li>
          <li>${T("আপনার কোম্পানি লিস্টিং VOSB-এর কাছে থাকবে।", "Your company listings stay with VOSB.")}</li>
          <li>${T("VOSB আপনার অ্যাকাউন্টের তথ্য, মুছে ফেলার কারণ ও কার্যক্রমের রেকর্ড অ্যাডমিন রেকর্ডে রাখে। পেমেন্টের রেকর্ড মুছে ফেলা হয় না।", "VOSB keeps a record of your account details, your reason and your activity for its admin records. Payment records are never deleted.")}</li></ul>
        <div class="ac-fld"><label for="d-reason">${T("কেন চলে যাচ্ছেন?", "Why are you leaving?")} <i class="req">*</i></label><select id="d-reason"><option value="">${T("— একটি কারণ বেছে নিন —", "— choose a reason —")}</option>${reasons.map((r) => `<option value="${esc(r.id)}">${esc(pickL(r))}</option>`).join("")}</select></div>
        <div class="ac-fld"><label for="d-detail">${T("আরও কিছু বলবেন?", "Anything else?")} <span class="muted" id="d-req"></span></label><textarea id="d-detail" rows="3" maxlength="1000"></textarea></div>
        <div class="ac-fld"><label for="d-type">${T("নিশ্চিত করতে <b>DELETE</b> লিখুন", "Type <b>DELETE</b> to confirm")}</label><input id="d-type" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
        <div class="ac-msg" role="alert" aria-live="polite"></div>
        <div class="ac-acts"><button type="button" class="btn btn-outline" data-x>${T("বাতিল", "Cancel")}</button><button type="button" class="btn ac-del" id="d-go" disabled>${T("স্থায়ীভাবে মুছুন", "Delete permanently")}</button></div>`);
      const el = d.el, sel = $("#d-reason", el), det = $("#d-detail", el), typ = $("#d-type", el), go = $("#d-go", el), msg = $(".ac-msg", el);
      const check = () => {
        const other = sel.value === "other";
        $("#d-req", el).textContent = other ? T("(আবশ্যক)", "(required)") : T("(ঐচ্ছিক)", "(optional)");
        go.disabled = !(sel.value && typ.value.trim() === "DELETE" && (!other || det.value.trim().length >= 3));
      };
      [sel, det, typ].forEach((x) => x.addEventListener("input", check)); sel.addEventListener("change", check); check();
      el.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) d.close(); });
      go.addEventListener("click", async () => {
        go.disabled = true; msg.className = "ac-msg"; msg.textContent = "…";
        try {
          await rpc("delete_my_account", { p_reason: sel.value, p_detail: det.value.trim() || null });
          try { const c = await sb(); await c.auth.signOut({ scope: "local" }); } catch (e) { try { localStorage.removeItem("vosb-user-auth"); } catch (e2) {} }
          $(".ac-dlg", el).innerHTML = `<div class="ac-center"><div class="ac-big" aria-hidden="true">👋</div><h2>${T("আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে", "Your account has been deleted")}</h2><p class="muted">${T("ধন্যবাদ আমাদের সাথে থাকার জন্য। হোম পেজে নিয়ে যাচ্ছি…", "Thank you for being with us. Taking you to the home page…")}</p></div>`;
          setTimeout(() => { location.href = "/"; }, 2600);
        } catch (e) { msg.className = "ac-msg err"; msg.textContent = friendly(e); check(); }
      });
    }

    /* ---- wiring ---- */
    async function render(full) {
      st.rendered = U().lang;
      if (!A() || !A().isIn()) { loginCard(); return; }
      st.tab = hashTab();
      shell();
      if (st.tab === "profile" && !st.prof) { await loadProfile(); panel(); }
      if (full || st.tab === "companies") { if (st.cos === null && !st.cosErr) { await loadCompanies(); panel(); } }
    }
    root.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
      if (t.dataset.tab) { st.tab = t.dataset.tab; history.replaceState(null, "", "#" + st.tab); panel(); if (st.tab === "companies" && st.cos === null && !st.cosErr) { await loadCompanies(); panel(); } if (st.tab === "profile" && !st.prof) { await loadProfile(); panel(); } return; }
      const act = t.dataset.act;
      if (act === "login") { A().requireLogin("প্রোফাইল ও কোম্পানি দেখতে লগইন করুন।", "Log in to see your profile and companies."); }
      else if (act === "retry-profile") { st.profErr = false; st.prof = null; panel(); await loadProfile(true); panel(); }
      else if (act === "retry-cos") { st.cosErr = ""; st.cos = null; panel(); await loadCompanies(); panel(); }
      else if (act === "ints") toggleInts(t.dataset.id);
      else if (act === "logout") A().signOut();
      else if (act === "delete") deleteDialog();
    });
    root.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-form]"); if (!f) return;
      e.preventDefault();
      if (f.dataset.form === "profile") saveProfile(f); else if (f.dataset.form === "pw") changePw(f);
    });
    root.addEventListener("input", (e) => {
      const c = e.target.closest("textarea[name=bio]"); if (c) { const n = $("[data-cnt=bio]", root); if (n) n.textContent = c.value.length + "/600"; }
    });
    window.addEventListener("hashchange", () => { if (A() && A().isIn()) { st.tab = hashTab(); panel(); if (st.tab === "companies" && st.cos === null && !st.cosErr) loadCompanies().then(panel); } });
    U().onRender(() => { if (st.rendered !== U().lang) render(); });
    A().onChange(() => { st.prof = null; st.cos = null; st.cosErr = ""; render(true); });
    render(true);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "account") whenReady(accountPage);
  });
})();
