// Voľné (neobsadené) služby pre Burzu. Čistá logika bez DOM.
// Do Burzy idú len štandardné služby (kurz v tvare linka/poradie, napr. 3/16) a pohotovosti.
// Všetko ostatné (kurz E, Technologická, Skúšobná jazda, výcvik BUS ...) sa vynecháva.
// Voľná je každá ČASŤ služby (výpravenka + turnus + riadok + TRIDENI), na ktorej nie je žiadny
// prítomný vodič; pri delenej službe sa teda ponúka len tá časť, ktorá je voľná.
(function (root) {
  function jeStandardna(kurz) {
    return /\d+\s*\/\s*\d+/.test(kurz || "") || /^pohotovos/i.test((kurz || "").trim());
  }
  // Pohotovosť sa v Burze volá Dispozičný vodič (sedavá záloha); miesto podľa označenia:
  // E1 = Dp. Trnávka, E2 = Dp. Krasňany.
  var MIESTO_POHOTOVOSTI = { 1: "Dp. Trnávka", 2: "Dp. Krasňany" };
  function jePohotovost(kurz) {
    return /^pohotovos/i.test((kurz || "").trim());
  }
  function miestoPohotovosti(kurz) {
    var m = /E\s*(\d+)?\s*$/i.exec((kurz || "").trim());
    var n = m && m[1] ? parseInt(m[1], 10) : 1;
    return MIESTO_POHOTOVOSTI[n] || "";
  }
  function minuty(t) {
    if (!t) return null;
    var p = String(t).split(":");
    return parseInt(p[0] || 0, 10) * 60 + parseInt(p[1] || 0, 10);
  }
  function hm(m) {
    var h = Math.floor(m / 60) % 24;
    return String(h).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }

  // rows: vyčistené riadky exportu (po DpbCistiRiadky.cisti). Vráti zoznam voľných častí služieb.
  function najdi(rows) {
    var O = root.DpbOsVodica;
    var skupiny = {};
    var poradie = [];
    rows.forEach(function (r) {
      if ((r.ZOBRAZIT || "").trim() !== "A") return;
      var u = O.usek(r);
      var k = u.sluzba + "|" + u.trideni + "|" + u.datum;
      if (!skupiny[k]) {
        skupiny[k] = { useky: [] };
        poradie.push(k);
      }
      skupiny[k].useky.push(u);
    });
    var out = [];
    poradie.forEach(function (k) {
      var us = skupiny[k].useky;
      var obsadena = us.some(function (u) {
        return u.pritomny && u.rid;
      });
      if (obsadena) return;
      // reprezentant: najnižšie PORADI, ktoré má použiteľný čas
      us.sort(function (a, b) {
        return a.poradi - b.poradi;
      });
      var u = us[0];
      if (!jeStandardna(u.kurz)) return;
      var odM = u.od ? u.odMin : minuty(u.nastup);
      var doM = u.od ? u.doMin : minuty(u.konec);
      if (odM == null || doM == null) return;
      if (doM < odM) doM += 1440;
      var p = u.datum.split("-").map(Number);
      out.push({
        id: k,
        dateKey: u.datum,
        kurz: u.kurz,
        line: u.kurz,
        trideni: u.trideni,
        od: hm(odM),
        do: hm(doM),
        cas: hm(odM) + " – " + hm(doM),
        odMin: odM,
        doMin: doM,
        startMs: new Date(p[0], p[1] - 1, p[2], 0, odM).getTime(),
        pohotovost: jePohotovost(u.kurz),
        nazov: jePohotovost(u.kurz) ? "Dispozičný vodič" : u.kurz,
        podnazov: jePohotovost(u.kurz) ? "Sedavá záloha" : "",
        stanicaOd: u.stanicaOd || (jePohotovost(u.kurz) ? miestoPohotovosti(u.kurz) : ""),
        stanicaDo: u.stanicaDo,
        trakcia: (u.zdroj.TYPDOPRAVY || "").trim(),
      });
    });
    out.sort(function (a, b) {
      return a.startMs - b.startMs || a.kurz.localeCompare(b.kurz);
    });
    return out;
  }

  root.DpbVolneSluzby = { najdi: najdi, jeStandardna: jeStandardna };
})(typeof window !== "undefined" ? window : globalThis);
