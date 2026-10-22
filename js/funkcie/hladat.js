/* Hľadať: kto / aký kurz / ktoré vozidlo je v zvolený deň kde (všetci vodiči z načítaných dát). */
(function () {
  var DNI = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  var den = null, indexDna = null, indexKluc = "";
  function el(id) { return document.getElementById(id); }
  function bez(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function p2(n) { return String(n).padStart(2, "0"); }
  function kluc(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function minuty(t) {
    var m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(t || "");
    if (!m) return null;
    var a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
    return [a, b <= a ? b + 1440 : b];
  }

  // všetky služby daného dňa všetkých vodičov
  function zostav(key) {
    var out = [];
    if (!window.DPBData) return out;
    DPBData.getDrivers().forEach(function (d) {
      (DPBData.getServicesForDate(d.rid, key) || []).forEach(function (s) {
        var k = s._karta || {}, vz = s._vzor || k.vzor || "";
        var nepr = vz === "NEPRÍTOMNOSŤ";
        if (vz === "VOLNO") return;
        var voz = (k.vozidla || []).map(function (v) { return { c: String(v.cislo), t: v.od && v.do ? v.od + "–" + v.do : "" }; });
        if (!voz.length && s.vehicle && s.vehicle !== "—") voz = String(s.vehicle).split(/[,\s]+/).filter(Boolean).map(function (c) { return { c: c, t: "" }; });
        out.push({ rid: String(d.rid), meno: d.meno || String(d.rid), line: String(s.line || ""), time: s.time || "", voz: voz, nepr: nepr,
          route: s.route || "", od: minuty(s.time) });
      });
    });
    return out;
  }
  function dajIndex(key) {
    if (!indexDna || indexKluc !== key) { indexDna = zostav(key); indexKluc = key; }
    return indexDna;
  }

  function hladaj(q, key) {
    var raw = bez(q);
    if (!raw) return null;
    var cislo = /^\d+$/.test(raw), kurz = /^\d+\/\d*$/.test(raw), slova = raw.split(/\s+/).filter(Boolean);
    return dajIndex(key).filter(function (r) {
      if (cislo) {
        if (raw.length >= 3 && r.voz.some(function (v) { return v.c.indexOf(raw) === 0; })) return true;
        if (raw.length >= 3 && r.rid.indexOf(raw) === 0) return true;
        return !r.nepr && (r.line === raw || r.line.indexOf(raw + "/") === 0);
      }
      if (kurz) return !r.nepr && r.line.indexOf(raw) === 0;
      if (raw.length < 2) return false;
      var h = bez(r.meno + " " + r.line);
      return slova.every(function (w) { return h.indexOf(w) >= 0; });
    }).sort(function (a, b) { return (a.od ? a.od[0] : 9999) - (b.od ? b.od[0] : 9999); });
  }

  function riadok(r, jeDnes, teraz) {
    var d = document.createElement("div"); d.className = "hl-riadok";
    var bezi = jeDnes && r.od && !r.nepr && (teraz >= r.od[0] && teraz < r.od[1] || teraz + 1440 >= r.od[0] && teraz + 1440 < r.od[1]);
    if (bezi) d.className += " hl-dnes";
    var t = document.createElement("div"); t.className = "hl-text";
    var h = document.createElement("div"); h.className = "hl-hlava"; h.textContent = r.meno;
    var s = document.createElement("div"); s.className = "hl-sluzba";
    s.textContent = r.nepr ? r.line + (r.time ? "  ·  " + r.time : "") : r.line + (r.time ? "  ·  " + r.time : "");
    t.appendChild(h); t.appendChild(s);
    if (r.voz.length) {
      var v = document.createElement("div"); v.className = "hl-info";
      v.textContent = "Vozidlo: " + r.voz.map(function (x) { return x.c + (x.t && r.voz.length > 1 ? " (" + x.t + ")" : ""); }).join(", ");
      t.appendChild(v);
    }
    if (r.route && !r.nepr) { var tr = document.createElement("div"); tr.className = "hl-info"; tr.textContent = r.route; t.appendChild(tr); }
    d.appendChild(t);
    if (bezi) { var b = document.createElement("span"); b.className = "hl-teraz"; b.textContent = "● teraz"; d.appendChild(b); }
    return d;
  }

  function vykresli() {
    var key = kluc(den), dnes = kluc(new Date()), box = el("hladatVysledky");
    el("hladatDatum").textContent = (key === dnes ? "Dnes · " : "") + DNI[den.getDay()] + " " + den.getDate() + ". " + (den.getMonth() + 1) + ". " + den.getFullYear();
    box.innerHTML = "";
    var res = hladaj(el("hladatVstup").value, key);
    if (res === null) { box.innerHTML = '<div class="hl-pozn">Napíš meno vodiča, číslo vozidla (napr. 7436) alebo službu (napr. 4/9) – ukážem, kde je v zvolený deň.</div>'; return; }
    if (!res.length) { box.innerHTML = '<div class="hl-pozn">V tento deň som nič nenašiel.</div>'; return; }
    var n = new Date(), teraz = n.getHours() * 60 + n.getMinutes(), jeDnes = key === dnes;
    var cnt = document.createElement("div"); cnt.className = "hl-sek"; cnt.textContent = "Nájdené: " + res.length + (res.length > 80 ? " (zobrazených 80)" : "");
    box.appendChild(cnt);
    res.slice(0, 80).forEach(function (r) { box.appendChild(riadok(r, jeDnes, teraz)); });
  }
  function posun(n) { den = new Date(den.getFullYear(), den.getMonth(), den.getDate() + n); vykresli(); }
  function otvor() {
    ["burzaView", "profilView", "employerView", "servicesView"].forEach(function (id) { var e = el(id); if (e) e.classList.add("hidden"); });
    el("hladatView").classList.remove("hidden");
    indexDna = null; den = new Date(); vykresli();
    setTimeout(function () { el("hladatVstup").focus(); }, 80);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var v = el("hladatVstup"), t = null;
    if (v) v.addEventListener("input", function () { clearTimeout(t); t = setTimeout(vykresli, 120); });
    var a = el("hladatPred"), b = el("hladatDalej"), c = el("hladatDatum");
    if (a) a.addEventListener("click", function () { posun(-1); });
    if (b) b.addEventListener("click", function () { posun(1); });
    if (c) c.addEventListener("click", function () { den = new Date(); vykresli(); });
  });
  window.Hladat = { otvor: otvor, _hladaj: hladaj };
})();
