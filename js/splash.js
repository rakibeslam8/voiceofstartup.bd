/* Voice of Startup Bangladesh - opening animation gate.
 * Plays for every visitor on the first page of a visit (once per browser tab / app launch).
 * Skipped for search-engine bots, link-preview bots and speed-test tools so Google always sees the plain page.
 * Preview anywhere: add ?splash=1 to a page address (?splash=hold keeps it on screen). */
(function () {
  try {
    var d = document, w = window, u = navigator.userAgent || '', q = location.search;
    var force = /[?&]splash=(1|hold)(&|$)/.test(q);
    if (!force) {
      if (navigator.webdriver) return;
      if (/bot|crawl|spider|slurp|google|lighthouse|pagespeed|gtmetrix|headless|facebookexternalhit|embedly|preview|whatsapp|telegram|twitter|linkedin|pinterest|yandex|baidu|duckduck|bing|ahrefs|semrush|screaming|ptst/i.test(u)) return;
      try { if (sessionStorage.getItem('vosb-splash')) return; sessionStorage.setItem('vosb-splash', '1'); } catch (e) {}
    }
    w.__vosbSplash = { hold: /[?&]splash=hold(&|$)/.test(q), force: force };
    d.write('<script src="/js/splash-art.js?v=20261025b"><\/script>');
  } catch (e) {}
})();
