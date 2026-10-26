/* Striedač: ikona „vykonané / nevykonané“ pri každom riadku prestávkovanej služby.
   - Len v deň výkonu je ikona aktívna: štandardne zelená fajka; ťuknutím červený krížik + okno s dôvodom.
   - Zavretie okna bez odoslania vráti ikonu na fajku. Po odoslaní krížik ostane (zamknutý).
   - Minulosť: ikona len zobrazuje uložený stav (štandardne fajka). Budúcnosť: bez ikony.
   Stav je uložený v telefóne: dpb-prest-<osobné číslo> = { "<dátum>": { "<kurz>|<prebera>": { dovod, cas } } } */
(function () {
  var SVG_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
  var SVG_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  var DOVODY = ["Meškanie / zdržanie v premávke", "Porucha vozidla", "Zmena v prevádzke (výluka, odklon)", "Iný dôvod"];

  function rid() { return window.appState && window.appState.currentDriver; }
  function dnes() { return window.DpbCas ? window.DpbCas.formatDateKey(new Date()) : ""; }
  function ls(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    return null;
  }
  function dajStav(r, d, id) { var a = ls("dpb-prest-" + r) || {}; return a[d] && a[d][id] || null; }
  function ulozStav(r, d, id, hod) {
    var a = ls("dpb-prest-" + r) || {};
    a[d] = a[d] || {};
    a[d][id] = hod;
    ls("dpb-prest-" + r, a);
  }
  function menoVodica(r) {
    var d = (window.DPBData ? DPBData.getDrivers() : []).filter(function (x) { return String(x.rid) === String(r); })[0];
    return d ? d.meno : "";
  }
  function toast(t, ms) { if (window._showToast) window._showToast(t, ms); }

  // Okno s dôvodom. cb(dovod|null): dovod = text, null = zrušené
  function okno(podnadpis, cb) {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center";
    var box = document.createElement("div");
    box.style.cssText = "background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px calc(40px + env(safe-area-inset-bottom,0px));box-sizing:border-box;max-height:90vh;overflow:auto";
    var h = document.createElement("div");
    h.style.cssText = "font-size:17px;font-weight:600;color:var(--text-1);margin-bottom:4px";
    h.textContent = "Nezabezpečená pracovná prestávka";
    var sub = document.createElement("div");
    sub.style.cssText = "font-size:15px;color:var(--text-3);margin-bottom:14px";
    sub.textContent = podnadpis;
    box.appendChild(h); box.appendChild(sub);
    var vyber = "";
    var tlacidla = [];
    var inp = document.createElement("textarea");
    inp.placeholder = "Popíš dôvod…";
    inp.style.cssText = "width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-1);outline:none;resize:none;min-height:70px;margin-top:8px;display:none";
    var ok = document.createElement("button");
    function obnov() {
      tlacidla.forEach(function (b) {
        var on = b.textContent === vyber;
        b.style.borderColor = on ? "var(--red)" : "var(--border)";
        b.style.background = on ? "var(--red-soft, var(--surface-2))" : "var(--surface-2)";
      });
      inp.style.display = vyber === "Iný dôvod" ? "block" : "none";
      var hotovo = vyber && (vyber !== "Iný dôvod" || inp.value.trim());
      ok.disabled = !hotovo;
      ok.style.opacity = hotovo ? "1" : ".5";
    }
    DOVODY.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.style.cssText = "display:block;width:100%;padding:12px 16px;margin-bottom:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;font-size:15px;color:var(--text-1);text-align:left;cursor:pointer";
      b.addEventListener("click", function () { vyber = t; obnov(); });
      tlacidla.push(b);
      box.appendChild(b);
    });
    inp.addEventListener("input", obnov);
    box.appendChild(inp);
    var riadok = document.createElement("div");
    riadok.style.cssText = "display:flex;gap:10px;margin-top:16px";
    ok.type = "button";
    ok.textContent = "Pripraviť hlásenie";
    ok.style.cssText = "flex:1;padding:14px;background:var(--red);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer";
    var zr = document.createElement("button");
    zr.type = "button";
    zr.textContent = "Zrušiť";
    zr.style.cssText = "flex:1;padding:14px;background:var(--surface-2);color:var(--text-1);border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer";
    riadok.appendChild(ok); riadok.appendChild(zr);
    box.appendChild(riadok);
    ov.appendChild(box);
    document.body.appendChild(ov);
    var hotovo = false;
    function zavri(v) { if (hotovo) return; hotovo = true; ov.remove(); cb(v); }
    ok.addEventListener("click", function () {
      if (ok.disabled) return;
      zavri(vyber === "Iný dôvod" ? "Iný dôvod: " + inp.value.trim() : vyber);
    });
    zr.addEventListener("click", function () { zavri(null); });
    ov.addEventListener("click", function (e) { if (e.target === ov) zavri(null); });
    obnov();
  }

  function sprava(r, d, k, dovod) {
    var p = d.split("-");
    return [
      "Hlásenie o nezabezpečenej pracovnej prestávke",
      "Vodič: " + (menoVodica(r) || "—") + " (os. č. " + r + ")",
      "Dátum: " + p[2] + "." + p[1] + "." + p[0],
      "Kurz: " + k.kurz + (k.prebera ? ", " + DPBData.fmt(k.prebera) + " – " + DPBData.fmt(k.odovzdava) : ""),
      k.vozidlo ? "Vozidlo: " + k.vozidlo : "",
      k.ridic ? "Strieda vodiča: " + k.ridic : "",
      "Dôvod: " + dovod,
    ].filter(Boolean).join("\n");
  }
  function odosli(text) {
    if (window.DpbZmenaStavu && window.DpbZmenaStavu.ukaz) return window.DpbZmenaStavu.ukaz(text, "Hlásenie o nezabezpečenej pracovnej prestávke");
    if (navigator.share) {
      return navigator.share({ title: "Hlásenie o nezabezpečenej pracovnej prestávke", text: text }).catch(function () {});
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast("Hlásenie je skopírované, vlož ho do správy", 4000); }, function () { toast("Hlásenie sa nepodarilo skopírovať", 4000); });
    }
    toast("Zdieľanie nie je dostupné", 4000);
    return Promise.resolve();
  }

  // Vráti prvok ikony, alebo null (budúcnosť)
  function ikona(service, k) {
    var r = rid(), d = service && service.date;
    if (!r || !d) return null;
    var t = dnes();
    if (!t || d > t) return null;
    var id = String(k.kurz) + "|" + String(k.prebera || "");
    var uloz = dajStav(r, d, id);
    var b = document.createElement("span");
    b.className = "prest-ik";
    b.setAttribute("role", "img");
    function vykresli(nevykonane) {
      b.classList.toggle("nie", !!nevykonane);
      b.classList.toggle("ano", !nevykonane);
      b.innerHTML = nevykonane ? SVG_X : SVG_OK;
      b.setAttribute("aria-label", nevykonane ? "Nevykonané" : "Vykonané");
    }
    vykresli(!!uloz);
    if (d < t) { b.classList.add("zamknute"); return b; }          // minulosť: len zobrazenie
    b.classList.add("klik");
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dajStav(r, d, id)) { toast("Hlásenie už bolo pripravené"); return; }
      vykresli(true);
      okno(k.kurz + " · " + (k.prebera ? DPBData.fmt(k.prebera) + " – " + DPBData.fmt(k.odovzdava) : ""), function (dovod) {
        if (!dovod) { vykresli(false); return; }
        ulozStav(r, d, id, { dovod: dovod, cas: Date.now() });
        odosli(sprava(r, d, k, dovod));
      });
    });
    return b;
  }

  window.DpbPrestavka = { ikona: ikona };
})();
