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
    // denný odpočinok pred a po
    var pred = null, po = null;
    P.forEach(function (x) {
      if (x.do <= k.od && (pred === null || x.do > pred)) pred = x.do;
      if (x.od >= k.do && (po === null || x.od < po)) po = x.od;
    });
    var restPred = pred === null ? Infinity : k.od - pred, restPo = po === null ? Infinity : po - k.do;
    var najmenej = Math.min(restPred, restPo);
    if (najmenej < DEN_MIN) return { ok: false, dovod: "odpočinok kratší ako 6 h", skrateny: null };
    if (najmenej < DEN_OK) res.skrateny = { pred: restPred, po: restPo, min: najmenej };
    // týždenný odpočinok: 7 dní PRED nástupom (okno končí nástupom) aj 7 dní PO konci služby (okno začína koncom)
    // musí obsahovať aspoň jeden nepretržitý odpočinok >= 35 h (presne na minúty, odpočinok orezaný oknom)
    var B = spoj(P.concat([{ od: k.od, do: k.do }]));
    if (!maRest(B, k.od - OKNO, k.od)) return { ok: false, dovod: "v 7 dňoch pred službou by nebol odpočinok 35 h", skrateny: null };
    if (!maRest(B, k.do, k.do + OKNO)) return { ok: false, dovod: "v 7 dňoch po službe by nebol odpočinok 35 h", skrateny: null };
    return res;
  }

  root.DpbOdpocinok = { skontroluj: skontroluj, abs: abs, DEN_OK: DEN_OK, DEN_MIN: DEN_MIN, TYD: TYD, OKNO: OKNO };
})(typeof window !== "undefined" ? window : globalThis);
