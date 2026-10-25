/* Mini grafikon z Hľadať: 7 zastávok (3 pred, aktuálna, 3 za) kurzu v malom okne.
   Aktuálna poloha podľa času; mimo bežiacej služby ukáže najbližší spoj. Ak je zvolený dnešný deň, aktualizuje sa. */
(function () {
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function p2(n) { return String(n).padStart(2, "0"); }
  // Koleso: zoznam sa dá listovať prstom; riadok v strede je zväčšený a zvýraznený, ďalšie blednú.
  // stav = { dotyk: čas posledného dotyku, top: posledná poloha } – kým sa vodič ručne posúva (20 s), sa nepresúva samo.
  function koleso(items, stred, stav) {
    var pod = items.some(function (q) { return q.pod; });
    var H = pod ? 60 : 44, VIS = 7;
    var w = el("div", "position:relative;padding:0 10px;box-sizing:border-box;height:" + (H * VIS) + "px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scroll-snap-type:y proximity");
    var pad = el("div", "height:" + (H * 3) + "px");
    w.appendChild(pad);
    var rows = items.map(function (z) {
      var r = el("div", "display:flex;gap:12px;align-items:center;padding:0 12px;height:" + H + "px;box-sizing:border-box;border-radius:12px;scroll-snap-align:center;will-change:transform,opacity");
      r.appendChild(el("div", "min-width:50px;font-variant-numeric:tabular-nums;font-size:15px", z.cas));
      var t = el("div", "flex:1;min-width:0");
      t.appendChild(el("div", "font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", z.nazov));
      if (z.pod) t.appendChild(el("div", "font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.8", z.pod));
      r.appendChild(t);
      w.appendChild(r);
      return r;
    });
    w.appendChild(el("div", "height:" + (H * 3) + "px"));
    function styl() {
      var c = w.scrollTop + (H * VIS) / 2;
      rows.forEach(function (r, i) {
        var stredRiadku = H * 3 + i * H + H / 2;
        var d = Math.abs(stredRiadku - c) / H;
        var blizko = Math.max(0, 1 - d);
        r.style.opacity = String(Math.max(0.22, 1 - d * 0.26));
        r.style.transform = "scale(" + (1 + 0.08 * blizko) + ")";
        var on = d < 0.5;
        r.style.background = on ? "var(--red)" : "transparent";
        r.style.color = on ? "#fff" : "var(--text-1)";
        r.style.fontWeight = on ? "700" : "400";
        r.style.boxShadow = on ? "0 4px 14px rgba(232,0,26,.25)" : "none";
      });
    }
    w.addEventListener("scroll", function () { stav.top = w.scrollTop; styl(); }, { passive: true });
    ["touchstart", "pointerdown", "wheel"].forEach(function (e) { w.addEventListener(e, function () { stav.dotyk = Date.now(); }, { passive: true }); });
    function nastav(pevne) {
      var ruka = !pevne && stav.dotyk && Date.now() - stav.dotyk < 20000 && stav.top != null;
      w.scrollTop = ruka ? stav.top : Math.max(0, stred) * H;
      styl();
    }
    return { el: w, nastav: nastav };
  }

  function otvor(kurz, dateKey, meno, okno) {
    // okno = [odSek, doSek] služby vodiča (nepovinné): poloha sa berie len v rámci nej

    if (!window.DpbOkna || !window.DpbStretnutia) return;
    var dnes = (function () { var n = new Date(); return n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate()); })();
    var jeDnes = dateKey === dnes;
    var box = null, status = null, stavK = { dotyk: 0, top: null };
    function sekundy() {
      if (jeDnes) { var n = new Date(); return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(); }
      return null;
    }
    async function vykresli(startSec) {
      var sec = sekundy();
      if (sec == null) sec = startSec != null ? startSec : 0;
      var pred = false, po = false;
      if (okno && okno[0] != null && okno[1] != null) {
        if (sec < okno[0]) { sec = okno[0]; pred = true; }
        else if (sec > okno[1]) { sec = okno[1]; po = true; }
      }
      var r = await window.DpbStretnutia.poloha(kurz, dateKey, sec, po);
      if (!box || !box.isConnected) return false;
      box.innerHTML = "";
      if (r.chyba) { box.appendChild(el("div", "color:var(--text-2);padding:8px 0", r.chyba)); return true; }
      var popis = pred ? "Služba ešte nezačala – začiatok" : po ? "Služba skončila – koniec služby" : r.stav === "bezi" ? (jeDnes ? "● teraz na trase" : "") : r.stav === "caka" ? "Najbližší spoj" + (r.odchodSpoja ? " o " + r.odchodSpoja : "") : "Služba skončila";
      status.textContent = (popis ? popis + " · " : "") + "smer " + r.ciel;
      var kk = koleso(r.polozky.map(function (z) { return { cas: z.cas, nazov: z.nazov, pod: "" }; }), r.stred, stavK);
      box.appendChild(kk.el);
      kk.nastav(false);
      return true;
    }
    var sheet = window.DpbOkna.otvor({
      titul: "Grafikon " + kurz,
      podtitul: (meno ? meno + " · " : "") + dateKey.split("-").reverse().join("."),
      telo: function (t) {
        status = el("div", "font-size:13px;color:var(--text-2);margin-bottom:8px", "Načítavam…");
        box = el("div", "");
        t.appendChild(status); t.appendChild(box);
      },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: window.DpbOkna.zavriVsetko }],
    });
    vykresli(8 * 3600);
    if (jeDnes) {
      var iv = setInterval(function () {
        if (!box || !box.isConnected) { clearInterval(iv); return; }
        vykresli();
      }, 5000);
    }
    return sheet;
  }

  function hms(s) { return Math.floor(s / 3600) + ":" + p2(Math.floor((s % 3600) / 60)); }
  async function stretnutia(kurz, dateKey, od, do_, meno) {
    if (!window.DpbOkna || !window.DpbStretnutia) return;
    var box = null, info = null, data = null, stavS = { dotyk: 0, top: null };
    var n = new Date(), dnes = n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate());
    function kresli() {
      if (!box) return;
      var nn = new Date(), teraz = nn.getHours() * 3600 + nn.getMinutes() * 60 + nn.getSeconds();
      box.innerHTML = "";
      var idx = 0;
      if (dateKey === dnes) {
        idx = data.findIndex(function (x) { return x.sec >= teraz; });
        if (idx < 0) idx = data.length - 1;
      }
      var kk = koleso(data.map(function (x) {
        return { cas: x.cas, nazov: x.kde, pod: "kurz " + x.kurz + (x.meno ? " · " + x.meno : "") + (x.vozidlo ? " · voz. " + x.vozidlo : "") };
      }), idx, stavS);
      box.appendChild(kk.el);
      kk.nastav(false);
      var bn = el("button", "margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer", "Na najbližšie");
      bn.addEventListener("click", function () { kk.nastav(true); });
      box.appendChild(bn);
    }
    window.DpbOkna.otvor({
      titul: "Koho stretne " + kurz,
      podtitul: (meno ? meno + " · " : "") + dateKey.split("-").reverse().join(".") + " · plánované podľa grafikonu",
      telo: function (t) { info = el("div", "font-size:13px;color:var(--text-2)", "Počítam…"); box = el("div", ""); t.appendChild(info); t.appendChild(box); },
      tlacidla: [{ text: "Zavrieť", primarny: true, klik: window.DpbOkna.zavriVsetko }],
    });
    var sek = function (x) { if (x == null) return null; if (typeof x === "number") return x; var q = String(x).split(":"); return (+q[0]) * 3600 + (+q[1] || 0) * 60; };
    var r = await window.DpbStretnutia.najdi(kurz, dateKey, sek(od), sek(do_));
    if (!box || !box.isConnected) return;
    if (!r || r.chyba) { info.textContent = (r && r.chyba) || "Grafikon nie je dostupný."; return; }
    data = r; info.textContent = "Električky idúce oproti na rovnakom úseku (" + r.length + "). Zoznam sa obnovuje.";
    kresli();
    if (dateKey === dnes) {
      var iv2 = setInterval(function () {
        if (!box || !box.isConnected) { clearInterval(iv2); return; }
        kresli();
      }, 10000);
    }
  }

  window.DpbMiniGrafikon = { otvor: otvor, stretnutia: stretnutia };
})();
