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
  function vzorK(s) { return s._vzor || (s._karta && s._karta.vzor) || ""; }

  // Údaje mesiaca: riadky (jedna služba = jeden riadok, vozidlá pod ňou) + súčty.
  function zber(datum) {
    var v = vodic(), y = datum.getFullYear(), m = datum.getMonth(), n = new Date(y, m + 1, 0).getDate();
    var rows = [], T = { dni: 0, cisty: 0, voz: 0, noc: 0, so: 0, ne: 0, sv: 0, str: 0 }, nepr = {};
    for (var d = 1; d <= n; d++) {
      var dt = new Date(y, m, d), sv = sluzbyDna(v.rid, kluc(dt)) || [], prvy = true, mal = false, r0 = rows.length, den = 0;
      var sviatok = !!(window.Calendar && Calendar.isHoliday && Calendar.isHoliday(dt));
      sv.forEach(function (s) {
        var k = s._karta || {}, vz = vzorK(s);
        if (vz === "NEPRÍTOMNOSŤ") { var nm = k.popis || "Neprítomnosť"; nepr[nm] = (nepr[nm] || 0) + 1; return; }
        if (VOZ.indexOf(vz) < 0) return;
        var a = k.od_min != null ? k.od_min : tmin((s.time || "").split(/[–-]/)[0]);
        var b = k.do_min != null ? k.do_min : tmin((s.time || "").split(/[–-]/)[1]);
        if (a == null || b == null) return;
        if (b <= a) b += 1440;
        var cc = window.DpbCistyCas && DpbCistyCas.zaKartu(k);
        var cisty = cc ? cc.cisty : b - a;
        var noc = ov(a, b, 0, NOC_DO) + ov(a, b, NOC_OD, 1440 + NOC_DO);
        var voz = [], vs = k.vozidla || [];
        if (vs.length === 1 && tmin(vs[0].od) === a % 1440 && tmin(vs[0].do) === b % 1440) voz = [{ c: vs[0].cislo, min: cisty }];
        else voz = vs.map(function (x) {
          var o = tmin(x.od), e = tmin(x.do);
          if (o == null || e == null) return { c: x.cislo, min: 0 };
          if (e <= o) e += 1440;
          return { c: x.cislo, min: e - o };
        });
        var vmin = voz.reduce(function (acc, x) { return acc + x.min; }, 0);
        mal = true;
        den += cisty; T.cisty += cisty; T.voz += vmin; T.noc += noc;
        if (dt.getDay() === 6) T.so += cisty;
        if (dt.getDay() === 0) T.ne += cisty;
        if (sviatok) T.sv += cisty;
        rows.push({
          dat: prvy ? d + "." + (m + 1) + ". " + DNI[dt.getDay()] : "", prvy: prvy,
          znacka: prvy ? (sviatok ? "sviatok" : dt.getDay() === 6 ? "sobota" : dt.getDay() === 0 ? "nedeľa" : "") : "",
          sl: vz === "POHOTOVOSŤ" ? "Pohotovosť" : (s.line || k.kurz || ""), cas: f(a % 1440) + "–" + f(b % 1440), cisty: cisty, voz: voz, noc: noc,
        });
        prvy = false;
      });
      if (mal) { T.dni++; if (den > 240) { var sk = den >= 630 ? 2 : 1; T.str += sk; rows[r0].str = sk; } }
    }
    return { v: v, rows: rows, T: T, nepr: nepr, nadpis: MESIACE[m].charAt(0).toUpperCase() + MESIACE[m].slice(1) + " " + y };
  }

  var CSS = ".vk{font:15px/1.3 Arial,Helvetica,sans-serif;color:#111;background:#fff;width:760px;padding:18px;box-sizing:border-box}" +
    ".vk h1{font-size:20px;margin:0}.vk .hd{border-bottom:3px solid #e8001a;padding-bottom:6px;margin-bottom:10px}" +
    ".vk .tot{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.vk .tot div{border:1px solid #ccc;border-radius:6px;padding:5px 9px;flex:1 1 20%}.vk .tot b{display:block;font-size:18px}" +
    ".vk table{border-collapse:collapse;width:100%}.vk th,.vk td{padding:5px 5px;border-bottom:1px solid #ddd;text-align:left;font-size:15px}" +
    ".vk th{background:#222;color:#fff}.vk tr.n td{border-top:2px solid #999}.vk .t{background:#f90;padding:0 5px;border-radius:3px}.vk p{margin:8px 0}" +
    "@page{size:A4 portrait;margin:10mm}.vk tr{page-break-inside:avoid}";

  function telo(D) {
    var T = D.T, tl = [["Dni v službe", T.dni], ["Čistý výkon", f(T.cisty)], ["S vozom", f(T.voz)], ["Nočné", f(T.noc)], ["Soboty", f(T.so)], ["Nedele", f(T.ne)], ["Sviatky", f(T.sv)], ["Stravné", T.str]];
    var nep = Object.keys(D.nepr).map(function (k) { return esc(k) + ": <b>" + D.nepr[k] + " d</b>"; }).join(" · ") || "žiadne";
    var tr = D.rows.map(function (r) {
      var vv = r.voz.length ? r.voz : [null], out = "";
      vv.forEach(function (x, i) {
        var cell = x ? "<b>" + esc(x.c) + "</b> &nbsp;" + f(x.min) : "–";
        if (i === 0) out += '<tr class="' + (r.prvy ? "n" : "") + '"><td>' + (r.dat ? "<b>" + esc(r.dat) + "</b>" + (r.znacka ? ' <span class="t">' + r.znacka + "</span>" : "") : "") + "</td><td>" + esc(r.sl) + "</td><td>" + r.cas + "</td><td><b>" + f(r.cisty) + "</b></td><td>" + cell + "</td><td>" + (r.noc ? f(r.noc) : "–") + "</td><td>" + (r.str ? "<b>" + r.str + "</b>" : "") + "</td></tr>";
        else out += "<tr><td></td><td></td><td></td><td></td><td>" + cell + "</td><td></td><td></td></tr>";
      });
      return out;
    }).join("");
    return '<div class="vk"><div class="hd"><h1>Pracovný výkaz – ' + esc(D.nadpis) + "</h1>" + esc(D.v.meno) + " · os. č. " + esc(D.v.rid) + "</div>" +
      '<div class="tot">' + tl.map(function (x) { return "<div>" + x[0] + "<b>" + x[1] + "</b></div>"; }).join("") + "</div><p>Neprítomnosti: " + nep + "</p>" +
      "<table><thead><tr><th>Deň</th><th>Služba</th><th>Nástup–koniec</th><th>Čistý výkon</th><th>Vozidlo a hodiny</th><th>Noc</th><th>Stravné</th></tr></thead><tbody>" + (tr || '<tr><td colspan="7">V tomto mesiaci nie sú služby.</td></tr>') + "</tbody></table>" +
      "<p>Vytvorené " + new Date().toLocaleString("sk-SK") + " z DPB dashboardu. Údaje sú podľa posledne načítaných dát.</p></div>";
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

  function otvor(datum) {
    var D = zber(datum);
    var st = document.createElement("style"); st.textContent = CSS +
      ".vk-ov{position:fixed;inset:0;z-index:99999;background:#555;display:flex;flex-direction:column}" +
      ".vk-bar{display:flex;gap:8px;padding:8px;background:#111;align-items:center}.vk-bar button{font:700 16px system-ui;min-height:44px;padding:0 14px;border:0;border-radius:8px;background:#e8001a;color:#fff}.vk-bar .sv{background:#444}.vk-bar span{flex:1;color:#fff;font-size:15px}" +
      ".vk-sc{flex:1;overflow:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}.vk-in{width:max-content}";
    var ov_ = document.createElement("div"); ov_.className = "vk-ov";
    ov_.innerHTML = '<div class="vk-bar"><button class="sv" data-a="x">Zavrieť</button><span>Výkaz</span><button class="sv" data-a="-">−</button><button class="sv" data-a="+">+</button><button data-a="p">Tlačiť</button></div><div class="vk-sc"><div class="vk-in">' + telo(D) + "</div></div>";
    document.head.appendChild(st); document.body.appendChild(ov_);
    var sc = ov_.querySelector(".vk-sc"), inn = ov_.querySelector(".vk-in"), z = Math.min(1, (window.innerWidth) / 760);
    function nastav(n, cx, cy) {
      n = Math.max(0.4, Math.min(3, n));
      var k = n / z, x = sc.scrollLeft + (cx == null ? 0 : cx), y = sc.scrollTop + (cy == null ? 0 : cy);
      z = n; inn.style.zoom = z;
      sc.scrollLeft = x * k - (cx || 0); sc.scrollTop = y * k - (cy || 0);
    }
    nastav(z);
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
  window.DpbVykaz = { otvor: otvor, _zber: zber };
})();
