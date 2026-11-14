// Voice of Startup Bangladesh — keeps every company listing readable in BOTH languages.
// A database trigger marks a company "i18n_stale" whenever the founder/admin changes the wording; a schedule (pg_cron, every minute)
// calls this function, which translates the changed fields (Bangla -> English or English -> Bangla, detected per field) and saves them.
// Callers: the schedule (x-cron-secret header, checked against the database vault) or the signed-in admin (Authorization: Bearer <admin token>, optional {company_id}).
const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN = "rakib@voiceofstartup.bd";
const CORS = { "Access-Control-Allow-Origin": "https://www.voiceofstartup.bd", "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const bn = (s: string) => (s.match(/[ঀ-৿]/g) || []).length, lat = (s: string) => (s.match(/[A-Za-z]/g) || []).length;
const lang = (s: string): "bn" | "en" | "none" => { const b = bn(s), l = lat(s); return !b && !l ? "none" : b > l ? "bn" : "en"; };

async function google(text: string, from: string, to: string) {
  const r = await fetch("https://translate.googleapis.com/translate_a/single", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams({ client: "gtx", sl: from, tl: to, dt: "t", q: text }).toString() });
  if (!r.ok) throw new Error("google " + r.status);
  const j = await r.json(); if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error("google format");
  return j[0].map((s: any) => (s && s[0]) || "").join("");
}
async function myMemory(text: string, from: string, to: string) {
  const parts = text.match(/[\s\S]{1,450}(?:[\s।.!?]|$)/g) || [text]; let out = "";
  for (const p of parts) {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${from}|${to}`); if (!r.ok) throw new Error("mymemory " + r.status);
    const j = await r.json(); const t = j?.responseData?.translatedText; if (!t || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error("mymemory limit"); out += t;
  }
  return out;
}
async function plain(text: string, from: string, to: string) {
  let err: unknown;
  for (const e of [google, myMemory]) { for (let i = 0; i < 2; i++) { try { const t = await e(text, from, to); if (t && t.trim()) return t; } catch (x) { err = x; await new Promise((r) => setTimeout(r, 400)); } } }
  throw err || new Error("translation failed");
}
function chunks(t: string) { const out: string[] = []; let cur = ""; for (const para of t.split(/\n{2,}/)) { if ((cur + "\n\n" + para).length > 1400 && cur) { out.push(cur); cur = para; } else cur = cur ? cur + "\n\n" + para : para; } if (cur) out.push(cur); return out; }
async function tr(text: string, from: string, to: string) {
  const parts = chunks(text.replace(/\r\n?/g, "\n")), done: string[] = [];
  for (const p of parts) {
    if (p.length <= 1400 && !p.includes("\n")) { done.push(await plain(p, from, to)); continue; }
    const lines = p.split("\n"); const res: string[] = [];
    for (const l of lines) res.push(l.trim() ? await plain(l, from, to) : l);       // line by line keeps bullets/line breaks intact
    done.push(res.join("\n"));
  }
  return done.join("\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

const FIELDS = [["name", "name_bn", "name_en", 120], ["tagline", "tagline_bn", "tagline_en", 160], ["description", "description_bn", "description_en", 6000],
  ["business_model", "business_model_bn", "business_model_en", 1500], ["highlights", "highlights_bn", "highlights_en", 1500], ["use_of_funds", "use_of_funds_bn", "use_of_funds_en", 1500]] as const;

async function one(c: any) {
  const set: Record<string, unknown> = {};
  for (const [src, cb, ce, max] of FIELDS) {
    const t = typeof c[src] === "string" ? c[src].trim() : ""; if (!t) { set[cb] = null; set[ce] = null; continue; }
    const l = lang(t);
    if (l === "none") { set[cb] = t.slice(0, max); set[ce] = t.slice(0, max); continue; }
    if (src === "name" && l === "en") { set[ce] = t.slice(0, max); set[cb] = null; continue; }   // brand names typed in English stay as typed
    const to = l === "bn" ? "en" : "bn", other = (await tr(t, l, to)).slice(0, max);
    if (l === "bn") { set[cb] = t.slice(0, max); set[ce] = other; } else { set[ce] = t.slice(0, max); set[cb] = other; }
  }
  const team = Array.isArray(c.team) ? c.team.slice(0, 8) : [], roles: { bn: string | null; en: string | null }[] = [];
  for (const m of team) {
    const r = typeof m?.role === "string" ? m.role.trim() : ""; if (!r) { roles.push({ bn: null, en: null }); continue; }
    const l = lang(r); if (l === "none") { roles.push({ bn: r, en: r }); continue; }
    const o = (await tr(r, l, l === "bn" ? "en" : "bn")).slice(0, 80); roles.push(l === "bn" ? { bn: r, en: o } : { en: r, bn: o });
  }
  const sig = team.map((m: any) => (m?.name || "") + "|" + (m?.role || "")).join(";");
  const body = { ...set, i18n_extra: { sig, team: roles }, i18n_stale: false, i18n_at: new Date().toISOString(), i18n_tries: 0 };
  // only write if nobody edited the company while we were translating
  const r = await fetch(`${URL_}/rest/v1/companies?id=eq.${c.id}&updated_at=eq.${encodeURIComponent(c.updated_at)}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => []); return Array.isArray(j) && j.length ? "done" : "changed-meanwhile";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let allowed = false, manual = false;
  const cs = req.headers.get("x-cron-secret") || "";
  if (cs) { const r = await fetch(`${URL_}/rest/v1/rpc/i18n_secret_ok`, { method: "POST", headers: H, body: JSON.stringify({ p: cs }) }); allowed = r.ok && (await r.json()) === true; }
  if (!allowed) {
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (tok) { const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: "Bearer " + tok } }); if (u.ok) { const j = await u.json(); if (String(j?.email || "").toLowerCase() === ADMIN) { allowed = true; manual = true; } } }
  }
  if (!allowed) return json({ error: "not allowed" }, 401);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const id = manual && typeof body.company_id === "string" && /^[0-9a-f-]{36}$/i.test(body.company_id) ? body.company_id : "";
  const cols = "id,name,tagline,description,business_model,highlights,use_of_funds,team,updated_at,i18n_tries";
  let q = `${URL_}/rest/v1/companies?select=${cols}&deleted_at=is.null&order=updated_at.asc&limit=${id ? 1 : 5}`;
  q += id ? `&id=eq.${id}` : `&i18n_stale=eq.true&i18n_tries=lt.12&updated_at=lt.${encodeURIComponent(new Date(Date.now() - 40000).toISOString())}`;
  const rows = await (await fetch(q, { headers: H })).json();
  if (!Array.isArray(rows)) return json({ error: "read failed" }, 500);
  const out: Record<string, string> = {};
  for (const c of rows) {
    try { out[c.id] = await one(c); }
    catch (e) { out[c.id] = "failed: " + String((e as Error).message || e).slice(0, 80); await fetch(`${URL_}/rest/v1/companies?id=eq.${c.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ i18n_tries: (c.i18n_tries || 0) + 1 }) }); }
  }
  return json({ processed: rows.length, results: out });
});
