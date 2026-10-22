/* Hľadať: vozidlo, kolega (predchodca/nasledovník), služba/kurz – v službách prihláseného vodiča. */
(function () {
  var DNI = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  function el(id) { return document.getElementById(id); }
  function bez(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function p2(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }

  var index = null, indexRid = null, indexCas = 0;
  function zostav() {
    var rid = window.appState && window.appState.currentDriver, out = [];
    if (!rid || !window.DPBData) return out;
    var ds = Array.from(DPBData.getDatesWithService(rid)).sort();
    ds.forEach(function (d) {
      (DPBData.getServicesForDate(rid, d) || []).forEach(function (s) {
        var k = s._karta || {}, vz = s._vzor || k.vzor || "";
        if (vz === "NEPRÍTOMNOSŤ" || vz === "VOLNO") return;
        var voz = (k.vozidla || []).map(function (v) { return String(v.cislo); });
        if (!voz.length && s.vehicle && s.vehicle !== "—") voz = String(s.vehicle).split(/[,\s]+/).filter(Boolean);
        var ludia = [];
        [s.before && s.before.name, s.after && s.after.name, k.pred && k.pred.meno, k.nasl && k.nasl.meno].forEach(function (n) { if (n && ludia.indexOf(n) < 0) ludia.push(n); });
        (k.striedaci || []).forEach(function (x) { var n = x && (x.meno || x.name); if (n && ludia.indexOf(n) < 0) ludia.push(n); });
        out.push({ datum: d, line: String(s.line || ""), time: s.time || "", voz: voz, ludia: ludia, s: s,
          pred: s.before && s.before.name || "", nasl: s.after && s.after.name || "" });
      });
    });
    return out;
  }
  function dajIndex() {
    var rid = window.appState && window.appState.currentDriver;
    if (!index || indexRid !== rid || Date.now() - indexCas > 60000) { index = zostav(); indexRid = rid; indexCas = Date.now(); }
    return index;
  }

  function hladaj(q) {
    var raw = bez(q);
    if (raw.length < 2 && !/^\d+$/.test(raw)) return null;
    var cislo = /^\d+$/.test(raw), kurz = /^\d+\/\d*$/.test(raw);
    var slova = raw.split(/\s+/).filter(Boolean);
    return dajIndex().filter(function (r) {
      if (cislo && raw.length >= 3 && r.voz.some(function (v) { return v.indexOf(raw) === 0; })) return true;
      if (cislo && (r.line === raw || r.line.indexOf(raw + "/") === 0)) return true;
      if (kurz && (r.line === raw || r.line.indexOf(raw) === 0)) return true;
      if (!cislo && !kurz) {
        var h = bez(r.ludia.join(" ") + " " + r.line);
        return slova.every(function (w) { return h.indexOf(w) >= 0; });
      }
      return false;
    });
  }

  function riadok(r, dnes) {
    var p = r.datum.split("-").map(Number), dt = new Date(p[0], p[1] - 1, p[2]);
    var b = document.createElement("button");
    b.type = "button"; b.className = "hl-riadok" + (r.datum < dnes ? " hl-minule" : "") + (r.datum === dnes ? " hl-dnes" : "");
    var info = [];
    if (r.voz.length) info.push("vozidlo " + r.voz.join(", "));
    if (r.pred) info.push("preberáš od " + r.pred);
    if (r.nasl) info.push("odovzdáš " + r.nasl);
    var d = document.createElement("div"); d.className = "hl-den";
    d.innerHTML = "<b></b><span></span>"; d.firstChild.textContent = p2(p[2]) + "." + p2(p[1]) + "."; d.lastChild.textContent = DNI[dt.getDay()];
    var t = document.createElement("div"); t.className = "hl-text";
    var h = document.createElement("div"); h.className = "hl-hlava"; h.textContent = r.line + (r.time ? "  ·  " + r.time : "");
    var i = document.createElement("div"); i.className = "hl-info"; i.textContent = info.join(" · ");
    t.appendChild(h); t.appendChild(i); b.appendChild(d); b.appendChild(t);
    b.addEventListener("click", function () {
      var bt = el("btnToday"); if (bt) bt.click();
      window.appState.selectedDate = dt; window.appState.viewMode = "cards";
      if (window._render) window._render();
    });
    return b;
  }
  function vykresli() {
    var q = el("hladatVstup").value, box = el("hladatVysledky");
    box.innerHTML = "";
    var res = hladaj(q);
    if (res === null) { box.innerHTML = '<div class="hl-pozn">Napíš číslo vozidla (napr. 7436), meno kolegu alebo službu (napr. 4/9).</div>'; return; }
    if (!res.length) { box.innerHTML = '<div class="hl-pozn">Nič som nenašiel v tvojich službách.</div>'; return; }
    var dnes = kluc(new Date()), buduce = res.filter(function (r) { return r.datum >= dnes; }), minule = res.filter(function (r) { return r.datum < dnes; }).reverse();
    function sek(n, a) { if (!a.length) return; var h = document.createElement("div"); h.className = "hl-sek"; h.textContent = n + " (" + a.length + ")"; box.appendChild(h); a.forEach(function (r) { box.appendChild(riadok(r, dnes)); }); }
    sek("Dnes a nasledujúce", buduce); sek("Minulé", minule);
  }
  function otvor() {
    ["burzaView", "profilView", "employerView", "servicesView"].forEach(function (id) { var e = el(id); if (e) e.classList.add("hidden"); });
    el("hladatView").classList.remove("hidden");
    index = null;
    var v = el("hladatVstup"); vykresli();
    setTimeout(function () { v.focus(); }, 80);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var v = el("hladatVstup"), t = null;
    if (v) v.addEventListener("input", function () { clearTimeout(t); t = setTimeout(vykresli, 120); });
  });
  window.Hladat = { otvor: otvor, _hladaj: hladaj };
})();
