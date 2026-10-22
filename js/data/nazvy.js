// Jediné miesto pre zobrazované názvy služieb, ktoré sa v exporte volajú inak (kód, nie názov).
//  - pohotovosť E1 / E2  -> „Dispozičný vodič“ (Sedavá záloha); E1 = Dp. Trnávka, E2 = Dp. Krasňany
//  - dennáKR / nočnáKR   -> „Denný / Nočný výpravca“; KR = výpravňa Krasňany, TR = výpravňa Trnávka
// Oficiálne názvy zastávok z grafikonu sa nemenia. Skratky KR/TR ostávajú ako kód v dátach a v pásiku Výpravňa.
(function () {
  var MIESTO_POHOTOVOSTI = { 1: "Dp. Trnávka", 2: "Dp. Krasňany" };
  var MIESTO_VYPRAVNE = { KR: "Krasňany", TR: "Trnávka" };

  function pohotovost(kurz) {
    var t = String(kurz || "").trim();
    if (!/^pohotovos/i.test(t)) return null;
    var m = /(\d+)\s*$/.exec(t);
    return {
      nazov: "Dispozičný vodič",
      podnazov: "Sedavá záloha",
      miesto: (m && MIESTO_POHOTOVOSTI[parseInt(m[1])]) || "",
    };
  }
  function vypravca(kurz) {
    var m = /^(denn|noč?n)\S*?(KR|TR)$/i.exec(String(kurz || "").trim());
    if (!m) return null;
    var denna = /^denn/i.test(m[1]);
    var g = m[2].toUpperCase();
    return { nazov: denna ? "Denný výpravca" : "Nočný výpravca", kod: g, miesto: MIESTO_VYPRAVNE[g] };
  }
  // Text do zoznamov a kalendára (kde je len jeden riadok)
  function nazovSluzby(kurz) {
    var p = pohotovost(kurz) || vypravca(kurz);
    return p ? p.nazov : kurz;
  }
  window.DpbNazvy = { pohotovost: pohotovost, vypravca: vypravca, nazovSluzby: nazovSluzby, MIESTO_POHOTOVOSTI: MIESTO_POHOTOVOSTI, MIESTO_VYPRAVNE: MIESTO_VYPRAVNE };
})();
