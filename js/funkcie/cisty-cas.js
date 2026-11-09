/* Čistý čas a PJO (pauza na jedlo a oddych) služby.
   Pravidlá výpočtu sú len tu, aby sa dali jednoducho zmeniť.
   Vstup: karta služby (k.od_min, k.do_min v minútach, k.pjo v minútach alebo null, ak export PJO ešte neobsahuje).
   - čistý čas = (koniec − nástup) − PJO
   - PJO samostatných štandardných služieb v ten istý deň sa sčítavajú (každá karta má svoj čistý výkon);
     pri 944 a pohotovosti sa nekumuluje (v dennom súčte sa berie raz). */
(function () {
  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + ":" + String(m).padStart(2, "0");
  }
  // PJO podľa skutočného trvania: pohotovosť do 4:30 (limit PJOCERPANIDOHOD) prestávku nemá
  function pjoK(k) {
    // školenie: databáza PJO nemá, platí rovnaké pravidlo – nad 4:30 prestávka 30 min, inak žiadna
    if (k.kurz && /^\s*[ŠS]KOLEN/i.test(k.kurz) && k.od_min != null && k.do_min != null) return k.do_min - k.od_min > 270 ? 30 : 0;
    if (k.pjo == null) return null;
    if (k.vzor === "POHOTOVOSŤ" && k.od_min != null && k.do_min != null && k.do_min - k.od_min <= 270) return 0;
    return k.pjo;
  }
  // údaje karty alebo null (karta nie je služba / export PJO neobsahuje)
  function zaKartu(k) {
    if (!k || ["SLUŽBA", "STRIEDAČ", "TRKR", "944", "POHOTOVOSŤ"].indexOf(k.vzor) < 0 || (k.pjo == null && !(k.kurz && /^\s*[ŠS]KOLEN/i.test(k.kurz))) || k.od_min == null || k.do_min == null) return null;
    var pjo = pjoK(k);
    var cisty = k.do_min - k.od_min - pjo;
    if (cisty < 0) return null;
    return { pjo: pjo, cisty: cisty, text: "Čistý čas " + fmt(cisty) + " · " + (pjo ? "PJO " + pjo + " min" : "bez PJO") };
  }
  // PJO za deň z kariet dňa: štandardné služby sa sčítajú, 944 a pohotovosť len raz (najväčšie)
  function pjoZaDen(karty) {
    var sucet = 0, zvlast = 0;
    (karty || []).forEach(function (k) {
      if (!k || pjoK(k) == null) return;
      if (k.vzor === "SLUŽBA") sucet += pjoK(k);
      else if (k.vzor === "944" || k.vzor === "POHOTOVOSŤ") zvlast = Math.max(zvlast, pjoK(k));
    });
    return sucet + zvlast;
  }
  window.DpbCistyCas = { zaKartu: zaKartu, pjoZaDen: pjoZaDen, fmt: fmt };
})();
