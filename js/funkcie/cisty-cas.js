/* Čistý čas a PJO (pauza na jedlo a oddych) služby.
   Pravidlá výpočtu sú len tu, aby sa dali jednoducho zmeniť.
   Vstup: karta služby (k.od_min, k.do_min v minútach, k.pjo v minútach alebo null, ak export PJO ešte neobsahuje).
   - čistý čas = (koniec − nástup) − PJO
   - PJO samostatných štandardných služieb v ten istý deň sa sčítavajú;
     pri 944 a pohotovosti sa nekumuluje (v dennom súčte sa berie raz). */
(function () {
  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + ":" + String(m).padStart(2, "0");
  }
  // údaje karty alebo null (karta nie je služba / export PJO neobsahuje)
  function zaKartu(k) {
    if (!k || k.vzor !== "SLUŽBA" || k.pjo == null || k.od_min == null || k.do_min == null) return null;
    var cisty = k.do_min - k.od_min - k.pjo;
    if (cisty < 0) return null;
    return { pjo: k.pjo, cisty: cisty, text: "Čistý čas " + fmt(cisty) + " · " + (k.pjo ? "PJO " + k.pjo + " min" : "bez PJO") };
  }
  // PJO za deň z kariet dňa: štandardné služby sa sčítajú, 944 a pohotovosť len raz (najväčšie)
  function pjoZaDen(karty) {
    var sucet = 0, zvlast = 0;
    (karty || []).forEach(function (k) {
      if (!k || k.pjo == null) return;
      if (k.vzor === "SLUŽBA") sucet += k.pjo;
      else if (k.vzor === "944" || k.vzor === "POHOTOVOSŤ") zvlast = Math.max(zvlast, k.pjo);
    });
    return sucet + zvlast;
  }
  window.DpbCistyCas = { zaKartu: zaKartu, pjoZaDen: pjoZaDen, fmt: fmt };
})();
