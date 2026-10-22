// Kontakty na jednom mieste: dispečing, výpravne a zamestnávateľský prehľad (logo DPB).
// Zdroj je zatiaľ tento súbor; keď bude štruktúrovaný zoznam kontaktov, doplní sa cez
// DpbKontakty.nahrad({...}) bez zásahu do ostatného kódu.
//
// zamestnanci: kľúč "prevádzka_pracovisko" (napr. "DPE_Krasňany") alebo len "prevádzka" (napr. "I.DPA"),
// hodnota = zoznam { role, name, mobil, pevna, email }. Čo tu nie je, ukáže sa ako „Kontakty sa pripravujú“.
(function () {
  var K = {
    dispecing: { nazov: "Dopravný dispečing", cisla: ["+421 2 5950 7777"] },
    vypravne: {
      KR: { nazov: "Výpravňa Krasňany (KR)", cisla: ["+421 2 5950 3429", "+421 908 297 006"] },
      TR: { nazov: "Výpravňa Trnávka (TR)", cisla: ["+421 2 5950 2410", "+421 908 297 011"] },
    },
    zamestnanci: {},
    nahrad: function (d) {
      if (!d) return;
      if (d.dispecing) K.dispecing = d.dispecing;
      if (d.vypravne) K.vypravne = d.vypravne;
      if (d.zamestnanci) K.zamestnanci = d.zamestnanci;
    },
    zamestnanciPre: function (op, wp) {
      return K.zamestnanci[op + "_" + wp] || K.zamestnanci[op] || [];
    },
  };
  window.DpbKontakty = K;
})();
