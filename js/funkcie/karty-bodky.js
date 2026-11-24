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
    karty = Array.prototype.slice.call(kontajner.querySelectorAll(".service-card:not(.burza-row)"));
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
    zoomNaAktualnu();
  }

  // Dnes s viac kartami: zoom na tú, ktorá práve prebieha, inak na tú s najbližším začiatkom k aktuálnemu času
  var zoomKluc = "";
  function zoomNaAktualnu() {
    try {
      var sel = window.appState && window.appState.selectedDate;
      if (!sel || !window.DpbCas || karty.length < 2) return;
      var dk = window.DpbCas.formatDateKey(sel);
      if (dk !== window.DpbCas.formatDateKey(new Date())) return;
      var kluc = dk + "|" + karty.length;
      if (kluc === zoomKluc && wrap.scrollTop > 5) return; // pri ďalšom prekreslení nerušiť, ak sa už posunul
      var n = new Date(), m = n.getHours() * 60 + n.getMinutes(), best = -1, bd = 1e9, bezi = -1;
      karty.forEach(function (c, i) {
        var t = c.querySelector(".card-time");
        var q = t && t.textContent.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
        if (!q) return;
        var od = +q[1] * 60 + +q[2], dod = +q[3] * 60 + +q[4];
        if (dod <= od) dod += 1440;
        if (bezi < 0 && m >= od && m < dod) bezi = i;
        var d = Math.abs(od - m);
        if (d < bd) { bd = d; best = i; }
      });
      var ix = bezi >= 0 ? bezi : best;
      if (ix < 0) return;
      zoomKluc = kluc;
      var c = karty[ix];
      setTimeout(function () {
        var top = c.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop - 6;
        wrap.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }, 150);
    } catch (e) {}
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
