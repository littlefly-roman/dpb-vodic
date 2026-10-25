// Dopravný dispečing (pevný pás pod červenou hlavičkou) a pás Výpravňa nad spodnými tlačidlami:
// riadky KR a TR (kto je teraz a kto nasleduje). Je pripnutý mimo skrolovacej časti, takže sa neodroluje.
// Mená sa menia podľa zvoleného dňa; čas dňa je vždy aktuálny. Ťuk na riadok ponúkne čísla na volanie.
(function () {
  // Čísla a názvy sú v js/data/kontakty.js
  var CISLA = {
    get dispecing() { return window.DpbKontakty.dispecing; },
    get KR() { return window.DpbKontakty.vypravne.KR; },
    get TR() { return window.DpbKontakty.vypravne.TR; },
  };
  var TEL_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93 19.79 19.79 0 0 1 1.61 3.3 2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7A16 16 0 0 0 14 15.76l.94-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>';

  var pas, disp, sheet, posledny = "";

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

  function riadokPevny(g, r) {
    var d = r.denna.length ? mena(r.denna) : "—", n = r.nocna.length ? mena(r.nocna) : "—";
    return (
      '<button type="button" class="vyp-row" data-vyp="' + g + '"><span class="vyp-typ">' + g +
      '</span><span class="vyp-teraz">' + d + '</span><span class="vyp-dalsi">' + n + "</span></button>"
    );
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
    return (
      '<button type="button" class="vyp-row" data-vyp="' +
      g +
      '"><span class="vyp-typ">' +
      g +
      '</span><span class="vyp-teraz">' +
      teraz +
      '</span><span class="vyp-dalsi">' +
      (dalsi ? "→ " + dalsi : "") +
      "</span></button>"
    );
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
        '"><span class="vyp-hl-nazov">DOPRAVNÝ DISPEČING</span><span class="vyp-hl-cislo">' +
        CISLA.dispecing.cisla[0] +
        "</span></a>";
    posledneR = r;
    vykresli();
  }

  // Box Výpravňa sa dá zbaliť/rozbaliť (predvolene zbalený, voľba sa pamätá)
  var posledneR = null, posledneDN = null, posledneM = null, posledneKluc = "", jeDnes = true, casovac = null, casovac2 = null, mizne = false;
  var otvorene = false;
  function vykresli() {
    if (!pas || !posledneR) return;
    pas.innerHTML =
      '<div class="vyp-box' + (otvorene ? " otvorena" : "") + (otvorene && mizne ? " mizne" : "") + '"><button type="button" class="vyp-nadpis" aria-expanded="' +
      (otvorene ? "true" : "false") +
      '"><span>VÝPRAVŇA</span><span class="vyp-sipka">▼</span></button>' +
      (otvorene
        ? (posledneM
            ? podrobne(posledneKluc, posledneM)
            : jeDnes
            ? '<div class="vyp-popisky"><span class="vyp-pk-typ"></span><span>Teraz</span><span>Nasleduje</span></div>' +
              riadok("KR", posledneR.KR) + riadok("TR", posledneR.TR)
            : '<div class="vyp-popisky"><span class="vyp-pk-typ"></span><span>Denná</span><span>Nočná</span></div>' +
              riadokPevny("KR", posledneDN.KR) + riadokPevny("TR", posledneDN.TR))
        : "") +
      "</div>";
    pas.querySelector(".vyp-nadpis").addEventListener("click", function () {
      otvorene = !otvorene;
      clearTimeout(casovac); clearTimeout(casovac2); mizne = false;
      // rozbalený box po 10 sekundách pomaly zmizne (posledné ~2 s je to postupné stmievanie)
      if (otvorene) {
        casovac2 = setTimeout(function () {
          mizne = true;
          var bx = pas && pas.querySelector(".vyp-box"); if (bx) bx.classList.add("mizne");
        }, 8000);
        casovac = setTimeout(function () { otvorene = false; mizne = false; vykresli(); }, 10000);
      }
      vykresli();
    });
    Array.prototype.forEach.call(pas.querySelectorAll(".vyp-row"), function (b) {
      b.addEventListener("click", function () {
        otvorSheet(b.getAttribute("data-vyp"));
      });
    });
  }

  function init() {
    pas = document.getElementById("vypravnaPas");
    disp = document.getElementById("dispecingPas");
    if (!pas) return;
    obnov();
    setInterval(obnov, 300);
  }
  window.VypravnaPas = { init: init, obnov: obnov };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
