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
    // Neaktívny, keď je služba podľa cestovného poriadku už v premávke (dnes po začiatku služby)
    var k = (service && service._karta) || {}, t = null;
    // „V premávke“ = výjazd z vozovne, pri poobednej službe odchod z konečnej, pri striedačovi začiatok prvého striedania
    // (service._premavkaOd v sekundách sa doplní, keď je známe; dovtedy začiatok služby)
    function odSek() {
      if (service._premavkaOd != null) return service._premavkaOd;
      var q = String(k.od || "").split(":"); return q.length > 1 ? (+q[0]) * 3600 + (+q[1]) * 60 : null;
    }
    function dnesKluc() { var n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); }
    function obnov() {
      clearTimeout(t);
      var od = odSek(), n = new Date(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      var bezi = od != null && service.date === dnesKluc() && sec >= od;
      b.disabled = bezi;
      b.classList.toggle("off", bezi);
      b.setAttribute("aria-disabled", bezi ? "true" : "false");
      b.title = bezi ? "Služba už je v premávke" : "";
      if (!bezi && od != null && service.date === dnesKluc())
        t = setTimeout(obnov, Math.min(2147000000, Math.max(800, (od - sec) * 1000 + 500)));
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && b.isConnected) obnov(); });
    service._zvonecObnov = obnov;
    obnov();
    // bežná služba: výjazd / prvý odchod z konečnej podľa grafikonu kurzu
    if (service._vzor === "SLUŽBA" && k.kurz && window.DpbStretnutia && window.DpbStretnutia.odchodyZKonecnej) {
      window.DpbStretnutia.odchodyZKonecnej(k.kurz, service.date, k.od, k.do).then(function (l) {
        if (!l || !l.length) return;
        var q = String(l[0].cas).split(":"), sec = (+q[0]) * 3600 + (+q[1]) * 60 + (+q[2] || 0);
        if (sec > 0) { service._premavkaOd = sec; obnov(); }
      }).catch(function () {});
    }
    b.addEventListener("click", function (e) { e.stopPropagation(); if (b.disabled) return; upozornenia(service); });
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
    var mozeKto = ctx.date === dnes && (ctx.vzor === "SLUŽBA" ? jeLinka(ctx.kurz) : ctx.vzor === "STRIEDAČ" && (ctx.segmenty || []).some(function (x) { return jeLinka(x.kurz); }));
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
})();
