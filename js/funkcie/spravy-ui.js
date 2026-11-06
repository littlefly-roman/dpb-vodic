/* Správy – obrazovky: ikona v hlavičke, modal so sekciami (otvorená vždy jedna), detail s ukazovateľom čítania,
   bežiaci text nad kartou služby pre dôležité neprečítané správy. Dáta: DpbSpravy (spravy.js). */
(function () {
  "use strict";
  var S = function () { return window.DpbSpravy; };
  var ov = null, stav = { otvorena: null, detail: null };

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fd(ms) { var d = new Date(ms); return d.getDate() + ". " + (d.getMonth() + 1) + "."; }
  function meta(s) {
    var a = [];
    if (s.do !== null) a.push("platí do " + fd(s.do));
    else if (s.od !== null) a.push("od " + fd(s.od));
    return a.join(" · ");
  }
  var IKONY = {
    "dopravné príkazy": "M12 3 2 20h20z M12 10v5 M12 18v.5",
    "oznamy zamestnávateľa": "M4 5h16v11H9l-5 4z",
    "električky": "M7 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 11h14 M8 21l2-3 M16 21l-2-3 M9 3l1-2h4l1 2",
    "autobusy": "M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 11h16 M7 20v-3 M17 20v-3",
    "benefity": "M20 12v8H4v-8 M2 7h20v5H2z M12 22V7 M12 7S9 3 7 5s2 2 5 2z M12 7s3-4 5-2-2 2-5 2z"
  };
  function ikona(nazov) {
    var k = String(nazov).toLowerCase(), d = IKONY[k];
    if (!d) Object.keys(IKONY).some(function (x) { if (k.indexOf(x.split(" ")[0]) === 0) { d = IKONY[x]; return true; } });
    d = d || "M4 5h16v11H9l-5 4z";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  var pasRaf = 0;
  function zastavPas() { if (pasRaf) cancelAnimationFrame(pasRaf); pasRaf = 0; }

  // ---------- hlavička a bežiaci text
  function obnov() {
    var n = S() ? S().pocetNovych() : 0, b = $("spravyBadge"), btn = $("spravyBtn");
    if (btn) btn.style.display = S() && S().zoznam().length ? "" : "none";
    if (b) { b.textContent = n > 99 ? "99+" : String(n); b.classList.toggle("hidden", !n); }
    var pas = $("spravyPas");
    if (pas) {
      var d = S() ? S().dolezite() : [];
      if (!d.length) { zastavPas(); pas.classList.add("hidden"); pas.innerHTML = ""; }
      else {
        pas.classList.remove("hidden");
        var t = d.map(function (x) { return esc(x.nadpis); }).join(" &nbsp;•&nbsp; ");
        pas.innerHTML = '<svg class="spravy-pas-ik" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v5M12 18v.5"/></svg>' +
          '<div class="spravy-pas-okno"><span class="spravy-pas-track"><span class="spravy-pas-kopia">' + t + " &nbsp;›</span></span></div>";
        var okno = pas.querySelector(".spravy-pas-okno"), track = pas.querySelector(".spravy-pas-track"), k1 = pas.querySelector(".spravy-pas-kopia");
        zastavPas();
        var w = k1.offsetWidth;
        if (w > okno.offsetWidth) { // nezmestí sa -> plynulý pás: kópia za kópiou dookola
          k1.classList.add("sirka");
          var k2 = k1.cloneNode(true); track.appendChild(k2);
          w = k1.offsetWidth;
          var x = 0, last = 0, SP = 38; // px za sekundu
          (function krok(ts) {
            if (!last) last = ts;
            x -= SP * Math.min(0.1, (ts - last) / 1000); last = ts;
            if (x <= -w) x += w;
            track.style.transform = "translate3d(" + x + "px,0,0)";
            pasRaf = requestAnimationFrame(krok);
          })(performance.now());
        }
        pas.onclick = function () { otvor(d.length === 1 ? d[0].id : null); };
      }
    }
    if (ov) vykresli();
  }

  // ---------- modal
  function zavri() {
    if (!ov) return;
    ov.remove(); ov = null; stav = { otvorena: null, detail: null };
  }
  function otvor(idDetail) {
    if (!S()) return;
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "spravy-ov";
      ov.setAttribute("data-spat-prekryv", "1");
      ov.addEventListener("click", function (e) { if (e.target === ov) { if (stav.detail) { stav.detail = null; vykresli(); } else zavri(); } });
      document.body.appendChild(ov);
    }
    stav.detail = idDetail || null;
    if (!stav.otvorena) { var sx = S().sekcie().filter(function (x) { return x.nove; }); stav.otvorena = sx.length ? sx[0].nazov : null; }
    vykresli();
  }
  function najdi(id) { var r = null; S().zoznam().forEach(function (s) { if (s.id === id) r = s; }); return r; }

  function vykresli() {
    if (!ov) return;
    if (stav.detail) { var m = najdi(stav.detail); if (m) return detail(m); stav.detail = null; }
    var sx = S().sekcie(), nove = S().pocetNovych();
    var h = '<div class="spravy-modal"><div class="spravy-mh"><b>Správy</b><button class="spravy-x" aria-label="Zavrieť">✕</button></div><div class="spravy-sc">';
    if (nove) {
      h += '<button class="spravy-vsetko' + (stav.otvorena === "__nove" ? " otv" : "") + '" data-sek="__nove"><span>Všetko nové</span><span class="spravy-n">' + nove + "</span></button>";
      if (stav.otvorena === "__nove") {
        h += '<div class="spravy-box">';
        sx.forEach(function (x) { x.polozky.forEach(function (s) { if (!s.precitana) h += polozka(s, x.nazov); }); });
        h += "</div>";
      }
    }
    if (!sx.length) h += '<div class="spravy-prazdne">Zatiaľ tu nie sú žiadne správy.</div>';
    sx.forEach(function (x) {
      var otv = stav.otvorena === x.nazov;
      h += '<div class="spravy-sek' + (otv ? " otv" : "") + '"><button class="spravy-sr" data-sek="' + esc(x.nazov) + '"><span class="spravy-i">' + ikona(x.nazov) + "</span><span class=\"spravy-sn\">" + esc(x.nazov) +
        '</span><span class="spravy-n' + (x.nove ? "" : " z") + '">' + x.nove + '</span><span class="spravy-ch">' + (otv ? "⌄" : "›") + "</span></button>";
      if (otv) { h += '<div class="spravy-box">'; x.polozky.forEach(function (s) { h += polozka(s); }); h += "</div>"; }
      h += "</div>";
    });
    if (sx.length) h += '<button class="spravy-znova">Označiť všetko ako neprečítané</button>';
    h += "</div></div>";
    ov.innerHTML = h;
    ov.querySelector(".spravy-x").onclick = zavri;
    var zn = ov.querySelector(".spravy-znova");
    if (zn) zn.onclick = function () { S().vynulujPrecitane(); };
    ov.querySelectorAll("[data-sek]").forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute("data-sek"); stav.otvorena = stav.otvorena === k ? null : k; vykresli(); };
    });
    ov.querySelectorAll("[data-id]").forEach(function (b) { b.onclick = function () { stav.detail = b.getAttribute("data-id"); vykresli(); }; });
  }
  function polozka(s, sekcia) {
    var m = [sekcia, meta(s)].filter(Boolean).join(" · ");
    return '<button class="spravy-it' + (s.precitana ? "" : " un") + '" data-id="' + esc(s.id) + '"><span class="spravy-it-t">' + esc(s.nadpis) + "</span>" + (m ? "<small>" + esc(m) + "</small>" : "") + "</button>";
  }

  // ---------- detail: prečítané po doskrolovaní na koniec
  function detail(s) {
    var tel = esc(s.text).replace(/\n/g, "<br>");
    ov.innerHTML = '<div class="spravy-modal"><div class="spravy-mh"><button class="spravy-spat" aria-label="Späť">‹</button><b class="spravy-dn">' + esc(s.nadpis) +
      '</b><button class="spravy-x" aria-label="Zavrieť">✕</button></div>' +
      '<div class="spravy-meta">' + [esc(s.sekcia), esc(meta(s))].filter(Boolean).join(" · ") + '</div><div class="spravy-prog"><i></i></div>' +
      '<div class="spravy-sc spravy-cl"><div class="spravy-art">' + (tel || "<span style=\"opacity:.6\">(bez textu)</span>") + "</div></div>" +
      (s.precitana ? "" : '<div class="spravy-pozn">Prečítané sa označí, keď doskroluješ na koniec ↓</div>') + "</div>";
    ov.querySelector(".spravy-x").onclick = zavri;
    ov.querySelector(".spravy-spat").onclick = function () { stav.detail = null; vykresli(); };
    var sc = ov.querySelector(".spravy-cl"), bar = ov.querySelector(".spravy-prog i"), pozn = ov.querySelector(".spravy-pozn"), hotovo = s.precitana;
    function over() {
      var max = sc.scrollHeight - sc.clientHeight, p = max <= 2 ? 1 : Math.min(1, sc.scrollTop / max);
      bar.style.width = Math.round(p * 100) + "%";
      if (p >= 0.98 && !hotovo) {
        hotovo = true;
        if (pozn) pozn.remove();
        S().oznacPrecitana(s.id);
      }
    }
    sc.addEventListener("scroll", over);
    requestAnimationFrame(over);
  }

  function pripoj() {
    var b = $("spravyBtn");
    if (b && !b.dataset.pripojene) { b.dataset.pripojene = "1"; b.addEventListener("click", function () { ov ? zavri() : otvor(null); }); }
    obnov();
  }
  document.addEventListener("dpb-spravy", obnov);
  document.addEventListener("DOMContentLoaded", pripoj);
  if (document.readyState !== "loading") pripoj();
  window.DpbSpravyUI = { otvor: otvor, zavri: zavri, obnov: obnov };
})();
