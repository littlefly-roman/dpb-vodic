/* Správy – obrazovky: ikona v hlavičke, modal so sekciami (otvorená vždy jedna), detail s ukazovateľom čítania,
   bežiaci text nad kartou služby pre dôležité neprečítané správy. Dáta: DpbSpravy (spravy.js). */
(function () {
  "use strict";
  var S = function () { return window.DpbSpravy; };
  var ov = null, stav = { otvorena: null, detail: null };

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fd(ms) { var d = new Date(ms); return d.getDate() + ". " + (d.getMonth() + 1) + "."; }
  function meta(s) {
    var a = [];
    if (s.do !== null) a.push("platí do " + fd(s.do));
    else if (s.od !== null) a.push("od " + fd(s.od));
    return a.join(" · ");
  }
  var IKONY = {
    "dopravné príkazy": "M12 3 2 20h20z M12 10v5 M12 18v.5",
    "oznamy zamestnávateľa": "M4 5h16v11H9l-5 4z",
    "električky": "M7 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 11h14 M8 21l2-3 M16 21l-2-3 M9 3l1-2h4l1 2",
    "autobusy": "M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 11h16 M7 20v-3 M17 20v-3",
    "benefity": "M20 12v8H4v-8 M2 7h20v5H2z M12 22V7 M12 7S9 3 7 5s2 2 5 2z M12 7s3-4 5-2-2 2-5 2z"
  };
  function ikona(nazov) {
    var k = String(nazov).toLowerCase(), d = IKONY[k];
    if (!d) Object.keys(IKONY).some(function (x) { if (k.indexOf(x.split(" ")[0]) === 0) { d = IKONY[x]; return true; } });
    d = d || "M4 5h16v11H9l-5 4z";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  var pasRaf = 0;
  function zastavPas() { if (pasRaf) cancelAnimationFrame(pasRaf); pasRaf = 0; }

  // meria sa až keď je pás viditeľný (po štarte býva hlavná obrazovka ešte skrytá -> šírka 0)
  var pasSirka = -1;
  function spustiPas() {
    var pas = $("spravyPas"); if (!pas) return;
    var okno = pas.querySelector(".spravy-pas-okno"), track = pas.querySelector(".spravy-pas-track"), k1 = pas.querySelector(".spravy-pas-kopia");
    if (!okno || !track || !k1) return;
    zastavPas();
    var kopie = track.querySelectorAll(".spravy-pas-kopia");
    for (var i = 1; i < kopie.length; i++) kopie[i].remove();
    k1.classList.remove("sirka"); track.style.transform = "";
    pasSirka = okno.offsetWidth;
    if (!pasSirka) return; // skrytý – spustí sa po zobrazení (ResizeObserver)
    var w = k1.offsetWidth;
    if (w <= pasSirka) return; // zmestí sa -> stojí
    k1.classList.add("sirka");
    track.appendChild(k1.cloneNode(true));
    w = k1.offsetWidth;
    var x = 0, last = 0, SP = 38; // px za sekundu
    (function krok(ts) {
      if (!last) last = ts;
      x -= SP * Math.min(0.1, (ts - last) / 1000); last = ts;
      if (x <= -w) x += w;
      track.style.transform = "translate3d(" + x + "px,0,0)";
      pasRaf = requestAnimationFrame(krok);
    })(performance.now());
  }
  try {
    if (window.ResizeObserver) new ResizeObserver(function () {
      var o = document.querySelector("#spravyPas .spravy-pas-okno");
      if (o && o.offsetWidth !== pasSirka) spustiPas();
    }).observe(document.getElementById("spravyPas") || document.body);
  } catch (e) {}

  // ---------- hlavička a bežiaci text
  function obnov() {
    var n = S() ? S().pocetNovych() : 0, b = $("spravyBadge"), btn = $("spravyBtn");
    if (btn) btn.style.display = S() && S().zoznam().length ? "" : "none";
    if (b) { b.textContent = n > 99 ? "99+" : String(n); b.classList.toggle("hidden", !n); }
    var pas = $("spravyPas");
    if (pas) {
      var d = S() ? S().dolezite() : [];
      if (!d.length) { zastavPas(); pas.classList.add("hidden"); pas.innerHTML = ""; }
      else {
        pas.classList.remove("hidden");
        var t = d.map(function (x) { return esc(x.pas || x.nadpis); }).join(" &nbsp;•&nbsp; ");
        pas.innerHTML = '<svg class="spravy-pas-ik" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v5M12 18v.5"/></svg>' +
          '<div class="spravy-pas-okno"><span class="spravy-pas-track"><span class="spravy-pas-kopia">' + t + " &nbsp;›</span></span></div>";
        spustiPas();
        pas.onclick = function () { otvor(d.length === 1 ? d[0].id : null); };
      }
    }
    if (ov) vykresli();
  }

  // ---------- modal
  function zavri() {
    if (!ov) return;
    ov.remove(); ov = null; stav = { otvorena: null, detail: null };
  }
  function otvor(idDetail) {
    if (!S()) return;
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "spravy-ov";
      ov.setAttribute("data-spat-prekryv", "1");
      ov.addEventListener("click", function (e) { if (e.target === ov) { if (stav.detail) { stav.detail = null; vykresli(); } else zavri(); } });
      document.body.appendChild(ov);
    }
    stav.detail = idDetail || null;
    if (!stav.otvorena) { var sx = S().sekcie().filter(function (x) { return x.nove; }); stav.otvorena = sx.length ? sx[0].nazov : null; }
    vykresli();
  }
  function najdi(id) { var r = null; S().zoznam().forEach(function (s) { if (s.id === id) r = s; }); return r; }

  function vykresli() {
    if (!ov) return;
    if (stav.detail) { var m = najdi(stav.detail); if (m) return detail(m); stav.detail = null; }
    var sx = S().sekcie(), nove = S().pocetNovych();
    var h = '<div class="spravy-modal"><div class="spravy-mh"><b>Správy</b><button class="spravy-x" aria-label="Zavrieť">✕</button></div><div class="spravy-sc">';
    if (nove) {
      h += '<button class="spravy-vsetko' + (stav.otvorena === "__nove" ? " otv" : "") + '" data-sek="__nove"><span>Všetko nové</span><span class="spravy-n">' + nove + "</span></button>";
      if (stav.otvorena === "__nove") {
        h += '<div class="spravy-box">';
        sx.forEach(function (x) { x.polozky.forEach(function (s) { if (!s.precitana) h += polozka(s, x.nazov); }); });
        h += "</div>";
      }
    }
    if (!sx.length) h += '<div class="spravy-prazdne">Zatiaľ tu nie sú žiadne správy.</div>';
    sx.forEach(function (x) {
      var otv = stav.otvorena === x.nazov;
      h += '<div class="spravy-sek' + (otv ? " otv" : "") + '"><button class="spravy-sr" data-sek="' + esc(x.nazov) + '"><span class="spravy-i">' + ikona(x.nazov) + "</span><span class=\"spravy-sn\">" + esc(x.nazov) +
        '</span><span class="spravy-n' + (x.nove ? "" : " z") + '">' + x.nove + '</span><span class="spravy-ch">' + (otv ? "⌄" : "›") + "</span></button>";
      if (otv) { h += '<div class="spravy-box">'; x.polozky.forEach(function (s) { h += polozka(s); }); h += "</div>"; }
      h += "</div>";
    });
    if (sx.length) h += '<button class="spravy-znova">Označiť všetko ako neprečítané</button>';
    h += "</div></div>";
    ov.innerHTML = h;
    ov.querySelector(".spravy-x").onclick = zavri;
    var zn = ov.querySelector(".spravy-znova");
    if (zn) zn.onclick = function () { S().vynulujPrecitane(); };
    ov.querySelectorAll("[data-sek]").forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute("data-sek"); stav.otvorena = stav.otvorena === k ? null : k; vykresli(); };
    });
    ov.querySelectorAll("[data-id]").forEach(function (b) { b.onclick = function () { stav.detail = b.getAttribute("data-id"); vykresli(); }; });
  }
  // body dopravného príkazu = riadky „**N. nadpis**“ v texte; v zozname a v detaile ich ukazujeme každý na vlastnom riadku
  function body(s) {
    var r = [];
    String(s.text || "").split("\n").forEach(function (l) {
      var m = /^\*\*(\d{1,2})\.\s+(.+?)\*\*\s*$/.exec(l.trim());
      if (m) r.push({ n: m[1], t: m[2] });
    });
    return r;
  }
  function cislo(t) { return String(t || "").replace(/^(Dopravn\S+ pr[ií]kaz č\. ?\d+\/\d+)\s*[–-].*$/i, "$1"); }

  function polozka(s, sekcia) {
    var m = [sekcia, meta(s)].filter(Boolean).join(" · "), b = body(s);
    return '<button class="spravy-it' + (s.precitana ? "" : " un") + '" data-id="' + esc(s.id) + '"><span class="spravy-it-t">' + esc(b.length ? cislo(s.nadpis) : s.nadpis) + "</span>" +
      b.map(function (x) { return '<span class="spravy-it-b">' + esc(x.n + ". " + x.t) + "</span>"; }).join("") +
      (m ? "<small>" + esc(m) + "</small>" : "") + "</button>";
  }

  // ---------- detail: prečítané po doskrolovaní na koniec
  function detail(s) {
    var tel = esc(s.text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s>])_([^_\n]+)_(?=$|[\s<.,;:])/g, "$1<i>$2</i>").replace(/!\[\]\(([\w.\-]+\.(?:png|jpe?g|gif|webp|bmp))\)/gi, '<span class="spravy-im" data-n="$1" role="button" tabindex="0"><em>Načítavam obrázok…</em></span>').replace(/\n/g, "<br>").replace(/(^|<br>)<b>(\d{1,2})\.\s/g, '$1<b class="spravy-bod" data-b="$2">$2. ');
    var bd = body(s);
    var toc = bd.length > 1 ? '<div class="spravy-toc"><div class="spravy-toc-h">Body príkazu</div>' + bd.map(function (x) { return '<button type="button" class="spravy-toc-i" data-b="' + esc(x.n) + '"><b>' + esc(x.n) + '.</b> ' + esc(x.t) + "</button>"; }).join("") + "</div>" : "";
    ov.innerHTML = '<div class="spravy-modal"><div class="spravy-mh"><button class="spravy-spat" aria-label="Späť">‹</button><b class="spravy-dn">' + esc(bd.length ? cislo(s.nadpis) : s.nadpis) +
      '</b><button class="spravy-x" aria-label="Zavrieť">✕</button></div>' +
      '<div class="spravy-meta">' + [esc(s.sekcia), esc(meta(s))].filter(Boolean).join(" · ") + '</div><div class="spravy-prog"><i></i></div>' +
      (s.original && s.original.some(function (x) { return /\.pdf$/i.test(x); }) ? '<div class="spravy-orig-ln"><button type="button" class="spravy-orig" data-o="pdf">Zobraziť originál</button></div>' : "") +
      '<div class="spravy-sc spravy-cl"><div class="spravy-art">' + toc + (tel || "<span style=\"opacity:.6\">(bez textu)</span>") + "</div></div>" +
      (s.precitana ? "" : '<div class="spravy-pozn">Prečítané sa označí, keď doskroluješ na koniec ↓</div>') + "</div>";
    ov.querySelector(".spravy-x").onclick = zavri;
    ov.querySelector(".spravy-spat").onclick = function () { stav.detail = null; vykresli(); };
    ov.querySelectorAll(".spravy-orig").forEach(function (b) {
      b.onclick = function () {
        ukazOriginal(s.original.filter(function (x) { return /\.pdf$/i.test(x); })[0], s.nadpis, b);
      };
    });
    ov.querySelectorAll(".spravy-im").forEach(nacitajObr);
    ov.querySelectorAll(".spravy-toc-i").forEach(function (b) {
      b.onclick = function () {
        var el = ov.querySelector('.spravy-bod[data-b="' + b.getAttribute("data-b") + '"]'), sc0 = ov.querySelector(".spravy-cl");
        if (el && sc0) sc0.scrollTo({ top: sc0.scrollTop + el.getBoundingClientRect().top - sc0.getBoundingClientRect().top - 8, behavior: "smooth" });
      };
    });
    var sc = ov.querySelector(".spravy-cl"), bar = ov.querySelector(".spravy-prog i"), pozn = ov.querySelector(".spravy-pozn"), hotovo = s.precitana;
    function over() {
      var max = sc.scrollHeight - sc.clientHeight, p = max <= 2 ? 1 : Math.min(1, sc.scrollTop / max);
      bar.style.width = Math.round(p * 100) + "%";
      if (p >= 0.98 && !hotovo) {
        hotovo = true;
        if (pozn) pozn.remove();
        S().oznacPrecitana(s.id);
      }
    }
    sc.addEventListener("scroll", over);
    requestAnimationFrame(over);
  }

  // ---------- obrázky v správach: sťahujú sa z Disku Google (raz, potom z vyrovnávacej pamäte), klik = celá obrazovka so zoomom
  var CACHE = "dpb-prikaz-img";
  function suborObr(n) {
    var kluc = "./__prikaz-img/" + n;
    var c = window.caches ? caches.open(CACHE) : Promise.reject();
    return c.then(function (ca) {
      return ca.match(kluc).then(function (r) {
        if (r) return r.blob();
        return zdroj(n).then(function (bl) { try { ca.put(kluc, new Response(bl)); } catch (e) {} return bl; });
      });
    }).catch(function () { return zdroj(n); });
  }
  function zdroj(n) {
    if (window.DpbDisk && DpbDisk.subor) return DpbDisk.subor(n);
    return fetch("./" + n).then(function (r) { if (!r.ok) throw new Error("nenájdené"); return r.blob(); });
  }
  function nacitajObr(el) {
    var n = el.getAttribute("data-n");
    el.innerHTML = "<em>Načítavam obrázok…</em>";
    suborObr(n).then(function (bl) {
      var u = URL.createObjectURL(bl), im = new Image();
      im.alt = "Obrázok v príkaze"; im.src = u; im.draggable = false;
      el.innerHTML = ""; el.appendChild(im);
      var hint = document.createElement("small"); hint.textContent = "🔍 ťukni pre zväčšenie"; el.appendChild(hint);
      el.onclick = function () { zoomObr(u); };
      el.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zoomObr(u); } };
    }).catch(function () {
      el.innerHTML = "<em>Obrázok sa nepodarilo načítať (potrebuje internet). Ťukni pre nový pokus.</em>";
      el.onclick = function () { nacitajObr(el); };
    });
  }
  function zoomObr(url) {
    var o = document.createElement("div");
    o.className = "spravy-zoom"; o.setAttribute("data-spat-prekryv", "1");
    o.innerHTML = '<img alt="" draggable="false"><button type="button" class="spravy-zx" aria-label="Zavrieť">✕</button><div class="spravy-zh">Dva prsty = zoom · ťukni dvakrát = priblížiť</div>';
    var im = o.querySelector("img"); im.src = url;
    var k = 1, x = 0, y = 0, ptr = {}, d0 = 0, k0 = 1, last = 0;
    function pouzi() {
      var w = o.clientWidth, h = o.clientHeight, iw = im.clientWidth * k, ih = im.clientHeight * k;
      var mx = Math.max(0, (iw - w) / 2), my = Math.max(0, (ih - h) / 2);
      x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y));
      im.style.transform = "translate(" + x + "px," + y + "px) scale(" + k + ")";
    }
    function zmen(nk, cx, cy) {
      nk = Math.max(1, Math.min(8, nk));
      var r = o.getBoundingClientRect(), ax = cx - r.left - r.width / 2, ay = cy - r.top - r.height / 2, f = nk / k;
      x = ax - (ax - x) * f; y = ay - (ay - y) * f; k = nk;
      if (k === 1) { x = 0; y = 0; }
      pouzi();
    }
    function vzd() { var p = Object.keys(ptr).map(function (i) { return ptr[i]; }); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
    o.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".spravy-zx")) return;
      o.setPointerCapture(e.pointerId); ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(ptr).length === 2) { d0 = vzd(); k0 = k; }
      var t = Date.now();
      if (Object.keys(ptr).length === 1) { if (t - last < 300) zmen(k > 1.2 ? 1 : 3, e.clientX, e.clientY); last = t; }
    });
    o.addEventListener("pointermove", function (e) {
      var p = ptr[e.pointerId]; if (!p) return;
      var n = Object.keys(ptr).length;
      if (n === 2) {
        ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
        var q = Object.keys(ptr).map(function (i) { return ptr[i]; });
        if (d0) zmen(k0 * vzd() / d0, (q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2);
      } else if (n === 1 && k > 1) { x += e.clientX - p.x; y += e.clientY - p.y; ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; pouzi(); }
    });
    function koniec(e) { delete ptr[e.pointerId]; d0 = 0; var r = Object.keys(ptr); if (r.length === 1) { /* zvyšný prst pokračuje v posune */ } }
    o.addEventListener("pointerup", koniec); o.addEventListener("pointercancel", koniec);
    o.addEventListener("wheel", function (e) { e.preventDefault(); zmen(k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY); }, { passive: false });
    o.querySelector(".spravy-zx").onclick = function () { o.remove(); };
    im.addEventListener("load", pouzi);
    document.body.insertBefore(o, ov || null);   // pred správami: Späť zatvorí najprv obrázok
  }

  // originál príkazu (PDF): stiahne sa z Disku Google a otvorí vo vlastnom okne
  function ukazOriginal(nazov, nadpis, tl) {
    if (!window.DpbDisk || !DpbDisk.subor) { if (window._showToast) _showToast("Originál nie je dostupný", 3000); return; }
    var txt = tl.textContent; tl.disabled = true; tl.textContent = "Sťahujem…";
    DpbDisk.subor(nazov).then(function (blob) {
      var u = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      var a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    }).catch(function (e) {
      if (window._showToast) _showToast("Originál sa nepodarilo načítať: " + (e && e.message ? e.message : "chyba") + ". Skús to s pripojením na internet.", 4500);
    }).then(function () { tl.disabled = false; tl.textContent = txt; });
  }

  function pripoj() {
    var b = $("spravyBtn");
    if (b && !b.dataset.pripojene) { b.dataset.pripojene = "1"; b.addEventListener("click", function () { ov ? zavri() : otvor(null); }); }
    obnov();
  }
  document.addEventListener("dpb-spravy", obnov);
  document.addEventListener("DOMContentLoaded", pripoj);
  if (document.readyState !== "loading") pripoj();
  window.DpbSpravyUI = { otvor: otvor, zavri: zavri, obnov: obnov };
})();
