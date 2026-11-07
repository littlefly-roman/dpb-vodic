/* Úvod po prihlásení: po logu sa na pár sekúnd ukážu karty (ťuknutím sa preskočia).
   Osobné karty (OSOBY.csv): narodeniny/meniny (deň pred a v ten deň), výročie v DPB (deň pred a v ten deň),
   pekný počet dní („Ďakujeme, že si s nami už 333 dní“). Plus „karta dňa“ zo SPRAVY.csv (stĺpec UVOD = 1).
   OSOBY.csv: OSOBNE_CISLO;NASTUP;NAROD;MENINY   (dátumy DD.MM.RRRR; NAROD a MENINY stačí DD.MM.; MENINY voliteľné)
   Každá karta sa ukáže najviac raz (pamätá sa v telefóne). Žiadne údaje nejdú von. */
(function () {
  "use strict";
  var KLUC = "dpb_osoby_csv", KLUC_V = "dpb_uvod_videne", KLUC_P = "dpb_povinne_den";
  var osoby = null, ODD = ";";
  var TRVANIE = 3000;

  function rozdel(l) { return l.split(ODD).map(function (x) { return x.trim().replace(/^"|"$/g, ""); }); }
  function dm(t) { // DD.MM. alebo DD.MM.RRRR -> {d,m}
    var m = /^(\d{1,2})\.\s*(\d{1,2})\.?/.exec(String(t || "").trim());
    return m ? { d: +m[1], m: +m[2] } : null;
  }
  function dmr(t) { // plný dátum -> Date
    var m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(String(t || "").trim());
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || "").trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function nastavOsoby(text, uloz) {
    if (!text) return false;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var l = text.split(/\r?\n/).filter(function (x) { return x.trim(); });
    if (l.length < 1) return false;
    ODD = l[0].indexOf(";") >= 0 ? ";" : l[0].indexOf("\t") >= 0 ? "\t" : ",";
    var h = rozdel(l[0]).map(function (x) { return x.toLowerCase(); });
    var ix = function (n) { return h.indexOf(n); };
    if (ix("osobne_cislo") < 0) return false;
    var m = {};
    l.slice(1).forEach(function (ln) {
      var c = rozdel(ln), g = function (k) { return ix(k) >= 0 ? c[ix(k)] || "" : ""; };
      var id = String(parseInt(g("osobne_cislo"), 10));
      if (!id || id === "NaN") return;
      m[id] = { nastup: dmr(g("nastup")), nar: dm(g("narod")), meniny: dm(g("meniny")) };
    });
    osoby = m;
    if (uloz) try { localStorage.setItem(KLUC, text); } catch (e) {}
    return true;
  }

  // ---- skloňovanie
  function pl(n, jedna, dva, pat) { return n === 1 ? jedna : n >= 2 && n <= 4 ? dva : pat; }
  function cislo(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function peknyPocet(n) {
    if (n < 100) return false;
    if (n <= 1000) return n % 100 === 0 || /^(\d)\1+$/.test(String(n));
    return n % 500 === 0 || /^(\d)\1+$/.test(String(n));
  }

  // ---- karty pre vodiča na daný deň (čistá funkcia kvôli testom)
  function kartyOsobne(o, dnes) {
    var out = [], d0 = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate());
    var zajtra = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
    var kl = function (k) { return k + ":" + d0.getFullYear() + "-" + (d0.getMonth() + 1) + "-" + d0.getDate(); };
    var je = function (x, dt) { return x && x.d === dt.getDate() && x.m === dt.getMonth() + 1; };
    if (o.nastup) {
      var r1 = zajtra.getFullYear() - o.nastup.getFullYear();
      if (r1 >= 1 && o.nastup.getDate() === zajtra.getDate() && o.nastup.getMonth() === zajtra.getMonth())
        out.push({ id: kl("rok-pred"), em: "🚋", nadpis: "Zajtra budeš s nami už " + r1 + " " + pl(r1, "rok", "roky", "rokov"), text: "Ďakujeme, že si s nami.", konfety: false });
      var r0 = d0.getFullYear() - o.nastup.getFullYear();
      if (r0 >= 1 && o.nastup.getDate() === d0.getDate() && o.nastup.getMonth() === d0.getMonth())
        out.push({ id: kl("rok"), em: "🎉", cislo: String(r0), text: pl(r0, "rok", "roky", "rokov") + " s nami. Ďakujeme, že si s nami.", konfety: true });
      else {
        var dni = Math.round((d0 - o.nastup) / 86400000);
        if (peknyPocet(dni))
          out.push({ id: kl("dni"), em: "✨", nadpis: cislo(dni) + " " + pl(dni, "deň", "dni", "dní"), text: "Ďakujeme, že si s nami už " + cislo(dni) + " " + pl(dni, "deň", "dni", "dní") + ".", konfety: true });
      }
    }
    [["nar", "narodeniny", "narodeninám", "🎂"], ["meniny", "meniny", "meninám", "🎈"]].forEach(function (a) {
      var x = o[a[0]];
      if (je(x, d0)) out.push({ id: kl(a[0]), em: a[3], nadpis: "Všetko najlepšie k " + a[2] + "!", text: "Prajeme ti pevné zdravie a pokojné jazdy.", konfety: true });
      else if (je(x, zajtra)) out.push({ id: kl(a[0] + "-pred"), em: "🎈", nadpis: "Zajtra máš " + a[1], text: "Vopred ti prajeme všetko najlepšie.", konfety: true });
    });
    return out;
  }

  // ---- zobrazenie
  function videne() { try { return JSON.parse(localStorage.getItem(KLUC_V) || "{}") || {}; } catch (e) { return {}; } }
  function zapisVidene(id) {
    var v = videne(); v[id] = Date.now();
    var k = Object.keys(v); if (k.length > 200) k.sort(function (a, b) { return v[a] - v[b]; }).slice(0, k.length - 200).forEach(function (x) { delete v[x]; });
    try { localStorage.setItem(KLUC_V, JSON.stringify(v)); } catch (e) {}
  }
  function zozbieraj(rid, dnes, vsetky) {
    var v = vsetky ? {} : videne(), karty = [];
    var o = osoby && osoby[String(parseInt(rid, 10))];
    if (o) karty = kartyOsobne(o, dnes || new Date());
    var dnesK = (function (d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })(dnes || new Date());
    var pov = []; try { pov = JSON.parse(localStorage.getItem(KLUC_P) || "{}") || {}; } catch (e) {}
    if (window.DpbSpravy) window.DpbSpravy.povinne().forEach(function (s) {
      if (!vsetky && pov[s.id] === dnesK) return; // dnes už ukázaná (a nedokončená) – skúsime zajtra
      karty.unshift({ id: "povinne:" + s.id, em: "💌", nadpis: s.nadpis, text: s.text, spravaId: s.id, povinna: s.povinne, povinnyId: s.id, povinnyDen: dnesK, mala: true, konfety: false });
    });
    if (window.DpbSpravy) window.DpbSpravy.uvodne().forEach(function (s) {
      if (s.povinne > 0) return; // povinné sa už ukázali hore
      karty.push({ id: "sprava:" + s.id, em: "🚋", nadpis: s.nadpis, text: s.text, spravaId: s.id, konfety: false, mala: true });
    });
    return karty.filter(function (k) { return k.povinna || !v[k.id]; }).slice(0, 3);
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ov = null, casovac = 0, zostava = 0, t0 = 0, pauza = false, odpocet = 0;
  function zavri() { if (casovac) clearTimeout(casovac); casovac = 0; if (odpocet) clearInterval(odpocet); odpocet = 0; pauza = false; if (ov) { ov.classList.add("preč"); var o = ov; ov = null; setTimeout(function () { o.remove(); }, 250); } }
  function konfety(host) {
    var f = ["#fff", "#ffd54a", "#ffb3b0", "#fff3c4"], h = "";
    for (var i = 0; i < 26; i++)
      h += '<b style="left:' + Math.round(Math.random() * 96) + "%;background:" + f[i % 4] + ";animation-delay:" + (Math.random() * 2.2).toFixed(2) + "s;animation-duration:" + (2.6 + Math.random() * 2).toFixed(2) + "s;width:" + (5 + Math.round(Math.random() * 4)) + "px;height:" + (8 + Math.round(Math.random() * 6)) + 'px"></b>';
    var c = document.createElement("div"); c.className = "uvod-konf"; c.innerHTML = h; host.appendChild(c);
  }
  function spustiCas(ms, dalej) { zostava = ms; t0 = Date.now(); casovac = setTimeout(dalej, ms); }
  function ukaz(karty, i) {
    if (i >= karty.length) return zavri();
    var k = karty[i];
    if (casovac) clearTimeout(casovac);
    if (odpocet) { clearInterval(odpocet); odpocet = 0; }
    if (k.povinna) {
      // zapíš len „dnes ukázaná“; prečítaná je až po dokončení odpočtu
      try { var pv = JSON.parse(localStorage.getItem(KLUC_P) || "{}") || {}; pv[k.povinnyId] = k.povinnyDen; localStorage.setItem(KLUC_P, JSON.stringify(pv)); } catch (e) {}
    } else {
      zapisVidene(k.id);
      if (k.spravaId && window.DpbSpravy) window.DpbSpravy.oznacPrecitana(k.spravaId);
    }
    pauza = false;
    if (!ov) { ov = document.createElement("div"); ov.className = "uvod-ov"; document.body.appendChild(ov); }
    ov.classList.remove("pauza");
    var bodky = ""; if (karty.length > 1) for (var j = 0; j < karty.length; j++) bodky += "<i" + (j === i ? ' class="on"' : "") + "></i>";
    ov.innerHTML = '<div class="uvod-prog"><i style="animation-duration:' + (k.povinna ? k.povinna * 1000 : TRVANIE) + 'ms"></i></div>' +
      (k.povinna ? "" : '<button type="button" class="uvod-x" aria-label="Zavrieť">✕</button>') +
      '<div class="uvod-karta' + (k.mala ? " mala" : "") + '"><div class="uvod-logo">' + (document.querySelector(".login-logo svg") ? document.querySelector(".login-logo svg").outerHTML : "") + "</div>" +
      '<div class="uvod-em">' + k.em + "</div>" + (k.cislo ? '<div class="uvod-cislo">' + esc(k.cislo) + "</div>" : '<div class="uvod-nadpis">' + esc(k.nadpis) + "</div>") +
      '<div class="uvod-text">' + esc(k.text).replace(/\n/g, "<br>") + '</div><div class="uvod-pod">Tvoj Dopravný podnik</div></div>' +
      '<div class="uvod-bodky">' + bodky + '</div>' +
      '<div class="uvod-tlac">' + (k.povinna ? "" : '<button type="button" class="uvod-pz">Pozastaviť</button>') + '<button type="button" class="uvod-dalej">' + (i + 1 < karty.length ? "Ďalej ›" : "Zavrieť") + "</button></div>";
    if (k.konfety) konfety(ov);
    var dalej = function () { ukaz(karty, i + 1); };
    if (k.povinna) {
      // povinná karta: tlačidlo je vypnuté, kým neuplynie čas; potom je správa prečítaná
      var bd = ov.querySelector(".uvod-dalej"), zost = k.povinna, popis = bd.textContent;
      ov.classList.add("povinna");
      bd.disabled = true; bd.textContent = popis + " (" + zost + ")";
      odpocet = setInterval(function () {
        zost--;
        if (zost > 0) { bd.textContent = popis + " (" + zost + ")"; return; }
        clearInterval(odpocet); odpocet = 0; bd.disabled = false; bd.textContent = popis;
      }, 1000);
      bd.onclick = function () {
        if (bd.disabled) return;
        if (k.spravaId && window.DpbSpravy) window.DpbSpravy.oznacPrecitana(k.spravaId);
        dalej();
      };
      return; // bez automatického prechodu
    }
    var bPz = ov.querySelector(".uvod-pz");
    bPz.onclick = function () {
      if (!pauza) { pauza = true; clearTimeout(casovac); zostava -= Date.now() - t0; ov.classList.add("pauza"); bPz.textContent = "Pokračovať"; }
      else { pauza = false; ov.classList.remove("pauza"); bPz.textContent = "Pozastaviť"; spustiCas(Math.max(300, zostava), dalej); }
    };
    ov.querySelector(".uvod-dalej").onclick = dalej;
    ov.querySelector(".uvod-x").onclick = zavri;
    spustiCas(TRVANIE, dalej);
  }
  function zobraz(rid, dnes) {
    try {
      if (ov) return;
      var karty = zozbieraj(rid, dnes);
      if (!karty.length) return;
      ukaz(karty, 0);
    } catch (e) {}
  }

  // Profil: pozrieť si úvod znova (aj karty, ktoré už boli ukázané)
  function znova(rid) {
    var karty = zozbieraj(rid, new Date(), true);
    // nič osobné dnes: ukáž aspoň počet rokov a dní v DPB (ak máme dátum nástupu), ako prvú kartu
    if (!karty.some(function (k) { return !k.spravaId; })) {
      var o = osoby && osoby[String(parseInt(rid, 10))], dn = new Date();
      if (o && o.nastup) {
        var d0 = new Date(dn.getFullYear(), dn.getMonth(), dn.getDate()), dni = Math.round((d0 - o.nastup) / 86400000);
        if (dni >= 0) {
          var roky = Math.floor(dni / 365.25);
          karty.unshift({ id: "zn:" + Date.now(), em: "🚋", nadpis: roky >= 1 ? "Si s nami už " + roky + " " + pl(roky, "rok", "roky", "rokov") : "Si s nami už " + cislo(dni) + " " + pl(dni, "deň", "dni", "dní"),
            text: (roky >= 1 ? "To je " + cislo(dni) + " " + pl(dni, "deň", "dni", "dní") + ". " : "") + "Ďakujeme, že si s nami.", konfety: false });
        }
      }
    }
    karty = karty.slice(0, 3);
    if (!karty.length) { if (window._showToast) window._showToast("Nemám čo zobraziť: v OSOBY.csv chýba tvoj riadok s dátumom nástupu"); return false; }
    if (ov) zavri();
    ukaz(karty, 0);
    return true;
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("#profilUvodBtn");
    if (!b) return;
    var rid = window.appState && window.appState.currentDriver;
    if (rid) znova(rid);
  });

  try { var u = localStorage.getItem(KLUC); if (u) nastavOsoby(u, false); } catch (e) {}
  window.DpbUvod = { zobraz: zobraz, znova: znova, nastavOsoby: nastavOsoby, kartyOsobne: kartyOsobne, zozbieraj: zozbieraj, peknyPocet: peknyPocet };
})();
