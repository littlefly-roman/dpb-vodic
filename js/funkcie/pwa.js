/* PWA: registrácia service workera, príprava dát na offline a oznam o novej verzii.
   Service worker funguje len cez HTTPS alebo localhost (na obyčajnom http://IP-adrese sa preskočí). */
(function () {
  if (!("serviceWorker" in navigator)) return;

  function lista(text, tlacidlo, akcia) {
    if (document.getElementById("pwaLista")) return;
    var d = document.createElement("div");
    d.id = "pwaLista";
    d.setAttribute("role", "status");
    d.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--red);color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3)";
    var t = document.createElement("span");
    t.style.flex = "1";
    t.textContent = text;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = tlacidlo;
    b.style.cssText = "border:0;border-radius:8px;padding:8px 12px;font-weight:700;background:#fff;color:#e8001a;cursor:pointer";
    b.addEventListener("click", akcia);
    d.appendChild(t);
    d.appendChild(b);
    document.body.appendChild(d);
  }

  function priecinkyNaStiahnutie() {
    var vsetky = (window._dataFolders && window._dataFolders()) || [];
    if (!vsetky.length || !window.Calendar) return [];
    var d = new Date(),
      key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var dnes = window.Calendar.findDataFolder(key, vsetky);
    if (!dnes) return [];
    // aktuálny priečinok a všetky novšie (budúce platnosti)
    return vsetky.filter(function (f) { return f >= dnes; });
  }

  var pripravene = false;
  function stiahniOffline(sw) {
    var f = priecinkyNaStiahnutie();
    if (!f.length) return;
    var c = navigator.connection;
    if (c && c.saveData) return; // úsporný režim dát
    sw.postMessage({ type: "PREFETCH", folders: f });
  }

  navigator.serviceWorker.addEventListener("message", function (e) {
    var m = e.data || {};
    if (m.type === "DONE" && m.stiahnute > 0 && !m.chyby && !pripravene) {
      pripravene = true;
      if (window._showToast) window._showToast("Offline pripravené");
    }
  });

  var obnovuje = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (obnovuje) return;
    obnovuje = true;
    location.reload();
  });

  function sledujNovu(reg) {
    function ponukni(w) {
      lista("Je nová verzia appky", "Obnoviť", function () { w.postMessage({ type: "SKIP_WAITING" }); });
    }
    if (reg.waiting && navigator.serviceWorker.controller) ponukni(reg.waiting);
    reg.addEventListener("updatefound", function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", function () {
        if (w.state === "installed" && navigator.serviceWorker.controller) ponukni(w);
      });
    });
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then(function (reg) {
        sledujNovu(reg);
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        navigator.serviceWorker.ready.then(function (r) {
          var spusti = function () { if (r.active) stiahniOffline(r.active); };
          if (window.requestIdleCallback) requestIdleCallback(spusti, { timeout: 8000 });
          else setTimeout(spusti, 4000);
        });
      })
      .catch(function () {});
  });
})();
