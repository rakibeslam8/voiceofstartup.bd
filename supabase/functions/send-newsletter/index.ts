// Voice of Startup Bangladesh — send-newsletter (Supabase Edge Function)
//
// One button in the admin panel (Subscribers → Send newsletter) calls this function.
// It is admin-only, sends in small resumable batches, never sends the same campaign to the same person twice,
// and puts a private one-click unsubscribe link in every email.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   (or BREVO_API_KEY)   email provider key
//   MAIL_FROM        e.g.  Voice of Startup Bangladesh <newsletter@voiceofstartup.bd>   (domain must be verified at the provider)
//   MAIL_REPLY_TO    optional, e.g. hello@voiceofstartup.bd
//   DAILY_LIMIT      optional, max emails per day (Resend free = 100, Brevo free = 300). 0 / empty = no limit
//   ADMIN_EMAIL      optional, default rakib@voiceofstartup.bd
//   SITE_ORIGIN      optional, default https://www.voiceofstartup.bd
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from || "");
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: "", email: String(from || "").trim() };
}

function settings(env) {
  const provider = env.RESEND_API_KEY ? "resend" : env.BREVO_API_KEY ? "brevo" : "";
  return {
    provider,
    key: env.RESEND_API_KEY || env.BREVO_API_KEY || "",
    from: env.MAIL_FROM || "",
    replyTo: env.MAIL_REPLY_TO || "",
    daily: Math.max(0, parseInt(env.DAILY_LIMIT || "0", 10) || 0),
    admin: (env.ADMIN_EMAIL || "rakib@voiceofstartup.bd").toLowerCase(),
    origin: (env.SITE_ORIGIN || "https://www.voiceofstartup.bd").replace(/\/+$/, ""),
  };
}

/* ---------- providers ---------- */
function unsubHeaders(url) { return { "List-Unsubscribe": `<${url}>` }; }

async function resendOne(S, m, fetchFn) {
  const r = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${S.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: S.from, to: [m.to], subject: m.subject, html: m.html, reply_to: S.replyTo || undefined, headers: unsubHeaders(m.unsub) }),
  });
  if (r.ok) return { ok: true };
  const t = await r.text().catch(() => "");
  return { ok: false, status: r.status, retryAfter: Number(r.headers.get("retry-after")) || 0, error: `resend ${r.status}: ${t.slice(0, 200)}` };
}

async function brevoOne(S, m, fetchFn) {
  const from = parseFrom(S.from);
  const r = await fetchFn("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": S.key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: from.name || undefined, email: from.email }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html,
      replyTo: S.replyTo ? { email: S.replyTo } : undefined, headers: unsubHeaders(m.unsub) }),
  });
  if (r.ok) return { ok: true };
  const t = await r.text().catch(() => "");
  return { ok: false, status: r.status, retryAfter: Number(r.headers.get("retry-after")) || 0, error: `brevo ${r.status}: ${t.slice(0, 200)}` };
}

/* Sends a list of messages; returns one result per message, in order. Stops early (rate = true) when the provider says "slow down". */
async function sendMany(S, msgs, fetchFn) {
  const one = S.provider === "brevo" ? brevoOne : resendOne;
  if (S.provider === "resend" && msgs.length > 1) {
    const r = await fetchFn("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${S.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(msgs.map((m) => ({ from: S.from, to: [m.to], subject: m.subject, html: m.html, reply_to: S.replyTo || undefined, headers: unsubHeaders(m.unsub) }))),
    });
    if (r.ok) return { results: msgs.map(() => ({ ok: true })) };
    if (r.status === 429 || r.status >= 500) return { results: [], rate: true, error: `resend ${r.status}`, retryAfter: Number(r.headers.get("retry-after")) || 2 };
    if (r.status === 401 || r.status === 403) { const t = await r.text().catch(() => ""); return { results: [], fatal: `resend ${r.status}: ${t.slice(0, 200)}` }; }
    // one bad address makes Resend reject the whole batch -> send one by one to find it
  }
  const results = [];
  for (let i = 0; i < msgs.length; i += 4) {
    const part = await Promise.all(msgs.slice(i, i + 4).map((m) => one(S, m, fetchFn)));
    for (const p of part) {
      if (!p.ok && (p.status === 401 || p.status === 403)) return { results, fatal: p.error };
      if (!p.ok && (p.status === 429 || p.status >= 500)) return { results, rate: true, error: p.error, retryAfter: p.retryAfter || 2 };
      results.push(p);
    }
    if (i + 4 < msgs.length) await sleep(S.provider === "resend" ? 550 : 120);
  }
  return { results };
}

const fill = (html, vars) => html.replace(/\{\{(UNSUB_URL|EMAIL)\}\}/g, (_, k) => vars[k] || "");

/* ---------- request handler ---------- */
export async function handle(req, deps) {
  const { env, fetchFn, createClient } = deps;
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const S = settings(env);
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // only the admin may use this function
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await db.auth.getUser(token);
  if (ue || !u || !u.user || (u.user.email || "").toLowerCase() !== S.admin) return json({ ok: false, error: "Not allowed" }, 403);

  let body = {};
  try { body = await req.json(); } catch (e) {}
  const action = body.action;

  const sentToday = async () => {
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const { count } = await db.from("campaign_sends").select("subscriber_id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", day.toISOString());
    return count || 0;
  };

  if (action === "status") {
    const today = S.daily ? await sentToday() : 0;
    return json({ ok: true, configured: !!(S.provider && S.key && S.from), provider: S.provider, from: S.from, daily_limit: S.daily, sent_today: today });
  }
  if (!S.provider || !S.key || !S.from) return json({ ok: false, error: "not_configured", message: "Email provider is not set up yet (add RESEND_API_KEY and MAIL_FROM in Supabase → Edge Functions → Secrets)." });

  if (action === "test") {
    const to = String(body.to || "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return json({ ok: false, error: "bad_email", message: "Enter a valid email address." });
    const subject = "[TEST] " + String(body.subject || "").slice(0, 190);
    const unsub = `${S.origin}/unsubscribe`;
    const html = fill(String(body.html || ""), { UNSUB_URL: unsub, EMAIL: to });
    const { results, fatal, error } = await sendMany(S, [{ to, subject, html, unsub }], fetchFn);
    if (fatal) return json({ ok: false, error: "provider_rejected", message: fatal });
    const r = results[0];
    return r && r.ok ? json({ ok: true }) : json({ ok: false, error: "send_failed", message: (r && r.error) || error || "Could not send" });
  }

  if (action === "retry") {
    await db.from("campaign_sends").delete().eq("campaign_id", body.campaign_id).eq("status", "failed");
    await db.from("campaigns").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", body.campaign_id);
    return json({ ok: true });
  }

  if (action !== "send") return json({ ok: false, error: "unknown_action" }, 400);

  /* ----- send: process as many batches as fit in the time budget; the admin page calls again until done ----- */
  const id = body.campaign_id;
  const { data: c, error: ce } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (ce || !c) return json({ ok: false, error: "no_campaign", message: "Campaign not found." });
  if (c.status === "sent") return json({ ok: true, done: true, sent: c.sent, failed: c.failed, total: c.total });
  if (!c.body_html || !c.subject) return json({ ok: false, error: "empty", message: "The campaign needs a subject and a message." });

  if (c.status === "draft" || !c.total) {
    const { data: n } = await db.rpc("campaign_audience_count", { p_audience: c.audience });
    const total = Number(n) || 0;
    if (!total) return json({ ok: false, error: "no_audience", message: "There are no active subscribers for this audience." });
    await db.from("campaigns").update({ status: "sending", total, updated_at: new Date().toISOString() }).eq("id", id);
    c.total = total;
  } else if (c.status !== "sending") {
    await db.from("campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", id);
  }

  const started = Date.now(), budget = Math.min(Math.max(Number(body.budget_ms) || 40000, 5000), 100000);
  let allowed = S.daily ? S.daily - (await sentToday()) : Infinity;
  let pausedReason = "", lastError = "";

  const counts = async () => {
    const [a, b] = await Promise.all([
      db.from("campaign_sends").select("subscriber_id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent"),
      db.from("campaign_sends").select("subscriber_id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "failed"),
    ]);
    return { sent: a.count || 0, failed: b.count || 0 };
  };

  let finished = false;
  while (Date.now() - started < budget) {
    if (allowed <= 0) { pausedReason = "daily_limit"; break; }
    const size = Math.min(50, allowed === Infinity ? 50 : allowed);
    const { data: rows, error: re } = await db.rpc("campaign_next_batch", { p_campaign: id, p_limit: size });
    if (re) { lastError = re.message; break; }
    if (!rows || !rows.length) { finished = true; break; }

    const msgs = [], skipped = [];
    for (const r of rows) {
      if (!EMAIL_RE.test(r.email || "")) { skipped.push(r); continue; }
      const unsub = `${S.origin}/unsubscribe?t=${r.token}`;
      msgs.push({ sid: r.id, to: r.email, subject: c.subject, html: fill(c.body_html, { UNSUB_URL: unsub, EMAIL: r.email }), unsub });
    }
    const { results, rate, fatal, error, retryAfter } = await sendMany(S, msgs, fetchFn);
    const log = [];
    results.forEach((res, i) => log.push({ campaign_id: id, subscriber_id: msgs[i].sid, status: res.ok ? "sent" : "failed", error: res.ok ? null : String(res.error || "").slice(0, 300) }));
    skipped.forEach((r) => log.push({ campaign_id: id, subscriber_id: r.id, status: "failed", error: "invalid address" }));
    if (log.length) await db.from("campaign_sends").upsert(log, { onConflict: "campaign_id,subscriber_id" });
    allowed -= results.filter((x) => x.ok).length;
    if (fatal) { lastError = fatal; pausedReason = "provider_rejected"; break; }
    if (rate) { lastError = error || "rate limited"; await sleep(Math.min((retryAfter || 2) * 1000, 8000)); if (Date.now() - started > budget - 3000) break; continue; }
    await sleep(300);
  }

  const { sent, failed } = await counts();
  const patch = { sent, failed, updated_at: new Date().toISOString(), last_error: lastError || null };
  if (finished) { patch.status = "sent"; patch.sent_at = new Date().toISOString(); }
  else if (pausedReason) patch.status = "paused";
  await db.from("campaigns").update(patch).eq("id", id);
  return json({ ok: true, done: finished, paused: pausedReason || undefined, error: lastError || undefined, sent, failed, total: c.total });
}

// Supabase / Deno entry point (skipped when the file is imported by tests)
declare const Deno: any;
if (typeof Deno !== "undefined" && (Deno as any).serve) {
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  (Deno as any).serve((req: Request) => handle(req, { env: (Deno as any).env.toObject(), fetchFn: fetch, createClient }).catch((e: any) => json({ ok: false, error: "server_error", message: String(e && e.message || e) }, 500)));
}
