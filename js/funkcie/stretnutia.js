/* Koho stretnem (experiment, len električky).
   Pre kurz vodiča nájde všetky iné električkové kurzy, ktoré idú po tom istom úseku (zastávka X → Y) v OPAČNOM smere (Y → X)
   v prekrývajúcom sa čase, a spočíta, kde a kedy sa minú. Vodiča kurzu berie z CSV výpravy.
   Je to PLÁNOVANÉ stretnutie podľa grafikonu (nie živá poloha). */
(function () {
  var LINKY = [1, 3, 4, 9];
  var _cache = {};

  function sek(t) {
    if (!t) return null;
    var p = String(t).trim().split(":");
    return (+p[0]) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
  }
  function hms(s) {
    s = Math.round(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + ":" + String(m).padStart(2, "0");
  }

  // Načíta a rozparsuje všetky električkové obehy daného dňa: { "009281": [spoj, ...] }; spoj = { linka, stops:[{st,pl,arr,dep}] }
  async function nacitajObehy(dateKey) {
    var P = window.GrafikonParsery;
    var folders = window._dataFolders ? window._dataFolders() : [];
    var folder = window.Calendar.findDataFolder(dateKey, folders);
    if (!folder) return null;
    var typ = window.Calendar.getDayType(new Date(+dateKey.slice(0, 4), +dateKey.slice(5, 7) - 1, +dateKey.slice(8, 10)));
    var kluc = folder + "|" + typ;
    if (_cache[kluc]) return _cache[kluc];
    var base = "data/" + folder + "/";
    var obehy = {};
    var texty = await Promise.all(LINKY.map(function (l) { return P.loadText(base + l + ".JR"); }));
    var smTexty = await Promise.all(LINKY.map(function (l) { return P.loadText(base + l + ".SM", true); }));
    // trasy: "L009_S03" -> [V uzla0, V uzla1, ...] (vzdialenosť od predchádzajúceho uzla v metroch)
    var trasy = {};
    smTexty.forEach(function (txt) {
      if (!txt) return;
      var kluc = null;
      txt.split("\n").forEach(function (raw) {
        var line = raw.replace(/\r$/, "");
        if (!line.trim()) return;
        if (line.charAt(0) === "L") { var h = line.split("\t"); kluc = h[0] + "_" + h[1]; trasy[kluc] = []; return; }
        if (!kluc) return;
        var f = line.split("\t"), v = 0;
        for (var i = 1; i < f.length; i++) if (f[i].charAt(0) === "V" && /^V\d+$/.test(f[i])) { v = +f[i].slice(1); break; }
        trasy[kluc].push(v);
      });
    });
    texty.forEach(function (txt) {
      if (!txt) return;
      var cur = null, spoj = null;
      txt.split("\n").forEach(function (raw) {
        var line = raw.replace(/\r$/, "");
        if (!line.trim()) return;
        var t = line.trim();
        if (t.charAt(0) === "#") {
          var kod = t.slice(1);
          cur = (kod.length === 6 && kod.charAt(5) === String(typ)) ? (obehy[kod] = []) : null;
          spoj = null;
          return;
        }
        if (!cur) return;
        if (t.charAt(0) === "L") { var hh = t.split("\t"); spoj = { linka: hh[0], trasa: hh[0] + "_" + hh[1], stops: [] }; cur.push(spoj); return; }
        if (!spoj) return;
        var p = line.split("\t");
        var k = (p[0] || "").trim();
        if (k.length < 6) return;
        spoj.stops.push({ st: k.slice(0, 4), pl: k.slice(4, 6), arr: sek(p[1]), dep: sek(p[2]) });
      });
    });
    var stanice = P.parseKV(await P.loadText(base + "STANICE.ZS") || "");
    // kumulatívna vzdialenosť uzlov spoja (m), ak dĺžka trasy sedí s počtom zastávok spoja
    Object.keys(obehy).forEach(function (k) {
      obehy[k].forEach(function (sp) {
        var v = trasy[sp.trasa];
        if (v && v.length === sp.stops.length) {
          var c = 0;
          sp.stops.forEach(function (z, i) { if (i > 0) c += v[i]; z.d = c; });
        }
      });
    });
    var vysledok = { obehy: obehy, stanice: stanice, typ: typ };
    _cache[kluc] = vysledok;
    return vysledok;
  }

  function nazovStanice(stanice, st) {
    for (var i = 1; i <= 9; i++) {
      var n = stanice[st + "0" + i];
      if (n) return n;
    }
    return st;
  }

  // Úseky obehu: [{x,y,t1,t2}] – dep(X) → arr(Y)
  function useky(obeh) {
    var r = [];
    obeh.forEach(function (sp) {
      for (var i = 0; i + 1 < sp.stops.length; i++) {
        var a = sp.stops[i], b = sp.stops[i + 1];
        var t1 = a.dep != null ? a.dep : a.arr, t2 = b.arr != null ? b.arr : b.dep;
        if (t1 == null || t2 == null || a.st === b.st || t2 <= t1) continue;
        r.push({ x: a.st, y: b.st, t1: t1, t2: t2 });
      }
    });
    return r;
  }

  // Kto jazdí kurz ("3/12") v čase t (sekundy) podľa CSV; vráti { meno, rid, vozidlo } alebo null
  function vodicKurzu(dateKey, kurz, t) {
    var D = window.DPBData;
    var m = (function () {
      var c = _cache["csv|" + dateKey];
      if (c) return c;
      c = {};
      D.getDrivers().forEach(function (d) {
        (D.getServicesForDate(d.rid, dateKey) || []).forEach(function (s) {
          var k = s._karta || {};
          var add = function (kurzId, od, do_, typ, voz) {
            if (!kurzId) return;
            (c[kurzId] = c[kurzId] || []).push({ rid: d.rid, meno: d.meno, od: sek(od), do: sek(do_), typ: typ, voz: voz || "" });
          };
          if (s._vzor === "SLUŽBA") {
            var v = (k.vozidla && k.vozidla[0] && k.vozidla[0].cislo) || "";
            add(k.kurz, k.od, k.do, "sluzba", v);
          } else if (s._vzor === "STRIEDAČ") {
            (k.kurzy || []).forEach(function (r) { add(r.kurz, r.prebera, r.odovzdava, "striedac", r.vozidlo); });
          }
        });
      });
      _cache["csv|" + dateKey] = c;
      return c;
    })();
    var l = m[kurz] || [];
    var najdeny = l.filter(function (x) { return x.typ === "striedac" && x.od != null && x.od <= t && t <= x.do; })[0] ||
                  l.filter(function (x) { return x.typ === "sluzba" && x.od != null && x.od <= t && t <= x.do; })[0];
    return najdeny || null;
  }

  function cas(z) { return z.dep != null ? z.dep : z.arr; }
  function prich(z) { return z.arr != null ? z.arr : z.dep; }
  // Spoje (jazdy) obehu s časovým rozsahom
  function spojeObehu(obeh) {
    return obeh.filter(function (sp) { return sp.stops.length > 1; }).map(function (sp) {
      return { stops: sp.stops, t0: cas(sp.stops[0]), t1: prich(sp.stops[sp.stops.length - 1]) };
    }).filter(function (x) { return x.t0 != null && x.t1 != null; });
  }
  // Stretnutia dvoch spojov: ÚSEK = dvojica susedných zastávok jazdy (X -> Y).
  // Stretnete sa, ak druhý spoj má opačný úsek (Y -> X) v prekrývajúcom sa čase.
  // Ak jeden spoj vynechá zastávku (napr. STU v jednom smere), jeho dlhší úsek platí za všetky úseky, ktoré pokrýva.
  // Ručné pravidlo: pred Kráľovským údolím (0281) sa koľaje od Kapucínskej (0141) a od Chatam Sófer (0439) spájajú
  // do jednej, takže úseky 0141<->0281 a 0439<->0281 sa považujú za ten istý úsek.
  var VETVA = { "0141": 1, "0439": 1 };
  var SPOJ_UZOL = "0281";
  var MAX_SKOK = 3;
  function ekv(u, v, druhy) {
    return u === v || (druhy === SPOJ_UZOL && VETVA[u] === 1 && VETVA[v] === 1);
  }
  var BLUM = "0080", BLUM_TOL = 20;   // tolerancia v sekundách
  // Smer spoja v Blumentáli: linka 3 (cez Račianske mýto 0332 / Americké nám. 0003) alebo 9 (Vysoká 0473 / STU 0422 / Krížna 0173)
  function smerBlumental(stops, i) {
    var pr = i > 0 ? stops[i - 1].st : null, nx = i + 1 < stops.length ? stops[i + 1].st : null;
    var vys = function (u) { return u === "0473" || u === "0422"; };
    if (pr === "0332" && nx === "0003") return { linka: 3, dvojica: 1 };
    if (pr === "0003" && nx === "0332") return { linka: 3, dvojica: 2 };
    if (vys(pr) && nx === "0173") return { linka: 9, dvojica: 1 };
    if (pr === "0173" && vys(nx)) return { linka: 9, dvojica: 2 };
    return null;
  }
  function stretnutiaSpojov(A, B) {
    var res = [];
    for (var i = 0; i + 1 < A.stops.length; i++) {
      for (var a = 1; a <= MAX_SKOK && i + a < A.stops.length; a++) {
        var X = A.stops[i].st, Y = A.stops[i + a].st;
        if (X === Y) continue;
        var tA1 = cas(A.stops[i]), tA2 = prich(A.stops[i + a]);
        if (tA1 == null || tA2 == null || tA2 < tA1) continue;
        for (var j = 0; j + 1 < B.stops.length; j++) {
          if (!ekv(B.stops[j].st, Y, X)) continue;
          for (var bb = 1; bb <= MAX_SKOK && j + bb < B.stops.length; bb++) {
            if (a > 1 && bb > 1) continue;                 // len jedna strana smie vynechať zastávky
            if (!ekv(B.stops[j + bb].st, X, Y)) continue;
            var tB1 = cas(B.stops[j]), tB2 = prich(B.stops[j + bb]);
            if (tB1 == null || tB2 == null || tB2 < tB1) continue;
            var z = Math.max(tA1, tB1), kk = Math.min(tA2, tB2);
            if (z > kk) continue;
            // čas stretnutia (len na zoradenie): priesečník dvoch lineárnych pohybov po úseku
            var t = (z + kk) / 2;
            if (tA2 > tA1 && tB2 > tB1) {
              var a1 = 1 / (tA2 - tA1), b1 = -tA1 / (tA2 - tA1);
              var a2 = -1 / (tB2 - tB1), b2 = 1 + tB1 / (tB2 - tB1);
              var tt = (b2 - b1) / (a1 - a2);
              if (tt >= z - 1 && tt <= kk + 1) t = tt;
            }
            // pomenovanie podľa susedných zastávok MOJHO spoja
            var x = X, y = Y, vz = null;
            for (var m = i; m < i + a; m++) {
              var s0 = A.stops[m], s1 = A.stops[m + 1];
              var ta = cas(s0), tb = prich(s1);
              if (ta != null && tb != null && t >= ta - 1 && t <= tb + 1) {
                x = s0.st; y = s1.st;
                if (Math.abs(t - ta) < 20) vz = s0.st;
                else if (Math.abs(t - tb) < 20) vz = s1.st;
                break;
              }
            }
            res.push({ cas: t, x: x, y: y, vz: vz });
          }
        }
      }
    }
    // Ručné pravidlo 2: Blumentál (0080) - trojka a deviatka sa dotýkajú len pri zastávke (úsek ~80 m).
    //  trojka Račianske mýto > Blumentál > Americké nám.  <->  deviatka Vysoká/STU > Blumentál > Krížna
    //  trojka Americké nám. > Blumentál > Račianske mýto  <->  deviatka Krížna > Blumentál > Vysoká/STU
    for (var ia = 0; ia < A.stops.length; ia++) {
      if (A.stops[ia].st !== BLUM) continue;
      var kA = smerBlumental(A.stops, ia);
      if (!kA) continue;
      for (var ib = 0; ib < B.stops.length; ib++) {
        if (B.stops[ib].st !== BLUM) continue;
        var kB = smerBlumental(B.stops, ib);
        if (!kB || kA.dvojica !== kB.dvojica || kA.linka === kB.linka) continue;
        var o1 = prich(A.stops[ia]) - BLUM_TOL, o2 = cas(A.stops[ia]) + BLUM_TOL;
        var p1 = prich(B.stops[ib]) - BLUM_TOL, p2 = cas(B.stops[ib]) + BLUM_TOL;
        var zz = Math.max(o1, p1), kk2 = Math.min(o2, p2);
        if (zz > kk2) continue;
        res.push({ cas: (zz + kk2) / 2, x: BLUM, y: BLUM, vz: BLUM });
      }
    }
    return res;
  }

  // Hlavná funkcia: kurz = "9/28", od/do = "HH:MM" alebo sekundy služby vodiča
  async function najdi(kurz, dateKey, od, do_) {
    var d = await nacitajObehy(dateKey);
    if (!d) return null;
    var p = String(kurz).split("/");
    var kod = String(p[0]).padStart(3, "0") + String(p[1]).padStart(2, "0") + d.typ;
    var moj = d.obehy[kod];
    if (!moj) return { chyba: "Obeh " + kod + " sa nenašiel" };
    var odS = typeof od === "number" ? od : sek(od), doS = typeof do_ === "number" ? do_ : sek(do_);
    var mojeSpoje = spojeObehu(moj).filter(function (x) { return (odS == null || x.t1 >= odS) && (doS == null || x.t0 <= doS); });
    var cudzie = [];
    Object.keys(d.obehy).forEach(function (k) {
      if (k === kod) return;
      var kurzId = parseInt(k.slice(0, 3), 10) + "/" + parseInt(k.slice(3, 5), 10);
      spojeObehu(d.obehy[k]).forEach(function (x) { x.kurz = kurzId; cudzie.push(x); });
    });
    var vys = [];
    mojeSpoje.forEach(function (A) {
      cudzie.forEach(function (B) {
        if (B.t1 < A.t0 || B.t0 > A.t1) return;
        stretnutiaSpojov(A, B).forEach(function (m) { m.kurz = B.kurz; vys.push(m); });
      });
    });
    vys.sort(function (a, b) { return a.cas - b.cas; });
    // ten istý kurz v dvoch susedných úsekoch (stretnutie presne v zastávke) = jedno stretnutie
    var zl = [];
    vys.forEach(function (v) {
      var pred = zl.filter(function (q) { return q.kurz === v.kurz && v.cas - q.cas < 180; })[0];
      if (pred) { if (!pred.vz && v.vz) pred.vz = v.vz; return; }
      zl.push(v);
    });
    return zl.map(function (v) {
      var vod = vodicKurzu(dateKey, v.kurz, v.cas);
      return {
        cas: hms(v.cas), sec: v.cas,
        kde: v.vz ? nazovStanice(d.stanice, v.vz) : nazovStanice(d.stanice, v.x) + " – " + nazovStanice(d.stanice, v.y),
        kurz: v.kurz, meno: vod ? vod.meno : "", vozidlo: vod ? vod.voz : "",
      };
    });
  }

  // Poloha kurzu v čase sec: 7 zastávok (3 pred, aktuálna, 3 za) z rozbehnutého spoja (alebo najbližšieho)
  async function poloha(kurz, dateKey, sec, poSluzbe) {
    var d = await nacitajObehy(dateKey);
    if (!d) return { chyba: "Dáta grafikonu nie sú dostupné." };
    var p = String(kurz).split("/");
    var kod = String(p[0]).padStart(3, "0") + String(p[1]).padStart(2, "0") + d.typ;
    var obeh = d.obehy[kod];
    if (!obeh) return { chyba: "Grafikon kurzu " + kurz + " som nenašiel." };
    var cas = function (z) { return z.dep != null ? z.dep : z.arr; };
    var spoje = obeh.filter(function (sp) { return sp.stops.length > 1; }).map(function (sp) {
      return { sp: sp, od: cas(sp.stops[0]), do: (function () { var l = sp.stops[sp.stops.length - 1]; return l.arr != null ? l.arr : l.dep; })() };
    }).sort(function (a, b) { return a.od - b.od; });
    if (!spoje.length) return { chyba: "Kurz nemá spoje." };
    var stav = "bezi", ciel = spoje.filter(function (x) { return x.od <= sec && sec <= x.do; })[0];
    if (!ciel && poSluzbe) {
      var pred = spoje.filter(function (x) { return x.do <= sec; });
      if (pred.length) { ciel = pred[pred.length - 1]; stav = "skoncil"; }
    }
    if (!ciel) {
      var dalsi = spoje.filter(function (x) { return x.od > sec; })[0];
      if (dalsi) { ciel = dalsi; stav = "caka"; }
      else { ciel = spoje[spoje.length - 1]; stav = "skoncil"; }
    }
    var st = ciel.sp.stops, idx = 0;
    if (stav === "bezi") {
      for (var i = 0; i < st.length; i++) { if (cas(st[i]) <= sec) idx = i; }
    } else if (stav === "skoncil") idx = st.length - 1;
    var stred = stav === "caka" ? 0 : idx;
    var polozky = st.map(function (z) { return { nazov: nazovStanice(d.stanice, z.st), cas: hms(cas(z)) }; });
    var posl = st[st.length - 1];
    return { stav: stav, polozky: polozky, stred: stred, ciel: nazovStanice(d.stanice, posl.st), linka: ciel.sp.linka, odchodSpoja: hms(ciel.od) };
  }

  window.DpbStretnutia = { najdi: najdi, poloha: poloha, _t: { nacitajObehy: nacitajObehy, spojeObehu: spojeObehu, stretnutiaSpojov: stretnutiaSpojov, cas: cas, prich: prich } };
})();
