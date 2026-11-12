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
  // Chybová hláška vo formulári: oranžová (červená ostáva značke DPB), pri každej novej hláške krátko zabliká
  function chybaPole() {
    var e = document.createElement("div");
    e.className = "chyba-text";
    var d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
    Object.defineProperty(e, "textContent", {
      get: function () { return d.get.call(e); },
      set: function (v) {
        d.set.call(e, v);
        e.classList.remove("chyba-blik");
        if (v) { void e.offsetWidth; e.classList.add("chyba-blik"); }
      }
    });
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

  // Zachytávanie: keď je nastavené, otvor() nevytvorí okno, ale vykreslí telo do daného panelu (pre záložky)
  var zachyt = null;
  function otvor(o) {
    if (zachyt) {
      var z = zachyt; zachyt = null;
      z.titul = o.titul; z.podtitul = o.podtitul; z.tlacidla = o.tlacidla;
      if (o.telo) o.telo(z.telo, z.telo);
      return { el: z.telo };
    }
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
    if (o.podtitul) s.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-bottom:12px", o.podtitul));
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
      ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].forEach(function (x) { wd.appendChild(el("div", "text-align:center;font-size:15px;font-weight:600;color:var(--text-3);text-transform:uppercase", x)); });
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
  // Od/Do vedľa seba; po ťuknutí sa pod nimi vyroluje kalendár (aktívne pole je zvýraznené červeným rámikom)
  function rozsahDatumov(init, opt) {
    opt = opt || {};
    var st = { od: init || "", do: opt.doPovinne ? (init || "") : "", akt: null };
    var rid = window.appState && window.appState.currentDriver;
    var kor = el("div", "");
    var rad = el("div", "display:flex;gap:10px");
    var panel = el("div", "display:none;margin-top:12px;padding:10px;border:1px solid var(--border-2);border-radius:14px;background:var(--surface)");
    var cipy = {};
    function mkChip(k, nadpis) {
      var b = el("button", "flex:1;min-width:0;text-align:left;padding:8px 12px;border-radius:14px;border:0;background:var(--surface);color:var(--text-1);cursor:pointer;box-shadow:inset 0 0 0 2px transparent;transition:box-shadow .15s");
      b.type = "button";
      b._n = el("div", "font-size:13px;color:var(--text-2)", nadpis);
      b._v = el("div", "font-size:16px;font-weight:600;margin-top:1px");
      b.appendChild(b._n); b.appendChild(b._v);
      b.addEventListener("click", function () { st.akt = st.akt === k ? null : k; if (st.akt) zobraz(st.akt); vykresli(); });
      cipy[k] = b; rad.appendChild(b);
    }
    function kratkyDen(d) { var q = d.split("-"); return (+q[2]) + ". " + (+q[1]) + ". " + q[0]; }
    var rok = 0, mes = 0;
    function zobraz(k) {
      var v = st[k] || (k === "do" ? st.od : "") || init || klucDna(new Date());
      var q = v.split("-"); rok = +q[0]; mes = +q[1] - 1;
    }
    function vykresli() {
      ["od", "do"].forEach(function (k) {
        if (!cipy[k]) return;
        var b = cipy[k], on = st.akt === k;
        b.style.boxShadow = on ? "inset 0 0 0 2px var(--red)" : "inset 0 0 0 2px transparent";
        var prazdne = k === "do" && !st.do;
        b._v.textContent = st[k] ? kratkyDen(st[k]) : (prazdne ? "neznáme" : "nezadané");
        b._v.style.color = st[k] ? "var(--text-1)" : "var(--text-3)";
      });
      panel.innerHTML = "";
      if (!st.akt) { panel.style.display = "none"; return; }
      panel.style.display = "block";
      var hl = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px");
      var pr = el("button", "background:none;border:none;color:var(--red);font-size:22px;padding:4px 14px;cursor:pointer", "‹");
      var dl = el("button", "background:none;border:none;color:var(--red);font-size:22px;padding:4px 14px;cursor:pointer", "›");
      pr.type = dl.type = "button";
      pr.addEventListener("click", function () { mes--; if (mes < 0) { mes = 11; rok--; } vykresli(); });
      dl.addEventListener("click", function () { mes++; if (mes > 11) { mes = 0; rok++; } vykresli(); });
      hl.appendChild(pr); hl.appendChild(el("div", "font-weight:600;font-size:15px", MESIACE[mes] + " " + rok)); hl.appendChild(dl);
      panel.appendChild(hl);
      var wd = el("div", "display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px");
      ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].forEach(function (x) { wd.appendChild(el("div", "text-align:center;font-size:15px;font-weight:600;color:var(--text-3);text-transform:uppercase", x)); });
      panel.appendChild(wd);
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
          var zakaz = st.akt === "do" && st.od && key < st.od;
          if (st.od && st.do && key >= st.od && key <= st.do) c.style.background = "rgba(220,40,40,.12)";
          if (key === st[st.akt]) c.classList.add("selected");
          if (window.DpbKalZnacky) DpbKalZnacky.pridaj(c, DpbKalZnacky.nacitaj(rid, key));
          if (zakaz) c.style.opacity = "0.3";
          else c.addEventListener("click", function () {
            if (opt.jenDen) { st.od = key; st.akt = null; }
            else if (st.akt === "od") {
              st.od = key;
              if (st.do && st.do < key) st.do = opt.doPovinne ? key : "";
              st.akt = "do"; zobraz("do");              // po výbere začiatku rovno na koniec
            } else {
              st.do = key; st.akt = null;
            }
            vykresli();
          });
          g.appendChild(c);
        })(d);
      }
      panel.appendChild(g);
      if (st.akt === "od" && opt.nepovinneOd) {
        var bz = el("button", "margin-top:8px;background:none;border:none;color:var(--red);font-size:15px;cursor:pointer;padding:6px 0", "Bez začiatku (nahlasujem len koniec)");
        bz.type = "button";
        bz.addEventListener("click", function () { st.od = ""; st.akt = "do"; zobraz("do"); vykresli(); });
        panel.appendChild(bz);
      }
      if (st.akt === "do" && !opt.doPovinne) {
        var bk = el("button", "margin-top:8px;background:none;border:none;color:var(--red);font-size:15px;cursor:pointer;padding:6px 0", "Bez konca (zatiaľ neznáme)");
        bk.type = "button";
        bk.addEventListener("click", function () { st.do = ""; st.akt = null; vykresli(); });
        panel.appendChild(bk);
      }
    }
    mkChip("od", opt.jenDen ? "Deň" : "Od"); if (!opt.jenDen) mkChip("do", "Do");
    kor.appendChild(rad); kor.appendChild(panel);
    vykresli();
    return { el: kor, od: function () { return st.od; }, do: function () { return st.do; } };
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
  // Náhľad hlásenia: kým nie je server, hlásenie sa najprv zobrazí (dá sa upraviť), až potom skopíruje/zdieľa.
  function odosli(text, nad) {
    nad = nad || "Žiadosť o zmenu stavu";
    otvor({
      titul: "Hlásenie – náhľad",
      podtitul: nad + " · zatiaľ sa nikam neodosiela, text môžeš upraviť",
      telo: function (t) {
        var ta = el("textarea", VSTUP_CSS + ";resize:none;font-size:15px;line-height:1.45;min-height:200px");
        ta.value = text;
        t.appendChild(ta);
        setTimeout(function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 4, window.innerHeight * 0.5) + "px"; }, 0);
        odosli._ta = ta;
      },
      tlacidla: [
        { text: "Skopírovať / zdieľať", primarny: true, klik: function () { poslatText(odosli._ta.value, nad); } },
        { text: "Zavrieť", klik: zavriVsetko },
      ],
    });
    return Promise.resolve();
  }
  function poslatText(text, nad) {
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
    } else if (!st.od && st.do) {
      r1.push("Hlásim koniec – Do: " + kratko(st.do));
    } else if (st.kind === "lekar" && st.od) {
      r1.push("Dátum: " + kratko(st.od));
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
        var roz = rozsahDatumov(ctx.date, { doPovinne: v.doPovinne });
        t.appendChild(roz.el);
        var od = { get: roz.od }, dod = { get: roz.do };
        var pz = null;
        if (v.poznamka) {
          t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin:12px 0 4px", "Popis dôvodu"));
          pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:70px"); t.appendChild(pz);
        }
        var chyba = chybaPole();
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
    var vyber = {}, cipy = {};
    RIADKY.forEach(function (r) {
      vyber[r.k] = {};
      if (nechcem) return;                 // v „Nechcem“ sú len časy, linka a striedač
      var rad = el("div", "display:flex;align-items:center;gap:6px;margin-bottom:6px");
      r.m.forEach(function (m) {
        var c = el("button", "padding:7px 12px;border-radius:18px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:15px;cursor:pointer", m);
        c.type = "button";
        cipy[r.k + "|" + m] = c;
        c.addEventListener("click", function () {
          vyber[r.k][m] = !vyber[r.k][m];
          c.style.background = vyber[r.k][m] ? "var(--red)" : "var(--surface-2)";
          c.style.color = vyber[r.k][m] ? "#fff" : "var(--text-1)";
          c.classList.toggle("chip-on", !!vyber[r.k][m]);
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
      w.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-bottom:3px", popis));
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
    var sb = el("button", "padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:15px;cursor:pointer;flex-shrink:0", "Striedač");
    sb.type = "button";
    sb.addEventListener("click", function () {
      striedac = !striedac;
      sb.style.background = striedac ? "var(--red)" : "var(--surface-2)";
      sb.style.color = striedac ? "#fff" : "var(--text-1)";
      sb.classList.toggle("chip-on", striedac);
    });
    rl.appendChild(lin); rl.appendChild(sb);
    box.appendChild(rl);
    return {
      box: box,
      // predvyplnenie: cas(0|1, "HH:MM"), zaskrtni(riadok, volba)
      cas: function (i, v) { st.casy[i][0].value = v; },
      zaskrtni: function (rk, m) {
        var c = cipy[rk + "|" + m]; if (!c) return;
        vyber[rk][m] = true; c.style.background = "var(--red)"; c.style.color = "#fff"; c.classList.add("chip-on");
      },
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
      titul: nazov + " na " + pekne(ctx.date),
      podtitul: "Aktuálne: " + (povodna || "voľno"),
      telo: function (t) {
        var ch = skupina("Chcem", "#2e9b57"), nch = skupina("Nechcem", "var(--chyba)", true);
        // Voľný deň: z odpočinkov (min. 6 h) predvyplň „Nástup po“, „Ukončenie do“ a Rannú/Poobednú
        if (!povodna && window.DpbOdpocinok && window.RAW && window.appState) {
          try {
            var ok = window.DpbOdpocinok.okno2(window.DpbOdpocinok.praceVodica(window.RAW.models, window.appState.currentDriver), ctx.date);
            var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
            var hh = function (m) { return hm(m).replace(/^0/, ""); };
            var vyp = [], poznamka = "";
            var nastupPo = ok.nastupPo != null && ok.nastupPo > 0 && ok.nastupPo < 1440 ? ok.nastupPo : null;
            var koncDo = ok.ukoncenieDo != null && ok.ukoncenieDo > 0 && ok.ukoncenieDo < 1440 ? ok.ukoncenieDo : null;
            var preco = "Aby si mal dosť voľna.";
            if (ok.nemozne) poznamka = "V tento deň službu urobiť nemôžeš.|Nezostal by ti dosť voľna.";
            else if (ok.plny) { /* len denný odpočinok, nižšie */ }
            else if (ok.ina) { poznamka = "V tento deň je možná len kratšia služba, napríklad od " + hh(ok.ina.od) + " do " + hh(ok.ina.do) + ".|" + preco; nastupPo = null; koncDo = null; }
            else if (ok.poobedna && ok.ranna) {
              poznamka = (ok.ranna.do > ok.poobedna.od ? "Službu môžeš mať od " + hh(ok.poobedna.od) + " do " + hh(ok.ranna.do) + "." : "Službu môžeš mať len do " + hh(ok.ranna.do) + " alebo až od " + hh(ok.poobedna.od) + ".") + "|" + preco;
              nastupPo = null; koncDo = null;
            } else if (ok.poobedna) { nastupPo = ok.poobedna.od; poznamka = "Službu môžeš mať najskôr od " + hh(ok.poobedna.od) + ".|" + preco; }
            else if (ok.ranna) { koncDo = ok.ranna.do; nastupPo = ok.nastupPo > 0 ? ok.nastupPo : null; poznamka = "Službu môžeš mať najneskôr do " + hh(ok.ranna.do) + ".|" + preco; }
            if (!ok.nemozne) {
              if (nastupPo != null) { ch.cas(0, hm(nastupPo)); vyp.push("nástup po " + hh(nastupPo)); }
              if (koncDo != null) { ch.cas(1, hm(koncDo)); vyp.push("ukončenie do " + hh(koncDo)); }
              if (nastupPo != null && nastupPo >= 10 * 60) ch.zaskrtni("kedy", "Poobedná");
              else if (koncDo != null && koncDo <= 16 * 60) ch.zaskrtni("kedy", "Ranná");
            }
            if (poznamka) {
              var cz = poznamka.split("|"), blok = el("div", "margin-bottom:8px");
              blok.appendChild(el("div", "font-size:15px;font-weight:600;color:" + (ok.nemozne ? "var(--chyba)" : "var(--text)"), cz[0]));
              if (cz[1]) blok.appendChild(el("div", "font-size:13px;color:var(--text-2)", cz[1]));
              ch.box.insertBefore(blok, ch.box.children[1]);
            }
          } catch (e) {}
        }
        t.appendChild(ch.box); t.appendChild(nch.box);
        var pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:44px;height:44px"); pz.placeholder = "Poznámka (nepovinné)";
        t.appendChild(pz);
        var chyba = chybaPole();
        t.appendChild(chyba);
        ziadostSluzby._z = function () {
          ziadostSluzby._prazdne = false;
          var a = ch.zber(), b = nch.zber();
          if (a.chyba || b.chyba) { chyba.textContent = a.chyba || b.chyba; return null; }
          var pa = popisSkupiny(a), pb = popisSkupiny(b);
          if (!pa && !pb) { ziadostSluzby._prazdne = true; chyba.textContent = "Vyplň aspoň jednu vec: čo chceš alebo nechceš."; return null; }
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
  // Štyri bloky: Stav, Časy služby, Vozidlá, Zácvik (+ hradenie pri 944). Zaškrtneš, čo reklamuješ, a doplníš správnu hodnotu.
  var STAVY = ["Služba", "Dovolenka", "PN", "Lekár", "Voľno", "Iné"];
  function reklamacia(ctx) {
    var sv = ctx.service || null, k = (sv && sv._karta) || {};
    var vzor = sv ? sv._vzor : "";
    var jeSluzba = ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].indexOf(vzor) >= 0;
    var popisKarty = !sv ? "Voľno" : (vzor === "NEPRÍTOMNOSŤ" ? (k.popis || "Neprítomnosť") : (sv.line || "") + (sv.time ? " · " + sv.time : ""));
    var stavTeraz = jeSluzba ? "prítomnosť na " + (sv.line || "službe") : popisKarty;
    var casTeraz = (k.od && k.do) ? DPBData.fmt(k.od) + " – " + DPBData.fmt(k.do) : "";
    var vozy = [];
    ((k.vozidla) || []).forEach(function (x) { var c = x && (x.cislo || x); if (c && vozy.indexOf(String(c)) < 0) vozy.push(String(c)); });
    if (!vozy.length && sv && sv.vehicle && sv.vehicle !== "—") vozy.push(String(sv.vehicle));
    // údaje z karty na predvyplnenie: číslo + časy pridelenia (HH:MM)
    function hm(x) { var m = /^(\d{1,2}):(\d{2})/.exec(String(x || "")); return m ? (m[1].length < 2 ? "0" : "") + m[1] + ":" + m[2] : ""; }
    var vozRiadky = [];
    ((k.vozidla) || []).forEach(function (x) { var c = x && (x.cislo || x); if (c) vozRiadky.push({ c: String(c), od: hm(x.od), "do": hm(x["do"]) }); });
    if (!vozRiadky.length && vozy.length) vozRiadky.push({ c: vozy[0], od: "", "do": "" });
    var CHYBA = "font-size:15px;color:var(--text-2);margin-bottom:3px";
    function cas() { var i = el("input", VSTUP_CSS + ";padding:10px 6px"); i.type = "time"; return i; }
    function stlpec(popis, prvok) { var w = el("div", "flex:1;min-width:0"); w.appendChild(el("div", CHYBA, popis)); w.appendChild(prvok); return w; }
    var bloky = [];
    otvor({
      titul: "Reklamácia dňa " + kratko(ctx.date),
      podtitul: "Čo chceš reklamovať?",
      telo: function (t) {
        function blok(id, titul, teraz) {
          var w = el("div", "border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:10px");
          var h = el("label", "display:flex;align-items:center;gap:12px;cursor:pointer");
          var cb = el("input", "width:24px;height:24px;accent-color:var(--red);flex-shrink:0"); cb.type = "checkbox";
          var tx = el("div", "flex:1;min-width:0");
          tx.appendChild(el("div", "font-size:16px;font-weight:700", titul));
          if (teraz) tx.appendChild(el("div", "font-size:15px;color:var(--text-2)", "Aktuálne: " + teraz));
          h.appendChild(cb); h.appendChild(tx); w.appendChild(h);
          var telo = el("div", "display:none;margin-top:10px"); w.appendChild(telo);
          cb.addEventListener("change", function () { telo.style.display = cb.checked ? "block" : "none"; w.style.borderColor = cb.checked ? "var(--red)" : "var(--border)"; });
          t.appendChild(w);
          var b = { id: id, titul: titul, teraz: teraz, cb: cb, telo: telo };
          bloky.push(b); return b;
        }
        // 1. Stav
        var bs = blok("stav", "Stav", stavTeraz);
        var sel = el("select", VSTUP_CSS + ";margin-bottom:8px");
        sel.appendChild(el("option", "", "— správny stav —")).value = "";
        STAVY.forEach(function (x) { var o = el("option", "", x); o.value = x; sel.appendChild(o); });
        var sluz = el("input", VSTUP_CSS); sluz.type = "text"; sluz.placeholder = "Správna služba (napr. 3/17)";
        bs.telo.appendChild(sel); bs.telo.appendChild(sluz);
        bs.zber = function () {
          if (!sel.value && !sluz.value.trim()) return { chyba: "Pri Stave vyber správny stav alebo napíš správnu službu." };
          return { r: ["Stav: v systéme " + stavTeraz + ", správne " + [sel.value, sluz.value.trim()].filter(Boolean).join(", ")] };
        };
        if (jeSluzba) {
          // 2. Časy služby – dva zaškrtávacie stĺpce vedľa seba
          var bc = blok("casy", "Časy služby", casTeraz);
          var rc = el("div", "display:flex;gap:10px");
          var cas2 = [];
          [["Nástup", k.od], ["Ukončenie", k.do]].forEach(function (x) {
            var w = el("div", "flex:1;min-width:0");
            var l = el("label", "display:flex;align-items:center;gap:8px;font-size:15px;margin-bottom:4px;cursor:pointer");
            var c = el("input", "width:20px;height:20px;accent-color:var(--red)"); c.type = "checkbox";
            l.appendChild(c); l.appendChild(el("span", "", x[0]));
            var i = cas(); i.disabled = true; i.style.opacity = ".5";
            c.addEventListener("change", function () { i.disabled = !c.checked; i.style.opacity = c.checked ? "1" : ".5"; });
            w.appendChild(l); w.appendChild(i); rc.appendChild(w);
            cas2.push({ n: x[0], t: x[1], c: c, i: i });
          });
          bc.telo.appendChild(rc);
          bc.zber = function () {
            var r = [];
            for (var q = 0; q < cas2.length; q++) {
              if (!cas2[q].c.checked) continue;
              if (!cas2[q].i.value) return { chyba: "Pri časoch doplň správny čas (" + cas2[q].n + ")." };
              r.push(cas2[q].n + ": v systéme " + (cas2[q].t ? DPBData.fmt(cas2[q].t) : "—") + ", správne " + cas2[q].i.value);
            }
            return r.length ? { r: r } : { chyba: "Pri časoch zaškrtni Nástup alebo Ukončenie." };
          };
          // 3. Vozidlá – riadky: vozidlo + od + do, dole „+ Pridať vozidlo“
          var bv = blok("vozidla", vozy.length > 1 ? "Vozidlá" : "Vozidlo", vozy.length ? vozy.join(", ") : "žiadne");
          var riadky = [], zoz = el("div", "");
          function riadokVoz(pre) {
            var v = el("input", VSTUP_CSS + ";padding:10px 8px"); v.type = "text"; v.placeholder = "Číslo";
            var r = el("div", "display:flex;gap:8px;margin-bottom:8px");
            var o = { v: v, od: cas(), "do": cas() };
            [["Vozidlo", v, 1.1], ["Od", o.od, 1], ["Do", o["do"], 1]].forEach(function (x) { var c = stlpec(x[0], x[1]); c.style.flex = String(x[2]); r.appendChild(c); });
            if (pre && typeof pre === "object") { v.value = pre.c; o.od.value = pre.od; o["do"].value = pre["do"]; }
            riadky.push(o); zoz.appendChild(r);
          }
          if (vozRiadky.length) vozRiadky.forEach(riadokVoz); else riadokVoz();
          var plus = el("button", "padding:9px 14px;border-radius:10px;border:1px dashed var(--border);background:transparent;color:var(--text-1);font-size:15px;cursor:pointer", "+ Pridať vozidlo");
          plus.type = "button"; plus.addEventListener("click", function () { riadokVoz(); });
          bv.telo.appendChild(zoz); bv.telo.appendChild(plus);
          bv.zber = function () {
            var r = [];
            riadky.forEach(function (o) {
              var c = o.v.value.trim(); if (!c && !o.od.value && !o["do"].value) return;
              r.push("Vozidlo " + (c || "?") + (o.od.value || o["do"].value ? " (" + (o.od.value || "?") + " – " + (o["do"].value || "?") + ")" : ""));
            });
            if (!r.length) return { chyba: "Pri vozidle doplň číslo a časy." };
            return { r: ["Vozidlá: v systéme " + (vozy.join(", ") || "žiadne") + "; správne " + r.join(", ")] };
          };
          // 3b. Hradenie (len 944)
          if (vzor === "944") {
            var bh = blok("hradenie", "Chýbajúce hradenie", "");
            var th = el("input", VSTUP_CSS); th.type = "text"; th.placeholder = "Čo chýba (kurz, vozidlo, čas)";
            bh.telo.appendChild(th);
            bh.zber = function () { return th.value.trim() ? { r: ["Chýbajúce hradenie: " + th.value.trim()] } : { chyba: "Pri hradení doplň, čo chýba." }; };
          }
          // 4. Zácvik
          if (vzor !== "STRIEDAČ") {
            var bz = blok("zacvik", "Chýbajúci vykonaný zácvik", "");
            var meno = el("input", VSTUP_CSS + ";margin-bottom:8px"); meno.type = "text"; meno.placeholder = "Meno zacvičovaného";
            var zr = el("div", "display:flex;gap:10px"); var zo = cas(), zd = cas();
            zr.appendChild(stlpec("Od", zo)); zr.appendChild(stlpec("Do", zd));
            bz.telo.appendChild(meno); bz.telo.appendChild(zr);
            bz.zber = function () {
              if (!meno.value.trim()) return { chyba: "Pri zácviku doplň meno zacvičovaného." };
              return { r: ["Zácvik: " + meno.value.trim() + (zo.value || zd.value ? " (" + (zo.value || "?") + " – " + (zd.value || "?") + ")" : "")] };
            };
          }
        }
        var pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:56px"); pz.placeholder = "Poznámka (nepovinné)";
        t.appendChild(pz);
        var chyba = chybaPole();
        t.appendChild(chyba);
        reklamacia._z = function () {
          var r = [];
          for (var i = 0; i < bloky.length; i++) {
            if (!bloky[i].cb.checked) continue;
            var x = bloky[i].zber();
            if (x.chyba) { chyba.textContent = x.chyba; return null; }
            r = r.concat(x.r);
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
        prvky[k].style.fontWeight = on ? "700" : "400";
        prvky[k].style.borderColor = on ? "var(--red)" : "var(--border)";
        prvky[k].classList.toggle("chip-on", on);
        prvky[k].textContent = (on ? "✓ " : "") + k;
      });
    }
    moznosti.forEach(function (m) {
      var c = el("button", "padding:9px 14px;border-radius:18px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:15px;cursor:pointer", m);
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
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-bottom:6px", "Čo nahlasuješ?"));
        var co = chipy(t, ["Porucha", "Udalosť"], true, function (v) { vozBox.style.display = v["Porucha"] && voz.length > 1 ? "block" : "none"; });
        var vozBox = el("div", "display:none;margin:-4px 0 12px");
        vozBox.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-bottom:3px", "Ktoré vozidlo?"));
        var vsel = el("select", VSTUP_CSS);
        voz.forEach(function (x) { var o = el("option", "", x); o.value = x; vsel.appendChild(o); });
        vozBox.appendChild(vsel); t.appendChild(vozBox);
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-bottom:6px", "Komu hlásiš?"));
        var komu = chipy(t, ["Dielňa", "Dispečing", "Výpravňa"], false);
        var tx = el("textarea", VSTUP_CSS + ";resize:none;min-height:80px"); tx.placeholder = "Popis (čo sa stalo)";
        t.appendChild(tx);
        var chyba = chybaPole();
        t.appendChild(chyba);
        nahlasit._z = function () {
          var c = co(), kk = komu();
          if (!c.length) { chyba.textContent = "Vyber, čo nahlasuješ."; return null; }
          if (!kk.length) { chyba.textContent = "Vyber, komu hlásiš."; return null; }
          if (!tx.value.trim()) { chyba.textContent = "Doplň popis."; return null; }
          return { co: c[0], komu: kk, popis: tx.value.trim(), voz: c[0] === "Porucha" ? (voz.length > 1 ? vsel.value : (voz[0] || "")) : "" };
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

  // Žiadosti z menu karty: jedno okno so záložkami „Zmena stavu“ | „Zmena služby“.
  // Zmena stavu: zoznam typov, po ťuknutí sa rozbalí formulár (Od/Do + kalendár) priamo v okne.
  // Dole: Odoslať žiadosť | Zrušiť. (Vrstvenie viacerých žiadostí sa môže doplniť neskôr.)
  var TYPY_STAVU = [
    { kod: "dovolenka", nazov: "Dovolenka", doPovinne: true },
    { kod: "pn", nazov: "PN", doPovinne: false, nepovinneOd: true },
    { kod: "lekar", nazov: "Lekár", jenDen: true },
    { kod: "volno", nazov: "Voľno", doPovinne: true },
    { kod: "ine", nazov: "Iné", doPovinne: true, poznamka: true },
  ];
  function stavPanel(ctx, zmena) {
    var kor = el("div", "");
    var riadky = [], otvorene = null, aktivny = null;
    TYPY_STAVU.forEach(function (ty) {
      var r = el("div", "margin-bottom:8px;border-radius:14px;background:var(--surface-2);overflow:hidden");
      var h = el("button", "display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px 16px;background:none;border:0;color:var(--text-1);font-size:16px;font-weight:600;cursor:pointer;text-align:left");
      h.type = "button";
      var nz = el("span", "", ty.nazov);
      var sip = el("span", "color:var(--text-3);font-size:20px;transition:transform .15s", "›");
      h.appendChild(nz); h.appendChild(sip);
      var telo = el("div", "display:none;padding:0 14px 14px");
      var f = null;
      function postav() {
        var roz = rozsahDatumov(ctx.date, { doPovinne: ty.doPovinne, jenDen: ty.jenDen, nepovinneOd: ty.nepovinneOd });
        telo.appendChild(roz.el);
        var pz = null;
        if (ty.poznamka) {
          telo.appendChild(el("div", "font-size:15px;color:var(--text-2);margin:12px 0 4px", "Popis dôvodu"));
          pz = el("textarea", VSTUP_CSS + ";resize:none;min-height:70px"); telo.appendChild(pz);
        }
        if (ty.kod === "pn") telo.appendChild(el("div", "font-size:14px;color:var(--text-2);margin-top:10px", "Zadaj začiatok PN, koniec PN, alebo oboje (aspoň jedno)."));
        f = { zber: function () {
          var od = roz.od(), dod = roz.do();
          if (ty.nepovinneOd) {
            if (!od && !dod) return { chyba: "Zadaj začiatok alebo koniec (aspoň jeden)." };
          } else if (!od) return { chyba: "Zadaj dátum." };
          if (ty.doPovinne && !dod) return { chyba: "Zadaj koniec." };
          if (od && dod && dod < od) return { chyba: "Koniec nemôže byť pred začiatkom." };
          if (pz && !pz.value.trim()) return { chyba: "Popíš dôvod." };
          return { polozka: { t: "stav", kind: ty.kod, nazov: ty.nazov, od: od, do: dod || "", poznamka: pz ? pz.value.trim() : "" } };
        } };
      }
      h.addEventListener("click", function () {
        var chcem = otvorene !== r;
        riadky.forEach(function (x) { x.telo.style.display = "none"; x.sip.style.transform = ""; x.r.style.boxShadow = ""; });
        otvorene = null; aktivny = null;
        if (chcem) {
          if (!f) postav();
          telo.style.display = "block"; sip.style.transform = "rotate(90deg)"; r.style.boxShadow = "inset 0 0 0 2px var(--red)";
          otvorene = r; aktivny = f;
        }
        zmena && zmena();
      });
      r.appendChild(h); r.appendChild(telo); kor.appendChild(r);
      riadky.push({ r: r, telo: telo, sip: sip });
    });
    return { el: kor, zber: function () { return aktivny ? aktivny.zber() : null; } };
  }

  function ziadostiZalozky(service) {
    var ctx = { date: service.date, service: service };
    var rid = window.appState && window.appState.currentDriver;
    var povodna = service._vzor !== "NEPRÍTOMNOSŤ" ? (service.line || "") + (service.time ? " · " + service.time : "") : "";
    var kosik = [], mod = "a", tab = 0, panel = null;
    function popis(p) {
      if (p.t === "sluzba") return "Zmena služby (" + kratko(ctx.date) + "): " + [p.ch ? "chcem " + p.ch : "", p.nch ? "nechcem " + p.nch : ""].filter(Boolean).join("; ") + (p.poz ? " – " + p.poz : "");
      var d = p.kind === "lekar" ? kratko(p.od) : (p.do ? (p.do === p.od ? kratko(p.od) : kratko(p.od) + " – " + kratko(p.do)) : kratko(p.od) + " – zatiaľ neznáme");
      return p.nazov + ": " + d + (p.poznamka ? " – " + p.poznamka : "");
    }
    function text(polozky) {
      if (polozky.length === 1) {
        var p = polozky[0];
        if (p.t === "stav") return { nad: "Žiadosť o zmenu stavu", txt: spravaText(ctx, p) };
        var r = ["Žiadosť o zmenu služby", "Vodič: " + (menoVodica(rid) || "—") + " (os. č. " + rid + ")", "Dátum: " + kratko(ctx.date)];
        if (povodna) r.push("Terajšia služba: " + povodna);
        if (p.ch) r.push("Chcem: " + p.ch);
        if (p.nch) r.push("Nechcem: " + p.nch);
        if (p.poz) r.push("Poznámka: " + p.poz);
        return { nad: "Žiadosť o zmenu služby", txt: r.join("\n") };
      }
      var l = ["Žiadosť – viac položiek", "Vodič: " + (menoVodica(rid) || "—") + " (os. č. " + rid + ")", "Z karty dňa: " + kratko(ctx.date) + (povodna ? " · " + povodna : ""),
        mod === "a" ? "Spôsob: VŠETKO SPOLU (žiadam všetky položky)" : "Spôsob: JEDNA Z UVEDENÝCH (v poradí podľa preferencie, 1 = najradšej)"];
      polozky.forEach(function (p, i) { l.push((i + 1) + ") " + popis(p)); });
      return { nad: "Žiadosť – viac položiek", txt: l.join("\n") };
    }
    // Aktuálne služby z dňa karty (alebo neprítomnosť / voľno)
    var dnesne = [];
    try {
      var sd = (window.appState && window.appState.servicesByDate && window.appState.servicesByDate[ctx.date]) || [service];
      sd.forEach(function (x) {
        if (!x || x._vzor === "NEPRÍTOMNOSŤ") return;
        var u = (x.line || "") + (x.time ? " · " + x.time : "");
        if (u && dnesne.indexOf(u) < 0) dnesne.push(u);
      });
    } catch (e) {}
    var kk = (service && service._karta) || {};
    var aktualne = dnesne.length ? dnesne.join(", ") : (service && service._vzor === "NEPRÍTOMNOSŤ" ? (kk.popis || "neprítomnosť") : "voľno");
    otvor({
      titul: "Žiadosť na " + pekne(ctx.date),
      podtitul: "Aktuálne: " + aktualne,
      telo: function (t) {
        var lista = el("div", "display:flex;border-bottom:2px solid var(--border-2);margin-bottom:12px");
        var obsah = el("div", "");
        var chyba = chybaPole();
        var tl = el("div", "display:flex;gap:8px;margin-top:10px;position:sticky;bottom:0;padding:10px 0 2px;background:var(--surface);z-index:2");
        var btns = [];
        function aktualna() {
          if (!panel) return null;
          if (tab === 0) return panel.zber();
          var z = ziadostSluzby._z ? ziadostSluzby._z() : null;
          if (z) return { polozka: { t: "sluzba", ch: z.ch, nch: z.nch, poz: z.poz } };
          return ziadostSluzby._prazdne ? null : { chyba: "" };
        }
        function zostav() {
          obsah.innerHTML = ""; chyba.textContent = "";
          if (tab === 0) { panel = stavPanel(ctx, function () { chyba.textContent = ""; }); obsah.appendChild(panel.el); }
          else {
            panel = {};
            var z = { telo: obsah };
            zachyt = z;
            try { ziadostSluzby({ date: ctx.date, service: service, zmena: true }); } finally { zachyt = null; }
          }
        }
        function ukaz(i) {
          tab = i;
          btns.forEach(function (b, j) {
            b.style.color = j === i ? "var(--red)" : "var(--text-2)";
            b.style.borderBottom = j === i ? "3px solid var(--red)" : "3px solid transparent";
          });
          zostav();
        }
        var _mozeZS = !window.DpbPrava || window.DpbPrava.moze("zmena_sluzby");
        (_mozeZS ? ["Zmena stavu", "Zmena služby"] : ["Zmena stavu"]).forEach(function (n, i) {
          var b = el("button", "flex:1;padding:12px 6px;background:none;border:0;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:-2px", n);
          b.type = "button";
          b.addEventListener("click", function () { ukaz(i); });
          btns.push(b); lista.appendChild(b);
        });
        function tlacidlo(txt, primarny, klik) {
          var b = el("button", "flex:1;padding:13px 6px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;" + (primarny ? "background:var(--red);color:#fff" : "background:var(--surface-2);color:var(--text-1)"), txt);
          b.type = "button";
          b.addEventListener("click", klik);
          tl.appendChild(b);
        }
        function overPn(pol) {
          if (pol.length > 1 && pol.some(function (p) { return p.kind === "pn"; })) { chyba.textContent = "PN sa nahlasuje samostatne – nedá sa spojiť s inými žiadosťami."; return false; }
          return true;
        }
        tlacidlo("Odoslať žiadosť", true, function () {
          var cur = aktualna(), pol = kosik.slice();
          if (cur && cur.chyba != null && !cur.polozka) { if (cur.chyba) chyba.textContent = cur.chyba; return; }
          if (cur && cur.polozka) pol.push(cur.polozka);
          if (!pol.length) { chyba.textContent = "Vyber, čo žiadaš."; return; }
          if (!overPn(pol)) return;
          var x = text(pol);
          zavriVsetko();
          odosli(x.txt, x.nad);
        });
        tlacidlo("Zrušiť", false, zavriVsetko);
        if (_mozeZS) t.appendChild(lista);
        t.appendChild(obsah); t.appendChild(chyba); t.appendChild(tl);
        ukaz(0);
      },
    });
  }
  window.DpbZiadosti = { otvor: ziadostiZalozky };
  window.DpbOkna = { otvor: otvor, zavriVrch: zavriVrch, zavriVsetko: zavriVsetko, pocet: function () { return okna.length; } };
  window.DpbZmenaStavu = { otvor: otvorZmenuStavu, _text: spravaText, ukaz: odosli };
  window.DpbZiadostSluzby = { otvor: ziadostSluzby };
  window.DpbReklamacia = { otvor: reklamacia };
  window.DpbNahlasit = { otvor: nahlasit };
})();
