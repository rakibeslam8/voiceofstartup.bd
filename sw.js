/* Voice of Startup Bangladesh - minimal service worker.
 * Makes the site installable as an app. It does NOT cache pages: every request goes to the network,
 * so readers always get the latest news. Only when a page is opened while offline does it show a short notice. */
const V = "vosb-sw-1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.mode !== "navigate") return;
  e.respondWith(fetch(r).catch(() => new Response(
    '<!doctype html><html lang="bn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faefe0;color:#17120d;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:1.4rem">ইন্টারনেট সংযোগ নেই</h1><p>You are offline. Please reconnect and try again.</p>' +
    '<p><a href="/" style="color:#ff7522;font-weight:700">Voice of Startup Bangladesh</a></p></div></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
