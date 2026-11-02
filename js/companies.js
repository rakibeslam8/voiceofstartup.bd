/* Voice of Startup Bangladesh — Company Directory (public side)
   - /companies          : searchable, filterable list of published companies
   - /list-your-company  : live fee + start button + a few listed companies
   - /company/<slug>     : profile page with reviews, comments and investor-interest form (also the viewer for new companies on 404.html)
   Anyone may read. Writing (review, comment, interest) needs a login and is enforced by the database. */
(function () {
  "use strict";
  const C = window.VOSB || {}, S = C.supabase || {}, CO = C.companies || {};
  const SRC = (document.currentScript && document.currentScript.src) || "";
  const VER = (SRC.match(/[?&]v=([^&]+)/) || [])[1] || "";
  const U = () => window.VOSB_UI, A = () => window.VOSB_AUTH;
  const T = (b, e) => U().T(b, e);
  const esc = (s) => U().esc(s == null ? "" : s);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = (n) => U().money(n);
  const nd = (n) => U().bnDigits(String(n));
  const pickL = (o) => (o ? (U().lang === "bn" ? o.bn : o.en) || o.en : "");
  const label = (list, id) => { const o = (list || []).find((x) => x.id === id); return o ? pickL(o) : id || ""; };
  const LIST = "id,slug,name,tagline,category,stage,division,district,logo_url,verified,featured,rating_avg,rating_count,views,interest_count,vosb_valuation,seeking_amount,published_at";
  const FULL = LIST + ",description,founded_year,website,social,team,cover_url,team_size,business_model,revenue_range,equity_offered,expected_valuation,use_of_funds,highlights,valuation_date,valuation_note,verified_at";
  const H = { apikey: S.anonKey, Authorization: "Bearer " + S.anonKey };
  const DISCLAIMER = () => T("VOSB একটি মিডিয়া ও লিস্টিং প্ল্যাটফর্ম — ব্রোকার বা আর্থিক পরামর্শদাতা নয়। এখানে কোনো টাকা নেওয়া হয় না। ভ্যালুয়েশন শুধু ইঙ্গিতমূলক, বিনিয়োগ পরামর্শ নয়। বিনিয়োগে ঝুঁকি আছে — সিদ্ধান্তের আগে নিজে যাচাই করুন।",
    "VOSB is a media and listing platform — not a broker or financial adviser. No money is collected here. Valuations are indicative only and are not investment advice. Investing is risky — do your own due diligence.");

  async function rest(path, count) {
    const r = await fetch(S.url + "/rest/v1/" + path, { headers: count ? Object.assign({ Prefer: "count=exact" }, H) : H });
    if (!r.ok) throw new Error("load " + r.status);
    return { rows: await r.json(), total: count ? +((r.headers.get("content-range") || "").split("/")[1]) || 0 : 0 };
  }
  async function rpc(name, args) {
    if (A() && A().isIn()) { const { data, error } = await A().rpc(name, args || {}); if (error) throw error; return data; }
    const r = await fetch(S.url + "/rest/v1/rpc/" + name, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify(args || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.message) || "rpc " + r.status);
    return j;
  }
  const whenReady = (fn) => { let n = 0; (function w() { if (window.VOSB_UI && window.VOSB_AUTH) return fn(); if (++n > 120) return fn(); setTimeout(w, 50); })(); };
  const toast = (m, k) => { try { A().toast(m, k); } catch (e) {} };
  function errText(e) {
    const m = String((e && e.message) || e || "");
    if (/too many|too fast/i.test(m)) return T("অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।", "Too many attempts. Please try again in a little while.");
    if (/fetch|network/i.test(m)) return T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.");
    return esc(m) || T("কিছু একটা ভুল হয়েছে।", "Something went wrong.");
  }

  /* ---------- small renderers ---------- */
  const initial = (n) => (String(n || "?").trim()[0] || "?").toUpperCase();
  const logo = (c, cls) => c.logo_url ? `<img class="${cls}" src="${esc(U().safeHref(c.logo_url))}" alt="" width="64" height="64" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls} ph" aria-hidden="true">${esc(initial(c.name))}</span>`;
  const stars = (avg) => `<span class="co-stars" style="--p:${Math.max(0, Math.min(100, (Number(avg) || 0) * 20))}%" role="img" aria-label="${Number(avg || 0).toFixed(1)} / 5">★★★★★</span>`;
  const rating = (c) => c.rating_count > 0 ? `<span class="co-rate">${stars(c.rating_avg)}<b>${nd(Number(c.rating_avg).toFixed(1))}</b><em>(${nd(c.rating_count)})</em></span>` : `<span class="co-rate none">${T("এখনও রিভিউ নেই", "No reviews yet")}</span>`;
  const verified = () => `<span class="co-ver" title="${T("VOSB ডকুমেন্ট যাচাই করেছে", "Documents checked by VOSB")}">✔ ${T("VOSB ভেরিফাইড", "VOSB Verified")}</span>`;
  function card(c) {
    const loc = [c.district, c.division].filter(Boolean).join(", ");
    const kv = c.vosb_valuation ? `<span class="co-kv"><i>${T("VOSB ভ্যালুয়েশন", "VOSB valuation")}</i><b>${money(c.vosb_valuation)}</b></span>` : c.seeking_amount ? `<span class="co-kv"><i>${T("তহবিল চাইছে", "Seeking")}</i><b>${money(c.seeking_amount)}</b></span>` : "";
    return `<a class="co-card${c.featured ? " feat" : ""}" href="/company/${esc(c.slug)}">${c.featured ? `<span class="co-feat">★ ${T("ফিচার্ড", "Featured")}</span>` : ""}
      <div class="co-top">${logo(c, "co-logo")}<div class="co-nm"><h3>${esc(c.name)}</h3>${c.verified ? verified() : ""}</div></div>
      <p class="co-tag">${esc(c.tagline || "")}</p>
      <div class="co-tags">${c.category ? `<span>${esc(label(CO.industries, c.category))}</span>` : ""}${c.stage ? `<span>${esc(label(CO.stages, c.stage))}</span>` : ""}${loc ? `<span class="loc">📍 ${esc(loc)}</span>` : ""}</div>
      <div class="co-foot">${rating(c)}${kv}</div></a>`;
  }
  const skel = (n) => Array.from({ length: n }, () => '<div class="co-card sk" aria-hidden="true"><i></i><i></i><i></i></div>').join("");
  const emptyHtml = () => `<div class="co-empty"><div class="co-empty-ic" aria-hidden="true">🏢</div><h3>${T("এখনও কোনো কোম্পানি পাওয়া যায়নি", "No companies found yet")}</h3><p>${T("ফিল্টার বদলে দেখুন, অথবা আপনার কোম্পানি লিস্ট করে প্রথম হয়ে যান।", "Try different filters — or be the first to list your company.")}</p><p><a class="btn btn-green" href="/list-your-company">${T("কোম্পানি লিস্ট করুন", "List your company")}</a></p></div>`;
  const errHtml = () => `<div class="co-empty" role="alert"><div class="co-empty-ic" aria-hidden="true">⚠️</div><h3>${T("লোড করা যায়নি", "Couldn't load companies")}</h3><p>${T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.")}</p><p><button class="btn btn-orange" type="button" data-co-retry>${T("আবার চেষ্টা করুন", "Try again")}</button></p></div>`;

  /* ================= DIRECTORY ================= */
  function directory() {
    const grid = $("#co-grid"), more = $("#co-more"), bar = $("#co-bar"), fbox = $("#co-filters"), form = $("#co-search"), qin = $("#co-q");
    const P = 24, SORTS = { feat: "featured.desc,verified.desc,published_at.desc", rated: "rating_avg.desc,rating_count.desc,published_at.desc", new: "published_at.desc", views: "views.desc,published_at.desc", verified: "verified.desc,featured.desc,published_at.desc", valued: "vosb_valuation.desc.nullslast,published_at.desc" };
    const SLAB = { feat: ["বাছাইকৃত", "Featured first"], rated: ["সর্বোচ্চ রেটিং", "Top rated"], new: ["নতুন", "Newest"], views: ["সর্বাধিক দেখা", "Most viewed"], verified: ["ভেরিফাইড আগে", "Verified first"], valued: ["VOSB ভ্যালুয়েশন", "VOSB-valued"] };
    const u = new URLSearchParams(location.search);
    const st = { q: (u.get("q") || "").slice(0, 60), cat: u.get("cat") || "", stage: u.get("stage") || "", div: u.get("div") || "", sort: SORTS[u.get("sort")] ? u.get("sort") : "feat", items: [], total: 0, state: "loading" };
    const clean = (s) => String(s).replace(/[,()*%\\"'`:;.<>&=#?]/g, " ").replace(/\s+/g, " ").trim();
    const sync = () => { const p = new URLSearchParams(); if (st.q) p.set("q", st.q); if (st.cat) p.set("cat", st.cat); if (st.stage) p.set("stage", st.stage); if (st.div) p.set("div", st.div); if (st.sort !== "feat") p.set("sort", st.sort); try { history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "")); } catch (e) {} };
    const sel = (id, ph, list, val) => `<label class="co-sel"><span class="sr">${ph}</span><select id="${id}"><option value="">${ph}</option>${list.map((o) => `<option value="${esc(o[0])}"${o[0] === val ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
    function drawFilters() {
      fbox.innerHTML = `<div class="co-chips" role="group" aria-label="${T("বিষয়", "Industry")}"><button type="button" class="${st.cat ? "" : "on"}" data-cat="">${T("সব", "All")}</button>${(CO.industries || []).map((i) => `<button type="button" class="${st.cat === i.id ? "on" : ""}" data-cat="${esc(i.id)}">${esc(pickL(i))}</button>`).join("")}</div>
        <div class="co-selrow">${sel("co-stage", T("সব ধাপ", "Any stage"), (CO.stages || []).map((s) => [s.id, pickL(s)]), st.stage)}${sel("co-div", T("সব বিভাগ", "Any division"), Object.keys(CO.divisions || {}).map((d) => [d, d]), st.div)}
        <label class="co-sel"><span class="sr">${T("সাজান", "Sort")}</span><select id="co-sort">${Object.keys(SORTS).map((k) => `<option value="${k}"${k === st.sort ? " selected" : ""}>${T(SLAB[k][0], SLAB[k][1])}</option>`).join("")}</select></label></div>`;
    }
    function drawBar() { bar.innerHTML = st.state === "ready" ? `<span>${T(`${nd(st.total)}টি কোম্পানি`, `${st.total} ${st.total === 1 ? "company" : "companies"}`)}${st.q ? ` · “${esc(st.q)}”` : ""}</span>${st.q || st.cat || st.stage || st.div ? `<button type="button" class="co-clear" data-co-clear>${T("ফিল্টার মুছুন", "Clear filters")}</button>` : ""}` : ""; }
    function drawGrid() {
      grid.setAttribute("aria-busy", st.state === "loading" ? "true" : "false");
      grid.innerHTML = st.state === "error" ? errHtml() : st.items.length ? st.items.map(card).join("") + (st.state === "loading" ? skel(3) : "") : st.state === "loading" ? skel(6) : emptyHtml();
      more.hidden = !(st.state === "ready" && st.items.length < st.total);
      more.textContent = T("আরও দেখুন", "Show more");
      drawBar();
    }
    async function load(reset) {
      if (reset) { st.items = []; st.total = 0; }
      st.state = "loading"; drawGrid();
      let path = `companies?select=${LIST}&status=eq.published&order=${SORTS[st.sort]}&limit=${P}&offset=${st.items.length}`;
      if (st.cat) path += "&category=eq." + encodeURIComponent(st.cat);
      if (st.stage) path += "&stage=eq." + encodeURIComponent(st.stage);
      if (st.div) path += "&division=eq." + encodeURIComponent(st.div);
      const q = clean(st.q); if (q) path += `&or=(name.ilike.*${encodeURIComponent(q)}*,tagline.ilike.*${encodeURIComponent(q)}*)`;
      try { const r = await rest(path, true); st.items = st.items.concat(r.rows); st.total = Math.max(r.total, st.items.length); st.state = "ready"; } catch (e) { st.state = "error"; }
      drawGrid();
    }
    const draw = () => { drawFilters(); drawGrid(); const n = $("#co-note"); if (n) n.textContent = T(`৳${nd(CO.fee || 1000)} একবারের ফি — চিরকালের জন্য লিস্টেড`, `৳${CO.fee || 1000} one-time — listed forever`); if (qin) qin.value = st.q; };
    fbox.addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; st.cat = b.dataset.cat; sync(); drawFilters(); load(true); });
    fbox.addEventListener("change", (e) => { if (e.target.id === "co-stage") st.stage = e.target.value; else if (e.target.id === "co-div") st.div = e.target.value; else if (e.target.id === "co-sort") st.sort = e.target.value; else return; sync(); load(true); });
    form.addEventListener("submit", (e) => { e.preventDefault(); st.q = qin.value.trim().slice(0, 60); sync(); load(true); });
    more.addEventListener("click", () => load(false));
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-co-retry]")) load(true);
      if (e.target.closest("[data-co-clear]")) { st.q = st.cat = st.stage = st.div = ""; st.sort = "feat"; sync(); draw(); load(true); }
    });
    U().onRender(draw);
    draw(); load(true);
  }

  /* ================= LANDING (/list-your-company) ================= */
  function landing() {
    (async () => {
      let fee = CO.fee || 1000;
      try { const s = await rpc("get_listing_settings"); if (s && Number(s.fee) > 0) fee = Number(s.fee); } catch (e) {}
      const set = () => { $$(".co-fee-amt").forEach((el) => { el.textContent = "৳" + (U().lang === "bn" ? nd(fee.toLocaleString("en-IN")) : fee.toLocaleString("en-IN")); }); };
      set(); U().onRender(set);
    })();
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-co-start]");
      if (!b || !A() || A().isIn()) return;
      e.preventDefault();
      const u = await A().requireLogin("কোম্পানি লিস্ট করতে আগে লগইন বা সাইন আপ করুন।", "Log in or sign up first to list your company.");
      if (u) location.href = "/apply";
    });
    rest(`companies?select=${LIST}&status=eq.published&order=featured.desc,verified.desc,rating_avg.desc&limit=4`).then((r) => {
      if (!r.rows.length) return;
      $("#co-showcase").innerHTML = r.rows.map(card).join(""); $("#co-proof").hidden = false;
    }).catch(() => {});
  }

  /* ================= COMPANY PAGE ================= */
  function modal(html, cls) {
    const m = document.createElement("div");
    m.className = "co-modal";
    m.innerHTML = `<div class="co-dlg ${cls || ""}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(m); document.body.classList.add("au-lock");
    const prev = document.activeElement;
    const key = (e) => { if (e.key === "Escape") close(); };
    const close = () => { m.remove(); document.body.classList.remove("au-lock"); document.removeEventListener("keydown", key); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    document.addEventListener("keydown", key);
    m.addEventListener("mousedown", (e) => { if (e.target === m || e.target.closest("[data-x]")) close(); });
    const f = m.querySelector("select,input,textarea"); if (f) f.focus();
    return { el: m, close };
  }
  const paras = (t) => String(t || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const SOC = { facebook: "Facebook", linkedin: "LinkedIn", x: "X", instagram: "Instagram", youtube: "YouTube" };

  function setHead(c) {
    const url = (C.site && C.site.origin ? C.site.origin : location.origin) + "/company/" + c.slug;
    document.title = `${c.name} — ${T("কোম্পানি প্রোফাইল", "Company profile")} | Voice of Startup Bangladesh`;
    const desc = (c.tagline || "") + (c.description ? " — " + c.description.replace(/\s+/g, " ").slice(0, 140) : "");
    const meta = (sel, attr, val) => { let m = $(sel); if (!m) { m = document.createElement("meta"); const k = sel.match(/\[(name|property)="([^"]+)"\]/); m.setAttribute(k[1], k[2]); document.head.appendChild(m); } m.setAttribute(attr, val); };
    meta('meta[name="description"]', "content", desc.slice(0, 200)); meta('meta[property="og:title"]', "content", c.name + " | VOSB"); meta('meta[property="og:description"]', "content", desc.slice(0, 200));
    meta('meta[property="og:url"]', "content", url); meta('meta[name="robots"]', "content", "index, follow, max-image-preview:large");
    let cn = $('link[rel="canonical"]'); if (!cn) { cn = document.createElement("link"); cn.rel = "canonical"; document.head.appendChild(cn); } cn.href = url;
    const ld = { "@context": "https://schema.org", "@type": "Organization", name: c.name, url, description: c.tagline || undefined, logo: c.logo_url || undefined, sameAs: [c.website].concat(Object.values(c.social || {})).filter(Boolean) };
    if (c.rating_count > 0) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(c.rating_avg), reviewCount: c.rating_count, bestRating: 5, worstRating: 1 };
    let s = $("#ld-company"); if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "ld-company"; document.head.appendChild(s); } s.textContent = JSON.stringify(ld).replace(/</g, "\\u003c");
  }

  async function companyPage(slug, host, onMissing) {
    let c = null, rev = { items: [], count: 0, avg: 0, dist: {} }, com = [], editRev = false, replyTo = null;
    host.innerHTML = `<div class="co-prof-sk" aria-hidden="true"><i></i><i></i><i></i></div>`;
    try { const r = await rest(`companies?select=${FULL}&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`); c = r.rows[0] || null; }
    catch (e) { host.innerHTML = errHtml().replace("data-co-retry", "data-co-reload"); return; }
    if (!c) { if (onMissing) onMissing(); else host.innerHTML = `<div class="co-empty"><h3>${T("কোম্পানিটি পাওয়া যায়নি", "Company not found")}</h3><p><a class="btn btn-green" href="/companies">${T("সব কোম্পানি দেখুন", "Browse all companies")}</a></p></div>`; return; }
    setHead(c);
    try { if (!sessionStorage.getItem("vosb-cv-" + c.slug)) { sessionStorage.setItem("vosb-cv-" + c.slug, "1"); rpc("increment_company_view", { p_slug: c.slug }).catch(() => {}); } } catch (e) {}

    const facts = () => [[T("ইন্ডাস্ট্রি", "Industry"), label(CO.industries, c.category)], [T("ধাপ", "Stage"), label(CO.stages, c.stage)], [T("প্রতিষ্ঠা", "Founded"), c.founded_year ? nd(c.founded_year) : ""],
      [T("অবস্থান", "Location"), [c.district, c.division].filter(Boolean).join(", ")], [T("টিম সাইজ", "Team size"), c.team_size ? nd(c.team_size) : ""], [T("মাসিক আয়", "Monthly revenue"), label(CO.revenueRanges, c.revenue_range)]]
      .filter((r) => r[1]).map((r) => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("");
    const fundRows = () => [c.vosb_valuation ? [T("VOSB মূল্যায়ন (ইঙ্গিতমূলক)", "VOSB assessed valuation (indicative)"), money(c.vosb_valuation), "vosb"] : null, c.expected_valuation ? [T("প্রতিষ্ঠাতার প্রত্যাশিত ভ্যালুয়েশন", "Founder's expected valuation"), money(c.expected_valuation)] : null,
      c.seeking_amount ? [T("তহবিল চাইছে", "Seeking"), money(c.seeking_amount)] : null, c.equity_offered != null ? [T("অফার করা ইকুইটি", "Equity offered"), nd(c.equity_offered) + "%"] : null].filter(Boolean);

    function drawRev() {
      const el = $("#co-rev"); if (!el) return;
      const mine = rev.items.find((r) => r.mine), n = rev.count || 0;
      const dist = [5, 4, 3, 2, 1].map((s) => { const k = Number((rev.dist || {})[s] || 0); return `<div class="co-dist"><span>${nd(s)}★</span><i><b style="width:${n ? Math.round((k / n) * 100) : 0}%"></b></i><em>${nd(k)}</em></div>`; }).join("");
      const form = (!mine || editRev) ? `<form class="co-rform" id="co-rform" novalidate><h3>${mine ? T("আপনার রিভিউ বদলান", "Edit your review") : T("রিভিউ লিখুন", "Write a review")}</h3>
        <div class="co-pick" role="radiogroup" aria-label="${T("রেটিং", "Rating")}">${[1, 2, 3, 4, 5].map((s) => `<button type="button" role="radio" aria-checked="false" data-star="${s}" aria-label="${s} ${T("তারা", "stars")}">★</button>`).join("")}</div>
        <input name="title" maxlength="120" placeholder="${T("শিরোনাম (ঐচ্ছিক)", "Title (optional)")}" value="${mine ? esc(mine.title || "") : ""}">
        <textarea name="body" rows="4" maxlength="1500" placeholder="${T("আপনার অভিজ্ঞতা লিখুন…", "Share your experience…")}">${mine ? esc(mine.body || "") : ""}</textarea>
        <div class="co-msg" id="co-rmsg" role="alert"></div><div class="co-acts"><button class="btn btn-orange" type="submit">${T("রিভিউ জমা দিন", "Submit review")}</button>${editRev ? `<button class="btn btn-outline" type="button" data-rcancel>${T("বাতিল", "Cancel")}</button>` : ""}</div></form>`
        : `<div class="co-mine"><b>${T("আপনার রিভিউ", "Your review")}</b>${stars(mine.rating)}<div class="co-acts"><button class="co-link" type="button" data-redit>${T("বদলান", "Edit")}</button><button class="co-link bad" type="button" data-rdel>${T("মুছুন", "Delete")}</button></div></div>`;
      el.innerHTML = `<div class="co-rsum"><div class="co-big"><b>${n ? nd(Number(rev.avg).toFixed(1)) : "—"}</b>${stars(rev.avg)}<small>${T(`${nd(n)}টি রিভিউ`, `${n} review${n === 1 ? "" : "s"}`)}</small></div><div class="co-dists">${dist}</div></div>${form}
        <ul class="co-rlist">${rev.items.map((r) => `<li><div class="co-rh"><b>${esc(r.author_name)}</b>${stars(r.rating)}<time>${esc(U().formatDate(r.created_at))}</time></div>${r.title ? `<h4>${esc(r.title)}</h4>` : ""}${r.body ? `<p>${esc(r.body)}</p>` : ""}</li>`).join("") || `<li class="muted">${T("এখনও কোনো রিভিউ নেই — প্রথম রিভিউ আপনিই দিন।", "No reviews yet — be the first.")}</li>`}</ul>`;
      const f = $("#co-rform");
      if (f) { let val = mine ? mine.rating : 0; const paint = () => $$("[data-star]", f).forEach((b) => { const on = +b.dataset.star <= val; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(+b.dataset.star === val)); }); paint();
        f.addEventListener("click", (e) => { const b = e.target.closest("[data-star]"); if (b) { val = +b.dataset.star; paint(); } if (e.target.closest("[data-rcancel]")) { editRev = false; drawRev(); } });
        f.addEventListener("submit", async (e) => { e.preventDefault(); const msg = $("#co-rmsg"); msg.textContent = "";
          if (!val) { msg.textContent = T("তারা বেছে নিন (১–৫)।", "Choose a star rating (1–5)."); return; }
          const u = await A().requireLogin("রিভিউ দিতে লগইন করুন।", "Log in to write a review."); if (!u) return;
          try { await rpc("post_review", { p_company: c.id, p_rating: val, p_title: f.title.value, p_body: f.body.value }); toast(T("রিভিউ জমা হয়েছে। ধন্যবাদ!", "Review saved. Thank you!"), "ok"); editRev = false; await loadRev(true); } catch (er) { msg.textContent = errText(er); } }); }
    }
    async function loadRev(upd) { try { const r = await rpc("list_company_reviews", { p_company: c.id, p_limit: 30, p_offset: 0 }); rev = { items: r.items || [], count: r.count || 0, avg: r.avg || 0, dist: r.dist || {} }; if (upd) { c.rating_avg = rev.avg; c.rating_count = rev.count; const h = $("#co-hrate"); if (h) h.innerHTML = rating(c); } } catch (e) {} drawRev(); }

    function drawCom() {
      const el = $("#co-com"); if (!el) return;
      const top = com.filter((x) => !x.parent_id), kids = (id) => com.filter((x) => x.parent_id === id);
      const item = (x, reply) => `<li class="${reply ? "re" : ""}"><div class="co-rh"><b>${esc(x.author_name)}</b>${x.by_owner ? `<span class="co-owner">${T("মালিক", "Owner")}</span>` : ""}<time>${esc(U().formatDate(x.created_at))}</time></div><p>${esc(x.body)}</p>
        <div class="co-acts">${reply ? "" : `<button class="co-link" type="button" data-reply="${esc(x.id)}">${T("উত্তর দিন", "Reply")}</button>`}${x.mine ? `<button class="co-link bad" type="button" data-cdel="${esc(x.id)}">${T("মুছুন", "Delete")}</button>` : ""}</div>
        ${replyTo === x.id ? cform(x.id) : ""}${reply ? "" : `<ul>${kids(x.id).map((k) => item(k, true)).join("")}</ul>`}</li>`;
      const cform = (pid) => `<form class="co-cform" data-parent="${pid || ""}"><textarea name="body" rows="${pid ? 2 : 3}" maxlength="800" placeholder="${pid ? T("উত্তর লিখুন…", "Write a reply…") : T("কমেন্ট লিখুন…", "Write a comment…")}"></textarea><div class="co-msg" role="alert"></div><div class="co-acts"><button class="btn btn-orange ac-sm" type="submit">${T("পোস্ট", "Post")}</button></div></form>`;
      el.innerHTML = `${cform("")}<ul class="co-clist">${top.map((x) => item(x, false)).join("") || `<li class="muted">${T("এখনও কোনো কমেন্ট নেই।", "No comments yet.")}</li>`}</ul>`;
    }
    async function loadCom() { try { com = (await rpc("list_company_comments", { p_company: c.id })) || []; } catch (e) {} drawCom(); }

    function draw() {
      const soc = Object.keys(c.social || {}).filter((k) => SOC[k] && c.social[k]).map((k) => `<a href="${esc(U().safeHref(c.social[k]))}" target="_blank" rel="noopener nofollow">${SOC[k]}</a>`).join("");
      const fr = fundRows(), team = (c.team || []).filter((m) => m && m.name);
      host.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">${T("হোম", "Home")}</a><span aria-hidden="true">›</span><a href="/companies">${T("কোম্পানি", "Companies")}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(c.name)}</span></nav>
      <header class="co-head${c.cover_url ? " has-cover" : ""}">${c.cover_url ? `<div class="co-cover"><img src="${esc(U().safeHref(c.cover_url))}" alt="" width="1200" height="300" referrerpolicy="no-referrer"></div>` : ""}
        <div class="co-hrow">${logo(c, "co-logo lg")}<div class="co-hmain"><h1>${esc(c.name)}</h1><div class="co-badges">${c.verified ? verified() : ""}${c.category ? `<span class="co-b">${esc(label(CO.industries, c.category))}</span>` : ""}${c.stage ? `<span class="co-b">${esc(label(CO.stages, c.stage))}</span>` : ""}</div>
          <p class="co-ptag">${esc(c.tagline || "")}</p><div id="co-hrate">${rating(c)}</div></div></div>
        <div class="co-actions">${c.website ? `<a class="btn btn-outline" href="${esc(U().safeHref(c.website))}" target="_blank" rel="noopener nofollow">🌐 ${T("ওয়েবসাইট", "Website")}</a>` : ""}<a class="btn btn-orange" href="#co-rev-h">★ ${T("রিভিউ দিন", "Rate & review")}</a><button class="btn btn-green" type="button" id="co-invest">💼 ${T("বিনিয়োগে আগ্রহ জানান", "Show investor interest")}</button><button class="btn btn-outline" type="button" id="co-share">↗ ${T("শেয়ার", "Share")}</button></div></header>
      <div class="co-layout"><div class="co-main">
        <section class="co-sec"><h2>${T("পরিচিতি", "About")}</h2>${paras(c.description) || `<p class="muted">—</p>`}</section>
        ${c.business_model ? `<section class="co-sec"><h2>${T("ব্যবসার মডেল", "Business model")}</h2>${paras(c.business_model)}</section>` : ""}
        ${c.highlights ? `<section class="co-sec"><h2>${T("বিশেষ অর্জন ও হাইলাইট", "Highlights")}</h2>${paras(c.highlights)}</section>` : ""}
        ${team.length ? `<section class="co-sec"><h2>${T("টিম", "Team")}</h2><ul class="co-team">${team.map((m) => `<li><span class="co-tav">${esc(initial(m.name))}</span><div><b>${esc(m.name)}</b><small>${esc(m.role || "")}</small></div></li>`).join("")}</ul></section>` : ""}
        <section class="co-sec" id="co-rev-sec"><h2 id="co-rev-h">${T("রিভিউ ও রেটিং", "Reviews & ratings")}</h2><div id="co-rev"></div></section>
        <section class="co-sec"><h2>${T("আলোচনা", "Discussion")}</h2><div id="co-com"></div></section>
      </div><aside class="co-side">
        ${fr.length || c.use_of_funds ? `<section class="co-card2"><h2>${T("তহবিল ও ভ্যালুয়েশন", "Funding & valuation")}</h2><dl class="co-fund">${fr.map((r) => `<div class="${r[2] || ""}"><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join("")}</dl>
          ${c.vosb_valuation && (c.valuation_date || c.valuation_note) ? `<p class="co-vnote">${c.valuation_date ? T("মূল্যায়নের তারিখ: ", "Assessed on ") + esc(U().formatDate(c.valuation_date)) + ". " : ""}${esc(c.valuation_note || "")}</p>` : ""}
          ${c.use_of_funds ? `<h3>${T("তহবিল কীভাবে ব্যবহার হবে", "Use of funds")}</h3>${paras(c.use_of_funds)}` : ""}</section>` : ""}
        <section class="co-card2"><h2>${T("তথ্য", "Details")}</h2><dl class="co-facts">${facts()}</dl>${soc ? `<div class="co-soc">${soc}</div>` : ""}<p class="co-views">👁 ${nd(c.views || 0)} · 💼 ${nd(c.interest_count || 0)} ${T("বিনিয়োগ আগ্রহ", "investor interests")}</p></section>
        <p class="co-disc">${DISCLAIMER()}</p></aside></div>`;
      drawRev(); drawCom();
    }
    draw(); U().onRender(() => { if (host.isConnected) draw(); });
    loadRev(); loadCom();

    host.addEventListener("click", async (e) => {
      if (e.target.closest("[data-co-reload]")) return location.reload();
      if (e.target.closest("[data-redit]")) { editRev = true; drawRev(); return; }
      if (e.target.closest("[data-rdel]")) { if (!confirm(T("আপনার রিভিউ মুছে ফেলবেন?", "Delete your review?"))) return; try { await rpc("delete_my_review", { p_company: c.id }); await loadRev(true); } catch (er) { toast(errText(er), "err"); } return; }
      const rp = e.target.closest("[data-reply]"); if (rp) { replyTo = replyTo === rp.dataset.reply ? null : rp.dataset.reply; drawCom(); const t = $(".co-cform textarea", $("#co-com").querySelector("li .co-cform") ? $("#co-com") : $("#co-com")); return; }
      const cd = e.target.closest("[data-cdel]"); if (cd) { if (!confirm(T("কমেন্টটি মুছে ফেলবেন?", "Delete this comment?"))) return; try { await rpc("delete_my_comment", { p_id: cd.dataset.cdel }); await loadCom(); } catch (er) { toast(errText(er), "err"); } return; }
      if (e.target.closest("#co-share")) { const d = { title: c.name, text: c.tagline || c.name, url: location.origin + "/company/" + c.slug }; if (navigator.share) navigator.share(d).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(d.url).then(() => toast(T("লিংক কপি হয়েছে ✓", "Link copied ✓"), "ok")).catch(() => {}); return; }
      if (e.target.closest("#co-invest")) invest();
    });
    host.addEventListener("submit", async (e) => {
      const f = e.target.closest(".co-cform"); if (!f) return; e.preventDefault();
      const msg = $(".co-msg", f); msg.textContent = "";
      const u = await A().requireLogin("কমেন্ট করতে লগইন করুন।", "Log in to comment."); if (!u) return;
      try { await rpc("post_comment", { p_company: c.id, p_parent: f.dataset.parent || null, p_body: f.body.value }); replyTo = null; await loadCom(); } catch (er) { msg.textContent = errText(er); }
    });

    async function invest() {
      const u = await A().requireLogin("বিনিয়োগের আগ্রহ জানাতে লগইন করুন।", "Log in to show investor interest."); if (!u) return;
      const m = modal(`<button type="button" class="co-x" data-x aria-label="${T("বন্ধ করুন", "Close")}">✕</button><h2>💼 ${T("বিনিয়োগে আগ্রহ জানান", "Show investor interest")}</h2><p class="muted">${esc(c.name)}</p>
        <form id="co-iform" novalidate><label>${T("আপনি কোন ধরনের বিনিয়োগকারী?", "What type of investor are you?")}<select name="type">${(CO.investorTypes || []).map((t) => `<option value="${esc(t.id)}">${esc(pickL(t))}</option>`).join("")}</select></label>
        <div class="co-two2"><label>${T("সর্বনিম্ন (৳)", "Minimum (৳)")}<input name="min" type="number" min="0" inputmode="numeric"></label><label>${T("সর্বোচ্চ (৳)", "Maximum (৳)")}<input name="max" type="number" min="0" inputmode="numeric"></label></div><p class="co-prev" id="co-prev"></p>
        <label>${T("আপনার বার্তা", "Your message")}<textarea name="msg" rows="4" maxlength="1000" placeholder="${T("আপনার আগ্রহ, প্রশ্ন বা প্রস্তাব লিখুন (কমপক্ষে ১০ অক্ষর)…", "Your interest, questions or proposal (at least 10 characters)…")}"></textarea></label>
        <label>${T("মোবাইল (ঐচ্ছিক)", "Mobile (optional)")}<input name="phone" inputmode="tel" maxlength="20" placeholder="01XXXXXXXXX"></label>
        <label class="co-chk"><input type="checkbox" name="share"><span>${T("এই কোম্পানির সাথে আমার ইমেইল ও মোবাইল শেয়ার করুন", "Share my email and mobile with this company")}</span></label>
        <p class="co-disc">${DISCLAIMER()}</p><div class="co-msg" id="co-imsg" role="alert"></div><div class="co-acts"><button class="btn btn-green" type="submit">${T("আগ্রহ জানান", "Send interest")}</button><button class="btn btn-outline" type="button" data-x>${T("বাতিল", "Cancel")}</button></div></form>`, "wide");
      const f = $("#co-iform", m.el), pv = () => { $("#co-prev", m.el).textContent = [f.min.value ? T("সর্বনিম্ন: ", "Min: ") + money(f.min.value) : "", f.max.value ? T("সর্বোচ্চ: ", "Max: ") + money(f.max.value) : ""].filter(Boolean).join("  ·  "); };
      f.min.addEventListener("input", pv); f.max.addEventListener("input", pv);
      f.addEventListener("submit", async (e) => { e.preventDefault(); const msg = $("#co-imsg", m.el); msg.textContent = ""; const btn = f.querySelector("[type=submit]"); btn.disabled = true;
        try { await rpc("express_interest", { p_company: c.id, p_type: f.type.value, p_min: f.min.value === "" ? null : +f.min.value, p_max: f.max.value === "" ? null : +f.max.value, p_message: f.msg.value, p_share: f.share.checked, p_phone: f.phone.value || null });
          m.el.querySelector(".co-dlg").innerHTML = `<div class="co-done"><div class="co-done-ic">✅</div><h2>${T("আগ্রহ জানানো হয়েছে", "Interest sent")}</h2><p>${T("আপনার বার্তা কোম্পানি ও VOSB টিমের কাছে পৌঁছেছে।", "Your message has reached the company and the VOSB team.")}</p><button class="btn btn-orange" type="button" data-x>${T("ঠিক আছে", "Done")}</button></div>`;
        } catch (er) { msg.textContent = errText(er); btn.disabled = false; } });
    }
  }

  /* ================= start ================= */
  document.addEventListener("DOMContentLoaded", () => whenReady(() => {
    if ($("#co-dir")) directory();
    if ($("#co-land")) landing();
    const m = location.pathname.match(/^\/company\/([a-z0-9-]+)\/?$/);
    let host = $("#co-page");
    if (m && !host) {                       // 404.html used as the viewer for a company that is not pre-built yet
      const nf = $("#notfound-box"); if (!nf) return;
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/css/companies.css" + (VER ? "?v=" + VER : ""); document.head.appendChild(l);
      const sec = document.createElement("section"); sec.className = "section co-section"; sec.innerHTML = '<div class="container" id="co-page"></div>'; nf.hidden = true; nf.after(sec); host = $("#co-page", sec);
      companyPage(m[1], host, () => { sec.remove(); nf.hidden = false; });
    } else if (host) {
      const slug = (m && m[1]) || host.dataset.slug || new URLSearchParams(location.search).get("c");
      if (slug) companyPage(slug, host);
    }
  }));
})();
