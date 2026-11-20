/* Čítač predpisu (D 1/1…): obsah po častiach a paragrafoch, fultextové vyhľadávanie bez diakritiky, klikateľné obrázky.
   Dáta (JSON z exportu, súbor PRED-….json na Disku Google) sa sťahujú raz a potom sú v telefóne. Predpis je interný,
   preto nie je v repozitári, ale len na Disku. Volá sa zo Správ: DpbPredpis.otvor(nazovSuboru, nadpis). */
(function () {
  "use strict";
  var D = null, flat = [], q = "", otvorena = null, home = null, vyr = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nrm(s) { var o = ""; for (var i = 0; i < s.length; i++) o += s[i].normalize("NFD")[0].toLowerCase(); return o; }
  function mark(t, k) {
    if (!k) return esc(t);
    var n = nrm(t), kk = nrm(k), o = "", p = 0, i;
    while ((i = n.indexOf(kk, p)) >= 0) { o += esc(t.slice(p, i)) + "<mark>" + esc(t.slice(i, i + kk.length)) + "</mark>"; p = i + kk.length; }
    return o + esc(t.slice(p));
  }
  function el(cls, html) { var o = document.createElement("div"); o.className = cls; o.setAttribute("data-spat-prekryv", "1"); o.innerHTML = html; return o; }
  // gesto Späť klikne programovo (detail 0) na vrchnú vrstvu: tá sa má zatvoriť; skutočné ťuknutie (detail > 0) nie
  function naSpat(o, f) { o.addEventListener("click", function (e) { if (e.target === o && e.detail === 0) f(); }); }
  function pn(p) { return /^P\d/.test(p.n) ? "Príloha č. " + p.n.slice(1) : "§ " + p.n; }
  function cn(c) { return /^PRÍLOHA/.test(c.n) ? "Prílohy" : "Časť " + c.n.toLowerCase() + " – " + c.t; }
  function pred() { return document.querySelector(".spravy-ov"); }
  function vlozPredPrvy(o, p) { document.body.insertBefore(o, p || pred() || null); }

  function hladaj(k) {
    var n = nrm(k.trim()), list = [], cnt = 0;
    flat.forEach(function (f, i) {
      f.p.items.forEach(function (it, j) {
        var t = nrm(it.t || it.s || ""), p = t.indexOf(n);
        if (p >= 0) { cnt++; if (list.length < 40) { var s = Math.max(0, p - 50); list.push({ i: i, j: j, p: f.p, sn: (s ? "…" : "") + mark((it.t || it.s).slice(s, p + n.length + 70), k) + "…" }); } }
      });
    });
    return { n: cnt, list: list };
  }

  function kresliDomov(nadpis) {
    var h = '<div class="pr-hl"><button type="button" class="pr-x" aria-label="Zavrieť">✕</button><b>' + esc(nadpis) + '</b></div><div class="pr-sr"><input type="search" id="prQ" placeholder="Hľadať v predpise (slovo, číslo §…)" value="' + esc(q) + '"></div><div class="pr-wr">';
    if (q.trim().length >= 2) {
      var r = hladaj(q);
      h += '<div class="pr-cnt">' + (r.n ? r.n + " nájdených miest" + (r.n > r.list.length ? " (zobrazených " + r.list.length + ")" : "") : "Nič sa nenašlo") + "</div>";
      r.list.forEach(function (x) { var m = x.p.items[x.j].m; var it = x.p.items[x.j]; h += '<div class="pr-hit" data-i="' + x.i + '" data-j="' + x.j + '"><h6>' + esc(pn(x.p)) + " " + esc(x.p.t) + (m && m !== "–" ? " · " + esc(m) : "") + (it.lab ? " · " + esc(it.lab) : "") + "</h6>" + x.sn + "</div>"; });
    } else {
      D.casti.forEach(function (c, ci) {
        h += '<div class="pr-cast"><button type="button" data-c="' + ci + '"><b>' + esc(cn(c)) + "</b><small>" + c.par.length + (/^PRÍLOHA/.test(c.n) ? "" : " §") + "</small><span>" + (otvorena === ci ? "▴" : "▾") + "</span></button>";
        if (otvorena === ci) h += '<div class="pr-pl">' + c.par.map(function (p) { return '<button type="button" data-p="' + flat.findIndex(function (f) { return f.p === p; }) + '"><b>§ ' + esc(p.n) + "</b>" + esc(p.t) + "</button>"; }).join("") + "</div>";
        h += "</div>";
      });
    }
    home.innerHTML = h + "</div>";
    home.querySelector(".pr-x").onclick = function () { zavri(); };
    var inp = home.querySelector("#prQ");
    inp.oninput = function () { q = inp.value; var pos = inp.selectionStart; kresliDomov(nadpis); var n = home.querySelector("#prQ"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
    home.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { var c = +b.getAttribute("data-c"); otvorena = otvorena === c ? null : c; kresliDomov(nadpis); }; });
    home.querySelectorAll("[data-p]").forEach(function (b) { b.onclick = function () { cituj(+b.getAttribute("data-p")); }; });
    home.querySelectorAll(".pr-hit").forEach(function (b) { b.onclick = function () { cituj(+b.getAttribute("data-i"), +b.getAttribute("data-j")); }; });
  }

  function cituj(i, hi) {
    var f = flat[i], p = f.p, k = q.trim().length >= 2 ? q : "";
    if (!vyr) { vyr = el("pr-ov pr-rd", ""); vlozPredPrvy(vyr, home); naSpat(vyr, zavriCitanie); }
    var h = '<div class="pr-hl"><button type="button" class="pr-b" aria-label="Späť">‹</button><b>' + esc(pn(p)) + " " + esc(p.t) + '</b><button type="button" class="pr-x" aria-label="Zavrieť všetko">✕</button></div><div class="pr-rdb"><div class="pr-cs">' + esc(cn(f.c)) + '</div><h1>' + esc(pn(p)) + " · " + esc(p.t) + '</h1><div class="pr-art">';
    p.items.forEach(function (it, j) {
      if (it.t) h += '<div class="pr-it pr-l' + it.l + '" id="pri' + j + '"><b>' + esc(it.m) + (it.l === 1 ? "." : it.l === 2 ? ")" : "") + "</b> " + mark(it.t, hi != null && j === hi ? k : "") + "</div>";
      else h += '<div id="pri' + j + '" class="pr-pg">' + (it.lab ? esc(it.lab) : "") + "</div>";
      (it.img || []).forEach(function (n) { h += '<span class="pr-im" data-k="' + n + '"><img alt="Obrázok v predpise" src="' + D.img[n] + '"><small>🔍 ťukni pre zväčšenie</small></span>'; });
    });
    h += '</div></div><div class="pr-nv"><button type="button" class="pr-pv"' + (i ? "" : " disabled") + ">‹ " + (i ? esc(pn(flat[i - 1].p).replace('Príloha č. ', 'Pr. ')) : "") + '</button><button type="button" class="pr-nx"' + (i < flat.length - 1 ? "" : " disabled") + ">" + (i < flat.length - 1 ? esc(pn(flat[i + 1].p).replace('Príloha č. ', 'Pr. ')) : "") + " ›</button></div>";
    vyr.innerHTML = h;
    var sc = vyr.querySelector(".pr-rdb"); sc.scrollTop = 0;
    vyr.querySelector(".pr-b").onclick = function () { zavriCitanie(); };
    vyr.querySelector(".pr-x").onclick = function () { zavri(); };
    vyr.querySelector(".pr-pv").onclick = function () { cituj(i - 1); };
    vyr.querySelector(".pr-nx").onclick = function () { cituj(i + 1); };
    vyr.querySelectorAll(".pr-im").forEach(function (e) { e.onclick = function () { if (window.DpbZoom) window.DpbZoom(D.img[+e.getAttribute("data-k")], vyr); }; });
    if (hi != null) { var e = vyr.querySelector("#pri" + hi); if (e) setTimeout(function () { sc.scrollTop = e.offsetTop - 70; }, 30); }
  }
  function zavriCitanie() { if (vyr) { vyr.remove(); vyr = null; } }
  function zavri() { zavriCitanie(); if (home) { home.remove(); home = null; } }

  function otvor(nazov, nadpis) {
    if (!window.DpbSpravyFile) return;
    zavri();
    home = el("pr-ov", '<div class="pr-hl"><button type="button" class="pr-x">✕</button><b>' + esc(nadpis) + '</b></div><div class="pr-wr"><div class="pr-cnt">Načítavam predpis…</div></div>');
    vlozPredPrvy(home); naSpat(home, zavri);
    home.querySelector(".pr-x").onclick = zavri;
    var hh = home;
    (D && D.__n === nazov ? Promise.resolve(D) : DpbSpravyFile(nazov).then(function (bl) { return bl.text(); }).then(function (t) { var d = JSON.parse(t); d.__n = nazov; return d; }))
      .then(function (d) {
        if (home !== hh) return;
        D = d; flat = []; D.casti.forEach(function (c) { c.par.forEach(function (p) { flat.push({ c: c, p: p }); }); });
        q = ""; otvorena = null; kresliDomov(nadpis);
      }).catch(function () {
        if (home !== hh) return;
        home.querySelector(".pr-wr").innerHTML = '<div class="pr-cnt">Predpis sa nepodarilo načítať (pri prvom otvorení treba internet). <button type="button" class="pr-znova">Skúsiť znova</button></div>';
        home.querySelector(".pr-znova").onclick = function () { otvor(nazov, nadpis); };
      });
  }
  window.DpbPredpis = { otvor: otvor };
})();
