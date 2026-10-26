// Bodky na pravom okraji: ak je v dni viac kariet (delená služba, viac služieb), ukážu koľko ich je,
// ktorá je práve zobrazená (zvýraznená) a ťuk na bodku k nej posunie zoznam.
(function () {
  var box = null, kontajner = null, wrap = null, karty = [], plan = false;

  function aktivna() {
    if (!kontajner || !karty.length) return 0;
    var r = wrap.getBoundingClientRect(), best = 0, bestV = -1;
    karty.forEach(function (c, i) {
      var b = c.getBoundingClientRect();
      var v = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top); // viditeľná výška
      if (v > bestV + 1) { bestV = v; best = i; }
    });
    // na konci zoznamu je posledná karta aktívna, aj keď je nižšia než prvá
    if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2 && wrap.scrollTop > 0) best = karty.length - 1;
    return best;
  }

  function oznac() {
    if (!box) return;
    var r = wrap.getBoundingClientRect();
    var vid = karty.length > 1 && wrap.offsetParent !== null;
    box.style.display = vid ? "flex" : "none";
    box.style.top = (r.top + r.height / 2) + "px";
    var a = aktivna();
    Array.prototype.forEach.call(box.children, function (d, i) { d.classList.toggle("on", i === a); });
  }

  function stavaj() {
    plan = false;
    kontajner = document.getElementById("servicesContainer");
    wrap = document.getElementById("swipeWrapper");
    if (!kontajner || !wrap) return;
    karty = Array.prototype.slice.call(kontajner.querySelectorAll(".service-card"));
    if (!box) {
      box = document.createElement("div");
      box.className = "karty-bodky";
      box.setAttribute("aria-hidden", "true");
      document.body.appendChild(box);
      wrap.addEventListener("scroll", oznac, { passive: true });
    }
    box.innerHTML = "";
    if (karty.length < 2) { box.style.display = "none"; return; }
    karty.forEach(function (c, i) {
      var d = document.createElement("div");
      d.className = "karty-bodka";
      d.innerHTML = "<i></i>";
      d.addEventListener("click", function () {
        var top = c.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop - 6;
        wrap.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
      box.appendChild(d);
    });
    oznac();
  }

  function naplanuj() {
    if (plan) return;
    plan = true;
    requestAnimationFrame(stavaj);
  }

  function init() {
    var c = document.getElementById("servicesContainer");
    if (!c) return;
    new MutationObserver(naplanuj).observe(c, { childList: true });
    window.addEventListener("resize", naplanuj);
    setInterval(function () { if (box) oznac(); }, 500); // pohľad sa mení (Burza, Profil…)
    naplanuj();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
