// Časová os vodiča – etapa 2 dátového modelu.
// Vstup: čisté riadky z DpbCistiRiadky.cisti(). Výstup: pre každého vodiča a deň jedna
// zoradená os „úsekov“ (služba, pohotovosť, neprítomnosť…) a zoznam nejasností.
// Nič nemení a nepozná prehliadač, takže ju vie použiť appka aj kontrola dát.
//
// Pravidlá, ktoré sú tu na jednom mieste:
//  - identita záznamu: výpravenka + turnus + riadok + poradie (rieši cisti-riadky.js),
//  - STAVTURNUSU 0 = pracuje, iný kód = neprítomnosť (názov z DpbCiselnikStavov),
//  - PORADI je postupnosť zmien na tej istej službe: pôvodný vodič (napr. dovolenka),
//    náhradník, vodič záložného vozidla; prítomný s neprítomným na rovnakej službe
//    a v rovnakom čase = náhrada,
//  - zácvik: stĺpce ZACVIK1–3 určujú zacvičovaného, ostatní prítomní v riadku ho vedú,
//  - koniec po polnoci sa pripočíta o 24 h, deň sa drží podľa DATUM (prevádzkový deň).
(function (root) {
  // --- pomocné funkcie (zhodné s adapter-csv.js; zhodu stráži test a nástroj porovnaj-os) ---
  function gt(ts) {
    return ts && ts.length >= 16 ? ts.substring(11, 16) : "";
  }
  function toMin(t) {
    if (!t) return 0;
    var p = t.split(":");
    return parseInt(p[0] || 0, 10) * 60 + parseInt(p[1] || 0, 10);
  }
  function cleanName(j, p) {
    j = (j || "").replace(/\s*(KPČ|Ing\.|Mgr\.|Bc\.|Dr\.|PhD\.?)\s*/g, " ").trim();
    return (j + " " + (p || "")).trim();
  }
  function cleanKurz(lk) {
    lk = (lk || "").trim();
    if (!/\d+\/\d+/.test(lk) && !/^[A-Za-zÀ-ž]+\/\d+/.test(lk)) return lk;
    var parts = lk.split("+"),
      res = [],
      lin = null;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      p = p.replace(/^(?:JME|JD|Dúbr\.?)/, "");
      var prev;
      do {
        prev = p;
        p = p.replace(/(?:str\.?|ž|JME|JD|Dúbr\.?)\s*$/, "").trim();
      } while (p !== prev);
      if (!p) continue;
      if (p.indexOf("/") >= 0) {
        lin = p.split("/")[0];
        res.push(p);
      } else if (lin) res.push(lin + "/" + p);
      else res.push(p);
    }
    return res.join("+");
  }
  function normKurz(lk, trid) {
    var k = cleanKurz(lk).replace(/\/(0+)(\d)/g, "/$2");
    if (k.indexOf("+") >= 0) {
      var p = k.split("+");
      return p[trid === 2 && p.length > 1 ? 1 : 0];
    }
    return k;
  }
  var TRKR = { "dennáKR": 1, "nočnáKR": 1, "dennáTR": 1, "nočnáTR": 1 };
  function druhSluzby(lk, stanVyj) {
    var c = cleanKurz(lk);
    if (TRKR[c]) return "vypravca";
    if (/pohotovos/i.test(lk || "")) return "pohotovost";
    if (/^944\//.test(c)) return "zasuvka944";
    if (/strieda/i.test(stanVyj || "")) return "striedac";
    return "sluzba";
  }

  function t(s) {
    return (s || "").trim();
  }
  function stamp(r) {
    return r.OPRAVILCAS || r.ZALOZILCAS || "";
  }

  function vozidla(r) {
    var res = [];
    for (var i = 1; i <= 10; i++) {
      var v = t(r["CISVOZU" + i]);
      if (!v) break;
      res.push({ cislo: v, od: gt(r["VUZ" + i + "OD"] || ""), do: gt(r["VUZ" + i + "DO"] || "") });
    }
    return res;
  }
  function zacvikRid(r) {
    var res = [];
    for (var i = 1; i <= 3; i++) {
      var z = t(r["ZACVIK" + i]);
      if (z && res.indexOf(z) < 0) res.push(z);
    }
    return res;
  }

  // Jeden riadok exportu -> úsek osi.
  function usek(r) {
    var stav = t(r.STAVTURNUSU);
    var trid = parseInt(r.TRIDENI, 10) || 1;
    var od = gt(r.SKUTNASTUP || ""),
      dox = gt(r.SKUTKONEC || "");
    var odM = toMin(od),
      doM = toMin(dox);
    // Koniec po polnoci: berie sa zo skutočných časov úseku (nie z plánu celého turnusu).
    // Dátum konca môže byť v exporte zlý (napr. 01:00 ešte s dátumom nástupu), preto sa
    // pri „skoršom“ čase konca pripočíta deň aj bez zmeny dátumu.
    var dni = 0;
    if (r.SKUTNASTUP && r.SKUTKONEC) {
      var d0 = Date.parse((r.SKUTNASTUP || "").substring(0, 10)),
        d1 = Date.parse((r.SKUTKONEC || "").substring(0, 10));
      if (!isNaN(d0) && !isNaN(d1) && d1 > d0) dni = Math.round((d1 - d0) / 86400000);
    }
    doM += dni * 1440;
    var zlyDatumKonca = false;
    if (od && dox && doM < odM) {
      doM += 1440;
      zlyDatumKonca = dni === 0;
    }
    var poPolnoci = doM >= 1440 || doM < odM;
    var pritomny = stav === "0";
    var ciselnik = root.DpbCiselnikStavov;
    return {
      kluc: [t(r.CISLO_VYPRAVENKY), t(r.CISLOTURNUSU), t(r.RADEK), t(r.PORADI)].join("|"),
      sluzba: [t(r.CISLO_VYPRAVENKY), t(r.CISLOTURNUSU), t(r.RADEK)].join("|"),
      poradi: parseInt(r.PORADI, 10) || 0,
      rid: t(r.RIDIC_CISLO),
      meno: cleanName(r.RIDIC_JMENO, r.RIDIC_PRIJMENI),
      datum: (r.DATUM || "").substring(0, 10),
      pritomny: pritomny,
      druh: pritomny ? druhSluzby(r.LINKAKURZ, r.STANSMERVYJEZD) : "nepritomnost",
      stav: stav,
      popisStavu: pritomny ? "" : (ciselnik && ciselnik.nazov(stav)) || "kód " + stav,
      kurz: normKurz(r.LINKAKURZ || "", trid),
      trideni: trid,
      turnus: t(r.CISLOTURNUSU),
      od: od,
      do: dox,
      odMin: odM,
      doMin: doM,
      poPolnoci: poPolnoci,
      zlyDatumKonca: zlyDatumKonca,
      nastup: gt(r.NASTUP || ""),
      konec: gt(r.KONEC || ""),
      stanicaOd: t(r.STANSMERVYJEZD),
      stanicaDo: t(r.STANSMERPRIJEZD),
      vozidla: pritomny ? vozidla(r) : [],
      zacvikRid: zacvikRid(r),
      vlastnosti: { zobrazit: t(r.ZOBRAZIT), tridenie: t(r.TRIDENI) },
      zmena: stamp(r),
      zdroj: r,
    };
  }

  function prekryv(a, b) {
    return a.odMin + 1 < b.doMin && b.odMin + 1 < a.doMin;
  }

  // Hradenie záložným vozidlom (kurz 944): vodič záložného vozidla preberá časť cudzej služby.
  // Jeho úsek služby, ktorý nadväzuje na úsek 944 (koniec = začiatok), je hradenie, nie druhý
  // vodič na tej istej službe.
  function oznacHradenia(useky) {
    var podlaVodica = {};
    useky.forEach(function (u) {
      (podlaVodica[u.rid + "|" + u.datum] = podlaVodica[u.rid + "|" + u.datum] || []).push(u);
    });
    Object.keys(podlaVodica).forEach(function (k) {
      var g = podlaVodica[k];
      var z = g.filter(function (u) {
        return u.pritomny && u.druh === "zasuvka944";
      });
      if (!z.length) return;
      g.forEach(function (u) {
        if (!u.pritomny || u.druh === "zasuvka944") return;
        var nadvazuje = z.some(function (x) {
          return Math.abs(x.doMin - u.odMin) <= 1 || Math.abs(u.doMin - x.odMin) <= 1;
        });
        if (nadvazuje) u.hradenie944 = true;
      });
    });
  }

  // Vzťahy medzi úsekmi tej istej služby (rovnaká výpravenka + turnus + riadok):
  // zácvik (kto koho vedie) a náhrada (kto za koho nastúpil a prečo).
  function vztahy(useky) {
    var podlaSluzby = {};
    useky.forEach(function (u) {
      (podlaSluzby[u.sluzba] = podlaSluzby[u.sluzba] || []).push(u);
    });
    var problemy = [];
    Object.keys(podlaSluzby).forEach(function (k) {
      var g = podlaSluzby[k].slice().sort(function (a, b) {
        return a.poradi - b.poradi;
      });
      var zRid = {};
      g.forEach(function (u) {
        u.zacvikRid.forEach(function (z) {
          zRid[z] = 1;
        });
      });
      var prit = g.filter(function (u) {
        return u.pritomny && u.rid;
      });
      var nepr = g.filter(function (u) {
        return !u.pritomny && u.rid;
      });
      // zácvik
      prit.forEach(function (u) {
        if (!Object.keys(zRid).length) return;
        if (zRid[u.rid]) u.zacvik = { rola: "zacvicovany" };
        else u.zacvik = { rola: "veduci" };
      });
      prit.forEach(function (u) {
        if (!u.zacvik) return;
        var partneri = prit.filter(function (x) {
          return x !== u && x.rid !== u.rid && x.zacvik && x.zacvik.rola !== u.zacvik.rola;
        });
        u.zacvik.partneri = partneri.map(function (x) {
          return { rid: x.rid, meno: x.meno };
        });
        // zacvičovaný bez zhodnej dvojice (jeho riadok chýba) sa berie z ZACVIK stĺpcov
        if (u.zacvik.rola === "veduci" && !u.zacvik.partneri.length)
          u.zacvik.partneri = u.zacvikRid.map(function (z) {
            return { rid: z, meno: "" };
          });
      });
      // náhrada: prítomný v tej istej službe, kde je v rovnakom čase neprítomný (bez zácviku)
      prit.forEach(function (u) {
        if (u.zacvik) return;
        var za = nepr.filter(function (n) {
          return n.rid !== u.rid && prekryv(n, u);
        });
        if (za.length)
          u.nahrada = za.map(function (n) {
            return { rid: n.rid, meno: n.meno, stav: n.stav, dovod: n.popisStavu };
          });
      });
      nepr.forEach(function (n) {
        var kto = prit.filter(function (u) {
          return u.rid !== n.rid && !u.zacvik && prekryv(n, u);
        });
        if (kto.length)
          n.nahradil = kto.map(function (u) {
            return { rid: u.rid, meno: u.meno };
          });
      });
      // nejasnosť: dvaja rôzni prítomní vodiči súčasne na tej istej službe bez zácviku
      // a bez zhodného vozidla (môže ísť o chybu zadania)
      for (var i = 0; i < prit.length; i++)
        for (var j = i + 1; j < prit.length; j++) {
          var a = prit[i],
            b = prit[j];
          if (a.rid === b.rid || a.zacvik || b.zacvik) continue;
          // len bežné služby (číselný kurz): školenia, pohotovosť a pod. majú viac ľudí naraz bežne
          if (a.druh !== "sluzba" || b.druh !== "sluzba" || !/^\d/.test(a.kurz)) continue;
          if (a.hradenie944 || b.hradenie944) continue;
          if (!prekryv(a, b)) continue;
          var va = a.vozidla.map(function (v) {
            return v.cislo;
          });
          var spolu = b.vozidla.some(function (v) {
            return va.indexOf(v.cislo) >= 0;
          });
          if (!spolu)
            problemy.push({
              druh: "dvaja_pritomni_bez_zacviku",
              datum: a.datum,
              sluzba: k,
              rid: [a.rid, b.rid],
              text: a.meno + " a " + b.meno + " sú naraz na službe " + a.kurz + " bez zácviku a bez spoločného vozidla",
            });
        }
    });
    return problemy;
  }

  // Hlavná funkcia: rows = čisté riadky.
  function postav(rows) {
    var useky = rows
      .filter(function (r) {
        return r.CISLO_VYPRAVENKY && t(r.RIDIC_CISLO) && (r.DATUM || "").length >= 10;
      })
      .map(usek);
    oznacHradenia(useky);
    var problemy = vztahy(useky);

    var vodici = {};
    useky.forEach(function (u) {
      var v = (vodici[u.rid] = vodici[u.rid] || { rid: u.rid, meno: u.meno, dni: {} });
      if (!v.meno && u.meno) v.meno = u.meno;
      var d = (v.dni[u.datum] = v.dni[u.datum] || { datum: u.datum, useky: [], problemy: [] });
      d.useky.push(u);
    });
    Object.keys(vodici).forEach(function (rid) {
      Object.keys(vodici[rid].dni).forEach(function (datum) {
        var d = vodici[rid].dni[datum];
        d.useky.sort(function (a, b) {
          return a.odMin - b.odMin || a.doMin - b.doMin || a.poradi - b.poradi;
        });
        // nejasnosti jedného vodiča v jednom dni
        var prit = d.useky.filter(function (u) {
          return u.pritomny;
        });
        for (var i = 0; i < prit.length; i++)
          for (var j = i + 1; j < prit.length; j++) {
            var a = prit[i],
              b = prit[j];
            if (a.sluzba === b.sluzba) continue; // dve vozidlá v tej istej službe = hradenie
            if (a.kurz === b.kurz) continue;
            if (prekryv(a, b))
              d.problemy.push({
                druh: "prekryv_sluzieb",
                datum: datum,
                rid: [rid],
                text: a.kurz + " a " + b.kurz + " sa prekrývajú",
              });
          }
        prit.forEach(function (u) {
          if (u.druh === "sluzba" && /^\d/.test(u.kurz) && !u.vozidla.length)
            d.problemy.push({
              druh: "bez_vozidla",
              datum: datum,
              rid: [rid],
              text: "služba " + u.kurz + " nemá vozidlo",
            });
        });
        d.useky.forEach(function (u) {
          if (!u.pritomny && /^kód /.test(u.popisStavu))
            d.problemy.push({ druh: "neznamy_kod_stavu", datum: datum, rid: [rid], text: "neznámy kód neprítomnosti " + u.stav });
        });
      });
    });
    return { vodici: vodici, problemy: problemy, pocetUsekov: useky.length };
  }

  root.DpbOsVodica = {
    postav: postav,
    usek: usek,
    pomocne: { gt: gt, toMin: toMin, cleanKurz: cleanKurz, normKurz: normKurz, cleanName: cleanName, druhSluzby: druhSluzby },
  };
})(typeof window !== "undefined" ? window : globalThis);
