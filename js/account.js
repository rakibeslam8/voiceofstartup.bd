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
    [/not taking investor interest/i, "এই কোম্পানি এখন বিনিয়োগকারীর আগ্রহ নিচ্ছে না।", "This company is not taking investor interest right now."],
    [/must first show interest/i, "বিনিয়োগকারীকে আগে এই কোম্পানিতে আগ্রহ জানাতে হবে।", "The investor must first show interest in this company."],
    [/valuation update can be requested/i, "বিনিয়োগ দুই পক্ষ নিশ্চিত করার পর ভ্যালুয়েশন আপডেটের অনুরোধ করা যায়।", "A valuation update can be requested after an investment is confirmed by both you and the investor."],
    [/already have an update/i, "আপনার একটি আপডেট অনুরোধ আগেই রিভিউতে আছে।", "You already have an update waiting for review."],
    [/explain why the valuation/i, "ভ্যালুয়েশন কেন বদলাবে তা লিখুন।", "Please explain why the valuation should change."],
    [/Enter the amount/i, "বিনিয়োগের পরিমাণ লিখুন।", "Enter the amount invested."],
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
  const nd = (n) => U().bnDigits(String(n));
  const moneyShort = (n) => { n = Number(n); if (!isFinite(n)) return "—"; const a = Math.abs(n), f = (x) => nd(String(+x.toFixed(2)));
    if (a >= 1e7) return "৳" + f(n / 1e7) + T(" কোটি", " cr"); if (a >= 1e5) return "৳" + f(n / 1e5) + T(" লাখ", " lakh"); return "৳" + nd(Math.round(n).toLocaleString("en-IN")); };
  function resizeImg(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); const r = Math.min(1, max / Math.min(img.width, img.height) * 1), sc = Math.min(1, max / Math.max(img.width, img.height)); const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => { if (b && b.type === "image/webp") res({ blob: b, ext: "webp" }); else cv.toBlob((j) => (j ? res({ blob: j, ext: "jpg" }) : rej(new Error("image"))), "image/jpeg", 0.88); }, "image/webp", 0.88); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(T("ছবিটি পড়া যায়নি।", "Could not read this image."))); };
      img.src = url;
    });
  }
  window.VOSB_AC = { U, A, T, esc, nd, moneyShort, resizeImg, CFG, $, $$, pickL, friendly, sb, rpc, toast, one, byNew, whenReady, dialog, initialOf, logoBox, label };

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
    const st = { tab: "profile", prof: null, profErr: false, cos: null, cosErr: "", ints: {}, ov: {}, val: {}, inv: null, invErr: "", rendered: "" };
    const TABS = [["profile", "👤", "প্রোফাইল", "Profile"], ["companies", "🏢", "আমার কোম্পানি", "My companies"], ["invest", "💼", "আমার বিনিয়োগ", "My investments"], ["security", "🔒", "নিরাপত্তা", "Security"]];
    /* each person sees the tabs they need: founders → companies, investors → investments, readers → neither (unless they already have some) */
    const tabsFor = () => {
      const c = (A().ctx && A().ctx()) || null, type = (st.prof && st.prof.user_type) || (c && c.type) || "";
      const known = !!(c || st.prof);
      const founder = !known || type === "founder" || (c && c.co) || (st.cos && st.cos.length > 0);
      const investor = !known || type === "investor" || (c && c.inv) || !!(st.inv && ((st.inv.interests || []).length || (st.inv.investments || []).length));
      return TABS.filter((t) => (t[0] === "companies" ? founder : t[0] === "invest" ? investor : true));
    };
    const tabsHtml = () => tabsFor().map((t) => `<button type="button" role="tab" data-tab="${t[0]}" aria-selected="${st.tab === t[0]}"><span aria-hidden="true">${t[1]}</span> ${T(t[2], t[3])}</button>`).join("");
    const refreshTabs = () => { const n = $(".ac-tabs", root); if (n) n.innerHTML = tabsHtml(); };
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
      const avu = (p.avatar_url && /^https:\/\//.test(p.avatar_url) ? p.avatar_url : "") || u.avatar;
      const av = avu ? `<img class="ac-av lg" src="${esc(avu)}" alt="" referrerpolicy="no-referrer">` : `<span class="ac-av lg">${esc(initialOf(nm))}</span>`;
      root.innerHTML = `<div class="ac-me">${av}<div class="ac-me-tx"><h2>${esc(nm)}</h2><p class="muted">${esc(u.email)}</p></div>
          ${tabsFor().some((t) => t[0] === "companies") ? `<a class="btn btn-orange ac-sm" href="/list-your-company">＋ ${T("কোম্পানি লিস্ট করুন", "List a company")}</a>` : `<a class="btn btn-outline ac-sm" href="/companies">${T("কোম্পানি দেখুন", "Browse companies")}</a>`}</div>
        <nav class="ac-tabs" role="tablist" aria-label="${T("অ্যাকাউন্ট", "Account")}">${tabsHtml()}</nav>
        <div class="ac-panel" id="ac-panel"></div>`;
      panel();
    }

    function panel() {
      const el = $("#ac-panel"); if (!el) return;
      $$("[data-tab]", root).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === st.tab)));
      if (st.tab === "profile") profileView(el);
      else if (st.tab === "companies") companiesView(el);
      else if (st.tab === "invest") investView(el);
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
      const avu = (p.avatar_url && /^https:\/\//.test(p.avatar_url) ? p.avatar_url : "") || (A().user() || {}).avatar || "";
      el.innerHTML = `<form class="ac-card ac-form" data-form="profile" novalidate>
        <h3>${T("আপনার প্রোফাইল", "Your profile")}</h3>
        <div class="ac-avrow"><div class="ac-avbox">${avu ? `<img src="${esc(avu)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(initialOf(p.full_name || p.email))}</span>`}</div>
          <div><b>${T("প্রোফাইল ছবি", "Profile photo")}</b><p class="muted">${T("কমেন্ট, রিভিউ ও আপনার প্রোফাইলে সব জায়গায় এই ছবি দেখা যাবে। PNG/JPG/WebP, সর্বোচ্চ ৫ MB।", "Shown on your comments, reviews and profile everywhere. PNG/JPG/WebP, up to 5 MB.")}</p>
          <div class="ac-acts"><label class="btn btn-outline ac-sm ap-file">${avu ? T("ছবি বদলান", "Change photo") : T("ছবি আপলোড", "Upload photo")}<input type="file" accept="image/png,image/jpeg,image/webp" data-avup hidden></label>${p.avatar_url ? `<button type="button" class="co-link bad" data-act="avrm">${T("সরান", "Remove")}</button>` : ""}</div><div class="ac-msg" id="av-msg" role="alert" aria-live="polite"></div></div></div>
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
        try { A().profile(true); } catch (e) {} refreshTabs();
      } catch (e) { say(friendly(e), "err"); }
      btn.disabled = false;
    }

    async function uploadAvatar(file) {
      const msg = $("#av-msg"), say = (t, k) => { if (msg) { msg.className = "ac-msg " + (k || ""); msg.textContent = t; } };
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return say(T("শুধু PNG, JPG বা WebP ছবি দিন।", "Please choose a PNG, JPG or WebP image."), "err");
      if (file.size > 5 * 1024 * 1024) return say(T("ছবি ৫ MB-এর কম হতে হবে।", "Image must be under 5 MB."), "err");
      say(T("আপলোড হচ্ছে…", "Uploading…"));
      try {
        const { blob, ext } = await resizeImg(file, 384), uid = (A().user() || {}).id, path = `${uid}/avatar-${Math.random().toString(36).slice(2, 10)}.${ext}`, c = await sb();
        const up = await c.storage.from("avatars").upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" }); if (up.error) throw up.error;
        const url = c.storage.from("avatars").getPublicUrl(path).data.publicUrl, old = st.prof && st.prof.avatar_url;
        st.prof = await rpc("update_my_profile", { p: { avatar_url: url } });
        A().setAvatar(url); try { const m = old && String(old).split("/object/public/avatars/")[1]; if (m) c.storage.from("avatars").remove([m]); } catch (e) {}
        shell(); toast(T("প্রোফাইল ছবি আপডেট হয়েছে ✓", "Profile photo updated ✓"), "ok");
      } catch (e) { say(friendly(e), "err"); }
    }
    async function removeAvatar() {
      try { const old = st.prof && st.prof.avatar_url; st.prof = await rpc("update_my_profile", { p: { avatar_url: null } }); A().setAvatar(""); try { const m = old && String(old).split("/object/public/avatars/")[1]; if (m) (await sb()).storage.from("avatars").remove([m]); } catch (e) {} shell(); }
      catch (e) { toast(friendly(e), "err"); }
    }

    /* ---- my companies ---- */
    async function loadCompanies() {
      st.cosErr = "";
      try {
        const c = await sb(), uid = (A().user() || {}).id;
        const { data, error } = await c.from("companies")
          .select("id,slug,status,name,tagline,logo_url,category,stage,created_at,updated_at,published_at,rating_avg,rating_count,views,interest_count,invest_open,registered,raised_amount,investor_count,vosb_valuation,vosb_val_low,vosb_val_high,vosb_confidence,valuation_date,company_private!inner(owner_id,review_note),listing_payments(id,status,invoice_no,trx_id,note,created_at),company_documents(id,doc_type,status)")
          .eq("company_private.owner_id", uid).order("created_at", { ascending: false });
        if (error) throw error;
        st.cos = data || [];
        try { st.dreq = (await rpc("my_deletion_requests")) || []; } catch (e) { st.dreq = st.dreq || []; }
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
      const ints = st.ints[c.id], vp = st.val[c.id];
      const stats = c.status === "published" ? `<div class="ac-stats"><span>★ ${esc(Number(c.rating_avg || 0).toFixed(1))} <small>(${U().bnDigits(c.rating_count || 0)})</small></span><span>👁 ${U().bnDigits(c.views || 0)}</span><span>💼 ${U().bnDigits(c.interest_count || 0)} <small>${T("আগ্রহী", "interested")}</small></span><span>🤝 ${U().bnDigits(c.investor_count || 0)} <small>${T("বিনিয়োগকারী", "investors")}</small></span></div>
        <label class="ac-switch"><input type="checkbox" data-invtog="${esc(c.id)}" ${c.invest_open ? "checked" : ""}><i aria-hidden="true"></i><span><b>${c.invest_open ? T("বিনিয়োগের জন্য খোলা", "Open for investment") : T("বিনিয়োগ আপাতত বন্ধ", "Investment paused")}</b><small>${T("বন্ধ করলে নতুন বিনিয়োগকারী আগ্রহ জানাতে পারবেন না।", "When off, new investors cannot show interest.")}</small></span></label>` : "";
      return `<article class="ac-co" data-co="${esc(c.id)}">
        <div class="ac-co-top">${logoBox(c.logo_url, c.name)}<div class="ac-co-tx"><h4>${esc(c.name || T("নামহীন ড্রাফট", "Untitled draft"))}</h4><p class="muted">${esc(c.tagline || label(CFG().industries, c.category) || "")}</p></div></div>
        <div class="ac-pills">${pill(S)}${c.status === "draft" || c.status === "changes_requested" || pr ? pill(PAYST[payKey]) : ""}${docs.length ? `<span class="ac-pill draft">📎 ${U().bnDigits(docs.length)}</span>` : ""}</div>
        <p class="ac-desc">${T(S.dbn, S.den)}</p>${note}${stats}
        <div class="ac-btns">
          ${edit ? `<a class="btn btn-orange ac-sm" href="/apply?c=${esc(c.id)}">${T("আবেদন চালিয়ে যান", "Continue application")} →</a>` : ""}
          ${c.status === "submitted" || c.status === "in_review" || c.status === "rejected" || c.status === "suspended" ? `<a class="btn btn-outline ac-sm" href="/apply?c=${esc(c.id)}">${T("আবেদন দেখুন", "View application")}</a>` : ""}
          ${c.status === "published" ? `<a class="btn btn-green ac-sm" href="/company/${esc(c.slug)}">${T("পাবলিক পেজ দেখুন", "View public page")}</a><a class="btn btn-outline ac-sm" href="/apply?c=${esc(c.id)}">${T("পাবলিক প্রোফাইল এডিট", "Edit public profile")}</a><button type="button" class="btn btn-outline ac-sm" data-act="ints" data-id="${esc(c.id)}">💼 ${T("বিনিয়োগকারী ও ডিল", "Investors & deals")} (${U().bnDigits(c.interest_count || 0)})</button>` : ""}
        </div>
        ${c.status !== "draft" ? `<div class="ac-btns ac-btns2"><button type="button" class="btn btn-outline ac-sm" data-act="val" data-id="${esc(c.id)}">📊 ${T("ভ্যালুয়েশন", "Valuation")}${c.vosb_valuation ? " · " + esc(moneyShort(c.vosb_valuation)) : ""}</button></div>` : ""}
        ${delBlock(c)}
        ${ints ? `<div class="ac-ints">${ints === "loading" ? `<p class="muted">…</p>` : ints === "error" ? `<p class="ac-msg err">${T("লোড করা যায়নি।", "Could not load.")}</p>` : ovPanel(c, ints)}</div>` : ""}
        ${vp ? `<div class="ac-ints">${vp === "loading" ? `<p class="muted">…</p>` : vp === "error" ? `<p class="ac-msg err">${T("লোড করা যায়নি।", "Could not load.")}</p>` : valPanel(c, vp)}</div>` : ""}
      </article>`;
    }
    function delBlock(c) {
      const rq = (st.dreq || []).find((r) => r.company_id === c.id), pend = rq && rq.status === "pending", last = rq && rq.status === "rejected" ? rq : null;
      if (pend) return `<div class="ac-delreq"><span>🗑 ${T("সরানোর অনুরোধ অ্যাডমিনের অনুমোদনের অপেক্ষায় — ততক্ষণ কোম্পানি যেমন আছে তেমনই থাকবে।", "Removal requested — waiting for the VOSB admin. Your company stays as it is until then.")}</span><button type="button" class="btn btn-outline ac-sm" data-act="delcancel" data-id="${esc(c.id)}">${T("অনুরোধ বাতিল", "Cancel request")}</button></div>`;
      return `${last ? `<div class="ac-note warn"><b>${T("সরানোর অনুরোধ অনুমোদিত হয়নি", "Removal request was declined")}</b>${last.admin_note ? `<p>${esc(last.admin_note)}</p>` : ""}</div>` : ""}<div class="ac-btns ac-btns2"><button type="button" class="btn btn-outline ac-sm ac-danger" data-act="delco" data-id="${esc(c.id)}" data-name="${esc(c.name || "")}">🗑 ${T("কোম্পানি সরানোর অনুরোধ", "Request removal")}</button></div>`;
    }
    const inv = { individual: ["ব্যক্তিগত", "Individual"], angel: ["এঞ্জেল", "Angel"], vc: ["ভিসি", "VC"], institution: ["প্রতিষ্ঠান", "Institution"], other: ["অন্যান্য", "Other"] };
    const avHtml = (url, name, cls) => (url && /^https:\/\//.test(url) ? `<img class="${cls || "ac-pav"}" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls || "ac-pav"}">${esc(initialOf(name))}</span>`);
    const ISTAT = { proposed: ["wait", "অপর পক্ষের নিশ্চিতকরণের অপেক্ষায়", "Waiting for the other side"], confirmed: ["warn", "দুই পক্ষ নিশ্চিত · VOSB যাচাই বাকি", "Both confirmed · VOSB check pending"], verified: ["ok", "VOSB যাচাইকৃত ✓", "Verified by VOSB ✓"], cancelled: ["bad", "বাতিল", "Cancelled"] };
    const ipill = (x) => { const o = ISTAT[x] || ISTAT.proposed; return `<span class="ac-pill ${o[0]}">${T(o[1], o[2])}</span>`; };
    const uid = () => (A().user() || {}).id;
    function dealRow(d, ctx) {
      const mineSide = ctx === "owner" ? !d.owner_confirmed_at : !d.investor_confirmed_at;
      return `<div class="ac-deal"><div class="ac-deal-a"><b>${esc(moneyShort(d.amount))}</b>${d.equity_pct ? `<small>${nd(+d.equity_pct)}% ${T("ইকুইটি", "equity")}</small>` : ""}</div>
        <div class="ac-deal-b"><span>${ctx === "owner" ? esc(d.investor_name || T("বিনিয়োগকারী", "Investor")) : esc(d.name || "")}</span><small class="muted">${U().formatDate(d.invested_on || d.created_at)} · ${T("লিখেছেন", "recorded by")}: ${esc(d.recorded_by === "investor" ? T("বিনিয়োগকারী", "investor") : d.recorded_by === "owner" ? T("মালিক", "owner") : "VOSB")}</small>${d.note ? `<small>${esc(d.note)}</small>` : ""}</div>
        <div class="ac-deal-c">${ipill(d.status)}${d.status === "proposed" && mineSide ? `<button type="button" class="btn btn-green ac-sm" data-act="dealok" data-id="${esc(d.id)}">${ctx === "owner" ? T("পেয়েছি — নিশ্চিত করুন", "Received — confirm") : T("আমি দিয়েছি — নিশ্চিত করুন", "I paid — confirm")}</button>` : ""}${d.status === "proposed" ? `<button type="button" class="co-link bad" data-act="dealno" data-id="${esc(d.id)}">${T("বাতিল", "Cancel")}</button>` : ""}</div></div>`;
    }
    function ovPanel(c, o) {
      if (!o || !o.interests) return "";
      const t = o.totals || {};
      const tiles = `<div class="ac-tiles"><div><b>${nd(t.interested || 0)}</b><small>${T("আগ্রহী বিনিয়োগকারী", "Interested investors")}</small></div><div><b>${nd(t.investors || 0)}</b><small>${T("বিনিয়োগ করেছেন", "Have invested")}</small></div><div><b>${esc(moneyShort(t.confirmed || 0))}</b><small>${T("দুই পক্ষ নিশ্চিত", "Confirmed by both")}</small></div><div><b>${esc(moneyShort(t.verified || 0))}</b><small>${T("VOSB যাচাইকৃত", "Verified by VOSB")}</small></div></div>`;
      const cards = o.interests.length ? o.interests.map((i) => `<div class="ac-int"><div class="ac-int-top">${avHtml(i.avatar_url, i.investor_name)}<div class="ac-int-h"><b>${esc(i.investor_name || T("বিনিয়োগকারী", "Investor"))}</b><span class="ac-pill draft">${esc(T((inv[i.investor_type] || inv.other)[0], (inv[i.investor_type] || inv.other)[1]))}</span><small class="muted">${U().formatDate(i.created_at)}</small>${i.headline || i.location ? `<small class="muted ac-int-sub">${esc([i.headline, i.location].filter(Boolean).join(" · "))}</small>` : ""}</div></div>
        ${i.ticket_min || i.ticket_max ? `<p class="ac-int-t">💰 ${T("টিকিট সাইজ", "Ticket")}: ${esc(moneyShort(i.ticket_min))} – ${esc(moneyShort(i.ticket_max))}</p>` : ""}<p>${esc(i.message)}</p>
        ${i.email || i.phone ? `<p class="ac-int-c">📇 ${i.email ? `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>` : ""} ${i.phone ? `<a href="tel:${esc(i.phone)}">${esc(i.phone)}</a>` : ""}</p>` : `<p class="muted"><small>${T("যোগাযোগের তথ্য শেয়ার করা হয়নি।", "Contact details were not shared.")}</small></p>`}
        <div class="ac-int-f">${Number(i.invested) ? `<span class="ac-pill ok">${T("বিনিয়োগ", "Invested")}: ${esc(moneyShort(i.invested))}</span>` : ""}<button type="button" class="btn btn-outline ac-sm" data-act="recinv" data-co="${esc(c.id)}" data-inv="${esc(i.user_id)}" data-name="${esc(i.investor_name || "")}">＋ ${T("টাকা পেয়েছি — রেকর্ড করুন", "Record money received")}</button></div></div>`).join("") : `<p class="muted">${T("এখনও কোনো বিনিয়োগকারী আগ্রহ জানাননি।", "No investor has shown interest yet.")}</p>`;
      const deals = o.investments.length ? `<h5 class="ac-sub">🤝 ${T("বিনিয়োগ রেকর্ড", "Investment records")}</h5><div class="ac-deals">${o.investments.map((d) => dealRow(d, "owner")).join("")}</div><p class="muted"><small>${T("টাকা আদান-প্রদান আপনাদের মধ্যে হয় — VOSB শুধু রেকর্ড যাচাই করে। দুই পক্ষ নিশ্চিত করলে VOSB যাচাই করবে।", "Money moves between you and the investor — VOSB only verifies the record. Once both sides confirm, VOSB verifies it.")}</small></p>` : "";
      return `${tiles}<h5 class="ac-sub">💼 ${T("আগ্রহী বিনিয়োগকারী", "Interested investors")}</h5>${cards}${deals}`;
    }
    const FLAGS = { thin_financials: ["অল্প আর্থিক তথ্য — আরও তথ্য দিলে রেঞ্জ সংকীর্ণ হবে", "Few figures given — more data tightens the range"], runway_short: ["ক্যাশ রানওয়ে ৩ মাসের কম", "Cash runway under 3 months"], not_registered: ["নিবন্ধিত নয় — ডিসকাউন্ট প্রযোজ্য", "Not registered — discount applied"], no_documents: ["কোনো ডকুমেন্ট নেই", "No documents attached"], documents_unverified: ["ডকুমেন্ট এখনও যাচাই হয়নি", "Documents not verified yet"], burn_exceeds_revenue: ["বার্ন আয়ের তুলনায় অনেক বেশি", "Burn is high compared to revenue"], expectation_high: ["আপনার প্রত্যাশা সিস্টেম রেঞ্জের চেয়ে বেশি", "Your expectation is above the system range"], expectation_low: ["আপনার প্রত্যাশা সিস্টেম রেঞ্জের চেয়ে কম", "Your expectation is below the system range"], expectation_reasonable: ["আপনার প্রত্যাশা রেঞ্জের কাছাকাছি", "Your expectation is close to the range"] };
    const VST = { pending: ["wait", "অনুমোদনের অপেক্ষায়", "Awaiting approval"], approved: ["ok", "অনুমোদিত", "Approved"], rejected: ["bad", "অনুমোদিত হয়নি", "Not approved"], superseded: ["draft", "পুরোনো", "Superseded"] };
    function rangeBar(v) { const lo = Number(v.low), mi = Number(v.mid), hi = Number(v.high); if (!hi) return ""; const pos = hi > lo ? Math.round((mi - lo) / (hi - lo) * 100) : 50;
      return `<div class="ac-range"><div class="ac-range-v"><span>${esc(moneyShort(lo))}</span><b>${esc(moneyShort(mi))}</b><span>${esc(moneyShort(hi))}</span></div><div class="ac-range-bar" aria-hidden="true"><i style="left:${pos}%"></i></div><div class="ac-range-l"><span>${T("সর্বনিম্ন", "Low")}</span><span>${T("মধ্যম", "Mid")}</span><span>${T("সর্বোচ্চ", "High")}</span></div></div>`; }
    function valPanel(c, vp) {
      const items = vp.items || [], cur = items.find((x) => x.status === "approved"), pend = items.find((x) => x.status === "pending");
      const shown = cur || pend || items[0];
      let h = `<h5 class="ac-sub">📊 ${T("ভ্যালুয়েশন", "Valuation")}</h5>`;
      if (!shown) h += `<p class="muted">${T("এখনও কোনো ভ্যালুয়েশন তৈরি হয়নি।", "No valuation has been prepared yet.")}</p>`;
      else {
        const o = VST[shown.status] || VST.pending, r = shown.result || {};
        if (shown.status === "pending") h += `<div class="ac-val"><div class="ac-val-h"><span class="ac-pill ${o[0]}">${T(o[1], o[2])}</span><small class="muted">${U().formatDate(shown.created_at)}</small></div><p>${T("আপনার তথ্য থেকে VOSB ভ্যালুয়েশন তৈরি করছে ও যাচাই করছে। অনুমোদনের পর এখানে রেঞ্জ ও বিশ্লেষণ দেখতে পাবেন — তার আগে এটি গোপন থাকে।", "VOSB is preparing and checking your valuation. The range and analysis appear here once it is approved — until then it stays private.")}</p></div>`;
        else h += `<div class="ac-val"><div class="ac-val-h"><span class="ac-pill ${o[0]}">${T(o[1], o[2])}</span><small class="muted">v${nd(shown.version)} · ${U().formatDate(shown.created_at)} · ${shown.source === "update_request" ? T("আপডেট অনুরোধ", "update request") : T("আবেদনের সময়", "at application")}</small></div>
          ${rangeBar(shown)}<div class="ac-conf"><span>${T("নির্ভরযোগ্যতা", "Confidence")}</span><div class="ac-meter" aria-hidden="true"><i style="width:${Math.min(100, shown.confidence || 0)}%"></i></div><b>${nd(shown.confidence || 0)}%</b></div>
          ${shown.expected_by_owner ? `<p class="muted">${T("আপনার প্রত্যাশা", "Your expectation")}: <b>${esc(moneyShort(shown.expected_by_owner))}</b></p>` : ""}
          ${(r.flags || []).length ? `<ul class="ac-flags">${r.flags.map((f) => (FLAGS[f] ? `<li>${T(FLAGS[f][0], FLAGS[f][1])}</li>` : "")).join("")}</ul>` : ""}
          ${shown.note ? `<div class="ac-note"><b>${T("VOSB-এর নোট", "Note from VOSB")}:</b> ${esc(shown.note)}</div>` : ""}</div>
          <p class="muted"><small>${T("এটি সিস্টেম-গণনা করা ইঙ্গিতমূলক রেঞ্জ (রেভিনিউ/আর্নিংস মাল্টিপল, স্কোরকার্ড ও অ্যাসেট ফ্লোর) — বিনিয়োগ পরামর্শ নয়। শুধু অনুমোদিত রেঞ্জ পাবলিক পেজে দেখানো হয়।", "An indicative range calculated by the system (revenue/earnings multiples, scorecard and asset floor) — not investment advice. Only the approved range is shown publicly.")}</small></p>`;
      }
      if (c.status === "published") h += pend && pend.source === "update_request" ? `<p class="ac-msg ok">${T("আপডেট অনুরোধ VOSB-এর রিভিউতে আছে।", "Your update request is with VOSB for review.")}</p>` : `<button type="button" class="btn btn-orange ac-sm" data-act="valreq" data-id="${esc(c.id)}">🔄 ${T("ভ্যালুয়েশন আপডেটের অনুরোধ", "Request a valuation update")}</button><p class="muted"><small>${T("বিনিয়োগকারীর কাছ থেকে টাকা পাওয়ার পর (দুই পক্ষ নিশ্চিত করলে) নতুন তথ্য দিয়ে অনুরোধ করা যায়।", "Available once an investment is confirmed by both sides — send your new figures for review.")}</small></p>`;
      if (items.length > 1) h += `<details class="ac-hist"><summary>${T("আগের ভ্যালুয়েশন", "Valuation history")} (${nd(items.length)})</summary>${items.map((x) => `<div class="ac-hist-r"><span class="ac-pill ${(VST[x.status] || VST.pending)[0]}">${T((VST[x.status] || VST.pending)[1], (VST[x.status] || VST.pending)[2])}</span><span>${esc(moneyShort(x.low))} – ${esc(moneyShort(x.high))}</span><small class="muted">v${nd(x.version)} · ${U().formatDate(x.created_at)}</small></div>`).join("")}</details>`;
      return h;
    }
    async function toggleInts(id) {
      if (st.ints[id]) { delete st.ints[id]; panel(); return; }
      st.ints[id] = "loading"; panel();
      try { st.ints[id] = (await rpc("company_investor_overview", { p_company: id })) || {}; st.ov[id] = st.ints[id]; } catch (e) { st.ints[id] = "error"; }
      panel();
    }
    async function toggleVal(id) {
      if (st.val[id]) { delete st.val[id]; panel(); return; }
      st.val[id] = "loading"; panel();
      try { st.val[id] = (await rpc("my_valuations", { p_company: id })) || {}; } catch (e) { st.val[id] = "error"; }
      panel();
    }
    async function refreshCo(id) { await loadCompanies(); if (st.ints[id] && st.ints[id] !== "loading") { try { st.ints[id] = await rpc("company_investor_overview", { p_company: id }); } catch (e) {} } panel(); }
    async function setOpen(id, on, box) {
      box.disabled = true;
      try { await rpc("set_invest_open", { p_company: id, p_open: on }); const co = (st.cos || []).find((x) => x.id === id); if (co) co.invest_open = on; toast(on ? T("বিনিয়োগ গ্রহণ চালু ✓", "Open for investment ✓") : T("বিনিয়োগ গ্রহণ বন্ধ", "Investment paused"), "ok"); }
      catch (e) { toast(friendly(e), "err"); box.checked = !on; }
      panel();
    }
    /* record an investment (owner records money received; investor records money paid) */
    function recordDialog(coId, investor, name, asOwner) {
      const d = dialog(`<button type="button" class="ac-dlg-x" data-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><h2>🤝 ${asOwner ? T("প্রাপ্ত বিনিয়োগ রেকর্ড করুন", "Record money received") : T("আমার বিনিয়োগ রেকর্ড করুন", "Record my investment")}</h2>
        <p class="muted">${asOwner ? T(`“${esc(name)}”-এর কাছ থেকে পাওয়া টাকার তথ্য দিন। তিনি নিশ্চিত করলে এবং VOSB যাচাই করলে রেকর্ডটি চূড়ান্ত হবে।`, `Enter what you received from “${esc(name)}”. It becomes final once the investor confirms and VOSB verifies.`) : T("আপনি যে টাকা দিয়েছেন তার তথ্য দিন। কোম্পানির মালিক নিশ্চিত করলে এবং VOSB যাচাই করলে রেকর্ডটি চূড়ান্ত হবে।", "Enter what you paid. It becomes final once the company owner confirms and VOSB verifies.")}</p>
        <div class="ac-grid2"><div class="ac-fld"><label for="r-amt">${T("পরিমাণ (৳)", "Amount (৳)")} <i class="req">*</i></label><input id="r-amt" type="number" min="1" step="any" inputmode="decimal"><small class="ac-help" id="r-h"></small></div>
          <div class="ac-fld"><label for="r-eq">${T("ইকুইটি (%) — ঐচ্ছিক", "Equity (%) — optional")}</label><input id="r-eq" type="number" min="0" max="100" step="any" inputmode="decimal"></div>
          <div class="ac-fld"><label for="r-dt">${T("তারিখ", "Date")}</label><input id="r-dt" type="date" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="ac-fld"><label for="r-nt">${T("নোট (ঐচ্ছিক)", "Note (optional)")}</label><input id="r-nt" maxlength="500"></div></div>
        <div class="ac-msg" role="alert" aria-live="polite"></div><div class="ac-acts"><button type="button" class="btn btn-outline" data-x>${T("বাতিল", "Cancel")}</button><button type="button" class="btn btn-orange" id="r-go">${T("রেকর্ড করুন", "Save record")}</button></div>`);
      const el = d.el; el.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) d.close(); });
      $("#r-amt", el).addEventListener("input", (e) => { $("#r-h", el).textContent = moneyShort(e.target.value) === "৳0" ? "" : "≈ " + moneyShort(e.target.value); });
      $("#r-go", el).addEventListener("click", async () => {
        const amt = Number($("#r-amt", el).value), msg = $(".ac-msg", el), btn = $("#r-go", el);
        if (!(amt > 0)) { msg.className = "ac-msg err"; msg.textContent = T("পরিমাণ লিখুন।", "Enter the amount."); return; }
        btn.disabled = true; msg.className = "ac-msg"; msg.textContent = "…";
        try { await rpc("record_investment", { p_company: coId, p_investor: investor || null, p_amount: amt, p_equity: $("#r-eq", el).value ? Number($("#r-eq", el).value) : null, p_date: $("#r-dt", el).value || null, p_note: $("#r-nt", el).value.trim() || null });
          d.close(); toast(T("রেকর্ড হয়েছে — অপর পক্ষকে জানানো হয়েছে ✓", "Recorded — the other side was notified ✓"), "ok"); if (asOwner) await refreshCo(coId); else { st.inv = null; await loadInv(); panel(); } }
        catch (e) { msg.className = "ac-msg err"; msg.textContent = friendly(e); btn.disabled = false; }
      });
    }
    function delCoDialog(coId, name) {
      const d = dialog(`<button type="button" class="ac-dlg-x" data-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><h2>🗑 ${T("কোম্পানি সরানোর অনুরোধ", "Request to remove your company")}</h2>
        <p class="muted">${T(`“${esc(name || "")}” সরাতে VOSB অ্যাডমিনের অনুমোদন লাগবে। অনুমোদন না পাওয়া পর্যন্ত কোম্পানি যেমন আছে তেমনই থাকবে। তথ্য মুছে ফেলা হয় না — চাইলে পরে ফিরিয়ে আনা যায়।`, `Removing “${esc(name || "")}” needs approval from the VOSB admin. Until then nothing changes. Your data is never erased — it can be restored later.`)}</p>
        <div class="ac-fld"><label for="dq-r">${T("কেন সরাতে চান?", "Why do you want to remove it?")} <i class="req">*</i></label><textarea id="dq-r" rows="3" maxlength="800"></textarea></div>
        <div class="ac-msg" role="alert" aria-live="polite"></div><div class="ac-acts"><button type="button" class="btn btn-outline" data-x>${T("বাতিল", "Cancel")}</button><button type="button" class="btn btn-orange" id="dq-go">${T("অনুরোধ পাঠান", "Send request")}</button></div>`);
      const el = d.el; el.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) d.close(); });
      $("#dq-go", el).addEventListener("click", async () => {
        const msg = $(".ac-msg", el), btn = $("#dq-go", el), r = $("#dq-r", el).value.trim();
        if (r.length < 5) { msg.className = "ac-msg err"; msg.textContent = T("কারণ লিখুন (অন্তত ৫ অক্ষর)।", "Please write a reason (at least 5 characters)."); return; }
        btn.disabled = true; msg.className = "ac-msg"; msg.textContent = "…";
        try { await rpc("request_company_deletion", { p_company: coId, p_reason: r }); d.close(); toast(T("অনুরোধ পাঠানো হয়েছে ✓", "Request sent ✓"), "ok"); await loadCompanies(); panel(); }
        catch (e) { msg.className = "ac-msg err"; msg.textContent = friendly(e); btn.disabled = false; }
      });
    }
    function valReqDialog(coId) {
      const f = ((st.val[coId] && st.val[coId].financials) || {});
      const flds = [["annual_revenue", "বার্ষিক আয় (৳)", "Annual revenue (৳)"], ["monthly_revenue", "মাসিক আয় (৳)", "Monthly revenue (৳)"], ["growth_mom", "মাসিক প্রবৃদ্ধি (%)", "Monthly growth (%)"], ["gross_margin", "গ্রস মার্জিন (%)", "Gross margin (%)"], ["annual_net_profit", "বার্ষিক নিট মুনাফা (৳)", "Annual net profit (৳)"], ["monthly_burn", "মাসিক বার্ন (৳)", "Monthly burn (৳)"], ["cash_in_bank", "হাতে নগদ (৳)", "Cash in hand (৳)"], ["debt", "দেনা (৳)", "Debt (৳)"], ["customers", "গ্রাহক", "Customers"], ["paying_customers", "পেইং গ্রাহক", "Paying customers"], ["team_ft", "ফুল-টাইম টিম", "Full-time team"], ["total_raised", "মোট তোলা তহবিল (৳)", "Total raised (৳)"]];
      const d = dialog(`<button type="button" class="ac-dlg-x" data-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><h2>🔄 ${T("ভ্যালুয়েশন আপডেটের অনুরোধ", "Request a valuation update")}</h2>
        <p class="muted">${T("বর্তমান সঠিক তথ্য দিন। সিস্টেম নতুন রেঞ্জ হিসাব করবে, VOSB যাচাই করে অনুমোদন দেবে।", "Enter your current figures. The system recalculates the range and VOSB checks and approves it.")}</p>
        <div class="ac-grid2">${flds.map((x) => `<div class="ac-fld"><label for="vq-${x[0]}">${T(x[1], x[2])}</label><input id="vq-${x[0]}" data-vq="${x[0]}" type="number" step="any" inputmode="decimal" value="${f[x[0]] == null ? "" : esc(f[x[0]])}"></div>`).join("")}
          <div class="ac-fld ac-span"><label for="vq-r">${T("কেন ভ্যালুয়েশন বদলাবে?", "Why should the valuation change?")} <i class="req">*</i></label><textarea id="vq-r" rows="3" maxlength="800" placeholder="${T("যেমন: ৳৫০ লাখ বিনিয়োগ পেয়েছি, আয় দ্বিগুণ হয়েছে…", "e.g. Raised ৳50 lakh, revenue doubled…")}"></textarea></div></div>
        <div class="ac-msg" role="alert" aria-live="polite"></div><div class="ac-acts"><button type="button" class="btn btn-outline" data-x>${T("বাতিল", "Cancel")}</button><button type="button" class="btn btn-orange" id="vq-go">${T("অনুরোধ পাঠান", "Send request")}</button></div>`);
      const el = d.el; el.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) d.close(); });
      $("#vq-go", el).addEventListener("click", async () => {
        const p = {}; $$("[data-vq]", el).forEach((i) => { if (i.value !== "") p[i.dataset.vq] = Number(i.value); });
        const msg = $(".ac-msg", el), btn = $("#vq-go", el); btn.disabled = true; msg.className = "ac-msg"; msg.textContent = "…";
        try { await rpc("request_valuation_update", { p_company: coId, p_reason: $("#vq-r", el).value, p }); d.close(); toast(T("অনুরোধ পাঠানো হয়েছে ✓", "Request sent ✓"), "ok"); delete st.val[coId]; await toggleVal(coId); }
        catch (e) { msg.className = "ac-msg err"; msg.textContent = friendly(e); btn.disabled = false; }
      });
    }

    /* ---- my investments (as an investor) ---- */
    async function loadInv() { st.invErr = ""; try { st.inv = (await rpc("my_investments")) || { interests: [], investments: [], total: 0 }; } catch (e) { st.inv = null; st.invErr = friendly(e); } }
    function investView(el) {
      if (st.invErr) { el.innerHTML = `<div class="ac-card ac-center"><p>${esc(st.invErr)}</p><button class="btn btn-outline ac-sm" data-act="retry-inv">${T("আবার চেষ্টা করুন", "Try again")}</button></div>`; return; }
      if (!st.inv) { el.innerHTML = `<div class="ac-skel" aria-hidden="true"></div>`; return; }
      const v = st.inv;
      if (!v.interests.length && !v.investments.length) { el.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">💼</div><h3>${T("এখনও কোথাও আগ্রহ জানাননি", "You have not shown interest anywhere yet")}</h3><p class="muted">${T("কোম্পানির পেজে “বিনিয়োগে আগ্রহ জানান” চাপুন — এখানে সব আগ্রহ ও বিনিয়োগ ট্র্যাক করতে পারবেন।", "Press “Show investment interest” on a company page — you can then track every interest and investment here.")}</p><p><a class="btn btn-orange" href="/companies">${T("কোম্পানিগুলো দেখুন", "Browse companies")}</a></p></div>`; return; }
      el.innerHTML = `<div class="ac-tiles ac-card"><div><b>${nd(v.interests.length)}</b><small>${T("আগ্রহ জানিয়েছেন", "Interests sent")}</small></div><div><b>${nd(v.investments.filter((x) => x.status === "confirmed" || x.status === "verified").length)}</b><small>${T("নিশ্চিত বিনিয়োগ", "Confirmed investments")}</small></div><div><b>${esc(moneyShort(v.total || 0))}</b><small>${T("মোট বিনিয়োগ", "Total invested")}</small></div></div>
        <div class="ac-card"><h3>💼 ${T("আমার আগ্রহ", "My interests")}</h3><div class="ac-ilist">${v.interests.map((i) => `<div class="ac-irow"><div class="ac-irow-a">${logoBox(i.logo_url, i.name, "ac-logo sm")}<div><a href="/company/${esc(i.slug)}"><b>${esc(i.name)}</b></a><small class="muted">${esc(T((inv[i.investor_type] || inv.other)[0], (inv[i.investor_type] || inv.other)[1]))} · ${esc(moneyShort(i.ticket_min))}–${esc(moneyShort(i.ticket_max))} · ${U().formatDate(i.created_at)}</small></div></div>
          <div class="ac-irow-b"><span class="ac-pill ${i.invest_open ? "ok" : "draft"}">${i.invest_open ? T("কোম্পানি খোলা", "Company open") : T("আপাতত বন্ধ", "Paused")}</span><button type="button" class="btn btn-outline ac-sm" data-act="recmine" data-co="${esc(i.company_id)}">＋ ${T("আমি বিনিয়োগ করেছি", "I invested")}</button></div></div>`).join("")}</div></div>
        ${v.investments.length ? `<div class="ac-card"><h3>🤝 ${T("আমার বিনিয়োগ", "My investments")}</h3><div class="ac-deals">${v.investments.map((d) => dealRow(d, "investor")).join("")}</div></div>` : ""}`;
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
      if (st.tab === "profile" && !st.prof) { await loadProfile(); panel(); refreshTabs(); }
      if (st.tab === "invest" && !st.inv && !st.invErr) { await loadInv(); panel(); }
      if (full || st.tab === "companies") { if (st.cos === null && !st.cosErr) { await loadCompanies(); panel(); } }
    }
    root.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
      if (t.dataset.tab) { st.tab = t.dataset.tab; history.replaceState(null, "", "#" + st.tab); panel(); if (st.tab === "companies" && st.cos === null && !st.cosErr) { await loadCompanies(); panel(); } if (st.tab === "profile" && !st.prof) { await loadProfile(); panel(); } if (st.tab === "invest" && !st.inv && !st.invErr) { await loadInv(); panel(); } return; }
      const act = t.dataset.act;
      if (act === "login") { A().requireLogin("প্রোফাইল ও কোম্পানি দেখতে লগইন করুন।", "Log in to see your profile and companies."); }
      else if (act === "retry-profile") { st.profErr = false; st.prof = null; panel(); await loadProfile(true); panel(); }
      else if (act === "retry-cos") { st.cosErr = ""; st.cos = null; panel(); await loadCompanies(); panel(); }
      else if (act === "ints") toggleInts(t.dataset.id);
      else if (act === "val") toggleVal(t.dataset.id);
      else if (act === "valreq") valReqDialog(t.dataset.id);
      else if (act === "delco") delCoDialog(t.dataset.id, t.dataset.name);
      else if (act === "delcancel") { t.disabled = true; try { await rpc("cancel_company_deletion", { p_company: t.dataset.id }); toast(T("অনুরোধ বাতিল হয়েছে", "Request cancelled"), "ok"); await loadCompanies(); } catch (er) { toast(friendly(er), "err"); } panel(); }
      else if (act === "avrm") removeAvatar();
      else if (act === "retry-inv") { st.invErr = ""; st.inv = null; panel(); await loadInv(); panel(); }
      else if (act === "recinv") recordDialog(t.dataset.co, t.dataset.inv, t.dataset.name, true);
      else if (act === "recmine") recordDialog(t.dataset.co, null, "", false);
      else if (act === "dealok") { t.disabled = true; try { await rpc("confirm_investment", { p_id: t.dataset.id }); toast(T("নিশ্চিত হয়েছে ✓", "Confirmed ✓"), "ok"); } catch (er) { toast(friendly(er), "err"); } if (st.tab === "invest") { await loadInv(); panel(); } else { const co = (st.cos || []).find((x) => st.ints[x.id]); await refreshCo(co ? co.id : ""); } }
      else if (act === "dealno") { if (!confirm(T("এই রেকর্ড বাতিল করবেন?", "Cancel this record?"))) return; try { await rpc("cancel_investment", { p_id: t.dataset.id }); } catch (er) { toast(friendly(er), "err"); } if (st.tab === "invest") { await loadInv(); panel(); } else { const co = (st.cos || []).find((x) => st.ints[x.id]); await refreshCo(co ? co.id : ""); } }
      else if (act === "logout") A().signOut();
      else if (act === "delete") deleteDialog();
    });
    root.addEventListener("change", (e) => {
      const tg = e.target.closest("[data-invtog]"); if (tg) { setOpen(tg.dataset.invtog, tg.checked, tg); return; }
      const up = e.target.closest("[data-avup]"); if (up) { const f = up.files && up.files[0]; up.value = ""; if (f) uploadAvatar(f); }
    });
    root.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-form]"); if (!f) return;
      e.preventDefault();
      if (f.dataset.form === "profile") saveProfile(f); else if (f.dataset.form === "pw") changePw(f);
    });
    root.addEventListener("input", (e) => {
      const c = e.target.closest("textarea[name=bio]"); if (c) { const n = $("[data-cnt=bio]", root); if (n) n.textContent = c.value.length + "/600"; }
    });
    window.addEventListener("hashchange", () => { if (A() && A().isIn()) { st.tab = hashTab(); panel(); if (st.tab === "companies" && st.cos === null && !st.cosErr) loadCompanies().then(panel); if (st.tab === "invest" && !st.inv && !st.invErr) loadInv().then(panel); } });
    U().onRender(() => { if (st.rendered !== U().lang) render(); });
    A().onChange(() => { st.prof = null; st.cos = null; st.cosErr = ""; st.inv = null; st.ints = {}; st.val = {}; render(true); });
    render(true);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "account") whenReady(accountPage);
  });
})();
