/* Vrstvené okná (stoh) + prvé okno z menu: „Zmena stavu“.
   DpbOkna.otvor({titul, podtitul, telo(el), tlacidla:[{text, primarny, klik}], spat}) – pridá okno na vrch stohu,
   predchádzajúce sa posunie vyššie a zmenší. DpbOkna.zavriVsetko() zavrie celý stoh.
   DpbZmenaStavu.otvor({date:"RRRR-MM-DD", service?, volno?}) – tok: výber stavu → formulár (od–do) → hlásenie.
   Hlásenie sa zatiaľ pripraví ako text (zdieľanie / schránka); server zatiaľ nie je. */
(function () {
  var koren = null, okna = [];

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(t, ms) { if (window._showToast) window._showToast(t, ms); }

  function rozloz() {
    var n = okna.length;
    okna.forEach(function (o, i) {
      var d = n - 1 - i;
      if (d === 0) {
        o.el.style.transform = "translateY(0) scale(1)";
        o.el.style.filter = "none";
        o.el.style.pointerEvents = "auto";
      } else {
        var vrch = okna[n - 1].el.offsetHeight;
        o.el.style.transform = "translateY(" + (-(vrch * 0.45 + 14 * d)) + "px) scale(" + (1 - 0.05 * d) + ")";
        o.el.style.filter = "brightness(0.82)";
        o.el.style.pointerEvents = "none";
      }
    });
  }
  function zaisti() {
    if (koren) return;
    koren = el("div", "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;overflow:hidden");
    koren.addEventListener("click", function (e) { if (e.target === koren) zavriVsetko(); });
    document.body.appendChild(koren);
  }
  function zavriVsetko() {
    okna = [];
    if (koren) { koren.remove(); koren = null; }
  }
  function zavriVrch() {
    var o = okna.pop();
    if (!o) return;
    o.el.style.transform = "translateY(110%)";
    setTimeout(function () { o.el.remove(); }, 250);
    if (!okna.length) { var k = koren; koren = null; if (k) { k.style.background = "rgba(0,0,0,0)"; setTimeout(function () { k.remove(); }, 250); } }
    else rozloz();
  }

  function otvor(o) {
    zaisti();
    var s = el("div", "position:absolute;left:50%;bottom:0;width:100%;max-width:480px;box-sizing:border-box;background:var(--surface);color:var(--text-1);border-radius:20px 20px 0 0;padding:18px 20px calc(22px + env(safe-area-inset-bottom, 0px));max-height:88%;overflow:auto;transition:transform .28s cubic-bezier(.32,.72,0,1),filter .28s;transform:translateY(110%);margin-left:-240px");
    // stred pri šírke < 480
    s.style.marginLeft = "0";
    s.style.left = "0";
    s.style.right = "0";
    s.style.marginRight = "auto";
    s.style.marginLeft = "auto";
    var hl = el("div", "display:flex;align-items:center;gap:8px;margin-bottom:4px");
    if (o.spat) {
      var sp = el("button", "background:none;border:none;font-size:22px;line-height:1;color:var(--red);padding:0 6px 0 0;cursor:pointer", "‹");
      sp.setAttribute("aria-label", "Späť");
      sp.addEventListener("click", zavriVrch);
      hl.appendChild(sp);
    }
    hl.appendChild(el("div", "font-size:17px;font-weight:600;flex:1", o.titul || ""));
    s.appendChild(hl);
    if (o.podtitul) s.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:12px", o.podtitul));
    else s.appendChild(el("div", "height:10px"));
    var telo = el("div", "");
    s.appendChild(telo);
    if (o.telo) o.telo(telo, s);
    if (o.tlacidla && o.tlacidla.length) {
      var r = el("div", "display:flex;gap:10px;margin-top:16px");
      o.tlacidla.forEach(function (t) {
        var b = el("button", "flex:1;padding:14px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;" + (t.primarny ? "background:var(--red);color:#fff" : "background:var(--surface-2);color:var(--text-1)"), t.text);
        b.addEventListener("click", function () { t.klik && t.klik(b); });
        r.appendChild(b);
      });
      s.appendChild(r);
    }
    koren.appendChild(s);
    var zaz = { el: s };
    okna.push(zaz);
    requestAnimationFrame(function () { requestAnimationFrame(rozloz); });
    return zaz;
  }

  // ---------- Zmena stavu ----------
  var DNI = ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"];
  function pekne(d) {
    var p = d.split("-");
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return DNI[dt.getDay()] + " " + (+p[2]) + ". " + (+p[1]) + ". " + p[0];
  }
  function kratko(d) { var p = d.split("-"); return p[2] + "." + p[1] + "." + p[0]; }
  function menoVodica(r) {
    var x = (window.DPBData ? DPBData.getDrivers() : []).filter(function (q) { return String(q.rid) === String(r); })[0];
    return x ? x.meno : "";
  }
  function odosli(text) {
    var nad = "Žiadosť o zmenu stavu";
    if (navigator.share) return navigator.share({ title: nad, text: text }).catch(function () {});
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(text).then(function () { toast("Hlásenie je skopírované, vlož ho do správy", 4000); }, function () { toast("Hlásenie sa nepodarilo skopírovať", 4000); });
    toast("Zdieľanie nie je dostupné", 4000);
    return Promise.resolve();
  }
  var VOLBA_CSS = "display:block;width:100%;padding:13px 16px;margin-bottom:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;font-size:15px;color:var(--text-1);text-align:left;cursor:pointer";
  var VSTUP_CSS = "width:100%;box-sizing:border-box;padding:10px 12px;font-size:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-1);outline:none";

  function spravaText(ctx, st) {
    var r = window.appState && window.appState.currentDriver;
    var r1 = ["Žiadosť o zmenu stavu", "Vodič: " + (menoVodica(r) || "—") + " (os. č. " + r + ")", "Zmena stavu: " + st.nazov];
    if (st.kind === "koniec") {
      r1.push("Od dňa: " + kratko(st.od));
      r1.push("Žiadam o pridelenie služby v tento deň: " + (st.sluzba ? "áno" : "nie"));
    } else if (st.od) {
      r1.push("Od: " + kratko(st.od));
      if (st.do) r1.push("Do: " + kratko(st.do) + (st.do === st.od ? "" : ""));
      else if (st.kind !== "lekar") r1.push("Do: zatiaľ neznáme");
    } else r1.push("Dátum: " + kratko(ctx.date));
    if (st.poznamka) r1.push("Poznámka: " + st.poznamka);
    return r1.join("\n");
  }

  function dokonci(ctx, st) {
    zavriVsetko();
    odosli(spravaText(ctx, st));
  }

  function formular(ctx, v) {
    // v: {kod, nazov, doPovinne, poznamka}
    otvor({
      spat: true,
      titul: v.nazov,
      podtitul: "Vyber dátumy" + (v.doPovinne ? "" : " (koniec môže ostať prázdny, ak ešte nie je známy)"),
      telo: function (t) {
        var a = el("div", "font-size:13px;color:var(--text-2);margin-bottom:4px", "Od");
        var od = el("input", VSTUP_CSS); od.type = "date"; od.value = ctx.date;
        var b = el("div", "font-size:13px;color:var(--text-2);margin:12px 0 4px", "Do");
        var dod = el("input", VSTUP_CSS); dod.type = "date"; dod.value = v.doPovinne ? ctx.date : "";
        t.appendChild(a); t.appendChild(od); t.appendChild(b); t.appendChild(dod);
        var pz = null;
        if (v.poznamka) {
          t.appendChild(el("div", "font-size:13px;color:var(--text-2);margin:12px 0 4px", "Popis dôvodu"));
          pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:70px"); t.appendChild(pz);
        }
        var chyba = el("div", "color:var(--red);font-size:13px;margin-top:8px;min-height:16px");
        t.appendChild(chyba);
        t._zber = function () {
          if (!od.value) { chyba.textContent = "Zadaj začiatok."; return null; }
          if (v.doPovinne && !dod.value) { chyba.textContent = "Zadaj koniec."; return null; }
          if (dod.value && dod.value < od.value) { chyba.textContent = "Koniec nemôže byť pred začiatkom."; return null; }
          if (pz && !pz.value.trim()) { chyba.textContent = "Popíš dôvod."; return null; }
          return { kind: v.kod, nazov: v.nazov, od: od.value, do: dod.value || "", poznamka: pz ? pz.value.trim() : "" };
        };
        formular._t = t;
      },
      tlacidla: [
        { text: "Pripraviť hlásenie", primarny: true, klik: function () { var h = formular._t._zber(); if (h) dokonci(ctx, h); } },
        { text: "Späť", klik: zavriVrch },
      ],
    });
  }

  function koniecNepritomnosti(ctx, popis) {
    otvor({
      spat: true,
      titul: "Ukončiť " + popis,
      podtitul: "Od ktorého dňa sa vraciaš do práce?",
      telo: function (t) {
        var od = el("input", VSTUP_CSS); od.type = "date"; od.value = ctx.date; t.appendChild(od);
        koniecNepritomnosti._od = od;
      },
      tlacidla: [
        { text: "Pokračovať", primarny: true, klik: function () {
          var d = koniecNepritomnosti._od.value;
          if (!d) { toast("Zadaj dátum"); return; }
          otvor({
            spat: true,
            titul: "Požiadať o službu?",
            podtitul: "Chceš v deň " + pekne(d) + " požiadať o pridelenie služby?",
            tlacidla: [
              { text: "Áno", primarny: true, klik: function () { dokonci(ctx, { kind: "koniec", nazov: "ukončenie – " + popis, od: d, sluzba: true }); } },
              { text: "Nie", klik: function () { dokonci(ctx, { kind: "koniec", nazov: "ukončenie – " + popis, od: d, sluzba: false }); } },
            ],
          });
        } },
        { text: "Späť", klik: zavriVrch },
      ],
    });
  }

  function otvorZmenuStavu(ctx) {
    if (!ctx || !ctx.date) return;
    var k = (ctx.service && ctx.service._karta) || {};
    var popis = "";
    if (ctx.service && ctx.service._vzor === "NEPRÍTOMNOSŤ" && k.kod) popis = k.popis || "neprítomnosť";
    var aktualne = popis || (ctx.volno ? "Voľno" : (ctx.service ? "Služba " + (ctx.service.line || "") : ""));
    otvor({
      titul: "Zmena stavu",
      podtitul: pekne(ctx.date) + (aktualne ? " · teraz: " + aktualne : ""),
      telo: function (t) {
        function volba(text, klik) {
          var b = el("button", VOLBA_CSS, text);
          b.addEventListener("click", klik);
          t.appendChild(b);
        }
        if (popis) volba("Ukončiť " + popis + " (späť do práce)", function () { koniecNepritomnosti(ctx, popis); });
        volba("Dovolenka", function () { formular(ctx, { kod: "dovolenka", nazov: "Dovolenka", doPovinne: true }); });
        volba("PN", function () { formular(ctx, { kod: "pn", nazov: "PN", doPovinne: false }); });
        volba("Lekár", function () { dokonci(ctx, { kind: "lekar", nazov: "Lekár" }); });
        volba("Voľno", function () { formular(ctx, { kod: "volno", nazov: "Voľno", doPovinne: true }); });
        volba("Iné", function () { formular(ctx, { kod: "ine", nazov: "Iné", doPovinne: false, poznamka: true }); });
      },
      tlacidla: [{ text: "Zrušiť", klik: zavriVsetko }],
    });
  }

  window.DpbOkna = { otvor: otvor, zavriVrch: zavriVrch, zavriVsetko: zavriVsetko };
  window.DpbZmenaStavu = { otvor: otvorZmenuStavu, _text: spravaText };
})();
