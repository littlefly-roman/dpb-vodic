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
        if (t.charAt(0) === "L") { spoj = { linka: t.split("\t")[0], stops: [] }; cur.push(spoj); return; }
        if (!spoj) return;
        var p = line.split("\t");
        var k = (p[0] || "").trim();
        if (k.length < 6) return;
        spoj.stops.push({ st: k.slice(0, 4), pl: k.slice(4, 6), arr: sek(p[1]), dep: sek(p[2]) });
      });
    });
    var stanice = P.parseKV(await P.loadText(base + "STANICE.ZS") || "");
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

  // Hlavná funkcia: kurz = "9/28", od/do = "HH:MM" alebo sekundy služby vodiča
  async function najdi(kurz, dateKey, od, do_) {
    var d = await nacitajObehy(dateKey);
    if (!d) return null;
    var p = String(kurz).split("/");
    var kod = String(p[0]).padStart(3, "0") + String(p[1]).padStart(2, "0") + d.typ;
    var moj = d.obehy[kod];
    if (!moj) return { chyba: "Obeh " + kod + " sa nenašiel" };
    var odS = typeof od === "number" ? od : sek(od), doS = typeof do_ === "number" ? do_ : sek(do_);
    var mojeUseky = useky(moj).filter(function (u) { return (odS == null || u.t2 >= odS) && (doS == null || u.t1 <= doS); });
    // index cudzích úsekov podľa smeru
    var idx = {};
    Object.keys(d.obehy).forEach(function (k) {
      if (k === kod) return;
      var kurzId = parseInt(k.slice(0, 3), 10) + "/" + parseInt(k.slice(3, 5), 10);
      useky(d.obehy[k]).forEach(function (u) {
        var key = u.x + ">" + u.y;
        (idx[key] = idx[key] || []).push({ kurz: kurzId, t1: u.t1, t2: u.t2 });
      });
    });
    var vys = [];
    mojeUseky.forEach(function (u) {
      (idx[u.y + ">" + u.x] || []).forEach(function (o) {
        var z = Math.max(u.t1, o.t1), k = Math.min(u.t2, o.t2);
        if (z > k) return;
        // poloha: ja X→Y: (t-u.t1)/(u.t2-u.t1); oproti Y→X: 1-(t-o.t1)/(o.t2-o.t1); hľadáme rovnosť
        var a1 = 1 / (u.t2 - u.t1), b1 = -u.t1 / (u.t2 - u.t1);
        var a2 = -1 / (o.t2 - o.t1), b2 = 1 + o.t1 / (o.t2 - o.t1);
        var t = (b2 - b1) / (a1 - a2);
        if (!(t >= z - 1 && t <= k + 1)) t = (z + k) / 2;
        vys.push({ cas: t, x: u.x, y: u.y, kurz: o.kurz });
      });
    });
    vys.sort(function (a, b) { return a.cas - b.cas; });
    // ten istý kurz v dvoch susedných úsekoch (stretnutie presne v zastávke) = jedno stretnutie
    var zl = [];
    vys.forEach(function (v) {
      var pred = zl.filter(function (q) { return q.kurz === v.kurz && v.cas - q.cas < 180; })[0];
      if (pred) {
        if (pred.y === v.x) { pred.vZast = pred.y; }
        return;
      }
      zl.push(v);
    });
    return zl.map(function (v) {
      var vod = vodicKurzu(dateKey, v.kurz, v.cas);
      return {
        cas: hms(v.cas), sec: v.cas,
        kde: v.vZast ? "v zastávke " + nazovStanice(d.stanice, v.vZast) : "medzi " + nazovStanice(d.stanice, v.x) + " a " + nazovStanice(d.stanice, v.y),
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
    var polozky = [];
    var stred = stav === "caka" ? 0 : idx;
    for (var j = stred - 3; j <= stred + 3; j++) {
      if (j < 0 || j >= st.length) { polozky.push(null); continue; }
      polozky.push({ nazov: nazovStanice(d.stanice, st[j].st), cas: hms(cas(st[j])), cur: j === stred });
    }
    var posl = st[st.length - 1];
    return { stav: stav, polozky: polozky, ciel: nazovStanice(d.stanice, posl.st), linka: ciel.sp.linka, odchodSpoja: hms(ciel.od) };
  }

  window.DpbStretnutia = { najdi: najdi, poloha: poloha };
})();
