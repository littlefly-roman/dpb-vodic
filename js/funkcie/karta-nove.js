/* Karta „Dnes“ (v210): okno Cestovný poriadok (3 ušká), okno osoby, upozornenia (zvonček), Žiadosti.
   Stavia na existujúcich oknách: DpbOkna (zmena-stavu.js), DpbMiniGrafikon (mini-grafikon.js), panel zastávkového CP (zastavky.js).
   DpbKartaNove.cp(service) · .osoba(meno) · .zvonec(service) · .ziadosti(service) · .upozornenia() */
(function () {
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function sekOd(t) { var q = String(t || "").split(":"); return (parseInt(q[0], 10) || 0) * 3600 + (parseInt(q[1], 10) || 0) * 60; }

  var SVG = {
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
    osoba: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    zvonec: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    cas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sip: '<polyline points="6 9 12 15 18 9"/>',
  };
  function svg(nazov, velkost) {
    var s = velkost || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + SVG[nazov] + "</svg>";
  }

  // ---------- Okno osoby (fotografia zatiaľ nie je, až po súhlase DPB / GDPR) ----------
  function osoba(meno, doplnok) {
    if (!window.DpbOkna) return;
    window.DpbOkna.otvor({
      titul: meno || "Osoba",
      podtitul: doplnok || "",
      telo: function (t) {
        var av = el("div", "width:150px;height:150px;border-radius:50%;background:var(--surface-2);color:var(--text-3);margin:6px auto 12px;display:flex;align-items:center;justify-content:center");
        av.innerHTML = svg("osoba", 90);
        t.appendChild(av);
        t.appendChild(el("div", "text-align:center;font-size:15px;color:var(--text-2);padding-bottom:4px", "Fotografia nie je dostupná."));
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { window.DpbOkna.zavriVrch(); } }],
    });
  }

  // ---------- Upozornenia (zvonček): nastavenia sa ukladajú, samotné zvonenie príde so serverom ----------
  var KLUC = "dpb_upozornenia";
  var PRED = { nastup: [30, 15, 5], vyjazd: { 20: true, 15: true, 10: true, 5: true, 0: true } };
  function nacitajUpoz() {
    try {
      var r = JSON.parse(localStorage.getItem(KLUC) || "null");
      if (r && r.nastup && r.vyjazd) return r;
    } catch (e) {}
    return JSON.parse(JSON.stringify(PRED));
  }
  function ulozUpoz(u) { try { localStorage.setItem(KLUC, JSON.stringify(u)); } catch (e) {} }
  var VOLBY_NASTUP = [0, 60, 45, 30, 20, 15, 10, 5];
  function upozornenia(service) {
    if (!window.DpbOkna) return;
    var k = (service && service._karta) || {};
    var u = nacitajUpoz();
    window.DpbOkna.otvor({
      titul: "Upozornenia" + (k.kurz ? " – " + k.kurz : ""),
      podtitul: "",
      telo: function (t) {
        var hlavicka = function (txt) { return el("div", "font-size:15px;letter-spacing:.1em;font-weight:700;color:var(--text-3);text-transform:uppercase;margin:6px 0 4px", txt); };
        t.appendChild(hlavicka("Nástup" + (k.od ? " " + k.od : "")));
        u.nastup.forEach(function (min, i) {
          var r = el("div", "display:flex;align-items:center;gap:10px;padding:6px 0");
          r.appendChild(el("div", "flex:1;font-size:17px", (i + 1) + ". upozornenie"));
          var sel = el("select", "padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:16px;font-weight:600");
          VOLBY_NASTUP.forEach(function (m) {
            var o = el("option", "", m ? m + " min pred" : "vypnuté"); o.value = String(m); if (m === min) o.selected = true; sel.appendChild(o);
          });
          sel.addEventListener("change", function () { u.nastup[i] = parseInt(sel.value, 10) || 0; ulozUpoz(u); });
          r.appendChild(sel); t.appendChild(r);
        });
        t.appendChild(hlavicka("Výjazd (začiatok cestovného poriadku)"));
        [20, 15, 10, 5, 0].forEach(function (m) {
          var r = el("label", "display:flex;align-items:center;gap:10px;padding:8px 0;font-size:17px;cursor:pointer");
          r.appendChild(el("div", "flex:1", m ? m + " min pred" : "V čase odchodu (siréna z konečnej)"));
          var cb = el("input", "width:22px;height:22px;accent-color:var(--red)"); cb.type = "checkbox"; cb.checked = !!u.vyjazd[m];
          cb.addEventListener("change", function () { u.vyjazd[m] = cb.checked; ulozUpoz(u); });
          r.appendChild(cb); t.appendChild(r);
        });
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:8px", "Nastavenia sa uložia. Samotné zvonenie pribudne neskôr."));
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); } }],
    });
  }
  function zvonec(service) {
    var b = el("button", "");
    b.type = "button"; b.className = "card-zvonec"; b.setAttribute("aria-label", "Upozornenia");
    b.innerHTML = svg("zvonec", 20);
    b.addEventListener("click", function (e) { e.stopPropagation(); upozornenia(service); });
    return b;
  }

  // ---------- Žiadosti (budúce dni): Zmena stavu | Zmena služby ----------
  function ziadosti(service) {
    if (!window.DpbOkna) return;
    var ctx = { date: service.date, service: service };
    window.DpbOkna.otvor({
      titul: "Žiadosti",
      podtitul: "",
      telo: function (t) {
        var lista = el("div", "display:flex;border-bottom:2px solid var(--border-2)");
        [["Zmena stavu", function () { window.DpbZmenaStavu.otvor(ctx); }],
         ["Zmena služby", function () { window.DpbZiadostSluzby.otvor({ date: service.date, service: service, zmena: true }); }]].forEach(function (x) {
          var b = el("button", "flex:1;padding:14px 6px;background:none;border:0;font-size:16px;font-weight:700;color:var(--red);cursor:pointer", x[0]);
          b.type = "button";
          b.addEventListener("click", function () { window.DpbOkna.zavriVsetko(); x[1](); });
          lista.appendChild(b);
        });
        t.appendChild(lista);
        t.appendChild(el("div", "font-size:15px;color:var(--text-2);margin-top:10px", "Vyber, čo chceš žiadať."));
      },
      tlacidla: [{ text: "Zrušiť", primarny: true, klik: function () { window.DpbOkna.zavriVsetko(); } }],
    });
  }

  // ---------- Cestovný poriadok: grafikon (so všetkými funkciami: LIVE, upozornenia pri spojoch) + tri ušká ----------
  // Volá sa po otvorení grafikonu (kliknutie na službu aj položka menu): zmení ho na okno a pridá ušká
  // Zastávkový CP (s vyplnenou aktuálnou zastávkou) a Koho stretávam.
  var stav = null;
  function zrusOkno() {
    if (!stav) return;
    var s = stav; stav = null;
    try { s.obs.disconnect(); } catch (e) {}
    if (s.panelZ && s.domov && s.panelZ.parentNode !== s.domov) s.domov.insertBefore(s.panelZ, s.domov.firstChild);
    [s.tabs, s.paneZ, s.paneK, s.pozadie].forEach(function (x) { if (x && x.parentNode) x.parentNode.removeChild(x); });
    s.gm.classList.remove("gm-sheet");
    if (s.obsah) s.obsah.style.display = "";
  }
  // Aktuálna zastávka kurzu podľa času (z polohy v cestovnom poriadku)
  async function aktualnaZastavka(ctx) {
    // najprv riadok „Teraz“ priamo z grafikonu (rovnaká poloha, akú vidí vodič), počká sa na jeho načítanie
    for (var i = 0; i < 20; i++) {
      var r0 = document.querySelector("#grafikonContent .grafikon-row.teraz .g-stop");
      if (r0 && r0.textContent.trim()) return r0.textContent.trim();
      await new Promise(function (ok) { setTimeout(ok, 200); });
    }
    var DS = window.DpbStretnutia;
    if (!DS || !DS.poloha) return null;
    var n = new Date(), dnes = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    var od = sekOd(ctx.od), do_ = sekOd(ctx.do); if (do_ <= od) do_ += 86400;
    var sec = od, po = false;
    if (ctx.date === dnes) {
      sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      if (sec < od) sec = od; else if (sec > do_) { sec = do_; po = true; }
    }
    try {
      var r = await DS.poloha(ctx.kurz, ctx.date, sec, po);
      if (!r || r.chyba || !r.polozky || !r.polozky.length) return null;
      var z = r.polozky[Math.max(0, Math.min(r.polozky.length - 1, r.stred || 0))];
      return z && z.nazov || null;
    } catch (e) { return null; }
  }
  function predvypln(nazov) {
    var inp = document.getElementById("cpStanicaInput");
    var vys = document.getElementById("cpStanicaResults");
    if (!inp || !nazov || !vys) return;
    inp.value = nazov;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    var cil = nazov.trim().toLowerCase(), pokusy = 0;
    var t = setInterval(function () {
      pokusy++;
      var riadky = Array.prototype.slice.call(vys.children).filter(function (d) { return d.tagName === "DIV" && d.textContent && d.textContent.length < 80; });
      var tocny = riadky.filter(function (d) { return d.textContent.trim().toLowerCase() === cil; })[0];
      if (tocny || (pokusy > 12 && riadky.length)) { clearInterval(t); (tocny || riadky[0]).click(); }
      else if (pokusy > 25 || !stav) clearInterval(t);
    }, 150);
  }
  function ozdob(ctx) {
    var gm = document.getElementById("grafikonModal");
    if (!gm || !ctx) return;
    zrusOkno();
    var n = new Date();
    var dnes = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    var mozeKto = ctx.date === dnes && ctx.vzor === "SLUŽBA" && /^[1349]\//.test(ctx.kurz || "");
    var obsah = document.getElementById("grafikonContent");
    var panelZ = document.getElementById("cpZastavkovyPanel");
    var s = { gm: gm, obsah: obsah, panelZ: panelZ, domov: panelZ && panelZ.parentNode };
    stav = s;
    gm.classList.add("gm-sheet");
    s.pozadie = el("div", ""); s.pozadie.className = "gm-pozadie";
    s.pozadie.addEventListener("click", function () { var c = document.getElementById("closeGrafikon"); if (c) c.click(); });
    gm.parentNode.insertBefore(s.pozadie, gm);
    s.paneZ = el("div", ""); s.paneZ.className = "gm-pane"; s.paneZ.style.display = "none";
    s.paneK = el("div", ""); s.paneK.className = "gm-pane"; s.paneK.style.display = "none";
    obsah.parentNode.insertBefore(s.paneZ, obsah.nextSibling);
    obsah.parentNode.insertBefore(s.paneK, s.paneZ.nextSibling);
    var ouska = [{ id: "cp", t: "CP linky / poradia" }];
    if (panelZ) ouska.push({ id: "zast", t: "Zastávkový CP" });
    if (mozeKto) ouska.push({ id: "kto", t: "Koho stretávam" });
    s.tabs = el("div", ""); s.tabs.className = "gm-ouska";
    var hl = gm.querySelector(".grafikon-header");
    hl.parentNode.insertBefore(s.tabs, hl.nextSibling);
    var aktivne = null;
    function ukaz(id) {
      aktivne = id;
      Array.prototype.forEach.call(s.tabs.children, function (b) { b.classList.toggle("on", b.dataset.id === id); });
      obsah.style.display = id === "cp" ? "" : "none";
      s.paneZ.style.display = id === "zast" ? "flex" : "none";
      s.paneK.style.display = id === "kto" ? "block" : "none";
      if (id === "zast") {
        if (!s.zHotovo) {
          s.zHotovo = true;
          s.paneZ.appendChild(panelZ);
          aktualnaZastavka(ctx).then(function (z) { if (stav === s && z) predvypln(z); });
        }
      } else if (s.zHotovo && id !== "zast") { /* panel ostáva v okne, len skrytý */ }
      if (id === "kto") {
        s.paneK.innerHTML = "";
        window.DpbMiniGrafikon.stretnutia(ctx.kurz, ctx.date, ctx.od, ctx.do, "", s.paneK);
      }
    }
    ouska.forEach(function (o) {
      var b = el("button", "", o.t); b.type = "button"; b.dataset.id = o.id;
      b.addEventListener("click", function () { if (aktivne !== o.id) ukaz(o.id); });
      s.tabs.appendChild(b);
    });
    ukaz("cp");
    s.obs = new MutationObserver(function () { if (!gm.classList.contains("active")) setTimeout(function () { if (stav === s && !gm.classList.contains("active")) zrusOkno(); }, 300); });
    s.obs.observe(gm, { attributes: true, attributeFilter: ["class"] });
  }

  window.DpbKartaNove = { ozdob: ozdob, osoba: osoba, zvonec: zvonec, ziadosti: ziadosti, upozornenia: upozornenia, svg: svg };
})();
