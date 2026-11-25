/* Zmeria skutočnú výšku hlavičky a spodného menu a nastaví ju ako --hdr-h / --nav-h, aby okná (napr. Cestovné poriadky) nepredpokladali pevných 64 px. */
(function () {
  var root = document.documentElement;
  function zmer() {
    var h = document.querySelector(".app-header"), n = document.querySelector(".bottom-nav");
    if (h) { var a = Math.round(h.getBoundingClientRect().height); if (a > 0) root.style.setProperty("--hdr-h", a + "px"); }
    if (n) { var b = Math.round(n.getBoundingClientRect().height); if (b > 0) root.style.setProperty("--nav-h", b + "px"); }
  }
  // Klávesnica: keď zmenší zobrazenú plochu, spodné menu sa skryje (nevyhrnie sa nad klávesnicu)
  var maxH = 0;
  function klav() {
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    maxH = Math.max(maxH, window.innerHeight, vh);
    var a = document.activeElement, pole = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    var otv = pole && vh < maxH * 0.8;
    document.body.classList.toggle("kb-otvorena", !!otv);
  }
  function start() {
    klav();
    window.addEventListener("resize", klav);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", klav);
    document.addEventListener("focusin", function () { setTimeout(klav, 150); setTimeout(klav, 500); });
    document.addEventListener("focusout", function () { setTimeout(klav, 150); setTimeout(klav, 500); });
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
