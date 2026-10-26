// Kontrola odpočinku pre ponuku služieb z burzy (zákon 462/2007 Z. z., § 28 + týždenný odpočinok 24 + 11 h).
// Čistá logika bez DOM, všetko v CELÝCH MINÚTACH (bez posúvania okien):
//  - denný odpočinok medzi službami: >= 11 h v poriadku, 6–11 h skrátený (ukáže sa s upozornením), < 6 h nie
//  - týždenný: v KAŽDOM 7-dňovom okne (168 h), ktoré sa dotkne ponúkanej služby, musí byť aspoň jeden
//    nepretržitý odpočinok >= 35 h (vypočítané presne cez intervaly, nie vzorkovaním)
// Čas mimo známych dát sa berie ako voľný.
(function (root) {
  var DEN_OK = 11 * 60, DEN_MIN = 6 * 60, TYD = 35 * 60, OKNO = 7 * 24 * 60;

  function abs(dateKey, min) {
    var p = String(dateKey).split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) / 60000 + min;
  }
  function spoj(iv) {
    var a = iv.filter(function (x) { return x.do > x.od; }).sort(function (x, y) { return x.od - y.od; }), out = [];
    a.forEach(function (x) {
      var l = out[out.length - 1];
      if (l && x.od <= l.do) l.do = Math.max(l.do, x.do);
      else out.push({ od: x.od, do: x.do });
    });
    return out;
  }
  // Je v okne [a,b] nepretržité voľno >= 35 h? B = zlúčená práca (zoradená)
  function maRest(B, a, b) {
    var cur = a;
    for (var i = 0; i < B.length; i++) {
      if (B[i].do <= a) continue;
      if (B[i].od >= b) break;
      if (B[i].od - cur >= TYD) return true;
      cur = Math.max(cur, B[i].do);
    }
    return b - cur >= TYD;
  }
  // prace: [{od,do}] v absolútnych minútach (už bez kandidáta); k: {od,do}
  function skontroluj(prace, k) {
    var res = { ok: true, dovod: "", skrateny: null };
    var P = prace.filter(function (x) { return x.do > x.od; });
    // prekrytie s inou prácou
    if (P.some(function (x) { return x.od < k.do && x.do > k.od; })) return { ok: false, dovod: "prekrýva sa s inou službou", skrateny: null };
    // Práca v ten istý deň = jedna delená zmena (kandidát je jej ďalšia časť): odpočinok sa počíta pred celou zmenou a po nej
    var den = Math.floor(k.od / 1440);
    var rovnakyDen = P.filter(function (x) { return Math.floor(x.od / 1440) === den; });
    var zOd = k.od, zDo = k.do;
    rovnakyDen.forEach(function (x) { zOd = Math.min(zOd, x.od); zDo = Math.max(zDo, x.do); });
    res.delena = rovnakyDen.length > 0;
    var pred = null, po = null;
    P.forEach(function (x) {
      if (Math.floor(x.od / 1440) === den) return;
      if (x.do <= zOd && (pred === null || x.do > pred)) pred = x.do;
      if (x.od >= zDo && (po === null || x.od < po)) po = x.od;
    });
    var restPred = pred === null ? Infinity : zOd - pred, restPo = po === null ? Infinity : po - zDo;
    var najmenej = Math.min(restPred, restPo);
    if (najmenej < DEN_MIN) return { ok: false, dovod: "odpočinok kratší ako 6 h", skrateny: null };
    if (najmenej < DEN_OK) res.skrateny = { pred: restPred, po: restPo, min: najmenej };
    // Limity skrátenia (§ 28 a § 5 ods. 3): skrátený odpočinok (6–11 h) najviac 3× v týždni a nie dva dni po sebe.
    // Skrátený odpočinok patrí do dňa nástupu, ktorý po ňom nasleduje. Náhrada skrátenia do konca nasledujúceho týždňa sa zatiaľ nekontroluje.
    if (res.skrateny) {
      var S = spoj(P.concat([{ od: k.od, do: k.do }])), dni = [];
      for (var q = 0; q + 1 < S.length; q++) {
        var med = S[q + 1].od - S[q].do;
        if (med >= DEN_MIN && med < DEN_OK) dni.push(Math.floor(S[q + 1].od / 1440));
      }
      var mojeD = [];
      if (restPred < DEN_OK) mojeD.push(Math.floor(zOd / 1440));
      if (restPo < DEN_OK) mojeD.push(Math.floor(po / 1440));
      for (var m = 0; m < mojeD.length; m++) {
        var dm = mojeD[m];
        var pocet = function (d) { return dni.filter(function (x) { return x === d; }).length; };
        if (pocet(dm - 1) > 0 || pocet(dm + 1) > 0) return { ok: false, dovod: "skrátený odpočinok dva dni po sebe", skrateny: null };
        for (var z = dm - 6; z <= dm; z++) {
          var c = dni.filter(function (x) { return x >= z && x <= z + 6; }).length;
          if (c > 3) return { ok: false, dovod: "viac ako 3 skrátené odpočinky v týždni", skrateny: null };
        }
      }
    }
    // týždenný odpočinok: 7 dní PRED nástupom (okno končí nástupom) aj 7 dní PO konci služby (okno začína koncom)
    // musí obsahovať aspoň jeden nepretržitý odpočinok >= 35 h (presne na minúty, odpočinok orezaný oknom)
    var B = spoj(P.concat([{ od: k.od, do: k.do }]));
    if (!maRest(B, k.od - OKNO, k.od)) return { ok: false, dovod: "v 7 dňoch pred službou by nebol odpočinok 35 h", skrateny: null };
    if (!maRest(B, k.do, k.do + OKNO)) return { ok: false, dovod: "v 7 dňoch po službe by nebol odpočinok 35 h", skrateny: null };
    return res;
  }

  // Práca vodiča z modelov (RAW.models[rid]) v absolútnych minútach
  var PRACA = ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"];
  function praceVodica(models, rid) {
    var out = [];
    ((models && models[rid]) || []).forEach(function (den) {
      (den.karty || []).forEach(function (k) {
        if (PRACA.indexOf(k.vzor) < 0 || k.od_min == null || k.do_min == null || k.do_min <= k.od_min) return;
        out.push({ od: abs(den.datum, k.od_min), do: abs(den.datum, k.do_min) });
      });
    });
    return out;
  }
  // Čo dovoľuje odpočinok (min. 6 h) v DEŇ bez práce: {nastupPo, ukoncenieDo} v minútach dňa, alebo null pri neznámom
  // (nastupPo = koniec poslednej práce pred dňom + 6 h; ukoncenieDo = nástup prvej práce po dni − 6 h)
  function okno(prace, dateKey) {
    var d0 = abs(dateKey, 0), d1 = d0 + 1440, pred = null, po = null;
    prace.forEach(function (x) {
      if (x.od < d0 && (pred === null || x.do > pred)) pred = x.do;
      if (x.od >= d1 && (po === null || x.od < po)) po = x.od;
    });
    var r = { nastupPo: null, ukoncenieDo: null };
    if (pred !== null && pred + DEN_MIN > d0) r.nastupPo = pred + DEN_MIN - d0;
    if (po !== null && po - DEN_MIN < d1) r.ukoncenieDo = po - DEN_MIN - d0;
    return r;
  }

  // Ako okno(), ale aj s týždenným odpočinkom 35 h a limitmi skrátenia (presne cez skontroluj).
  // Vráti {nastupPo, ukoncenieDo, plny, nemozne, poobedna:{od}|null, ranna:{do}|null}:
  //  plny = celý rozsah nastupPo–ukoncenieDo je v poriadku; inak je týždenný odpočinok obmedzením a platí
  //  poobedna.od (najskorší nástup, služba až do konca rozsahu) alebo ranna.do (najneskorší koniec, služba od začiatku rozsahu).
  function okno2(prace, dateKey) {
    var o = okno(prace, dateKey), d0 = abs(dateKey, 0);
    var amin = o.nastupPo != null ? Math.max(0, o.nastupPo) : 0;
    var bmax = o.ukoncenieDo != null ? Math.min(1440, o.ukoncenieDo) : 1440;
    var res = { nastupPo: o.nastupPo, ukoncenieDo: o.ukoncenieDo, plny: false, nemozne: false, poobedna: null, ranna: null };
    if (bmax - amin < 60) { res.nemozne = true; return res; }
    function ok(a, b) { return skontroluj(prace, { od: d0 + a, do: d0 + b }).ok; }
    if (ok(amin, bmax)) { res.plny = true; return res; }
    var nejake = false;
    for (var x = amin; x + 60 <= bmax; x += 1) if (ok(x, x + 60)) { nejake = true; break; }
    if (!nejake) { res.nemozne = true; return res; }
    // poobedná: najmenšie a také, že [a,bmax] je ok (monotónne)
    if (ok(bmax - 60, bmax)) {
      var lo = amin, hi = bmax - 60;
      while (lo < hi) { var m = Math.floor((lo + hi) / 2); if (ok(m, bmax)) hi = m; else lo = m + 1; }
      res.poobedna = { od: lo };
    }
    // ranná: najväčšie b také, že [amin,b] je ok
    if (ok(amin, amin + 60)) {
      var l2 = amin + 60, h2 = bmax;
      while (l2 < h2) { var m2 = Math.ceil((l2 + h2) / 2); if (ok(amin, m2)) l2 = m2; else h2 = m2 - 1; }
      res.ranna = { do: l2 };
    }
    return res;
  }

  root.DpbOdpocinok = { okno2: okno2, praceVodica: praceVodica, okno: okno, skontroluj: skontroluj, abs: abs, DEN_OK: DEN_OK, DEN_MIN: DEN_MIN, TYD: TYD, OKNO: OKNO };
})(typeof window !== "undefined" ? window : globalThis);
