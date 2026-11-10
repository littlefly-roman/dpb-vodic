/* Druhá práca – vlastný kalendár vodiča (napr. rozpis u druhého zamestnávateľa) zobrazený v appke.
   Zdroj: súbor .ics v priečinku s osobným číslom na Disku Google (alebo ručný import v Profile).
   Uloženie: len v zariadení vodiča (localStorage, kľúč podľa osobného čísla) – nikdy v repozitári ani v dátach DPB.
   Nekontrolujú sa odpočinky, nevstupuje do Burzy ani do výkazu DPB. */
(function () {
  var PREF = "dpb_dp_";

  var TYPY = [["sluzba", "Služba"], ["dov", "Dovolenka"], ["pn", "Práceneschopnosť"], ["lekar", "Lekár"], ["nahr", "Náhradné voľno"], ["ine", "Iná neprítomnosť"]];
  function typNazov(t) { for (var i = 0; i < TYPY.length; i++) if (TYPY[i][0] === t) return TYPY[i][1]; return "Služba"; }
  function typZTextu(t) {
    t = String(t || "");
    if (/dovolen|^dov$/i.test(t)) return "dov";
    if (/\bPN\b|prácenesch|pracenesch/i.test(t)) return "pn";
    if (/lek[aá]r|ošetrenie|osetrenie/i.test(t)) return "lekar";
    return "sluzba";
  }
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
            o.typ = typZTextu(o.t);
            o.pjo = o.typ === "sluzba" && /\bPJO\b/i.test(o.popis) && !/\bbez PJO\b/i.test(o.popis);
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
    uloz(r, { ev: nove.concat((stare.ev || []).filter(function (e) { return /^man-/.test(e.id); })), zdroj: zdroj, cas: Date.now() });
    try { localStorage.setItem(PREF + "on_" + r, "1"); } catch (e) {}
    document.dispatchEvent(new Event("dpb-druha-praca"));
    return nove.length;
  }
  function povolene() {
    var r = rid(); if (!r) return false;
    try { if (localStorage.getItem(PREF + "on_" + r) === "1") return true; } catch (e) {}
    return nacitaj(r).ev.length > 0 || !!obrazok();
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

  // ── karta v zozname dňa: veľký obrázok (vlastné logo) + časy od–do, všetko na stred; ťuknutie na časy = úprava ──
  function obrKluc() { return PREF + "img_" + rid(); }
  function obrazok() { try { return localStorage.getItem(obrKluc()) || ""; } catch (e) { return ""; } }
  var IKONA = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';
  function karta(e) {
    var d = document.createElement("div");
    d.className = "dp-karta";
    d.dataset.dp = e.id;
    var cs = e.od == null ? "Celý deň" : hm(e.od) + " – " + (e["do"] >= 1440 ? "24:00" : hm(e["do"]));
    var o = obrazok();
    var typ = e.typ && e.typ !== "sluzba" ? '<span class="dp-typ">' + typNazov(e.typ) + "</span>" : "";
    var casTxt = e.od == null ? (typ ? "" : "Celý deň") : cs;
    d.innerHTML = '<div class="dp-logo">' + (o ? '<img alt="">' : IKONA) + '</div><button type="button" class="dp-cas">' + typ + casTxt + "</button>";
    if (o) d.querySelector("img").src = o;
    d.querySelector(".dp-cas").addEventListener("click", function () { uprav(e.id); });
    return d;
  }

  // ── úprava: od, do, PJO, zmazanie ──
  function minNaVstup(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function vstupNaMin(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function uprav(id, novy) {
    var r = rid(), o = nacitaj(r), e = novy || null;
    if (!e) (o.ev || []).forEach(function (x) { if (x.id === id) e = x; });
    if (!e) return;
    var ov = document.createElement("div");
    ov.className = "dp-edit-ov";
    var opt = TYPY.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + "</option>"; }).join("");
    ov.innerHTML = '<div class="dp-edit"><div class="dp-edit-t">' + (novy ? "Nový záznam" : "Úprava záznamu") + "</div>" +
      '<label>Druh<select id="dpTyp">' + opt + "</select></label>" +
      '<label class="dp-edit-cely" id="dpCelyL"><input type="checkbox" id="dpCely"> Celý deň</label>' +
      '<label>Od<input type="time" id="dpOd"></label><label>Do<input type="time" id="dpDo"></label>' +
      '<label class="dp-edit-pjo" id="dpPjoL"><input type="checkbox" id="dpPjo"> PJO (odpočíta sa 30 min)</label>' +
      '<div class="dp-edit-b"><button type="button" id="dpUloz" class="dp-b-hl">Uložiť</button><button type="button" id="dpZrus">Zrušiť</button>' + (novy ? "" : '<button type="button" id="dpZmaz" class="dp-b-zmaz">Zmazať</button>') + "</div></div>";
    document.body.appendChild(ov);
    var q = function (x) { return ov.querySelector(x); };
    var iod = q("#dpOd"), ido = q("#dpDo"), ip = q("#dpPjo"), ityp = q("#dpTyp"), icely = q("#dpCely");
    ityp.value = e.typ || "sluzba";
    if (e.od != null) iod.value = minNaVstup(e.od);
    if (e["do"] != null) ido.value = e["do"] >= 1440 ? "23:59" : minNaVstup(e["do"]);
    icely.checked = e.od == null && ityp.value !== "sluzba";
    ip.checked = !!e.pjo;
    function prepni() {
      var sl = ityp.value === "sluzba";
      q("#dpPjoL").style.display = sl ? "" : "none";
      q("#dpCelyL").style.display = sl ? "none" : "";
      if (sl) icely.checked = false;
      var skry = icely.checked;
      iod.parentNode.style.display = skry ? "none" : ""; ido.parentNode.style.display = skry ? "none" : "";
    }
    ityp.addEventListener("change", prepni); icely.addEventListener("change", prepni); prepni();
    function zavri() { ov.remove(); }
    function uloz2(zmaz) {
      var a = vstupNaMin(iod.value), b = vstupNaMin(ido.value), sl = ityp.value === "sluzba", cely = !sl && icely.checked;
      if (!zmaz && !cely && (a == null || b == null || b <= a)) { if (window._showToast) window._showToast("Skontroluj časy (do musí byť po od)", 3000); return; }
      var ciel = e;
      if (zmaz) ciel.zmazana = true;
      else {
        ciel.typ = ityp.value; ciel.t = typNazov(ityp.value);
        ciel.od = cely ? null : a; ciel["do"] = cely ? null : b; ciel.pjo = sl && ip.checked;
      }
      ciel.upr = true;
      if (novy) o.ev.push(ciel);
      uloz(r, o);
      try { localStorage.setItem(PREF + "on_" + r, "1"); } catch (e2) {}
      zavri(); document.dispatchEvent(new Event("dpb-druha-praca"));
    }
    q("#dpUloz").addEventListener("click", function () { uloz2(false); });
    q("#dpZrus").addEventListener("click", zavri);
    if (q("#dpZmaz")) q("#dpZmaz").addEventListener("click", function () { if (window.confirm("Zmazať tento záznam?")) uloz2(true); });
    ov.addEventListener("click", function (ev) { if (ev.target === ov) zavri(); });
  }
  function pridaj(den) {
    uprav(null, { id: "man-" + Date.now(), d: den, t: "Služba", typ: "sluzba", od: null, "do": null, pjo: false, upr: true });
  }

  // ── obrázok na karte (vlastné logo): len v zariadení, zmenšený ──
  function nastavObrazok(file, zdroj, r0) {
    var r = r0 || rid(); if (!r || !file) return;
    var fr = new FileReader();
    var jeSvg = /svg/i.test(file.type || "") || /\.svg$/i.test(file.name || "");
    fr.onload = function () {
      if (jeSvg) { // SVG sa uloží priamo (ostrý v každej veľkosti, bez ohľadu na chýbajúce rozmery)
        var du = String(fr.result || "").replace(/^data:[^;,]*/, "data:image/svg+xml");
        try { localStorage.setItem(PREF + "img_" + r, du); localStorage.setItem(PREF + "imgzdroj_" + r, zdroj || "rucny"); } catch (e) {}
        document.dispatchEvent(new Event("dpb-druha-praca"));
        if (window._showToast && zdroj !== "disk") window._showToast("Obrázok na karte nastavený", 2500);
        return;
      }
      var im = new Image();
      im.onload = function () {
        var sc = Math.min(1, 480 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        try { localStorage.setItem(PREF + "img_" + r, c.toDataURL("image/png")); localStorage.setItem(PREF + "imgzdroj_" + r, zdroj || "rucny"); } catch (e) {}
        document.dispatchEvent(new Event("dpb-druha-praca"));
        if (window._showToast && zdroj !== "disk") window._showToast("Obrázok na karte nastavený", 2500);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
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
      if (e.od == null) rodic.insertBefore(k, rodic.firstChild); // celodenný záznam (dovolenka…) navrchu
      else if (pred) rodic.insertBefore(k, pred); else rodic.appendChild(k);
    });
    if (povolene()) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dp-pridat"; b.textContent = "＋ Druhá práca";
      b.addEventListener("click", function () { pridaj(den); });
      rodic.appendChild(b);
    }
    return ev.length;
  }

  // obrázok z Disku (priečinok s kalendárom): použije sa, len ak si vodič nenahral vlastný ručne
  function obrazokZDisku(r, blob) {
    var zdroj = ""; try { zdroj = localStorage.getItem(PREF + "imgzdroj_" + r) || ""; } catch (e) {}
    if (zdroj === "rucny") return;
    nastavObrazok(blob, "disk", r);
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
  document.addEventListener("change", function (ev) {
    var inp = ev.target; if (!inp || inp.id !== "profilDpObr" || !inp.files || !inp.files[0]) return;
    nastavObrazok(inp.files[0]); inp.value = "";
  });
  document.addEventListener("click", function (ev) {
    var q = ev.target && ev.target.closest && ev.target.closest("#profilDpObrZmaz");
    if (q) { try { localStorage.removeItem(obrKluc()); localStorage.removeItem(PREF + "imgzdroj_" + rid()); } catch (e) {} document.dispatchEvent(new Event("dpb-druha-praca")); }
    var t = ev.target && ev.target.closest && ev.target.closest("#profilDpZmaz");
    if (t && window.confirm && window.confirm("Zmazať kalendár druhej práce z tohto zariadenia?")) zmaz();
  });
  document.addEventListener("DOMContentLoaded", obnovProfil);

  window.DpbDruhaPraca = { pridaj: pridaj, povolene: povolene, obrazokZDisku: obrazokZDisku, parseIcs: parseIcs, zTextov: zTextov, pre: pre, vloz: vloz, cisty: cisty, info: info, zmaz: zmaz };
})();
