/* Správy pre vodiča (oznamy, dopravné príkazy, benefity…) – dátová vrstva.
   Zdroj zatiaľ: SPRAVY.csv na Disku Google (vedľa PRAVA.csv). Neskôr ho nahradí server – appka číta len cez DpbSpravy.zoznam().
   Stĺpce: ID;SEKCIA;NADPIS;TEXT;OD;DO;PRE_KOHO;DOLEZITE
     ID        – ľubovoľný unikátny kód správy (podľa neho sa pamätá „prečítané“; zmena textu = nový ID)
     SEKCIA    – názov sekcie (Dopravné príkazy, Oznamy zamestnávateľa, Električky, Benefity…)
     OD / DO   – platnosť (DD.MM.RRRR alebo RRRR-MM-DD), prázdne = bez obmedzenia
     PRE_KOHO  – viac hodnôt oddeľ znakom |:  * | os:<číslo> | skupina:<názov> | trakcia:<kód> | pp:<pomer> | stredisko:<č>; prázdne = všetci
     DOLEZITE  – 1/ano = beží nad kartou na Dnes, kým nie je prečítaná
   V TEXT sa riadok zalomí zápisom \n. */
(function () {
  "use strict";
  var KLUC = "dpb_spravy_csv", KLUC_P = "dpb_spravy_precitane";
  var vsetky = null; // null = súbor sa nenačítal

  var ODD = ";";
  function rozdel(l) {
    var o = [], c = "", q = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; }
      else if (ch === ODD && !q) { o.push(c.trim()); c = ""; }
      else c += ch;
    }
    o.push(c.trim());
    return o;
  }
  function datum(t) {
    t = String(t || "").trim();
    var m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(t);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    return null;
  }
  function parse(text) {
    if (!text) return null;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    // riadky s úvodzovkami môžu mať zalomenie – skladáme podľa párnosti úvodzoviek
    var raw = text.split(/\r?\n/), l = [], buf = "";
    raw.forEach(function (x) {
      buf = buf ? buf + "\n" + x : x;
      if ((buf.match(/"/g) || []).length % 2 === 0) { if (buf.trim()) l.push(buf); buf = ""; }
    });
    if (l.length < 2) return l.length === 1 ? [] : null;
    ODD = l[0].indexOf(";") >= 0 ? ";" : l[0].indexOf("\t") >= 0 ? "\t" : ",";
    var h = rozdel(l[0]).map(function (x) { return x.toLowerCase(); });
    var ix = function (n) { return h.indexOf(n); };
    if (ix("nadpis") < 0 || ix("sekcia") < 0) return null;
    var out = [];
    l.slice(1).forEach(function (ln, n) {
      var c = rozdel(ln), g = function (k) { return ix(k) >= 0 ? c[ix(k)] || "" : ""; };
      if (!g("nadpis")) return;
      out.push({
        id: g("id") || "r" + (n + 2) + ":" + g("nadpis"),
        sekcia: g("sekcia") || "Ostatné",
        nadpis: g("nadpis"),
        text: g("text").replace(/\\n/g, "\n"),
        od: datum(g("od")),
        do: datum(g("do")),
        preKoho: g("pre_koho").split("|").map(function (x) { return x.trim(); }).filter(Boolean),
        dolezite: /^(1|ano|áno|x)$/i.test(g("dolezite"))
      });
    });
    return out;
  }
  function nastav(text, uloz) {
    var r = parse(text);
    if (!r) return false;
    vsetky = r;
    if (uloz) try { localStorage.setItem(KLUC, text); } catch (e) {}
    document.dispatchEvent(new Event("dpb-spravy"));
    return true;
  }

  // ---- prečítané (len v tomto zariadení; evidencia „kto čo prečítal“ príde so serverom)
  function nacitajP() { try { return JSON.parse(localStorage.getItem(KLUC_P) || "{}") || {}; } catch (e) { return {}; } }
  function jePrecitana(id) { return !!nacitajP()[id]; }
  function oznacPrecitana(id) {
    var p = nacitajP();
    if (p[id]) return;
    p[id] = Date.now();
    try { localStorage.setItem(KLUC_P, JSON.stringify(p)); } catch (e) {}
    document.dispatchEvent(new Event("dpb-spravy"));
  }

  function zoznam() {
    if (!vsetky) return [];
    var dnes = new Date(); dnes.setHours(0, 0, 0, 0);
    var t = dnes.getTime(), P = window.DpbPrava;
    return vsetky.filter(function (s) {
      if (s.od !== null && t < s.od) return false;
      if (s.do !== null && t > s.do) return false;
      if (!s.preKoho.length) return true;
      return s.preKoho.some(function (x) { return P && P.zahrna(x); });
    }).map(function (s) {
      return Object.assign({}, s, { precitana: jePrecitana(s.id) });
    });
  }
  // sekcie: neprečítané navrchu, potom abecedne
  function sekcie() {
    var m = {}, poradie = [];
    zoznam().forEach(function (s) {
      if (!m[s.sekcia]) { m[s.sekcia] = { nazov: s.sekcia, polozky: [], nove: 0 }; poradie.push(s.sekcia); }
      m[s.sekcia].polozky.push(s);
      if (!s.precitana) m[s.sekcia].nove++;
    });
    var out = poradie.map(function (n) { return m[n]; });
    out.forEach(function (x) {
      x.polozky.sort(function (a, b) { return (a.precitana - b.precitana) || ((b.od || 0) - (a.od || 0)); });
    });
    var dol = function (x) { return x.polozky.some(function (s) { return s.dolezite && !s.precitana; }); };
    out.sort(function (a, b) { return (b.nove > 0) - (a.nove > 0) || (dol(b) - dol(a)) || a.nazov.localeCompare(b.nazov, "sk"); });
    return out;
  }
  function pocetNovych() { return zoznam().filter(function (s) { return !s.precitana; }).length; }
  function dolezite() { return zoznam().filter(function (s) { return s.dolezite && !s.precitana; }); }
  function info() { return vsetky === null ? "nenačítaný" : zoznam().length + " správ pre vodiča z " + vsetky.length; }

  try { var u = localStorage.getItem(KLUC); if (u) nastav(u, false); } catch (e) {}
  document.addEventListener("dpb-prava", function () { document.dispatchEvent(new Event("dpb-spravy")); });
  window.DpbSpravy = { nastav: nastav, zoznam: zoznam, sekcie: sekcie, pocetNovych: pocetNovych, dolezite: dolezite, oznacPrecitana: oznacPrecitana, info: info };
})();
