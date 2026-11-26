/* Sprievodca a pomoc: stmavenie appky, vysvietený prvok a jeho popis (bubliny).
   - Pri prvom otvorení každej obrazovky sa ukáže krátky sprievodca (raz, pamätá sa v telefóne).
   - Tlačidlo „?“ hore ho spustí znova pre aktuálnu obrazovku.
   - Pravidlo appky: červené = dá sa ťuknúť a niečo urobí; čierne a sivé sú len informácia.
   Kroky sú v KROKY nižšie: sel = zoznam kandidátov (použije sa prvý viditeľný), nadpis, text.
   Krok bez sel sa ukáže v strede obrazovky. Kroky, ktorých prvok na obrazovke nie je, sa preskočia. */
(function () {
  "use strict";
  var KLUC = "dpb_pomoc_videne";

  var KROKY = {
    today: [
      { sel: [".podrz"], nadpis: "Ikony s bodkou", text: "Ikona s malou bodkou v rohu sa dá podržať. Ťuknutie urobí jednu vec a dlhé podržanie otvorí ďalšie možnosti, napríklad nastavenie vzhľadu, jednotlivé upozornenia alebo pridelenie vozidla." },
      { sel: ["#themeBtn"], nadpis: "Svetlý a tmavý režim", text: "Ťuknutím prepneš svetlý a tmavý vzhľad. Dlhým podržaním nastavíš, kedy sa appka sama prepne z denného na nočný režim a späť." },
      { sel: ["#todayDate"], nadpis: "Dátum", text: "Ťukni na dátum a otvorí sa kalendár. V kalendári potiahni prstom doľava alebo doprava a prepneš mesiac." },
      { sel: ["#swipeWrapper"], nadpis: "Potiahni kartu", text: "Potiahnutím karty doľava alebo doprava prepneš na ďalší alebo predchádzajúci deň. V zozname mesiaca tým istým gestom prepínaš mesiace." },
      { sel: ["#btnList"], nadpis: "Zoznam mesiaca", text: "Prepne na zoznam služieb celého mesiaca. Potiahnutím doľava alebo doprava prepneš mesiac. Tam nájdeš aj výkaz: ťuknutím na riadok dňa otvoríš jeho menu a dvoma prstami výkaz priblížiš alebo oddiališ." },
      { sel: [".clickable-line", ".card-title"], nadpis: "Služba", text: "Ťukni na linku alebo čas služby a otvorí sa grafikon s odchodmi." },
      { sel: [".card-zvonec"], nadpis: "Upozornenia", text: "Budík ti pripomenie odchod. Ťuknutím zapneš alebo vypneš všetky upozornenia a dlhým podržaním vyberieš jednotlivé." },
      { sel: [".card-obrat"], nadpis: "Obratisko", text: "Ikona nad budíkom ti 2 minúty pred koncom jazdy ukáže, cez ktorú koľaj máš prejsť obratiskom. Okno zavrieš tlačidlom Rozumiem. Ťuknutím ju zapneš alebo vypneš pre všetky jazdy, dlhým podržaním nastavíš, koľko minút pred koncom jazdy sa ozve." },
      { sel: [".str-chevron", ".card-vehicle .ik-i", ".card-vehicle"], nadpis: "Doplňujúce informácie", text: "Ikona „i“ rozbalí podrobnosti: vozidlo, vodiča a ďalšie údaje. Meno vodiča môžeš ťuknúť a zobrazí sa fotka alebo telefón." },
      { sel: [".card-menu-btn"], nadpis: "Menu karty", text: "Šípka dole otvorí menu karty. Nájdeš v ňom grafikon, zmenu stavu (nahlásenie alebo žiadosť o neprítomnosť), reklamáciu, žiadosť o službu, prehľad voľných služieb a nastavenie upozornení k aktuálnej službe." },
      { sel: [".bottom-nav"], nadpis: "Dolné menu", text: "Prepínaš nimi medzi obrazovkami. Aktívna je červená." }
    ],
    prehlad: [
      { sel: ["#cpBtnZastavkovyRoz"], nadpis: "Zastávkový poriadok", text: "Odchody z vybranej zastávky. Zadaj názov zastávky a ťukni na odchod." },
      { sel: ["#cpBtnSluzobny"], nadpis: "Službový poriadok", text: "Poriadok tvojej služby. Ťukni na spoj a otvorí sa grafikon." }
    ],
    profil: [
      { sel: ["#profilView summary"], nadpis: "Sekcie profilu", text: "Ťukni na nadpis a sekcia sa rozbalí. Nájdeš v nich osobné a pracovné údaje aj štatistiku. V štatistike potiahnutím doľava alebo doprava prepneš mesiac." }
    ]
  };

  function videne() { try { return JSON.parse(localStorage.getItem(KLUC) || "{}") || {}; } catch (e) { return {}; } }
  function oznac(k) { var v = videne(); v[k] = 1; try { localStorage.setItem(KLUC, JSON.stringify(v)); } catch (e) {} }
  function aktivna() { var b = document.querySelector(".bottom-nav button.active"); return b ? b.dataset.nav || "today" : "today"; }
  function viditelny(e) { if (!e) return false; var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }
  function najdi(k) {
    if (!k.sel) return null;
    for (var i = 0; i < k.sel.length; i++) {
      var els = document.querySelectorAll(k.sel[i]);
      for (var j = 0; j < els.length; j++) if (viditelny(els[j])) return els[j];
    }
    return undefined;
  }

  var ov = null;
  function zavri() { if (ov) { ov.remove(); ov = null; } document.removeEventListener("keydown", kl, true); }
  function kl(e) { if (e.key === "Escape") { e.preventDefault(); zavri(); } }

  function spusti(obr) {
    zavri();
    var kroky = (KROKY[obr] || []).filter(function (k) { return !k.sel || najdi(k) !== undefined; });
    if (!kroky.length) return;
    oznac(obr);
    var i = 0;
    ov = document.createElement("div");
    ov.id = "pomocOv";
    ov.innerHTML = '<div class="pm-spot"></div><div class="pm-bub" role="dialog" aria-live="polite"><div class="pm-n" role="img"></div><div class="pm-h"></div><div class="pm-t"></div><div class="pm-p"><button type="button" class="pm-skip">Preskočiť</button><button type="button" class="pm-next"></button></div></div>';
    document.body.appendChild(ov);
    document.addEventListener("keydown", kl, true);
    var spot = ov.querySelector(".pm-spot"), bub = ov.querySelector(".pm-bub");
    ov.addEventListener("click", function (e) { e.stopPropagation(); });
    ov.querySelector(".pm-skip").addEventListener("click", zavri);
    ov.querySelector(".pm-next").addEventListener("click", function () { i++; if (i >= kroky.length) zavri(); else ukaz(); });

    function ukaz() {
      var k = kroky[i], el = najdi(k);
      var pn = bub.querySelector(".pm-n"); pn.setAttribute("aria-label", "Krok " + (i + 1) + " z " + kroky.length); pn.innerHTML = kroky.map(function (_, j) { return '<i class="' + (j === i ? "on" : j < i ? "ho" : "") + '"></i>'; }).join("");
      bub.querySelector(".pm-h").textContent = k.nadpis;
      bub.querySelector(".pm-t").textContent = k.text;
      ov.querySelector(".pm-next").textContent = i === kroky.length - 1 ? "Hotovo" : "Ďalej  →";
      ov.querySelector(".pm-skip").style.visibility = i === kroky.length - 1 ? "hidden" : "visible";
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "instant" }); } catch (e) { el.scrollIntoView(); }
        setTimeout(function () { polož(el); }, 60);
      } else {
        spot.style.cssText = "left:50%;top:50%;width:0;height:0;border-radius:0";
        bub.style.cssText = "left:50%;top:50%;right:auto;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 24px))"; bub.dataset.side = "";
      }
    }
    function polož(el) {
      var r = el.getBoundingClientRect(), p = 6, W = window.innerWidth, H = window.innerHeight;
      var x = Math.max(4, r.left - p), y = Math.max(4, r.top - p);
      var w = Math.min(W - 8 - x, r.width + 2 * p), h = Math.min(H - 8 - y, r.height + 2 * p);
      spot.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + w + "px;height:" + h + "px;border-radius:14px";
      bub.style.transform = "";
      var bh = bub.offsetHeight, dole = H - (y + h) - 12, hore = y - 12;
      var top = dole >= bh ? y + h + 12 : hore >= bh ? y - bh - 12 : Math.max(8, (H - bh) / 2);
      bub.style.left = "12px"; bub.style.right = "12px"; bub.style.top = top + "px";
      var pod = dole >= bh, nad = !pod && hore >= bh;
      bub.dataset.side = pod ? "dole" : nad ? "hore" : "";
      var bl = bub.getBoundingClientRect().left;
      bub.style.setProperty("--ax", Math.max(18, Math.min(bub.offsetWidth - 32, r.left + r.width / 2 - bl - 7)) + "px");
    }
    ukaz();
  }

  function vlozTlacidlo() {
    if (document.getElementById("pomocBtn")) return;
    var tb = document.getElementById("themeBtn");
    if (!tb || !tb.parentNode) return;
    var b = document.createElement("button");
    b.id = "pomocBtn"; b.type = "button"; b.className = "theme-btn pomoc-btn"; b.setAttribute("aria-label", "Pomoc – ako appku ovládať"); b.title = "Pomoc";
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4.2"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>';
    b.addEventListener("click", function () { spusti(aktivna()); });
    tb.parentNode.insertBefore(b, tb);
  }

  // prvé otvorenie obrazovky: sprievodca sa ukáže automaticky (raz)
  var posl = null;
  function straz() {
    var nav = document.querySelector(".bottom-nav");
    var prihlaseny = viditelny(nav) && !viditelny(document.getElementById("loginScreen")) && !viditelny(document.getElementById("importScreen"));
    if (!prihlaseny || document.getElementById("pomocOv")) return;
    vlozTlacidlo();
    var o = aktivna();
    if (o === posl) return;
    posl = o;
    if (videne()[o]) return;
    // počkaj, kým nezmizne úvod (karty po prihlásení)
    if (document.querySelector(".uvod-ov, #uvodOv, .uvod-karta")) { posl = null; return; }
    setTimeout(function () { if (!videne()[o] && aktivna() === o) spusti(o); }, 700);
  }
  setInterval(straz, 1000);
  window.DpbPomoc = { spusti: spusti, kroky: KROKY };
})();
