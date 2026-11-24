/* Zmeria skutočnú výšku hlavičky a spodného menu a nastaví ju ako --hdr-h / --nav-h, aby okná (napr. Cestovné poriadky) nepredpokladali pevných 64 px. */
(function () {
  var root = document.documentElement;
  function zmer() {
    var h = document.querySelector(".app-header"), n = document.querySelector(".bottom-nav");
    if (h) { var a = Math.round(h.getBoundingClientRect().height); if (a > 0) root.style.setProperty("--hdr-h", a + "px"); }
    if (n) { var b = Math.round(n.getBoundingClientRect().height); if (b > 0) root.style.setProperty("--nav-h", b + "px"); }
  }
  function start() {
    zmer();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(zmer);
      var h = document.querySelector(".app-header"), n = document.querySelector(".bottom-nav");
      if (h) ro.observe(h); if (n) ro.observe(n);
    }
    window.addEventListener("resize", zmer);
    window.addEventListener("orientationchange", function () { setTimeout(zmer, 200); });
    setTimeout(zmer, 500); setTimeout(zmer, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
