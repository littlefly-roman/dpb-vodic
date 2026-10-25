/* Značky služby pri čísle dňa v kalendári (hlavný kalendár aj výber dátumu v oknách).
   Čiarka vedľa čísla podľa STREDU služby (priemer nástupu a ukončenia):
     pred 12:00 = hore (ranná), 12:00–16:30 = v strede, po 16:30 = dole (poobedná);
     deň s dvoma službami (delená) = dve malé čiarky, hore a dole.
   Deň, kde je len záznam bez časov (napr. neprítomnosť), má pôvodnú malú bodku.
   DpbKalZnacky.poloha(sluzby) -> "hore" | "stred" | "dole" | "delena" | null
   DpbKalZnacky.pridaj(bunka, sluzby) – doplní do bunky dňa čiarku(y) alebo bodku
   DpbKalZnacky.nacitaj(rid, dateKey) – služby dňa z DPBData (bez ukladania) */
(function () {
  var VZORY = { "SLUŽBA": 1, "944": 1, "STRIEDAČ": 1, "POHOTOVOSŤ": 1, "TRKR": 1 };
  function min(x) {
    if (x == null || x === "") return null;
    if (typeof x === "number") return x;
    var m = /^(\d+):(\d+)/.exec(String(x));
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function poloha(sluzby) {
    var casy = [];
    (sluzby || []).forEach(function (s) {
      var k = s && s._karta;
      if (!k || !VZORY[s._vzor]) return;
      var od = min(k.od), do_ = min(k.do);
      if (od == null || do_ == null) return;
      if (do_ < od) do_ += 1440;
      casy.push((od + do_) / 2);
    });
    if (!casy.length) return null;
    if (casy.length > 1) return "delena";
    return casy[0] < 12 * 60 ? "hore" : casy[0] < 16.5 * 60 ? "stred" : "dole";
  }
  function cz(trieda) {
    var s = document.createElement("span");
    s.className = "cal-cz " + trieda;
    return s;
  }
  function pridaj(bunka, sluzby) {
    var p = poloha(sluzby);
    if (!p) { if (sluzby && sluzby.length) bunka.classList.add("has-service"); return; }
    if (p === "delena") { bunka.appendChild(cz("cz-hore cz-mala")); bunka.appendChild(cz("cz-dole cz-mala")); }
    else bunka.appendChild(cz("cz-" + p));
    bunka.classList.add("ma-znacku");
  }
  function nacitaj(rid, dateKey) {
    try { return window.DPBData ? DPBData.getServicesForDate(rid, dateKey) || [] : []; } catch (e) { return []; }
  }
  window.DpbKalZnacky = { poloha: poloha, pridaj: pridaj, nacitaj: nacitaj };
})();
