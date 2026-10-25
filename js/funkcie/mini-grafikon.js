/* Mini grafikon z Hľadať: 7 zastávok (3 pred, aktuálna, 3 za) kurzu v malom okne.
   Aktuálna poloha podľa času; mimo bežiacej služby ukáže najbližší spoj. Ak je zvolený dnešný deň, aktualizuje sa. */
(function () {
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function p2(n) { return String(n).padStart(2, "0"); }
  // Koleso: 7 pozícií, stred (index 3) je zväčšený a zvýraznený, vzdialenejšie riadky blednú
  function koleso(slots) {
    var w = el("div", "");
    var OP = [1, 0.78, 0.55, 0.32];
    slots.forEach(function (z, i) {
      var d = Math.abs(i - 3), st = i === 3;
      var vys = slots.some(function (q) { return q && q.pod; }) ? 58 : 42;
      var r = el("div", "display:flex;gap:12px;align-items:center;padding:0 12px;height:" + vys + "px;border-radius:12px;box-sizing:border-box;opacity:" + OP[d] + ";" +
        (st ? "background:var(--red);color:#fff;font-weight:700;transform:scale(1.07);margin:4px 0;box-shadow:0 4px 14px rgba(232,0,26,.28)" : "color:var(--text-1)"));
      if (z) {
        r.appendChild(el("div", "min-width:50px;font-variant-numeric:tabular-nums;font-size:" + (st ? 18 : 15) + "px;" + (st ? "" : "color:var(--text-2)"), z.cas));
        var t = el("div", "flex:1;min-width:0");
        t.appendChild(el("div", "font-size:" + (st ? 17 : 15) + "px", z.nazov));
        if (z.pod) t.appendChild(el("div", "font-size:12px;font-weight:400;" + (st ? "opacity:.9" : "color:var(--text-2)"), z.pod));
        r.appendChild(t);
      }
      w.appendChild(r);
    });
    return w;
  }

  function otvor(kurz, dateKey, meno, okno) {
    // okno = [odSek, doSek] služby vodiča (nepovinné): poloha sa berie len v rámci nej

    if (!window.DpbOkna || !window.DpbStretnutia) return;
    var dnes = (function () { var n = new Date(); return n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate()); })();
    var jeDnes = dateKey === dnes;
    var box = null, status = null;
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
      box.appendChild(koleso(r.polozky.map(function (z) {
        return z && { cas: z.cas, nazov: z.nazov, pod: "" };
      })));
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
    var box = null, info = null, vsetky = false, data = null;
    var n = new Date(), dnes = n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate());
    function kresli() {
      if (!box) return;
      var nn = new Date(), teraz = nn.getHours() * 3600 + nn.getMinutes() * 60 + nn.getSeconds();
      box.innerHTML = "";
      var zoznam = data;
      if (dateKey === dnes && !vsetky) {
        var idx = data.findIndex(function (x) { return x.sec >= teraz; });
        if (idx < 0) idx = data.length;
        var slots = [];
        for (var i = idx - 3; i <= idx + 3; i++) {
          var x = data[i];
          slots.push(x ? { cas: x.cas, nazov: x.kde, pod: "kurz " + x.kurz + (x.meno ? " · " + x.meno : "") + (x.vozidlo ? " · voz. " + x.vozidlo : "") } : null);
        }
        box.appendChild(koleso(slots));
        if (idx >= data.length) box.appendChild(el("div", "color:var(--text-2);padding:8px 0;text-align:center", "Ďalšie stretnutia dnes už nie sú."));
        var bv = el("button", "margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer", "Zobraziť všetky (" + data.length + ")");
        bv.addEventListener("click", function () { vsetky = true; kresli(); });
        box.appendChild(bv);
        return;
      }
      if (!zoznam.length) box.appendChild(el("div", "color:var(--text-2);padding:8px 0", "Nič ďalšie."));
      zoznam.forEach(function (x) {
        var r = el("div", "padding:9px 4px;border-bottom:1px solid var(--surface-2)");
        var h = el("div", "display:flex;gap:10px;font-size:15px");
        h.appendChild(el("div", "min-width:46px;font-weight:700;font-variant-numeric:tabular-nums", x.cas));
        h.appendChild(el("div", "flex:1;min-width:0", x.kde));
        r.appendChild(h);
        r.appendChild(el("div", "font-size:13px;color:var(--text-2);margin-left:56px", "kurz " + x.kurz + (x.meno ? " · " + x.meno : "") + (x.vozidlo ? " · voz. " + x.vozidlo : "")));
        box.appendChild(r);
      });
      if (dateKey === dnes) {
        var bn = el("button", "margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;background:var(--surface-2);color:var(--text-1);font-size:14px;cursor:pointer", "Späť na najbližšie");
        bn.addEventListener("click", function () { vsetky = false; kresli(); });
        box.appendChild(bn);
      }
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
