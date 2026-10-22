// Číselník stavov turnusu (STAVTURNUSU v D_VYPR_POL) – prevzatý z firemného číselníka
// „Ostatní číselníky“ (export Ostatné číselníky.xls). „povodny“ je názov z číselníka
// (po česky/slovensky), „nazov“ je jeho slovenský preklad, ktorý ukazuje appka.
// Skratka a príznak „Zobraz“ (čo smie operátor zadať) sú presne z číselníka. 0 = Prítomnosť (pracovný riadok).
// Pri novom kóde v exporte, ktorý tu chýba, appka ukáže „kód N“ a kontrola dát ho nahlási.
(function (root) {
  var KODY = {
  "0": {
    "nazov": "Prítomnosť",
    "povodny": "Prítomnosť",
    "zkratka": "-",
    "zobraz": true
  },
  "1": {
    "nazov": "Dovolenka čerpaná",
    "povodny": "Dovolenka čerpaná",
    "zkratka": "Dovolenka",
    "zobraz": true
  },
  "2": {
    "nazov": "Dovolenka preplatená",
    "povodny": "Dovolená proplacená",
    "zkratka": "D*",
    "zobraz": false
  },
  "3": {
    "nazov": "Dovolenka čerpaná – 1/2 dňa",
    "povodny": "Dovolenka čerpaná - 1/2 dňa",
    "zkratka": "Dov 0,5 dňa",
    "zobraz": true
  },
  "4": {
    "nazov": "Platené voľno – školenie",
    "povodny": "Platené voľno - školenie",
    "zkratka": "Školenie",
    "zobraz": true
  },
  "5": {
    "nazov": "Platené voľno – prekážka v práci",
    "povodny": "Platené voľno - prekážka v práci",
    "zkratka": "§",
    "zobraz": true
  },
  "6": {
    "nazov": "Platené voľno – ostatné",
    "povodny": "Platené voľno - ostatné",
    "zkratka": "odbory",
    "zobraz": true
  },
  "7": {
    "nazov": "Nemoc",
    "povodny": "Nemoc",
    "zkratka": "PN",
    "zobraz": true
  },
  "8": {
    "nazov": "Neplatené voľno",
    "povodny": "Neplacené volno",
    "zkratka": "Neplatené voľno",
    "zobraz": true
  },
  "9": {
    "nazov": "Neospravedlnená absencia",
    "povodny": "Neomluvená absence",
    "zkratka": "Absencia",
    "zobraz": true
  },
  "10": {
    "nazov": "Platené voľno – náhrada sviatku, ostatné",
    "povodny": "Placené volno NS - ostatní",
    "zkratka": "NS",
    "zobraz": true
  },
  "11": {
    "nazov": "Prestoj",
    "povodny": "Prostoj",
    "zkratka": "prost",
    "zobraz": false
  },
  "12": {
    "nazov": "Ošetrovanie člena rodiny",
    "povodny": "Péče o rodinného příslušníka",
    "zkratka": "OČR",
    "zobraz": true
  },
  "13": {
    "nazov": "Neurčená neprítomnosť",
    "povodny": "Neurčená neprítomnosť",
    "zkratka": "Neurčené",
    "zobraz": true
  },
  "14": {
    "nazov": "Vojenské cvičenie",
    "povodny": "Vojenské cvičení",
    "zkratka": "voj",
    "zobraz": false
  },
  "15": {
    "nazov": "Návšteva lekára",
    "povodny": "Návšteva lekára",
    "zkratka": "Lekár",
    "zobraz": true
  },
  "16": {
    "nazov": "Zájazd",
    "povodny": "ZÁJAZD",
    "zkratka": "Zájazd",
    "zobraz": true
  },
  "17": {
    "nazov": "Výluka",
    "povodny": "VÝLUKA",
    "zkratka": "výluka",
    "zobraz": true
  },
  "18": {
    "nazov": "Prevod na inú prácu",
    "povodny": "Převod na jinou práci",
    "zkratka": "Zmena služby",
    "zobraz": true
  },
  "19": {
    "nazov": "Vyžiadané voľno",
    "povodny": "Vyžiadané voľno",
    "zkratka": "Voľno !!!",
    "zobraz": true
  },
  "21": {
    "nazov": "Platené voľno – školenie 1/2 dňa",
    "povodny": "Placené volno-školení 1/2 dne",
    "zkratka": "Školenie 0,5 dňa",
    "zobraz": true
  },
  "22": {
    "nazov": "Platené voľno – prekážka v práci 1/2 dňa",
    "povodny": "Plac.volno-přek. v práci 1/2 dne",
    "zkratka": "§ 1/2 dňa",
    "zobraz": true
  },
  "23": {
    "nazov": "Platené voľno – ostatné 1/2 dňa",
    "povodny": "Placené volno-ostatní 1/2 dne",
    "zkratka": "PV 1/2",
    "zobraz": false
  },
  "24": {
    "nazov": "Neplatené voľno 1/2 dňa",
    "povodny": "Neplacené volno 1/2 dne",
    "zkratka": "nepl.1/2",
    "zobraz": false
  },
  "25": {
    "nazov": "Platené voľno – náhrada sviatku 1/2 dňa",
    "povodny": "Placené volno-NS 1/2 dne",
    "zkratka": "NS 1/2",
    "zobraz": false
  },
  "26": {
    "nazov": "Ošetrovanie člena rodiny 1/2 dňa",
    "povodny": "Péče o rod.přísl. 1/2 dne",
    "zkratka": "OČR 1/2",
    "zobraz": false
  },
  "27": {
    "nazov": "Návšteva lekára 1/2 dňa",
    "povodny": "Návšteva lekára 1/2 dňa",
    "zkratka": "Lekár 1/2 dňa",
    "zobraz": true
  },
  "28": {
    "nazov": "Sprievod rodinného príslušníka 1/2 dňa",
    "povodny": "Doprovod rodinného príslušníka 1/2 dne",
    "zkratka": "Doprovod 1/2 dňa",
    "zobraz": true
  },
  "29": {
    "nazov": "Otcovská popôrodná starostlivosť",
    "povodny": "Otcovská poporodní péče",
    "zkratka": "OtcovPP",
    "zobraz": true
  },
  "31": {
    "nazov": "Platené voľno – školenie 2 h",
    "povodny": "Placené volno-školení 2h",
    "zkratka": "šk.2h",
    "zobraz": true
  },
  "32": {
    "nazov": "Platené voľno – prekážka v práci 2 h",
    "povodny": "Plac.volno-přek. v práci 2h",
    "zkratka": "přek.2h",
    "zobraz": false
  },
  "33": {
    "nazov": "Platené voľno – ostatné 2 h",
    "povodny": "Placené volno-ostatní 2h",
    "zkratka": "PV 2h",
    "zobraz": false
  },
  "34": {
    "nazov": "Neplatené voľno 2 h",
    "povodny": "Neplacené volno 2h",
    "zkratka": "nepl.2h",
    "zobraz": false
  },
  "35": {
    "nazov": "Platené voľno – náhrada sviatku 2 h",
    "povodny": "Placené volno NS 2h",
    "zkratka": "NS 2h",
    "zobraz": false
  },
  "36": {
    "nazov": "Ošetrovanie člena rodiny 2 h",
    "povodny": "Péče o rod.přísl. 2h",
    "zkratka": "OČR 2h",
    "zobraz": false
  },
  "37": {
    "nazov": "Návšteva lekára 2 h",
    "povodny": "Návštěva lékaře 2h",
    "zkratka": "lék.2h",
    "zobraz": true
  },
  "38": {
    "nazov": "Materská dovolenka",
    "povodny": "Mateřská dovolená",
    "zkratka": "MD",
    "zobraz": true
  },
  "39": {
    "nazov": "Refundácia",
    "povodny": "Refundace",
    "zkratka": "refund.",
    "zobraz": true
  },
  "40": {
    "nazov": "Nemoc 1/2 dňa",
    "povodny": "Nemoc 1/2 dne",
    "zkratka": "nem1/2",
    "zobraz": false
  },
  "41": {
    "nazov": "Nemoc 1,5 dňa",
    "povodny": "Nemoc 1,5 dne",
    "zkratka": "nem1,5",
    "zobraz": false
  },
  "42": {
    "nazov": "Dovolenka – 1,5 dňa",
    "povodny": "Dovolenka - 1,5 dňa",
    "zkratka": "Dov 1,5 dňa",
    "zobraz": true
  },
  "43": {
    "nazov": "Ošetrovanie člena rodiny 1,5 dňa",
    "povodny": "Péče o rod.příslušníka 1,5 dne",
    "zkratka": "OČR1,5",
    "zobraz": false
  },
  "44": {
    "nazov": "Sprievod rodinného príslušníka",
    "povodny": "Doprovod rodinného príslušníka",
    "zkratka": "Doprovod",
    "zobraz": true
  },
  "45": {
    "nazov": "Psychologické vyšetrenie",
    "povodny": "Psychologické vyšetrenie",
    "zkratka": "Psychotesty",
    "zobraz": true
  },
  "46": {
    "nazov": "Zákonné voľno",
    "povodny": "Zákonné volno",
    "zkratka": "ZakV",
    "zobraz": true
  },
  "47": {
    "nazov": "Preventívna prehliadka",
    "povodny": "Preventívna prehliadka",
    "zkratka": "LP",
    "zobraz": true
  },
  "48": {
    "nazov": "Nemoc – náhrada",
    "povodny": "Nemoc-náhrada",
    "zkratka": "NemNahr",
    "zobraz": false
  },
  "49": {
    "nazov": "Nemoc – neplatená",
    "povodny": "Nemoc-neplac.",
    "zkratka": "NemNepl",
    "zobraz": false
  },
  "50": {
    "nazov": "Reklamácia",
    "povodny": "Reklamácia",
    "zkratka": "Reklamácia",
    "zobraz": true
  },
  "51": {
    "nazov": "Karanténa",
    "povodny": "Karanténa",
    "zkratka": "Karant",
    "zobraz": false
  },
  "52": {
    "nazov": "Izolácia",
    "povodny": "Izolace",
    "zkratka": "Izol",
    "zobraz": false
  },
  "53": {
    "nazov": "Štrajk / dni",
    "povodny": "Stávka/dny",
    "zkratka": "stav/dny",
    "zobraz": false
  },
  "54": {
    "nazov": "Štrajk / hodiny",
    "povodny": "Stávka/hod",
    "zkratka": "stáv/h",
    "zobraz": false
  },
  "55": {
    "nazov": "Platené voľno – prekážka 8 h",
    "povodny": "PV překážka 8h",
    "zkratka": "PVpřek8",
    "zobraz": false
  },
  "56": {
    "nazov": "Nemoc 6 h",
    "povodny": "Nemoc 6h",
    "zkratka": "nem6h",
    "zobraz": false
  },
  "57": {
    "nazov": "Dovolenka 12 h",
    "povodny": "Dovolená 12h",
    "zkratka": "dov12h",
    "zobraz": true
  },
  "58": {
    "nazov": "Nemoc 12 h",
    "povodny": "Nemoc 12h",
    "zkratka": "nem12h",
    "zobraz": true
  },
  "59": {
    "nazov": "Ošetrovanie člena rodiny 12 h",
    "povodny": "OČR 12h",
    "zkratka": "OCR12h",
    "zobraz": true
  },
  "60": {
    "nazov": "Platené voľno – náhrada sviatku 12 h",
    "povodny": "PVNS 12h",
    "zkratka": "PVNS12",
    "zobraz": true
  },
  "61": {
    "nazov": "Voľno zamestnávateľa",
    "povodny": "Zaměsta.volno",
    "zkratka": "ZV",
    "zobraz": false
  },
  "62": {
    "nazov": "Voľno zamestnávateľa 12 h",
    "povodny": "Zaměst.volno 12h",
    "zkratka": "ZV12h",
    "zobraz": false
  }
};
  function nazov(kod) {
    var k = KODY[parseInt(kod, 10)];
    return k ? k.nazov : "";
  }
  function zkratka(kod) {
    var k = KODY[parseInt(kod, 10)];
    return k ? k.zkratka : "";
  }
  root.DpbCiselnikStavov = { kody: KODY, nazov: nazov, zkratka: zkratka };
})(typeof window !== "undefined" ? window : globalThis);
