/* Druhá práca – vlastný kalendár vodiča (napr. rozpis u druhého zamestnávateľa) zobrazený v appke.
   Zdroj: súbor .ics v priečinku s osobným číslom na Disku Google (alebo ručný import v Profile).
   Uloženie: len v zariadení vodiča (localStorage, kľúč podľa osobného čísla) – nikdy v repozitári ani v dátach DPB.
   Nekontrolujú sa odpočinky, nevstupuje do Burzy ani do výkazu DPB. */
(function () {
  var PREF = "dpb_dp_";

  function rid() { return String((window.appState && window.appState.currentDriver) || ""); }
  function nacitaj(r) {
    try { var j = JSON.parse(localStorage.getItem(PREF + r) || "null"); return j && j.ev ? j : { ev: [], zdroj: "", cas: 0 }; } catch (e) { return { ev: [], zdroj: "", cas: 0 }; }
  }
  function uloz(r, o) { try { localStorage.setItem(PREF + r, JSON.stringify(o)); } catch (e) {} }
  function pad(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hm(m) { return Math.floor(m / 60) + ":" + pad(m % 60); }

  // ── .ics parser (VEVENT: DTSTART/DTEND/SUMMARY/DESCRIPTION/UID; RRULE sa nepodporuje) ──
  function rozbalit(text) { return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/); }
  function odescape(s) { return (s || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
  function cas(hodn, par) {
    // vráti Date (lokálny čas zariadenia) alebo { den: Date } pre celodenný
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(hodn || "");
    if (!m) return null;
    if (m[4] === undefined) return { den: new Date(+m[1], +m[2] - 1, +m[3]) };
    if (m[7]) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)); // TZID/floating = čas v Bratislave
  }
  function parseIcs(text) {
    var out = [], ev = null;
    rozbalit(String(text || "").replace(/^﻿/, "")).forEach(function (ln) {
      if (ln === "BEGIN:VEVENT") { ev = {}; return; }
      if (ln === "END:VEVENT") {
        if (ev && ev.DTSTART) {
          var a = cas(ev.DTSTART), b = cas(ev.DTEND);
          if (a) {
            var o = { id: ev.UID || "e" + out.length, t: odescape(ev.SUMMARY) || "Služba", popis: odescape(ev.DESCRIPTION) };
            if (a.den) { o.d = kluc(a.den); o.od = null; o["do"] = null; }
            else {
              o.d = kluc(a); o.od = a.getHours() * 60 + a.getMinutes();
              var koniec = b && !b.den ? b : null;
              if (koniec && kluc(koniec) === o.d) o["do"] = koniec.getHours() * 60 + koniec.getMinutes();
              else o["do"] = 24 * 60; // cez polnoc: ukáže sa do konca dňa
            }
            o.pjo = /\bPJO\b/i.test(o.popis) && !/\bbez PJO\b/i.test(o.popis);
            out.push(o);
          }
        }
        ev = null; return;
      }
      if (!ev) return;
      var i = ln.indexOf(":"); if (i < 0) return;
      var n = ln.slice(0, i).split(";")[0].toUpperCase();
      ev[n] = ln.slice(i + 1);
    });
    return out;
  }

  function nastav(r, udalosti, zdroj) {
    if (!r) return 0;
    var stare = nacitaj(r), upravy = {};
    (stare.ev || []).forEach(function (e) { if (e.upr) upravy[e.id] = e; }); // ručné úpravy zostanú (krok 2)
    var nove = udalosti.map(function (e) { return upravy[e.id] || e; });
    uloz(r, { ev: nove, zdroj: zdroj, cas: Date.now() });
    document.dispatchEvent(new Event("dpb-druha-praca"));
    return nove.length;
  }

  // z Disku: pole textov .ics
  function zTextov(r, texty, zdroj) {
    var vsetky = [], videne = {};
    texty.forEach(function (t) { parseIcs(t).forEach(function (e) { if (!videne[e.id]) { videne[e.id] = 1; vsetky.push(e); } }); });
    return nastav(r, vsetky, zdroj);
  }

  function pre(den) {
    var r = rid(); if (!r) return [];
    return (nacitaj(r).ev || []).filter(function (e) { return e.d === den && !e.zmazana; })
      .sort(function (a, b) { return (a.od == null ? -1 : a.od) - (b.od == null ? -1 : b.od); });
  }
  function cisty(e) {
    if (e.od == null || e["do"] == null) return null;
    return Math.max(0, e["do"] - e.od - (e.pjo ? 30 : 0));
  }

  // ── karta v zozname dňa ──
  function karta(e) {
    var d = document.createElement("div");
    d.className = "dp-karta";
    d.dataset.dp = e.id;
    var cs = e.od == null ? "Celý deň" : hm(e.od) + " – " + (e["do"] >= 1440 ? "24:00" : hm(e["do"]));
    var c = cisty(e);
    d.innerHTML = '<div class="dp-hlava"><span class="dp-stitok">Druhá práca</span>' +
      (e.pjo ? '<span class="dp-pjo">PJO</span>' : "") + "</div>" +
      '<div class="dp-nazov"></div><div class="dp-cas">' + cs + "</div>" +
      (c != null ? '<div class="dp-cisty">Čistý čas ' + hm(c) + "</div>" : "");
    d.querySelector(".dp-nazov").textContent = e.t;
    return d;
  }
  // vloží karty druhej práce do už zostaveného fragmentu/kontajnera podľa času; uzly = deti s dátami dpOd (min od polnoci)
  function vloz(rodic, den) {
    var ev = pre(den);
    ev.forEach(function (e) {
      var k = karta(e), pred = null, naPrev = false, naDalsiu = false;
      var deti = Array.prototype.slice.call(rodic.children), prev = null;
      for (var i = 0; i < deti.length; i++) {
        var o = deti[i].dataset && deti[i].dataset.od ? parseInt(deti[i].dataset.od, 10) : NaN;
        if (isNaN(o) || e.od == null) continue;
        if (o > e.od) { pred = deti[i]; break; }
        prev = deti[i];
      }
      if (prev && e.od != null) { var pd = parseInt(prev.dataset["do"], 10); if (!isNaN(pd) && pd > e.od) naPrev = true; }
      if (pred && e["do"] != null) naDalsiu = parseInt(pred.dataset.od, 10) < e["do"];
      if (naPrev) k.classList.add("dp-prekryv-hore");
      if (naDalsiu) k.classList.add("dp-prekryv-dole");
      k.dataset.od = e.od == null ? "" : String(e.od);
      if (e["do"] != null) k.dataset["do"] = String(e["do"]);
      if (pred) rodic.insertBefore(k, pred); else rodic.appendChild(k);
    });
    return ev.length;
  }

  function info() {
    var r = rid(); if (!r) return "–";
    var o = nacitaj(r);
    return o.ev.length ? o.ev.length + " udalostí" + (o.zdroj ? " · " + o.zdroj : "") : "nič nenačítané";
  }
  function zmaz() { var r = rid(); if (r) { try { localStorage.removeItem(PREF + r); } catch (e) {} document.dispatchEvent(new Event("dpb-druha-praca")); } }

  // ── Profil: ručný import ──
  function obnovProfil() {
    var s = document.getElementById("profilDpStav"); if (s) s.textContent = info();
  }
  document.addEventListener("dpb-druha-praca", obnovProfil);
  document.addEventListener("change", function (ev) {
    var inp = ev.target; if (!inp || inp.id !== "profilDpFile" || !inp.files || !inp.files[0]) return;
    var f = inp.files[0], r = rid();
    var rd = new FileReader();
    rd.onload = function () {
      var n = zTextov(r, [String(rd.result || "")], "ručný import " + f.name);
      if (window._showToast) window._showToast(n ? "Druhá práca: načítaných " + n + " udalostí" : "V súbore som nenašiel žiadne udalosti", 3500);
      inp.value = "";
    };
    rd.readAsText(f);
  });
  document.addEventListener("click", function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest("#profilDpZmaz");
    if (t && window.confirm && window.confirm("Zmazať kalendár druhej práce z tohto zariadenia?")) zmaz();
  });
  document.addEventListener("DOMContentLoaded", obnovProfil);

  window.DpbDruhaPraca = { parseIcs: parseIcs, zTextov: zTextov, pre: pre, vloz: vloz, cisty: cisty, info: info, zmaz: zmaz };
})();
