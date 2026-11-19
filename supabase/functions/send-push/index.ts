// Voice of Startup Bangladesh — sends Web Push notifications (the ones that appear on the phone / computer even when the site is closed).
// A pg_cron job (public.push_tick, every minute) turns new articles / member notifications / admin announcements into rows of `push_outbox`
// and calls this function with the shared secret (header x-cron-secret, checked in the database vault). The VAPID keys live in the vault too.
// Subscriptions that the push service reports as gone (404 / 410) are switched off automatically.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const BATCH = 500, CONC = 25, BUDGET_MS = 100_000;

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(name + " " + r.status);
  return r.json();
}
async function get(path: string) { const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error("get " + path.slice(0, 40) + " " + r.status); return r.json(); }
async function patch(path: string, body: unknown) { const r = await fetch(`${URL_}/rest/v1/${path}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error("patch " + r.status); return r.json(); }

const okHost = (u: string) => { try { const x = new URL(u); const h = x.hostname.toLowerCase(); return x.protocol === "https:" && (h === "fcm.googleapis.com" || h === "android.googleapis.com" || h.endsWith(".push.services.mozilla.com") || h === "web.push.apple.com" || h.endsWith(".push.apple.com") || h.endsWith(".notify.windows.com")); } catch { return false; } };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; lang: string };
type Row = { id: string; kind: string; audience: string; user_id: string | null; title_bn: string; title_en: string; body_bn: string | null; body_en: string | null; url: string; image: string | null; cursor: string | null; sent_n: number; failed_n: number };

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k]); } }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  const secret = req.headers.get("x-cron-secret") || "";
  let ok = false; try { ok = secret.length > 20 && (await rpc("push_secret_ok", { p: secret })) === true; } catch (_) { ok = false; }
  if (!ok) return J({ error: "not allowed" }, 401);

  const keys = await rpc("push_keys");
  if (!keys?.public || !keys?.private) return J({ error: "VAPID keys missing" }, 500);
  webpush.setVapidDetails("mailto:editor@voiceofstartup.bd", keys.public, keys.private);

  const started = Date.now(), report: unknown[] = [];
  // claim waiting rows (a row stuck in "sending" for 5+ minutes is picked up again from its cursor)
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  const rows: Row[] = await get(`push_outbox?select=*&or=(status.eq.pending,and(status.eq.sending,created_at.lt.${stale}))&order=created_at.asc&limit=5`);
  for (const row of rows) {
    if (Date.now() - started > BUDGET_MS) break;
    await patch(`push_outbox?id=eq.${row.id}`, { status: "sending" });
    let cursor = row.cursor, sent = row.sent_n || 0, failed = row.failed_n || 0, finished = false, fatal = "";
    while (!finished && Date.now() - started < BUDGET_MS) {
      let q = `push_subscriptions?select=id,endpoint,p256dh,auth,lang&disabled_at=is.null&order=id.asc&limit=${BATCH}`;
      if (cursor) q += `&id=gt.${cursor}`;
      if (row.audience === "members") q += "&user_id=not.is.null";
      if (row.audience === "user") { if (!row.user_id) { finished = true; break; } q += `&user_id=eq.${row.user_id}`; }
      const subs: Sub[] = await get(q);
      const gone: string[] = [];
      await pool(subs, CONC, async (s) => {
        const bn = s.lang !== "en";
        const payload = JSON.stringify({
          title: (bn ? row.title_bn : row.title_en) || row.title_bn || row.title_en,
          body: (bn ? row.body_bn || row.body_en : row.body_en || row.body_bn) || "",
          url: row.url, image: row.image || undefined, tag: row.kind + ":" + row.id.slice(0, 8), lang: bn ? "bn" : "en",
        });
        if (!okHost(s.endpoint)) { gone.push(s.id); return; } // never call anything that is not a real push service
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: row.kind === "article" ? "normal" : "high" }); sent++; }
        catch (e: any) { failed++; const c = e?.statusCode; if (c === 404 || c === 410) gone.push(s.id); else if (c === 401 || c === 403) fatal = "push service rejected our keys (" + c + ")"; }
      });
      if (gone.length) await patch(`push_subscriptions?id=in.(${gone.join(",")})`, { disabled_at: new Date().toISOString() });
      if (subs.length) cursor = subs[subs.length - 1].id;
      finished = subs.length < BATCH;
      await patch(`push_outbox?id=eq.${row.id}`, { cursor, sent_n: sent, failed_n: failed });
      if (fatal) break;
    }
    if (finished || fatal) await patch(`push_outbox?id=eq.${row.id}`, { status: fatal ? "failed" : "sent", sent_at: new Date().toISOString(), total_n: sent + failed });
    report.push({ id: row.id, sent, failed, done: finished, fatal: fatal || undefined });
  }
  return J({ ok: true, processed: report });
});
