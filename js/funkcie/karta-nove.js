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
    kava: '<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 2v3M11 2v3M15 2v3"/>',
    poloha: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
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

  // ---------- Jednotné meno vodiča: ikona osoby + meno; ťuk = fotografia, dlhé podržanie = telefonát (len ak je číslo) ----------
  // meno(text, {tel, rola}) vráti prvok; ovládanie je delegované na celý dokument (data-atribúty), takže funguje všade rovnako.
  function meno(text, o) {
    o = o || {};
    var t = String(text == null ? "" : text).trim();
    var sp = document.createElement("span");
    sp.className = "meno-v";
    if (!t || t === "—") { sp.textContent = t || "—"; sp.classList.add("meno-bez"); return sp; }
    sp.dataset.meno = t;
    if (o.rola) sp.dataset.rola = o.rola;
    if (o.bezFotky) sp.dataset.bezFotky = "1";
    if (o.tel) sp.dataset.tel = String(o.tel).replace(/\s/g, "");
    sp.setAttribute("role", "button");
    sp.setAttribute("tabindex", "0");
    sp.innerHTML = '<span class="meno-ik">' + svg("osoba", 18) + "</span>";
    sp.appendChild(document.createTextNode(t));
    return sp;
  }
  (function () {
    var casovac = null, zdroj = null, dlhe = false, x0 = 0, y0 = 0;
    function cielMena(e) { return e.target && e.target.closest ? e.target.closest(".meno-v[data-meno]") : null; }
    document.addEventListener("pointerdown", function (e) {
      var c = cielMena(e); if (!c) return;
      zdroj = c; dlhe = false; x0 = e.clientX; y0 = e.clientY;
      clearTimeout(casovac);
      if (c.dataset.tel) casovac = setTimeout(function () {
        dlhe = true;
        try { if (navigator.vibrate) navigator.vibrate(30); } catch (er) {}
        window.location.href = "tel:" + c.dataset.tel;
      }, 600);
    }, true);
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { document.addEventListener(n, function () { clearTimeout(casovac); }, true); });
    document.addEventListener("pointermove", function (e) { if (casovac && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) clearTimeout(casovac); }, true);
    document.addEventListener("contextmenu", function (e) { if (cielMena(e)) e.preventDefault(); }, true);
    function otvor(c) { osoba(c.dataset.meno, c.dataset.rola || ""); }
    document.addEventListener("click", function (e) {
      var c = cielMena(e); if (!c) return;
      e.stopPropagation(); e.preventDefault();
      if (dlhe) { dlhe = false; return; }
      if (c.dataset.bezFotky) return; // v cestovných poriadkoch len podržanie = telefonát
      otvor(c);
    }, true);
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("meno-v") && e.target.dataset.meno && !e.target.dataset.bezFotky) { e.preventDefault(); otvor(e.target); }
    }, true);
  })();

  // ---------- Upozornenia (zvonček na hlavnej karte) ----------
  // Minúty sú spoločné pre všetky karty, zapnutie je na každej karte zvlášť.
  // „Pred službou“ a „Pred výjazdom“ sa zatiaľ len ukladajú (zvonenie príde so serverom);
  // odchody z konečnej, striedania a koniec prestávky zvonia hneď (odpocet.js), kým je aplikácia otvorená.
  var KLUC = "dpb_upozornenia";
  var DEF = { v: 2, pred: [60, 30, 15], vyj: [20, 10, 5, 0], karty: {} };
  var VOLBY_PRED = [60, 45, 30, 20, 15, 10, 5];
  var VOLBY_VYJ = [30, 25, 20, 15, 10, 5, 0];
  function dnesKluc() { var n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); }
  function nacitajUpoz() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(KLUC) || "null"); } catch (e) {}
    if (!r || r.v !== 2) r = JSON.parse(JSON.stringify(DEF));
    r.karty = r.karty || {};
    var dn = dnesKluc();
    Object.keys(r.karty).forEach(function (k) { if (k.slice(0, 10) < dn) delete r.karty[k]; });
    return r;
  }
  function ulozUpoz(u) { try { localStorage.setItem(KLUC, JSON.stringify(u)); } catch (e) {} }
  function kluc(service) { var k = (service && service._karta) || {}; return (service.date || "") + "|" + (k.kurz || service._vzor || "") + "|" + (k.od || ""); }
  function kartaNast(u, service) {
    var key = kluc(service), c = u.karty[key];
    if (!c) c = u.karty[key] = { pred: [], vyj: [] };
    while (c.pred.length < u.pred.length) c.pred.push(0);
    while (c.vyj.length < u.vyj.length) c.vyj.push(0);
    return c;
  }
  function ma(service) {
    var v = service._vzor;
    return { vyj: v === "944" || (v === "SLUŽBA" && service._zDepa === true), konecna: v === "SLUŽBA", prestavka: v === "SLUŽBA" && !!(service._upoz && service._upoz.prestavka && service._upoz.prestavka.length), striedac: v === "STRIEDAČ" };
  }
  function jeDnes(service) { return service.date === dnesKluc(); }
  // Zoznamy časov (odchody z konečnej, koniec prestávky, striedania) – len dnes
  function nacitajSkupiny(service) {
    var k = service._karta || {}, key = (k.kurz || "") + "|" + (k.od || ""), m = ma(service), out = [];
    var DS = window.DpbStretnutia;
    if (m.konecna && k.kurz && DS && DS.odchodyZKonecnej) {
      out.push(DS.odchodyZKonecnej(k.kurz, service.date, k.od, k.do).then(function (l) {
        // odchody počas prestávky robí striedač (má vlastné upozornenia) – vynechať
        var okna = (service._upoz && service._upoz.prestavkaOkna || []).map(function (w) { return [sekOd(w.od), sekOd(w["do"])]; });
        var vonku = (l || []).filter(function (x) {
          var q = String(x.cas).split(":"), t = (+q[0]) * 3600 + (+q[1]) * 60 + (+q[2] || 0);
          return !okna.some(function (w) { return t >= w[0] && t < w[1]; });
        });
        return { kind: "kn|" + key, nazov: "Odchody z konečnej", typ: "konecna", pop: "Odchod o", items: vonku.map(function (x) { return { cas: x.cas, nazov: String(x.nazov || "").replace(/^[^→]*(?=→)/, "") }; }) };
      }).catch(function () { return null; }));
    }
    if (m.prestavka) out.push(Promise.resolve({ kind: "pr|" + key, nazov: "Koniec prestávky", typ: "prestavka", pop: "Koniec prestávky o", items: service._upoz.prestavka.map(function (x) { return { cas: x.cas, nazov: x.nazov }; }) }));
    if (m.striedac && service._upoz && service._upoz.striedac) {
      out.push(Promise.resolve(service._upoz.striedac()).then(function (l) {
        l = l || [];
        return [
          { kind: "sd|" + key, nazov: "Striedania", typ: "striedanie", pop: "Preberáš o", items: l.filter(function (x) { return x.typ !== "konecna"; }) },
          { kind: "kn|" + key, nazov: "Odchody z konečnej", typ: "konecna", pop: "Odchod o", items: l.filter(function (x) { return x.typ === "konecna"; }) }
        ];
      }).catch(function () { return null; }));
    }
    return Promise.all(out).then(function (v) { return [].concat.apply([], v).filter(function (g) { return g && g.items && g.items.length; }); });
  }
  // Ťuk / dlhé podržanie na tlačidle
  function podrz(b, tap, dlhe) {
    var tm = null, pot = false, x0 = 0, y0 = 0;
    var zrus = function () { if (tm) { clearTimeout(tm); tm = null; } };
    b.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; pot = false; zrus();
      tm = setTimeout(function () { tm = null; pot = true; try { if (navigator.vibrate) navigator.vibrate(30); } catch (er) {} dlhe(); }, 550);
    });
    b.addEventListener("pointermove", function (e) { if (tm && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) zrus(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { b.addEventListener(n, zrus); });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    b.addEventListener("click", function (e) { e.stopPropagation(); if (pot) { pot = false; e.preventDefault(); return; } tap(e); });
  }
  function minutyOkno(titul, volby, aktualne, hotovo) {
    if (!window.DpbOkna) return;
    window.DpbOkna.otvor({
      titul: titul, podtitul: "",
      telo: function (t) {
        var g = el("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:8px");
        volby.forEach(function (mm) {
          var on = mm === aktualne;
          var b = el("button", "min-height:48px;border-radius:12px;font-size:17px;font-weight:700;font-family:inherit;border:2px solid " + (on ? "var(--red)" : "var(--border)") + ";background:" + (on ? "var(--red)" : "var(--surface-2)") + ";color:" + (on ? "#fff" : "var(--text-1)"), mm ? mm + " min" : "V čase");
          b.type = "button";
          b.addEventListener("click", function () { hotovo(mm); window.DpbOkna.zavriVrch(); });
          g.appendChild(b);
        });
        t.appendChild(g);
      },
      tlacidla: [{ text: "Zrušiť", klik: function () { window.DpbOkna.zavriVrch(); } }]
    });
  }
  function upozornenia(service) {
    if (!window.DpbOkna) return;
    var k = (service && service._karta) || {};
    var u = nacitajUpoz(), m = ma(service), O = window.DpbOdpocet, dnes = jeDnes(service);
    var skupiny = [], nacitane = false;
    var odSec = function () { return sekOd(k.od); };
    var vyjSec = function () { return service._premavkaOd != null ? service._premavkaOd : odSec(); };
    var terazSec = function () { var n = new Date(); return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(); };
    window.DpbOkna.otvor({
      titul: "Upozornenia" + (k.kurz ? " – " + k.kurz : ""),
      podtitul: "",
      telo: function (t) {
        var cele = el("div", "");
        t.appendChild(cele);
        var hl = function (txt) { return el("div", "font-size:15px;letter-spacing:.08em;font-weight:700;color:var(--text-3);text-transform:uppercase;margin:12px 0 6px", txt); };
        function tlac(txt, zap, minule) {
          var b = el("button", "flex:1;min-height:52px;border-radius:12px;font-size:17px;font-weight:700;font-family:inherit;line-height:1.1;border:2px solid " + (zap ? "var(--red)" : "var(--border)") + ";background:" + (zap ? "var(--red)" : "var(--surface-2)") + ";color:" + (zap ? "#fff" : "var(--text-2)") + (minule ? ";opacity:.4" : ""));
          b.type = "button"; b.innerHTML = '<div style="display:flex;justify-content:center;margin-bottom:2px">' + svg("zvonec", 16) + '</div>' + txt;
          return b;
        }
        function riadok(nazov, pole, mins, volby, cas) {
          cele.appendChild(hl(nazov));
          var r = el("div", "display:flex;gap:8px");
          var c = kartaNast(u, service);
          mins.forEach(function (mm, i) {
            var minule = dnes && terazSec() >= cas() - mm * 60;
            var b = tlac(mm ? mm + " min" : "V čase", !!c[pole][i], minule);
            podrz(b, function () { c[pole][i] = c[pole][i] ? 0 : 1; ulozUpoz(u); kresli(); if (service._zvonecObnov) service._zvonecObnov(); },
              function () { minutyOkno(nazov, volby, mm, function (nm) { mins[i] = nm; ulozUpoz(u); kresli(); }); });
            r.appendChild(b);
          });
          cele.appendChild(r);
        }
        function kresli() {
          cele.innerHTML = "";
          riadok("Pred službou" + (k.od ? " " + k.od : ""), "pred", u.pred, VOLBY_PRED, odSec);
          if (m.vyj) riadok("Pred výjazdom", "vyj", u.vyj, VOLBY_VYJ, vyjSec);
          var ma_zoz = m.konecna || m.prestavka || m.striedac;
          if (!ma_zoz) return;
          if (!dnes) { cele.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:14px", "Odchody z konečnej a koniec prestávky sa dajú zapnúť v deň služby.")); return; }
          if (!nacitane) { cele.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:14px", "Načítavam časy…")); return; }
          skupiny.forEach(function (g) {
            cele.appendChild(hl(g.nazov));
            var box = el("div", "display:flex;flex-direction:column;gap:6px;" + (g.items.length > 4 ? "max-height:220px;overflow-y:auto" : ""));
            g.items.forEach(function (it) {
              var minule = !!(O && O.zostavaSek(it.cas) <= 0);
              var zap = !!(O && O.planZapnuta(g.kind, it, g.typ));
              var r = el("button", "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;font-size:17px;font-family:inherit;text-align:left;border:2px solid " + (zap ? "var(--red)" : "var(--border)") + ";background:" + (zap ? "var(--red)" : "var(--surface-2)") + ";color:" + (zap ? "#fff" : "var(--text-1)") + (minule ? ";opacity:.4" : ""));
              r.type = "button";
              r.appendChild(el("span", "font-weight:700;font-variant-numeric:tabular-nums", String(it.cas).split(":").slice(0, 2).join(":")));
              r.appendChild(el("span", "flex:1;text-align:right;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", it.nazov || ""));
              podrz(r, function () { if (minule || !O) return; O.planPolozka(g.kind, it, g.typ, g.pop, !zap); kresli(); if (service._zvonecObnov) service._zvonecObnov(); },
                function () { if (O) O.predstihOkno(g.typ); });
              box.appendChild(r);
            });
            cele.appendChild(box);
          });
          cele.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:12px", "Ťuk = zapnúť / vypnúť, podržanie = zmena minút."));
        }
        kresli();
        if (dnes && (m.konecna || m.prestavka || m.striedac)) nacitajSkupiny(service).then(function (g) { skupiny = g; nacitane = true; if (cele.isConnected) kresli(); });
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); if (service._zvonecObnov) service._zvonecObnov(); } }]
    });
  }
  // ---------- Okno „Pridelené vozidlo“ pred nástupom (len služby so začiatkom v depe) ----------
  // Ukáže sa 15 minút pred nástupom a v čase nástupu znova; pri zmene vozidla sa ukáže nanovo.
  var _vozTimery = {};
  function oknoVozidla(service) {
    var k = (service && service._karta) || {};
    if (!jeDnes(service) || !service._zDepa || !k.od) return;
    var v = (k.vozidla || [])[0], cislo = v && v.cislo ? String(v.cislo) : "";
    if (!cislo) return;
    var kl = kluc(service), od = sekOd(k.od);
    var n = new Date(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    var sl = null;
    try { sl = JSON.parse(localStorage.getItem("dpb_voz_okno") || "null"); } catch (e) {}
    if (!sl || sl.d !== dnesKluc()) sl = { d: dnesKluc(), m: {} };
    function ukaz(slot) {
      var kk = kl + "|" + slot;
      if (sl.m[kk] === cislo) return;
      sl.m[kk] = cislo; try { localStorage.setItem("dpb_voz_okno", JSON.stringify(sl)); } catch (e) {}
      if (document.querySelector(".voz-okno-bg")) return;
      var bg = el("div", ""); bg.className = "voz-okno-bg";
      var ok = el("div", ""); ok.className = "voz-okno";
      ok.appendChild(el("div", "", "Pridelené vozidlo na linku " + (k.kurz || "")));
      ok.firstChild.className = "voz-okno-t";
      var vv = el("div", "", cislo); vv.className = "voz-okno-v"; ok.appendChild(vv);
      var pl = el("div", ""); pl.className = "voz-okno-pl"; // textová poloha vozidla (napr. „Hala 2, stojisko 14“) – zatiaľ z poľa poloha na vozidle, zdroj dopojíme neskôr; bez textu ostáva prázdne políčko
      var polTxt = v && v.poloha ? String(v.poloha).trim() : "";
      pl.innerHTML = svg("poloha", 22) + "<span></span>"; pl.lastChild.textContent = polTxt || "Poloha vozidla";
      if (polTxt) pl.classList.add("je"); ok.appendChild(pl);
      var bt = el("button", "", "Rozumiem"); bt.type = "button"; bt.className = "voz-okno-b";
      bt.addEventListener("click", function () { bg.remove(); });
      ok.appendChild(bt); bg.appendChild(ok); document.body.appendChild(bg);
      try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    var t = _vozTimery[kl]; if (t) t.forEach(clearTimeout);
    _vozTimery[kl] = [];
    var a = od - 900;
    if (sec >= od) return;
    if (sec >= a) ukaz("15"); else _vozTimery[kl].push(setTimeout(function () { ukaz("15"); }, Math.min(2147000000, (a - sec) * 1000)));
    _vozTimery[kl].push(setTimeout(function () { ukaz("0"); }, Math.min(2147000000, (od - sec) * 1000)));
  }

  // Zvonček: ťuk = zapne / vypne všetko, podržanie = nastavenie
  function zvonec(service) {
    var b = el("button", "");
    b.type = "button"; b.className = "card-zvonec"; b.setAttribute("aria-label", "Upozornenia");
    b.innerHTML = svg("zvonec", 20);
    var k = (service && service._karta) || {}, t = null;
    function koniecSek() { var q = String(k.do || "").split(":"), od = sekOd(k.od), d = q.length > 1 ? (+q[0]) * 3600 + (+q[1]) * 60 : null; return d != null && d > od ? d : null; }
    function planKindy() { var key = (k.kurz || "") + "|" + (k.od || ""); return ["kn|" + key, "pr|" + key, "sd|" + key]; }
    function zapnute() {
      var u = nacitajUpoz(), c = u.karty[kluc(service)], m = ma(service), O = window.DpbOdpocet;
      var vrch = !!(c && (c.pred.some(Boolean) || (m.vyj && c.vyj.some(Boolean))));
      // plán odchodov (odpocet.js) platí len pre dnešok – na tej istej službe v iný deň zvonček zapnutý nie je
      return vrch || !!(jeDnes(service) && O && planKindy().some(function (kk) { return O.planJe(kk); }));
    }
    function obnov() {
      clearTimeout(t);
      var n = new Date(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(), kon = koniecSek();
      var skoncila = jeDnes(service) && kon != null && sec >= kon;
      b.disabled = skoncila;
      b.classList.toggle("off", skoncila);
      b.classList.toggle("zap", !skoncila && zapnute());
      b.title = skoncila ? "Služba už skončila" : "";
      if (!skoncila && kon != null && jeDnes(service)) t = setTimeout(obnov, Math.min(2147000000, Math.max(800, (kon - sec) * 1000 + 500)));
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && b.isConnected) obnov(); });
    service._zvonecObnov = obnov;
    obnov();
    // výjazd z depa (pre riadok „Pred výjazdom“): len keď prvý spoj služby začína na zastávke Dp.
    if (service._vzor === "SLUŽBA" && k.kurz && window.DpbStretnutia && window.DpbStretnutia.vyjazdZDepa) {
      window.DpbStretnutia.vyjazdZDepa(k.kurz, service.date, k.od, k.do).then(function (r) {
        if (!r) return;
        service._zDepa = true;
        if (r.sek > 0) service._premavkaOd = r.sek;
        obnov();
        oknoVozidla(service);
      }).catch(function () {});
    }
    function prepniVsetko() {
      var O = window.DpbOdpocet, u = nacitajUpoz(), c = kartaNast(u, service), m = ma(service), vypnut = zapnute();
      c.pred = c.pred.map(function () { return vypnut ? 0 : 1; });
      c.vyj = c.vyj.map(function () { return vypnut ? 0 : 1; });
      ulozUpoz(u);
      if (O && jeDnes(service) && (m.konecna || m.prestavka || m.striedac)) {
        if (vypnut) planKindy().forEach(function (kk) { O.planVypniKind(kk); });
        else nacitajSkupiny(service).then(function (g) { g.forEach(function (gr) { gr.items.forEach(function (it) { O.planPolozka(gr.kind, it, gr.typ, gr.pop, true); }); }); obnov(); });
      }
      if (window._showToast) window._showToast(vypnut ? "Upozornenia vypnuté" : "Upozornenia zapnuté", 2500);
      obnov();
    }
    podrz(b, function () { if (!b.disabled) prepniVsetko(); }, function () { if (!b.disabled) upozornenia(service); });
    return b;
  }

  // ---------- Žiadosti (budúce dni): Zmena stavu | Zmena služby ----------
  function ziadosti(service) {
    if (window.DpbZiadosti) return window.DpbZiadosti.otvor(service);
    if (!window.DpbOkna) return;
    var ctx = { date: service.date, service: service };
    window.DpbOkna.otvor({
      titul: "Žiadosti",
      podtitul: "",
      telo: function (t) {
        var lista = el("div", "display:flex;border-bottom:2px solid var(--border-2)");
        [["Zmena stavu", function () { window.DpbZmenaStavu.otvor(ctx); }],
         ["Zmena služby", function () { window.DpbZiadostSluzby.otvor({ date: service.date, service: service, zmena: true }); }]].filter(function (x) { return x[0] !== "Zmena služby" || !window.DpbPrava || window.DpbPrava.moze("zmena_sluzby"); }).forEach(function (x) {
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

  // ---------- Voľné služby z karty: voľba rozsahu (z dňa karty / všetky dostupné) ----------
  function volne(service) {
    var dk = (service && service.date) || "";
    var p = dk.split("-");
    var den = p.length === 3 ? parseInt(p[2], 10) + ". " + parseInt(p[1], 10) + ". " + p[0] : dk;
    function ist(cil) { window.DpbOkna.zavriVsetko(); if (window.DpbIdiNa) window.DpbIdiNa(cil); }
    if (!window.DpbOkna) return ist({ burza: dk || true });
    window.DpbOkna.otvor({
      titul: "Voľné služby",
      podtitul: "",
      telo: function (t) {
        [["Z dňa " + den, "Len voľné služby z tohto dňa.", { burza: dk }],
         ["Všetky dostupné", "Všetky voľné služby, ktoré môžeš teoreticky robiť.", { burza: true }]].forEach(function (x) {
          var b = el("button", "display:block;width:100%;text-align:left;padding:14px 16px;margin:0 0 10px;border:1px solid var(--border-2);border-radius:14px;background:var(--surface);color:var(--text-1);cursor:pointer");
          b.type = "button";
          b.appendChild(el("div", "font-size:17px;font-weight:700", x[0]));
          b.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:2px", x[1]));
          b.addEventListener("click", function () { ist(x[2]); });
          t.appendChild(b);
        });
      },
      tlacidla: [{ text: "Zrušiť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); } }],
    });
  }

  // ---------- Cestovný poriadok: grafikon (so všetkými funkciami: LIVE, upozornenia pri spojoch) + tri ušká ----------
  // Volá sa po otvorení grafikonu (kliknutie na službu aj položka menu): zmení ho na okno a pridá ušká
  // Zastávkový CP (s vyplnenou aktuálnou zastávkou) a Koho stretávam.
  var stav = null;
  function zrusOkno() {
    if (!stav) return;
    var s = stav; stav = null;
    try { s.obs.disconnect(); } catch (e) {}
    try { if (s.sled) s.sled.disconnect(); } catch (e) {}
    if (s.panelZ && s.domov && s.panelZ.parentNode !== s.domov) s.domov.insertBefore(s.panelZ, s.domov.firstChild);
    [s.tabs, s.paneZ, s.paneK, s.pozadie].forEach(function (x) { if (x && x.parentNode) x.parentNode.removeChild(x); });
    s.gm.classList.remove("gm-sheet");
    if (s.obsah) s.obsah.style.display = "";
  }
  // Úsek striedača, v ktorom je práve (dnes), inak najbližší nasledujúci / posledný
  function terazUsek(ctx) {
    var seg = ctx.segmenty || [];
    if (!seg.length) return null;
    var n = new Date(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    var rozsah = function (x) { var a = sekOd(x.prebera), b = sekOd(x.odovzdava); if (b <= a) b += 86400; return [a, b]; };
    var v = seg.filter(function (x) { var r = rozsah(x); return sec >= r[0] && sec <= r[1]; })[0];
    if (!v) v = seg.filter(function (x) { return rozsah(x)[0] > sec; })[0];
    return v || seg[seg.length - 1];
  }
  // Aktuálna zastávka kurzu podľa času (z polohy v cestovnom poriadku)
  async function aktualnaZastavka(ctx) {
    // najprv riadok „Teraz“ priamo z grafikonu (rovnaká poloha, akú vidí vodič), počká sa na jeho načítanie
    var sel = ctx.segmenty ? "#grafikonContent .grafikon-row:not(.past) .g-stop" : "#grafikonContent .grafikon-row.teraz .g-stop";
    for (var i = 0; i < 20; i++) {
      var r0 = document.querySelector(sel);
      if (r0 && r0.textContent.trim()) return r0.textContent.trim();
      await new Promise(function (ok) { setTimeout(ok, 200); });
    }
    var DS = window.DpbStretnutia;
    if (!DS || !DS.poloha) return null;
    var n = new Date(), dnes = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    var t = ctx.segmenty ? terazUsek(ctx) : null;
    if (t) ctx = { kurz: t.kurz, od: t.prebera, do: t.odovzdava, date: ctx.date };
    var od = sekOd(ctx.od), do_ = sekOd(ctx.do); if (do_ <= od) do_ += 86400;
    var sec = od, po = false;
    if (ctx.date === dnes) {
      sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      if (sec < od) sec = od; else if (sec > do_) { sec = do_; po = true; }
    }
    try {
      var r = await DS.poloha(ctx.kurz, ctx.date, sec, po);
      if (!r || r.chyba || !r.polozky || !r.polozky.length) return null;
      var z = r.polozky[Math.max(0, Math.min(r.polozky.length - 1, r.stred || 0))];
      return z && z.nazov || null;
    } catch (e) { return null; }
  }
  function predvypln(nazov) {
    var inp = document.getElementById("cpStanicaInput");
    var vys = document.getElementById("cpStanicaResults");
    if (!inp || !nazov || !vys) return;
    inp.value = nazov;
    if (stav) stav.auto = nazov;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    var cil = nazov.trim().toLowerCase(), pokusy = 0;
    var t = setInterval(function () {
      pokusy++;
      var riadky = Array.prototype.slice.call(vys.children).filter(function (d) { return d.tagName === "DIV" && d.textContent && d.textContent.length < 80; });
      var tocny = riadky.filter(function (d) { return d.textContent.trim().toLowerCase() === cil; })[0];
      if (tocny || (pokusy > 12 && riadky.length)) { clearInterval(t); (tocny || riadky[0]).click(); }
      else if (pokusy > 25 || !stav) clearInterval(t);
    }, 150);
  }
  function ozdob(ctx) {
    var gm = document.getElementById("grafikonModal");
    if (!gm || !ctx) return;
    zrusOkno();
    var n = new Date();
    var dnes = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    var jeLinka = function (kurz) { return /^[1349]\//.test(kurz || ""); };
    var mozeKto = ctx.date === dnes && (!window.DpbPrava || window.DpbPrava.moze("stretnutia")) && (ctx.vzor === "SLUŽBA" ? jeLinka(ctx.kurz) : ctx.vzor === "STRIEDAČ" && (ctx.segmenty || []).some(function (x) { return jeLinka(x.kurz); }));
    var obsah = document.getElementById("grafikonContent");
    var panelZ = document.getElementById("cpZastavkovyPanel");
    var s = { gm: gm, obsah: obsah, panelZ: panelZ, domov: panelZ && panelZ.parentNode };
    stav = s;
    gm.classList.add("gm-sheet");
    s.pozadie = el("div", ""); s.pozadie.className = "gm-pozadie";
    s.pozadie.addEventListener("click", function () { var c = document.getElementById("closeGrafikon"); if (c) c.click(); });
    gm.parentNode.insertBefore(s.pozadie, gm);
    s.paneZ = el("div", ""); s.paneZ.className = "gm-pane"; s.paneZ.style.display = "none";
    s.paneK = el("div", ""); s.paneK.className = "gm-pane"; s.paneK.style.display = "none";
    obsah.parentNode.insertBefore(s.paneZ, obsah.nextSibling);
    obsah.parentNode.insertBefore(s.paneK, s.paneZ.nextSibling);
    var ouska = [{ id: "cp", t: "CP linky / poradia" }];
    if (panelZ && ctx.date === dnes) ouska.push({ id: "zast", t: "Zastávkový CP" });
    if (mozeKto) ouska.push({ id: "kto", t: "Koho stretávam" });
    s.tabs = el("div", ""); s.tabs.className = "gm-ouska";
    var hl = gm.querySelector(".grafikon-header");
    hl.parentNode.insertBefore(s.tabs, hl.nextSibling);
    var aktivne = null;
    function ukaz(id) {
      aktivne = id;
      Array.prototype.forEach.call(s.tabs.children, function (b) { b.classList.toggle("on", b.dataset.id === id); });
      obsah.style.display = id === "cp" ? "" : "none";
      s.paneZ.style.display = id === "zast" ? "flex" : "none";
      s.paneK.style.display = id === "kto" ? "block" : "none";
      if (id === "zast") {
        if (!s.zHotovo) {
          s.zHotovo = true;
          s.paneZ.appendChild(panelZ);
          aktualnaZastavka(ctx).then(function (z) { if (stav === s && z) predvypln(z); });
        }
      } else if (s.zHotovo && id !== "zast") { /* panel ostáva v okne, len skrytý */ }
      if (id === "kto") {
        s.paneK.innerHTML = "";
        var tu = ctx.segmenty ? terazUsek(ctx) : null;
        if (tu && !jeLinka(tu.kurz)) {
          s.paneK.appendChild(el("div", "padding:14px 4px;font-size:15px;color:var(--text-2)", "Teraz jazdíš na kurze " + tu.kurz + ", pre ktorý sa „Koho stretávam“ nepočíta."));
        } else if (tu) window.DpbMiniGrafikon.stretnutia(tu.kurz, ctx.date, tu.prebera, tu.odovzdava, "", s.paneK);
        else window.DpbMiniGrafikon.stretnutia(ctx.kurz, ctx.date, ctx.od, ctx.do, "", s.paneK);
      }
    }
    ouska.forEach(function (o) {
      var b = el("button", "", o.t); b.type = "button"; b.dataset.id = o.id;
      b.addEventListener("click", function () { if (aktivne !== o.id) ukaz(o.id); });
      s.tabs.appendChild(b);
    });
    ukaz("cp");
    // Zastávkový CP sleduje cestovný poriadok naživo: keď sa v grafikone posunie „Teraz“ na ďalšiu zastávku, posunie sa aj on
    // (len kým si zastávku sám nezmenil a kým je zapnuté LIVE)
    if (ctx.segmenty) {
      var sledS = function (e) {
        if (stav !== s || !s.zHotovo) return;
        var as = window._appState ? window._appState() : null;
        if (as && as.grafikonFollow === false) return;
        var inp = document.getElementById("cpStanicaInput");
        var nova = e.detail;
        if (nova && inp && nova !== s.auto && inp.value === s.auto) predvypln(nova);
      };
      document.addEventListener("grafikon-teraz", sledS);
      s.sled = { disconnect: function () { document.removeEventListener("grafikon-teraz", sledS); } };
    }
    if (!ctx.segmenty) {
      var odloz = null;
      s.sled = new MutationObserver(function () {
        clearTimeout(odloz);
        odloz = setTimeout(function () {
          if (stav !== s || !s.zHotovo) return;
          var as = window._appState ? window._appState() : null;
          if (as && as.grafikonFollow === false) return;
          var r = document.querySelector("#grafikonContent .grafikon-row.teraz .g-stop");
          var inp = document.getElementById("cpStanicaInput");
          if (!r || !inp) return;
          var nova = r.textContent.trim();
          if (nova && nova !== s.auto && inp.value === s.auto) predvypln(nova);
        }, 200);
      });
      s.sled.observe(obsah, { childList: true });
    }
    s.obs = new MutationObserver(function () { if (!gm.classList.contains("active")) setTimeout(function () { if (stav === s && !gm.classList.contains("active")) zrusOkno(); }, 300); });
    s.obs.observe(gm, { attributes: true, attributeFilter: ["class"] });
  }

  window.DpbKartaNove = { volne: volne, ozdob: ozdob, osoba: osoba, meno: meno, zvonec: zvonec, ziadosti: ziadosti, upozornenia: upozornenia, svg: svg };
  // Podržanie prsta nesmie otvárať menu prehliadača (okrem polí na písanie)
  document.addEventListener("contextmenu", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("input,textarea,select,[contenteditable='true'],.selectable")) return;
    e.preventDefault();
  });
})();
