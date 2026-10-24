/* Voice of Startup Bangladesh - opening animation gate.
 * Plays ONLY inside the installed app (home-screen/standalone app or Android app WebView), once per launch.
 * Normal browser visitors, search crawlers and social-app browsers never download the animation.
 * Preview in any browser: add ?splash=1 to a page address (use ?splash=hold to keep it on screen). */
(function () {
  try {
    var d = document, w = window, u = navigator.userAgent || '', q = location.search;
    var force = /[?&]splash=(1|hold)(&|$)/.test(q);
    var mq = function (m) { try { return !!(w.matchMedia && w.matchMedia(m).matches); } catch (e) { return false; } };
    var app = mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)') || mq('(display-mode: minimal-ui)') ||
      navigator.standalone === true || (d.referrer || '').indexOf('android-app://') === 0 ||
      (/; wv\)/.test(u) && !/FBAN|FBAV|FB_IAB|Instagram|LinkedIn|Line\/|Twitter|Snapchat|musical_ly|BytedanceWebview|Messenger|GSA\//.test(u));
    if (!force && !app) return;
    if (!force) { try { if (sessionStorage.getItem('vosb-splash')) return; sessionStorage.setItem('vosb-splash', '1'); } catch (e) {} }
    w.__vosbSplash = { hold: /[?&]splash=hold(&|$)/.test(q) };
    d.write('<script src="/js/splash-art.js?v=20261024a"><\/script>');
  } catch (e) {}
})();
