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
  // Stretnutia dvoch spojov idúcich opačne: berú sa len ZASTÁVKY, ktoré majú oba spoje spoločné (jedna električka
  // môže niektorú zastávku vynechať, napr. STU len v jednom smere), a úsek medzi dvoma susednými spoločnými zastávkami.
  function stretnutiaSpojov(A, B) {
    var res = [];
    var bi = {};
    B.stops.forEach(function (z, i) { if (bi[z.st] === undefined) bi[z.st] = i; });
    var spolu = [];
    A.stops.forEach(function (z, i) { if (bi[z.st] !== undefined) spolu.push({ z: z, i: i, j: bi[z.st] }); });
    for (var k = 0; k + 1 < spolu.length; k++) {
      var p = spolu[k], q = spolu[k + 1];
      if (!(q.j < p.j)) continue;                        // B ide opačne: q pred p
      if (p.z.st === q.z.st) continue;
      var zB = B.stops[q.j], yB = B.stops[p.j];
      // rovnaká trasa: ak majú OBA spoje medzi týmito dvoma zastávkami ešte nejaké vlastné zastávky, idú rôznymi cestami
      // (napr. cez Poštovú vs. cez Most SNP); jednostranné vynechanie (STU v jednom smere) je v poriadku
      var vlA = q.i - p.i - 1, vlB = p.j - q.j - 1;
      if ((vlA > 0 && vlB > 0) || vlA > 2 || vlB > 2) continue;
      var t1 = cas(p.z), t2 = prich(q.z);
      var u1 = cas(zB), u2 = prich(yB);
      if (t1 == null || t2 == null || u1 == null || u2 == null || t2 <= t1 || u2 <= u1) continue;
      var z = Math.max(t1, u1), kk = Math.min(t2, u2);
      if (z > kk) continue;
      var a1 = 1 / (t2 - t1), b1 = -t1 / (t2 - t1);
      var a2 = -1 / (u2 - u1), b2 = 1 + u1 / (u2 - u1);
      var t = (b2 - b1) / (a1 - a2);
      if (!(t >= z - 1 && t <= kk + 1)) t = (z + kk) / 2;
      // pomenovanie podľa ZASTÁVOK MOJHO spoja A (tie fyzicky existujú ako susedné)
      var x = p.z.st, y = q.z.st, vz = null;
      for (var m = p.i; m < q.i; m++) {
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
        kde: v.vz ? "v zastávke " + nazovStanice(d.stanice, v.vz) : "medzi " + nazovStanice(d.stanice, v.x) + " a " + nazovStanice(d.stanice, v.y),
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
