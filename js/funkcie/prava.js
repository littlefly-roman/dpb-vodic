/* Viditeľnosť funkcií podľa PRAVA.csv (z Disku Google, vedľa D_VYPR_POL.csv).
   Stĺpce: SUBJEKT;POPIS;hladat;stretnutia;zmena_sluzby;vozidlo_min
   SUBJEKT: os:<osobné číslo> | stredisko:<číslo> | pp:<pracovný pomer> | skupina:<názov> (členovia v stĺpci clenovia, osobné čísla oddelené čiarkou) | *
   Funkcie: 1 = povolené (súčet cez všetky riadky, ktoré vodiča zahŕňajú); bez riadku = skryté.
   vozidlo_min: číslo = vozidlo sa ukáže až toľko minút pred nástupom; prázdne = bez obmedzenia.
     Pri viacerých riadkoch platí najkonkrétnejší: osoba > vlastná skupina > pracovný pomer > stredisko > *.
   POZOR: je to len skrytie v appke (nie bezpečnosť) – dáta sú v zariadení. */
(function () {
  var KLUC = "dpb_prava_csv";
  var FUNKCIE = ["hladat", "stretnutia", "zmena_sluzby"];
  var riadky = null; // null = súbor sa nenačítal -> všetko povolené (nič sa neskrýva)

  function rozdel(l) { return l.split(";").map(function (x) { return x.replace(/^"|"$/g, "").trim(); }); }
  function parse(text) {
    if (!text) return null;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var l = text.split(/\r?\n/).filter(function (x) { return x.trim(); });
    if (l.length < 1) return null;
    var h = rozdel(l[0]).map(function (x) { return x.toLowerCase(); });
    var iS = h.indexOf("subjekt");
    if (iS < 0) return null;
    return l.slice(1).map(function (ln) {
      var c = rozdel(ln), o = { subjekt: (c[iS] || "").toLowerCase() };
      h.forEach(function (n, i) { if (i !== iS) o[n] = c[i] || ""; });
      return o;
    });
  }
  function nastav(text, uloz) {
    var r = parse(text);
    if (!r) return false;
    riadky = r;
    if (uloz) try { localStorage.setItem(KLUC, text); } catch (e) {}
    document.dispatchEvent(new Event("dpb-prava"));
    return true;
  }
  function vodic() {
    var rid = window.appState && window.appState.currentDriver;
    var st = (window.DpbStredisko && window.DpbStredisko[rid]) || "";
    var pp = (window.DpbPracPomer && window.DpbPracPomer[rid]) || "";
    return { rid: String(rid || ""), stredisko: String(st), pp: String(pp) };
  }
  // riadky, ktoré sa týkajú vodiča, od najkonkrétnejšieho
  function moje() {
    var v = vodic(), out = [];
    (riadky || []).forEach(function (r) {
      var s = r.subjekt, w = -1;
      if (s === "*") w = 0;
      else if (s === "stredisko:" + v.stredisko && v.stredisko) w = 1;
      else if (s === "pp:" + v.pp && v.pp) w = 1.5;
      else if (s.indexOf("skupina:") === 0 && v.rid && (r.clenovia || "").split(/[\s,]+/).indexOf(v.rid) >= 0) w = 2.5;
      else if (s === "os:" + v.rid && v.rid) w = 3;
      if (w >= 0) out.push({ w: w, r: r });
    });
    return out.sort(function (a, b) { return b.w - a.w; });
  }
  function moze(f) {
    if (riadky === null) return true;
    return moje().some(function (x) { return /^(1|ano|áno|x)$/i.test(x.r[f] || ""); });
  }
  // počet minút (číslo) alebo null = bez obmedzenia
  function vozidloMin() {
    if (riadky === null) return null;
    var m = moje();
    for (var i = 0; i < m.length; i++) {
      var t = (m[i].r.vozidlo_min || "").trim();
      if (t !== "" && !isNaN(parseInt(t, 10))) return parseInt(t, 10);
    }
    return null;
  }
  // true, ak sa vozidlo smie ukázať: nastupHM = "HH:MM" alebo minúty od polnoci; den = "YYYY-MM-DD"
  function vozidloOd(den, nastupMin) {
    var lim = vozidloMin();
    if (lim === null || nastupMin == null || isNaN(nastupMin)) return null;
    var p = den.split("-").map(Number);
    var t = new Date(p[0], p[1] - 1, p[2], 0, nastupMin - lim, 0, 0).getTime();
    return t;
  }
  function vozidloViditelne(den, nastupMin) {
    var t = vozidloOd(den, nastupMin);
    return t === null || Date.now() >= t;
  }
  function vozidloOdText(den, nastupMin) {
    var t = vozidloOd(den, nastupMin);
    if (t === null) return "";
    var d = new Date(t);
    var hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return "Vozidlo od " + hm;
  }
  function pouzi() {
    var b = document.querySelector('[data-nav="hladat"]');
    if (b) b.style.display = moze("hladat") ? "" : "none";
  }
  try { var u = localStorage.getItem(KLUC); if (u) nastav(u, false); } catch (e) {}
  document.addEventListener("dpb-prava", pouzi);
  document.addEventListener("DOMContentLoaded", pouzi);
  window.DpbPrava = { nastav: nastav, moze: moze, vozidloMin: vozidloMin, vozidloViditelne: vozidloViditelne, vozidloOdText: vozidloOdText, pouzi: pouzi, FUNKCIE: FUNKCIE };
})();
