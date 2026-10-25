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

  // ---------- Výber dátumu vlastným kalendárom (s čiarkami služieb) ----------
  var MESIACE = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"];
  function klucDna(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  // o: {titul, hodnota "RRRR-MM-DD", min?, rozsahOd?, nepovinne?}; hotovo(kľúč dňa alebo "")
  function vyberDatumu(o, hotovo) {
    var p = (o.hodnota || klucDna(new Date())).split("-");
    var rok = +p[0], mes = +p[1] - 1;
    var rid = window.appState && window.appState.currentDriver;
    var telo = null;
    function kresli() {
      telo.innerHTML = "";
      var hl = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px");
      var pr = el("button", "background:none;border:none;color:var(--red);font-size:22px;padding:4px 14px;cursor:pointer", "‹");
      var dl = el("button", "background:none;border:none;color:var(--red);font-size:22px;padding:4px 14px;cursor:pointer", "›");
      pr.type = dl.type = "button";
      pr.addEventListener("click", function () { mes--; if (mes < 0) { mes = 11; rok--; } kresli(); });
      dl.addEventListener("click", function () { mes++; if (mes > 11) { mes = 0; rok++; } kresli(); });
      hl.appendChild(pr); hl.appendChild(el("div", "font-weight:600;font-size:15px", MESIACE[mes] + " " + rok)); hl.appendChild(dl);
      telo.appendChild(hl);
      var wd = el("div", "display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px");
      ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].forEach(function (x) { wd.appendChild(el("div", "text-align:center;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase", x)); });
      telo.appendChild(wd);
      var g = el("div", "display:grid;grid-template-columns:repeat(7,1fr);gap:2px");
      var zac = (new Date(rok, mes, 1).getDay() + 6) % 7, dni = new Date(rok, mes + 1, 0).getDate();
      for (var i = 0; i < zac; i++) g.appendChild(el("div", ""));
      var dnes = klucDna(new Date());
      for (var d = 1; d <= dni; d++) {
        (function (d) {
          var dt = new Date(rok, mes, d), key = klucDna(dt);
          var c = el("div", "", String(d));
          c.className = "calendar-cell";
          if (key === dnes) c.classList.add("today");
          if (window.Calendar && Calendar.isHoliday && Calendar.isHoliday(dt)) c.classList.add("is-holiday");
          var zakaz = o.min && key < o.min;
          if (o.rozsahOd && o.hodnota && key >= o.rozsahOd && key <= o.hodnota) c.style.background = "rgba(220,40,40,.12)";
          if (key === o.hodnota) c.classList.add("selected");
          if (window.DpbKalZnacky) DpbKalZnacky.pridaj(c, DpbKalZnacky.nacitaj(rid, key));
          if (zakaz) c.style.opacity = "0.3";
          else c.addEventListener("click", function () { hotovo(key); zavriVrch(); });
          g.appendChild(c);
        })(d);
      }
      telo.appendChild(g);
    }
    var tl = o.nepovinne
      ? [{ text: "Bez konca (zatiaľ neznáme)", klik: function () { hotovo(""); zavriVrch(); } }, { text: "Späť", klik: zavriVrch }]
      : [{ text: "Späť", klik: zavriVrch }];
    otvor({ spat: true, titul: o.titul || "Vyber dátum", telo: function (t) { telo = t; kresli(); }, tlacidla: tl });
  }
  // Pole podobné vstupu: ukáže dátum, po kliku otvorí kalendár. opt: {titul, prazdne, nepovinne, min(), rozsahOd(), zaklad(), zmena(v)}
  function datumPole(init, opt) {
    opt = opt || {};
    var st = { v: init || "" };
    var b = el("button", VSTUP_CSS + ";text-align:left;cursor:pointer");
    b.type = "button";
    function upd() { b.textContent = st.v ? pekne(st.v) : (opt.prazdne || "— nezadané —"); b.style.color = st.v ? "var(--text-1)" : "var(--text-3)"; }
    upd();
    b.addEventListener("click", function () {
      vyberDatumu({
        titul: opt.titul, hodnota: st.v || (opt.zaklad && opt.zaklad()) || klucDna(new Date()),
        min: opt.min && opt.min(), rozsahOd: opt.rozsahOd && opt.rozsahOd(), nepovinne: opt.nepovinne,
      }, function (v) { st.v = v; upd(); if (opt.zmena) opt.zmena(v); });
    });
    return { el: b, get: function () { return st.v; }, set: function (v) { st.v = v; upd(); } };
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
  function odosli(text, nad) {
    nad = nad || "Žiadosť o zmenu stavu";
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
        var dod = null;
        var od = datumPole(ctx.date, { titul: "Od", zmena: function (x) { if (dod && dod.get() && dod.get() < x) dod.set(v.doPovinne ? x : ""); } });
        var b = el("div", "font-size:13px;color:var(--text-2);margin:12px 0 4px", "Do");
        dod = datumPole(v.doPovinne ? ctx.date : "", {
          titul: "Do", nepovinne: !v.doPovinne, prazdne: v.doPovinne ? "— nezadané —" : "zatiaľ neznáme",
          min: function () { return od.get(); }, rozsahOd: function () { return od.get(); }, zaklad: function () { return od.get(); },
        });
        t.appendChild(a); t.appendChild(od.el); t.appendChild(b); t.appendChild(dod.el);
        var pz = null;
        if (v.poznamka) {
          t.appendChild(el("div", "font-size:13px;color:var(--text-2);margin:12px 0 4px", "Popis dôvodu"));
          pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:70px"); t.appendChild(pz);
        }
        var chyba = el("div", "color:var(--red);font-size:13px;margin-top:8px;min-height:16px");
        t.appendChild(chyba);
        t._zber = function () {
          if (!od.get()) { chyba.textContent = "Zadaj začiatok."; return null; }
          if (v.doPovinne && !dod.get()) { chyba.textContent = "Zadaj koniec."; return null; }
          if (dod.get() && dod.get() < od.get()) { chyba.textContent = "Koniec nemôže byť pred začiatkom."; return null; }
          if (pz && !pz.value.trim()) { chyba.textContent = "Popíš dôvod."; return null; }
          return { kind: v.kod, nazov: v.nazov, od: od.get(), do: dod.get() || "", poznamka: pz ? pz.value.trim() : "" };
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
        var od = datumPole(ctx.date, { titul: "Od ktorého dňa" }); t.appendChild(od.el);
        koniecNepritomnosti._od = od;
      },
      tlacidla: [
        { text: "Pokračovať", primarny: true, klik: function () {
          var d = koniecNepritomnosti._od.get();
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


  // ---------- Žiadosť o službu / Zmena služby ----------
  // Dve skupiny: „Chcem“ a „Nechcem“; v každej nepovinne typ služby, časy a linka.
  // Dva krátke riadky zaškrtávacích políčok: Kedy (ranná/poobedná), Aká (špička/celodenná); Striedač je vedľa poľa Linka.
  // Nič nezaškrtnuté alebo všetko zaškrtnuté = „je mi to jedno“. Ranná + poobedná + len špička = delená.
  var RIADKY = [
    { k: "kedy", t: "Kedy", m: ["Ranná", "Poobedná"] },
    { k: "aka", t: "Aká", m: ["Špička", "Celodenná"] },
  ];
  function skupina(nadpis, farba, nechcem) {
    var box = el("div", "border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:10px");
    box.appendChild(el("div", "font-weight:700;font-size:15px;margin-bottom:6px;color:" + farba, nadpis));
    var vyber = {};
    RIADKY.forEach(function (r) {
      vyber[r.k] = {};
      if (nechcem) return;                 // v „Nechcem“ sú len časy, linka a striedač
      var rad = el("div", "display:flex;align-items:center;gap:6px;margin-bottom:6px");
      r.m.forEach(function (m) {
        var c = el("button", "padding:7px 12px;border-radius:18px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer", m);
        c.type = "button";
        c.addEventListener("click", function () {
          vyber[r.k][m] = !vyber[r.k][m];
          c.style.background = vyber[r.k][m] ? "var(--red)" : "var(--surface-2)";
          c.style.color = vyber[r.k][m] ? "#fff" : "var(--text-1)";
        });
        rad.appendChild(c);
      });
      box.appendChild(rad);
    });
    // Dve polia: „Nástup po“ (najskôr) a „Ukončenie do“ (najneskôr); pri „Nechcem“ opačne
    var st = { casy: [] };
    var rc = el("div", "display:flex;gap:10px;margin:4px 0 8px");
    function pole(popis) {
      var w = el("div", "flex:1;min-width:0");
      w.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:3px", popis));
      var a = el("input", VSTUP_CSS + ";padding:10px 6px"); a.type = "time";
      w.appendChild(a); rc.appendChild(w);
      st.casy.push([a, popis]);
    }
    pole(nechcem ? "Nástup pred" : "Nástup po");
    pole(nechcem ? "Ukončenie po" : "Ukončenie do");
    box.appendChild(rc);
    var rl = el("div", "display:flex;gap:8px;align-items:center");
    var lin = el("input", VSTUP_CSS + ";flex:1;min-width:0"); lin.type = "text"; lin.placeholder = "Linka (napr. 1 alebo 3, 9)";
    var striedac = false;
    var sb = el("button", "padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer;flex-shrink:0", "Striedač");
    sb.type = "button";
    sb.addEventListener("click", function () {
      striedac = !striedac;
      sb.style.background = striedac ? "var(--red)" : "var(--surface-2)";
      sb.style.color = striedac ? "#fff" : "var(--text-1)";
    });
    rl.appendChild(lin); rl.appendChild(sb);
    box.appendChild(rl);
    return {
      box: box,
      zber: function () {
        var o = { linka: lin.value.trim(), casy: [], striedac: striedac };
        RIADKY.forEach(function (r) {
          var v = r.m.filter(function (m) { return vyber[r.k][m]; });
          o[r.k] = v;
        });
        for (var i = 0; i < st.casy.length; i++) {
          if (st.casy[i][0].value) o.casy.push(st.casy[i][1].toLowerCase() + " " + st.casy[i][0].value);
        }
        if (!nechcem && st.casy[0][0].value && st.casy[1][0].value && st.casy[1][0].value <= st.casy[0][0].value && o.aka.indexOf("Špička") < 0)
          return { chyba: "Ukončenie musí byť po nástupe." };
        o.zaskrtnute = striedac || RIADKY.some(function (r) { return Object.keys(vyber[r.k]).some(function (m) { return vyber[r.k][m]; }); });
        return o;
      },
    };
  }
  function popisSkupiny(o) {
    var c = [];
    var ma = function (a, x) { return a.indexOf(x) >= 0; };
    var delena = ma(o.kedy, "Ranná") && ma(o.kedy, "Poobedná") && o.aka.length === 1 && o.aka[0] === "Špička";
    var uzko = function (a, r) { return a.length && a.length < r.m.length ? a.join(" / ").toLowerCase() : ""; };  // všetko zaškrtnuté = je to jedno
    if (o.striedac) c.push("striedač");
    if (delena) c.push("delená (ranná + poobedná špička)");
    else {
      var k = uzko(o.kedy, RIADKY[0]), a = uzko(o.aka, RIADKY[1]);
      if (k) c.push(k);
      if (a) c.push(a);
    }
    if (o.casy.length) c.push(o.casy.join(", "));
    if (o.linka) c.push("linka " + o.linka);
    if (!c.length && o.zaskrtnute) c.push("ľubovoľná");
    return c.join(", ");
  }

  function ziadostSluzby(ctx) {
    var zmena = !!ctx.zmena;
    var nazov = zmena ? "Zmena služby" : "Žiadosť o službu";
    var sv = ctx.service;
    var povodna = sv && sv._vzor !== "NEPRÍTOMNOSŤ" ? (sv.line || "") + (sv.time ? " · " + sv.time : "") : "";
    otvor({
      titul: nazov,
      podtitul: pekne(ctx.date) + (povodna ? " · teraz: " + povodna : ""),
      telo: function (t) {
        var ch = skupina("Chcem", "#2e9b57"), nch = skupina("Nechcem", "var(--red)", true);
        t.appendChild(ch.box); t.appendChild(nch.box);
        var pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:56px"); pz.placeholder = "Poznámka (nepovinné)";
        t.appendChild(pz);
        var chyba = el("div", "color:var(--red);font-size:13px;margin-top:8px;min-height:16px");
        t.appendChild(chyba);
        ziadostSluzby._z = function () {
          var a = ch.zber(), b = nch.zber();
          if (a.chyba || b.chyba) { chyba.textContent = a.chyba || b.chyba; return null; }
          var pa = popisSkupiny(a), pb = popisSkupiny(b);
          if (!pa && !pb) { chyba.textContent = "Vyplň aspoň jednu vec: čo chceš alebo nechceš."; return null; }
          return { ch: pa, nch: pb, poz: pz.value.trim() };
        };
      },
      tlacidla: [
        { text: "Pripraviť hlásenie", primarny: true, klik: function () {
          var z = ziadostSluzby._z(); if (!z) return;
          var r = window.appState && window.appState.currentDriver;
          var riadky = [nazov === "Zmena služby" ? "Žiadosť o zmenu služby" : "Žiadosť o službu",
            "Vodič: " + (menoVodica(r) || "—") + " (os. č. " + r + ")", "Dátum: " + kratko(ctx.date)];
          if (zmena && povodna) riadky.push("Terajšia služba: " + povodna);
          if (z.ch) riadky.push("Chcem: " + z.ch);
          if (z.nch) riadky.push("Nechcem: " + z.nch);
          if (z.poz) riadky.push("Poznámka: " + z.poz);
          zavriVsetko();
          odosli(riadky.join("\n"), nazov === "Zmena služby" ? "Žiadosť o zmenu služby" : "Žiadosť o službu");
        } },
        { text: "Zrušiť", klik: zavriVsetko },
      ],
    });
  }


  // ---------- Reklamácia (minulý deň) ----------
  // Položky podľa typu karty; zaškrtneš, čo reklamuješ, a doplníš správnu hodnotu.
  var STAVY = ["Služba", "Dovolenka", "PN", "Lekár", "Voľno", "Iné"];
  function reklamacia(ctx) {
    var sv = ctx.service || null, k = (sv && sv._karta) || {};
    var vzor = sv ? sv._vzor : "";
    var jeSluzba = ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].indexOf(vzor) >= 0;
    var popisKarty = !sv ? "Voľno" : (vzor === "NEPRÍTOMNOSŤ" ? (k.popis || "Neprítomnosť") : (sv.line || "") + (sv.time ? " · " + sv.time : ""));
    var polozky = [{ k: "stav", t: "Stav", teraz: popisKarty }];
    if (jeSluzba) {
      polozky.push({ k: "nastup", t: "Čas nástupu", teraz: k.od ? DPBData.fmt(k.od) : "" });
      polozky.push({ k: "ukoncenie", t: "Čas ukončenia", teraz: k.do ? DPBData.fmt(k.do) : "" });
      polozky.push({ k: "vozidlo", t: "Vozidlo", teraz: (sv.vehicle && sv.vehicle !== "—") ? sv.vehicle : "" });
      polozky.push({ k: "hradenie", t: "Chýbajúce hradenie", teraz: "" });
      if (vzor !== "STRIEDAČ") polozky.push({ k: "zacvik", t: "Chýbajúci vykonaný zácvik", teraz: "" });
    }
    var polia = {};
    otvor({
      titul: "Reklamácia",
      podtitul: pekne(ctx.date) + (popisKarty ? " · " + popisKarty : "") + " · čo reklamuješ?",
      telo: function (t) {
        polozky.forEach(function (p) {
          var w = el("div", "border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px");
          var hlav = el("label", "display:flex;align-items:center;gap:10px;font-size:15px;cursor:pointer");
          var cb = el("input", "width:20px;height:20px;accent-color:var(--red);flex-shrink:0"); cb.type = "checkbox";
          hlav.appendChild(cb);
          var tx = el("div", "flex:1;min-width:0");
          tx.appendChild(el("div", "", p.t));
          if (p.teraz) tx.appendChild(el("div", "font-size:12px;color:var(--text-2)", "v systéme: " + p.teraz));
          hlav.appendChild(tx);
          w.appendChild(hlav);
          var pole, vstup;
          if (p.k === "stav") {
            vstup = el("select", VSTUP_CSS);
            vstup.appendChild(el("option", "", "— správny stav —")).value = "";
            STAVY.forEach(function (x) { var o = el("option", "", x); o.value = x; vstup.appendChild(o); });
          } else if (p.k === "nastup" || p.k === "ukoncenie") {
            vstup = el("input", VSTUP_CSS); vstup.type = "time";
          } else {
            vstup = el("input", VSTUP_CSS); vstup.type = "text";
            vstup.placeholder = p.k === "vozidlo" ? "Správne vozidlo (číslo)" : p.k === "hradenie" ? "Čo chýba (kurz, vozidlo, čas)" : "Kedy a kde bol zácvik";
          }
          pole = el("div", "display:none;margin-top:8px");
          pole.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:3px", p.k === "nastup" || p.k === "ukoncenie" ? "Správny čas" : p.k === "stav" ? "Správny stav" : "Doplň"));
          pole.appendChild(vstup);
          w.appendChild(pole);
          cb.addEventListener("change", function () { pole.style.display = cb.checked ? "block" : "none"; });
          polia[p.k] = { cb: cb, vstup: vstup, p: p };
          t.appendChild(w);
        });
        var pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:56px"); pz.placeholder = "Poznámka (nepovinné)";
        t.appendChild(pz);
        var chyba = el("div", "color:var(--red);font-size:13px;margin-top:8px;min-height:16px");
        t.appendChild(chyba);
        reklamacia._z = function () {
          var r = [];
          for (var i = 0; i < polozky.length; i++) {
            var q = polia[polozky[i].k];
            if (!q.cb.checked) continue;
            var v = q.vstup.value.trim();
            if (!v) { chyba.textContent = "Doplň hodnotu pri: " + q.p.t; return null; }
            r.push(q.p.t + (q.p.teraz ? ": v systéme " + q.p.teraz + ", správne " : ": ") + v);
          }
          if (!r.length) { chyba.textContent = "Zaškrtni, čo reklamuješ."; return null; }
          return { r: r, poz: pz.value.trim() };
        };
      },
      tlacidla: [
        { text: "Pripraviť hlásenie", primarny: true, klik: function () {
          var z = reklamacia._z(); if (!z) return;
          var rid = window.appState && window.appState.currentDriver;
          var riadky = ["Reklamácia", "Vodič: " + (menoVodica(rid) || "—") + " (os. č. " + rid + ")", "Dátum: " + kratko(ctx.date)];
          if (popisKarty) riadky.push("Karta: " + popisKarty);
          z.r.forEach(function (x) { riadky.push("- " + x); });
          if (z.poz) riadky.push("Poznámka: " + z.poz);
          zavriVsetko();
          odosli(riadky.join("\n"), "Reklamácia");
        } },
        { text: "Zrušiť", klik: zavriVsetko },
      ],
    });
  }


  // ---------- Nahlásiť (porucha vozidla / iné) – predpríprava ----------
  // Prvé okno: čo a komu. Ďalšie vrstvy podľa typu pribudnú neskôr.
  function chipy(rodic, moznosti, jedna, zmena) {
    var vyber = {};
    var h = el("div", "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px");
    var prvky = {};
    function vykresli() {
      Object.keys(prvky).forEach(function (k) {
        var on = !!vyber[k];
        prvky[k].style.background = on ? "var(--red)" : "var(--surface-2)";
        prvky[k].style.color = on ? "#fff" : "var(--text-1)";
      });
    }
    moznosti.forEach(function (m) {
      var c = el("button", "padding:9px 14px;border-radius:18px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer", m);
      c.type = "button";
      c.addEventListener("click", function () {
        if (jedna) { var bol = vyber[m]; vyber = {}; if (!bol) vyber[m] = true; }
        else vyber[m] = !vyber[m];
        vykresli(); zmena && zmena(vyber);
      });
      prvky[m] = c; h.appendChild(c);
    });
    rodic.appendChild(h);
    return function () { return Object.keys(vyber).filter(function (k) { return vyber[k]; }); };
  }
  function nahlasit(ctx) {
    var sv = ctx.service || {}, k = sv._karta || {};
    var voz = [];
    (k.vozidla || []).forEach(function (x) { var c = String(x.cislo); if (c && voz.indexOf(c) < 0) voz.push(c); });
    (k.kurzy || []).forEach(function (x) { var c = String(x.vozidlo || ""); if (c && voz.indexOf(c) < 0) voz.push(c); });
    if (!voz.length && sv.vehicle && sv.vehicle !== "—") voz.push(String(sv.vehicle));
    otvor({
      titul: "Nahlásiť",
      podtitul: pekne(ctx.date) + (sv.line ? " · " + sv.line : ""),
      telo: function (t) {
        t.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:6px", "Čo nahlasuješ?"));
        var co = chipy(t, ["Porucha vozidla", "Iné"], true, function (v) { vozBox.style.display = v["Porucha vozidla"] && voz.length > 1 ? "block" : "none"; });
        var vozBox = el("div", "display:none;margin:-4px 0 12px");
        vozBox.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:3px", "Ktoré vozidlo?"));
        var vsel = el("select", VSTUP_CSS);
        voz.forEach(function (x) { var o = el("option", "", x); o.value = x; vsel.appendChild(o); });
        vozBox.appendChild(vsel); t.appendChild(vozBox);
        t.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-bottom:6px", "Komu hlásiš?"));
        var komu = chipy(t, ["Dielňa", "Dispečing", "Výpravňa"], false);
        var tx = el("textarea", VSTUP_CSS + ";resize:none;min-height:80px"); tx.placeholder = "Popis (čo sa stalo)";
        t.appendChild(tx);
        var chyba = el("div", "color:var(--red);font-size:13px;margin-top:8px;min-height:16px");
        t.appendChild(chyba);
        nahlasit._z = function () {
          var c = co(), kk = komu();
          if (!c.length) { chyba.textContent = "Vyber, čo nahlasuješ."; return null; }
          if (!kk.length) { chyba.textContent = "Vyber, komu hlásiš."; return null; }
          if (!tx.value.trim()) { chyba.textContent = "Doplň popis."; return null; }
          return { co: c[0], komu: kk, popis: tx.value.trim(), voz: c[0] === "Porucha vozidla" ? (voz.length > 1 ? vsel.value : (voz[0] || "")) : "" };
        };
      },
      tlacidla: [
        { text: "Pripraviť hlásenie", primarny: true, klik: function () {
          var z = nahlasit._z(); if (!z) return;
          var rid = window.appState && window.appState.currentDriver;
          var r = ["Hlásenie: " + z.co, "Komu: " + z.komu.join(", "),
            "Vodič: " + (menoVodica(rid) || "—") + " (os. č. " + rid + ")", "Dátum: " + kratko(ctx.date)];
          if (sv.line) r.push("Služba: " + sv.line + (sv.time ? " · " + sv.time : ""));
          if (z.voz) r.push("Vozidlo: " + z.voz);
          r.push("Popis: " + z.popis);
          zavriVsetko();
          odosli(r.join("\n"), "Hlásenie: " + z.co);
        } },
        { text: "Zrušiť", klik: zavriVsetko },
      ],
    });
  }

  window.DpbOkna = { otvor: otvor, zavriVrch: zavriVrch, zavriVsetko: zavriVsetko };
  window.DpbZmenaStavu = { otvor: otvorZmenuStavu, _text: spravaText };
  window.DpbZiadostSluzby = { otvor: ziadostSluzby };
  window.DpbReklamacia = { otvor: reklamacia };
  window.DpbNahlasit = { otvor: nahlasit };
})();
