/* Admin page only: refuse to be shown inside another site's frame (clickjacking protection).
   The page starts hidden (see admin.html) and is revealed only when it is the top-level window. */
(function () {
  var st = document.getElementById("fb-style");
  if (window.top === window.self) { if (st) st.parentNode.removeChild(st); return; }
  try { window.top.location.href = window.self.location.href; } catch (e) { /* stay hidden */ }
})();
