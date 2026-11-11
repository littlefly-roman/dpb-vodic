/* Pracovný výkaz mesiaca: zobrazenie na obrazovke (zoom, posun) a až potom tlač / uložiť ako PDF.
   Počíta sa v telefóne z už načítaných dát (karty služieb). Nič sa nikam neposiela. */
(function () {
  var DNI = ["ne", "po", "ut", "st", "št", "pi", "so"];
  var MESIACE = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  var NOC_OD = 22 * 60, NOC_DO = 6 * 60; // nočné hodiny (neskôr z databázy: S_PARAMSTRED NOCOD/NOCDO)
  var VOZ = ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"];

  function p2(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function f(min) { return Math.floor(min / 60) + ":" + p2(min % 60); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  // zarovnanie na dvojbodku / lomku / bodku: pevná šírka pred oddeľovačom, číslice rovnakej šírky
  function ft(min) { return '<span class="h">' + Math.floor(min / 60) + "</span>:" + p2(min % 60); }
  function fsl(t) { var i = String(t).indexOf("/"); return i < 0 ? esc(t) : '<span class="h">' + esc(String(t).slice(0, i)) + "</span>/" + esc(String(t).slice(i + 1)); }
  function fdat(t) { var m = /^(\d+)(\..*)$/.exec(t || ""); return m ? '<span class="h">' + m[1] + "</span>" + esc(m[2]) : esc(t); }
  function tmin(t) { var m = /(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; }
  function ov(a, b, c, d) { return Math.max(0, Math.min(b, d) - Math.max(a, c)); }
  function vodic() {
    var rid = window.appState && window.appState.currentDriver;
    var d = (window.DPBData ? DPBData.getDrivers() : []).filter(function (x) { return String(x.rid) === String(rid); })[0];
    return { rid: rid, meno: d ? d.meno : String(rid || "") };
  }
  function sluzbyDna(rid, key) {
    var st = window.appState;
    if (st && st.servicesByDate && st.servicesByDate[key]) return st.servicesByDate[key];
    return window.DPBData ? DPBData.getServicesForDate(rid, key) : [];
  }
  // Druhá práca: záznamy z vlastného kalendára vodiča prevedené na „karty“, aby ich spracoval ten istý výpočet
  var DP_KOD = { dov: 1, lekar: 3, pn: 7, nahr: 9001, ine: 8 };
  function dpSluzby(key) {
    if (!window.DpbDruhaPraca) return [];
    return DpbDruhaPraca.pre(key).map(function (e) {
      if (!e.typ || e.typ === "sluzba") {
        if (e.od == null || e["do"] == null) return null;
        return { _vzor: "SLUŽBA", line: "Služba", time: "", _karta: { _dp: 1, od_min: e.od, do_min: e["do"], vozidla: [], _dpCisty: DpbDruhaPraca.cisty(e) } };
      }
      var dl = e.od != null && e["do"] != null ? e["do"] - e.od : 0;
      return { _vzor: "NEPRÍTOMNOSŤ", _karta: { _dp: 1, kod: DP_KOD[e.typ] || 8, popis: e.t || "Neprítomnosť", od_min: e.od, do_min: e["do"], _dpKredit: dl } };
    }).filter(Boolean);
  }
  // Neprítomnosti (kódy zo STAVTURNUSU): iný druh práce = výkon, neplatené sa nepočítajú, PN a príbuzné len po–pi, ostatné platené každý deň
  var PRACA = { 11: 1, 16: 1, 17: 1, 18: 1, 39: 1 };                                  // prestoj, zájazd, výluka, prevod na inú prácu, refundácia
  var NEPLATENE = { 8: 1, 24: 1, 34: 1, 9: 1, 13: 1, 19: 1, 49: 1, 53: 1, 54: 1 };     // neplatené voľno, absencia, neurčená, vyžiadané voľno, nemoc neplatená, štrajk
  var STRAVNE_NEPR = { 1: 1, 3: 1, 42: 1, 57: 1, 15: 1, 27: 1, 37: 1, 47: 1, 45: 1 }; // dovolenka, návšteva lekára, preventívna prehliadka, psychologické vyšetrenie
  var LEN_PO_PI = { 7: 1, 40: 1, 41: 1, 48: 1, 51: 1, 52: 1, 56: 1, 58: 1, 12: 1, 26: 1, 36: 1, 43: 1, 59: 1, 38: 1 };
  function kredit(k, denMin) { // hodiny platenej neprítomnosti v minútach: deň / pol dňa / 1,5 dňa / „N h“
    var t = String(k.popis || ""), h = /(\d+)\s*h\b/.exec(t);
    if (h) return +h[1] * 60;
    if (/1\/2 dňa/.test(t)) return denMin / 2;
    if (/1,5 dňa/.test(t)) return denMin * 1.5;
    return denMin;
  }
  var EXTRA_SV = { "2026-05-08": 1, "2026-09-15": 1 }; // sviatok, ale nie deň pracovného pokoja
  function vzorK(s) { return s._vzor || (s._karta && s._karta.vzor) || ""; }

  // Údaje mesiaca: riadky (jedna služba = jeden riadok, vozidlá pod ňou) + súčty.
  function zber(datum, zdroj) {
    var dp = zdroj === "dp";
    var v = vodic(), y = datum.getFullYear(), m = datum.getMonth(), n = new Date(y, m + 1, 0).getDate();
    var tyz0 = (window.DpbUvazok && DpbUvazok[v.rid]) || 37.5, denMin = dp && window.DpbDruhaPraca ? DpbDruhaPraca.uvazokDen() : Math.round(tyz0 / 5 * 60);
    var prevEnd = null, rows = [], T = { dni: 0, cisty: 0, voz: 0, noc: 0, so: 0, ne: 0, sv: 0, str: 0, plat: 0, del: 0 }, nepr = {};
    for (var d = -4; d <= n; d++) { // dni pred mesiacom slúžia len na výpočet oddychu
      var dt = new Date(y, m, d), sv = (dp ? dpSluzby(kluc(dt)) : sluzbyDna(v.rid, kluc(dt))) || [], prvy = true, mal = false, r0 = rows.length, den = 0, strNepr = false, rekMal = false, casy = [];
      var sviatok = !!(window.Calendar && Calendar.isHoliday && Calendar.isHoliday(dt)) || !!EXTRA_SV[kluc(dt)]; // sviatok = deň pracovného pokoja + sviatky, ktoré ním nie sú
      sv.forEach(function (s) {
        var k = s._karta || {}, vz = vzorK(s);
        if (vz === "NEPRÍTOMNOSŤ") {
          if (d < 1) return;
          var kod = k.kod, nm = k.popis || "Neprítomnosť";
          if (kod === 50) { // Reklamácia: nie je neprítomnosť; platí sa to, čo sa v nej reklamovalo (hodiny výkonu, nočné, príplatok za delenú)
            var rk = k.rekl || {}, rv = rk.vykon || 0, rd = rk.delena || 0;
            den += rv; T.cisty += rv; T.noc += rk.noc || 0; T.del += rd;
            if (dt.getDay() === 6) T.so += rv;
            if (dt.getDay() === 0) T.ne += rv;
            if (sviatok) T.sv += rv;
            if (rv) rekMal = true;
            rows.push({ dat: prvy ? d + "." + (m + 1) + ". " + DNI[dt.getDay()] : "", prvy: prvy, znacka: prvy ? (sviatok ? "sviatok" : "") : "", sl: "Reklamácia", d: rd, cas: "", cisty: rv, voz: [], noc: rk.noc || 0, oddych: null });
            prvy = false; return;
          }
          if (PRACA[kod]) { // iný druh práce: je to výkon
            var pa = k.od_min, pb = k.do_min;
            if (pa == null || pb == null) { pa = tmin(k.od); pb = tmin(k.do); }
            if (pa == null || pb == null) return;
            if (pb <= pa) pb += 1440;
            mal = true; den += pb - pa; T.cisty += pb - pa; T.noc += ov(pa, pb, 0, NOC_DO) + ov(pa, pb, NOC_OD, 1440 + NOC_DO);
            rows.push({ dat: prvy ? d + "." + (m + 1) + ". " + DNI[dt.getDay()] : "", prvy: prvy, znacka: "", sl: nm, cas: ft(pa % 1440) + " – " + ft(pb % 1440), cisty: pb - pa, voz: [], noc: 0, oddych: null });
            prvy = false; return;
          }
          nepr[nm] = (nepr[nm] || 0) + 1;
          var kr = 0;
          if (!NEPLATENE[kod] && !(LEN_PO_PI[kod] && (dt.getDay() === 0 || dt.getDay() === 6))) kr = Math.round(kredit(k, denMin));
          T.plat += kr;
          if (STRAVNE_NEPR[kod]) strNepr = true;
          rows.push({ dat: prvy ? d + "." + (m + 1) + ". " + DNI[dt.getDay()] : "", prvy: prvy, znacka: prvy ? (sviatok ? "sviatok" : "") : "", sl: nm, nepr: true, kredit: kr, voz: [] });
          prvy = false;
          return;
        }
        if (VOZ.indexOf(vz) < 0) return;
        var a = k.od_min != null ? k.od_min : tmin((s.time || "").split(/[–-]/)[0]);
        var b = k.do_min != null ? k.do_min : tmin((s.time || "").split(/[–-]/)[1]);
        if (a == null || b == null) return;
        if (b <= a) b += 1440;
        var abs0 = Date.UTC(y, m, d) / 60000 + a, oddych = prevEnd == null ? null : abs0 - prevEnd;
        prevEnd = abs0 + (b - a);
        if (d < 1) return;
        var cc = window.DpbCistyCas && DpbCistyCas.zaKartu(k);
        var cisty = k._dp ? (k._dpCisty != null ? k._dpCisty : b - a) : cc ? cc.cisty : b - a;
        var noc = ov(a, b, 0, NOC_DO) + ov(a, b, NOC_OD, 1440 + NOC_DO);
        var voz = [], vs = k.vozidla || [];
        if (vs.length === 1 && tmin(vs[0].od) === a % 1440 && tmin(vs[0].do) === b % 1440) voz = [{ c: vs[0].cislo, min: cisty }];
        else voz = vs.map(function (x) {
          var o = tmin(x.od), e = tmin(x.do);
          if (o == null || e == null) return { c: x.cislo, min: 0 };
          if (e <= o) e += 1440;
          return { c: x.cislo, min: e - o };
        });
        if (vz === "STRIEDAČ") voz = [{ c: vs.length ? vs[0].cislo : "", min: cisty }]; // striedač má voz vždy po celý čas v práci
        var vmin = voz.reduce(function (acc, x) { return acc + x.min; }, 0);
        mal = true;
        if (vz !== "POHOTOVOSŤ" && !dp) casy.push([a, b]);
        den += cisty; T.cisty += cisty; T.voz += vmin; T.noc += noc;
        if (dt.getDay() === 6) T.so += cisty;
        if (dt.getDay() === 0) T.ne += cisty;
        if (sviatok) T.sv += cisty;
        rows.push({
          dat: prvy ? d + "." + (m + 1) + ". " + DNI[dt.getDay()] : "", prvy: prvy,
          znacka: prvy ? (sviatok ? "sviatok" : "") : "",
          sl: vz === "POHOTOVOSŤ" ? "Pohotovosť" : (s.line || k.kurz || ""), cas: ft(a % 1440) + " – " + ft(b % 1440), cisty: cisty, voz: voz, noc: noc, oddych: oddych,
        });
        prvy = false;
      });
      if (d < 1) continue;
      if (rows.length === r0) rows.push({ dat: d + "." + (m + 1) + ". " + DNI[dt.getDay()], prvy: true, prazdny: true,
        znacka: sviatok ? "sviatok" : "", voz: [] });
      for (var qi = r0; qi < rows.length; qi++) { rows[qi].vik = dt.getDay() === 0 || dt.getDay() === 6; rows[qi].sv = sviatok && !rows[qi].vik; if (sviatok && !rows[qi].nepr && rows[qi].cisty) rows[qi].svh = rows[qi].cisty; }
      // delená: dve služby v jeden deň, druhá začína neskôr, než prvá skončila (dĺžka prestávky sa nerieši) – počítame sami, nie z DB
      casy.sort(function (x, y) { return x[0] - y[0]; });
      var delDen = casy.some(function (c, i) { return i > 0 && c[0] > casy[i - 1][1]; });
      if (delDen && rows[r0]) { T.del++; rows[r0].d = 1; }
      if (strNepr && rows[r0] && !rows[r0].str && !(den > 240)) { T.str++; rows[r0].str = 1; }
      if (mal || rekMal) { if (mal) T.dni++; if (den > 240) { var sk = den > 630 ? 2 : 1; T.str += sk; rows[r0].str = sk; } }
    }
    // mesačný úväzok = pracovné dni (po–pi aj so sviatkami) × denný úväzok (týždenný ÷ 5); nadčas = výkon nad úväzok
    var tyz = (window.DpbUvazok && DpbUvazok[v.rid]) || 37.5, pd = 0;
    for (var q = 1; q <= n; q++) {
      var dq = new Date(y, m, q);
      if (dq.getDay() !== 0 && dq.getDay() !== 6) pd++; // sviatok v pracovný deň sa do úväzku počíta
    }
    T.fond = dp ? pd * denMin : Math.round(pd * tyz / 5 * 60);
    T.nadcas = Math.max(0, T.cisty + T.plat - T.fond);
    return { dp: dp, v: v, rows: rows, T: T, nepr: nepr, nadpis: MESIACE[m].charAt(0).toUpperCase() + MESIACE[m].slice(1) + " " + y };
  }

  var CSS = ".vk{-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}.vk tr.vik td{background:#e3f4dc}.vk tr.sv td{color:#d00000}.vk td.kr{color:#555;font-style:italic}" + ".vk .h{display:inline-block;min-width:2ch;text-align:right}.vk .vc{display:inline-block;min-width:5ch;text-align:right;margin-right:22px}.vk td{white-space:nowrap;font-variant-numeric:tabular-nums}" + ".vk{font:15px/1.3 Arial,Helvetica,sans-serif;color:#111;background:#fff;width:830px;padding:18px;box-sizing:border-box}" +
    ".vk h1{font-size:20px;margin:0}.vk .kto{font-size:20px;font-weight:400}.vk .hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:6px 16px}.vk .hd>div:first-child{white-space:nowrap}.vk .hd .sum{font-size:15px;border-collapse:collapse;width:auto;margin-left:auto}.vk .hd .sum th,.vk .hd .sum td{padding:0 0 0 14px;border:0;background:none;color:#000;font-size:15px;text-align:right;white-space:nowrap}.vk .hd .sum th{font-weight:400;color:#555;font-size:13px}.vk .hd .sum td:first-child,.vk .hd .sum th:first-child{text-align:left;padding-left:0}.vk .hd{border-bottom:3px solid #e8001a;padding-bottom:6px;margin-bottom:10px}" +
    ".vk .tot{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.vk .tot div{border:1px solid #ccc;border-radius:6px;padding:5px 9px;flex:1 1 20%}.vk .tot b{display:block;font-size:18px}" +
    ".vk table{border-collapse:collapse;width:100%}.vk th,.vk td{padding:5px 5px;border-bottom:1px solid #ddd;text-align:left;font-size:15px}" +
    ".vk th{background:#222;color:#fff}.vk tr.n td{border-top:2px solid #999}.vk .t{background:#f90;padding:0 5px;border-radius:3px}.vk p{margin:8px 0}" +
    "@page{size:A4 portrait;margin:10mm}.vk tr{page-break-inside:avoid}";

  function teloDp(D) {
    var T = D.T, tl = [["Dni v službe", T.dni], ["Čistý výkon", f(T.cisty)], ["Nočné", f(T.noc)], ["Soboty", f(T.so)], ["Nedele", f(T.ne)], ["Sviatky", f(T.sv)], ["Stravné", T.str], ["Platené neprítomnosti", f(T.plat)], ["Mesačný úväzok", f(T.fond)], ["Nadčas", f(T.nadcas)]];
    var nep = Object.keys(D.nepr).map(function (k) { return esc(k) + ": <b>" + D.nepr[k] + " d</b>"; }).join(" · ") || "žiadne";
    var tr = D.rows.map(function (r) {
      var tc = (r.prvy ? "n" : "") + (r.vik ? " vik" : "") + (r.sv ? " sv" : "");
      if (r.prazdny) return '<tr class="' + tc + '"><td><b>' + fdat(r.dat) + "</b></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>";
      if (r.nepr) return '<tr class="' + tc + '"><td>' + (r.dat ? "<b>" + fdat(r.dat) + "</b>" : "") + '</td><td colspan="2"><i>' + esc(r.sl) + '</i></td><td class="kr">' + (r.kredit ? ft(r.kredit) : "–") + "</td><td></td><td></td><td></td><td>" + (r.str ? "<b>" + r.str + "</b>" : "") + "</td></tr>";
      return '<tr class="' + tc + '"><td>' + (r.dat ? "<b>" + fdat(r.dat) + "</b>" : "") + "</td><td>" + esc(r.sl) + "</td><td>" + r.cas + "</td><td><b>" + ft(r.cisty) + "</b></td><td>" + (r.noc ? ft(r.noc) : "–") + "</td><td>" + (r.oddych != null && r.oddych >= 0 ? ft(r.oddych) : "–") + "</td><td>" + (r.svh ? ft(r.svh) : "") + "</td><td>" + (r.str ? "<b>" + r.str + "</b>" : "") + "</td></tr>";
    }).join("");
    return '<div class="vk"><div class="hd"><h1>Pracovný výkaz – druhá práca – ' + esc(D.nadpis) + "</h1>" + esc(D.v.meno) + " · os. č. " + esc(D.v.rid) + "</div>" +
      '<div class="tot">' + tl.map(function (x) { return "<div>" + x[0] + "<b>" + x[1] + "</b></div>"; }).join("") + "</div><p>Neprítomnosti: " + nep + "</p>" +
      "<table><thead><tr><th>Deň</th><th>Záznam</th><th>Nástup–koniec</th><th>Čistý výkon</th><th>Noc</th><th>Oddych</th><th>Sviatok</th><th>Stravné</th></tr></thead><tbody>" + (tr || '<tr><td colspan="8">V tomto mesiaci nie sú záznamy.</td></tr>') + "</tbody></table>" +
      "<p>Vytvorené " + new Date().toLocaleString("sk-SK") + " z vlastného kalendára druhej práce. Údaje sú podľa kalendára uloženého v tomto zariadení.</p></div>";
  }
  function telo(D) {
    if (D.dp) return teloDp(D);
    var T = D.T, tl = [["Dni v službe", T.dni], ["Čistý výkon", f(T.cisty)], ["S vozom", f(T.voz)], ["Nočné", f(T.noc)], ["Soboty", f(T.so)], ["Nedele", f(T.ne)], ["Sviatky", f(T.sv)], ["Stravné", T.str], ["Platené neprítomnosti", f(T.plat)], ["Mesačný úväzok", f(T.fond)], ["Nadčas", f(T.nadcas)]];
    tl.splice(8, 0, ["Príplatok za delenú", T.del || 0]);
    var nep = Object.keys(D.nepr).map(function (k) { return esc(k) + ": <b>" + D.nepr[k] + " d</b>"; }).join(" · ") || "žiadne";
    var tr = D.rows.map(function (r) {
      var tc = (r.prvy ? "n" : "") + (r.vik ? " vik" : "") + (r.sv ? " sv" : "");
      if (r.prazdny) return '<tr class="' + tc + '"><td><b>' + fdat(r.dat) + "</b>" + "</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>";
      if (r.nepr) return '<tr class="' + tc + '"><td>' + (r.dat ? "<b>" + fdat(r.dat) + "</b>" : "") + '</td><td colspan="2"><i>' + esc(r.sl) + '</i></td><td class="kr">' + (r.kredit ? ft(r.kredit) : "–") + "</td><td></td><td></td><td></td><td></td><td></td><td>" + (r.str ? "<b>" + r.str + "</b>" : "") + "</td></tr>";
      var vv = r.voz.length ? r.voz : [null], out = "";
      vv.forEach(function (x, i) {
        var cell = x ? '<span class="vc"><b>' + esc(x.c) + "</b></span>" + ft(x.min) : "–";
        if (i === 0) out += '<tr class="' + tc + '"><td>' + (r.dat ? "<b>" + fdat(r.dat) + "</b>" : "") + "</td><td>" + fsl(r.sl) + "</td><td>" + r.cas + "</td><td><b>" + ft(r.cisty) + "</b></td><td>" + cell + "</td><td>" + (r.noc ? ft(r.noc) : "–") + "</td><td>" + (r.oddych != null && r.oddych >= 0 ? ft(r.oddych) : "–") + "</td><td>" + (r.d ? "<b>" + r.d + "</b>" : "") + "</td><td>" + (r.svh ? ft(r.svh) : "") + "</td><td>" + (r.str ? "<b>" + r.str + "</b>" : "") + "</td></tr>";
        else out += '<tr class="' + tc.replace("n", "").trim() + '"><td></td><td></td><td></td><td></td><td>' + cell + '</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      });
      return out;
    }).join("");
    return '<div class="vk"><div class="hd"><div><h1>Pracovný výkaz – ' + esc(D.nadpis) + "</h1><div class=\"kto\">" + esc(D.v.meno) + " · os. č. " + esc(D.v.rid) + "</div></div>" + sumHlavicka(D) + "</div>" +
      '<div class="tot">' + tl.map(function (x) { return "<div>" + x[0] + "<b>" + x[1] + "</b></div>"; }).join("") + "</div><p>Neprítomnosti: " + nep + "</p>" +
      "<table><thead><tr><th>Deň</th><th>Služba</th><th>Nástup–koniec</th><th>Čistý výkon</th><th>Vozidlo a hodiny</th><th>Noc</th><th>Oddych</th><th>D</th><th>Sviatok</th><th>Stravné</th></tr></thead><tbody>" + (tr || '<tr><td colspan="10">V tomto mesiaci nie sú služby.</td></tr>') + "</tbody></table>" +
      "<p>Vytvorené " + new Date().toLocaleString("sk-SK") + " z DPB dashboardu. Údaje sú podľa posledne načítaných dát. *Rok = súčet mesiacov od januára.</p></div>";
  }

  // Pravá strana hlavičky: plánovaný úväzok a čerpanie dovolenky, lekára a doprovodu (mesiac | rok)
  function sumHlavicka(D) {
    var rx = { dov: /dovolen/i, lek: /lek[aá]r/i, dop: /doprov/i };
    function sum(nepr, r) { var c = 0; Object.keys(nepr || {}).forEach(function (k) { if (r.test(k)) c += nepr[k]; }); return c; }
    var y = parseInt(D.nadpis.slice(-4), 10), mi = MESIACE.indexOf(D.nadpis.split(" ")[0].toLowerCase());
    var rok = { fond: 0, dov: 0, lek: 0, dop: 0 };
    for (var q = 0; q <= mi; q++) {
      try {
        var X = q === mi ? D : zber(new Date(y, q, 1));
        if (X.T.dni > 0 || Object.keys(X.nepr || {}).length) rok.fond += X.T.fond; rok.dov += sum(X.nepr, rx.dov); rok.lek += sum(X.nepr, rx.lek); rok.dop += sum(X.nepr, rx.dop);
      } catch (e) {}
    }
    function r(n, a, b) { return "<tr><td>" + n + "</td><td><b>" + a + "</b></td><td><b>" + b + "</b></td></tr>"; }
    return '<table class="sum"><thead><tr><th></th><th>mesiac</th><th>rok*</th></tr></thead><tbody>' +
      r("Plánovaný úväzok", f(D.T.fond), f(rok.fond)) +
      r("Čerpaná dovolenka", sum(D.nepr, rx.dov) + " d", rok.dov + " d") +
      r("Lekár", sum(D.nepr, rx.lek) + " d", rok.lek + " d") +
      r("Doprovod", sum(D.nepr, rx.dop) + " d", rok.dop + " d") +
      "</tbody></table>";
  }

  function tlac(D) {
    var h = '<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>vykaz-' + esc(D.nadpis) + "</title><style>body{margin:0}" + CSS + ".vk{width:auto}</style></head><body>" + telo(D) + "</body></html>";
    var fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(fr);
    var doc = fr.contentWindow.document; doc.open(); doc.write(h); doc.close();
    setTimeout(function () {
      try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { if (window._showToast) _showToast("Tlač sa nepodarila", 3500); }
      setTimeout(function () { fr.remove(); }, 60000);
    }, 400);
  }

  function otvor(datum, zdroj) {
    var D = zber(datum, zdroj);
    var st = document.createElement("style"); st.textContent = CSS +
      ".vk-ov{position:fixed;inset:0;z-index:99999;background:#555;display:flex;flex-direction:column}" +
      ".vk-bar{display:flex;gap:8px;padding:8px;background:#111;align-items:center}.vk-bar button{font:700 16px system-ui;min-height:44px;padding:0 14px;border:0;border-radius:8px;background:#e8001a;color:#fff}.vk-bar .sv{background:#444}.vk-bar span{flex:1;color:#fff;font-size:15px}" +
      ".vk-ov{-webkit-text-size-adjust:100%;text-size-adjust:100%}.vk-sc{flex:1;overflow:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}.vk-in{width:max-content}";
    var ov_ = document.createElement("div"); ov_.className = "vk-ov";
    ov_.innerHTML = '<div class="vk-bar"><button class="sv" data-a="x">Zavrieť</button><span>' + (zdroj === "dp" ? "Výkaz – druhá práca" : "Výkaz") + '</span><button class="sv" data-a="-">−</button><button class="sv" data-a="+">+</button><button data-a="p">Tlačiť</button></div><div class="vk-sc"><div class="vk-in">' + telo(D) + "</div></div>";
    document.head.appendChild(st); document.body.appendChild(ov_);
    var sc = ov_.querySelector(".vk-sc"), inn = ov_.querySelector(".vk-in"), z = 1;
    function nastav(n, cx, cy) {
      n = Math.max(0.4, Math.min(3, n));
      var k = n / z, x = sc.scrollLeft + (cx == null ? 0 : cx), y = sc.scrollTop + (cy == null ? 0 : cy);
      z = n; inn.style.zoom = z;
      sc.scrollLeft = x * k - (cx || 0); sc.scrollTop = y * k - (cy || 0);
    }
    z = Math.min(1, window.innerWidth / (inn.scrollWidth || 760)); nastav(z);
    function zavri() { ov_.remove(); st.remove(); }
    ov_.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "x") zavri(); else if (a === "+") nastav(z * 1.25); else if (a === "-") nastav(z / 1.25); else if (a === "p") tlac(D);
    });
    var d0 = 0, z0 = 1;
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    sc.addEventListener("touchstart", function (e) { if (e.touches.length === 2) { d0 = dist(e.touches); z0 = z; } }, { passive: true });
    sc.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2 && d0) { e.preventDefault(); var r = sc.getBoundingClientRect(); nastav(z0 * dist(e.touches) / d0, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top); }
    }, { passive: false });
    sc.addEventListener("touchend", function () { d0 = 0; }, { passive: true });
  }
  window.DpbVykaz = { otvor: otvor, _zber: zber, _telo: telo };
})();
