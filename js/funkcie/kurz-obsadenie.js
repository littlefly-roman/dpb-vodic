/* Kto a s akým vozidlom jazdí kurz v danom čase (z kariet všetkých vodičov dňa).
   window.DpbKurzKto.kto("3/16", "2026-11-15", sekundy) -> { meno, rid, voz } | null
   Zdroje: SLUŽBA (kurz + vozidlá), hradenia na 944, STRIEDAČ (kurzy), striedač na prestávke.
   Vozidlo patrí kurzu: berie sa z úseku (SLUŽBA/hradenie), ktorý pokrýva daný čas – aj pre striedača. */
(function () {
  "use strict";
  var _cache = {};
  function min(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? +m[1] * 60 + +m[2] : null; }
  function dlzka(o, d) { return d < o ? d + 1440 : d; }

  function segmenty(kurz, dateKey) {
    var ck = dateKey + "|" + kurz;
    if (_cache[ck]) return _cache[ck];
    var out = { ludia: [], voz: [] }, M = (window.RAW && window.RAW.models) || {}, drv = (window.RAW && window.RAW.drivers) || {};
    function meno(rid) { return drv[String(rid)] || String(rid); }
    var viditelne = function (k) { // pravidlo PRAVA.csv: vozidlo až X minút pred nástupom
      return !window.DpbPrava || k.od_min == null || window.DpbPrava.vozidloViditelne(dateKey, k.od_min);
    };
    function vozy(zoznam, o, d, k) {
      if (k && !viditelne(k)) return;
      (zoznam || []).forEach(function (v) {
        if (!v || !v.cislo) return;
        var a = v.od ? min(v.od) : o, b = v.do ? min(v.do) : d;
        if (a == null || b == null) { a = o; b = d; }
        out.voz.push({ o: a, d: dlzka(a, b), c: String(v.cislo) });
      });
    }
    Object.keys(M).forEach(function (rid) {
      (M[rid] || []).forEach(function (den) {
        if (den.datum !== dateKey) return;
        (den.karty || []).forEach(function (k) {
          if (k.vzor === "SLUŽBA" && k.kurz === kurz) {
            var o = min(k.od), d = min(k.do); if (o == null || d == null) return; d = dlzka(o, d);
            out.ludia.push({ o: o, d: d, rid: rid, meno: meno(rid), typ: "sluzba" }); vozy(k.vozidla, o, d, k);
            (k["prestávka"] || []).forEach(function (p) {
              if (!p.str_meno || !p.prebera || !p.odovzdava) return;
              var a = min(p.prebera), b = min(p.odovzdava); if (a == null || b == null) return;
              out.ludia.push({ o: a, d: dlzka(a, b), rid: "", meno: p.str_meno, typ: "striedac" });
            });
          } else if (k.vzor === "STRIEDAČ") {
            (k.kurzy || []).forEach(function (r) {
              if (r.kurz !== kurz) return;
              var a = min(r.prebera), b = min(r.odovzdava); if (a == null || b == null) return;
              out.ludia.push({ o: a, d: dlzka(a, b), rid: rid, meno: meno(rid), typ: "striedac" });
            });
          }
          (k.hradenia || []).forEach(function (h) {
            if (h.kurz !== kurz) return;
            var a = min(h.od), b = min(h.do); if (a == null || b == null) return; b = dlzka(a, b);
            out.ludia.push({ o: a, d: b, rid: rid, meno: meno(rid), typ: "hradenie" }); vozy(h.vozidla, a, b, k);
          });
        });
      });
    });
    return (_cache[ck] = out);
  }

  function kto(kurz, dateKey, sec) {
    if (!kurz || !dateKey || sec == null) return null;
    var S = segmenty(kurz, dateKey), t = Math.floor(sec / 60);
    if (t < 240) t += 1440;   // po polnoci patrí k predchádzajúcemu dňu služby
    var najdi = function (typy, strict) {
      return S.ludia.filter(function (x) { return typy.indexOf(x.typ) >= 0 && x.o <= t && (strict ? t < x.d : t <= x.d); })[0];
    };
    var c = najdi(["striedac"], true) || najdi(["hradenie"], true) || najdi(["sluzba"], true) || najdi(["striedac"], false) || najdi(["hradenie"], false) || najdi(["sluzba"], false);
    var v = S.voz.filter(function (x) { return x.o <= t && t < x.d; })[0] || S.voz.filter(function (x) { return x.o <= t && t <= x.d; })[0];
    if (!c && !v) return null;
    return { meno: c ? c.meno : "", rid: c ? c.rid : "", voz: v ? v.c : "" };
  }
  // meno zobraz len ak to smie (vlastné meno vždy)
  function menoSmie(x) {
    if (!x || !x.meno) return "";
    var ja = window.appState && String(window.appState.currentDriver);
    if (x.rid && ja && String(x.rid) === ja) return x.meno;
    return !window.DpbPrava || window.DpbPrava.moze("vodic_cp") ? x.meno : "";
  }
  window.DpbKurzKto = { kto: kto, menoSmie: menoSmie, vymaz: function () { _cache = {}; } };
})();
