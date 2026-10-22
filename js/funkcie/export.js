/* Exporty: mesačný rozpis do PDF, Excelu (.xlsx) a kalendára (.ics) + zápis jednej služby do kalendára.
   Všetko sa počíta v telefóne z už načítaných dát, nič sa nikam neposiela. */
(function () {
  var DNI = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  var MESIACE = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  var TZ = "Europe/Bratislava";

  function p2(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function toast(t, ms) { if (window._showToast) window._showToast(t, ms); }
  function vodic() {
    var rid = window.appState && window.appState.currentDriver;
    var d = (window.DPBData ? DPBData.getDrivers() : []).filter(function (x) { return String(x.rid) === String(rid); })[0];
    return { rid: rid, meno: d ? d.meno : String(rid || "") };
  }
  function bezDia(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase(); }

  // ---------- údaje ----------
  function jeSluzba(s) {
    var v = s._vzor || (s._karta && s._karta.vzor) || "";
    return ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].indexOf(v) >= 0;
  }
  function sluzbyDna(rid, key) {
    var st = window.appState;
    if (st && st.servicesByDate && st.servicesByDate[key]) return st.servicesByDate[key];
    return window.DPBData ? DPBData.getServicesForDate(rid, key) : [];
  }
  function riadkyMesiaca(datum) {
    var v = vodic(), y = datum.getFullYear(), m = datum.getMonth();
    var n = new Date(y, m + 1, 0).getDate(), out = [];
    for (var d = 1; d <= n; d++) {
      var dt = new Date(y, m, d), key = kluc(dt);
      var sv = sluzbyDna(v.rid, key) || [];
      var vikend = dt.getDay() === 0 || dt.getDay() === 6;
      var sviatok = !!(window.Calendar && Calendar.isHoliday && Calendar.isHoliday(dt));
      var zakl = { datum: p2(d) + "." + p2(m + 1) + "." + y, den: DNI[dt.getDay()], volny: vikend || sviatok, sviatok: sviatok };
      if (!sv.length) {
        out.push(Object.assign({}, zakl, { sluzba: "Voľno", cas: "", trasa: "", vozidlo: "", pred: "", nasl: "" }));
      } else {
        sv.forEach(function (s, i) {
          out.push(Object.assign({}, zakl, {
            sluzba: s.line || "", cas: s.time || "", trasa: s.route || "",
            vozidlo: s.vehicle && s.vehicle !== "—" ? String(s.vehicle) : "",
            pred: s.before && s.before.name ? s.before.name : "", nasl: s.after && s.after.name ? s.after.name : "",
            dalsia: i > 0,
          }));
        });
      }
    }
    return out;
  }
  function minuty(t) {
    var m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(t || "");
    if (!m) return 0;
    var a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
    return b <= a ? b + 1440 - a : b - a;
  }
  function sumar(datum) {
    var v = vodic(), y = datum.getFullYear(), m = datum.getMonth(), n = new Date(y, m + 1, 0).getDate();
    var r = { sluzby: 0, min: 0, vikend: 0, sviatky: 0, volne: 0, nepritomnost: 0 };
    for (var d = 1; d <= n; d++) {
      var dt = new Date(y, m, d), sv = sluzbyDna(v.rid, kluc(dt)) || [];
      var vik = dt.getDay() === 0 || dt.getDay() === 6;
      var svi = !!(window.Calendar && Calendar.isHoliday && Calendar.isHoliday(dt));
      var mal = false;
      sv.forEach(function (s) {
        if (jeSluzba(s)) { mal = true; r.sluzby++; r.min += minuty(s.time); if (vik) r.vikend++; if (svi) r.sviatky++; }
        else if ((s._vzor || (s._karta && s._karta.vzor)) === "NEPRÍTOMNOSŤ") r.nepritomnost++;
      });
      if (!sv.length) r.volne++;
    }
    return r;
  }
  function sumarText(datum) {
    var r = sumar(datum), h = Math.floor(r.min / 60), mm = r.min % 60;
    return [["Počet služieb", r.sluzby], ["Hodiny v službách", h + ":" + p2(mm)], ["Služby cez víkend", r.vikend],
      ["Služby cez sviatok", r.sviatky], ["Dni bez služby", r.volne], ["Neprítomnosti", r.nepritomnost]];
  }
  var HLAVICKA = ["Dátum", "Deň", "Služba", "Čas", "Trasa", "Vozidlo", "Preberáš od", "Odovzdáš"];
  function bunky(r) { return [r.datum, r.den, r.sluzba, r.cas, r.trasa, r.vozidlo, r.pred, r.nasl]; }
  function nadpis(datum) { return MESIACE[datum.getMonth()].charAt(0).toUpperCase() + MESIACE[datum.getMonth()].slice(1) + " " + datum.getFullYear(); }
  function menoSuboru(datum, pripona) {
    var v = vodic();
    return "rozpis-" + datum.getFullYear() + "-" + p2(datum.getMonth() + 1) + "-" + (v.rid || "vodic") + "." + pripona;
  }

  // ---------- sťahovanie ----------
  function stiahni(nazov, mime, data) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nazov; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  // ---------- PDF (cez tlač prehliadača: „Uložiť ako PDF“) ----------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function pdfMesiaca(datum) {
    var v = vodic(), rows = riadkyMesiaca(datum);
    var h = '<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>' + esc(menoSuboru(datum, "pdf").replace(/\.pdf$/, "")) + "</title><style>" +
      "@page{size:A4 landscape;margin:10mm}body{font:11px/1.3 Arial,Helvetica,sans-serif;color:#111;margin:0}" +
      "h1{font-size:16px;margin:0 0 2px}.pod{color:#555;margin-bottom:8px}table{border-collapse:collapse;width:100%}" +
      "th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#e8001a;color:#fff}" +
      "tr.v td{background:#f0f0f0}tr.s td{background:#fde3e6}.sum{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 8px;padding:6px 8px;border:1px solid #ddd;background:#fafafa}.sum b{font-size:13px}tr.d td{border-top:1px dashed #ddd}tr{page-break-inside:avoid}" +
      ".p{color:#666;font-size:9px;margin-top:6px}</style></head><body>" +
      "<h1>Rozpis služieb – " + esc(nadpis(datum)) + "</h1><div class=\"pod\">" + esc(v.meno) + " · os. č. " + esc(v.rid) + "</div><div class=\"sum\">" + sumarText(datum).map(function (x) { return "<span>" + esc(x[0]) + ": <b>" + esc(x[1]) + "</b></span>"; }).join("") + "</div><table><thead><tr>" +
      HLAVICKA.map(function (x) { return "<th>" + esc(x) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) {
        return '<tr class="' + (r.sviatok ? "s" : r.volny ? "v" : "") + (r.dalsia ? " d" : "") + '">' + bunky(r).map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table><div class=\"p\">Vytvorené " + new Date().toLocaleString("sk-SK") + " z DPB dashboardu. Údaje sú podľa posledne načítaných dát.</div></body></html>";
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var doc = f.contentWindow.document;
    doc.open(); doc.write(h); doc.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Tlač sa nepodarilo otvoriť", 3500); }
      setTimeout(function () { f.remove(); }, 60000);
    }, 400);
  }

  // ---------- XLSX (minimálny zip bez kompresie) ----------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(subory) {
    var enc = new TextEncoder(), casti = [], centr = [], pos = 0;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    subory.forEach(function (f) {
      var nm = enc.encode(f.nazov), d = enc.encode(f.obsah), crc = crc32(d);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(33), u32(crc), u32(d.length), u32(d.length), u16(nm.length), u16(0));
      casti.push(new Uint8Array(lh), nm, d);
      centr.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(33), u32(crc), u32(d.length), u32(d.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(pos))), nm);
      pos += lh.length + nm.length + d.length;
    });
    var cs = 0; centr.forEach(function (b) { cs += b.length; });
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(subory.length), u16(subory.length), u32(cs), u32(pos), u16(0)));
    return new Blob(casti.concat(centr, [end]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function xmlEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""); }
  function stlp(i) { return String.fromCharCode(65 + i); }
  function xlsxMesiaca(datum) {
    var rows = riadkyMesiaca(datum), sirky = [11, 5, 22, 16, 38, 9, 22, 22];
    var sd = '<row r="1">' + HLAVICKA.map(function (h, i) { return '<c r="' + stlp(i) + '1" s="1" t="inlineStr"><is><t>' + xmlEsc(h) + "</t></is></c>"; }).join("") + "</row>";
    rows.forEach(function (r, ri) {
      var n = ri + 2;
      sd += '<row r="' + n + '">' + bunky(r).map(function (c, i) {
        return '<c r="' + stlp(i) + n + '"' + (r.sviatok ? ' s="3"' : r.volny ? ' s="2"' : "") + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(c) + "</t></is></c>";
      }).join("") + "</row>";
    });
    var base = rows.length + 3;
    sd += '<row r="' + base + '"><c r="A' + base + '" s="1" t="inlineStr"><is><t>Súhrn mesiaca</t></is></c></row>';
    sumarText(datum).forEach(function (x, i) {
      var n = base + 1 + i;
      sd += '<row r="' + n + '"><c r="A' + n + '" t="inlineStr"><is><t>' + xmlEsc(x[0]) + '</t></is></c>' +
        (typeof x[1] === "number" ? '<c r="C' + n + '"><v>' + x[1] + '</v></c>' : '<c r="C' + n + '" t="inlineStr"><is><t>' + xmlEsc(x[1]) + '</t></is></c>') + '</row>';
    });
    var ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ' + ns + '><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
      sirky.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols><sheetData>" + sd +
      '</sheetData><autoFilter ref="A1:' + stlp(HLAVICKA.length - 1) + (rows.length + 1) + '"/></worksheet>';
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ' + ns + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
      '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8001A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEEEEE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE3E6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    return zip([
      { nazov: "[Content_Types].xml", obsah: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nazov: "_rels/.rels", obsah: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nazov: "xl/workbook.xml", obsah: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ' + ns + ' xmlns:r="' + rel + '"><sheets><sheet name="' + xmlEsc(nadpis(datum)) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { nazov: "xl/_rels/workbook.xml.rels", obsah: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + rel + '/styles" Target="styles.xml"/></Relationships>' },
      { nazov: "xl/styles.xml", obsah: styles },
      { nazov: "xl/worksheets/sheet1.xml", obsah: sheet },
    ]);
  }

  // ---------- ICS ----------
  function budikMin() {
    var x = 60;
    try { var v = parseInt(localStorage.getItem("dpb-budik-min"), 10); if (v >= 0 && v <= 600) x = v; } catch (e) {}
    return x;
  }
  function udalost(s, rid) {
    var m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(s.time || "");
    if (!m || !s.date) return null;
    var od = +m[1] * 60 + +m[2], do_ = +m[3] * 60 + +m[4];
    if (do_ <= od) do_ += 1440;
    var v = s._vzor || (s._karta && s._karta.vzor) || "";
    var nazov = ["SLUŽBA", "944", "STRIEDAČ"].indexOf(v) >= 0 ? "Služba " + (s.line || "") : s.line || "Služba";
    var k = s._karta || {};
    var popis = [];
    if (s.route) popis.push(s.route);
    if (s.vehicle && s.vehicle !== "—") popis.push("Vozidlo: " + s.vehicle);
    if (s.before && s.before.name) popis.push("Preberáš od: " + s.before.name);
    if (s.after && s.after.name) popis.push("Odovzdáš: " + s.after.name);
    var d = s.date.split("-").map(Number);
    return {
      uid: "dpb-" + rid + "-" + s.date + "-" + bezDia(s.line || s.kurz || "sluzba") + "-" + od + "@dpb-vodic",
      zac: new Date(d[0], d[1] - 1, d[2], 0, od), kon: new Date(d[0], d[1] - 1, d[2], 0, do_),
      budik: budikMin(), nazov: nazov.trim(), miesto: k.stan_od || "", popis: popis.join("\n"),
    };
  }
  function lokalny(dt) { return dt.getFullYear() + p2(dt.getMonth() + 1) + p2(dt.getDate()) + "T" + p2(dt.getHours()) + p2(dt.getMinutes()) + "00"; }
  function icsEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function zalom(riadok) {
    var enc = new TextEncoder(), out = [], cur = "", len = 0;
    Array.from(riadok).forEach(function (ch) {
      var b = enc.encode(ch).length;
      if (len + b > (out.length ? 72 : 74)) { out.push(cur); cur = ""; len = 0; }
      cur += ch; len += b;
    });
    out.push(cur);
    return out.join("\r\n ");
  }
  function ics(udalosti) {
    var now = new Date(), stamp = now.getUTCFullYear() + p2(now.getUTCMonth() + 1) + p2(now.getUTCDate()) + "T" + p2(now.getUTCHours()) + p2(now.getUTCMinutes()) + p2(now.getUTCSeconds()) + "Z";
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DPB dashboard//SK", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-TIMEZONE:" + TZ,
      "BEGIN:VTIMEZONE", "TZID:" + TZ,
      "BEGIN:STANDARD", "DTSTART:19701025T030000", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "TZNAME:CET", "END:STANDARD",
      "BEGIN:DAYLIGHT", "DTSTART:19700329T020000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "TZNAME:CEST", "END:DAYLIGHT", "END:VTIMEZONE"];
    udalosti.forEach(function (u) {
      L.push("BEGIN:VEVENT", "UID:" + u.uid, "DTSTAMP:" + stamp, "DTSTART;TZID=" + TZ + ":" + lokalny(u.zac), "DTEND;TZID=" + TZ + ":" + lokalny(u.kon), "SUMMARY:" + icsEsc(u.nazov));
      if (u.miesto) L.push("LOCATION:" + icsEsc(u.miesto));
      if (u.popis) L.push("DESCRIPTION:" + icsEsc(u.popis));
      if (u.budik) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(u.nazov), "TRIGGER:-PT" + u.budik + "M", "END:VALARM");
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.map(zalom).join("\r\n") + "\r\n";
  }
  function icsMesiaca(datum) {
    var v = vodic(), y = datum.getFullYear(), m = datum.getMonth(), n = new Date(y, m + 1, 0).getDate(), ev = [];
    for (var d = 1; d <= n; d++) sluzbyDna(v.rid, kluc(new Date(y, m, d))).forEach(function (s) {
      if (jeSluzba(s)) { var u = udalost(s, v.rid); if (u) ev.push(u); }
    });
    if (!ev.length) return toast("V tomto mesiaci nie sú služby na export", 3500);
    stiahni(menoSuboru(datum, "ics"), "text/calendar;charset=utf-8", ics(ev));
    toast("Kalendár: " + ev.length + " služieb");
  }
  function kartaIcs(s) {
    var u = udalost(s, vodic().rid);
    if (!u) return toast("Túto službu sa nepodarilo exportovať", 3500);
    stiahni("sluzba-" + s.date + "-" + bezDia(s.line || s.kurz) + ".ics", "text/calendar;charset=utf-8", ics([u]));
    toast("Otvor stiahnutý súbor v kalendári");
  }
  function kartaGoogle(s) {
    var u = udalost(s, vodic().rid);
    if (!u) return toast("Túto službu sa nepodarilo zapísať", 3500);
    var url = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(u.nazov) +
      "&dates=" + lokalny(u.zac) + "/" + lokalny(u.kon) + "&ctz=" + encodeURIComponent(TZ) +
      "&details=" + encodeURIComponent(u.popis) + (u.miesto ? "&location=" + encodeURIComponent(u.miesto) : "");
    window.open(url, "_blank", "noopener");
  }

  // ---------- tlačidlo exportu pri mesačnom zozname ----------
  var IK_EXPORT = '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/>';
  document.addEventListener("DOMContentLoaded", function () {
    var list = document.getElementById("btnList");
    if (!list || !list.parentNode) return;
    var b = document.createElement("button");
    b.id = "btnExport"; b.type = "button"; b.className = "day-icon"; b.setAttribute("aria-label", "Exportovať mesiac"); b.hidden = true;
    b.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + IK_EXPORT + "</svg>";
    list.parentNode.insertBefore(b, list);
    var menu = document.createElement("div");
    menu.id = "exportMenu"; menu.className = "export-menu"; menu.hidden = true;
    [["PDF", pdfMesiaca], ["Excel (.xlsx)", function (d) { stiahni(menoSuboru(d, "xlsx"), "", xlsxMesiaca(d)); }], ["Kalendár (.ics)", icsMesiaca]].forEach(function (p) {
      var i = document.createElement("button"); i.type = "button"; i.textContent = p[0];
      i.addEventListener("click", function () {
        menu.hidden = true;
        try { p[1](new Date(window.appState.selectedDate)); } catch (e) { toast("Export sa nepodaril: " + e.message, 4000); }
      });
      menu.appendChild(i);
    });
    document.body.appendChild(menu);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!menu.hidden) { menu.hidden = true; return; }
      var r = b.getBoundingClientRect();
      menu.style.top = r.bottom + 4 + "px";
      menu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
      menu.hidden = false;
    });
    document.addEventListener("click", function () { menu.hidden = true; });
    // tlačidlo je vidieť len v mesačnom zozname
    var pov = window._ikonaPrepnutia;
    window._ikonaPrepnutia = function (mode) {
      if (pov) pov(mode);
      b.hidden = mode !== "list"; if (b.hidden) menu.hidden = true;
    };
  });

  window.DpbExport = { pdfMesiaca: pdfMesiaca, xlsxMesiaca: xlsxMesiaca, icsMesiaca: icsMesiaca, kartaIcs: kartaIcs, kartaGoogle: kartaGoogle, jeSluzba: jeSluzba, _ics: ics, _udalost: udalost };
})();
