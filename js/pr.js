/* Voice of Startup Bangladesh — /pr : paid promotion, sponsored articles, posts, reels, collaborations.
   Anyone can read the page; ordering needs a login. Reached ONLY from the Contact page and the footer (under the contacts) — no menu, no sitemap, noindex.
   The screen collects and displays. Prices, coupons, free-campaign rules, TrxID checks and ownership are all enforced by the database functions
   (get_pr_public, pr_quote, pr_submit_order, pr_pay_order, pr_cancel_order). */
(function () {
  "use strict";
  const AC = window.VOSB_AC, F = window.VOSB_PRF;
  if (!AC || !F || !document.body || document.body.dataset.page !== "pr") return;
  const { U, A, T, esc, CFG, $, $$, friendly, sb, rpc, toast, whenReady } = AC;
  const root = $("#app");
  if (!root) return;

  const nd = (n) => U().bnDigits(String(n));
  const money = (n) => "৳" + nd(Number(n || 0).toLocaleString("en-IN"));
  const en = (x) => String(x == null ? "" : x).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const pk = (a) => T(a[1], a[2]);                       // [cls, bn, en] → text
  const pill = (a) => `<span class="ac-pill ${a[0]}">${esc(pk(a))}</span>`;
  const compact = (n) => {
    n = Number(n) || 0;
    if (U().lang === "bn") return n >= 100000 ? nd((Math.round(n / 1e4) / 10).toString().replace(/\.0$/, "")) + " লাখ" : n >= 1000 ? nd(Math.round(n / 100) / 10 === Math.round(n / 1000) ? Math.round(n / 1000) : Math.round(n / 100) / 10) + " হাজার" : nd(n);
    return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace(/\.0$/, "") + "K" : String(n);
  };
  const MAX = { name: 80, phone: 20, email: 120, brand: 120, website: 200, social_url: 200, what: 1500, audience: 200, key_points: 1200, assets: 600, article_link: 200, keywords: 200, concept: 1200, location: 120, budget: 60, venue: 160, prize: 200, handles: 200, notes: 1200 };
  const SOLID = { bkash: "#e2136e" };

  const st = { pub: null, err: "", orders: null, ordersErr: "", cat: "all", o: null, done: null, payFor: null, cancelAsk: null, pay: { method: "bkash", sender: "", trx: "", msg: "", busy: false }, want: null, prof: null, lastView: "" };

  /* ---------- data ---------- */
  async function loadPub() {
    try { st.pub = await rpc("get_pr_public"); st.err = ""; } catch (e) { st.err = friendly(e); }
  }
  async function loadOrders() {
    if (!A().isIn()) { st.orders = null; return; }
    try {
      const c = await sb(), uid = A().user().id;
      const { data, error } = await c.from("pr_orders").select("*").eq("user_id", uid).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      st.orders = data || []; st.ordersErr = "";
      if (!st.prof) { const p = await c.from("profiles").select("full_name,phone").eq("id", uid).maybeSingle(); st.prof = p.data || {}; }
    } catch (e) { st.ordersErr = friendly(e); if (!st.orders) st.orders = []; }
  }
  const svcs = () => (st.pub && st.pub.services) || [];
  const svcByKey = (k) => svcs().find((s) => s.key === k);
  const camp = () => (st.pub && st.pub.campaign) || null;
  const campFor = (s) => { const c = camp(); return c && (c.service_keys || []).includes(s.key) && (c.slots_left == null || c.slots_left > 0) ? c : null; };
  const methods = () => (st.pub && st.pub.methods) || {};
  const liveMethods = () => (CFG().payMethods || []).filter((m) => (methods()[m.id] || {}).enabled);

  function prErr(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    const x = /PR:\s*([a-z_]+)/i.exec(m);
    if (x && F.ERR[x[1]]) return T(F.ERR[x[1]][0], F.ERR[x[1]][1]);
    if (/Too many attempts/i.test(m)) return T("অনেকবার চেষ্টা হয়েছে — একটু পরে আবার চেষ্টা করুন।", "Too many attempts — please try again a little later.");
    if (/not available yet/i.test(m)) return T("এই পেমেন্ট মাধ্যম এখনো চালু হয়নি।", "This payment method is not available yet.");
    if (/Transaction ID exactly/i.test(m)) return T("পেমেন্টের SMS-এ যেমন আছে হুবহু TrxID লিখুন (৮–১৪ অক্ষর, ইংরেজি অক্ষর ও সংখ্যা)।", "Enter the TrxID exactly as in your payment SMS (8–14 letters/numbers).");
    if (/Transaction ID has already/i.test(m)) return T("এই TrxID আগেই ব্যবহার করা হয়েছে।", "This Transaction ID has already been used.");
    if (/mobile number you sent/i.test(m)) return T("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন (01XXXXXXXXX)।", "Enter the mobile number you sent money from (01XXXXXXXXX).");
    if (/brand or company/i.test(m)) return T("ব্র্যান্ড বা কোম্পানির নাম লিখুন।", "Please enter your brand or company name.");
    if (/valid e-mail/i.test(m)) return T("সঠিক ইমেইল দিন।", "Enter a valid e-mail address.");
    if (/describe what you want/i.test(m)) return T("কী প্রচার করতে চান তা অন্তত ২০ অক্ষরে লিখুন।", "Please describe what you want to promote (at least 20 characters).");
    if (/can no longer be cancelled/i.test(m)) return T("এই অর্ডার আর এখান থেকে বাতিল করা যাবে না — VOSB-এর সাথে যোগাযোগ করুন।", "This order can no longer be cancelled here — please contact VOSB.");
    return friendly(e);
  }

  /* ---------- routing ---------- */
  function route() {
    const h = location.hash || "";
    if (h.indexOf("#order/") === 0) return { v: "order", key: decodeURIComponent(h.slice(7)) };
    if (h === "#orders") return { v: "orders" };
    return { v: "home", anchor: h.slice(1) };
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  window.addEventListener("hashchange", () => { st.done = null; st.payFor = null; st.cancelAsk = null; render(true); });

  /* ---------- hero buttons ---------- */
  function cta() {
    const el = $("#pr-cta"); if (!el) return;
    const n = (st.orders || []).length;
    el.innerHTML = `<a class="btn btn-orange" href="#services">${T("সেবা ও দাম দেখুন", "See services & prices")}</a>` +
      (A().isIn() ? `<a class="btn btn-outline" href="#orders">${T("আমার অর্ডার", "My orders")}${n ? ` <span class="ac-count">${nd(n)}</span>` : ""}</a>` : `<button type="button" class="btn btn-outline" data-act="login">${T("লগইন / সাইন আপ", "Log in / Sign up")}</button>`);
  }

  /* ---------- HOME ---------- */
  function statsHtml() {
    const s = (st.pub.page || {}).stats || {};
    const tiles = [];
    if (s.avg_views) tiles.push(["👁️", compact(s.avg_views) + "+", T("প্রতি পোস্টে গড় ভিউ", "Average views per post")]);
    if (s.peak_min && s.peak_max) tiles.push(["🔥", compact(s.peak_min) + " – " + compact(s.peak_max), T("ভালো পারফর্ম করা পোস্টে ভিউ", "Views on top-performing posts")]);
    if (s.monthly_visitors) tiles.push(["🌐", compact(s.monthly_visitors) + "+", T("মাসিক ওয়েবসাইট ভিজিটর", "Website visitors every month")]);
    tiles.push(["🇧🇩", T("বাংলা + ইংরেজি", "Bangla + English"), T("প্রতিটি আর্টিকেল দুই ভাষায়", "Every article in both languages")]);
    return `<div class="pr-stats" role="list">${tiles.map((t) => `<div class="pr-stat" role="listitem"><span class="pr-stat-ic" aria-hidden="true">${t[0]}</span><b>${esc(t[1])}</b><small>${esc(t[2])}</small></div>`).join("")}</div>
      <p class="pr-fine">${T("ভিউ পেজের গড় ও সাম্প্রতিক পারফরম্যান্স — নির্দিষ্ট ভিউ বা ফলাফলের নিশ্চয়তা নয়।", "Figures are page averages and recent performance — views and results are not guaranteed.")}</p>`;
  }
  function campaignHtml() {
    const c = camp(); if (!c) return "";
    const left = c.slots_left != null ? `<span class="pr-camp-tag">${T("বাকি স্লট", "Slots left")}: <b>${nd(c.slots_left)}</b></span>` : "";
    const ends = c.ends_at ? `<span class="pr-camp-tag">${T("শেষ হবে", "Ends")}: <b>${esc(U().formatDate(c.ends_at))}</b></span>` : "";
    const names = (c.service_keys || []).map((k) => svcByKey(k)).filter(Boolean);
    return `<section class="pr-camp" aria-label="${T("ফ্রি ক্যাম্পেইন", "Free campaign")}"><div class="pr-camp-ic" aria-hidden="true">🎁</div>
      <div class="pr-camp-tx"><span class="pr-camp-eye">${T("এখন চলছে — ফ্রি ক্যাম্পেইন", "Running now — free campaign")}</span><h2>${esc(T(c.title_bn, c.title_en) || "")}</h2>
      <p>${esc(T(c.text_bn, c.text_en) || "")}</p><div class="pr-camp-meta">${left}${ends}${names.length ? `<span class="pr-camp-tag">${names.map((s) => esc(T(s.name_bn, s.name_en))).join(" · ")}</span>` : ""}</div></div>
      ${names.length ? `<button type="button" class="btn btn-orange" data-order="${esc(names[0].key)}">${T("ফ্রি স্লট নিন →", "Claim a free slot →")}</button>` : ""}</section>`;
  }
  function cardHtml(s) {
    const free = campFor(s);
    const price = s.price != null ? `<div class="pr-price"><b>${money(s.price)}</b><span>${esc(T(s.unit_bn, s.unit_en))}</span></div>` : `<div class="pr-price q"><b>${T("কাস্টম কোটেশন", "Custom quote")}</b><span>${T("আপনার প্রয়োজন অনুযায়ী দাম", "Priced to your needs")}</span></div>`;
    return `<article class="pr-card${s.popular ? " pop" : ""}"><div class="pr-card-top"><span class="pr-ic" aria-hidden="true">${esc(s.icon || "📣")}</span><span class="pr-badges">${s.popular ? `<span class="pr-badge">${T("জনপ্রিয়", "Popular")}</span>` : ""}${free ? `<span class="pr-badge free">${T("🎁 ফ্রি ক্যাম্পেইন", "🎁 Free campaign")}</span>` : ""}</span></div>
      <h3>${esc(T(s.name_bn, s.name_en))}</h3><p>${esc(T(s.desc_bn, s.desc_en))}</p>${price}
      <button type="button" class="btn ${s.price != null ? "btn-orange" : "btn-outline"}" data-order="${esc(s.key)}">${s.price != null ? T("অর্ডার করুন →", "Order now →") : T("কোটেশন চান →", "Get a quote →")}</button></article>`;
  }
  function gridHtml() {
    const list = svcs().filter((s) => st.cat === "all" || s.category === st.cat);
    return list.length ? list.map(cardHtml).join("") : `<p class="muted">${T("এই ক্যাটাগরিতে এখন কিছু নেই।", "Nothing in this category right now.")}</p>`;
  }
  function chipsHtml() {
    const have = new Set(svcs().map((s) => s.category));
    return F.CATS.filter((c) => c[0] === "all" || have.has(c[0])).map((c) => `<button type="button" class="pr-chip" role="tab" aria-selected="${st.cat === c[0]}" data-cat="${c[0]}">${esc(T(c[1], c[2]))}</button>`).join("");
  }
  const STEPS = [
    ["১", "1", "সেবা বেছে নিন", "Pick a service", "আর্টিকেল, পোস্ট, রিলস বা প্যাকেজ — দাম আগেই দেখানো থাকে।", "Article, post, reel or a package — prices are shown up front."],
    ["২", "2", "ব্রিফ পাঠান", "Send your brief", "আপনার ব্র্যান্ড, লক্ষ্য ও প্রয়োজনীয় তথ্য ফর্মে লিখুন।", "Tell us about your brand, goal and what to include."],
    ["৩", "3", "বিকাশে পেমেন্ট", "Pay with bKash", "Send Money করে TrxID দিন। কাস্টম সেবায় আগে কোটেশন পাবেন।", "Send Money and enter the TrxID. Custom services get a quote first."],
    ["৪", "4", "আমরা প্রকাশ করি", "We publish", "কাজ শেষ হলে লিংক “আমার অর্ডার”-এ পাবেন। সব কনটেন্টে “Sponsored” লেবেল থাকে।", "Your link appears in “My orders”. Everything is labelled “Sponsored”."],
  ];
  const FAQ = [
    ["প্রচারিত কনটেন্ট কি স্পষ্টভাবে চিহ্নিত থাকে?", "Is promoted content clearly labelled?", "হ্যাঁ। প্রতিটি পেইড আর্টিকেল, পোস্ট ও ভিডিওতে “Sponsored” বা “Partner content” লেবেল থাকে। আমাদের সম্পাদকীয় সংবাদ আলাদা এবং বিক্রির জন্য নয়।", "Yes. Every paid article, post and video carries a “Sponsored” or “Partner content” label. Our editorial news is separate and not for sale."],
    ["ভিউ বা ফলাফলের নিশ্চয়তা আছে কি?", "Do you guarantee views or results?", "না। আমরা পেজের গড় ও সাম্প্রতিক পারফরম্যান্স দেখাই, কিন্তু প্রতিটি পোস্টের ভিউ আলাদা হয়। কোনো নির্দিষ্ট ভিউ বা বিক্রির প্রতিশ্রুতি দেওয়া হয় না।", "No. We show our page averages and recent performance, but every post is different. We do not promise specific views or sales."],
    ["কীভাবে পেমেন্ট করব?", "How do I pay?", "বিকাশ Send Money করে পেমেন্টের SMS-এর TrxID ও আপনার নম্বর অর্ডার ফর্মে দিন। আমাদের টিম মিলিয়ে নিয়ে নিশ্চিত করে — “আমার অর্ডার” পেজে অবস্থা দেখতে পাবেন। চাইলে অর্ডার করে পরে পেমেন্টও দিতে পারবেন।", "Send Money via bKash, then enter the TrxID from the payment SMS and your number in the order form. Our team matches it and confirms — you can follow the status in “My orders”. You can also place the order now and pay later."],
    ["কুপন কোড কোথায় দেব?", "Where do I use a coupon code?", "অর্ডার ফর্মের সারাংশে “কুপন” ঘরে কোড লিখে Apply চাপুন — ছাড় সাথে সাথে মোট দামে দেখা যাবে।", "Type it in the “Coupon” box in the order summary and press Apply — the discount shows in your total straight away."],
    ["কোন কনটেন্ট আপনারা প্রকাশ করেন না?", "What content do you not publish?", "বিভ্রান্তিকর দাবি, বেআইনি বা বিনিয়োগ-প্রতারণামূলক বার্তা, ঘৃণা বা অশ্লীল কনটেন্ট প্রকাশ করা হয় না। এমন হলে আমরা আগে আপনাকে জানাই।", "Misleading claims, unlawful or investment-scam messages, hateful or adult content are not published. If something is an issue we tell you first."],
    ["বাতিল বা রিফান্ড কীভাবে হয়?", "What about cancellations and refunds?", "কাজ শুরুর আগে বাতিল করা যায়। বিস্তারিত নিয়ম আমাদের রিফান্ড নীতিতে আছে — অথবা পার্টনারশিপ ইমেইলে লিখুন।", "You can cancel before work starts. The details are in our refund policy — or write to our partnerships email."],
  ];
  function homeHtml() {
    const pg = st.pub.page || {};
    const intro = T(pg.intro_bn, pg.intro_en);
    const mail = pg.contact_email || "partnerships@voiceofstartup.bd";
    const wa = String(pg.whatsapp || "").replace(/[^\d]/g, "");
    return `${intro ? `<p class="pr-intro">${esc(intro)}</p>` : ""}${statsHtml()}${campaignHtml()}
      <section class="pr-sec" id="services" aria-labelledby="pr-h-svc"><div class="pr-sec-h"><h2 id="pr-h-svc">${T("সেবা ও দাম", "Services & prices")}</h2><p>${T("যেভাবে আমাদের সাথে কাজ করতে পারেন", "Every way you can work with us")}</p></div>
        <div class="pr-chips" role="tablist" id="pr-chips">${chipsHtml()}</div><div class="pr-grid" id="pr-grid">${gridHtml()}</div></section>
      <section class="pr-sec" aria-labelledby="pr-h-how"><div class="pr-sec-h"><h2 id="pr-h-how">${T("কীভাবে কাজ করে", "How it works")}</h2></div>
        <ol class="pr-steps">${STEPS.map((x) => `<li><span class="pr-sn" aria-hidden="true">${U().lang === "bn" ? x[0] : x[1]}</span><div><h3>${T(x[2], x[3])}</h3><p>${T(x[4], x[5])}</p></div></li>`).join("")}</ol></section>
      <section class="pr-sec" aria-labelledby="pr-h-faq"><div class="pr-sec-h"><h2 id="pr-h-faq">${T("সচরাচর জিজ্ঞাসা", "Questions people ask")}</h2></div>
        <div class="pr-faq">${FAQ.map((q) => `<details><summary>${T(q[0], q[1])}</summary><p>${T(q[2], q[3])}</p></details>`).join("")}</div></section>
      <section class="pr-end"><div><h2>${T("অন্য কিছু ভাবছেন?", "Have something else in mind?")}</h2><p>${T("আপনার আইডিয়া জানান — আমরা প্রস্তাব দেব। কিংবা সরাসরি লিখুন।", "Tell us your idea and we will propose a plan — or write to us directly.")}</p></div>
        <div class="pr-end-a"><button type="button" class="btn btn-orange" data-order="other">${T("আইডিয়া পাঠান", "Send your idea")}</button><a class="btn btn-outline" href="mailto:${esc(mail)}">${esc(mail)}</a>${wa ? `<a class="btn btn-outline" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div></section>`;
  }

  /* ---------- ORDER ---------- */
  const todayIso = () => new Date().toISOString().slice(0, 10);
  function newOrder(s) {
    const u = A().user() || {}, p = st.prof || {};
    return { key: s.key, qty: Math.max(1, s.min_qty || 1), coupon: "", applied: "", free: false, quote: null, cmsg: "", cbusy: false, agree: false, msg: "", busy: false,
      vals: { name: p.full_name || "", phone: p.phone || "", email: u.email || "" } };
  }
  function fieldHtml(k, key) {
    const d = F.F[k], ov = (F.OVR[key] || {})[k];
    const bn = ov ? ov[0] : d[0], en = ov ? ov[1] : d[1], v = (st.o.vals[k] || ""), id = "bf-" + k, type = d[2];
    const req = ["name", "phone", "email", "brand", "what"].includes(k);
    const lab = `<label for="${id}">${esc(T(bn, en))}${req ? ` <i class="req" aria-hidden="true">*</i>` : ""}</label>`;
    const ph = esc(T(d[3] || "", d[4] || ""));
    let ctl;
    if (type === "textarea") ctl = `<textarea id="${id}" data-bf="${k}" rows="${k === "what" ? 4 : 3}" maxlength="${MAX[k] || 1200}" placeholder="${ph}">${esc(v)}</textarea>`;
    else if (type === "select") ctl = `<select id="${id}" data-bf="${k}"><option value="">${T("— বেছে নিন —", "— Select —")}</option>${(d[5] || []).map((o) => `<option value="${esc(o[0])}"${v === o[0] ? " selected" : ""}>${esc(T(o[1], o[2]))}</option>`).join("")}</select>`;
    else if (type === "date") ctl = `<input id="${id}" data-bf="${k}" type="date" min="${todayIso()}" value="${esc(v)}">`;
    else ctl = `<input id="${id}" data-bf="${k}" type="${type === "tel" ? "tel" : type === "email" ? "email" : type === "url" ? "url" : "text"}"${type === "tel" ? ' inputmode="tel"' : ""}${type === "url" ? ' inputmode="url" autocapitalize="off"' : ""} maxlength="${MAX[k] || 200}" placeholder="${ph}" value="${esc(v)}" autocomplete="${k === "name" ? "name" : k === "phone" ? "tel" : k === "email" ? "email" : "off"}">`;
    return `<div class="ac-fld${type === "textarea" || k === "what" ? " ac-span" : ""}">${lab}${ctl}<span class="ac-err" data-err="${k}" role="alert"></span></div>`;
  }
  function kindNow(s) {
    const o = st.o;
    if (o.free) return "free";
    return s.price == null ? "quote" : "paid";
  }
  function totals(s) {
    const o = st.o, kind = kindNow(s);
    if (kind === "free") return { kind, qty: 1, unit: 0, subtotal: 0, discount: 0, amount: 0 };
    if (kind === "quote") return { kind, qty: o.qty, amount: null };
    const q = o.quote && o.applied && o.quote.ok && o.quote.coupon ? o.quote : null;
    const subtotal = s.price * o.qty, discount = q ? Number(q.discount) || 0 : 0;
    return { kind, qty: o.qty, unit: s.price, subtotal, discount, amount: Math.max(0, subtotal - discount), coupon: q ? q.coupon : "" };
  }
  function sumPriceHtml(s) {
    const o = st.o, t = totals(s);
    if (t.kind === "free") return `<div class="pr-total free"><span>${T("মোট", "Total")}</span><b>${T("বিনামূল্যে", "Free")}</b></div><p class="pr-fine">${T("ফ্রি ক্যাম্পেইন স্লট — কোনো পেমেন্ট লাগবে না।", "Free campaign slot — no payment needed.")}</p>`;
    if (t.kind === "quote") return `<div class="pr-total"><span>${T("মোট", "Total")}</span><b class="q">${T("কোটেশন", "Quote")}</b></div><p class="pr-fine">${T("আপনার ব্রিফ দেখে আমরা দাম জানাব। দাম নিশ্চিত হলে “আমার অর্ডার” থেকে পেমেন্ট করবেন — আগে কিছু দিতে হবে না।", "We will review your brief and send a price. Pay from “My orders” once it is set — nothing to pay now.")}</p>`;
    return `<div class="pr-rows"><div><span>${money(t.unit)} × ${nd(t.qty)}</span><b>${money(t.subtotal)}</b></div>${t.discount ? `<div class="disc"><span>${T("কুপন", "Coupon")} ${esc(t.coupon)}</span><b>− ${money(t.discount)}</b></div>` : ""}</div>
      <div class="pr-total"><span>${T("মোট", "Total")}</span><b>${money(t.amount)}</b></div>`;
  }
  function couponHtml(s) {
    const o = st.o;
    if (kindNow(s) !== "paid") return "";
    return `<div class="pr-coupon"><label for="pr-cpn">${T("কুপন কোড", "Coupon code")}</label><div class="pr-coupon-row"><input id="pr-cpn" type="text" maxlength="30" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="${T("যদি থাকে", "If you have one")}" value="${esc(o.coupon)}"${o.applied ? " readonly" : ""}>
      ${o.applied ? `<button type="button" class="btn btn-outline ac-sm" data-act="cpn-off">${T("সরান", "Remove")}</button>` : `<button type="button" class="btn btn-outline ac-sm" data-act="cpn-on"${o.cbusy ? " disabled" : ""}>${o.cbusy ? "…" : T("Apply", "Apply")}</button>`}</div>
      <div class="pr-cmsg ${o.applied ? "ok" : o.cmsg ? "err" : ""}" id="pr-cmsg" role="status">${o.applied ? T("✓ কুপন প্রয়োগ হয়েছে", "✓ Coupon applied") : esc(o.cmsg)}</div></div>`;
  }
  /* payment block — used on the order screen and in "My orders" */
  function payHtml(amount) {
    const P = st.pay, live = liveMethods();
    if (!live.length) return `<div class="ac-note">${T("পেমেন্ট মাধ্যম এখন চালু করা হচ্ছে। অর্ডার করে রাখুন — পেমেন্ট শুরু হলে আমরা নোটিফিকেশনে জানাব।", "Payment methods are being switched on. Place the order now — we will notify you when you can pay.")}</div>`;
    if (!live.some((m) => m.id === P.method)) P.method = live[0].id;
    const m = live.find((x) => x.id === P.method), info = methods()[P.method] || {}, num = info.number || "";
    return `<div class="pay-methods pr-methods" role="radiogroup" aria-label="${T("পেমেন্ট পদ্ধতি", "Payment method")}">${live.map((x) => `<button type="button" role="radio" aria-checked="${P.method === x.id}" class="pay-m on ${P.method === x.id ? "sel" : ""}" data-pm="${x.id}" style="--pc:${x.color}"><span class="pay-mlogo">${esc(x.name)}</span><span class="pay-mtxt">${T("এখন চালু", "Available now")}</span></button>`).join("")}</div>
      <ol class="pay-how"><li>${T(`আপনার ${m.name} অ্যাপ খুলে <b>Send Money</b> বেছে নিন।`, `Open your ${m.name} app and choose <b>Send Money</b>.`)}</li><li>${T("নিচের নম্বরে ঠিক", "Send exactly")} <b>${money(amount)}</b> ${T("পাঠান।", "to the number below.")}</li><li>${T("পেমেন্টের SMS-এর <b>TrxID</b> ও আপনার নম্বর নিচে দিন।", "Enter the <b>TrxID</b> from the SMS and your number below.")}</li></ol>
      ${num ? `<div class="pay-num"><span class="pay-nl">${T("Send Money নম্বর", "Send Money number")}</span><b>${esc(num)}</b><button type="button" class="btn btn-outline ac-sm" data-copy="${esc(num)}">${T("কপি", "Copy")}</button></div>` : ""}
      <div class="pay-num pay-amt"><span class="pay-nl">${T("পাঠানোর পরিমাণ", "Amount to send")}</span><b>${money(amount)}</b><button type="button" class="btn btn-outline ac-sm" data-copy="${Math.round(amount)}">${T("কপি", "Copy")}</button></div>
      <div class="ac-fld"><label for="pay-snd">${T("যে নম্বর থেকে টাকা পাঠিয়েছেন", "The number you sent money from")}</label><input id="pay-snd" inputmode="tel" maxlength="14" autocomplete="tel" placeholder="01XXXXXXXXX" value="${esc(P.sender)}"></div>
      <div class="ac-fld"><label for="pay-trx">${T("ট্রানজেকশন আইডি (TrxID)", "Transaction ID (TrxID)")}</label><input id="pay-trx" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="${T("যেমন: 9AB3C4D5EF", "e.g. 9AB3C4D5EF")}" value="${esc(P.trx)}"></div>`;
  }
  const payBox = (amount) => `<div class="pr-pay" data-amt="${amount}">${payHtml(amount)}</div>`;

  function orderHtml(s) {
    const o = st.o, c = campFor(s), t = totals(s);
    const set = F.SETS[F.SET_OF[s.key] || "other"] || F.SETS.other;
    const unit = T(s.unit_bn, s.unit_en);
    const qtyOk = (s.max_qty || 1) > (s.min_qty || 1);
    return `<div class="pr-back"><a href="#services" data-act="home">← ${T("সব সেবা", "All services")}</a></div>
      <div class="pr-order">
        <form class="pr-form ac-card ac-form" id="pr-form" novalidate autocomplete="on">
          <div class="pr-svc"><span class="pr-ic" aria-hidden="true">${esc(s.icon || "📣")}</span><div><h2>${esc(T(s.name_bn, s.name_en))}</h2><p>${esc(T(s.desc_bn, s.desc_en))}</p></div></div>
          <fieldset><legend>${T("১. আপনার তথ্য", "1. About you")}</legend><div class="ac-grid2">${F.CORE.map((k) => fieldHtml(k, s.key)).join("")}</div></fieldset>
          <fieldset><legend>${T("২. কী প্রচার করবেন", "2. What to promote")}</legend><div class="ac-grid2">${fieldHtml("what", s.key)}${set.map((k) => fieldHtml(k, s.key)).join("")}${fieldHtml("notes", s.key)}</div></fieldset>
          <label class="pr-agree"><input type="checkbox" id="pr-agree" ${o.agree ? "checked" : ""}><span>${T(`আমি জানি কনটেন্টে “Sponsored” লেবেল থাকবে এবং বিভ্রান্তিকর বা বেআইনি কনটেন্ট VOSB প্রকাশ নাও করতে পারে। <a href="/refund-policy" target="_blank" rel="noopener">রিফান্ড নীতি</a>`, `I understand the content will be labelled “Sponsored” and that VOSB may decline misleading or unlawful content. <a href="/refund-policy" target="_blank" rel="noopener">Refund policy</a>`)}</span></label>
        </form>
        <aside class="pr-sum ac-card" aria-label="${T("অর্ডার সারাংশ", "Order summary")}">
          <h3>${T("অর্ডার সারাংশ", "Order summary")}</h3>
          ${c ? `<label class="pr-freebox"><input type="checkbox" id="pr-free" ${o.free ? "checked" : ""}><span><b>🎁 ${T("ফ্রি ক্যাম্পেইন স্লট নিন", "Use the free campaign slot")}</b><small>${esc(T(c.title_bn, c.title_en) || "")}</small></span></label>` : ""}
          ${!o.free && s.price != null && qtyOk ? `<div class="pr-qty"><label for="pr-qty">${T("পরিমাণ", "Quantity")} <small>(${esc(unit)})</small></label><div class="pr-qty-c"><button type="button" class="pr-qb" data-qty="-1" aria-label="${T("কমান", "Decrease")}">−</button><input id="pr-qty" type="text" inputmode="numeric" value="${o.qty}" aria-live="polite"><button type="button" class="pr-qb" data-qty="1" aria-label="${T("বাড়ান", "Increase")}">+</button></div></div>` : (!o.free && s.price != null ? `<p class="pr-fine">${esc(unit)}: ${money(s.price)}</p>` : "")}
          <div id="pr-sprice">${sumPriceHtml(s)}</div>
          <div id="pr-scoupon">${couponHtml(s)}</div>
          <div id="pr-spay">${t.kind === "paid" && t.amount > 0 ? `<h4 class="pr-payh">${T("পেমেন্ট", "Payment")}</h4>${payBox(t.amount)}` : ""}</div>
          <div class="ac-msg ${o.msg ? "err" : ""}" id="pr-msg" role="alert">${esc(o.msg)}</div>
          <div id="pr-sbtn">${btnHtml(s)}</div>
          <p class="pr-fine">${T("পেমেন্টের তথ্য শুধু আমাদের টিম দেখতে পায়। আপনার যোগাযোগের তথ্য শুধু এই অর্ডারের জন্য ব্যবহার হবে।", "Only our team sees your payment details. Your contact details are used only for this order.")}</p>
        </aside>
      </div>`;
  }
  function btnHtml(s) {
    const o = st.o, t = totals(s), b = o.busy;
    if (t.kind === "paid" && t.amount > 0) return `<button type="button" class="btn btn-orange pr-go" data-act="submit-pay"${b ? " disabled" : ""}>${b ? T("জমা হচ্ছে…", "Saving…") : T("অর্ডার ও পেমেন্ট নিশ্চিত করুন", "Confirm order & payment")}</button>
      <button type="button" class="btn btn-outline pr-later" data-act="submit-later"${b ? " disabled" : ""}>${T("অর্ডার করে পরে পেমেন্ট দেব", "Place order — I will pay later")}</button>`;
    return `<button type="button" class="btn btn-orange pr-go" data-act="submit-later"${b ? " disabled" : ""}>${b ? T("জমা হচ্ছে…", "Saving…") : t.kind === "quote" ? T("কোটেশনের অনুরোধ পাঠান", "Send quote request") : T("অর্ডার নিশ্চিত করুন", "Confirm order")}</button>`;
  }
  function refreshSummary() {
    const s = svcByKey(st.o.key); if (!s) return;
    const a = $("#pr-sprice"), b = $("#pr-scoupon"), c = $("#pr-spay"), d = $("#pr-sbtn"); if (!a) return;
    const t = totals(s);
    a.innerHTML = sumPriceHtml(s); b.innerHTML = couponHtml(s); d.innerHTML = btnHtml(s);
    const want = t.kind === "paid" && t.amount > 0;
    const box = c.querySelector(".pr-pay");
    if (!want) c.innerHTML = "";
    else if (!box) c.innerHTML = `<h4 class="pr-payh">${T("পেমেন্ট", "Payment")}</h4>${payBox(t.amount)}`;
    else if (Number(box.dataset.amt) !== t.amount) { box.dataset.amt = t.amount; box.innerHTML = payHtml(t.amount); }
  }
  async function quote() {
    const s = svcByKey(st.o.key), o = st.o; if (!s || !A().isIn()) return;
    const code = (o.coupon || "").trim().toUpperCase();
    if (!code) { o.applied = ""; o.quote = null; o.cmsg = ""; return refreshSummary(); }
    o.cbusy = true; o.cmsg = ""; refreshSummary();
    try {
      const r = await rpc("pr_quote", { p_service: s.id, p_qty: o.qty, p_code: code, p_free: false });
      if (!r || !r.ok) { o.applied = ""; o.quote = null; o.cmsg = (F.ERR[(r || {}).code] ? T(F.ERR[r.code][0], F.ERR[r.code][1]) : T("কুপন প্রয়োগ করা যায়নি।", "Could not apply the coupon.")); }
      else if (r.coupon_error) { o.applied = ""; o.quote = null; o.cmsg = F.ERR[r.coupon_error] ? T(F.ERR[r.coupon_error][0], F.ERR[r.coupon_error][1]) : T("কুপনটি সঠিক নয়।", "This coupon is not valid."); }
      else if (!r.coupon) { o.applied = ""; o.quote = null; o.cmsg = T("কুপন কোডটি সঠিক নয়।", "This coupon code is not valid."); }
      else { o.quote = r; o.applied = r.coupon; o.coupon = r.coupon; o.cmsg = ""; }
    } catch (e) { o.applied = ""; o.quote = null; o.cmsg = prErr(e); }
    o.cbusy = false; refreshSummary();
  }
  let qT = null;
  function setQty(n) {
    const s = svcByKey(st.o.key), o = st.o;
    n = Math.max(s.min_qty || 1, Math.min(s.max_qty || 1, Math.round(Number(n) || 1)));
    o.qty = n; const i = $("#pr-qty"); if (i) i.value = n;
    if (o.applied) { clearTimeout(qT); qT = setTimeout(quote, 250); } else refreshSummary();
  }
  function validate(s) {
    const o = st.o, v = o.vals, set = F.SETS[F.SET_OF[s.key] || "other"];
    $$(".ac-err").forEach((e) => (e.textContent = ""));
    const bad = (k, bn, en2) => { const e = $(`[data-err="${k}"]`); if (e) e.textContent = T(bn, en2); const f = $("#bf-" + k); if (f) f.focus(); return T(bn, en2); };
    if ((v.name || "").trim().length < 2) return bad("name", "আপনার নাম লিখুন।", "Please enter your name.");
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(en(v.phone || "").replace(/[\s-]/g, ""))) return bad("phone", "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter a valid mobile number (01XXXXXXXXX).");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v.email || "").trim())) return bad("email", "সঠিক ইমেইল দিন।", "Enter a valid email.");
    if ((v.brand || "").trim().length < 2) return bad("brand", "ব্র্যান্ড বা কোম্পানির নাম লিখুন।", "Enter your brand or company name.");
    if ((v.what || "").trim().length < 20) return bad("what", "কী প্রচার করতে চান তা অন্তত ২০ অক্ষরে লিখুন।", "Describe what you want to promote (at least 20 characters).");
    if (!o.agree) { const a = $("#pr-agree"); if (a) a.focus(); return T("এগোতে নিচের শর্তে টিক দিন।", "Please tick the agreement to continue."); }
    void set; return "";
  }
  async function submit(payNow) {
    const s = svcByKey(st.o.key), o = st.o; if (o.busy) return;
    let m = validate(s), t = totals(s);
    const P = st.pay;
    if (!m && payNow && t.kind === "paid" && t.amount > 0) {
      P.sender = en(P.sender).replace(/[\s-]/g, ""); P.trx = en(P.trx).replace(/\s/g, "").toUpperCase();
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(P.sender)) m = T("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন (01XXXXXXXXX)।", "Enter the number you sent money from (01XXXXXXXXX).");
      else if (!/^[A-Z0-9]{8,14}$/.test(P.trx)) m = T("পেমেন্টের SMS-এ যেমন আছে হুবহু TrxID লিখুন (৮–১৪ অক্ষর, ইংরেজি অক্ষর ও সংখ্যা)।", "Enter the TrxID exactly as in your payment SMS (8–14 letters/numbers).");
    }
    if (m) { o.msg = m; const e = $("#pr-msg"); if (e) { e.className = "ac-msg err"; e.textContent = m; } return; }
    o.msg = ""; o.busy = true; refreshSummary();
    const brief = {}; const keys = F.CORE.concat(["what"], F.SETS[F.SET_OF[s.key] || "other"], ["notes"]);
    keys.forEach((k) => { const x = String(o.vals[k] || "").trim(); if (x) brief[k] = x; });
    if (brief.phone) brief.phone = en(brief.phone).replace(/[\s-]/g, "");
    const p = { service: s.id, qty: t.kind === "free" ? 1 : o.qty, free: t.kind === "free", coupon: t.kind === "paid" ? (o.coupon || "").trim().toUpperCase() : "", brief };
    if (payNow && t.kind === "paid" && t.amount > 0) { p.method = P.method; p.sender = P.sender; p.trx = P.trx; }
    try {
      const r = await rpc("pr_submit_order", { p });
      st.done = { r, s, brief }; st.o = null; P.trx = ""; await loadOrders(); cta(); render(true);
    } catch (e) { o.busy = false; o.msg = prErr(e); refreshSummary(); const el = $("#pr-msg"); if (el) { el.className = "ac-msg err"; el.textContent = o.msg; } }
  }
  function doneHtml() {
    const { r, s } = st.done, due = r.kind === "paid" && Number(r.amount) > 0 && r.pay_status === "none";
    const ttl = r.kind === "quote" ? T("কোটেশনের অনুরোধ পেয়েছি", "Quote request received") : due ? T("অর্ডার হয়েছে — পেমেন্ট বাকি", "Order placed — payment due") : r.pay_status === "pending" ? T("অর্ডার ও পেমেন্টের তথ্য পেয়েছি", "Order and payment details received") : T("অর্ডার নিশ্চিত", "Order confirmed");
    const txt = r.kind === "quote" ? T("আমাদের টিম আপনার ব্রিফ দেখে দাম জানাবে। দাম ঠিক হলে নোটিফিকেশন পাবেন এবং “আমার অর্ডার” থেকে পেমেন্ট করতে পারবেন।", "Our team will review your brief and send a price. You will get a notification and can pay from “My orders”.")
      : due ? T("পেমেন্ট করলেই আমরা কাজ শুরু করতে পারব। “আমার অর্ডার” থেকে যেকোনো সময় পেমেন্ট করুন।", "We can start once you pay. You can pay any time from “My orders”.")
      : r.pay_status === "pending" ? T("আমাদের টিম আপনার TrxID মিলিয়ে নিচ্ছে। নিশ্চিত হলে নোটিফিকেশন পাবেন।", "Our team is matching your TrxID. You will be notified once it is confirmed.")
      : T("আমাদের টিম শীঘ্রই কাজ শুরু করবে এবং আপনাকে জানাবে।", "Our team will start soon and keep you posted.");
    return `<div class="ac-card pay-state pr-done"><div class="pay-tick" aria-hidden="true">✓</div><h2>${ttl}</h2><p>${txt}</p>
      <p class="pay-inv">${esc(r.order_no)} · ${esc(T(s.name_bn, s.name_en))}${r.amount != null ? " · " + money(r.amount) : ""}</p>
      <div class="ac-acts"><a class="btn btn-orange" href="#orders">${T("আমার অর্ডার", "My orders")}</a><a class="btn btn-outline" href="#services">${T("আরও সেবা দেখুন", "More services")}</a></div></div>`;
  }

  /* ---------- MY ORDERS ---------- */
  function ordersHtml() {
    const list = st.orders || [];
    const head = `<div class="ac-head"><h2>${T("আমার অর্ডার", "My orders")} <span class="ac-count">${nd(list.length)}</span></h2><div class="ac-acts"><button type="button" class="btn btn-outline ac-sm" data-act="refresh">↻ ${T("রিফ্রেশ", "Refresh")}</button><a class="btn btn-orange ac-sm" href="#services">${T("নতুন অর্ডার", "New order")}</a></div></div>`;
    if (st.ordersErr) return head + `<div class="ac-note bad">${esc(st.ordersErr)}</div>`;
    if (!list.length) return head + `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">📣</div><h3>${T("এখনো কোনো অর্ডার নেই", "No orders yet")}</h3><p class="muted">${T("সেবা বেছে নিয়ে প্রথম অর্ডারটি করুন।", "Pick a service to place your first order.")}</p><p><a class="btn btn-orange" href="#services">${T("সেবা দেখুন", "See services")}</a></p></div>`;
    return head + `<div class="pr-ords">${list.map(orderCard).join("")}</div>`;
  }
  function orderCard(o) {
    const sname = T(o.service_name_bn, o.service_name_en), br = o.brief || {};
    const amount = o.amount;
    const waitingQuote = o.kind === "quote" && amount == null && !["cancelled", "rejected"].includes(o.status);
    const canPay = amount > 0 && ["new", "confirmed"].includes(o.status) && ["none", "rejected"].includes(o.pay_status);
    const canCancel = o.status === "new" && !(["pending", "verified"].includes(o.pay_status) && amount > 0);
    const pills = [pill(F.ORDER[o.status] || F.ORDER.new)];
    if (waitingQuote) pills.push(pill(["wait", "কোটেশন তৈরি হচ্ছে", "Quote being prepared"]));
    else if (amount > 0) pills.push(pill(F.PAY[o.pay_status] || F.PAY.none));
    else if (o.kind === "free") pills.push(pill(["ok", "ফ্রি ক্যাম্পেইন", "Free campaign"]));
    const when = U().formatDate(o.created_at);
    const price = waitingQuote ? T("কোটেশন অপেক্ষমাণ", "Quote pending") : o.kind === "free" ? T("বিনামূল্যে", "Free") : `${money(amount)}${o.discount > 0 ? ` <small>(${T("কুপন", "coupon")} ${esc(o.coupon_code || "")} −${money(o.discount)})</small>` : ""}`;
    const quoteReady = o.kind === "quote" && amount > 0 && canPay && o.pay_status === "none";
    return `<article class="ac-card pr-ord" id="o-${esc(o.id)}"><header><div><b class="pr-ono">${esc(o.order_no)}</b><h3>${esc(sname)}${o.qty > 1 ? ` × ${nd(o.qty)}` : ""}</h3><p class="muted">${esc(br.brand || "")}${br.brand ? " · " : ""}${esc(when)}</p></div><div class="ac-pills">${pills.join("")}</div></header>
      <div class="pr-ord-price">${price}</div>
      ${quoteReady ? `<div class="ac-note"><b>${T("আপনার কোটেশন তৈরি", "Your quote is ready")}:</b> ${money(amount)} — ${T("নিচ থেকে পেমেন্ট করুন।", "pay below to get started.")}</div>` : ""}
      ${o.pay_status === "rejected" && amount > 0 ? `<div class="ac-note bad"><b>${T("পেমেন্ট গৃহীত হয়নি", "Payment not accepted")}</b>${o.admin_note ? ": " + esc(o.admin_note) : ""} ${T("সঠিক তথ্য দিয়ে আবার দিন।", "Please send the correct details again.")}</div>`
        : o.admin_note ? `<div class="ac-note"><b>${T("VOSB-এর নোট", "Note from VOSB")}:</b> ${esc(o.admin_note)}</div>` : ""}
      ${o.pay_status === "pending" && amount > 0 ? `<p class="pr-fine">${T("TrxID", "TrxID")} <b>${esc(o.trx_id || "")}</b> · ${esc(((CFG().payMethods || []).find((m) => m.id === o.pay_method) || {}).name || o.pay_method || "")} — ${T("আমরা মিলিয়ে দেখছি।", "we are checking it.")}</p>` : ""}
      ${o.delivered_url ? `<p><a class="btn btn-orange ac-sm" href="${esc(U().safeHref ? U().safeHref(o.delivered_url) : o.delivered_url)}" target="_blank" rel="noopener noreferrer">${T("প্রকাশিত কাজ দেখুন ↗", "View published work ↗")}</a></p>` : ""}
      ${st.payFor === o.id && canPay ? `<div class="pr-payin"><h4>${T("পেমেন্ট", "Payment")} · ${money(amount)}</h4>${payBox(amount)}<div class="ac-msg ${st.pay.msg ? "err" : ""}" id="pay-msg" role="alert">${esc(st.pay.msg)}</div><div class="ac-acts"><button type="button" class="btn btn-orange" data-paysub="${esc(o.id)}"${st.pay.busy ? " disabled" : ""}>${st.pay.busy ? T("জমা হচ্ছে…", "Saving…") : T("পেমেন্ট নিশ্চিত করুন", "Confirm payment")}</button><button type="button" class="btn btn-outline" data-act="paycancel">${T("বন্ধ করুন", "Close")}</button></div></div>` : ""}
      <div class="ac-acts">${canPay && st.payFor !== o.id ? `<button type="button" class="btn btn-orange ac-sm" data-payfor="${esc(o.id)}">${quoteReady ? T("কোটেশন অনুযায়ী পেমেন্ট করুন", "Pay this quote") : T("এখন পেমেন্ট করুন", "Pay now")}</button>` : ""}${canCancel ? (st.cancelAsk === o.id ? `<button type="button" class="btn btn-outline ac-sm ac-danger" data-cancel-yes="${esc(o.id)}">${T("হ্যাঁ, বাতিল করুন", "Yes, cancel it")}</button><button type="button" class="btn btn-outline ac-sm" data-act="cancel-no">${T("না", "No")}</button>` : `<button type="button" class="btn btn-outline ac-sm" data-cancel="${esc(o.id)}">${T("অর্ডার বাতিল", "Cancel order")}</button>`) : ""}</div></article>`;
  }
  async function paySubmit(id) {
    const P = st.pay; if (P.busy) return;
    P.sender = en(P.sender).replace(/[\s-]/g, ""); P.trx = en(P.trx).replace(/\s/g, "").toUpperCase();
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(P.sender)) { P.msg = T("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন (01XXXXXXXXX)।", "Enter the number you sent money from (01XXXXXXXXX)."); return render(true); }
    if (!/^[A-Z0-9]{8,14}$/.test(P.trx)) { P.msg = T("পেমেন্টের SMS-এ যেমন আছে হুবহু TrxID লিখুন (৮–১৪ অক্ষর, ইংরেজি অক্ষর ও সংখ্যা)।", "Enter the TrxID exactly as in your payment SMS (8–14 letters/numbers)."); return render(true); }
    P.busy = true; P.msg = ""; render(true);
    try { await rpc("pr_pay_order", { p_id: id, p_method: P.method, p_sender: P.sender, p_trx: P.trx }); P.busy = false; P.trx = ""; st.payFor = null; await loadOrders(); toast(T("পেমেন্টের তথ্য জমা হয়েছে ✓", "Payment details saved ✓"), "ok"); }
    catch (e) { P.busy = false; P.msg = prErr(e); }
    render(true);
  }
  async function cancelOrder(id) {
    try { await rpc("pr_cancel_order", { p_id: id }); st.cancelAsk = null; await loadOrders(); toast(T("অর্ডার বাতিল হয়েছে", "Order cancelled"), "ok"); }
    catch (e) { toast(prErr(e), "err"); st.cancelAsk = null; }
    render(true);
  }

  /* ---------- shell ---------- */
  function loginCard(why) {
    root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">🔐</div><h2>${esc(why)}</h2>
      <p class="muted">${T("অর্ডার ও পেমেন্ট আপনার অ্যাকাউন্টে সংরক্ষিত থাকে — যেকোনো সময় অবস্থা দেখতে পারবেন।", "Your orders and payments are saved to your account — you can check the status any time.")}</p>
      <p class="ac-acts" style="justify-content:center"><button type="button" class="btn btn-orange" data-act="login">${T("লগইন / সাইন আপ", "Login / Sign up")}</button><a class="btn btn-outline" href="#services">${T("সেবা দেখুন", "See services")}</a></p></div>`;
  }
  function render(keepScroll) {
    cta();
    const r = route();
    if (!st.pub) { root.innerHTML = st.err ? `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">⚠️</div><p>${esc(st.err)}</p><p><button type="button" class="btn btn-orange" data-act="retry">${T("আবার চেষ্টা করুন", "Try again")}</button></p></div>` : `<div class="ac-skel" aria-hidden="true"></div><div class="ac-skel" aria-hidden="true"></div>`; return; }
    if ((st.pub.page || {}).enabled === false) { root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">⏸️</div><h2>${T("পেইড প্রমোশন এখন বন্ধ আছে", "Paid promotion is paused right now")}</h2><p class="muted">${T("কিছুদিন পরে আবার দেখুন, অথবা ইমেইল করুন:", "Please check back soon, or email us:")} <a href="mailto:partnerships@voiceofstartup.bd">partnerships@voiceofstartup.bd</a></p></div>`; return; }
    const changed = st.lastView !== r.v + (r.key || "");
    st.lastView = r.v + (r.key || "");
    if (r.v === "orders") {
      if (!A().isIn()) return loginCard(T("অর্ডার দেখতে লগইন করুন", "Log in to see your orders"));
      if (st.orders == null) { root.innerHTML = `<div class="ac-skel" aria-hidden="true"></div>`; loadOrders().then(() => render(true)); return; }
      root.innerHTML = ordersHtml();
    } else if (r.v === "order") {
      const s = svcByKey(r.key);
      if (!s) { root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">🔎</div><p>${T("সেবাটি পাওয়া যায়নি।", "That service was not found.")}</p><p><a class="btn btn-orange" href="#services">${T("সব সেবা", "All services")}</a></p></div>`; return; }
      if (!A().isIn()) return loginCard(T("অর্ডার করতে লগইন করুন", "Log in to place an order"));
      if (st.done) root.innerHTML = doneHtml();
      else { if (!st.o || st.o.key !== s.key) st.o = newOrder(s); root.innerHTML = orderHtml(s); }
    } else {
      st.o = st.o && st.o.busy ? st.o : null;
      root.innerHTML = homeHtml();
      if (r.anchor && changed) { const el = document.getElementById(r.anchor); if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 30); }
      else if (keepScroll !== true && changed) window.scrollTo(0, 0);
      return;
    }
    if (changed && keepScroll !== true) { const h = $(".pr-hero"); window.scrollTo(0, h ? h.offsetTop + h.offsetHeight - 10 : 0); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act],[data-order],[data-cat],[data-pm],[data-copy],[data-qty],[data-payfor],[data-paysub],[data-cancel],[data-cancel-yes]");
    if (!t || !document.body.contains(t) || !(root.contains(t) || t.closest("#pr-cta"))) return;
    const d = t.dataset;
    if (d.order) { const key = d.order; A().isIn() ? go("#order/" + encodeURIComponent(key)) : A().requireLogin("অর্ডার করতে লগইন করুন", "Log in to place an order").then(() => go("#order/" + encodeURIComponent(key))); return; }
    if (d.cat) { st.cat = d.cat; const c = $("#pr-chips"), g = $("#pr-grid"); if (c) c.innerHTML = chipsHtml(); if (g) g.innerHTML = gridHtml(); return; }
    if (d.pm) { st.pay.method = d.pm; $$(".pr-pay").forEach((x) => (x.innerHTML = payHtml(Number(x.dataset.amt)))); return; }
    if (d.copy) { try { navigator.clipboard.writeText(d.copy).then(() => toast(T("কপি হয়েছে ✓", "Copied ✓"), "ok"), () => toast(d.copy, "")); } catch (x) { toast(d.copy, ""); } return; }
    if (d.qty) { setQty((st.o.qty || 1) + Number(d.qty)); return; }
    if (d.payfor) { st.payFor = d.payfor; st.pay.msg = ""; render(true); const el = document.getElementById("o-" + d.payfor); if (el) el.scrollIntoView({ block: "nearest" }); return; }
    if (d.paysub) { paySubmit(d.paysub); return; }
    if (d.cancel) { st.cancelAsk = d.cancel; render(true); return; }
    if (d.cancelYes) { cancelOrder(d.cancelYes); return; }
    switch (d.act) {
      case "login": A().open("login"); break;
      case "retry": st.err = ""; render(); loadPub().then(() => render()); break;
      case "refresh": st.orders = null; render(true); break;
      case "home": e.preventDefault(); go("#services"); break;
      case "cpn-on": { const i = $("#pr-cpn"); st.o.coupon = i ? i.value.trim().toUpperCase() : ""; if (!st.o.coupon) { st.o.cmsg = T("কুপন কোড লিখুন।", "Enter a coupon code."); refreshSummary(); } else quote(); break; }
      case "cpn-off": st.o.applied = ""; st.o.quote = null; st.o.coupon = ""; st.o.cmsg = ""; refreshSummary(); break;
      case "submit-pay": submit(true); break;
      case "submit-later": submit(false); break;
      case "paycancel": st.payFor = null; st.pay.msg = ""; render(true); break;
      case "cancel-no": st.cancelAsk = null; render(true); break;
    }
  });
  document.addEventListener("input", (e) => {
    const t = e.target; if (!root.contains(t) || !st.o && !t.id.startsWith("pay-")) return;
    if (t.dataset.bf && st.o) { st.o.vals[t.dataset.bf] = t.value; const er = $(`[data-err="${t.dataset.bf}"]`); if (er) er.textContent = ""; }
    else if (t.id === "pr-qty") { const n = Number(en(t.value).replace(/\D/g, "")); if (n) { clearTimeout(qT); qT = setTimeout(() => setQty(n), 400); } }
    else if (t.id === "pr-cpn" && st.o) st.o.coupon = t.value.toUpperCase();
    else if (t.id === "pay-snd") st.pay.sender = t.value;
    else if (t.id === "pay-trx") st.pay.trx = t.value;
  });
  document.addEventListener("change", (e) => {
    const t = e.target; if (!root.contains(t)) return;
    if (t.dataset.bf && st.o) st.o.vals[t.dataset.bf] = t.value;
    else if (t.id === "pr-agree" && st.o) st.o.agree = t.checked;
    else if (t.id === "pr-free" && st.o) { st.o.free = t.checked; if (t.checked) { st.o.applied = ""; st.o.quote = null; } render(true); }
    else if (t.id === "pr-qty") setQty(en(t.value).replace(/\D/g, ""));
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "pr-cpn") { e.preventDefault(); const b = $('[data-act="cpn-on"]'); if (b) b.click(); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && A().isIn() && route().v === "orders" && !st.payFor) loadOrders().then(() => render(true)); });

  whenReady(() => {
    A().onChange(async () => { st.orders = null; st.prof = null; st.o = null; await loadPub(); if (A().isIn()) await loadOrders(); render(true); if (A().isIn() && /^#order\//.test(location.hash) === false && st.want) { const k = st.want; st.want = null; go("#order/" + k); } });
    U().onRender(() => { if (st.pub) render(true); else cta(); });
    cta(); render();
    loadPub().then(async () => { if (A().isIn()) await loadOrders(); render(); });
  });
})();
