// Karty služieb z úsekov časovej osi (etapa 3). Zatiaľ pre neprítomnosť a obyčajnú službu;
// ďalšie druhy (pohotovosť, 944, výpravca…) pribudnú po jednom, vždy s porovnaním so starým výstupom.
// Vstup: úsek z DpbOsVodica.usek(riadok). Výstup: objekt karty v tvare, ktorý čaká appka.
(function (root) {
  function nepritomnost(u) {
    return {
      vzor: "NEPRÍTOMNOSŤ",
      kurz: u.kurz,
      od: u.od,
      do: u.do,
      stan_od: u.stanicaOd,
      stan_do: u.stanicaDo,
      kod: parseInt(u.stav, 10) || 0,
      popis: u.popisStavu,
    };
  }

  // Základné polia obyčajnej služby. Predchodca, nasledovník, zácvik a prestávky dopĺňa
  // zatiaľ adaptér (kroky 3 a 4).
  function sluzbaZaklad(u, vzor) {
    return {
      vzor: vzor || "SLUŽBA",
      kurz: u.kurz,
      od: u.od,
      do: u.do,
      trideni: u.trideni,
      stan_od: u.stanicaOd,
      stan_do: u.stanicaDo,
      vozidla: u.vozidla,
      od_min: u.odMin,
      do_min: u.doMin,
    };
  }

  // Základ karty podľa druhu: STRIEDAČ má len skrátený tvar, ostatné (SLUŽBA, POHOTOVOSŤ, TRKR)
  // majú polia služby + prázdny zoznam striedačov. pn = {pred, nasl}.
  function kartaZaklad(u, vzor, pn) {
    if (vzor === "STRIEDA\u010c") {
      return {
        vzor: "STRIEDA\u010c",
        kurz: u.kurz,
        od: u.od,
        do: u.do,
        zast\u00e1vka: u.stanicaOd || u.stanicaDo || "",
        kurzy: [],
        pred: pn.pred,
        nasl: pn.nasl,
      };
    }
    return Object.assign(sluzbaZaklad(u, vzor), { striedaci: [], pred: pn.pred, nasl: pn.nasl });
  }

  // --- Pohotovosť -------------------------------------------------------------------------
  // Viac úsekov pohotovosti jedného vodiča v jednom dni sa zlúči do jednej karty: od = najskorší
  // začiatok, do = najneskorší koniec (podľa minút osi, takže funguje aj cez polnoc).
  function zlucPohotovosti(karty) {
    var poh = karty.filter(function (k) {
      return k.vzor === "POHOTOVOS\u0164";
    });
    var other = karty.filter(function (k) {
      return k.vzor !== "POHOTOVOS\u0164";
    });
    if (poh.length <= 1) return karty;
    var zac = poh.reduce(function (a, b) {
      return b.od_min < a.od_min ? b : a;
    });
    var kon = poh.reduce(function (a, b) {
      return b.do_min > a.do_min ? b : a;
    });
    return [
      Object.assign({}, poh[0], { od: zac.od, do: kon.do, od_min: zac.od_min, do_min: kon.do_min }),
    ].concat(other);
  }

  // Pohotovosť tvorí „obálku“ (od najskoršieho začiatku po najneskorší koniec úsekov). Úseky inej služby, ktoré vodič
  // z pohotovosti odrobil, zostávajú SAMOSTATNÝMI kartami (od v27: už sa nevnárajú do karty pohotovosti ako zásky).
  // Čo je v obálke, nie je samostatný výkon; presah mimo obálku je ďalší výkon. Funkcia zostáva kvôli zhode rozhrania.
  function vnorDoPohotovosti(karty, pohUseky) {
    return karty;
  }

  // --- Záložné vozidlo 944 ----------------------------------------------------------------
  // Z aktívnych úsekov vodiča (jeden deň) poskladá reťaze úsekov, ktoré na seba časovo nadväzujú
  // (koniec jedného = začiatok ďalšieho). Reťaz, v ktorej je kurz 944, je jedna karta „944“:
  // názov = najnižšie číslo 944, ostatné úseky reťaze sú hradenia. Ostatné reťaze sa vracajú ako
  // zostatok na obyčajné karty. predNasl(riadok) dodá predchodcu a nasledovníka (krok 3).
  function zasuvka944(active, predNasl, normKurz) {
    var r944 = active.filter(function (u) {
      return u.druh === "zasuvka944";
    });
    if (!r944.length) return { karty: [], zostatok: active };
    var cmpOd = function (a, b) {
      return a.od < b.od ? -1 : 1;
    };
    var cisloKurzu = function (k) {
      var m = k.match(/944\/(\d+)/);
      return m ? parseInt(m[1], 10) : 999;
    };
    var obalKurz = r944.reduce(function (best, u) {
      var k = normKurz(u.zdroj.LINKAKURZ, 1);
      return cisloKurzu(k) < cisloKurzu(best) ? k : best;
    }, normKurz(r944[0].zdroj.LINKAKURZ, 1));
    var byN = {};
    active.forEach(function (u) {
      (byN[u.od] = byN[u.od] || []).push(u);
    });
    var vis = {},
      chains = [];
    var kl = function (u) {
      return (u.zdroj.LINKAKURZ || "") + "|" + u.od;
    };
    active
      .slice()
      .sort(cmpOd)
      .forEach(function (sr) {
        if (vis[kl(sr)]) return;
        vis[kl(sr)] = 1;
        var chain = [sr],
          cur = sr;
        while (true) {
          var nxt = null,
            cands = byN[cur.do] || [];
          for (var ci = 0; ci < cands.length; ci++) {
            if (!vis[kl(cands[ci])]) {
              nxt = cands[ci];
              vis[kl(nxt)] = 1;
              break;
            }
          }
          if (!nxt) break;
          chain.push(nxt);
          cur = nxt;
        }
        chains.push(chain);
      });
    var oChains = chains.filter(function (c) {
      return c.some(function (u) {
        return u.druh === "zasuvka944";
      });
    });
    var zostatok = [];
    chains.forEach(function (c) {
      if (oChains.indexOf(c) < 0)
        c.forEach(function (u) {
          zostatok.push(u);
        });
    });
    var karty = oChains.map(function (chain) {
      var cs = chain.slice().sort(cmpOd);
      var odM = Math.min.apply(null, cs.map(function (u) { return u.odMin; })),
        doM = Math.max.apply(null, cs.map(function (u) { return u.doMin; }));
      var hradenia = cs
        .filter(function (u) {
          return u.kurz !== obalKurz;
        })
        .map(function (u) {
          return { kurz: u.kurz, od: u.od, do: u.do, vozidla: u.vozidla, stan_od: u.stanicaOd || "", stan_do: u.stanicaDo || "", segmenty: [] };
        });
      var pn = predNasl(cs[0].zdroj);
      if (!pn.nasl && cs.length > 1) pn.nasl = predNasl(cs[cs.length - 1].zdroj).nasl;
      return {
        vzor: "944",
        kurz: obalKurz,
        od: cs[0].od,
        do: cs[cs.length - 1].do,
        od_min: odM,
        do_min: doM,
        hradenia: hradenia,
        // miesto: z vlastných úsekov 944 – odkiaľ prvý vychádza a kam posledný prichádza
        stan_od: (cs.filter(function (u) { return u.kurz === obalKurz; })[0] || {}).stanicaOd || "",
        stan_do: (cs.filter(function (u) { return u.kurz === obalKurz; }).slice(-1)[0] || {}).stanicaDo || "",
        // vozidlo samotnej služby 944 (záložné vozidlo) – z úsekov reťaze s kurzom 944
        vozidla: cs
          .filter(function (u) {
            return u.kurz === obalKurz;
          })
          .reduce(function (a, u) {
            return a.concat(u.vozidla || []);
          }, []),
        segmenty: [],
        pred: pn.pred,
        nasl: pn.nasl,
      };
    });
    return { karty: karty, zostatok: zostatok };
  }


  // --- Predchodca a nasledovník -----------------------------------------------------------
  // Index prítomných úsekov podľa dňa, aby sa pre kartu nemuseli prehľadávať všetky riadky dňa.
  // byDate = { "RRRR-MM-DD": [riadky dňa v poradí exportu] }, usekFn = DpbOsVodica.usek.
  function indexDna(byDate, usekFn) {
    var out = {};
    Object.keys(byDate).forEach(function (d) {
      var koncia = {},
        zacinaju = {},
        poRid = {};
      byDate[d].forEach(function (r) {
        var u = usekFn(r);
        if (!u.rid || !u.pritomny) return;
        (koncia[u.kurz + "|" + u.do] = koncia[u.kurz + "|" + u.do] || []).push(u);
        (zacinaju[u.kurz + "|" + u.od] = zacinaju[u.kurz + "|" + u.od] || []).push(u);
        (poRid[u.rid] = poRid[u.rid] || []).push(u);
      });
      out[d] = { koncia: koncia, zacinaju: zacinaju, poRid: poRid };
    });
    return out;
  }

  // Predchodca: iný vodič končí na tom istom obehu v čase môjho nástupu. Nasledovník: iný vodič
  // nastupuje na tom istom obehu v čase môjho konca (nie ak služba končí v depe).
  // names = { rid: meno } (poradie kľúčov rozhoduje pri výpravcovi).
  function predNasl(u, idx, names) {
    var d = idx[u.datum];
    var pred = null,
      nasl = null;
    if (!d) return { pred: pred, nasl: nasl };
    var stanDo = (u.stanicaDo || "").toLowerCase();
    var konciVDepe = stanDo.indexOf("depo") >= 0 || stanDo.indexOf("dp.") >= 0 || stanDo.indexOf("vozov\u0148a") >= 0;
    var iny = function (x) {
      return x.rid !== u.rid;
    };
    var p = (d.koncia[u.kurz + "|" + u.od] || []).filter(iny)[0];
    if (p) pred = { rid: p.rid, meno: names[p.rid] || p.rid, cas: u.od };
    if (!konciVDepe) {
      var n = (d.zacinaju[u.kurz + "|" + u.do] || []).filter(iny)[0];
      if (n) nasl = { rid: n.rid, meno: names[n.rid] || n.rid, cas: u.do };
    }
    return { pred: pred, nasl: nasl };
  }

  // Výpravca (denná/nočná KR a TR): predchodca a nasledovník sú iní vodiči v rovnakej skupine
  // (KR/TR) v susednom dni – denná KR dňa X: pred = nočná dňa X-1, nasl = nočná dňa X;
  // nočná KR dňa X: pred = denná dňa X, nasl = denná dňa X+1.
  function predNaslVypravca(u, idx, names) {
    var base = u.datum;
    if (!base) return { pred: null, nasl: null };
    var myKurz = (u.zdroj.LINKAKURZ || "").toLowerCase();
    var myGrp = myKurz.indexOf("kr") >= 0 ? "kr" : "tr";
    var nocna = myKurz.indexOf("no") >= 0;
    function posun(d, delta) {
      var dt = new Date(d);
      dt.setDate(dt.getDate() + delta);
      return dt.toISOString().substring(0, 10);
    }
    var predDen = nocna ? base : posun(base, -1),
      naslDen = nocna ? posun(base, 1) : base;
    var typ = nocna ? "de" : "no";
    function najdi(den) {
      var d = idx[den];
      if (!d) return null;
      var nasiel = null;
      Object.keys(names).some(function (xrid) {
        if (xrid === u.rid) return false;
        var ok = (d.poRid[xrid] || []).some(function (x) {
          var xk = (x.zdroj.LINKAKURZ || "").toLowerCase();
          return xk.indexOf(myGrp) >= 0 && xk.indexOf(typ) >= 0;
        });
        if (ok) nasiel = { rid: xrid, meno: names[xrid] || xrid };
        return ok;
      });
      return nasiel;
    }
    return { pred: najdi(predDen), nasl: najdi(naslDen) };
  }

  // Prestávky: ku každej SLUŽBE nájde, kto jazdí striedač (strKurz) v čase prebratia.
  // Pôvodná logika (pre každú prestávku sa prehľadali všetci vodiči) je nahradená indexom
  // den -> kurz -> [{rid, od, do}] v poradí vodičov a kariet; výsledok je rovnaký.
  function pridajPrestavky(modelsOut, driversOut, str, dayTypeFn, toMin) {
    if (!str) return;
    var rev = {};
    Object.keys(str).forEach(function (key) {
      var parts = key.split("|");
      (str[key] || []).forEach(function (slot) {
        (slot.k || []).forEach(function (p) {
          var rk = p.kurz + "|" + parts[1];
          (rev[rk] = rev[rk] || []).push({
            zastávka: slot.z || "",
            strKurz: parts[0],
            prebera: p.prebera,
            odovzdava: p.odovzdava,
          });
        });
      });
    });
    var idx = {};
    Object.keys(modelsOut).forEach(function (rid) {
      (modelsOut[rid] || []).forEach(function (d) {
        (d.karty || []).forEach(function (kk) {
          if (kk.vzor !== "SLUŽBA" && kk.vzor !== "STRIEDAČ") return;
          var ok = kk.od_min != null ? kk.od_min : toMin(kk.od);
          var dk = kk.do_min != null ? kk.do_min : toMin(kk.do);
          var key = d.datum + "|" + kk.kurz;
          (idx[key] = idx[key] || []).push({ rid: rid, od: ok, do: dk });
        });
      });
    });
    Object.keys(modelsOut).forEach(function (rid) {
      (modelsOut[rid] || []).forEach(function (den) {
        var date = den.datum;
        var dayType = dayTypeFn(date);
        (den.karty || []).forEach(function (k) {
          if (k.vzor !== "SLUŽBA") return;
          var hits = rev[k.kurz + "|" + dayType] || [];
          if (!hits.length) return;
          var odM = k.od_min || 0;
          var doM = k.do_min || 1440;
          var rel = hits.filter(function (p) {
            var pm = toMin(p.prebera);
            return pm >= odM && pm <= doM;
          });
          if (!rel.length) return;
          k["prestávka"] = rel.map(function (p) {
            var pm = toMin(p.prebera);
            var meno = "";
            (idx[date + "|" + p.strKurz] || []).some(function (c) {
              if (c.rid === rid) return false;
              if (c.od > pm || pm > c.do) return false;
              meno = driversOut[c.rid] || "";
              return true;
            });
            return {
              prebera: p.prebera,
              odovzdava: p.odovzdava,
              zastávka: p.zastávka,
              str_kurz: p.strKurz,
              str_meno: meno,
            };
          });
        });
      });
    });
  }

  root.DpbKartaZUseku = {
    nepritomnost: nepritomnost,
    sluzbaZaklad: sluzbaZaklad,
    kartaZaklad: kartaZaklad,
    zlucPohotovosti: zlucPohotovosti,
    vnorDoPohotovosti: vnorDoPohotovosti,
    zasuvka944: zasuvka944,
    indexDna: indexDna,
    predNasl: predNasl,
    predNaslVypravca: predNaslVypravca,
    pridajPrestavky: pridajPrestavky,
  };
})(typeof window !== "undefined" ? window : globalThis);
