/* Gesto / tlačidlo „späť“ v telefóne: vráti o jednu obrazovku namiesto ukončenia appky.
   Poradie: okná (stoh) → žiadosť → grafikon → cestovné poriadky → kalendár → notifikácie → menu → iná obrazovka než Dnes.
   Na hlavnej obrazovke: prvé potiahnutie ukáže upozornenie, druhé do 2 s appku ukončí. */
(function () {
  "use strict";
  var armed = false, armT = null;
  function $(id) { return document.getElementById(id); }
  function viditelne(el) { return el && el.style.display !== "none" && getComputedStyle(el).display !== "none"; }

  function zavriVrstvu() {
    var O = window.DpbOkna;
    if (O && O.pocet && O.pocet() > 0) { O.zavriVrch(); return true; }
    var pr = document.querySelector("[data-spat-prekryv]");
    if (pr) { pr.click(); return true; }
    var z = $("ziadostModal");
    if (z && viditelne(z) && z.style.display !== "") { var b = $("ziadostZrusit"); if (b) b.click(); else z.style.display = "none"; return true; }
    var g = $("grafikonModal");
    if (g && g.classList.contains("active")) { var c = $("closeGrafikon"); if (c) c.click(); return true; }
    var cp = $("cpModal");
    if (cp && cp.classList.contains("active")) { var cc = $("cpClose"); if (cc) cc.click(); else cp.classList.remove("active"); return true; }
    var cal = $("calendarPanel");
    if (cal && !cal.classList.contains("hidden")) { cal.classList.add("hidden"); return true; }
    var n = $("notifPanel");
    if (n && !n.classList.contains("hidden")) { if (window.Notif && Notif.zavriet) Notif.zavriet(); else n.classList.add("hidden"); return true; }
    var bf = $("burzaFilterBack");
    if (bf && viditelne(bf)) { bf.click(); return true; }
    var t = $("btnToday");
    if (t && !t.classList.contains("active")) { t.click(); return true; }
    return false;
  }

  function toast(t) { if (window._showToast) window._showToast(t, 2000); }

  function naSpat() {
    history.pushState({ dpb: "root" }, "");
    if (zavriVrstvu()) { armed = false; return; }
    if (armed) {
      armed = false; clearTimeout(armT);
      window.removeEventListener("popstate", naSpat);
      history.go(-2);
      return;
    }
    armed = true;
    toast("Ďalším potiahnutím späť ukončíš appku");
    clearTimeout(armT);
    armT = setTimeout(function () { armed = false; }, 2000);
  }
  window.addEventListener("popstate", naSpat);

  try {
    history.replaceState({ dpb: "base" }, "");
    history.pushState({ dpb: "root" }, "");
  } catch (e) {}
})();
