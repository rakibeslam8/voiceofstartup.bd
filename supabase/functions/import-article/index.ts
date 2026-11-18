// Voice of Startup Bangladesh — "Import from link" for the admin article editor.
// The signed-in ADMIN pastes a web address; this function reads the page on the server (browsers cannot, because of CORS),
// extracts title / summary / cover / article text / links / pictures + captions, copies the pictures into our own storage
// (post-images bucket) and returns a draft in the editor's Markdown-lite format. Nothing is saved to the articles table here.
// Safety: admin only; http/https only; private & internal addresses are refused (also after redirects); size and time limits.
import { extract, absUrl } from "./extract.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "rakib@voiceofstartup.bd", ADMIN_ID = "c9c7d62e-08ee-4b0b-a3d8-572b7ac66d38";
const ORIGINS = ["https://www.voiceofstartup.bd", "https://voiceofstartup.bd"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_HTML = 3_000_000, MAX_IMG = 4_500_000, MAX_IMAGES = 14;

const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ORIGINS.includes(req.headers.get("origin") || "") ? req.headers.get("origin")! : ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

/* ---------- address safety ---------- */
function privateIp(ip: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("::ffff:");
}
async function assertPublic(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new Error("bad-url");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("bad-url");
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost") || !h.includes(".") && !h.includes(":")) throw new Error("bad-url");
  if (/^[\d.]+$/.test(h) || h.includes(":")) { if (privateIp(h)) throw new Error("bad-url"); return; }
  for (const t of ["A", "AAAA"] as const) {
    try { const r = await Deno.resolveDns(h, t); if (r.some((ip) => privateIp(String(ip)))) throw new Error("bad-url"); }
    catch (e) { if ((e as Error).message === "bad-url") throw e; /* no record of this type / resolver not permitted: the other checks above still apply */ }
  }
}
async function safeFetch(start: string, init: RequestInit, ms: number): Promise<Response> {
  let url = new URL(start);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url.href, { ...init, redirect: "manual", signal: AbortSignal.timeout(ms) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, url); continue; }
    return res;
  }
  throw new Error("too-many-redirects");
}
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const len = Number(res.headers.get("content-length") || 0); if (len && len > max) throw new Error("too-big");
  const reader = res.body!.getReader(); const parts: Uint8Array[] = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > max) { try { await reader.cancel(); } catch { /* */ } throw new Error("too-big"); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
function decode(bytes: Uint8Array, contentType: string): string {
  let cs = (contentType.match(/charset=([^;\s]+)/i) || [])[1];
  if (!cs) cs = (new TextDecoder("latin1").decode(bytes.slice(0, 3000)).match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  try { return new TextDecoder((cs || "utf-8").toLowerCase()).decode(bytes); } catch { return new TextDecoder("utf-8").decode(bytes); }
}

/* ---------- copy a picture into our own storage ---------- */
async function rehost(src: string, page: string): Promise<string | null> {
  try {
    const res = await safeFetch(src, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", Referer: page } }, 10000);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = ({ "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[type];
    if (!ext) return null;
    const bytes = await readCapped(res, MAX_IMG);
    if (bytes.length < 1200) return null;
    const d = new Date();
    const path = `import/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}.${ext}`;
    const up = await fetch(`${URL_}/storage/v1/object/post-images/${path}`, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": type, "cache-control": "31536000", "x-upsert": "false" }, body: new Blob([bytes as unknown as BlobPart], { type }), signal: AbortSignal.timeout(20000) });
    if (!up.ok) return null;
    return `${URL_}/storage/v1/object/public/post-images/${path}`;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "POST only" }, 405);
  // admin only
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let admin = false;
  if (tok) { try { const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: "Bearer " + tok } }); if (u.ok) { const j = await u.json(); admin = String(j?.email || "").toLowerCase() === ADMIN_EMAIL && j?.id === ADMIN_ID; } } catch { /* */ } }
  if (!admin) return json(req, { ok: false, error: "Admin sign-in required." }, 401);

  let link = ""; try { link = String((await req.json())?.url || "").trim(); } catch { /* */ }
  if (!/^https?:\/\//i.test(link)) link = link ? "https://" + link : "";
  let page: URL; try { page = new URL(link); } catch { return json(req, { ok: false, error: "That does not look like a web address. Paste the full link (https://…)." }); }
  try {
    const res = await safeFetch(page.href, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "bn,en;q=0.8" } }, 15000);
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) return json(req, { ok: false, error: "This website does not allow automatic reading (it asked for a sign-in or blocked robots). Open the article, copy the text and paste it into the editor." });
    if (!res.ok) return json(req, { ok: false, error: `The website answered with an error (${res.status}). Check the link and try again.` });
    const ct = res.headers.get("content-type") || "";
    if (ct && !/html|xml/i.test(ct)) return json(req, { ok: false, error: "That link is not a web page (it is a file or video). Paste the link of an article page." });
    const html = decode(await readCapped(res, MAX_HTML), ct);
    let ex; try { ex = extract(html, res.url || page.href); } catch (e) {
      if ((e as Error).message === "no-article") return json(req, { ok: false, error: "Could not find the article text on this page. It may load its text with JavaScript or be behind a sign-in. Open it, copy the text and paste it into the editor." });
      throw e;
    }
    // copy pictures to our storage (cover first), 4 at a time
    const list = ex.images.slice(0, MAX_IMAGES), map = new Map<string, string>();
    for (let i = 0; i < list.length; i += 4) {
      const part = list.slice(i, i + 4);
      const got = await Promise.all(part.map((u) => rehost(u, page.href)));
      part.forEach((u, k) => { if (got[k]) map.set(u, got[k]!); });
    }
    let md = ex.markdown;
    // pictures we could not copy stay as plain addresses only for the first MAX_IMAGES; the rest and failures are removed so nothing hot-links other sites
    md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => (map.has(u) ? `![${alt}](${map.get(u)})` : ""));
    md = md.replace(/\n{3,}/g, "\n\n").trim();
    const cover = map.get(ex.cover) || "";
    return json(req, {
      ok: true, lang: ex.lang, title: ex.title, excerpt: ex.excerpt, markdown: md, cover, coverAlt: ex.coverAlt, author: ex.author,
      siteName: ex.siteName, sourceUrl: ex.canonical && absUrl(ex.canonical, page.href) ? absUrl(ex.canonical, page.href) : (res.url || page.href), publishedAt: ex.publishedAt,
      imagesFound: ex.images.length, imagesSaved: map.size,
    });
  } catch (e) {
    const m = (e as Error).message || "";
    if (m === "bad-url") return json(req, { ok: false, error: "That address cannot be opened (only public websites are allowed)." });
    if (/timed out|timeout|abort/i.test(m)) return json(req, { ok: false, error: "The website took too long to answer. Try again." });
    if (m === "too-big") return json(req, { ok: false, error: "That page is too large to import." });
    return json(req, { ok: false, error: "Could not read that page: " + m.slice(0, 120) });
  }
});
