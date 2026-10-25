// Kto je práve na výpravni (KR a TR). Čistá logika bez DOM: z modelu vodičov (RAW.models) nájde karty
// druhu TRKR (dennáKR, nočnáKR, dennáTR, nočnáTR) a povie, kto je v danom čase "teraz" a kto nasleduje.
(function (root) {
  function toMin(t) {
    if (!t) return 0;
    var p = String(t).split(":");
    return parseInt(p[0] || 0, 10) * 60 + parseInt(p[1] || 0, 10);
  }
  function kluc(d) {
    return (
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    );
  }
  function posun(datumKey, dni) {
    var p = datumKey.split("-");
    return kluc(new Date(+p[0], +p[1] - 1, +p[2] + dni));
  }
  // "dennáKR" / "nočnáTR" -> "KR" | "TR" | null
  function skupina(kurz) {
    var m = /(KR|TR)\s*$/.exec(String(kurz || ""));
    return m ? m[1] : null;
  }

  // models: {rid:[{datum, karty:[...]}]}, drivers: {rid: meno}
  // datumKey: "2026-10-19", minuta: minúta dňa (0–1439) na zvolenom dni.
  // Vráti {KR:{teraz:[{rid,meno,kurz,od,do}], dalsi:[...]}, TR:{...}}.
  function kto(models, drivers, datumKey, minuta) {
    var dni = [
      [posun(datumKey, -1), -1440],
      [datumKey, 0],
      [posun(datumKey, 1), 1440],
    ];
    var zoznam = { KR: [], TR: [] };
    Object.keys(models || {}).forEach(function (rid) {
      (models[rid] || []).forEach(function (den) {
        var d = null;
        for (var i = 0; i < dni.length; i++) if (dni[i][0] === den.datum) d = dni[i];
        if (!d) return;
        (den.karty || []).forEach(function (k) {
          if (k.vzor !== "TRKR") return;
          var g = skupina(k.kurz);
          if (!g) return;
          var od = (k.od_min != null ? k.od_min : toMin(k.od)) + d[1];
          var do_ = (k.do_min != null ? k.do_min : toMin(k.do)) + d[1];
          zoznam[g].push({
            rid: rid,
            meno: (drivers && drivers[rid]) || rid,
            kurz: k.kurz,
            od: od,
            do: do_,
            odTxt: k.od,
            doTxt: k.do,
          });
        });
      });
    });
    var out = {};
    ["KR", "TR"].forEach(function (g) {
      var z = zoznam[g];
      var teraz = z.filter(function (x) {
        return x.od <= minuta && minuta < x.do;
      });
      var buduce = z
        .filter(function (x) {
          return x.od > minuta;
        })
        .sort(function (a, b) {
          return a.od - b.od;
        });
      var najskor = buduce.length ? buduce[0].od : null;
      out[g] = {
        teraz: teraz,
        dalsi: buduce.filter(function (x) {
          return x.od === najskor;
        }),
      };
    });
    return out;
  }

  // Pevná obsadenosť dňa (pre iný deň než dnes): {KR:{denna:[..],nocna:[..]}, TR:{...}}
  function dennaNocna(models, drivers, datumKey) {
    var out = { KR: { denna: [], nocna: [] }, TR: { denna: [], nocna: [] } };
    Object.keys(models || {}).forEach(function (rid) {
      (models[rid] || []).forEach(function (den) {
        if (den.datum !== datumKey) return;
        (den.karty || []).forEach(function (k) {
          if (k.vzor !== "TRKR") return;
          var g = skupina(k.kurz);
          if (!g) return;
          var noc = /^no/i.test(String(k.kurz || "").trim());
          out[g][noc ? "nocna" : "denna"].push({ rid: rid, meno: (drivers && drivers[rid]) || rid, odTxt: k.od, doTxt: k.do, od: k.od_min != null ? k.od_min : toMin(k.od), do: k.do_min != null ? k.do_min : toMin(k.do), noc: noc });
        });
      });
    });
    return out;
  }

  // Kto je na sedavej zálohe (pohotovosť E1 = Trnávka/TR, E2 = Krasňany/KR) počas úseku [od,do]
  // (minúty dňa datumKey, môžu presiahnuť 1440). Vráti [{rid,meno,od,do}] podľa času.
  function sedava(models, drivers, datumKey, g, od, do_) {
    var cislo = g === "TR" ? 1 : 2, res = [];
    var dni = [[posun(datumKey, -1), -1440], [datumKey, 0], [posun(datumKey, 1), 1440]];
    Object.keys(models || {}).forEach(function (rid) {
      (models[rid] || []).forEach(function (den) {
        var d = null;
        for (var i = 0; i < dni.length; i++) if (dni[i][0] === den.datum) d = dni[i];
        if (!d) return;
        (den.karty || []).forEach(function (k) {
          if (k.vzor !== "POHOTOVOSŤ") return;
          var m = /(\d+)\s*$/.exec(String(k.kurz || ""));
          if (!m || parseInt(m[1], 10) !== cislo) return;
          var a = (k.od_min != null ? k.od_min : toMin(k.od)) + d[1];
          var b = (k.do_min != null ? k.do_min : toMin(k.do)) + d[1];
          if (a < do_ && b > od) res.push({ rid: rid, meno: (drivers && drivers[rid]) || rid, od: a, do: b, odTxt: k.od, doTxt: k.do });
        });
      });
    });
    return res.sort(function (x, y) { return x.od - y.od; });
  }

  root.DpbVypravna = { kto: kto, skupina: skupina, kluc: kluc, dennaNocna: dennaNocna, sedava: sedava };
})(typeof window !== "undefined" ? window : globalThis);
