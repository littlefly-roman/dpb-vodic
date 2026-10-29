/* Odpočet do odchodu z konečnej (zvonček v pruhu spoja v grafikone kurzu).
   Ťuknutie na zvonček otvorí okno s odpočtom, zapne zvuk a zapnutú obrazovku. Zatvorenie okna odpočet nevypne –
   v pruhu spoja ostane zvonček so živým časom. Stupne: 2:00 (1 pípnutie), 1:30 (2), 1:00 (3), 0:30 (4), čas odchodu (poplach) (zvuk + vibrácia).
   Funguje len pri otvorenej appke so zapnutou obrazovkou; čas je podľa grafikonu (bez meškania). */
(function () {
  "use strict";
  var NAST = { zvuk: true, vibr: true };
  try { var u = JSON.parse(localStorage.getItem("dpb-odpocet") || "null"); if (u) { NAST.zvuk = u.zvuk !== false; NAST.vibr = u.vibr !== false; } } catch (e) {}
  function uloz() { try { localStorage.setItem("dpb-odpocet", JSON.stringify(NAST)); } catch (e) {} }

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
    return function () { for (var k = 0; k < n; k++) tón(f, k * 0.4, 0.25, vol); };
  }
  function vibrN(n) {
    var a = []; for (var k = 0; k < n; k++) { if (k) a.push(110); a.push(200); } return a;
  }
  var STUPNE = {
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
  document.addEventListener("visibilitychange", function () { if (akt && document.visibilityState === "visible") zapniObrazovku(); });

  // ── beh odpočtu ──
  function tikni() {
    if (!akt) return;
    var z = zostava(akt.dep);
    [120, 90, 60, 30].forEach(function (st) {
      if (z <= st && !akt.spustene[st]) { akt.spustene[st] = 1; if (z > st - 5) spusti(st); }
    });
    if (z <= 0 && !akt.spustene[0]) { akt.spustene[0] = 1; spusti(0); setTimeout(vypni, 4000); }
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
    if (ov) {
      var c = ov.querySelector(".odp-cislo"); if (c) { c.textContent = t; c.classList.toggle("odp-blizko", z <= 60); }
    }
  }
  function zapni(info) {
    audio(); // odblokuje zvuk (ťuknutie je gesto)
    var dep = sekHms(info.cas);
    var z = zostava(dep);
    akt = { key: info.key, dep: dep, nazov: info.nazov, cas: info.cas.slice(0, 5), spustene: {} };
    [120, 90, 60, 30].forEach(function (st) { if (z <= st) akt.spustene[st] = 1; });
    if (tik) clearInterval(tik);
    tik = setInterval(tikni, 250);
    zapniObrazovku();
    tikni();
  }
  function vypni() {
    akt = null;
    if (tik) { clearInterval(tik); tik = null; }
    vypniObrazovku();
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
    var box = document.createElement("div");
    box.style.cssText = "background:var(--surface);color:var(--text-1);border-radius:20px;width:100%;max-width:440px;padding:22px 20px 20px;box-sizing:border-box;text-align:center";
    box.innerHTML =
      '<div style="font-size:15px;color:var(--text-3)">Odchod o ' + akt.cas + '</div>' +
      '<div style="font-size:17px;font-weight:700;margin:2px 0 6px">' + akt.nazov + '</div>' +
      '<div class="odp-cislo" style="font-size:72px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;margin:8px 0 14px"></div>' +
      '<div style="display:flex;gap:10px;margin-bottom:14px">' +
      '<button type="button" class="odp-pre" data-p="zvuk"></button><button type="button" class="odp-pre" data-p="vibr"></button></div>' +
      '<button type="button" class="odp-vyp">Vypnúť odpočet</button>' +
      '<button type="button" class="odp-zat">Zavrieť (odpočet beží ďalej)</button>';
    ov.appendChild(box);
    document.body.appendChild(ov);
    function pre() {
      box.querySelectorAll(".odp-pre").forEach(function (b) {
        var k = b.getAttribute("data-p");
        b.textContent = (k === "zvuk" ? "Zvuk: " : "Vibrácia: ") + (NAST[k] ? "zap." : "vyp.");
        b.classList.toggle("odp-pre-on", !!NAST[k]);
        if (k === "vibr" && !navigator.vibrate) { b.textContent = "Vibrácia: nedostupná"; b.disabled = true; }
      });
    }
    pre();
    box.querySelectorAll(".odp-pre").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-p"); NAST[k] = !NAST[k]; uloz(); pre();
        if (k === "zvuk" && NAST.zvuk) { audio(); STUPNE[60].zvuk(); }
        if (k === "vibr" && NAST.vibr && navigator.vibrate) navigator.vibrate(150);
      });
    });
    box.querySelector(".odp-vyp").addEventListener("click", vypni);
    box.querySelector(".odp-zat").addEventListener("click", zavriOkno);
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

  window.DpbOdpocet = { tlacidlo: tlacidlo, vypni: vypni, jeAktivny: function () { return !!akt; }, _t: { zostava: zostava, fmt: fmt } };
})();
