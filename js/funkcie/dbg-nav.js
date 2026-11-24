/* DOČASNÉ: diagnostika spodného menu, zobrazí sa len v Android obale (window.Capacitor) */
(function () {
  if (!window.Capacitor) return;
  function ukaz() {
    try {
      var n = document.querySelector(".bottom-nav"); if (!n) return;
      var r = n.getBoundingClientRect(), b = n.querySelector("button"), br = b ? b.getBoundingClientRect() : null;
      var pr = document.createElement("div"); pr.style.cssText = "position:fixed;left:6px;right:6px;top:56px;z-index:99999;background:#000;color:#0f0;font:11px monospace;padding:4px;white-space:pre-wrap";
      var e = document.createElement("div"); e.style.cssText = "position:fixed;bottom:env(safe-area-inset-bottom,0px);height:0;width:0";
      document.body.appendChild(e);
      pr.textContent = "innerH=" + innerHeight + " visH=" + (window.visualViewport ? Math.round(visualViewport.height) : "-") + " docH=" + document.documentElement.scrollHeight + " scrollY=" + scrollY +
        "\nnav top=" + Math.round(r.top) + " h=" + Math.round(r.height) + " bottom=" + Math.round(r.bottom) +
        "\nbtn top=" + (br ? Math.round(br.top) : "-") + " h=" + (br ? Math.round(br.height) : "-") +
        "\nenvBottom=" + Math.round(innerHeight - e.getBoundingClientRect().top) + " dpr=" + devicePixelRatio + " rootFont=" + getComputedStyle(document.documentElement).fontSize + "\nbodyH=" + document.body.getBoundingClientRect().height + " bodyTop=" + Math.round(document.body.getBoundingClientRect().top);
      document.body.appendChild(pr); pr.addEventListener("click", function () { pr.remove(); });
    } catch (x) {}
  }
  setTimeout(ukaz, 2500);
})();
