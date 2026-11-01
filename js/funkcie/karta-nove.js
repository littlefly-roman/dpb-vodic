/* Karta „Dnes“ (v210): okno Cestovný poriadok (3 ušká), okno osoby, upozornenia (zvonček), Žiadosti.
   Stavia na existujúcich oknách: DpbOkna (zmena-stavu.js), DpbMiniGrafikon (mini-grafikon.js), panel zastávkového CP (zastavky.js).
   DpbKartaNove.cp(service) · .osoba(meno) · .zvonec(service) · .ziadosti(service) · .upozornenia() */
(function () {
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function sekOd(t) { var q = String(t || "").split(":"); return (parseInt(q[0], 10) || 0) * 3600 + (parseInt(q[1], 10) || 0) * 60; }

  var SVG = {
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
    osoba: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    zvonec: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    cas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sip: '<polyline points="6 9 12 15 18 9"/>',
  };
  function svg(nazov, velkost) {
    var s = velkost || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + SVG[nazov] + "</svg>";
  }

  // ---------- Okno osoby (fotografia zatiaľ nie je, až po súhlase DPB / GDPR) ----------
  function osoba(meno, doplnok) {
    if (!window.DpbOkna) return;
    window.DpbOkna.otvor({
      titul: meno || "Osoba",
      podtitul: doplnok || "",
      telo: function (t) {
        var av = el("div", "width:150px;height:150px;border-radius:50%;background:var(--surface-2);color:var(--text-3);margin:6px auto 12px;display:flex;align-items:center;justify-content:center");
        av.innerHTML = svg("osoba", 90);
        t.appendChild(av);
        t.appendChild(el("div", "text-align:center;font-size:15px;color:var(--text-2);padding-bottom:4px", "Fotografia nie je dostupná."));
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { window.DpbOkna.zavriVrch(); } }],
    });
  }

  // ---------- Upozornenia (zvonček): nastavenia sa ukladajú, samotné zvonenie príde so serverom ----------
  var KLUC = "dpb_upozornenia";
  var PRED = { nastup: [30, 15, 5], vyjazd: { 20: true, 15: true, 10: true, 5: true, 0: true } };
  function nacitajUpoz() {
    try {
      var r = JSON.parse(localStorage.getItem(KLUC) || "null");
      if (r && r.nastup && r.vyjazd) return r;
    } catch (e) {}
    return JSON.parse(JSON.stringify(PRED));
  }
  function ulozUpoz(u) { try { localStorage.setItem(KLUC, JSON.stringify(u)); } catch (e) {} }
  var VOLBY_NASTUP = [0, 60, 45, 30, 20, 15, 10, 5];
  function upozornenia(service) {
    if (!window.DpbOkna) return;
    var k = (service && service._karta) || {};
    var u = nacitajUpoz();
    window.DpbOkna.otvor({
      titul: "Upozornenia" + (k.kurz ? " – " + k.kurz : ""),
      podtitul: "",
      telo: function (t) {
        var hlavicka = function (txt) { return el("div", "font-size:15px;letter-spacing:.1em;font-weight:700;color:var(--text-3);text-transform:uppercase;margin:6px 0 4px", txt); };
        t.appendChild(hlavicka("Nástup" + (k.od ? " " + k.od : "")));
        u.nastup.forEach(function (min, i) {
          var r = el("div", "display:flex;align-items:center;gap:10px;padding:6px 0");
          r.appendChild(el("div", "flex:1;font-size:17px", (i + 1) + ". upozornenie"));
          var sel = el("select", "padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:16px;font-weight:600");
          VOLBY_NASTUP.forEach(function (m) {
            var o = el("option", "", m ? m + " min pred" : "vypnuté"); o.value = String(m); if (m === min) o.selected = true; sel.appendChild(o);
          });
          sel.addEventListener("change", function () { u.nastup[i] = parseInt(sel.value, 10) || 0; ulozUpoz(u); });
          r.appendChild(sel); t.appendChild(r);
        });
        t.appendChild(hlavicka("Výjazd (začiatok cestovného poriadku)"));
        [20, 15, 10, 5, 0].forEach(function (m) {
          var r = el("label", "display:flex;align-items:center;gap:10px;padding:8px 0;font-size:17px;cursor:pointer");
          r.appendChild(el("div", "flex:1", m ? m + " min pred" : "V čase odchodu (siréna z konečnej)"));
          var cb = el("input", "width:22px;height:22px;accent-color:var(--red)"); cb.type = "checkbox"; cb.checked = !!u.vyjazd[m];
          cb.addEventListener("change", function () { u.vyjazd[m] = cb.checked; ulozUpoz(u); });
          r.appendChild(cb); t.appendChild(r);
        });
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:8px", "Nastavenia sa uložia. Samotné zvonenie pribudne neskôr."));
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); } }],
    });
  }
  function zvonec(service) {
    var b = el("button", "");
    b.type = "button"; b.className = "card-zvonec"; b.setAttribute("aria-label", "Upozornenia");
    b.innerHTML = svg("zvonec", 20);
    b.addEventListener("click", function (e) { e.stopPropagation(); upozornenia(service); });
    return b;
  }

  // ---------- Žiadosti (budúce dni): Zmena stavu | Zmena služby ----------
  function ziadosti(service) {
    if (!window.DpbOkna) return;
    var ctx = { date: service.date, service: service };
    window.DpbOkna.otvor({
      titul: "Žiadosti",
      podtitul: "",
      telo: function (t) {
        var lista = el("div", "display:flex;border-bottom:2px solid var(--border-2)");
        [["Zmena stavu", function () { window.DpbZmenaStavu.otvor(ctx); }],
         ["Zmena služby", function () { window.DpbZiadostSluzby.otvor({ date: service.date, service: service, zmena: true }); }]].forEach(function (x) {
          var b = el("button", "flex:1;padding:14px 6px;background:none;border:0;font-size:16px;font-weight:700;color:var(--red);cursor:pointer", x[0]);
          b.type = "button";
          b.addEventListener("click", function () { window.DpbOkna.zavriVsetko(); x[1](); });
          lista.appendChild(b);
        });
        t.appendChild(lista);
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:10px", "Vyber, čo chceš žiadať."));
      },
      tlacidla: [{ text: "Zrušiť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); } }],
    });
  }

  // ---------- Cestovný poriadok: tri ušká v jednom okne ----------
  function cp(service) {
    if (!window.DpbOkna || !window.DpbMiniGrafikon) return false;
    var k = service._karta || {};
    var dateKey = service.date;
    var n = new Date();
    var dnes = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    var mozeStretnutia = dateKey === dnes && k.vzor === "SLUŽBA" && /^[1349]\//.test(k.kurz || "");
    var okno = (k.od && k.do) ? [sekOd(k.od), sekOd(k.do) <= sekOd(k.od) ? sekOd(k.do) + 86400 : sekOd(k.do)] : null;
    var panelZ = document.getElementById("cpZastavkovyPanel");
    var domov = panelZ && panelZ.parentNode;
    var ouska = [
      { id: "cp", text: "CP linky / poradia" },
      { id: "zast", text: "Zastávkový CP", skryt: !panelZ },
      { id: "kto", text: "Koho stretávam", skryt: !mozeStretnutia },
    ].filter(function (x) { return !x.skryt; });
    var obsah = null, lista = null, aktivne = null, nahradene = 0;

    function vrat() { if (panelZ && domov && panelZ.parentNode !== domov) domov.insertBefore(panelZ, domov.firstChild); }
    function ukaz(id) {
      aktivne = id;
      nahradene++;
      vrat();
      obsah.innerHTML = "";
      Array.prototype.forEach.call(lista.children, function (b) {
        var on = b.dataset.id === id;
        b.style.color = on ? "var(--red)" : "var(--text-2)";
        b.style.borderBottom = on ? "3px solid var(--red)" : "3px solid transparent";
      });
      var kam = el("div", "");
      obsah.appendChild(kam);
      if (id === "cp") window.DpbMiniGrafikon.otvor(k.kurz, dateKey, "", okno, null, kam);
      else if (id === "kto") window.DpbMiniGrafikon.stretnutia(k.kurz, dateKey, k.od, k.do, "", kam);
      else if (id === "zast") {
        kam.style.cssText = "display:flex;flex-direction:column;max-height:55vh;min-height:300px;overflow:hidden";
        kam.appendChild(panelZ);
        var inp = document.getElementById("cpStanicaInput");
        if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) {} }
      }
    }
    var sheet = window.DpbOkna.otvor({
      titul: "Cestovný poriadok" + (k.kurz ? " " + k.kurz : ""),
      podtitul: String(dateKey || "").split("-").reverse().join("."),
      telo: function (t) {
        lista = el("div", "display:flex;border-bottom:2px solid var(--border-2);margin-bottom:8px");
        ouska.forEach(function (o) {
          var b = el("button", "flex:1;padding:10px 4px;background:none;border:0;font-size:15px;font-weight:700;line-height:1.15;cursor:pointer;color:var(--text-2)", o.text);
          b.type = "button"; b.dataset.id = o.id;
          b.addEventListener("click", function () { if (aktivne !== o.id) ukaz(o.id); });
          lista.appendChild(b);
        });
        obsah = el("div", "");
        t.appendChild(lista); t.appendChild(obsah);
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { vrat(); window.DpbOkna.zavriVsetko(); } }],
    });
    sheet.el.style.maxHeight = "94vh";
    sheet.el.style.overflowY = "auto";
    ukaz("cp");
    // zastávkový panel sa po zavretí okna (aj ťuknutím mimo) vráti na svoje miesto
    var strazca = setInterval(function () {
      if (!sheet.el.isConnected) { clearInterval(strazca); vrat(); }
    }, 300);
    return true;
  }

  window.DpbKartaNove = { cp: cp, osoba: osoba, zvonec: zvonec, ziadosti: ziadosti, upozornenia: upozornenia, svg: svg };
})();
