// Pás „Sú dostupné voľné služby“ je pripnutý nad spodným menu; rolovať sa dá len kartu nad ním.
// Tlačidlo vzniká v hlavnom vykresľovaní dňa (#servicesContainer > .burza-link-row); tu ho len premiestnime.
(function () {
  function init() {
    var host = document.getElementById("burzaPas"), cont = document.getElementById("servicesContainer");
    if (!host || !cont) return;
    function presun() {
      var r = cont.querySelector(":scope > .burza-link-row");
      if (r) {
        host.innerHTML = "";
        host.appendChild(r);
        host.classList.remove("hidden");
      } else {
        host.innerHTML = "";
        host.classList.add("hidden");
      }
    }
    var mo = new MutationObserver(function () { presun(); mo.takeRecords(); }); // vlastné premiestnenie nevyvolá ďalší cyklus
    mo.observe(cont, { childList: true });
    presun();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
