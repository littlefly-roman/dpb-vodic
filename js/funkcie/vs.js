/* VS (versus): obrazovka na porovnanie mojej služby so službami vybraných kolegov v ten istý deň.
   Dátum, kalendár aj swipe medzi dňami sú tie z hlavnej obrazovky (Dnes); tu sa len vykreslí obsah dňa.
   Zvolení vodiči sa pamätajú v zariadení (podľa prihláseného vodiča). Funkcia je skrytá, kým ju nepovolí PRAVA.csv (stĺpec vs). */
(function () {
  "use strict";
  var KLUC = "dpb_vs_vodici_";
  function bez(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function minuty(t) {
    var m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(t || "");
    return m ? +m[1] * 60 + +m[2] : 9999;
  }
  function ja() { return String((window.appState && window.appState.currentDriver) || ""); }
  function nacitaj() { try { var a = JSON.parse(localStorage.getItem(KLUC + ja()) || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } }
  function uloz(a) { try { localStorage.setItem(KLUC + ja(), JSON.stringify(a)); } catch (e) {} }
  function prekresli() { if (window._render) window._render(); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function menoVodica(rid) {
    var d = ((window.DPBData && DPBData.getDrivers && DPBData.getDrivers()) || []).filter(function (x) { return String(x.rid) === String(rid); })[0];
    return (d && d.meno) || String(rid);
  }

  // Jedna karta vodiča: hlavička s menom a jeho služby v ten deň (každá na vlastnom riadku)
  function karta(rid, key, jaSom) {
    var k = el("div", "vs-karta" + (jaSom ? " vs-ja" : ""));
    var h = el("div", "vs-hlava");
    var nm = el("div", "vs-meno");
    if (jaSom) nm.textContent = "Ty · " + menoVodica(rid);
    else if (window.DpbKartaNove && window.DpbKartaNove.meno) nm.appendChild(window.DpbKartaNove.meno(menoVodica(rid), { rola: "Vodič" }));
    else nm.textContent = menoVodica(rid);
    h.appendChild(nm);
    if (!jaSom) {
      var x = el("button", "vs-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Odobrať vodiča");
      x.addEventListener("click", function () { uloz(nacitaj().filter(function (r) { return r !== String(rid); })); prekresli(); });
      h.appendChild(x);
    }
    k.appendChild(h);
    var sl = ((window.DPBData && DPBData.getServicesForDate(rid, key)) || []).filter(function (s) { return (s._vzor || (s._karta && s._karta.vzor)) !== "VOLNO"; })
      .slice().sort(function (a, b) { return minuty(a.time) - minuty(b.time); });
    if (!sl.length) { k.appendChild(el("div", "vs-volno", "Voľno")); return k; }
    sl.forEach(function (s) {
      var vz = s._vzor || (s._karta && s._karta.vzor) || "", kt = s._karta || {};
      var r = el("div", "vs-sluzba");
      r.appendChild(el("div", "vs-linka", (vz === "STRIEDAČ" ? "Striedač " : "") + (s.line || "")));
      if (s.time) r.appendChild(el("div", "vs-cas", s.time));
      if (s.route && vz !== "NEPRÍTOMNOSŤ") r.appendChild(el("div", "vs-info", s.route));
      var voz = (kt.vozidla || []).map(function (v) { return String(v.cislo); });
      if (!voz.length && s.vehicle && s.vehicle !== "—") voz = String(s.vehicle).split(/[,\s]+/).filter(Boolean);
      voz = voz.filter(function (c, i) { return voz.indexOf(c) === i; });
      if (voz.length && vz !== "NEPRÍTOMNOSŤ") r.appendChild(el("div", "vs-info", "Vozidlo: " + voz.join(", ")));
      k.appendChild(r);
    });
    return k;
  }

  // Roletka „Pridať vodiča“: hľadanie podľa mena alebo čísla, všetci vodiči z dát
  function roletka(vybrani) {
    var w = el("div", "vs-pridaj");
    var b = el("button", "vs-pridaj-btn"); b.type = "button";
    b.innerHTML = "<span>＋ Pridať vodiča</span><span>▾</span>";
    var p = el("div", "vs-panel"); p.style.display = "none";
    var inp = el("input", "vs-hladaj"); inp.type = "search"; inp.placeholder = "Meno alebo číslo"; inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocapitalize", "off"); inp.setAttribute("spellcheck", "false");
    var zoz = el("div", "vs-zoznam");
    p.appendChild(inp); p.appendChild(zoz);
    function plň() {
      var q = bez(inp.value), slova = q.split(/\s+/).filter(Boolean);
      var vsetci = ((window.DPBData && DPBData.getDrivers && DPBData.getDrivers()) || []).filter(function (d) {
        var rid = String(d.rid);
        return rid !== ja() && vybrani.indexOf(rid) < 0;
      }).sort(function (a, b) { return String(a.meno).localeCompare(String(b.meno), "sk"); });
      var nalez = vsetci.filter(function (d) { var h = bez(d.meno + " " + d.rid); return slova.every(function (x) { return h.indexOf(x) >= 0; }); });
      zoz.innerHTML = "";
      nalez.slice(0, 40).forEach(function (d) {
        var r = el("div", "vs-pol"); r.appendChild(el("span", "", d.meno || d.rid)); r.appendChild(el("span", "vs-cislo", String(d.rid)));
        r.addEventListener("click", function () { var a = nacitaj(); a.push(String(d.rid)); uloz(a); prekresli(); });
        zoz.appendChild(r);
      });
      if (!nalez.length) zoz.appendChild(el("div", "vs-pozn", "Nikoho som nenašiel"));
      else if (nalez.length > 40) zoz.appendChild(el("div", "vs-pozn", "Zobrazených 40 z " + nalez.length + ", spresni hľadanie"));
    }
    b.addEventListener("click", function () {
      var otv = p.style.display === "none";
      p.style.display = otv ? "" : "none";
      if (otv) { plň(); setTimeout(function () { inp.focus(); }, 50); }
    });
    inp.addEventListener("input", plň);
    w.appendChild(b); w.appendChild(p);
    return w;
  }

  function vykresli(host, key) {
    var vybrani = nacitaj();
    var wrap = el("div", "vs-wrap");
    if (ja()) wrap.appendChild(karta(ja(), key, true));
    vybrani.forEach(function (rid) { wrap.appendChild(karta(rid, key, false)); });
    wrap.appendChild(roletka(vybrani));
    host.appendChild(wrap);
  }

  window.DpbVS = { vykresli: vykresli };
})();
