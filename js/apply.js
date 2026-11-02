/* Voice of Startup Bangladesh — company listing application (wizard)
   ① Company info  ② Documents  ③ Listing fee (one-time ৳1000, bKash)  ④ Review & submit
   The screen only collects and displays. Ownership, status rules, the payment lock and the
   "paid + documents + details" check on submit are all enforced by the database functions. */
(function () {
  "use strict";
  const AC = window.VOSB_AC;
  if (!AC || !document.body || document.body.dataset.page !== "apply") return;
  const { U, A, T, esc, CFG, $, $$, pickL, friendly, sb, rpc, toast, one, byNew, whenReady, initialOf, label, STATUS, PAYST, pill, latestPay } = AC;
  const C = window.VOSB || {}, S = C.supabase || {};
  const root = $("#app");
  if (!root) return;

  const REG = [["proprietorship", "একক মালিকানা (প্রোপ্রাইটরশিপ)", "Sole proprietorship"], ["partnership", "অংশীদারি", "Partnership"], ["private_ltd", "প্রাইভেট লিমিটেড কোম্পানি", "Private limited company"], ["public_ltd", "পাবলিক লিমিটেড কোম্পানি", "Public limited company"], ["ngo", "এনজিও / সমবায়", "NGO / cooperative"], ["not_registered", "এখনও নিবন্ধিত নয়", "Not registered yet"], ["other", "অন্যান্য", "Other"]];
  const STEPS = [["info", "🏢", "কোম্পানির তথ্য", "Company info"], ["docs", "📄", "ডকুমেন্ট", "Documents"], ["pay", "💳", "লিস্টিং ফি", "Listing fee"], ["submit", "✅", "জমা দিন", "Review & submit"]];
  const MISS = { name: ["info", "কোম্পানির নাম", "Company name"], tagline: ["info", "এক লাইনের পরিচিতি", "Tagline"], description: ["info", "বিস্তারিত বিবরণ (কমপক্ষে ৮০ অক্ষর)", "Description (at least 80 characters)"], category: ["info", "ইন্ডাস্ট্রি", "Industry"], stage: ["info", "ধাপ", "Stage"], division: ["info", "বিভাগ", "Division"], legal_name: ["info", "আইনি নাম", "Legal name"], contact_email: ["info", "যোগাযোগের ইমেইল", "Contact email"], contact_phone: ["info", "যোগাযোগের মোবাইল", "Contact mobile"], terms: ["info", "শর্তে সম্মতি", "Accept the terms"], payment: ["pay", "লিস্টিং ফি পরিশোধ", "Listing fee payment"], doc_trade_license: ["docs", "ট্রেড লাইসেন্স", "Trade licence"], doc_tin: ["docs", "টিআইএন সনদ", "TIN certificate"] };
  const FIELDS = ["name", "tagline", "category", "stage", "founded_year", "website", "division", "district", "team_size", "description", "business_model", "highlights", "revenue_range", "seeking_amount", "equity_offered", "expected_valuation", "use_of_funds", "legal_name", "reg_type", "reg_no", "tin", "bin", "contact_email", "contact_phone", "address"];
  const SOC = [["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["x", "X (Twitter)"], ["instagram", "Instagram"], ["youtube", "YouTube"]];
  const nd = (n) => U().bnDigits(String(n));
  const money = (n) => "৳" + (U().lang === "bn" ? nd(Number(n).toLocaleString("en-IN")) : Number(n).toLocaleString("en-IN"));
  const rid = () => Math.random().toString(36).slice(2, 10);
  const MIN_DESC = 80;

  const st = { ready: false, id: null, co: null, priv: {}, pays: [], docs: [], step: "info", vals: {}, social: {}, team: [{ name: "", role: "" }], dirty: false, saving: null, saveMsg: "", settings: null, pay: { screen: "A", method: "bkash", sender: "", trx: "", msg: "", busy: false, until: 0 }, subMsg: "", missing: [], err: "", done: false };
  let timer = null, poll = null, tick = null, saveT = null, rendering = false;

  const editable = () => !st.co || st.co.status === "draft" || st.co.status === "changes_requested";
  const live = () => st.co && st.co.status === "published";
  const paid = () => st.pays.some((p) => p.status === "verified");
  const pendingPay = () => st.pays.find((p) => p.status === "pending") || null;

  /* ---------- load ---------- */
  async function load(id) {
    const c = await sb();
    const { data, error } = await c.from("companies").select("*,company_private(*),listing_payments(*),company_documents(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) { st.err = T("আবেদনটি পাওয়া যায়নি।", "Application not found."); return false; }
    st.id = data.id; st.co = data; st.priv = one(data.company_private) || {}; st.pays = [].concat(data.listing_payments || []).sort(byNew); st.docs = [].concat(data.company_documents || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    for (const k of FIELDS) st.vals[k] = (k in st.co ? st.co[k] : st.priv[k]);
    st.vals.accepted_terms = !!st.priv.accepted_terms;
    for (const k of FIELDS) if (st.vals[k] == null) st.vals[k] = "";
    st.social = Object.assign({}, st.co.social || {}); st.team = [].concat(st.co.team || []).map((m) => ({ name: m.name || "", role: m.role || "" }));
    if (!st.team.length) st.team = [{ name: "", role: "" }];
    return true;
  }
  async function reloadParts() {
    if (!st.id) return;
    const c = await sb();
    const [p, d, co] = await Promise.all([
      c.from("listing_payments").select("*").eq("company_id", st.id), c.from("company_documents").select("*").eq("company_id", st.id),
      c.from("companies").select("status,logo_url,cover_url,slug,name,company_private(review_note)").eq("id", st.id).maybeSingle()]);
    if (p.data) st.pays = p.data.sort(byNew);
    if (d.data) st.docs = d.data.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (co.data) { Object.assign(st.co, co.data); st.priv.review_note = (one(co.data.company_private) || {}).review_note; }
  }
  async function loadSettings() { try { st.settings = await rpc("get_listing_settings"); } catch (e) { st.settings = st.settings || { fee: CFG().fee || 1000, methods: {} }; } }
  const fee = () => Number((st.settings && st.settings.fee) || CFG().fee || 1000);
  const methodInfo = (id) => ((st.settings && st.settings.methods) || {})[id] || {};

  /* ---------- helpers: form values ---------- */
  function collect() {
    const f = $("#ap-form");
    if (f) {
      for (const k of FIELDS) { const el = f.elements[k]; if (el) st.vals[k] = el.value; }
      const t = f.elements.accepted_terms; if (t) st.vals.accepted_terms = t.checked;
      for (const [k] of SOC) { const el = f.elements["soc_" + k]; if (el) st.social[k] = el.value.trim(); }
      const rows = $$(".ap-trow", f); if (rows.length) st.team = rows.map((r) => ({ name: $("[name=tm_name]", r).value, role: $("[name=tm_role]", r).value }));
    }
  }
  function payload() {
    const v = st.vals, num = (x) => (x === "" || x == null || isNaN(Number(x)) ? null : Number(x));
    const p = { name: v.name, tagline: v.tagline, category: v.category, stage: v.stage, founded_year: num(v.founded_year), website: v.website, division: v.division, district: v.district, team_size: v.team_size, description: v.description, business_model: v.business_model, highlights: v.highlights,
      revenue_range: v.revenue_range, seeking_amount: num(v.seeking_amount), equity_offered: num(v.equity_offered), expected_valuation: num(v.expected_valuation), use_of_funds: v.use_of_funds, social: st.social, team: st.team.filter((m) => m.name.trim()) };
    if (editable()) Object.assign(p, { legal_name: v.legal_name, reg_type: v.reg_type, reg_no: v.reg_no, tin: v.tin, bin: v.bin, contact_email: v.contact_email, contact_phone: v.contact_phone, address: v.address, accepted_terms: !!v.accepted_terms });
    return p;
  }
  function saveNow(quiet) {
    collect();
    const run = async () => {
      st.saveMsg = T("সংরক্ষণ হচ্ছে…", "Saving…"); badge();
      try {
        const id = await rpc("save_company_draft", { p_id: st.id, p: payload() });
        if (!st.id) { st.id = id; try { history.replaceState(null, "", "/apply?c=" + id); } catch (e) {} await load(id); }
        st.dirty = false; st.saveMsg = T("সংরক্ষিত ✓", "Saved ✓");
        if (!quiet) toast(T("সংরক্ষিত হয়েছে", "Saved"), "ok");
      } catch (e) { st.saveMsg = ""; badge(); throw e; }
      badge();
    };
    st.saving = (st.saving || Promise.resolve()).catch(() => {}).then(run);
    return st.saving;
  }
  function autosave() {
    st.dirty = true; st.saveMsg = ""; badge();
    clearTimeout(saveT);
    saveT = setTimeout(() => { collect(); if (!st.id && String(st.vals.name || "").trim().length < 2) return; saveNow(true).catch(() => {}); }, 1800);
  }
  function badge() { const el = $("#ap-saved"); if (el) el.textContent = st.saveMsg || (st.dirty ? T("অসংরক্ষিত পরিবর্তন", "Unsaved changes") : ""); }

  /* ---------- validation (mirrors the database rules) ---------- */
  function infoMissing() {
    collect(); const v = st.vals, m = [];
    if (!String(v.name).trim()) m.push("name"); if (!String(v.tagline).trim()) m.push("tagline");
    if (String(v.description).trim().length < MIN_DESC) m.push("description");
    if (!v.category) m.push("category"); if (!v.stage) m.push("stage"); if (!v.division) m.push("division");
    if (!String(v.legal_name).trim()) m.push("legal_name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.contact_email).trim())) m.push("contact_email");
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(String(v.contact_phone).replace(/[\s-]/g, ""))) m.push("contact_phone");
    if (!v.accepted_terms) m.push("terms");
    return m;
  }
  const hasDoc = (t) => st.docs.some((d) => d.doc_type === t);
  const docsMissing = () => (CFG().docTypes || []).filter((d) => d.required && !hasDoc(d.id)).map((d) => "doc_" + d.id);

  /* ---------- shell ---------- */
  function stepIdx() { return STEPS.findIndex((s) => s[0] === st.step); }
  function stepState(k) {
    if (k === "info") return st.id && !infoMissing().length ? "ok" : "";
    if (k === "docs") return !docsMissing().length && st.id ? "ok" : "";
    if (k === "pay") return paid() ? "ok" : pendingPay() ? "wait" : "";
    return st.co && ["submitted", "in_review", "published"].includes(st.co.status) ? "ok" : "";
  }
  function stepper() {
    return `<ol class="ap-steps" aria-label="${T("ধাপ", "Steps")}">${STEPS.map((s, i) => { const on = s[0] === st.step, ss = stepState(s[0]), lock = i > 0 && !st.id;
      return `<li><button type="button" data-step="${s[0]}" class="${on ? "on" : ""} ${ss}" ${lock ? "disabled" : ""} ${on ? 'aria-current="step"' : ""}><span class="ap-sn">${ss === "ok" ? "✓" : nd(i + 1)}</span><span class="ap-st">${T(s[2], s[3])}</span></button></li>`; }).join("")}</ol>`;
  }
  function banner() {
    if (!st.co) return "";
    const S = STATUS[st.co.status] || STATUS.draft;
    const note = st.priv.review_note && ["changes_requested", "rejected", "suspended"].includes(st.co.status) ? `<div class="ac-note ${st.co.status === "changes_requested" ? "warn" : "bad"}"><b>${T("VOSB-এর নোট", "Note from VOSB")}:</b> ${esc(st.priv.review_note)}</div>` : "";
    return `<div class="ap-status">${pill(S)}<span>${T(S.dbn, S.den)}</span></div>${note}`;
  }
  function render() {
    if (rendering) return; rendering = true;
    try {
      if (!A().isIn()) { loginCard(); return; }
      if (st.err) { root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">⚠️</div><p>${esc(st.err)}</p><p><a class="btn btn-orange" href="/account#companies">${T("আমার কোম্পানি", "My companies")}</a></p></div>`; return; }
      if (!st.ready) { root.innerHTML = `<div class="ac-skel" aria-hidden="true"></div><div class="ac-skel" aria-hidden="true"></div>`; return; }
      if (st.done) { doneView(); return; }
      const closed = st.co && !editable();
      root.innerHTML = `${banner()}${closed && !live() ? "" : stepper()}<div class="ap-body" id="ap-body"></div>`;
      body();
    } finally { rendering = false; }
  }
  function body() {
    const el = $("#ap-body"); if (!el) return;
    clearInterval(poll); poll = null;
    if (st.co && !editable()) { if (live()) { st.step = "info"; infoView(el, true); } else lockedView(el); return; }
    if (st.step === "info") infoView(el); else if (st.step === "docs") docsView(el); else if (st.step === "pay") payView(el); else submitView(el);
  }
  function loginCard() {
    root.innerHTML = `<div class="ac-card ac-center"><div class="ac-big" aria-hidden="true">🔐</div><h2>${T("আবেদন করতে লগইন করুন", "Log in to apply")}</h2>
      <p class="muted">${T("আপনার আবেদন আপনার অ্যাকাউন্টে সংরক্ষিত থাকবে — যেকোনো সময় ফিরে এসে শেষ করতে পারবেন।", "Your application is saved to your account — you can come back and finish any time.")}</p>
      <p><button type="button" class="btn btn-orange" data-act="login">${T("লগইন / সাইন আপ", "Login / Sign up")}</button></p></div>`;
  }
  function lockedView(el) {
    const S = STATUS[st.co.status] || STATUS.draft, pr = latestPay(st.pays);
    el.innerHTML = `<div class="ac-card ap-locked"><div class="ac-big" aria-hidden="true">${st.co.status === "rejected" || st.co.status === "suspended" ? "⛔" : "⏳"}</div>
      <h2>${esc(st.co.name || T("কোম্পানি", "Company"))}</h2><p>${T(S.dbn, S.den)}</p>
      <ul class="ap-check"><li class="ok">${T("কোম্পানির তথ্য জমা", "Company details submitted")}</li><li class="${st.docs.length ? "ok" : ""}">${T(`${nd(st.docs.length)}টি ডকুমেন্ট`, `${st.docs.length} document(s)`)}</li><li class="${paid() ? "ok" : ""}">${pr ? pill(PAYST[pr.status] || PAYST.none) : ""} ${pr ? esc(pr.invoice_no) : ""}</li></ul>
      <p><a class="btn btn-orange" href="/account#companies">${T("আমার কোম্পানি", "My companies")}</a></p></div>`;
  }
  function doneView() {
    root.innerHTML = `<div class="ac-card ac-center ap-done"><div class="ac-big" aria-hidden="true">🎉</div><h2>${T("আবেদন জমা হয়েছে!", "Application submitted!")}</h2>
      <p>${T("ধন্যবাদ। VOSB টিম আপনার ডকুমেন্ট যাচাই করে মূল্যায়ন করবে। অনুমোদন হলেই আপনার কোম্পানি লাইভ হবে — আপনার অ্যাকাউন্টে স্ট্যাটাস দেখতে পারবেন।", "Thank you. The VOSB team will verify your documents and assess your company. It goes live once approved — you can follow the status in your account.")}</p>
      <ul class="ap-next"><li>1. ${T("ডকুমেন্ট যাচাই", "Document check")}</li><li>2. ${T("ভ্যালুয়েশন মূল্যায়ন", "Valuation assessment")}</li><li>3. ${T("অনুমোদন ও লাইভ", "Approval & go-live")}</li></ul>
      <p><a class="btn btn-orange" href="/account#companies">${T("আমার কোম্পানি দেখুন", "View my companies")}</a> <a class="btn btn-outline" href="/companies">${T("সব কোম্পানি", "Browse companies")}</a></p></div>`;
  }

  /* ---------- step 1: info ---------- */
  const fld = (k, lbl, opt) => { opt = opt || {}; const v = st.vals[k] == null ? "" : st.vals[k], id = "f-" + k, dis = opt.dis ? " disabled" : "";
    let ctl;
    if (opt.sel) ctl = `<select id="${id}" name="${k}"${dis}><option value="">${T("বেছে নিন", "Choose")}</option>${opt.sel.map((o) => `<option value="${esc(o[0])}"${String(v) === String(o[0]) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
    else if (opt.area) ctl = `<textarea id="${id}" name="${k}" rows="${opt.area}" maxlength="${opt.max || 1500}"${dis} placeholder="${esc(opt.ph || "")}">${esc(v)}</textarea>`;
    else ctl = `<input id="${id}" name="${k}" type="${opt.type || "text"}" ${opt.min != null ? `min="${opt.min}"` : ""} ${opt.maxn != null ? `max="${opt.maxn}"` : ""} maxlength="${opt.max || 160}" value="${esc(v)}"${dis} placeholder="${esc(opt.ph || "")}" ${opt.inm ? `inputmode="${opt.inm}"` : ""} ${opt.ac ? `autocomplete="${opt.ac}"` : ""}>`;
    return `<div class="ac-fld${opt.span ? " ac-span" : ""}"><label for="${id}">${lbl}${opt.req ? ' <i class="req">*</i>' : ""}</label>${ctl}${opt.help ? `<small class="ac-help">${opt.help}</small>` : ""}<small class="ac-err" data-err="${k}"></small></div>`; };
  function imgField(kind, lbl, url, help) {
    const has = !!url;
    return `<div class="ac-fld ap-img"><label>${lbl}</label><div class="ap-imgrow"><div class="ap-imgbox ${kind}">${has ? `<img src="${esc(U().safeHref(url))}" alt="" referrerpolicy="no-referrer">` : `<span>${kind === "logo" ? esc(initialOf(st.vals.name)) : "🖼"}</span>`}</div>
      <div class="ap-imgact"><label class="btn btn-outline ac-sm ap-file">${has ? T("বদলান", "Change") : T("আপলোড", "Upload")}<input type="file" accept="image/png,image/jpeg,image/webp" data-up="${kind}" hidden></label>${has ? `<button type="button" class="co-link bad" data-imgrm="${kind}">${T("সরান", "Remove")}</button>` : ""}<small class="ac-help">${help}</small></div></div></div>`;
  }
  function infoView(el, liveMode) {
    const v = st.vals, ro = !!liveMode, locked = liveMode ? " disabled" : "";
    const ind = (CFG().industries || []).map((o) => [o.id, pickL(o)]), stg = (CFG().stages || []).map((o) => [o.id, pickL(o)]);
    const divs = Object.keys(CFG().divisions || {}).map((d) => [d, d]), dists = ((CFG().divisions || {})[v.division] || []).map((d) => [d, d]);
    const rev = (CFG().revenueRanges || []).map((o) => [o.id, pickL(o)]), ts = (CFG().teamSizes || []).map((s) => [s, s]);
    const f = (k, l, o) => fld(k, l, Object.assign({ dis: ro && ["name", "category", "stage", "founded_year", "division", "district", "revenue_range", "seeking_amount", "equity_offered", "expected_valuation", "use_of_funds"].includes(k) }, o || {}));
    el.innerHTML = `${liveMode ? `<div class="ac-note"><b>${T("আপনার কোম্পানি লাইভ আছে।", "Your company is live.")}</b> ${T("এখানে শুধু পাবলিক প্রোফাইলের তথ্য (বিবরণ, লোগো, ওয়েবসাইট, টিম, সোশ্যাল) বদলানো যাবে। নাম, ভ্যালুয়েশন বা ডকুমেন্ট বদলাতে VOSB-কে জানান।", "You can edit public profile details here (description, logo, website, team, social). To change the name, valuation or documents, contact VOSB.")}</div>` : ""}
      <form id="ap-form" class="ac-card ac-form ap-form" novalidate>
        <fieldset${""}><legend>🏢 ${T("১. কোম্পানির পরিচিতি", "1. About the company")}</legend><div class="ac-grid2">
          ${f("name", T("কোম্পানি / ব্র্যান্ডের নাম", "Company / brand name"), { req: 1, max: 120, ac: "organization" })}
          ${f("tagline", T("এক লাইনে পরিচিতি", "One-line tagline"), { req: 1, max: 160, ph: T("যেমন: গ্রামের কৃষকদের জন্য ডিজিটাল বাজার", "e.g. A digital market for village farmers") })}
          ${f("category", T("ইন্ডাস্ট্রি", "Industry"), { req: 1, sel: ind })}${f("stage", T("বর্তমান ধাপ", "Current stage"), { req: 1, sel: stg })}
          ${f("founded_year", T("প্রতিষ্ঠার সাল", "Year founded"), { type: "number", min: 1900, maxn: 2100, inm: "numeric", ph: "2022", max: 4 })}${f("team_size", T("টিম সাইজ", "Team size"), { sel: ts })}
          ${f("division", T("বিভাগ", "Division"), { req: 1, sel: divs })}${f("district", T("জেলা", "District"), { sel: dists })}
          ${f("website", T("ওয়েবসাইট", "Website"), { type: "url", max: 300, ph: "https://", span: 1 })}
          ${imgField("logo", T("লোগো", "Logo"), st.co && st.co.logo_url, T("PNG/JPG/WebP — বর্গাকার হলে ভালো", "PNG/JPG/WebP — square works best"))}${imgField("cover", T("কভার ছবি (ঐচ্ছিক)", "Cover image (optional)"), st.co && st.co.cover_url, T("চওড়া ছবি, প্রায় ৪:১", "Wide image, about 4:1"))}
        </div></fieldset>
        <fieldset><legend>📝 ${T("২. বিস্তারিত", "2. Details")}</legend><div class="ac-grid2">
          ${f("description", T("কোম্পানির বিবরণ", "Company description"), { req: 1, area: 7, max: 6000, span: 1, help: T(`কী করেন, কাদের জন্য, কেন আলাদা — কমপক্ষে ${nd(MIN_DESC)} অক্ষর।`, `What you do, for whom, and why you're different — at least ${MIN_DESC} characters.`) })}
          ${f("business_model", T("ব্যবসার মডেল / আয়ের উৎস", "Business model / revenue sources"), { area: 3, max: 1500, span: 1 })}
          ${f("highlights", T("অর্জন ও হাইলাইট", "Achievements & highlights"), { area: 3, max: 1500, span: 1, help: T("পুরস্কার, গ্রাহক সংখ্যা, পার্টনারশিপ, মিডিয়া কভারেজ…", "Awards, customers, partnerships, press…") })}
        </div></fieldset>
        <fieldset><legend>👥 ${T("৩. টিম ও সোশ্যাল লিংক", "3. Team & social links")}</legend>
          <div class="ap-team" id="ap-team">${st.team.map((m, i) => teamRow(m, i)).join("")}</div>
          ${st.team.length < 8 ? `<button type="button" class="btn btn-outline ac-sm" data-act="addmember">＋ ${T("সদস্য যোগ করুন", "Add member")}</button>` : ""}
          <div class="ac-grid2 ap-soc">${SOC.map((s) => `<div class="ac-fld"><label for="soc-${s[0]}">${s[1]}</label><input id="soc-${s[0]}" name="soc_${s[0]}" type="url" maxlength="300" placeholder="https://" value="${esc(st.social[s[0]] || "")}"></div>`).join("")}</div></fieldset>
        <fieldset><legend>📈 ${T("৪. আয় ও তহবিল (ভ্যালুয়েশনের জন্য)", "4. Revenue & funding (for valuation)")}</legend>
          <p class="muted">${T("VOSB টিম আপনার ডকুমেন্ট ও তথ্য দেখে একটি ইঙ্গিতমূলক ভ্যালুয়েশন ঠিক করতে সাহায্য করবে। আপনার প্রত্যাশা জানালে সুবিধা হবে — সব ঘরই ঐচ্ছিক।", "The VOSB team will help set an indicative valuation after checking your documents. Sharing your expectation helps — all fields here are optional.")}</p>
          <div class="ac-grid2">${f("revenue_range", T("মাসিক আয়", "Monthly revenue"), { sel: rev })}${f("seeking_amount", T("কত টাকা তহবিল চাইছেন (৳)", "Funding sought (৳)"), { type: "number", min: 0, inm: "numeric", max: 14 })}
          ${f("equity_offered", T("অফার করা ইকুইটি (%)", "Equity offered (%)"), { type: "number", min: 0, maxn: 100, inm: "decimal", max: 6 })}${f("expected_valuation", T("আপনার প্রত্যাশিত ভ্যালুয়েশন (৳)", "Your expected valuation (৳)"), { type: "number", min: 0, inm: "numeric", max: 14 })}
          ${f("use_of_funds", T("তহবিল কোথায় ব্যবহার করবেন", "How you will use the funds"), { area: 3, max: 1500, span: 1 })}</div></fieldset>
        ${liveMode ? "" : `<fieldset><legend>🔒 ${T("৫. আইনি ও যোগাযোগের তথ্য", "5. Legal & contact details")}</legend><p class="muted ap-priv">🔒 ${T("এই অংশ শুধু VOSB অ্যাডমিন দেখতে পাবে — পাবলিক পেজে দেখানো হবে না।", "Only VOSB admins can see this section — it is never shown publicly.")}</p><div class="ac-grid2">
          ${f("legal_name", T("আইনি নাম (ট্রেড লাইসেন্স অনুযায়ী)", "Legal name (as on trade licence)"), { req: 1, max: 160 })}${f("reg_type", T("প্রতিষ্ঠানের ধরন", "Business type"), { sel: REG.map((r) => [r[0], T(r[1], r[2])]) })}
          ${f("reg_no", T("ট্রেড লাইসেন্স / রেজিস্ট্রেশন নম্বর", "Trade licence / registration no."), { max: 60 })}${f("tin", T("টিআইএন (TIN)", "TIN"), { max: 40, inm: "numeric" })}
          ${f("bin", T("বিআইএন (BIN, থাকলে)", "BIN (if any)"), { max: 40 })}${f("contact_email", T("যোগাযোগের ইমেইল", "Contact email"), { req: 1, type: "email", max: 200, ac: "email" })}
          ${f("contact_phone", T("যোগাযোগের মোবাইল", "Contact mobile"), { req: 1, type: "tel", max: 20, inm: "tel", ph: "01XXXXXXXXX", ac: "tel" })}${f("address", T("ঠিকানা", "Address"), { max: 400 })}
          <div class="ac-fld ac-span"><label class="ac-chk"><input type="checkbox" name="accepted_terms" ${v.accepted_terms ? "checked" : ""}><span>${T("আমি নিশ্চিত করছি, দেওয়া তথ্য সঠিক এবং আমি এই কোম্পানির প্রতিনিধিত্ব করার অধিকার রাখি। আমি <a href='/terms-of-service' target='_blank' rel='noopener'>শর্তাবলী</a>, <a href='/privacy-policy' target='_blank' rel='noopener'>প্রাইভেসি</a> ও <a href='/refund-policy' target='_blank' rel='noopener'>রিফান্ড নীতি</a> পড়েছি ও মেনে নিচ্ছি।", "I confirm the information is accurate and that I am authorised to represent this company. I have read and accept the <a href='/terms-of-service' target='_blank' rel='noopener'>Terms</a>, <a href='/privacy-policy' target='_blank' rel='noopener'>Privacy Policy</a> and <a href='/refund-policy' target='_blank' rel='noopener'>Refund Policy</a>.")}</span></label><small class="ac-err" data-err="terms"></small></div>
        </div></fieldset>`}
        <div class="ac-msg" id="ap-msg" role="alert" aria-live="polite"></div>
        <div class="ap-nav"><span class="ap-saved" id="ap-saved" aria-live="polite">${esc(st.saveMsg)}</span><div class="ac-acts">
          <button class="btn btn-outline" type="button" data-act="save">${T("সংরক্ষণ", "Save")}</button>
          ${liveMode ? `<button class="btn btn-orange" type="submit">${T("পরিবর্তন প্রকাশ করুন", "Save changes")}</button>` : `<button class="btn btn-orange" type="submit">${T("সংরক্ষণ করে এগিয়ে যান →", "Save & continue →")}</button>`}</div></div>
      </form>`;
  }
  const teamRow = (m, i) => `<div class="ap-trow"><input name="tm_name" maxlength="80" placeholder="${T("নাম", "Name")}" value="${esc(m.name)}" aria-label="${T("সদস্যের নাম", "Member name")}"><input name="tm_role" maxlength="80" placeholder="${T("পদবি (যেমন: সিইও)", "Role (e.g. CEO)")}" value="${esc(m.role)}" aria-label="${T("পদবি", "Role")}"><button type="button" class="co-link bad" data-delmember="${i}" aria-label="${T("সরান", "Remove")}">✕</button></div>`;

  async function infoSubmit(liveMode) {
    const msg = $("#ap-msg"); msg.className = "ac-msg"; msg.textContent = "";
    $$("[data-err]").forEach((e) => { e.textContent = ""; });
    const bad = liveMode ? [] : infoMissing();
    if (bad.length) {
      bad.forEach((k) => { const e = $(`[data-err="${k}"]`); if (e) e.textContent = T("এটি দিতে হবে", "Required"); });
      msg.className = "ac-msg err"; msg.textContent = T("লাল চিহ্নিত ঘরগুলো পূরণ করুন: ", "Please complete: ") + bad.map((k) => T(MISS[k][1], MISS[k][2])).join(", ");
      const first = $(`[name="${bad[0] === "terms" ? "accepted_terms" : bad[0]}"]`); if (first) first.focus();
      return;
    }
    const btn = $("#ap-form [type=submit]"); btn.disabled = true;
    try { await saveNow(liveMode ? false : true); if (liveMode) { msg.className = "ac-msg ok"; msg.textContent = T("সংরক্ষণ হয়েছে ✓", "Saved ✓"); } else go("docs"); }
    catch (e) { msg.className = "ac-msg err"; msg.textContent = friendly(e); }
    btn.disabled = false;
  }

  /* ---------- image upload (logo / cover) ---------- */
  function resize(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); const r = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * r), h = Math.round(img.height * r), cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => { if (b && b.type === "image/webp") res({ blob: b, ext: "webp" }); else cv.toBlob((j) => (j ? res({ blob: j, ext: "jpg" }) : rej(new Error("image"))), "image/jpeg", 0.88); }, "image/webp", 0.88); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(T("ছবিটি পড়া যায়নি।", "Could not read this image."))); };
      img.src = url;
    });
  }
  async function uploadImg(kind, file) {
    const msg = $("#ap-msg"); msg.className = "ac-msg"; msg.textContent = "";
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { msg.className = "ac-msg err"; msg.textContent = T("শুধু PNG, JPG বা WebP ছবি দিন।", "Please choose a PNG, JPG or WebP image."); return; }
    if (file.size > 8 * 1024 * 1024) { msg.className = "ac-msg err"; msg.textContent = T("ছবি ৮ MB-এর কম হতে হবে।", "Image must be under 8 MB."); return; }
    try {
      msg.textContent = T("আপলোড হচ্ছে…", "Uploading…");
      if (!st.id) { collect(); await saveNow(true); }
      const { blob, ext } = await resize(file, kind === "logo" ? 512 : 1400);
      const uid = (A().user() || {}).id, path = `${uid}/${st.id}/${kind}-${rid()}.${ext}`, c = await sb();
      const up = await c.storage.from("company-logos").upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" });
      if (up.error) throw up.error;
      const url = c.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
      collect(); await rpc("save_company_draft", { p_id: st.id, p: { [kind + "_url"]: url } });
      st.co[kind + "_url"] = url; infoView($("#ap-body"), live()); msg.className = "ac-msg ok"; $("#ap-msg").textContent = T("ছবি যুক্ত হয়েছে ✓", "Image added ✓");
    } catch (e) { const m = $("#ap-msg"); m.className = "ac-msg err"; m.textContent = friendly(e); }
  }

  /* ---------- step 2: documents ---------- */
  function fmtSize(n) { n = Number(n) || 0; return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function docsView(el) {
    const types = CFG().docTypes || [], miss = docsMissing();
    el.innerHTML = `<div class="ac-card ap-docs"><h3>📄 ${T("প্রয়োজনীয় ডকুমেন্ট", "Supporting documents")}</h3>
      <p class="muted">${T("PDF, JPG, PNG বা WebP — প্রতিটি সর্বোচ্চ ১০ MB। ডকুমেন্ট শুধু VOSB অ্যাডমিন দেখতে পাবে, পাবলিকলি দেখানো হবে না।", "PDF, JPG, PNG or WebP — up to 10 MB each. Documents are visible only to VOSB admins and are never shown publicly.")}</p>
      <div class="ap-doclist">${types.map((t) => { const ds = st.docs.filter((d) => d.doc_type === t.id);
        return `<div class="ap-doc ${ds.length ? "ok" : t.required ? "need" : ""}"><div class="ap-doc-h"><b>${esc(pickL(t))}</b><span class="ap-tag ${t.required ? "req" : ""}">${t.required ? T("বাধ্যতামূলক", "Required") : T("ঐচ্ছিক", "Optional")}</span></div>
          ${ds.map((d) => `<div class="ap-file-row"><span class="ap-fi">📎</span><span class="ap-fn">${esc(d.file_name)}<small>${esc(fmtSize(d.file_size))}${d.status && d.status !== "pending" ? " · " + esc(d.status) : ""}</small></span><button type="button" class="co-link bad" data-docrm="${esc(d.id)}">${T("সরান", "Remove")}</button></div>`).join("")}
          <label class="btn btn-outline ac-sm ap-file">${ds.length ? T("আরেকটি যোগ করুন", "Add another") : T("ফাইল আপলোড", "Upload file")}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" data-doc="${esc(t.id)}" hidden></label></div>`; }).join("")}</div>
      <div class="ac-msg" id="ap-msg" role="alert" aria-live="polite"></div>
      <div class="ap-nav"><button class="btn btn-outline" type="button" data-step="info">← ${T("পেছনে", "Back")}</button><div class="ac-acts">${miss.length ? `<span class="muted ap-warn">${T("এখনও বাকি: ", "Still needed: ")}${miss.map((k) => T(MISS[k][1], MISS[k][2])).join(", ")}</span>` : ""}<button class="btn btn-orange" type="button" data-step="pay">${T("এগিয়ে যান →", "Continue →")}</button></div></div></div>`;
  }
  async function uploadDoc(type, file) {
    const msg = $("#ap-msg"); const say = (t, k) => { if (msg) { msg.className = "ac-msg " + (k || ""); msg.textContent = t; } };
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) return say(T("শুধু PDF, JPG, PNG বা WebP ফাইল দিন।", "Only PDF, JPG, PNG or WebP files are allowed."), "err");
    if (file.size > 10 * 1024 * 1024) return say(T("ফাইল ১০ MB-এর কম হতে হবে।", "File must be under 10 MB."), "err");
    say(T("আপলোড হচ্ছে…", "Uploading…"));
    const uid = (A().user() || {}).id, ext = ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[file.type], path = `${uid}/${st.id}/${type}-${rid()}.${ext}`;
    let up = false;
    try {
      const c = await sb(); const r = await c.storage.from("company-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (r.error) throw r.error; up = true;
      await rpc("add_company_document", { p_company: st.id, p_type: type, p_path: path, p_name: file.name, p_size: file.size, p_mime: file.type });
      await reloadParts(); docsView($("#ap-body")); toast(T("ডকুমেন্ট যুক্ত হয়েছে", "Document added"), "ok");
    } catch (e) {
      if (up) { try { (await sb()).storage.from("company-docs").remove([path]); } catch (x) {} }
      say(friendly(e), "err");
    }
  }
  async function removeDoc(id) {
    if (!confirm(T("এই ডকুমেন্টটি সরাবেন?", "Remove this document?"))) return;
    try { const fp = await rpc("remove_company_document", { p_id: id }); try { if (fp) (await sb()).storage.from("company-docs").remove([fp]); } catch (x) {} await reloadParts(); docsView($("#ap-body")); }
    catch (e) { const m = $("#ap-msg"); if (m) { m.className = "ac-msg err"; m.textContent = friendly(e); } }
  }

  /* ---------- step 3: payment ---------- */
  const bk = () => `<span class="pay-wm" style="--pc:#e2136e">bKash</span>`;
  const payHead = (sub) => `<div class="pay-head"><div class="pay-brand"><span class="pay-vosb">VOSB</span><span>${T("কোম্পানি লিস্টিং ফি", "Company listing fee")}</span></div><div class="pay-amt">${money(fee())}<small>${T("একবারের ফি · চিরকালের জন্য", "one-time · forever")}</small></div>${sub || ""}</div>`;
  function payView(el) {
    if (!st.id) { el.innerHTML = `<div class="ac-card ac-center"><p>${T("আগে কোম্পানির তথ্য সংরক্ষণ করুন।", "Save your company details first.")}</p><button class="btn btn-orange" data-step="info">${T("তথ্য দিন", "Company info")}</button></div>`; return; }
    const pr = pendingPay(), ok = st.pays.find((p) => p.status === "verified");
    if (ok) {
      el.innerHTML = `<div class="ac-card pay-card pay-ok">${payHead()}<div class="pay-state"><div class="pay-tick" aria-hidden="true">✓</div><h3>${T("পেমেন্ট সম্পন্ন হয়েছে", "Payment successful")}</h3>
        <p>${T("ধন্যবাদ! আপনার লিস্টিং ফি পরিশোধিত — আর কখনো দিতে হবে না।", "Thank you! Your listing fee is paid — you never need to pay again.")}</p><p class="pay-inv">${esc(ok.invoice_no)} · ${esc(ok.method)} · ${esc(ok.trx_id)}</p>
        <div class="ac-acts"><button class="btn btn-outline" data-step="docs">← ${T("পেছনে", "Back")}</button><button class="btn btn-orange" data-step="submit">${T("পরের ধাপ →", "Next →")}</button></div></div></div>`;
      return;
    }
    if (pr) { waitView(el, pr); return; }
    const P = st.pay;
    const last = st.pays[0];
    const rejected = last && last.status === "rejected" ? `<div class="ac-note bad"><b>${T("আগের পেমেন্ট গৃহীত হয়নি", "Your previous payment was not accepted")}</b>${last.note ? ": " + esc(last.note) : ""}. ${T("সঠিক ট্রানজেকশন আইডি দিয়ে আবার চেষ্টা করুন।", "Please try again with the correct Transaction ID.")}</div>` : "";
    if (P.screen === "A") {
      el.innerHTML = `<div class="ac-card pay-card">${payHead()}${rejected}<h3 class="pay-h">${T("পেমেন্ট পদ্ধতি বেছে নিন", "Choose a payment method")}</h3>
        <div class="pay-methods" role="radiogroup">${(CFG().payMethods || []).map((m) => { const on = !!methodInfo(m.id).enabled; return `<button type="button" role="radio" aria-checked="${on && P.method === m.id}" class="pay-m ${on ? "on" : "off"} ${on && P.method === m.id ? "sel" : ""}" data-pm="${m.id}" ${on ? "" : "disabled"} style="--pc:${m.color}"><span class="pay-mlogo">${esc(m.name)}</span><span class="pay-mtxt">${on ? T("এখন চালু", "Available now") : T("শীঘ্রই আসছে", "Coming soon")}</span></button>`; }).join("")}</div>
        <div class="ap-nav"><button class="btn btn-outline" type="button" data-step="docs">← ${T("পেছনে", "Back")}</button><button class="btn btn-orange" type="button" data-pay="toB">${T("পরবর্তী →", "Next →")}</button></div></div>`;
    } else if (P.screen === "B") {
      el.innerHTML = `<div class="ac-card pay-card">${payHead()}<div class="pay-via">${T("পেমেন্ট মাধ্যম", "Pay with")} ${bk()}</div>
        <div class="ac-fld"><label for="pay-snd">${T("যে বিকাশ নম্বর থেকে টাকা পাঠাবেন", "The bKash number you will send money from")}</label><input id="pay-snd" inputmode="tel" maxlength="14" autocomplete="tel" placeholder="01XXXXXXXXX" value="${esc(P.sender)}"></div>
        <div class="ac-msg ${P.msg ? "err" : ""}" id="pay-msg" role="alert">${esc(P.msg)}</div>
        <div class="ap-nav"><button class="btn btn-outline" type="button" data-pay="toA">← ${T("পেছনে", "Back")}</button><button class="btn btn-orange" type="button" data-pay="toC">${T("পরবর্তী →", "Next →")}</button></div></div>`;
    } else {
      const mi = methodInfo(P.method), num = mi.number || "";
      if (!P.until) P.until = Date.now() + 15 * 60 * 1000;
      el.innerHTML = `<div class="ac-card pay-card">${payHead(`<div class="pay-timer" aria-live="off">${T("সময় বাকি", "Time left")} <b id="pay-t">15:00</b></div>`)}
        <ol class="pay-how"><li>${T("আপনার বিকাশ অ্যাপ বা *247# ডায়াল করে <b>Send Money</b> বেছে নিন।", "Open your bKash app (or dial *247#) and choose <b>Send Money</b>.")}</li><li>${T("নিচের নম্বরে ঠিক", "Send exactly")} <b>${money(fee())}</b> ${T("পাঠান।", "to the number below.")}</li><li>${T("পেমেন্টের SMS-এ পাওয়া <b>TrxID</b> নিচে লিখে ভেরিফাই করুন।", "Enter the <b>TrxID</b> from the payment SMS below and verify.")}</li></ol>
        <div class="pay-num" ${num ? "" : "hidden"}><span class="pay-nl">${T("Send Money নম্বর", "Send Money number")}</span><b id="pay-num">${esc(num)}</b><button type="button" class="btn btn-outline ac-sm" data-pay="copy">${T("কপি", "Copy")}</button></div>
        <div class="pay-from">${T("আপনার নম্বর:", "Your number:")} <b>${esc(P.sender)}</b> <button type="button" class="co-link" data-pay="toB">${T("বদলান", "Change")}</button></div>
        <div class="ac-fld"><label for="pay-trx">${T("ট্রানজেকশন আইডি (TrxID)", "Transaction ID (TrxID)")}</label><input id="pay-trx" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="${T("যেমন: 9AB3C4D5EF", "e.g. 9AB3C4D5EF")}" value="${esc(P.trx)}"></div>
        <div class="ac-msg ${P.msg ? "err" : ""}" id="pay-msg" role="alert">${esc(P.msg)}</div>
        <button class="btn btn-orange pay-go" type="button" data-pay="verify" ${P.busy ? "disabled" : ""}>${T("TrxID দিয়ে ভেরিফাই করুন", "Verify with TrxID")}</button>
        <p class="pay-note">${T("আপনার পেমেন্ট VOSB টিম যাচাই করবে — সাধারণত কয়েক মিনিট থেকে কয়েক ঘণ্টার মধ্যে। যাচাই হলেই আবেদন জমা দিতে পারবেন।", "The VOSB team verifies each payment — usually within minutes to a few hours. Once verified you can submit your application.")}</p>
        <button class="btn btn-outline" type="button" data-pay="toB">← ${T("পেছনে", "Back")}</button></div>`;
      clearInterval(tick); tick = setInterval(() => { const t = $("#pay-t"); if (!t) return clearInterval(tick); const s = Math.max(0, Math.round((P.until - Date.now()) / 1000)); t.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); if (!s) { clearInterval(tick); P.until = 0; P.screen = "B"; P.msg = T("সময় শেষ হয়েছে — আবার শুরু করুন।", "Time is up — please start again."); payView($("#ap-body")); } }, 1000);
    }
  }
  function waitView(el, pr) {
    el.innerHTML = `<div class="ac-card pay-card pay-wait">${payHead()}<div class="pay-state"><div class="pay-spin" aria-hidden="true"></div><h3>${T("পেমেন্ট যাচাই চলছে", "Verifying your payment")}</h3>
      <p>${T("আপনার TrxID পেয়েছি। VOSB টিম যাচাই করছে — এই পেজ খোলা রাখতে পারেন, যাচাই হলে নিজে থেকেই জানাবে। চাইলে পরে ফিরে এসে অ্যাকাউন্ট থেকেও দেখতে পারবেন।", "We have your TrxID and the VOSB team is verifying it. You can keep this page open — it updates by itself. You can also come back later from your account.")}</p>
      <p class="pay-inv">${esc(pr.invoice_no)} · ${esc(pr.method)} · TrxID ${esc(pr.trx_id)}</p><div class="ac-acts"><button class="btn btn-outline" data-step="docs">← ${T("ডকুমেন্ট", "Documents")}</button><button class="btn btn-outline" data-act="recheck">${T("এখনই দেখুন", "Check now")}</button></div></div></div>`;
    clearInterval(poll);
    poll = setInterval(async () => { if (!$(".pay-wait")) return clearInterval(poll); await recheck(true); }, 8000);
  }
  async function recheck(quiet) {
    try { const before = paid(); await reloadParts(); if (paid() && !before) { toast(T("পেমেন্ট যাচাই হয়েছে ✓", "Payment verified ✓"), "ok"); render(); } else if (!pendingPay() && !paid()) render(); else if (!quiet) toast(T("এখনও যাচাই চলছে…", "Still being verified…"), ""); } catch (e) {}
  }
  async function payAct(a) {
    const P = st.pay;
    if (a === "toA") { P.screen = "A"; P.msg = ""; return payView($("#ap-body")); }
    if (a === "toB") { if (P.screen === "A" && !methodInfo(P.method).enabled) return; P.screen = "B"; P.msg = ""; P.until = 0; clearInterval(tick); return payView($("#ap-body")); }
    if (a === "toC") { const s = ($("#pay-snd").value || "").replace(/[\s-]/g, ""); P.sender = s;
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(s)) { P.msg = T("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter a valid mobile number (01XXXXXXXXX)."); return payView($("#ap-body")); }
      P.msg = ""; P.screen = "C"; P.until = 0; return payView($("#ap-body")); }
    if (a === "copy") { const n = ($("#pay-num") || {}).textContent || ""; try { await navigator.clipboard.writeText(n); toast(T("নম্বর কপি হয়েছে ✓", "Number copied ✓"), "ok"); } catch (e) { toast(n, ""); } return; }
    if (a === "verify") {
      P.trx = ($("#pay-trx").value || "").replace(/\s/g, "").toUpperCase();
      if (!/^[A-Z0-9]{8,14}$/.test(P.trx)) { P.msg = T("পেমেন্টের SMS-এ যেমন আছে হুবহু TrxID লিখুন (৮–১৪ অক্ষর, ইংরেজি অক্ষর ও সংখ্যা)।", "Enter the TrxID exactly as in your payment SMS (8–14 letters/numbers)."); return payView($("#ap-body")); }
      P.busy = true; P.msg = ""; payView($("#ap-body"));
      try { await rpc("submit_listing_payment", { p_company: st.id, p_method: P.method, p_sender: P.sender, p_trx: P.trx }); P.busy = false; P.trx = ""; P.until = 0; clearInterval(tick); await reloadParts(); payView($("#ap-body")); }
      catch (e) { P.busy = false; P.msg = friendly(e); payView($("#ap-body")); }
    }
  }

  /* ---------- step 4: review & submit ---------- */
  function submitView(el) {
    const im = infoMissing(), dm = docsMissing(), pm = paid() ? [] : ["payment"];
    const row = (ok, bn, en, step, hint) => `<li class="${ok ? "ok" : "bad"}"><span class="ap-ck">${ok ? "✓" : "!"}</span><span>${T(bn, en)}${hint ? `<small>${hint}</small>` : ""}</span>${ok ? "" : `<button type="button" class="co-link" data-step="${step}">${T("ঠিক করুন", "Fix")}</button>`}</li>`;
    const all = !im.length && !dm.length && !pm.length, pr = pendingPay();
    el.innerHTML = `<div class="ac-card ap-sub"><h3>✅ ${T("রিভিউ ও জমা", "Review & submit")}</h3><p class="muted">${T("জমা দেওয়ার পর VOSB টিম রিভিউ শেষ না হওয়া পর্যন্ত তথ্য বদলানো যাবে না।", "After you submit, details are locked while the VOSB team reviews them.")}</p>
      <ul class="ap-check">${row(!im.length, "কোম্পানির তথ্য সম্পূর্ণ", "Company details complete", "info", im.length ? esc(im.map((k) => T(MISS[k][1], MISS[k][2])).join(", ")) : "")}
        ${row(!dm.length, "বাধ্যতামূলক ডকুমেন্ট (ট্রেড লাইসেন্স, টিআইএন)", "Required documents (trade licence, TIN)", "docs", dm.length ? esc(dm.map((k) => T(MISS[k][1], MISS[k][2])).join(", ")) : "")}
        ${row(!pm.length, "লিস্টিং ফি পরিশোধ (একবারের ৳" + nd(fee()) + ")", "Listing fee paid (one-time ৳" + fee() + ")", "pay", pr ? T("যাচাই চলছে — যাচাই হলে জমা দিতে পারবেন।", "Being verified — you can submit once it is confirmed.") : "")}</ul>
      <div class="ac-msg ${st.subMsg ? "err" : ""}" id="ap-msg" role="alert">${esc(st.subMsg)}</div>
      <div class="ap-nav"><button class="btn btn-outline" type="button" data-step="pay">← ${T("পেছনে", "Back")}</button><button class="btn btn-orange" type="button" data-act="submit" ${all ? "" : "disabled"}>${T("আবেদন জমা দিন", "Submit application")}</button></div></div>`;
  }
  async function submitApp() {
    const btn = $("[data-act=submit]"); if (btn) btn.disabled = true; st.subMsg = "";
    try {
      const r = await rpc("submit_company_application", { p_id: st.id });
      if (r && r.ok) { st.done = true; await reloadParts().catch(() => {}); render(); return; }
      const miss = (r && r.missing) || []; st.subMsg = T("এগুলো এখনও বাকি: ", "Still missing: ") + miss.map((k) => (MISS[k] ? T(MISS[k][1], MISS[k][2]) : k)).join(", ");
      if (MISS[miss[0]]) st.step = MISS[miss[0]][0];
      await reloadParts().catch(() => {}); render();
    } catch (e) { st.subMsg = friendly(e); submitView($("#ap-body")); }
  }

  /* ---------- navigation ---------- */
  async function go(step) {
    if (!st.id && step !== "info") return;
    if (st.step === "info" && $("#ap-form") && editable()) { try { await saveNow(true); } catch (e) { const m = $("#ap-msg"); if (m) { m.className = "ac-msg err"; m.textContent = friendly(e); } return; } }
    if (step === "pay") { try { await reloadParts(); } catch (e) {} }
    st.step = step; st.subMsg = ""; render(); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
  }

  /* ---------- events ---------- */
  root.addEventListener("click", async (e) => {
    const t = e.target;
    const step = t.closest("[data-step]"); if (step && !step.disabled) return go(step.dataset.step);
    const act = t.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "login") return A().open("login");
      if (a === "save") { const b = act; b.disabled = true; try { await saveNow(false); } catch (er) { const m = $("#ap-msg"); if (m) { m.className = "ac-msg err"; m.textContent = friendly(er); } } b.disabled = false; return; }
      if (a === "addmember") { collect(); if (st.team.length < 8) st.team.push({ name: "", role: "" }); infoView($("#ap-body"), live()); return; }
      if (a === "submit") return submitApp();
      if (a === "recheck") return recheck(false);
    }
    const dm = t.closest("[data-delmember]"); if (dm) { collect(); st.team.splice(+dm.dataset.delmember, 1); if (!st.team.length) st.team = [{ name: "", role: "" }]; infoView($("#ap-body"), live()); autosave(); return; }
    const pm = t.closest("[data-pm]"); if (pm && !pm.disabled) { st.pay.method = pm.dataset.pm; return payView($("#ap-body")); }
    const pa = t.closest("[data-pay]"); if (pa) return payAct(pa.dataset.pay);
    const dr = t.closest("[data-docrm]"); if (dr) return removeDoc(dr.dataset.docrm);
    const ir = t.closest("[data-imgrm]"); if (ir) { const k = ir.dataset.imgrm; try { collect(); await rpc("save_company_draft", { p_id: st.id, p: { [k + "_url"]: "" } }); st.co[k + "_url"] = null; infoView($("#ap-body"), live()); } catch (er) { toast(friendly(er), "err"); } }
  });
  root.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.up) { const f = el.files && el.files[0]; el.value = ""; if (f) uploadImg(el.dataset.up, f); return; }
    if (el.dataset && el.dataset.doc) { const f = el.files && el.files[0]; el.value = ""; if (f) uploadDoc(el.dataset.doc, f); return; }
    if (el.name === "division") { collect(); st.vals.district = ""; infoView($("#ap-body"), live()); autosave(); return; }
    if (el.closest("#ap-form")) autosave();
  });
  root.addEventListener("input", (e) => { if (e.target.closest("#ap-form") && !/^(SELECT)$/.test(e.target.tagName)) autosave(); });
  root.addEventListener("submit", (e) => { const f = e.target.closest("#ap-form"); if (f) { e.preventDefault(); infoSubmit(live()); } });
  window.addEventListener("beforeunload", (e) => { if (st.dirty && editable()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- boot ---------- */
  let booted = false;
  async function boot() {
    if (!A().isIn()) { st.ready = false; return render(); }
    if (booted) return; booted = true;
    render();
    try {
      await loadSettings();
      const id = new URLSearchParams(location.search).get("c");
      if (id && /^[0-9a-f-]{36}$/i.test(id)) { await load(id); if (st.co && st.co.status === "changes_requested") st.step = "info"; }
      else if (id) st.err = T("লিংকটি সঠিক নয়।", "This link is not valid.");
      st.ready = true;
    } catch (e) { st.err = friendly(e); }
    render();
  }
  whenReady(() => { A().onChange(() => { booted = false; st.err = ""; boot(); }); boot(); U().onRender(() => { if (st.ready && !st.done) { collect(); render(); } }); });
})();
