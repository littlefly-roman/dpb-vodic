/* Trojica ikon (trolejbus – električka – autobus) nad logom DPB.
   Ikony sa otáčajú ako na kolotoči: každá sa postupne dostane dopredu, prekryje
   ostatné a nakoniec zostane v strede (zväčšená) ikona vybraného druhu dopravy.
   Mód: "elektricka" (teraz), "autobus" alebo "trolejbus".
   Zmena módu: DpbIkony.nastavMod("autobus");  (alebo PREDVOLENY_MOD nižšie)
   DpbIkony.prehraj()      – prehrá úvodné roztočenie (dobehne do pokoja)
   DpbIkony.nacitava(true) – točí sa stále (nahrávanie dát), false = dobehne do pokoja */
(function () {
  var PREDVOLENY_MOD = "elektricka";
  var PORADIE = ["trolejbus", "elektricka", "autobus"]; // zľava doprava v pokoji
  var NAZVY = { trolejbus: "Trolejbus", elektricka: "Električka", autobus: "Autobus" };
  var POMER = { trolejbus: 171 / 231, elektricka: 142 / 231, autobus: 171 / 175 };

  var V_ZADNA = 46, V_PREDNA = 80; // výška ikony vzadu / vpredu (px)
  var POLOMER = 42;                // polomer kolotoča (px)
  var INTRO_MS = 1900, SETTLE_MS = 1000, TURN_MS = 2400;

  // Kód TYPDOPRAVY z CSV -> mód: A = električka, T = autobus, O = trolejbus
  var KODY_TYPU = { A: "elektricka", T: "autobus", O: "trolejbus" };

  var mod = PREDVOLENY_MOD;
  // Pozor: systémové „vypnúť animácie“ (Windows) tu úmyselne nerešpektujeme – ide o krátku
  // úvodnú animáciu značky. Ak by ju chcel niekto vypnúť, stačí dať reduced = true.
  var reduced = false;

  var kolotoce = []; // {el, items:[{el,druh,base}], off, ...}

  function ikona(druh) {
    var s = document.createElement("span");
    s.className = "mod-ikona druh-" + druh;
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", NAZVY[druh]);
    s.style.setProperty("--ik", "url(img/doprava/" + druh + ".png)");
    s.style.setProperty("--ik-podklad", "url(img/doprava/" + druh + "-podklad.png)");
    return s;
  }

  // Uhly v pokoji: vybraný druh = 0° (vpredu v strede), ostatné ±120°
  function zaklad(druh) {
    var boky = PORADIE.filter(function (d) { return d !== mod; });
    if (druh === mod) return 0;
    return druh === boky[0] ? -120 : 120;
  }

  function poloz(k) {
    k.items.forEach(function (it) {
      var a = ((it.base + k.off) * Math.PI) / 180;
      var t = (Math.cos(a) + 1) / 2; // 1 = celkom vpredu, 0 = celkom vzadu
      var h = V_ZADNA + (V_PREDNA - V_ZADNA) * t;
      var x = POLOMER * Math.sin(a);
      var st = it.el.style;
      st.setProperty("--h", h.toFixed(2) + "px");
      st.setProperty("--op", (0.6 + 0.4 * t).toFixed(3));
      st.zIndex = String(Math.round(t * 20));
      st.transform = "translateX(calc(-50% + " + x.toFixed(2) + "px))";
    });
  }

  function vykresli(k) {
    k.el.innerHTML = "";
    k.el.setAttribute("data-mod", mod);
    k.items = PORADIE.map(function (d) {
      var e = ikona(d);
      k.el.appendChild(e);
      return { el: e, druh: d, base: zaklad(d) };
    });
    poloz(k);
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); } // dobieha pomaly do pokoja

  function spusti(k, tvar) {
    if (k.raf) cancelAnimationFrame(k.raf);
    if (reduced) { k.off = 0; k.beziVSmycke = false; poloz(k); return; }
    var t0 = performance.now(), z = k.off;
    if (tvar.typ === "intro") {
      // celé kolo dozadu a dobehnutie do pokoja
      z = -360; k.off = z;
    }
    var cielOff = tvar.typ === "smycka" ? null : Math.ceil(z / 360 - 1e-9) * 360 + (tvar.typ === "settle" ? 0 : 0);
    if (tvar.typ === "intro") cielOff = 0;
    var trvanie = tvar.typ === "intro" ? INTRO_MS : SETTLE_MS;
    var smerRychlost = 360 / TURN_MS; // °/ms
    var minulyCas = t0;

    function krok(now) {
      if (tvar.typ === "smycka") {
        k.off += (now - minulyCas) * smerRychlost; minulyCas = now;
        poloz(k); k.raf = requestAnimationFrame(krok); return;
      }
      var p = Math.min(1, (now - t0) / trvanie);
      k.off = z + (cielOff - z) * ease(p);
      poloz(k);
      if (p < 1) k.raf = requestAnimationFrame(krok);
      else { k.off = 0; poloz(k); k.raf = 0; }
    }
    k.raf = requestAnimationFrame(krok);
    k.smycka = tvar.typ === "smycka";
  }

  function pokoj(k) {
    // dobehne do najbližšieho pokoja (násobok 360°) – vždy ešte aspoň kúsok dopredu
    var cielOff = Math.ceil((k.off + 120) / 360) * 360;
    if (k.raf) cancelAnimationFrame(k.raf);
    if (reduced) { k.off = 0; poloz(k); return; }
    var z = k.off, t0 = performance.now(), trv = SETTLE_MS + 400;
    function krok(now) {
      var p = Math.min(1, (now - t0) / trv);
      k.off = z + (cielOff - z) * ease(p);
      poloz(k);
      if (p < 1) k.raf = requestAnimationFrame(krok);
      else { k.off = 0; poloz(k); k.raf = 0; }
    }
    k.raf = requestAnimationFrame(krok);
  }

  function viditelny(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  function vsetky(fn) { kolotoce.forEach(fn); }

  function init() {
    var els = document.querySelectorAll(".mod-ikony");
    kolotoce = [];
    for (var i = 0; i < els.length; i++) {
      var k = { el: els[i], items: [], off: 0, raf: 0, smycka: false };
      kolotoce.push(k);
      vykresli(k);
      // klik/ťuk na ikony = roztočí kolotoč znova (nie počas nahrávania dát)
      (function (k) {
        k.el.addEventListener("click", function () {
          if (!k.smycka) spusti(k, { typ: "intro" });
        });
      })(k);
    }
    // úvodné roztočenie na obrazovke, ktorá je práve vidieť
    vsetky(function (k) { if (viditelny(k.el)) spusti(k, { typ: "intro" }); });
  }

  window.DpbIkony = {
    nastavMod: function (m) {
      if (!NAZVY[m]) return;
      mod = m;
      vsetky(function (k) { vykresli(k); spusti(k, { typ: "intro" }); });
    },
    kody: KODY_TYPU,
    mod: function () { return mod; },
    // Nastaví mód podľa kódu TYPDOPRAVY (neznámy kód mód nemení)
    nastavPodlaKodu: function (kod) {
      var m = KODY_TYPU[String(kod || "").trim().toUpperCase()];
      if (m && m !== mod) this.nastavMod(m);
    },
    prehraj: function () {
      vsetky(function (k) { if (viditelny(k.el)) spusti(k, { typ: "intro" }); });
    },
    nacitava: function (zap) {
      vsetky(function (k) {
        if (!viditelny(k.el)) return;
        k.el.classList.toggle("nacitava", !!zap);
        if (zap) spusti(k, { typ: "smycka" });
        else if (k.smycka) { k.smycka = false; pokoj(k); }
      });
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
