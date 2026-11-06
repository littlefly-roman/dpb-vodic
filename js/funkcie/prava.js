/* Viditeľnosť funkcií podľa PRAVA.csv (z Disku Google, vedľa D_VYPR_POL.csv).
   Stĺpce: SUBJEKT;POPIS;hladat;stretnutia;zmena_sluzby;vozidlo_min
   SUBJEKT: os:<osobné číslo> | stredisko:<číslo> | pp:<pracovný pomer> | skupina:<názov> (členovia sú v súbore SKUPINY.csv: SKUPINA;OSOBNE_CISLO;MENO – jeden vodič na riadok) | *
   Funkcie: 1 = povolené (súčet cez všetky riadky, ktoré vodiča zahŕňajú); bez riadku = skryté.
   vozidlo_min: číslo = vozidlo sa ukáže až toľko minút pred nástupom; prázdne = bez obmedzenia.
     Pri viacerých riadkoch platí najkonkrétnejší: osoba > vlastná skupina > pracovný pomer > stredisko > *.
   POZOR: je to len skrytie v appke (nie bezpečnosť) – dáta sú v zariadení. */
(function () {
  var KLUC = "dpb_prava_csv";
  var FUNKCIE = ["hladat", "stretnutia", "zmena_sluzby"];
  var KLUC_S = "dpb_skupiny_csv";
  var clenovia = {}; // názov skupiny (malé písmená) -> { osobné číslo: true }
  var riadky = null; // null = súbor sa nenačítal -> všetko povolené (nič sa neskrýva)

  var ODD = ";";
  function rozdel(l) { return l.split(ODD).map(function (x) { return x.replace(/^"|"$/g, "").trim(); }); }
  function parse(text) {
    if (!text) return null;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var l = text.split(/\r?\n/).filter(function (x) { return x.trim(); });
    if (l.length < 1) return null;
    ODD = l[0].indexOf(";") >= 0 ? ";" : l[0].indexOf("\t") >= 0 ? "\t" : ",";
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
  function nastavSkupiny(text, uloz) {
    if (!text) return false;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var l = text.split(/\r?\n/).filter(function (x) { return x.trim(); });
    if (l.length < 1) return false;
    ODD = l[0].indexOf(";") >= 0 ? ";" : l[0].indexOf("\t") >= 0 ? "\t" : ",";
    var h = rozdel(l[0]).map(function (x) { return x.toLowerCase(); });
    var iG = h.indexOf("skupina"), iO = h.indexOf("osobne_cislo");
    if (iG < 0 || iO < 0) return false;
    var m = {};
    l.slice(1).forEach(function (ln) {
      var c = rozdel(ln), g = (c[iG] || "").toLowerCase(), o = c[iO] || "";
      if (g && o) (m[g] = m[g] || {})[o] = true;
    });
    clenovia = m;
    if (uloz) try { localStorage.setItem(KLUC_S, text); } catch (e) {}
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
      else if (s.indexOf("skupina:") === 0 && v.rid && (clenovia[s.slice(8)] || {})[v.rid]) w = 2.5;
      else if (s === "os:" + v.rid && v.rid) w = 3;
      if (w >= 0) out.push({ w: w, r: r });
    });
    return out.sort(function (a, b) { return b.w - a.w; });
  }
  // true, ak sa subjekt (os:/skupina:/pp:/stredisko:/trakcia:/*) týka aktuálneho vodiča
  function zahrna(subjekt) {
    var s = String(subjekt || "").trim().toLowerCase();
    if (s === "" || s === "*") return true;
    var v = vodic();
    if (s === "os:" + v.rid) return !!v.rid;
    if (s === "stredisko:" + v.stredisko) return !!v.stredisko;
    if (s === "pp:" + v.pp) return !!v.pp;
    if (s.indexOf("skupina:") === 0) return !!v.rid && !!(clenovia[s.slice(8)] || {})[v.rid];
    if (s.indexOf("trakcia:") === 0) {
      var tr = window.DPBData && DPBData.getTrakciaKod ? DPBData.getTrakciaKod(v.rid) : null;
      return !!tr && String(tr).toLowerCase() === s.slice(8).trim();
    }
    return false;
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
  // krátky popis pre Nastavenia/Profil (diagnostika)
  function info() {
    var n = Object.keys(clenovia).reduce(function (a, g) { return a + Object.keys(clenovia[g]).length; }, 0);
    var v = vodic();
    return (riadky === null ? "PRAVA.csv nenačítaný (všetko povolené)" : "PRAVA.csv " + riadky.length + " riadkov") +
      " · SKUPINY.csv " + n + " členov · vodič " + (v.rid || "–") + " má pravidiel " + (riadky === null ? 0 : moje().length);
  }
  function pouzi() {
    var b = document.querySelector('[data-nav="hladat"]');
    if (b) b.style.display = moze("hladat") ? "" : "none";
  }
  try { var u = localStorage.getItem(KLUC); if (u) nastav(u, false); } catch (e) {}
  try { var u2 = localStorage.getItem(KLUC_S); if (u2) nastavSkupiny(u2, false); } catch (e) {}
  document.addEventListener("dpb-prava", pouzi);
  document.addEventListener("DOMContentLoaded", pouzi);
  window.DpbPrava = { zahrna: zahrna, info: info, nastav: nastav, nastavSkupiny: nastavSkupiny, moze: moze, vozidloMin: vozidloMin, vozidloViditelne: vozidloViditelne, vozidloOdText: vozidloOdText, pouzi: pouzi, FUNKCIE: FUNKCIE };
})();
