/* Odpočet do odchodu z konečnej (zvonček v pruhu spoja v grafikone kurzu).
   Ťuknutie na zvonček otvorí okno s odpočtom, zapne zvuk a zapnutú obrazovku. Zatvorenie okna odpočet nevypne –
   v pruhu spoja ostane zvonček so živým časom. Stupne: 2:00 (1 pípnutie), 1:30 (2), 1:00 (3), 0:30 (4), čas odchodu (poplach) (zvuk + vibrácia).
   Funguje len pri otvorenej appke so zapnutou obrazovkou; čas je podľa grafikonu (bez meškania). */
(function () {
  "use strict";
  // Predstih (sekundy pred časom), po typoch upozornenia: konečná (zvonček), prestávka, ostatné (dlhé podržanie riadku)
  var DEF_PREDSTIH = { konecna: [180, 120, 90, 60, 30, 0], prestavka: [120, 60, 30], striedanie: [120, 60], ostatne: [60] };
  var NAST = { zvuk: true, vibr: false, predstih: {} };   // predvolene len zvuk
  Object.keys(DEF_PREDSTIH).forEach(function (k) { NAST.predstih[k] = DEF_PREDSTIH[k].slice(); });
  try {
    var u = JSON.parse(localStorage.getItem("dpb-odpocet") || "null");
    if (u) {
      if (typeof u.zvuk === "boolean") NAST.zvuk = u.zvuk;
      if (typeof u.vibr === "boolean") NAST.vibr = u.vibr;
      if (u.predstih) Object.keys(DEF_PREDSTIH).forEach(function (k) {
        if (Array.isArray(u.predstih[k])) NAST.predstih[k] = u.predstih[k].filter(function (x) { return typeof x === "number"; });
      });
    }
  } catch (e) {}
  var TYP_NAZOV = { konecna: "Odchod z konečnej", prestavka: "Prestávka", striedanie: "Striedanie", ostatne: "Ostatné časy" };
  function uloz() { try { localStorage.setItem("dpb-odpocet", JSON.stringify(NAST)); } catch (e) {} }

  var plan = null;         // plán dňa: { d, items:[{cas,nazov,typ,pop,kind}], skip:{} }
  var planTik = null;
  var akt = null;          // { key, dep (s od polnoci), nazov, cas, spustene:{120,60,30,0} }
  var tik = null, wl = null, ctx = null, ov = null;

  var IK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  function sekHms(t) {
    var p = String(t || "").split(":");
    return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
  }
  function teraz() { var n = new Date(); return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() + n.getMilliseconds() / 1000; }
  // zostáva sekúnd do odchodu (odchod krátko po polnoci počas večera = zajtra)
  function zostava(dep) {
    var n = teraz(), d = dep;
    if (d < 4 * 3600 && n > 12 * 3600) d += 86400;
    return d - n;
  }
  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
  }

  // ── zvuk (Web Audio, bez súborov) ──
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // Hlasný signál: pravouhlá vlna (veľa energie v oblasti 1–3 kHz, kde sú malé reproduktory najsilnejšie), plná hlasitosť
  function tón(f, t0, dur, vol) {
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.value = f;
    var a = c.currentTime + t0;
    g.gain.setValueAtTime(0.0001, a);
    g.gain.linearRampToValueAtTime(vol, a + 0.01);
    g.gain.setValueAtTime(vol, a + Math.max(0.02, dur - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, a + dur);
    o.connect(g); g.connect(c.destination);
    o.start(a); o.stop(a + dur + 0.05);
  }
  // Stupne podľa počtu pípnutí: 2:00 → 1, 1:30 → 2, 1:00 → 3, 0:30 → 4, odchod → poplach
  function pipni(n, f, vol) {
    // jedno „pípnutie“ = dva veľmi krátke tóny v čase pôvodného jedného dlhého
    return function () { for (var k = 0; k < n; k++) { tón(f, k * 0.4, 0.09, vol); tón(f, k * 0.4 + 0.15, 0.09, vol); } };
  }
  function vibrN(n) {
    var a = []; for (var k = 0; k < n; k++) { if (k) a.push(110); a.push(200); } return a;
  }
  var STUPNE = {
    180: { zvuk: pipni(1, 1600, 0.8), vibr: vibrN(1) },
    120: { zvuk: pipni(1, 1800, 0.8), vibr: vibrN(1) },
    90: { zvuk: pipni(2, 1900, 0.85), vibr: vibrN(2) },
    60: { zvuk: pipni(3, 2000, 0.9), vibr: vibrN(3) },
    30: { zvuk: pipni(4, 2200, 1), vibr: vibrN(4) },
    // odchod: dlhý poplašný signál (striedavé tóny ~2 s)
    0: { zvuk: function () { for (var k = 0; k < 8; k++) tón(k % 2 ? 2200 : 1500, k * 0.26, 0.24, 1); }, vibr: [800, 150, 800, 150, 800] }
  };
  function spusti(st) {
    var s = STUPNE[st];
    if (NAST.zvuk) s.zvuk();
    if (NAST.vibr && navigator.vibrate) { try { navigator.vibrate(s.vibr); } catch (e) {} }
  }

  // ── obrazovka zapnutá ──
  function zapniObrazovku() {
    if (!navigator.wakeLock || wl) return;
    navigator.wakeLock.request("screen").then(function (l) {
      wl = l; l.addEventListener("release", function () { wl = null; });
    }).catch(function () {});
  }
  function vypniObrazovku() { if (wl) { try { wl.release(); } catch (e) {} wl = null; } }
  document.addEventListener("visibilitychange", function () { if ((akt || plan) && document.visibilityState === "visible") zapniObrazovku(); });

  // ── beh odpočtu ──
  function tikni() {
    if (!akt) return;
    var z = zostava(akt.dep);
    var set = NAST.predstih[akt.typ] || [];
    [180, 120, 90, 60, 30].forEach(function (st) {
      if (z <= st && !akt.spustene[st]) { akt.spustene[st] = 1; if (z > st - 5 && set.indexOf(st) >= 0) { spusti(st); if (akt.plan) otvorOkno(); } }
    });
    if (z <= 0 && !akt.spustene[0]) {
      akt.spustene[0] = 1;
      var zv = set.indexOf(0) >= 0;
      if (zv) { spusti(0); if (akt.plan) otvorOkno(); }
      setTimeout(vypni, zv ? 4000 : 300);
    }
    obnov();
  }
  function obnov() {
    var z = akt ? zostava(akt.dep) : 0;
    var t = akt ? fmt(z) : "";
    document.querySelectorAll(".odp-btn").forEach(function (b) {
      var je = akt && b.getAttribute("data-key") === akt.key;
      b.classList.toggle("odp-on", !!je);
      b.classList.toggle("odp-blizko", !!je && z <= 60);
      var s = b.querySelector(".odp-t");
      if (s) s.textContent = je ? t : "";
    });
    document.querySelectorAll(".odp-plan").forEach(function (b) {
      var kind = b.getAttribute("data-kind"), on = planJe(kind), sp = b.querySelector(".odp-pt");
      b.classList.toggle("odp-plan-on", on);
      if (!sp) return;
      if (!on) { sp.textContent = "Upozorniť"; return; }
      var n = planDalsi(kind);
      if (!n) { sp.textContent = "Hotovo"; return; }
      var m = Math.ceil(n.z / 60);
      sp.textContent = "Ďalšie " + n.item.cas.split(":").slice(0, 2).join(":") + " · " + (n.z < 60 ? "o <1 min" : "o " + m + " min");
    });
    var _sb = document.getElementById("profilSkuskaBtn"), _ss = document.getElementById("profilSkuskaStav");
    if (_sb) {
      var _on = planJe("skuska"), _n = _on ? planDalsi("skuska") : null;
      _sb.textContent = _on ? "Vypnúť skúšku" : "Vyskúšať upozornenia";
      if (_ss) _ss.textContent = !_on ? "–" : _n ? "Ďalšie " + fmt(_n.z) : "Hotovo";
    }
    // riadky cestovného poriadku s nastaveným upozornením (dlhé podržanie)
    document.querySelectorAll("[data-odp-key]").forEach(function (r) {
      var je = akt && r.getAttribute("data-odp-key") === akt.key;
      r.classList.toggle("odp-riadok", !!je);
      var sp = r.querySelector(":scope > .odp-rt");
      if (je) {
        if (!sp) {
          sp = document.createElement("span");
          sp.className = "odp-rt";
          sp.setAttribute("role", "button");
          sp.setAttribute("aria-label", "Zrušiť upozornenie");
          r.appendChild(sp);
        }
        sp.textContent = t + " \u00d7";
      } else if (sp) sp.remove();
    });
    if (ov) {
      var c = ov.querySelector(".odp-cislo"); if (c) { c.textContent = t; c.classList.toggle("odp-blizko", z <= 60); }
    }
  }
  function zapni(info) {
    audio(); // odblokuje zvuk (ťuknutie je gesto)
    var dep = sekHms(info.cas);
    var z = zostava(dep);
    var _pc = String(info.cas).split(":");
    akt = { key: info.key, dep: dep, nazov: info.nazov, cas: _pc[0] + ":" + (_pc[1] || "00"), typ: info.typ || "konecna", pop: info.pop || "", spustene: {} };
    [180, 120, 90, 60, 30].forEach(function (st) { if (z <= st) akt.spustene[st] = 1; });
    if (tik) clearInterval(tik);
    tik = setInterval(tikni, 250);
    zapniObrazovku();
    tikni();
  }
  function vypni() {
    if (akt && akt.plan && plan) { plan.skip[akt.planCas + "|" + akt.plan + "|" + akt.typ] = 1; planUloz(); }
    akt = null;
    if (tik) { clearInterval(tik); tik = null; }
    if (!plan) vypniObrazovku();
    zavriOkno();
    obnov();
  }

  // ── okno ──
  function zavriOkno() { if (ov) { ov.remove(); ov = null; } }
  function otvorOkno() {
    if (!akt || ov) return;
    ov = document.createElement("div");
    ov.setAttribute("data-spat-prekryv", "1");
    ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box";
    var wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;max-width:440px;display:flex;flex-direction:column";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;background:var(--surface);color:var(--text-1);border-radius:20px;width:100%;padding:22px 20px 20px;box-sizing:border-box;text-align:center";
    box.innerHTML =
      '<button type="button" class="odp-nast" aria-label="Nastavenia upozornenia" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>' +
      '<div style="font-size:15px;color:var(--text-3)">' + (akt.pop || "Odchod o") + ' ' + akt.cas + '</div>' +
      '<div style="font-size:17px;font-weight:700;margin:2px 0 6px;padding:0 36px">' + akt.nazov + '</div>' +
      '<div class="odp-cislo" style="font-size:72px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;margin:8px 0 14px"></div>' +
      '<button type="button" class="odp-vyp">' + (akt.plan ? "Preskočiť toto upozornenie" : "Vypnúť odpočet") + '</button>' +
      '<button type="button" class="odp-zat">Zavrieť (odpočet beží ďalej)</button>';
    var panel = document.createElement("div");
    panel.className = "odp-panel";
    var CHIPS = [[180, "3 min"], [120, "2 min"], [90, "1,5 min"], [60, "1 min"], [30, "30 s"], [0, "V čase"]];
    function pre() {
      var set = NAST.predstih[akt.typ] || [];
      panel.innerHTML =
        '<div class="odp-panel-in">' +
        '<div class="odp-panel-t">Nastavenia · ' + (TYP_NAZOV[akt.typ] || "") + '</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:14px">' +
        '<button type="button" class="odp-pre" data-p="zvuk"></button><button type="button" class="odp-pre" data-p="vibr"></button></div>' +
        '<div class="odp-panel-t">Upozorniť pred časom</div>' +
        '<div class="odp-chips">' + CHIPS.map(function (c) {
          return '<button type="button" class="odp-chip' + (set.indexOf(c[0]) >= 0 ? " odp-chip-on" : "") + '" data-st="' + c[0] + '" aria-pressed="' + (set.indexOf(c[0]) >= 0) + '">' + c[1] + '</button>';
        }).join("") + '</div>' +
        '<div class="odp-panel-h">Platí pre všetky upozornenia tohto typu.</div></div>';
      panel.querySelectorAll(".odp-pre").forEach(function (b) {
        var k = b.getAttribute("data-p");
        b.textContent = (k === "zvuk" ? "Zvuk: " : "Vibrácia: ") + (NAST[k] ? "zap." : "vyp.");
        b.classList.toggle("odp-pre-on", !!NAST[k]);
        if (k === "vibr" && !navigator.vibrate) { b.textContent = "Vibrácia: nedostupná"; b.disabled = true; }
        b.addEventListener("click", function () {
          NAST[k] = !NAST[k]; uloz(); pre();
          if (k === "zvuk" && NAST.zvuk) { audio(); STUPNE[60].zvuk(); }
          if (k === "vibr" && NAST.vibr && navigator.vibrate) navigator.vibrate(150);
        });
      });
      panel.querySelectorAll(".odp-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var st = +b.getAttribute("data-st"), a = NAST.predstih[akt.typ] || (NAST.predstih[akt.typ] = []);
          var i = a.indexOf(st);
          if (i >= 0) a.splice(i, 1); else { a.push(st); a.sort(function (x, y) { return y - x; }); if (NAST.zvuk) { audio(); STUPNE[st].zvuk(); } if (NAST.vibr && navigator.vibrate) navigator.vibrate(STUPNE[st].vibr); }
          uloz(); pre();
        });
      });
      if (panel.style.maxHeight && panel.style.maxHeight !== "0px") panel.style.maxHeight = panel.scrollHeight + "px";
    }
    pre();
    var otv = false;
    box.querySelector(".odp-nast").addEventListener("click", function () {
      otv = !otv;
      this.setAttribute("aria-expanded", otv ? "true" : "false");
      this.classList.toggle("odp-nast-otv", otv);
      box.style.borderRadius = otv ? "20px 20px 0 0" : "20px";
      panel.style.maxHeight = otv ? panel.scrollHeight + "px" : "0px";
    });
    box.querySelector(".odp-vyp").addEventListener("click", vypni);
    box.querySelector(".odp-zat").addEventListener("click", zavriOkno);
    wrap.appendChild(box); wrap.appendChild(panel);
    ov.appendChild(wrap);
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) zavriOkno(); });
    obnov();
  }

  // Zvonček do pruhu spoja. info = { key, cas:"HH:MM:SS", nazov }
  function tlacidlo(info) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "odp-btn";
    b.setAttribute("data-key", info.key);
    b.setAttribute("aria-label", "Odpočet do odchodu");
    b.innerHTML = IK + '<span class="odp-t"></span>';
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!akt || akt.key !== info.key) zapni(info);
      otvorOkno();
    });
    setTimeout(obnov, 0);
    return b;
  }

  // Typ upozornenia podľa času riadku: ak sa zhoduje s prebratím/odovzdaním prestávky v dnešnej službe vodiča, je to „prestávka“
  function minHm(t) { var p = String(t || "").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function typPodlaCasu(cas) {
    try {
      var r = window.appState && window.appState.currentDriver;
      var d = window.DpbCas ? window.DpbCas.formatDateKey(new Date()) : "";
      if (!r || !d || !window.DPBData) return "ostatne";
      var m = minHm(cas), sv = DPBData.getServicesForDate(r, d) || [];
      for (var i = 0; i < sv.length; i++) {
        var pr = (sv[i]._karta && sv[i]._karta["prestávka"]) || [];
        for (var j = 0; j < pr.length; j++) if (minHm(pr[j].prebera) === m || minHm(pr[j].odovzdava) === m) return "prestavka";
      }
    } catch (e) {}
    return "ostatne";
  }
  // Upozornenie na čas z riadku (dlhé podržanie). Platí jedno naraz; nový výber prepíše predchádzajúci.
  // Vráti true, ak je upozornenie nastavené (nové alebo to isté) – vtedy sa otvorí okno s odpočtom.
  function nastav(info) {
    if (akt && akt.key === info.key) return true;
    if (zostava(sekHms(info.cas)) <= 0) { if (window._showToast) window._showToast("Tento čas už prešiel", 3500); return false; }
    zapni(info);
    return true;
  }

  (function dlhePodrzanie() {
    var CAS = 550, tm = null, x0 = 0, y0 = 0, potlac = 0, cakaOtvor = false;
    function cielEl(e) { return e.target && e.target.closest ? e.target.closest("[data-odp-cas]") : null; }
    function zrus() { if (tm) { clearTimeout(tm); tm = null; } }
    document.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var el = cielEl(e); if (!el) return;
      x0 = e.clientX; y0 = e.clientY; zrus();
      tm = setTimeout(function () {
        tm = null;
        potlac = Date.now();
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (er) {} }
        cakaOtvor = nastav({ key: el.getAttribute("data-odp-key"), cas: el.getAttribute("data-odp-cas"), nazov: el.getAttribute("data-odp-nazov") || "", typ: typPodlaCasu(el.getAttribute("data-odp-cas")) });
      }, CAS);
    }, true);
    document.addEventListener("pointermove", function (e) {
      if (tm && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) zrus();
    }, true);
    ["pointerup", "pointercancel", "scroll"].forEach(function (n) { document.addEventListener(n, zrus, true); });
    // okno s odpočtom sa otvorí po pustení prsta (nie pod prstom)
    ["pointerup", "pointercancel"].forEach(function (n) {
      document.addEventListener(n, function () {
        if (cakaOtvor) { cakaOtvor = false; setTimeout(otvorOkno, 0); }
      }, true);
    });
    // po dlhom podržaní nesmie nasledovať obyčajné ťuknutie (napr. rozbalenie riadku)
    document.addEventListener("click", function (e) {
      // ťuknutie na odpočet pri označenom riadku = zrušenie upozornenia
      if (e.target.closest && e.target.closest(".odp-rt")) {
        e.stopPropagation(); e.preventDefault();
        vypni();
        if (window._showToast) window._showToast("Upozornenie zrušené", 2500);
        return;
      }
      if (potlac && Date.now() - potlac < 800 && cielEl(e)) { e.stopPropagation(); e.preventDefault(); potlac = 0; }
    }, true);
    document.addEventListener("contextmenu", function (e) { if (cielEl(e)) e.preventDefault(); }, true);
  })();

  // ── plán dňa (zvonček na karte): viac časov, appka vždy hlási najbližší ──
  function dnesKey() { return window.DpbCas ? window.DpbCas.formatDateKey(new Date()) : new Date().toISOString().slice(0, 10); }
  function planUloz() { try { if (plan) localStorage.setItem("dpb-odpocet-plan", JSON.stringify(plan)); else localStorage.removeItem("dpb-odpocet-plan"); } catch (e) {} }
  function planDalsi(kind) {
    if (!plan) return null;
    var best = null, bz = Infinity;
    plan.items.forEach(function (i) {
      if (kind && i.kind !== kind) return;
      if (plan.skip[i.cas + "|" + i.kind + "|" + i.typ]) return;
      var z = zostava(sekHms(i.cas));
      if (z > 0 && z < bz) { best = i; bz = z; }
    });
    return best ? { item: best, z: bz } : null;
  }
  function planTikni() {
    if (!plan) return;
    if (plan.d !== dnesKey()) { plan = null; planUloz(); if (planTik) { clearInterval(planTik); planTik = null; } if (!akt) vypniObrazovku(); obnov(); return; }
    if (!akt) {
      var n = planDalsi();
      if (n) {
        zapni({ key: "plan|" + n.item.kind + "|" + n.item.cas, cas: n.item.cas, nazov: n.item.nazov, typ: n.item.typ, pop: n.item.pop });
        akt.plan = n.item.kind; akt.planCas = n.item.cas;
      }
    }
    obnov();
  }
  function planStart() {
    if (!planTik) planTik = setInterval(planTikni, 1000);
    zapniObrazovku();
    planTikni();
  }
  function planKonci() {
    if (planTik) { clearInterval(planTik); planTik = null; }
    if (!akt) vypniObrazovku();
  }
  function planJe(kind) { return !!(plan && plan.items.some(function (i) { return i.kind === kind; })); }
  async function planPrepni(kind, items, typ, pop) {
    var toast = function (t) { if (window._showToast) window._showToast(t, 3500); };
    if (planJe(kind)) {
      plan.items = plan.items.filter(function (i) { return i.kind !== kind; });
      if (akt && akt.plan === kind) { var tmp = plan; plan = null; vypni(); plan = tmp; }
      if (!plan.items.length) { plan = null; planKonci(); }
      planUloz(); obnov();
      toast("Upozornenia vypnuté");
      return;
    }
    if (typeof items === "function") {
      toast("Načítavam časy…");
      try { items = await items(); } catch (e) { items = []; }
    }
    if (planJe(kind)) return;
    var buduce = items.filter(function (i) { return zostava(sekHms(i.cas)) > 0; });
    if (!buduce.length) { toast("Dnes už nie je žiadny čas, na ktorý by sa dalo upozorniť"); return; }
    if (!plan || plan.d !== dnesKey()) plan = { d: dnesKey(), items: [], skip: {} };
    audio();
    buduce.forEach(function (i) { plan.items.push({ cas: i.cas, nazov: i.nazov, typ: i.typ || typ, pop: i.pop || pop, kind: kind }); });
    planUloz(); planStart();
    toast("Upozornenia zapnuté (" + buduce.length + "). Obrazovka ostane zapnutá.");
  }
  // Zvonček do hlavičky bloku na karte. items = [{ cas:"HH:MM", nazov }]
  var IK_PLAN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/></svg>';
  function planTlacidlo(kind, items, typ, pop) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "odp-plan";
    b.setAttribute("data-kind", kind);
    b.setAttribute("aria-label", "Upozornenia");
    b.innerHTML = IK_PLAN + '<span class="odp-pt">Upozorniť</span>';
    b.addEventListener("click", function (e) { e.stopPropagation(); planPrepni(kind, items, typ, pop); });
    setTimeout(obnov, 0);
    return b;
  }
  // Skúšobný plán (správcovská funkcia v Profile). V ostrej verzii sa zobrazí len správcovi: ADMIN_FUNKCIE = false.
  var ADMIN_FUNKCIE = true;
  function skuska() {
    var n = new Date(), z = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    var hms = function (s) { s = s % 86400; return Math.floor(s / 3600) + ":" + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
    planPrepni("skuska", [
      { cas: hms(z + 120), nazov: "Skúška – striedanie", typ: "striedanie", pop: "Preberáš o" },
      { cas: hms(z + 240), nazov: "Skúška – odchod z konečnej", typ: "konecna", pop: "Odchod o" },
      { cas: hms(z + 360), nazov: "Skúška – koniec prestávky", typ: "prestavka", pop: "Koniec prestávky o" }
    ], "striedanie", "Preberáš o");
  }
  (function skuskaUi() {
    var k = document.getElementById("profilSkuskaKarta"), b = document.getElementById("profilSkuskaBtn");
    if (!k || !b) return;
    if (!ADMIN_FUNKCIE) { k.classList.add("hidden"); return; }
    b.addEventListener("click", skuska);
  })();
  (function planObnov() {
    try {
      var u = JSON.parse(localStorage.getItem("dpb-odpocet-plan") || "null");
      if (u && u.d === dnesKey() && u.items && u.items.length) { plan = u; plan.skip = plan.skip || {}; planStart(); }
      else localStorage.removeItem("dpb-odpocet-plan");
    } catch (e) {}
  })();

  window.DpbOdpocet = {
    planTlacidlo: planTlacidlo,
    nastav: nastav,
    obnov: obnov, tlacidlo: tlacidlo, vypni: vypni, jeAktivny: function () { return !!akt; }, _t: { zostava: zostava, fmt: fmt } };
})();
