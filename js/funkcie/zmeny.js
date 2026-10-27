/* Zmeny v službách: porovná uložený stav s novými dátami a
   (1) pošle správy do zvončeka (Notif, kategória „zmena“),
   (2) označí zmenenú kartu mini kartou so zmenami pod kartou, kým ho vodič neodklikne. */
(function () {
  var DNI = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  var KAT = {
    sluzba: "SLUŽBA",
    striedajuci: "STRIEDAJÚCI VODIČ",
    striedany: "STRIEDANÝ VODIČ",
    vozidlo: "PRIDELENÉ VOZIDLO",
    hradenie: "HRADENIE",
    nepritomnost: "NEPRÍTOMNOSŤ",
  };
  var DOPREDU = 60, MAX_SPRAV = 15;

  function p2(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function ls(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    return null;
  }
  function rid() { return window.appState && window.appState.currentDriver; }
  function menoDna(d) {
    var p = d.split("-").map(Number);
    return DNI[new Date(p[0], p[1] - 1, p[2]).getDay()] + " " + p[2] + "." + p[1] + ".";
  }

  // okno sledovania: od 1. dňa minulého mesiaca (aktuálny dvojmesiac) po 60 dní dopredu
  function odDna() {
    var n = new Date();
    return kluc(new Date(n.getFullYear(), n.getMonth() - 1, 1));
  }

  // ---- snímka služieb vodiča ----
  function polozka(s) {
    var k = s._karta || {}, vz = s._vzor || k.vzor || "";
    var zdroj = (k.vozidla || []).concat((k.hradenia || []).reduce(function (a, h) { return a.concat(h.vozidla || []); }, []));
    var v = [];
    zdroj.forEach(function (x) { var c = String(x.cislo); if (v.indexOf(c) < 0) v.push(c); });
    if (!v.length && s.vehicle && s.vehicle !== "—") v = [String(s.vehicle)];
    var vw = [];
    (k.vozidla || []).forEach(function (x) { var c = String(x.cislo); if (vw.indexOf(c) < 0) vw.push(c); });
    var h = (k.hradenia || []).map(function (x) {
      var fr = window.DPBData && DPBData.fmtRange ? DPBData.fmtRange(x.od, x.do) : "";
      var vv = (x.vozidla || []).map(function (q) { return q.cislo; }).join(",");
      return String(x.kurz) + "|" + fr + (vv ? "|" + vv : "");
    });
    return {
      l: String(s.line || ""), t: s.time || "", v: v.join(", "), vw: vw.join(", "), h: h,
      p: s.before && s.before.name || "", n: s.after && s.after.name || "",
      a: vz === "NEPRÍTOMNOSŤ" ? 1 : 0,
    };
  }
  function snimka(r) {
    var out = {}, dnes = new Date();
    var kon = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate() + DOPREDU);
    var zk = odDna(), kk = kluc(kon);
    Array.from(DPBData.getDatesWithService(r)).sort().forEach(function (d) {
      if (d < zk || d > kk) return;
      var a = (DPBData.getServicesForDate(r, d) || []).map(polozka);
      if (a.length) out[d] = a;
    });
    return out;
  }

  // ---- porovnanie ----
  function nz(x) { return x || "—"; }
  function porovnajDen(d, o, n) {
    var zm = [];
    var vo = o.slice(), vn = n.slice(), pary = [];
    for (var i = vn.length - 1; i >= 0; i--) {
      var j = -1;
      for (var q = 0; q < vo.length; q++) if (vo[q].l === vn[i].l && vo[q].a === vn[i].a) { j = q; break; }
      if (j >= 0) { pary.push([vo[j], vn[i]]); vo.splice(j, 1); vn.splice(i, 1); }
    }
    function ad(a, b) { return !a ? "Pridal sa" : !b ? "Odpadol" : "Zmenil sa"; }
    pary.forEach(function (p) {
      var a = p[0], b = p[1], pre = (b.a ? "" : "Služba ") + b.l + ": ";
      if (a.t !== b.t) zm.push({ d: d, kat: b.a ? "nepritomnost" : "sluzba", l: b.l, text: pre + "čas " + nz(a.t) + " → " + nz(b.t),
        lab: b.a ? "Zmenila sa neprítomnosť" : "Zmenila sa služba", det: "čas " + nz(a.t) + " → " + nz(b.t) });
      var nf = a.h !== undefined && a.vw !== undefined;   // nový formát snímky (vlastné vozidlá + hradenia zvlášť)
      var av = nf ? a.vw : a.v, bv = nf ? b.vw : b.v;
      if (!b.a && av !== bv) zm.push({ d: d, kat: "vozidlo", l: b.l, text: pre + "vozidlo " + nz(av) + " → " + nz(bv),
        lab: !av ? "Pridalo sa vozidlo" : !bv ? "Odobralo sa vozidlo" : "Zmenilo sa vozidlo",
        det: !av ? String(bv) : !bv ? "bolo " + av : av + " → " + bv });
      if (!b.a && nf && JSON.stringify(a.h) !== JSON.stringify(b.h || [])) {
        var mp = function (arr) { var o = {}; (arr || []).forEach(function (q) { var i = q.indexOf("|"); o[q.slice(0, i < 0 ? q.length : i)] = i < 0 ? "" : q.slice(i + 1).replace("|", " · "); }); return o; };
        var ma = mp(a.h), mb = mp(b.h), pr = [], od = [], zmn = [];
        Object.keys(mb).forEach(function (q) { if (!(q in ma)) pr.push(q + " " + mb[q]); else if (ma[q] !== mb[q]) zmn.push(q + " " + ma[q] + " → " + mb[q]); });
        Object.keys(ma).forEach(function (q) { if (!(q in mb)) od.push(q + " " + ma[q]); });
        var lab = pr.length && !od.length && !zmn.length ? "Pridalo sa hradenie" : od.length && !pr.length && !zmn.length ? "Odpadlo hradenie" : "Zmenilo sa hradenie";
        var det = pr.concat(zmn, od.map(function (q) { return "zrušené " + q; })).join("; ");
        zm.push({ d: d, kat: "hradenie", l: b.l, text: pre + lab.toLowerCase() + ": " + det, lab: lab, det: det });
      }
      if (!b.a && a.p !== b.p) zm.push({ d: d, kat: "striedany", l: b.l, text: pre + "preberáš od: " + (a.p || "nikto") + " → " + (b.p || "nikto"),
        lab: ad(a.p, b.p) + " striedaný vodič", det: !a.p ? String(b.p) : !b.p ? "bol " + a.p : a.p + " → " + b.p });
      if (!b.a && a.n !== b.n) zm.push({ d: d, kat: "striedajuci", l: b.l, text: pre + "odovzdáš: " + (a.n || "nikto") + " → " + (b.n || "nikto"),
        lab: ad(a.n, b.n) + " striedajúci vodič", det: !a.n ? String(b.n) : !b.n ? "bol " + a.n : a.n + " → " + b.n });
    });
    var m = Math.min(vo.length, vn.length);
    for (var k = 0; k < m; k++) {
      var nep = vo[k].a || vn[k].a;
      zm.push({ d: d, kat: nep ? "nepritomnost" : "sluzba", l: vn[k].l,
        text: "Zmena: " + vo[k].l + " " + vo[k].t + " → " + vn[k].l + " " + vn[k].t,
        lab: nep ? "Zmenila sa neprítomnosť" : "Zmenila sa služba", det: vo[k].l + " " + vo[k].t + " → " + vn[k].l + " " + vn[k].t });
    }
    for (var x = m; x < vn.length; x++) zm.push({ d: d, kat: vn[x].a ? "nepritomnost" : "sluzba", l: vn[x].l, text: "Pribudlo: " + vn[x].l + " " + vn[x].t,
      lab: vn[x].a ? "Pridala sa neprítomnosť" : "Pridala sa služba", det: vn[x].l + " " + vn[x].t });
    for (var y = m; y < vo.length; y++) zm.push({ d: d, kat: vo[y].a ? "nepritomnost" : "sluzba", l: "", text: "Zrušené: " + vo[y].l + " " + vo[y].t });
    return zm;
  }
  function porovnaj(stara, nova, odDna) {
    var dni = {}, zm = [];
    Object.keys(stara).concat(Object.keys(nova)).forEach(function (d) { dni[d] = 1; });
    Object.keys(dni).sort().forEach(function (d) {
      if (d < odDna) return;
      var o = stara[d] || [], n = nova[d] || [];
      if (JSON.stringify(o) === JSON.stringify(n)) return;
      zm = zm.concat(porovnajDen(d, o, n));
    });
    return zm;
  }

  // ---- Nové voľné služby v Burze ----
  function dostupneBurza(r) {
    if (!DPBData.getVolneSluzby) return [];
    var tr = DPBData.getTrakciaKod ? DPBData.getTrakciaKod(r) : null, ted = Date.now();
    return DPBData.getVolneSluzby().filter(function (x) {
      if (x.startMs <= ted) return false;
      if (tr && x.trakcia && tr !== x.trakcia) return false;
      return !(DPBData.getServicesForDate(r, x.dateKey) || []).length;
    });
  }
  function burzaNove(r, cas) {
    var cur = dostupneBurza(r), ids = cur.map(function (x) { return x.id; }), prev = ls("dpb-burza-" + r);
    ls("dpb-burza-" + r, { cas: cas || Date.now(), ids: ids.slice(0, 1000) });
    if (!prev || !prev.ids) return 0;
    var mam = {};
    prev.ids.forEach(function (i) { mam[i] = 1; });
    var nove = cur.filter(function (x) { return !mam[x.id]; });
    if (!nove.length || !window.Notif || !Notif.pridaj) return 0;
    function riadok(x) { return menoDna(x.dateKey) + " " + x.nazov + " " + x.cas + (x.stanicaOd ? " (" + x.stanicaOd + (x.stanicaDo ? " – " + x.stanicaDo : "") + ")" : ""); }
    if (nove.length > 5) Notif.pridaj("Nové voľné služby v Burze", nove.length + " nových služieb. Najbližšie: " + nove.slice(0, 3).map(riadok).join("; "), "burza", { typ: "burza" });
    else nove.slice().reverse().forEach(function (x) { Notif.pridaj("Nová voľná služba v Burze", riadok(x), "burza", { typ: "burza", d: x.dateKey }); });
    return nove.length;
  }

  // ---- stav „čaká na odklik“ pre karty ----
  function dajVlajky(r) { return ls("dpb-zmeny-" + r) || {}; }
  function ulozVlajky(r, v) { ls("dpb-zmeny-" + r, v); }

  function skontroluj() {
    var r = rid();
    if (!r || !window.DPBData) return Promise.resolve(false);
    var info = window._infoODatach ? window._infoODatach() : Promise.resolve(null);
    return info.catch(function () { return null; }).then(function (i) {
      var cas = i && i.cas || 0, stara = ls("dpb-snap-" + r), nova = snimka(r);
      if (stara && stara.cas && cas && cas < stara.cas) return false;   // načítané staršie dáta – nič neprepisovať
      var zmeny = [];
      if (stara && stara.dni) zmeny = porovnaj(stara.dni, nova, odDna());
      ls("dpb-snap-" + r, { cas: cas || Date.now(), dni: nova });
      var burzaPocet = 0;
      try { burzaPocet = burzaNove(r, cas); } catch (e) {}
      if (!zmeny.length) { if (burzaPocet && window.Notif && Notif.aktualizujBadge) Notif.aktualizujBadge(); return false; }

      // vlajky pre karty (len dnes a budúcnosť)
      var vl = dajVlajky(r), zacOkna = odDna();
      Object.keys(vl).forEach(function (d) { if (d < zacOkna) delete vl[d]; });
      zmeny.forEach(function (z) {
        if (!z.l) return;
        vl[z.d] = vl[z.d] || {};
        var a = vl[z.d][z.l] = (vl[z.d][z.l] || []).filter(function (x) { return (x && x.k || x) !== z.kat; });
        a.push({ k: z.kat, lab: z.lab || ("Zmena: " + KAT[z.kat].toLowerCase()), det: z.det || z.text });
      });
      ulozVlajky(r, vl);

      // zvonček
      if (window.Notif && Notif.pridaj) {
        if (zmeny.length > MAX_SPRAV) Notif.pridaj("Veľa zmien naraz", "Zmenilo sa " + zmeny.length + " vecí v tvojom rozpise. Skontroluj ho.", "zmena");
        else zmeny.slice().reverse().forEach(function (z) { Notif.pridaj(menoDna(z.d) + " – zmena " + KAT[z.kat].toLowerCase(), z.text, "zmena", z.l ? { typ: "den", d: z.d, l: z.l, k: z.kat } : null); });
      }
      if (window._render) window._render();
      return true;
    });
  }

  // ---- mini karta so zmenami pod obsahom karty ----
  function minikarta(kat, r, d, l) {
    var b = document.createElement("div");
    b.className = "zmena-mini";
    b.setAttribute("role", "button");
    kat.forEach(function (x) {
      var o = typeof x === "string" ? { lab: "Zmena: " + (KAT[x] || x).toLowerCase(), det: "" } : x;
      var rr = document.createElement("div");
      rr.className = "zmena-mini-r";
      var h = document.createElement("div"); h.className = "zmena-mini-h"; h.textContent = o.lab;
      rr.appendChild(h);
      if (o.det) { var t = document.createElement("div"); t.className = "zmena-mini-t"; t.textContent = o.det; rr.appendChild(t); }
      b.appendChild(rr);
    });
    var hint = document.createElement("div"); hint.className = "zmena-mini-hint"; hint.textContent = "Ťuknutím potvrdíš";
    b.appendChild(hint);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var vl = dajVlajky(r);
      if (vl[d]) {
        delete vl[d][l];
        if (!Object.keys(vl[d]).length) delete vl[d];
        ulozVlajky(r, vl);
      }
      if (window.Notif && Notif.precitajDen) Notif.precitajDen(d, l);
      var card = b.parentNode;
      b.remove();
      if (card && card.classList) card.classList.remove("ma-zmenu");
      if (window._showToast) window._showToast("Zmena poznačená ako prečítaná");
    });
    return b;
  }
  // odklik jednej zmeny (druhu k) na karte dňa d / linky l – volá zvonček po ťuknutí na správu
  function odklikni(d, l, k) {
    var r = rid();
    if (!r || !d) return;
    var vl = dajVlajky(r);
    if (!vl[d]) return;
    l = l || "";
    if (vl[d][l]) {
      if (k) vl[d][l] = vl[d][l].filter(function (x) { return (x && x.k || x) !== k; });
      else vl[d][l] = [];
      if (!vl[d][l].length) delete vl[d][l];
    }
    if (!Object.keys(vl[d]).length) delete vl[d];
    ulozVlajky(r, vl);
  }
  function ozn(card, s) {
    var r = rid(), d = s && s.date, l = String(s && s.line || "");
    if (!r || !d || !card) return;
    var vl = dajVlajky(r), kat = vl[d] && vl[d][l];
    if (!kat || !kat.length) return;
    card.classList.add("ma-zmenu");
    var mk = minikarta(kat, r, d, l);
    var menu = card.querySelector(".service-menu");
    if (menu) card.insertBefore(mk, menu); else card.appendChild(mk);
  }

  window.DpbZmeny = { skontroluj: skontroluj, ozn: ozn, odklikni: odklikni, _porovnaj: porovnaj, _snimka: snimka };

  // všetky karty prechádzajú cez window.buildNewCard
  var pov = window.buildNewCard;
  if (pov) {
    window.buildNewCard = function (s) {
      var c = pov(s);
      try { ozn(c, s); } catch (e) {}
      return c;
    };
  }
  // po načítaní nových dát za behu skontroluj zmeny
  document.addEventListener("DOMContentLoaded", function () {
    var D = window.DPBData;
    if (D && D._replaceRAW) {
      var orig = D._replaceRAW;
      D._replaceRAW = function () {
        var res = orig.apply(this, arguments);
        if (rid()) setTimeout(skontroluj, 80);
        return res;
      };
    }
  });
})();
