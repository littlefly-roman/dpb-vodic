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
    el("profilView").classList.remove("hidden");
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
  window.Profil = { otvor: otvor, odhlas: odhlas, obnovInfo: obnovInfoODatach };
})();
