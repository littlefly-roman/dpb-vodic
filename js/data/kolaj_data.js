// =============================================================
// KOĽAJOVÉ PRAVIDLÁ v4 — kompletná, overená implementácia
// Priorita v getKolajInfo:
//   1. Výnimka podľa (poradie + čas odchodu) ±90s
//   2. Smer pôvodu (pre L3 Depo Krasňany, L4 Pri kríži SN)
//   3. Základné pravidlo
// nextIsVozovna ZRUŠENÉ — rieši to výnimka C v dátach
// =============================================================

function _casToSec(t) {
  if (!t) return -1;
  var p = t.split(":");
  return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60;
}

function _najdiVynimku(vynimky, poradie, casOdchodu) {
  if (!vynimky || !vynimky.length || !casOdchodu) return null;
  var sec = _casToSec(casOdchodu);
  for (var i = 0; i < vynimky.length; i++) {
    var v = vynimky[i];
    if (v.p === poradie && Math.abs(_casToSec(v.cas) - sec) <= 90) return v.kolaj;
  }
  return null;
}

window.KOLAJ_VYNIMKY = {
  "3": {
    "1": {
      "Južné mesto": [
        {p:10,cas:"22:20",kolaj:"vonkajšiu koľaj"},
        {p:12,cas:"22:27",kolaj:"vonkajšiu koľaj"},
        {p:13,cas:"22:35",kolaj:"vnútornú koľaj"},
        {p:14,cas:"18:49",kolaj:"vonkajšiu koľaj"},
        {p:15,cas:"22:42",kolaj:"vnútornú koľaj"},
        {p:16,cas:"18:59",kolaj:"vonkajšiu koľaj"},
        {p:17,cas:"22:50",kolaj:"vnútornú koľaj"},
        {p:18,cas:"22:57",kolaj:"vnútornú koľaj"},
        {p:19,cas:"19:14",kolaj:"vonkajšiu koľaj"},
        {p:20,cas:"23:05",kolaj:"vnútornú koľaj"},
      ],
      "Komisárky": [
        {p:1,cas:"22:23",kolaj:"koľaj č.3"},
        {p:2,cas:"22:16",kolaj:"koľaj č.3"},
        {p:3,cas:"22:31",kolaj:"koľaj č.3"},
        {p:4,cas:"22:38",kolaj:"koľaj č.3"},
        {p:5,cas:"18:53",kolaj:"koľaj č.3"},
        {p:6,cas:"22:46",kolaj:"koľaj č.3"},
        {p:7,cas:"22:53",kolaj:"koľaj č.3"},
        {p:8,cas:"19:09",kolaj:"koľaj č.3"},
        {p:9,cas:"23:01",kolaj:"koľaj č.3"},
        {p:11,cas:"19:24",kolaj:"koľaj č.3"},
        {p:21,cas:"22:08",kolaj:"koľaj č.3"},
        {p:22,cas:"07:48",kolaj:"koľaj č.3"},
        {p:22,cas:"17:57",kolaj:"koľaj č.3"},
        {p:23,cas:"07:54",kolaj:"koľaj č.3"},
        {p:23,cas:"16:33",kolaj:"koľaj č.3"},
        {p:24,cas:"16:53",kolaj:"koľaj č.3"},
        {p:25,cas:"17:13",kolaj:"koľaj č.3"},
        {p:26,cas:"17:33",kolaj:"koľaj č.3"},
      ],
    },
    "2": {
      "Južné mesto": [
        {p:4,cas:"22:50",kolaj:"vnútornú koľaj"},
        {p:10,cas:"22:20",kolaj:"vonkajšiu koľaj"},
        {p:12,cas:"22:27",kolaj:"vonkajšiu koľaj"},
        {p:13,cas:"22:35",kolaj:"vnútornú koľaj"},
        {p:14,cas:"18:49",kolaj:"vonkajšiu koľaj"},
        {p:15,cas:"22:42",kolaj:"vnútornú koľaj"},
        {p:16,cas:"18:59",kolaj:"vonkajšiu koľaj"},
        {p:18,cas:"22:57",kolaj:"vnútornú koľaj"},
        {p:19,cas:"19:14",kolaj:"vonkajšiu koľaj"},
        {p:20,cas:"23:05",kolaj:"vnútornú koľaj"},
      ],
      "Komisárky": [
        {p:1,cas:"22:23",kolaj:"koľaj č.3"},
        {p:2,cas:"22:16",kolaj:"koľaj č.3"},
        {p:3,cas:"22:31",kolaj:"koľaj č.3"},
        {p:4,cas:"22:38",kolaj:"koľaj č.3"},
        {p:5,cas:"18:53",kolaj:"koľaj č.3"},
        {p:6,cas:"22:46",kolaj:"koľaj č.3"},
        {p:7,cas:"22:53",kolaj:"koľaj č.3"},
        {p:8,cas:"19:09",kolaj:"koľaj č.3"},
        {p:9,cas:"23:01",kolaj:"koľaj č.3"},
        {p:11,cas:"19:24",kolaj:"koľaj č.3"},
        {p:22,cas:"07:57",kolaj:"koľaj č.3"},
        {p:23,cas:"08:17",kolaj:"koľaj č.3"},
        {p:24,cas:"08:37",kolaj:"koľaj č.3"},
        {p:31,cas:"22:08",kolaj:"koľaj č.3"},
      ],
    },
    "3": {
      "Južné mesto": [
        {p:5,cas:"22:35",kolaj:"vnútornú koľaj"},
        {p:6,cas:"22:50",kolaj:"vnútornú koľaj"},
        {p:17,cas:"22:20",kolaj:"vonkajšiu koľaj"},
        {p:19,cas:"22:27",kolaj:"vonkajšiu koľaj"},
        {p:21,cas:"22:42",kolaj:"vnútornú koľaj"},
        {p:22,cas:"19:09",kolaj:"vonkajšiu koľaj"},
        {p:23,cas:"19:19",kolaj:"vonkajšiu koľaj"},
        {p:24,cas:"22:57",kolaj:"vnútornú koľaj"},
        {p:25,cas:"23:05",kolaj:"vnútornú koľaj"},
        {p:26,cas:"19:34",kolaj:"vonkajšiu koľaj"},
      ],
      "Komisárky": [
        {p:1,cas:"23:01",kolaj:"koľaj č.3"},
        {p:2,cas:"13:34",kolaj:"koľaj č.1"},
        {p:2,cas:"22:53",kolaj:"koľaj č.3"},
        {p:3,cas:"13:49",kolaj:"koľaj č.2"},
        {p:3,cas:"21:31",kolaj:"koľaj č.3"},
        {p:4,cas:"21:46",kolaj:"koľaj č.3"},
        {p:6,cas:"12:34",kolaj:"koľaj č.3"},
        {p:7,cas:"13:04",kolaj:"koľaj č.2"},
        {p:7,cas:"22:23",kolaj:"koľaj č.3"},
        {p:8,cas:"22:31",kolaj:"koľaj č.3"},
        {p:9,cas:"18:59",kolaj:"koľaj č.3"},
        {p:10,cas:"22:38",kolaj:"koľaj č.3"},
        {p:11,cas:"13:24",kolaj:"koľaj č.2"},
        {p:11,cas:"22:46",kolaj:"koľaj č.3"},
        {p:12,cas:"13:54",kolaj:"koľaj č.1"},
        {p:14,cas:"12:49",kolaj:"koľaj č.1"},
        {p:16,cas:"19:14",kolaj:"koľaj č.3"},
        {p:18,cas:"12:04",kolaj:"koľaj č.1"},
        {p:18,cas:"19:29",kolaj:"koľaj č.3"},
        {p:19,cas:"19:24",kolaj:"koľaj č.2"},
        {p:19,cas:"21:23",kolaj:"koľaj č.2"},
        {p:20,cas:"12:19",kolaj:"koľaj č.1"},
        {p:20,cas:"19:45",kolaj:"koľaj č.3"},
        {p:23,cas:"12:29",kolaj:"koľaj č.2"},
        {p:27,cas:"18:44",kolaj:"koľaj č.3"},
      ],
    },
  },
  "4": {
    "1": {
      "Zlaté piesky": [
        {p:3,cas:"19:20",kolaj:"vonkajšiu koľaj"},
        {p:3,cas:"21:46",kolaj:"vonkajšiu koľaj"},
        {p:15,cas:"18:19",kolaj:"vonkajšiu koľaj"},
        {p:17,cas:"18:29",kolaj:"vnútornú koľaj"},
        {p:19,cas:"20:50",kolaj:"vonkajšiu koľaj"},
        {p:27,cas:"08:01",kolaj:"vonkajšiu koľaj"},
        {p:29,cas:"08:33",kolaj:"vnútornú koľaj"},
      ],
    },
    "2": {
      "Zlaté piesky": [
        {p:7,cas:"07:26",kolaj:"vonkajšiu koľaj"},
        {p:7,cas:"21:06",kolaj:"vonkajšiu koľaj"},
        {p:15,cas:"04:39",kolaj:"vonkajšiu koľaj"},
        {p:15,cas:"08:26",kolaj:"vonkajšiu koľaj"},
        {p:20,cas:"07:38",kolaj:"vnútornú koľaj"},
      ],
    },
    "3": {
      "Pri kríži": [
        {p:1,cas:"05:43",kolaj:"koľaj č.2"},
        {p:3,cas:"06:13",kolaj:"koľaj č.2"},
        {p:4,cas:"04:43",kolaj:"koľaj č.2"},
        {p:13,cas:"06:43",kolaj:"koľaj č.1"},
        {p:14,cas:"05:13",kolaj:"koľaj č.2"},
        {p:15,cas:"07:13",kolaj:"koľaj č.1"},
      ],
      "Zlaté piesky": [
        {p:7,cas:"06:15",kolaj:"vnútornú koľaj"},
      ],
    },
  },
  "9": {
    "1": {
      "Astronomická": [
        {p:3,cas:"06:40",kolaj:"vonkajšiu koľaj"},
        {p:5,cas:"20:32",kolaj:"vonkajšiu koľaj"},
        {p:9,cas:"21:02",kolaj:"vonkajšiu koľaj"},
        {p:14,cas:"21:29",kolaj:"vnútornú koľaj"},
        {p:17,cas:"20:10",kolaj:"vonkajšiu koľaj"},
        {p:18,cas:"06:25",kolaj:"vnútornú koľaj"},
        {p:20,cas:"07:52",kolaj:"vnútornú koľaj"},
        {p:22,cas:"08:32",kolaj:"vnútornú koľaj"},
      ],
    },
    "2": {
      "Astronomická": [
        {p:2,cas:"20:32",kolaj:"vnútornú koľaj"},
        {p:6,cas:"21:02",kolaj:"vnútornú koľaj"},
        {p:9,cas:"21:29",kolaj:"vonkajšiu koľaj"},
        {p:11,cas:"20:02",kolaj:"vonkajšiu koľaj"},
        {p:12,cas:"18:25",kolaj:"vnútornú koľaj"},
      ],
    },
    "3": {
      "Astronomická": [
        {p:2,cas:"20:32",kolaj:"vnútornú koľaj"},
        {p:6,cas:"21:02",kolaj:"vnútornú koľaj"},
        {p:9,cas:"21:29",kolaj:"vonkajšiu koľaj"},
        {p:11,cas:"20:02",kolaj:"vonkajšiu koľaj"},
      ],
    },
  },
};

// =============================================================
// Základné pravidlá
// =============================================================
window.KOLAJ_RULES = {

  // LINKA 1: nepárne č.1, párne č.2, všetky dni
  "1": {
    "1": {"Hlavná stanica": {d: function(p){return p%2!==0?"koľaj č.1":"koľaj č.2";}}},
    "2": {"Hlavná stanica": {d: function(p){return p%2!==0?"koľaj č.1":"koľaj č.2";}}},
    "3": {"Hlavná stanica": {d: function(p){return p%2!==0?"koľaj č.1":"koľaj č.2";}}},
  },

  // LINKA 3
  "3": {
    "1": {
      // Komisárky → Južné mesto: vždy vnútorná
      "Južné mesto": {d: function(){return "vnútorná koľaj";}},
      // Južné mesto → Komisárky: nepárne č.1, párne č.2, Depo → č.3
      "Komisárky": {d: function(p, smer){
        if (smer && smer.toLowerCase().indexOf("depo krasňany") >= 0) return "koľaj č.3";
        return p%2!==0 ? "koľaj č.1" : "koľaj č.2";
      }},
    },
    "2": {
      "Južné mesto": {d: function(){return "vnútorná koľaj";}},
      "Komisárky": {d: function(p, smer){
        if (smer && smer.toLowerCase().indexOf("depo krasňany") >= 0) return "koľaj č.3";
        return p%2!==0 ? "koľaj č.1" : "koľaj č.2";
      }},
    },
    "3": {
      "Južné mesto": {d: function(){return "vnútorná koľaj";}},
      "Komisárky": {d: function(p, smer){
        if (smer && smer.toLowerCase().indexOf("depo krasňany") >= 0) return "koľaj č.3";
        return p%2!==0 ? "koľaj č.1" : "koľaj č.2";
      }},
    },
  },

  // LINKA 4
  "4": {
    "1": {
      // Pri kríži → Zlaté piesky: zoznam poradia
      "Zlaté piesky": {d: function(p){
        if ([1,5,9,13,17,21,25,29].indexOf(p)>=0) return "vonkajšia koľaj";
        if ([3,7,11,15,19,23,24,27].indexOf(p)>=0) return "vnútorná koľaj";
        return null;
      }},
      // Pri kríži → Stn. Nové Mesto: vždy vonkajšia
      "Stn. Nové Mesto": {d: function(){return "vonkajšia koľaj";}},
      // Zlaté piesky / Stn. NM → Pri kríži: zoznam poradia
      "Pri kríži": {d: function(p){
        if ([2,6,10,14,18,22,26,30].indexOf(p)>=0) return "koľaj č.1";
        if ([4,8,12,16,20,24,28].indexOf(p)>=0) return "koľaj č.2";
        return "koľaj č.3";
      }},
    },
    "2": {
      "Zlaté piesky": {d: function(p){
        if ([1,5,9,13,17,21].indexOf(p)>=0) return "vonkajšia koľaj";
        if ([3,7,11,15,16,19].indexOf(p)>=0) return "vnútorná koľaj";
        return null;
      }},
      "Stn. Nové Mesto": {d: function(){return "vonkajšia koľaj";}},
      "Pri kríži": {d: function(p){
        if ([2,6,10,14,18].indexOf(p)>=0) return "koľaj č.1";
        if ([4,8,12,16,20].indexOf(p)>=0) return "koľaj č.2";
        return "koľaj č.3";
      }},
    },
    "3": {
      // Pri kríži → Zlaté piesky SN: nepárne vonkajšia, párne vnútorná
      "Zlaté piesky": {d: function(p){return p%2!==0?"vonkajšia koľaj":"vnútorná koľaj";}},
      // Pri kríži → Stn. NM SN: vždy vonkajšia
      "Stn. Nové Mesto": {d: function(){return "vonkajšia koľaj";}},
      // Zlaté piesky / Stn. NM / Depo → Pri kríži SN
      "Pri kríži": {d: function(p, smer){
        // Zlaté piesky → vždy č.3
        if (smer && smer.toLowerCase().indexOf("zlaté piesky") >= 0) return "koľaj č.3";
        // Stn. Nové Mesto alebo Depo → nepárne č.1, párne č.2
        return p%2!==0 ? "koľaj č.1" : "koľaj č.2";
      }},
    },
  },

  // LINKA 9: nepárne vnútorná, párne vonkajšia, všetky dni
  "9": {
    "1": {
      "Astronomická": {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
      "Kútiky":       {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
    },
    "2": {
      "Astronomická": {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
      "Kútiky":       {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
    },
    "3": {
      "Astronomická": {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
      "Kútiky":       {d: function(p){return p%2===0?"vonkajšia koľaj":"vnútorná koľaj";}},
    },
  },
};

// =============================================================
// getKolajInfo
// Parametre: linka, poradie, typDna, nazovKonecnej,
//            casOdchodu ("HH:MM"), smerPovodu (názov 1. zastávky)
// =============================================================
window.getKolajInfo = function(linka, poradie, typDna, nazovKonecnej, casOdchodu, smerPovodu) {
  try {
    // getDayType vracia: 1=PD, 2=Sobota, 3=Ned/Sviatok, 4=Prázdniny
    // KOLAJ_RULES používa: 1=PD, 2=PDL, 3=SN
    // Mapovanie: sobota(2) a nedeľa(3) → SN(3), prázdniny(4) → PDL(2)
    var mappedTyp;
    if (typDna === 1) mappedTyp = "1";
    else if (typDna === 2 || typDna === 3) mappedTyp = "3"; // sobota aj nedeľa = SN
    else if (typDna === 4) mappedTyp = "2"; // prázdniny = PDL
    else mappedTyp = String(typDna);

    var lr = (window.KOLAJ_RULES||{})[String(linka)];
    if (!lr) return null;
    var dr = lr[mappedTyp];
    if (!dr) return null;

    // Nájdi pravidlo podľa názvu konečnej (čiastočná zhoda)
    var key = Object.keys(dr).find(function(k){
      return nazovKonecnej && nazovKonecnej.toLowerCase().indexOf(k.toLowerCase()) >= 0;
    });
    if (!key) return null;
    var rule = dr[key];

    // PRIORITA 1: výnimka podľa poradia + času odchodu
    var vLinka = (window.KOLAJ_VYNIMKY||{})[String(linka)];
    if (vLinka) {
      var vTyp = vLinka[mappedTyp];
      if (vTyp) {
        var vKey = Object.keys(vTyp).find(function(k){
          return nazovKonecnej && nazovKonecnej.toLowerCase().indexOf(k.toLowerCase()) >= 0;
        });
        if (vKey) {
          var v = _najdiVynimku(vTyp[vKey], poradie, casOdchodu);
          if (v) return v;
        }
      }
    }

    // PRIORITA 2: základné pravidlo (so smerom pôvodu)
    if (rule.d) return rule.d(poradie, smerPovodu || "");
    return null;
  } catch(e) {
    console.warn("getKolajInfo error:", e);
    return null;
  }
};
