// Čistenie riadkov exportu D_VYPR_POL – prvá etapa dátového modelu.
// Vstup: surové riadky (objekty so stĺpcami exportu). Výstup: riadky, ktoré platia.
// Nemá závislosť na prehliadači, takže ho používa aj kontrola dát (tools/kontrola-dat.mjs).
(function (root) {
  function stamp(r) {
    return r.OPRAVILCAS || r.ZALOZILCAS || "";
  }

  // 1) Verzie riadkov: export obsahuje viac verzií toho istého riadku
  //    (CISLO_VYPRAVENKY + CISLOTURNUSU + RADEK + PORADI). Platí najnovšia podľa
  //    OPRAVILCAS (alebo ZALOZILCAS); pri zhode času platí neskorší riadok v súbore.
  function najnovsieVerzie(rows) {
    var best = {},
      order = [];
    rows.forEach(function (r) {
      if (!r.CISLO_VYPRAVENKY) {
        order.push({ r: r });
        return;
      }
      var key = r.CISLO_VYPRAVENKY + "|" + (r.CISLOTURNUSU || "") + "|" + r.RADEK + "|" + r.PORADI;
      var cur = best[key];
      if (!cur) {
        best[key] = { r: r, stamp: stamp(r) };
        order.push(best[key]);
      } else if (stamp(r) >= cur.stamp) {
        cur.r = r;
        cur.stamp = stamp(r);
      }
    });
    return order.map(function (o) {
      return o.r;
    });
  }

  // 1b) Poistka: ak sa pri úprave zmenil turnus riadku, stará verzia s iným turnusom
  //     by pri kľúči s turnusom zostala vedľa novej. Pre rovnakú výpravenku + riadok +
  //     poradie preto platí len verzia s najneskoršou úpravou.
  function bezZmenenehoTurnusu(rows) {
    var best = {};
    rows.forEach(function (r) {
      if (!r.CISLO_VYPRAVENKY) return;
      var k = r.CISLO_VYPRAVENKY + "|" + r.RADEK + "|" + r.PORADI;
      var c = best[k];
      if (!c || stamp(r) >= stamp(c)) best[k] = r;
    });
    return rows.filter(function (r) {
      return !r.CISLO_VYPRAVENKY || best[r.CISLO_VYPRAVENKY + "|" + r.RADEK + "|" + r.PORADI] === r;
    });
  }

  // 1c) Presné duplicity: ten istý vodič je v tom istom riadku výpravenky viackrát
  //     s rovnakými časmi, kurzom aj vozidlom (rovnaký záznam zapísaný dvakrát pod
  //     iným poradím). Ostane ten s nižším PORADI. Rôzne časy (delená služba) sa nerušia.
  function bezPresnychDuplicit(rows) {
    var seen = {},
      drop = [];
    rows.forEach(function (r) {
      if (!r.CISLO_VYPRAVENKY || !r.RIDIC_CISLO) return;
      var k = [r.CISLO_VYPRAVENKY, r.CISLOTURNUSU || "", r.RADEK, r.RIDIC_CISLO, r.LINKAKURZ, r.STAVTURNUSU, r.NASTUP, r.KONEC, r.SKUTNASTUP, r.SKUTKONEC, r.CISVOZU1].join("|");
      var o = seen[k];
      if (!o) seen[k] = r;
      else if ((parseInt(r.PORADI) || 0) < (parseInt(o.PORADI) || 0)) {
        drop.push(o);
        seen[k] = r;
      } else drop.push(r);
    });
    if (!drop.length) return rows;
    return rows.filter(function (r) {
      return drop.indexOf(r) < 0;
    });
  }

  // 2) Zastarané riadky: ak sa dve aktívne služby toho istého vodiča v ten istý deň
  //    časovo prekrývajú (o viac ako minútu), jeden z nich je pozostatok starej
  //    verzie, ktorý po neskoršej úprave susedných úsekov nikto neprepísal.
  //    Platí ten, ktorý bol upravený neskôr. Pri rovnakom čase sa nič nemení.
  //    Úseky toho istého kurzu (napr. 944) sa môžu prekrývať, tie sa nerušia.
  function span(r) {
    var s0 = Date.parse(r.SKUTNASTUP.replace(" ", "T")),
      e0 = Date.parse(r.SKUTKONEC.replace(" ", "T"));
    if (e0 <= s0) e0 += 86400000; // koniec po polnoci
    return [s0, e0];
  }
  function bezZastaranych(rows) {
    var grp = {};
    rows.forEach(function (r) {
      if (r.STAVTURNUSU !== "0" || !r.RIDIC_CISLO || !r.SKUTNASTUP || !r.SKUTKONEC) return;
      var k = r.RIDIC_CISLO + "|" + (r.DATUM || "").substring(0, 10);
      (grp[k] = grp[k] || []).push(r);
    });
    var stale = [];
    Object.keys(grp).forEach(function (k) {
      var g = grp[k];
      for (var i = 0; i < g.length; i++)
        for (var j = i + 1; j < g.length; j++) {
          var a = g[i],
            b = g[j];
          if (a.CISLO_VYPRAVENKY === b.CISLO_VYPRAVENKY && a.RADEK === b.RADEK) continue;
          if (a.LINKAKURZ === b.LINKAKURZ) continue;
          var x = span(a),
            y = span(b);
          if (x[0] + 60000 < y[1] && y[0] + 60000 < x[1]) {
            if (stamp(a) < stamp(b)) stale.push(a);
            else if (stamp(b) < stamp(a)) stale.push(b);
          }
        }
    });
    if (!stale.length) return rows;
    return rows.filter(function (r) {
      return stale.indexOf(r) < 0;
    });
  }

  function cisti(rows) {
    return bezZastaranych(bezPresnychDuplicit(bezZmenenehoTurnusu(najnovsieVerzie(rows))));
  }

  root.DpbCistiRiadky = { cisti: cisti, najnovsieVerzie: najnovsieVerzie, bezZmenenehoTurnusu: bezZmenenehoTurnusu, bezPresnychDuplicit: bezPresnychDuplicit, bezZastaranych: bezZastaranych };
})(typeof window !== "undefined" ? window : globalThis);
