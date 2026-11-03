/* Voice of Startup Bangladesh — article likes & comments.
   Anyone can read; liking and commenting need a login and are enforced by the database (add_post_comment / toggle_post_like).
   The page (main.js) only drops an empty <section id="post-social" data-slug="…"> into the article; this file fills it. */
(function () {
  "use strict";
  const C = window.VOSB || {}, S = C.supabase || {};
  const U = () => window.VOSB_UI, A = () => window.VOSB_AUTH;
  const T = (b, e) => (U() ? U().T(b, e) : e);
  const esc = (s) => (U() ? U().esc(s == null ? "" : s) : String(s == null ? "" : s));
  const nd = (n) => (U() ? U().bnDigits(String(n)) : String(n));
  const H = { apikey: S.anonKey, Authorization: "Bearer " + S.anonKey };

  async function rpc(name, args) {
    if (A() && A().isIn()) { const { data, error } = await A().rpc(name, args || {}); if (error) throw error; return data; }
    const r = await fetch(S.url + "/rest/v1/rpc/" + name, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify(args || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.message) || "rpc " + r.status);
    return j;
  }
  function errText(e) {
    const m = String((e && e.message) || e || "");
    if (/too many|too fast|slow down/i.test(m)) return T("অনেক দ্রুত হচ্ছে। একটু পরে আবার চেষ্টা করুন।", "Slow down a little and try again shortly.");
    if (/fetch|network/i.test(m)) return T("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", "Please check your connection and try again.");
    return esc(m) || T("কিছু একটা ভুল হয়েছে।", "Something went wrong.");
  }
  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return T("এইমাত্র", "just now");
    if (s < 3600) { const n = Math.floor(s / 60); return T(nd(n) + " মিনিট আগে", n + " min ago"); }
    if (s < 86400) { const n = Math.floor(s / 3600); return T(nd(n) + " ঘণ্টা আগে", n + " h ago"); }
    if (s < 86400 * 30) { const n = Math.floor(s / 86400); return T(nd(n) + " দিন আগে", n + " d ago"); }
    return U().formatDate(iso);
  };
  const av = (name, url, cls) => url
    ? `<img class="ps-av ${cls || ""}" src="${esc(U().safeHref(url))}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="ps-av ph ${cls || ""}" aria-hidden="true">${esc((String(name || "?").trim()[0] || "?").toUpperCase())}</span>`;
  const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.1 5c2 0 3.3 1 3.9 2.2h4C14.6 6 15.9 5 17.9 5c3.5 0 5.2 3.6 3.7 6.9C19.5 16.4 12 21 12 21z"/></svg>';
  const BUBBLE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';

  function mount(box) {
    const slug = box.dataset.slug;
    if (!slug || box.dataset.ready === slug + ":" + (U().lang || "")) return;
    box.dataset.ready = slug + ":" + (U().lang || "");
    const st = { likes: 0, liked: false, coms: [], replyTo: null, loading: true, err: "", busy: false };

    const me = () => (A() && A().isIn() ? A().user() : null);
    const myProfile = () => {
      const u = me(); if (!u) return null;
      let url = ""; try { const j = JSON.parse(localStorage.getItem("vosb-avatar") || "null"); if (j && j.id === u.id && /^https:\/\//.test(j.url)) url = j.url; } catch (e) {}
      const m = u.user_metadata || {};
      return { avatar_url: url, full_name: m.full_name || m.name || "" };
    };

    function item(c, reply) {
      const kids = reply ? [] : st.coms.filter((x) => x.parent_id === c.id);
      return `<li class="ps-c${reply ? " ps-r" : ""}" id="pc-${esc(c.id)}">${av(c.author_name, c.avatar_url)}
        <div class="ps-cb"><div class="ps-ch"><b>${esc(c.author_name)}</b>${c.staff ? `<span class="ps-staff">VOSB</span>` : ""}<time>${esc(ago(c.created_at))}</time></div>
        <p>${esc(c.body)}</p>
        <div class="ps-acts">${reply ? "" : `<button type="button" class="ps-link" data-reply="${esc(c.id)}">${T("উত্তর দিন", "Reply")}</button>`}${c.mine ? `<button type="button" class="ps-link del" data-del="${esc(c.id)}">${T("মুছুন", "Delete")}</button>` : ""}</div>
        ${st.replyTo === c.id ? form(c.id) : ""}
        ${kids.length ? `<ul class="ps-list">${kids.map((k) => item(k, true)).join("")}</ul>` : ""}</div></li>`;
    }
    function form(pid) {
      const u = me(), p = myProfile();
      const name = (p && p.full_name) || (u && u.email) || "";
      return `<form class="ps-form" data-parent="${pid || ""}" novalidate>${u ? av(name, p && p.avatar_url) : ""}
        <div class="ps-fw"><textarea name="body" rows="${pid ? 2 : 3}" maxlength="1000" aria-label="${T("কমেন্ট", "Comment")}" placeholder="${pid ? T("উত্তর লিখুন…", "Write a reply…") : u ? T("আপনার মতামত লিখুন…", "Share your thoughts…") : T("কমেন্ট করতে লগইন করুন", "Log in to join the conversation")}"></textarea>
        <div class="ps-fa"><span class="ps-msg" role="alert"></span>${pid ? `<button type="button" class="ps-link" data-cancel>${T("বাতিল", "Cancel")}</button>` : ""}<button class="btn btn-orange ps-send" type="submit">${u ? T("পোস্ট করুন", "Post") : T("লগইন করুন", "Log in")}</button></div></div></form>`;
    }
    function draw() {
      const top = st.coms.filter((c) => !c.parent_id);
      const n = st.coms.length;
      box.innerHTML = `<div class="ps-bar" role="group" aria-label="${T("প্রতিক্রিয়া", "Reactions")}">
          <button type="button" class="ps-like${st.liked ? " on" : ""}" data-like aria-pressed="${st.liked}">${HEART}<span><b>${nd(st.likes)}</b> ${T("লাইক", st.likes === 1 ? "like" : "likes")}</span></button>
          <a class="ps-count" href="#ps-comments">${BUBBLE}<span><b>${nd(n)}</b> ${T("কমেন্ট", n === 1 ? "comment" : "comments")}</span></a></div>
        <div class="ps-wrap" id="ps-comments"><h2>${T("আলোচনা", "Discussion")}</h2>
          ${st.err ? `<p class="ps-err">${st.err}</p>` : ""}
          ${form("")}
          ${st.loading ? `<p class="muted">${T("লোড হচ্ছে…", "Loading…")}</p>` : `<ul class="ps-list">${top.map((c) => item(c, false)).join("") || `<li class="muted ps-empty">${T("প্রথম কমেন্টটি আপনিই করুন।", "Be the first to comment.")}</li>`}</ul>`}
        </div>`;
    }
    async function load() {
      try {
        const [e, l] = await Promise.all([rpc("post_engagement", { p_slug: slug }), rpc("list_post_comments", { p_slug: slug })]);
        if (e) { st.likes = e.likes || 0; st.liked = !!e.liked; }
        st.coms = l || []; st.err = "";
      } catch (er) { st.err = errText(er); }
      st.loading = false; draw();
    }
    draw(); load();

    box.addEventListener("click", async (e) => {
      const t = e.target;
      if (t.closest("[data-like]")) {
        const u = await A().requireLogin("লাইক দিতে লগইন করুন।", "Log in to like this article."); if (!u) return;
        if (st.busy) return; st.busy = true;
        const was = st.liked; st.liked = !was; st.likes += was ? -1 : 1; draw();
        try { const r = await rpc("toggle_post_like", { p_slug: slug }); st.liked = !!r.liked; st.likes = r.likes; }
        catch (er) { st.liked = was; st.likes += was ? 1 : -1; A().toast(errText(er), "err"); }
        st.busy = false; draw(); return;
      }
      const rp = t.closest("[data-reply]");
      if (rp) { const u = await A().requireLogin("উত্তর দিতে লগইন করুন।", "Log in to reply."); if (!u) return; st.replyTo = rp.dataset.reply; draw(); const ta = box.querySelector(".ps-form[data-parent] textarea"); if (ta) ta.focus(); return; }
      if (t.closest("[data-cancel]")) { st.replyTo = null; draw(); return; }
      const dl = t.closest("[data-del]");
      if (dl) {
        if (!confirm(T("কমেন্টটি মুছে ফেলবেন?", "Delete this comment?"))) return;
        try { await rpc("delete_my_post_comment", { p_id: dl.dataset.del }); await load(); } catch (er) { A().toast(errText(er), "err"); }
      }
    });
    box.addEventListener("submit", async (e) => {
      const f = e.target.closest(".ps-form"); if (!f) return; e.preventDefault();
      const msg = f.querySelector(".ps-msg"), btn = f.querySelector(".ps-send");
      const u = await A().requireLogin("কমেন্ট করতে লগইন করুন।", "Log in to comment."); if (!u) return;
      const body = f.body.value.trim();
      if (body.length < 2) { msg.textContent = T("আগে কিছু লিখুন।", "Write something first."); return; }
      btn.disabled = true; msg.textContent = "";
      try { await rpc("add_post_comment", { p_slug: slug, p_parent: f.dataset.parent || null, p_body: body }); st.replyTo = null; await load(); }
      catch (er) { msg.innerHTML = errText(er); btn.disabled = false; }
    });
    // the page may be redrawn after login; keep the form's avatar and the "mine" flags right
    if (A() && A().onChange) A().onChange(() => { if (document.body.contains(box)) load(); });
  }

  function scan() {
    const box = document.getElementById("post-social");
    if (box && window.VOSB_UI && window.VOSB_AUTH) mount(box);
  }
  let n = 0;
  const mo = new MutationObserver(scan);
  function start() {
    scan();
    const root = document.getElementById("article") || document.body;
    mo.observe(root, { childList: true, subtree: true });
    if (U() && U().onRender) U().onRender(scan);
    const iv = setInterval(() => { scan(); if (++n > 40) clearInterval(iv); }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
