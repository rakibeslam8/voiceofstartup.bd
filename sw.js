/* Voice of Startup Bangladesh - minimal service worker.
 * Makes the site installable as an app. It does NOT cache pages: every request goes to the network,
 * so readers always get the latest news.
 * If a page cannot be loaded it first retries; only if that also fails does it show a short notice
 * (a real "offline" notice only when the device itself is offline, otherwise a "try again" notice). */
const V = "vosb-sw-3";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPage(req) {
  let err;
  for (let i = 0; i < 3; i++) {
    try { return await fetch(req); } catch (e) { err = e; await wait(500 * (i + 1)); }
  }
  throw err;
}

function fallback() {
  const offline = self.navigator && self.navigator.onLine === false;
  const bn = offline ? "ইন্টারনেট সংযোগ নেই" : "সাইটটি এই মুহূর্তে খোলা যাচ্ছে না";
  const en = offline ? "You are offline. Please reconnect and try again." : "We could not load the page just now. Your internet looks fine - tap Try again.";
  const html = '<!doctype html><html lang="bn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voice of Startup Bangladesh</title>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faefe0;color:#17120d;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:1.4rem">' + bn + '</h1><p>' + en + '</p>' +
    '<p><button onclick="location.reload()" style="background:#e55f0f;color:#fff;border:0;border-radius:999px;padding:12px 28px;font:700 1rem system-ui;cursor:pointer">Try again</button></p>' +
    '<p><a href="/" style="color:#ff7522;font-weight:700">Voice of Startup Bangladesh</a></p></div>' +
    '<script>setTimeout(function(){ if (navigator.onLine) location.reload(); }, 6000);</script></body></html>';
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.mode !== "navigate") return;
  e.respondWith(loadPage(r).catch(fallback));
});

/* ---------- Web Push: news and updates that arrive on the device even when the site is closed ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Voice of Startup Bangladesh";
  const opt = {
    body: d.body || "",
    icon: "/assets/icon-192.png",
    badge: "/assets/favicon-96.png",
    tag: d.tag || "vosb",
    renotify: false,
    lang: d.lang || "bn",
    data: { url: d.url || "/" },
  };
  if (d.image && /^https:\/\//.test(d.image)) opt.image = d.image;
  e.waitUntil(self.registration.showNotification(title, opt));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || "/";
  let target; try { target = new URL(raw, self.location.origin); if (target.origin !== self.location.origin) target = new URL("/", self.location.origin); } catch (x) { target = new URL("/", self.location.origin); }
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) { try { await c.focus(); if ("navigate" in c) await c.navigate(target.href); return; } catch (x) { /* fall through */ } }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});

/* the push service renewed or dropped our subscription: ask an open page to register the new one (it does so on its next visit otherwise) */
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => all.forEach((c) => c.postMessage({ type: "push-resync" }))));
});
