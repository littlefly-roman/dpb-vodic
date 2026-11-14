/* Profil: údaje prihláseného vodiča a tlačidlo „Odhlásiť sa“.
   Odhlásenie teraz vráti na výber vodiča. Keď pribudne skutočné prihlasovanie,
   zmení sa len funkcia odhlas() – napr. presmerovanie na prihlasovaciu obrazovku. */
(function () {
  var TRAKCIE = { A: "Električka", T: "Autobus", O: "Trolejbus" };

  function el(id) { return document.getElementById(id); }

  function otvor() {
    var rid = window.appState && window.appState.currentDriver;
    var d = (window.DPBData ? DPBData.getDrivers() : []).filter(function (x) {
      return String(x.rid) === String(rid);
    })[0];
    el("profilMeno").textContent = d ? d.meno : rid || "";
    el("profilRid").textContent = rid || "";
    var k = window.DPBData && DPBData.getTrakciaKod ? DPBData.getTrakciaKod(rid) : null;
    el("profilTrakcia").textContent = (k && TRAKCIE[k]) || "–";
    el("burzaView").classList.add("hidden");
    var nv = el("nastaveniaView"); if (nv) nv.classList.add("hidden");
    el("profilView").classList.remove("hidden");
  }

  // Nastavenia: dáta, Disk Google, obrazovka, skúška upozornení, načítanie dát
  function otvorNastavenia() {
    el("burzaView").classList.add("hidden");
    el("profilView").classList.add("hidden");
    var hv = el("hladatView"); if (hv) hv.classList.add("hidden");
    el("nastaveniaView").classList.remove("hidden");
    obnovInfoODatach();
    diag();
  }

  function pred(ms) {
    var m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 60) return "pred " + m + " min";
    var h = Math.floor(m / 60);
    if (h < 48) return "pred " + h + " h";
    return "pred " + Math.floor(h / 24) + " dňami";
  }

  function obnovInfoODatach() {
    var i = el("profilDataInfo");
    if (!i) return;
    if (!window._infoODatach) { i.textContent = "–"; return; }
    window._infoODatach().then(function (z) {
      if (!z) { i.textContent = "–"; return; }
      var k = new Date(z.cas);
      i.textContent = "";
      var a = document.createElement("div");
      a.textContent = k.getDate() + ". " + (k.getMonth() + 1) + ". " + String(k.getHours()).padStart(2, "0") + ":" + String(k.getMinutes()).padStart(2, "0") + " (" + pred(z.cas) + ")";
      var b = document.createElement("div");
      b.style.cssText = "color:var(--text-3);font-size:15px;word-break:break-all";
      b.textContent = z.nazov;
      i.appendChild(a);
      i.appendChild(b);
    }).catch(function () { i.textContent = "–"; });
  }

  function odhlas() {
    try { localStorage.removeItem("dpb_relacia"); } catch (e) {}
    // zavri všetko, čo môže byť otvorené
    ["cpModal", "grafikonModal"].forEach(function (id) {
      var m = el(id);
      if (m) m.classList.remove("active");
    });
    var ov = el("modalOverlay");
    if (ov) ov.classList.remove("active");
    if (window.Notif && Notif.zavriet) Notif.zavriet();
    if (window.Notif && Notif.nastavVodica) Notif.nastavVodica(null);
    var cal = el("calendarPanel");
    if (cal) cal.classList.add("hidden");
    var st = window.appState;
    if (st) {
      if (st.grafikonInterval) { clearInterval(st.grafikonInterval); st.grafikonInterval = null; }
      st.currentDriver = null;
      st.servicesByDate = {};
      st.viewMode = "cards";
      st.mainView = "services";
    }
    // pôvodný stav hlavnej obrazovky pre ďalšieho vodiča
    el("profilView").classList.add("hidden");
    var nv2 = el("nastaveniaView"); if (nv2) nv2.classList.add("hidden");
    el("burzaView").classList.add("hidden");
    el("employerView").classList.add("hidden");
    el("servicesView").classList.remove("hidden");
    var c = el("servicesContainer");
    if (c) c.innerHTML = "";
    var navs = document.querySelectorAll(".bottom-nav button");
    for (var i = 0; i < navs.length; i++) navs[i].classList.toggle("active", navs[i].dataset.nav === "today");
    var bl = el("btnList");
    if (bl) bl.style.color = "";
    if (window._ikonaPrepnutia && window.appState) window._ikonaPrepnutia(window.appState.viewMode);
    // výber vodiča
    var sel = el("loginDriverSel");
    if (sel) sel.value = "";
    var lb = el("loginBtn");
    if (lb) lb.disabled = true;
    el("loginScreen").classList.remove("hidden");
    if (window.DpbIkony) DpbIkony.prehraj();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var b = el("profilOdhlasit");
    if (b) b.addEventListener("click", odhlas);
    var n = el("profilNacitat"), inp = el("profilCsvInput");
    if (n && inp) {
      n.addEventListener("click", function () { inp.click(); });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var text = n.textContent;
        n.disabled = true;
        n.textContent = "Načítavam…";
        window._nacitajNoveData(f).then(function (meno) {
          if (window._showToast) window._showToast("Dáta načítané");
          obnovInfoODatach();
        }).catch(function (e) {
          if (window._showToast) window._showToast("Chyba: " + (e && e.message ? e.message : "súbor sa nepodarilo načítať"), 4000);
        }).then(function () {
          n.disabled = false;
          n.textContent = text;
          inp.value = "";
        });
      });
    }
  });

  function diag() {
    var d = document.getElementById("profilDiag");
    if (!d) return;
    var pr = document.createElement("div");
    pr.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0";
    document.body.appendChild(pr);
    var cs = getComputedStyle(pr), st = parseInt(cs.paddingTop, 10) || 0, sb = parseInt(cs.paddingBottom, 10) || 0;
    pr.remove();
    function mer(css) {
      var q = document.createElement("div");
      q.style.cssText = "position:fixed;left:0;width:1px;visibility:hidden;pointer-events:none;" + css;
      document.body.appendChild(q);
      var h = Math.round(q.getBoundingClientRect().height);
      q.remove();
      return h;
    }
    var vv = window.visualViewport ? Math.round(visualViewport.height) : "?";
    var m2 = "inset-fix " + mer("top:0;bottom:0") + " · lvh " + mer("top:0;height:100lvh") + " · svh " + mer("top:0;height:100svh") +
      " · dvh " + mer("top:0;height:100dvh") + " · vv " + vv + " · body " + Math.round(document.body.getBoundingClientRect().height);
    var sa = (window.navigator.standalone === true) || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    d.textContent = "Zobrazenie: okno " + innerWidth + "×" + innerHeight + " · obrazovka " + screen.width + "×" + screen.height +
      " · okraje hore/dole " + st + "/" + sb + " · " + (sa ? "appka na ploche" : "prehliadač") + " · " + m2;
  }
  window.Profil = { otvor: otvor, otvorNastavenia: otvorNastavenia, odhlas: odhlas, obnovInfo: obnovInfoODatach };
})();

// Profil: výber obdobia štatistiky – ťuk na rok, štvrťrok (I–IV) alebo mesiac (1–12); polia sa naplnia neskôr z FS DB alebo METISu
(function () {
  var vyber = document.getElementById("profilVyber");
  if (!vyber) return;
  var RIM = ["I", "II", "III", "IV"];
  var MES = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  var now = new Date(), st = { ob: "mesiac", rok: now.getFullYear(), i: now.getMonth() }, hotovo = false;
  // mesiace, za ktoré má prihlásený vodič nejaké dáta ("YYYY-M", mesiac 0–11); ostatné obdobia sú neviditeľné
  function dostupne() {
    var out = {}, rid = window.appState && window.appState.currentDriver, m = window.RAW && window.RAW.models && window.RAW.models[rid];
    (m || []).forEach(function (d) {
      var x = /^(\d{4})-(\d{2})/.exec(String(d.datum || ""));
      if (x) out[+x[1] + "-" + (+x[2] - 1)] = 1;
    });
    return out;
  }
  function kresli() {
    var D = dostupne(), roky = Object.keys(D).map(function (k) { return +k.split("-")[0]; });
    var maRok = function (r) { return roky.indexOf(r) >= 0; };
    var maM = function (r, mm) { return !!D[r + "-" + mm]; };
    var maQ = function (r, q) { return maM(r, q * 3) || maM(r, q * 3 + 1) || maM(r, q * 3 + 2); };
    if (!hotovo && roky.length) {   // prvé zobrazenie s dátami: aktuálny mesiac, inak najnovší dostupný
      hotovo = true;
      if (!maM(st.rok, st.i)) {
        var posl = Object.keys(D).map(function (k) { var a = k.split("-"); return +a[0] * 12 + +a[1]; }).sort(function (a, b) { return a - b; }).pop();
        st.rok = Math.floor(posl / 12); st.i = posl % 12; st.ob = "mesiac";
      }
    }
    var mn = roky.length ? Math.min.apply(null, roky) : st.rok, mx = roky.length ? Math.max.apply(null, roky) : st.rok;
    document.getElementById("profilRokMinus").style.visibility = st.rok > mn ? "" : "hidden";
    document.getElementById("profilRokPlus").style.visibility = st.rok < mx ? "" : "hidden";
    var rb = document.getElementById("profilRokTxt");
    rb.textContent = st.rok; rb.classList.toggle("on", st.ob === "rok");
    vyber.innerHTML = "";
    for (var q = 0; q < 4; q++) {
      var rad = document.createElement("div");
      rad.className = "pf-rad";
      var bq = document.createElement("button");
      bq.type = "button"; bq.dataset.ob = "stvrtrok"; bq.dataset.i = q; bq.textContent = RIM[q];
      bq.className = "pf-q" + (st.ob === "stvrtrok" && st.i === q ? " on" : "");
      if (!maQ(st.rok, q)) { bq.style.visibility = "hidden"; rad.style.visibility = "hidden"; }
      rad.appendChild(bq);
      for (var m = q * 3; m < q * 3 + 3; m++) {
        var bm = document.createElement("button");
        bm.type = "button"; bm.dataset.ob = "mesiac"; bm.dataset.i = m; bm.textContent = m + 1;
        if (st.ob === "mesiac" && st.i === m) bm.className = "on";
        if (!maM(st.rok, m)) bm.style.visibility = "hidden";
        rad.appendChild(bm);
      }
      vyber.appendChild(rad);
    }
    document.getElementById("profilZvolene").textContent =
      st.ob === "rok" ? "Rok " + st.rok : st.ob === "stvrtrok" ? RIM[st.i] + ". štvrťrok " + st.rok : MES[st.i].charAt(0).toUpperCase() + MES[st.i].slice(1) + " " + st.rok;
    dopln();
  }
  // štatistika zvoleného obdobia: súčet mesačných výkazov (DpbVykaz._zber)
  function hm(min) { var z = min < 0 ? "−" : "", a = Math.abs(Math.round(min)); return z + Math.floor(a / 60) + ":" + String(a % 60).padStart(2, "0"); }
  var NAZ = { dov: "Dovolenka", pn: "PN", ocr: "OČR", lek: "Lekár", dop: "Doprovod", ine: "Iné neprítomnosti" };
  function druh(n) {
    if (/dovolen/i.test(n)) return "dov";
    if (/nemoc|karant|izol/i.test(n)) return "pn";
    if (/ošetrov/i.test(n)) return "ocr";
    if (/lek[aá]r|prehliadk|psycholog/i.test(n)) return "lek";
    if (/doprov|sprievod/i.test(n)) return "dop";
    return "ine";
  }
  // riadok, ktorý sa po ťuknutí rozbalí a vypíše podpoložky
  function rozbalitelny(key) {
    var el = document.querySelector("[data-pf=st_" + key + "]"), rad = el && el.parentNode, box = null;
    if (!rad) return function () {};
    box = document.createElement("div"); box.className = "pf-ine"; box.hidden = true;
    rad.parentNode.insertBefore(box, rad.nextSibling);
    rad.classList.add("pf-klik");
    rad.addEventListener("click", function () { if (rad.classList.contains("maobsah")) { box.hidden = !box.hidden; rad.classList.toggle("otvorene", !box.hidden); el.style.display = box.hidden ? "" : "none"; } });
    return function (polozky) {
      box.innerHTML = "";
      polozky.forEach(function (p) { var r = document.createElement("div"); r.className = "employer-detail-row"; r.innerHTML = "<span></span><span class='pf-hod'></span>"; r.firstChild.textContent = p[0]; r.lastChild.textContent = p[1]; box.appendChild(r); });
      rad.classList.toggle("maobsah", polozky.length > 0);
      if (!polozky.length) { box.hidden = true; rad.classList.remove("otvorene"); el.style.display = ""; }
    };
  }
  var vypisIne = rozbalitelny("ine"), vypisPlat = rozbalitelny("plat");
  function dopln() {
    var mes = st.ob === "rok" ? [0,1,2,3,4,5,6,7,8,9,10,11] : st.ob === "stvrtrok" ? [st.i * 3, st.i * 3 + 1, st.i * 3 + 2] : [st.i];
    var S = { vykon: 0, nadcas: 0, svozom: 0, nocne: 0, so: 0, ne: 0, sviatky: 0, stravne: 0, pocet: 0, dov: 0, pn: 0, ocr: 0, lek: 0, dop: 0, ine: 0, plat: 0, uvazok: 0 }, mal = false, ineD = {}, platD = {};
    if (window.DpbVykaz && DpbVykaz._zber) mes.forEach(function (mm) {
      try {
        var X = DpbVykaz._zber(new Date(st.rok, mm, 1)), T = X.T, kl = Object.keys(X.nepr || {});
        if (!(T.dni > 0 || kl.length)) return;
        mal = true;
        S.vykon += T.cisty; S.nadcas += T.nadcas; S.svozom += T.voz; S.nocne += T.noc; S.so += T.so; S.ne += T.ne; S.sviatky += T.sv; S.stravne += T.str; S.pocet += T.dni; S.plat += T.plat; S.uvazok += T.fond || 0;
        (X.rows || []).forEach(function (r) { if (r.nepr && r.kredit > 0) { var d = druh(r.sl || ""); platD[d] = (platD[d] || 0) + r.kredit; } });
        kl.forEach(function (k) {
          var d = druh(k); S[d] += X.nepr[k];
          if (d === "ine") ineD[k] = (ineD[k] || 0) + X.nepr[k];
        });
      } catch (e) {}
    });
    var HM = { uvazok: 1, plat: 1, vykon: 1, nadcas: 1, svozom: 1, nocne: 1, so: 1, ne: 1, sviatky: 1 };
    Object.keys(S).forEach(function (k) {
      var el = document.querySelector("[data-pf=st_" + k + "]");
      if (el) el.textContent = !mal ? "–" : HM[k] ? hm(S[k]) : String(S[k]);
    });
    vypisIne(mal ? Object.keys(ineD).map(function (n) { return [n, ineD[n]]; }) : []);
    // „Platené neprítomnosti“ = len tie, ktoré platí zamestnávateľ (bez PN a OČR, tie platí Sociálna poisťovňa)
    var ZAM = ["dov", "lek", "dop", "ine"], NAZP = { dov: "Dovolenka", lek: "Lekár", dop: "Doprovod", ine: "Iné platené neprítomnosti" }, sp = 0;
    ZAM.forEach(function (d) { sp += platD[d] || 0; });
    var elp = document.querySelector("[data-pf=st_plat]"); if (elp) elp.textContent = mal ? hm(sp) : "–";
    vypisPlat(mal ? ZAM.filter(function (d) { return platD[d] > 0; }).map(function (d) { return [NAZP[d], hm(platD[d])]; }) : []);
    // nulové hodnoty sa nezobrazujú, ani ich riadky (a nadpis bloku, ak v ňom nič nezostane)
    S.plat = sp;
    var zivych = 0, nepr = 0;
    Object.keys(S).forEach(function (k) {
      var el = document.querySelector("[data-pf=st_" + k + "]"), rad = el && el.parentNode; if (!rad) return;
      var skry = !mal || Math.round(S[k]) === 0;
      rad.style.display = skry ? "none" : "";
      if (!skry) { zivych++; if (/^(dov|pn|ocr|lek|dop|ine)$/.test(k)) nepr++; }
    });
    var nad = document.getElementById("profilNeprNadpis"); if (nad) nad.style.display = nepr ? "" : "none";
    var pr = document.getElementById("profilStatPrazdno"); if (pr) pr.style.display = zivych ? "none" : "";
  }
  vyber.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-ob]"); if (!b) return;
    st.ob = b.dataset.ob; st.i = +b.dataset.i; kresli();
  });
  document.getElementById("profilRokTxt").addEventListener("click", function () { st.ob = "rok"; kresli(); });
  document.getElementById("profilRokMinus").addEventListener("click", function () { st.rok--; kresli(); });
  document.getElementById("profilRokPlus").addEventListener("click", function () { st.rok++; kresli(); });
  kresli();
  // pri otvorení Profilu a po načítaní dát sa dostupné obdobia obnovia
  document.addEventListener("click", function (e) { if (e.target.closest("[data-nav=profil]")) setTimeout(kresli, 50); });
  window.DpbProfilStat = { obnov: kresli };
})();
