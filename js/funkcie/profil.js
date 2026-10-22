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
  });

  window.Profil = { otvor: otvor, odhlas: odhlas };
})();
