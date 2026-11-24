// Dopravný dispečing (pevný pás pod červenou hlavičkou) a pás Výpravňa nad spodnými tlačidlami:
// riadky KR a TR (kto je teraz a kto nasleduje). Je pripnutý mimo skrolovacej časti, takže sa neodroluje.
// Mená sa menia podľa zvoleného dňa; čas dňa je vždy aktuálny. Ťuk na riadok ponúkne čísla na volanie.
(function () {
  // Čísla a názvy sú v js/data/kontakty.js
  var CISLA = {
    get dispecing() { return window.DpbKontakty.dispecing; },
    get KR() { return window.DpbKontakty.vypravne.KR; },
    get TR() { return window.DpbKontakty.vypravne.TR; },
    get DKR() { return window.DpbKontakty.dielne.KR; },
    get DTR() { return window.DpbKontakty.dielne.TR; },
  };
  var TEL_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93 19.79 19.79 0 0 1 1.61 3.3 2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7A16 16 0 0 0 14 15.76l.94-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>';

  var pas, disp, dielna, sheet, posledny = "";

  function tel(c) {
    return "tel:" + c.replace(/\s/g, "");
  }
  function mena(a) {
    return a
      .map(function (x) {
        return x.meno;
      })
      .join(", ");
  }

  function zavriSheet() {
    if (sheet) sheet.classList.remove("active");
  }
  function otvorSheet(kluc) {
    var d = CISLA[kluc];
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "vyp-sheet";
      sheet.addEventListener("click", function (e) {
        if (e.target === sheet) zavriSheet();
      });
      document.body.appendChild(sheet);
    }
    var html = '<div class="vyp-sheet-box"><div class="vyp-sheet-title">' + d.nazov + "</div>";
    d.cisla.forEach(function (c) {
      html += '<a class="vyp-sheet-cislo" href="' + tel(c) + '">' + TEL_SVG + "<span>" + c + "</span></a>";
    });
    html += '<button type="button" class="vyp-sheet-zrus">Zrušiť</button></div>';
    sheet.innerHTML = html;
    sheet.querySelector(".vyp-sheet-zrus").addEventListener("click", zavriSheet);
    sheet.classList.add("active");
  }

  function blok(g, nazov, a, b) {
    return '<button type="button" class="vm-blk vm-tel" data-vyp="' + g + '"><span class="vm-h">' + nazov + '</span><span class="vm-n">' + (a || "—") + '</span>' + (b ? '<span class="vm-s">' + b + '</span>' : "") + "</button>";
  }
  function riadokPevny(g, r) {
    var d = r.denna.length ? mena(r.denna) : "—", n = r.nocna.length ? mena(r.nocna) : "—";
    return blok(g, MIESTO[g].toUpperCase(), "Denná: " + d, "Nočná: " + n);
  }
  // Ak mám v zvolený deň službu na výpravni: ukáž obe výpravne (moju prvú) – výpravca danej zmeny
  // a sedavé zálohy v plnej dĺžke ich služby.
  function moja(kluc) {
    var rid = window.appState.currentDriver, ms = (window.RAW.models || {})[rid] || [];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].datum !== kluc) continue;
      var ks = ms[i].karty || [];
      for (var j = 0; j < ks.length; j++) {
        if (ks[j].vzor !== "TRKR") continue;
        var g = window.DpbVypravna.skupina(ks[j].kurz);
        if (g) return { g: g, noc: /^no/i.test(String(ks[j].kurz).trim()), od: ks[j].od_min != null ? ks[j].od_min : null, do: ks[j].do_min != null ? ks[j].do_min : null };
      }
    }
    return null;
  }
  var MIESTO = { KR: "Krasňany", TR: "Trnávka" };
  function podrobne(kluc, m) {
    var dn = window.DpbVypravna.dennaNocna(window.RAW.models, window.RAW.drivers, kluc);
    var poradie = [m.g, m.g === "KR" ? "TR" : "KR"], h = "";
    poradie.forEach(function (g) {
      var vyp = dn[g][m.noc ? "nocna" : "denna"];
      var od = m.od, do_ = m.do;
      if (vyp.length) { od = vyp[0].od; do_ = vyp[0].do; }
      var sed = od != null && do_ > od ? window.DpbVypravna.sedava(window.RAW.models, window.RAW.drivers, kluc, g, od, do_) : [];
      h += '<div class="vyp-blk"><div class="vyp-blk-h">' + MIESTO[g] + (g === m.g ? " · moja výpravňa" : "") + "</div>";
      if (g !== m.g) h += '<div class="vyp-det"><span class="vyp-det-r">' + (m.noc ? "Nočný" : "Denný") + " výpravca</span><span class=\"vyp-det-m\">" + (vyp.length ? vyp.map(function (x) { return x.meno + " (" + x.odTxt + "–" + x.doTxt + ")"; }).join(", ") : "—") + "</span></div>";
      if (!sed.length) h += '<div class="vyp-det"><span class="vyp-det-r">Sedavá záloha</span><span class="vyp-det-m">—</span></div>';
      sed.forEach(function (x) {
        h += '<div class="vyp-det"><span class="vyp-det-r">Sedavá záloha</span><span class="vyp-det-m">' + x.meno + " (" + x.odTxt + "–" + x.doTxt + ")</span></div>";
      });
      h += "</div>";
    });
    return h;
  }

  function riadok(g, r) {
    var teraz = r.teraz.length ? mena(r.teraz) : "—";
    var dalsi = r.dalsi.length ? mena(r.dalsi) : "";
    return blok(g, MIESTO[g].toUpperCase(), teraz, dalsi ? "→ " + dalsi : "");
  }

  function viditelny() {
    var sv = document.getElementById("servicesView");
    return !!sv && !sv.classList.contains("hidden");
  }

  function obnov() {
    if (!pas) return;
    var viď = viditelny() && window.appState && window.appState.currentDriver && window.appState.selectedDate && window.RAW && window.DpbVypravna;
    pas.classList.toggle("hidden", !viď);
    if (disp) disp.classList.toggle("hidden", !viď);
    if (dielna) dielna.classList.toggle("hidden", !viď);
    var wr = document.getElementById("kontaktyRiadok"); if (wr) wr.classList.toggle("hidden", !viď);
    if (!viď) {
      posledny = "";
      return;
    }
    var teraz = new Date();
    var min = teraz.getHours() * 60 + teraz.getMinutes();
    var kluc = window.DpbVypravna.kluc(window.appState.selectedDate);
    jeDnes = kluc === window.DpbVypravna.kluc(teraz);
    var sig = kluc + "|" + (jeDnes ? min : "pevne") + "|" + Object.keys(window.RAW.models).length + "|" + window.appState.currentDriver;
    if (sig === posledny) return;
    posledny = sig;
    var r = window.DpbVypravna.kto(window.RAW.models, window.RAW.drivers, kluc, min);
    posledneKluc = kluc;
    posledneM = moja(kluc);
    posledneDN = window.DpbVypravna.dennaNocna(window.RAW.models, window.RAW.drivers, kluc);
    if (disp && !disp.firstChild)
      disp.innerHTML =
        '<a class="vyp-hlavicka" href="' +
        tel(CISLA.dispecing.cisla[0]) +
        '"><span class="vyp-hl-nazov">' + TEL_SVG + 'Dispečing</span><span class="vyp-hl-cislo">' +
        CISLA.dispecing.cisla[0] +
        "</span></a>";
    posledneR = r;
    vykresli();
  }

  // Box Výpravňa sa dá zbaliť/rozbaliť (predvolene zbalený, voľba sa pamätá)
  var posledneR = null, posledneDN = null, posledneM = null, posledneKluc = "", jeDnes = true, casovac = null, casovac2 = null, mizne = false;
  var otvorene = false, dielnaOtv = false;
  var SIPKA = '<span class="vyp-sipka"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>';
  function zavriMenu() {
    clearTimeout(casovac); clearTimeout(casovac2); mizne = false;
    if (otvorene || dielnaOtv) { otvorene = false; dielnaOtv = false; vykresli(); }
  }
  function dielnaMenu() {
    return ["KR", "TR"].map(function (g) {
      var d = CISLA["D" + g], c = (d.cisla || [])[0];
      return c ? blok("D" + g, d.nazov.toUpperCase(), c, "") : '<div class="vm-blk"><span class="vm-h">' + d.nazov.toUpperCase() + '</span><span class="vm-n">—</span></div>';
    }).join("");
  }
  function vykresli() {
    if (!pas || !posledneR) return;
    var obsah = posledneM ? podrobne(posledneKluc, posledneM)
      : jeDnes ? riadok("KR", posledneR.KR) + riadok("TR", posledneR.TR)
      : riadokPevny("KR", posledneDN.KR) + riadokPevny("TR", posledneDN.TR);
    var tr = otvorene && mizne ? " mizne" : "";
    pas.innerHTML = '<div class="vyp-box' + (otvorene ? " otvorena" : "") + tr + '"><button type="button" class="vyp-nadpis" aria-expanded="' + (otvorene ? "true" : "false") + '"><span>Výpravňa</span>' + SIPKA + "</button>" +
      (otvorene ? '<div class="vyp-menu">' + obsah + "</div>" : "") + "</div>";
    if (dielna) dielna.innerHTML = '<div class="vyp-box' + (dielnaOtv ? " otvorena" : "") + (dielnaOtv && mizne ? " mizne" : "") + '"><button type="button" class="vyp-nadpis" aria-expanded="' + (dielnaOtv ? "true" : "false") + '"><span>Dielňa</span>' + SIPKA + "</button>" +
      (dielnaOtv ? '<div class="vyp-menu">' + dielnaMenu() + "</div>" : "") + "</div>";
    function prepni(ktora) {
      return function () {
        var bolo = ktora === "v" ? otvorene : dielnaOtv;
        clearTimeout(casovac); clearTimeout(casovac2); mizne = false;
        otvorene = false; dielnaOtv = false;
        if (!bolo) {
          if (ktora === "v") otvorene = true; else dielnaOtv = true;
          // otvorené menu po 10 sekundách pomaly zmizne (posledné ~2 s postupné stmievanie)
          casovac2 = setTimeout(function () { mizne = true; vykresli(); }, 8000);
          casovac = setTimeout(zavriMenu, 10000);
        }
        vykresli();
      };
    }
    pas.querySelector(".vyp-nadpis").addEventListener("click", prepni("v"));
    if (dielna) dielna.querySelector(".vyp-nadpis").addEventListener("click", prepni("d"));
    Array.prototype.forEach.call(document.querySelectorAll("#kontaktyRiadok .vm-tel"), function (b) {
      b.addEventListener("click", function () {
        otvorSheet(b.getAttribute("data-vyp"));
      });
    });
  }

  function init() {
    pas = document.getElementById("vypravnaPas");
    disp = document.getElementById("dispecingPas");
    dielna = document.getElementById("dielnaPas");
    if (!pas) return;
    document.addEventListener("click", function (e) { if (!(otvorene || dielnaOtv)) return;
      var vnutri = (e.composedPath ? e.composedPath() : []).some(function (n) { return n && n.id === "kontaktyRiadok" || (n && n.classList && n.classList.contains("vyp-sheet")); });
      if (!vnutri) zavriMenu(); });
    obnov();
    setInterval(obnov, 300);
  }
  window.VypravnaPas = { init: init, obnov: obnov };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
