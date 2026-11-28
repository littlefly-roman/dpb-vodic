/* Upozornenie na prejazd obratiskom (koľaj).
   Pred príchodom na koniec jazdy, kde grafikon uvádza koľaj, vyskočí okno „Prejazd obratiskom … KOĽAJ“,
   ktoré sa zavrie len tlačidlom „Rozumiem“. Zapína sa ikonou pod budíkom na karte (ťuk), dlhé podržanie = nastavenia.
   Ak beží aj okno odpočtu odchodu, pripojí sa nad neho ako jedno spoločné okno (zavrie sa len koľaj).
   DpbObratisko.tlacidlo(service) · .sekcia(service, kam, hl) */
(function () {
  "use strict";
  var KL = "dpb-obratisko";
  var CHIPS = [[180, "3 min"], [120, "2 min"], [90, "1,5 min"], [60, "1 min"], [30, "30 s"]];
  var POP = { 180: "3 minúty", 120: "2 minúty", 90: "1,5 minúty", 60: "1 minútu", 30: "30 sekúnd" };
  var IK = '<svg width="{S}" height="{S}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21 9 3M20 21 15 3M6.5 9h11M5.2 15h13.6"/></svg>';
  var NAST = { zvuk: true, vibr: false, predstih: [120], on: false, reg: {} };
  try {
    var u = JSON.parse(localStorage.getItem(KL) || "{}");
    if (typeof u.zvuk === "boolean") NAST.zvuk = u.zvuk;
    if (typeof u.vibr === "boolean") NAST.vibr = u.vibr;
    if (Array.isArray(u.predstih)) NAST.predstih = u.predstih.filter(function (x) { return typeof x === "number"; });
    if (typeof u.on === "boolean") NAST.on = u.on;
    if (u.reg && typeof u.reg === "object") NAST.reg = u.reg;
  } catch (e) {}
  function uloz() { try { localStorage.setItem(KL, JSON.stringify(NAST)); } catch (e) {} }
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function dnesKey() { return window.DpbCas ? window.DpbCas.formatDateKey(new Date()) : new Date().toISOString().slice(0, 10); }
  function kluc(s) { var k = (s && s._karta) || {}; return (s.date || "") + "|" + (k.kurz || "") + "|" + (k.od || ""); }
  function hm(t) { return String(t).split(":").slice(0, 2).join(":"); }
  function velke(kolaj) { return String(kolaj || "").toUpperCase().replace(/Č\.\s*(\d)/, "Č. $1").replace("VONKAJŠIA", "VONKAJŠIU").replace("VNÚTORNÁ", "VNÚTORNÚ"); }
  function sekHms(t) { var q = String(t).split(":"); return (+q[0] || 0) * 3600 + (+q[1] || 0) * 60 + (+q[2] || 0); }
  function zostava(cas) {
    var n = new Date(), now = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(), d = sekHms(cas);
    if (d < 4 * 3600 && now > 12 * 3600) d += 86400;
    return d - now;
  }

  // ── príchody (z grafikonu), cache podľa kľúča služby ──
  var cache = {}, btns = [];
  function priechody(s) {
    var k = (s && s._karta) || {}, key = kluc(s);
    if (!cache[key]) cache[key] = (window.obratiskaKurzu && k.kurz) ? window.obratiskaKurzu(k.kurz, s.date, k.od, k.do) : Promise.resolve([]);
    return cache[key];
  }
  function priechodyKey(key, z) {
    if (!cache[key]) cache[key] = window.obratiskaKurzu ? window.obratiskaKurzu(z.kurz, z.d, z.od, z.do) : Promise.resolve([]);
    return cache[key];
  }
  function skoncila(z) {
    var od = sekHms(z.od ? z.od + ":00" : "0:00:00"), q = String(z.do || "").split(":"), kon = q.length > 1 ? (+q[0]) * 3600 + (+q[1]) * 60 : null;
    if (kon == null || kon <= od) return false;
    var n = new Date(); return z.d === dnesKey() && n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() >= kon;
  }
  function skoncilaS(s) { var k = (s && s._karta) || {}; return skoncila({ d: s.date, od: k.od, do: k.do }); }
  function zapnute() { return !!NAST.on; }
  function obnovBtn() { btns.forEach(function (b) { if (b._fn) b._fn(); }); }

  // ── zvuk ──
  function signal(st, forceZvuk) {
    var O = window.DpbOdpocet;
    if (O && O.signal) O.signal(st, NAST.zvuk || forceZvuk, NAST.vibr);
  }

  // ── okno upozornenia ──
  var okno = null;   // { ov, box }
  function radius(box, v) { box.style.borderRadius = v; }
  function zavriOkno() { if (!okno) return; try { if (okno.ov) okno.ov.remove(); else okno.box.remove(); } catch (e) {} okno = null; var O = window.DpbOdpocet; if (O && O.ovWrap && O.ovWrap()) { /* odpočet zostáva */ var b = O.ovBox && O.ovBox(); if (b) { b.style.borderRadius = "20px";  } } }
  function naplnBox(box, p) {
    box.innerHTML =
      '<div style="font-size:1.0625rem;color:var(--text-2)">Nasledujúci prejazd obratiskom</div>' +
      '<div style="font-size:1.375rem;font-weight:700;margin:2px 0 0">' + (p.nazov || "") + '</div>' +
      '<div style="font-size:1.75rem;font-weight:800;line-height:1.15;margin:12px 0 16px">cez ' + velke(p.kolaj) + '.</div>';
    var b = el("button", "width:100%;min-height:52px;border-radius:14px;border:0;background:var(--red);color:#fff;font:inherit;font-size:1rem;font-weight:600;cursor:pointer", "Rozumiem");
    b.type = "button"; b.className = "obr-rozumiem";
    b.addEventListener("click", zavriOkno);
    box.appendChild(b);
  }
  function ukazOkno(p) {
    if (okno && okno.box.isConnected) { naplnBox(okno.box, p); return; }
    var box = el("div", "position:relative;background:var(--surface);color:var(--text-1);border-radius:20px;width:100%;padding:20px 18px 18px;box-sizing:border-box;text-align:center");
    box.className = "obr-okno";
    naplnBox(box, p);
    var O = window.DpbOdpocet, w = O && O.ovWrap && O.ovWrap();
    if (w) {
      w.insertBefore(box, w.firstChild);
      radius(box, "20px 20px 0 0");
      var ob = O.ovBox && O.ovBox(); if (ob) { ob.style.borderRadius = "0 0 20px 20px"; }
      okno = { ov: null, box: box };
    } else {
      var ov = el("div", "position:fixed;inset:0;z-index:10051;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box");
      var wrap = el("div", "width:100%;max-width:440px;display:flex;flex-direction:column");
      wrap.appendChild(box); ov.appendChild(wrap); document.body.appendChild(ov);
      okno = { ov: ov, box: box };
    }
  }
  // volá odpocet.js, keď otvára svoje okno: obratisko sa pripojí nad neho
  function pripoj(wrap, odpBox) {
    if (!okno || !okno.box.isConnected) return;
    var star = okno.ov; wrap.insertBefore(okno.box, wrap.firstChild);
    radius(okno.box, "20px 20px 0 0");
    if (odpBox) { odpBox.style.borderRadius = "0 0 20px 20px"; }
    if (star) { star.remove(); okno.ov = null; }
  }
  // volá odpocet.js pred zatvorením svojho okna: obratisko ostane samostatne
  function odpoj() {
    if (!okno || okno.ov || !okno.box.isConnected) return;
    var ov = el("div", "position:fixed;inset:0;z-index:10051;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box");
    var wrap = el("div", "width:100%;max-width:440px;display:flex;flex-direction:column");
    radius(okno.box, "20px");
    wrap.appendChild(okno.box); ov.appendChild(wrap); document.body.appendChild(ov);
    okno.ov = ov;
  }

  // ── nastavenia (dlhé podržanie) ──
  function nastavenia() {
    var bg = el("div", ""); bg.className = "odp-okno-bg"; bg.style.zIndex = "100002";
    var ok = el("div", ""); ok.className = "odp-okno";
    function kresli() {
      ok.innerHTML = '<div class="odp-okno-h">Obratisko – koľko pred koncom jazdy</div>' +
        '<div class="odp-chips" style="margin-bottom:14px">' + CHIPS.map(function (c) { return '<button type="button" class="odp-chip' + (NAST.predstih.indexOf(c[0]) >= 0 ? " odp-chip-on" : "") + '" data-st="' + c[0] + '">' + c[1] + '</button>'; }).join("") + '</div>' +
        '<button type="button" class="odp-okno-zavri">Hotovo</button>';
      ok.querySelectorAll(".odp-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var st = +b.getAttribute("data-st");
          NAST.predstih = [st]; signal(st, true);
          uloz(); kresli();
        });
      });
      ok.querySelector(".odp-okno-zavri").addEventListener("click", function () { bg.remove(); });
    }
    kresli();
    bg.addEventListener("click", function (e) { if (e.target === bg) bg.remove(); });
    bg.appendChild(ok); document.body.appendChild(bg);
  }

  // dlhé podržanie (550 ms) – ako pri ostatných ikonách s bodkou
  function podrz(b, tap, dlhe) {
    var tm = null, pot = false, x0 = 0, y0 = 0;
    function zrus() { if (tm) { clearTimeout(tm); tm = null; } }
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

  function prepni(zap) {
    NAST.on = !!zap; uloz(); obnovBtn(); if (zap) tik();
  }
  function registruj(s) {
    var k = (s && s._karta) || {};
    if (s.date !== dnesKey() || !k.kurz) return;
    var key = kluc(s);
    if (!NAST.reg[key]) { NAST.reg[key] = { kurz: k.kurz, d: s.date, od: k.od, do: k.do }; uloz(); }
    if (NAST.on) tik();
  }

  // ── ikona na karte (pod budíkom) ──
  function tlacidlo(s) {
    var b = el("button", ""); b.type = "button"; b.className = "card-zvonec card-obrat podrz";
    b.setAttribute("aria-label", "Upozornenie na prejazd obratiskom"); b.hidden = true;
    b.innerHTML = IK.replace(/\{S\}/g, "20");
    b._fn = function () { var sk = skoncilaS(s); b.disabled = sk; b.classList.toggle("off", sk); b.classList.toggle("zap", !sk && zapnute()); };
    var _t = setInterval(function () { if (!b.isConnected) { clearInterval(_t); return; } b._fn(); }, 30000);
    var k = (s && s._karta) || {};
    if (s.date !== dnesKey() || !k.kurz) return b;
    priechody(s).then(function (arr) { if (arr && arr.length) { b.hidden = false; b._fn(); if (b._poloz) b._poloz(); registruj(s); } });
    podrz(b, function () {
      if (skoncilaS(s)) return;
      var zap = !zapnute(); prepni(zap);
      if (window._showToast) window._showToast(zap ? "Upozornenie na obratisko zapnuté" : "Upozornenie na obratisko vypnuté", 2200);
    }, nastavenia);
    btns.push(b); b._fn();
    return b;
  }

  // ── sekcia v okne Upozornenia (lokálne menu): globálne zapnúť / vypnúť, podržanie = čas ──
  function sekcia(s, kam, hl) {
    var k = (s && s._karta) || {};
    if (s.date !== dnesKey() || !k.kurz) return;
    priechody(s).then(function (arr) {
      if (!arr || !arr.length || !kam.isConnected) return;
      kam.innerHTML = "";
      kam.appendChild(hl("Obratisko"));
      var r = el("button", "width:100%;display:flex;flex-direction:column;gap:2px;padding:10px 14px;border-radius:12px;font-size:1.0625rem;font-family:inherit;text-align:left;border:2px solid var(--border);background:transparent;color:var(--text-1)");
      r.type = "button";
      function kresli() {
        var sk = skoncilaS(s), zap = zapnute() && !sk;
        r.disabled = sk; r.style.opacity = sk ? ".4" : "";
        r.style.borderColor = zap ? "var(--red)" : "var(--border)";
        r.innerHTML = '<span style="font-weight:700">' + (sk ? "Služba skončila" : zap ? "Zapnuté" : "Vypnuté") + ' · ' + (NAST.predstih.map(function (p) { return p >= 60 ? (p / 60 + "").replace(".", ",") + " min" : p + " s"; }).join(", ") || "bez času") + ' pred koncom jazdy</span>';
      }
      kresli();
      podrz(r, function () { if (skoncilaS(s)) return; prepni(!zapnute()); kresli(); }, nastavenia);
      kam.appendChild(r);
      kam.appendChild(el("div", "font-size:0.9375rem;color:var(--text-2);margin-top:8px", "Platí pre všetky jazdy. Ťuk = zapnúť / vypnúť, podržanie = zmena času."));
    });
  }

  // ── časovač ──
  var tm = null, odpal = {};
  function tik() {
    if (tm) return;
    tm = setInterval(vykonaj, 1000);
    vykonaj();
  }
  function vykonaj() {
    if (!NAST.on) { clearInterval(tm); tm = null; return; }
    var dnes = dnesKey(), zmena = false;
    Object.keys(NAST.reg).forEach(function (key) {
      var z = NAST.reg[key];
      if (!z || z.d !== dnes) { delete NAST.reg[key]; zmena = true; return; }
      if (skoncila(z)) return;
      priechodyKey(key, z).then(function (arr) {
        (arr || []).forEach(function (a) {
          var zo = zostava(a.cas);
          NAST.predstih.forEach(function (p) {
            var id = key + "|" + a.cas + "|" + p;
            if (odpal[id] || zo > p || zo <= p - 20) return;
            odpal[id] = 1;
            signal(p); ukazOkno({ pred: p, nazov: a.nazov, kolaj: a.kolaj });
          });
        });
      });
    });
    if (zmena) uloz();
  }
  if (NAST.on) setTimeout(tik, 1500);

  function zrusVsetko() {
    NAST.on = false; NAST.reg = {}; odpal = {}; uloz();
    if (tm) { clearInterval(tm); tm = null; }
    zavriOkno(); obnovBtn();
  }

  window.DpbObratisko = { zrusVsetko: zrusVsetko, tlacidlo: tlacidlo, sekcia: sekcia, pripoj: pripoj, odpoj: odpoj, nastavenia: nastavenia, _ukaz: ukazOkno };
})();
