/* Nechať obrazovku zapnutú (Screen Wake Lock). Funguje len na HTTPS a len kým je appka na očiach. */
(function () {
  var KLUC = "dpb-obrazovka-zapnuta", zamok = null;
  function zapnute() { try { return localStorage.getItem(KLUC) === "1"; } catch (e) { return false; } }
  function uloz(v) { try { localStorage.setItem(KLUC, v ? "1" : "0"); } catch (e) {} }
  function podporene() { return !!(navigator.wakeLock && navigator.wakeLock.request); }
  function pusti() { if (zamok) { try { zamok.release(); } catch (e) {} zamok = null; } }
  function zamkni() {
    if (!podporene() || !zapnute() || document.visibilityState !== "visible" || zamok) return;
    navigator.wakeLock.request("screen").then(function (l) {
      zamok = l; l.addEventListener("release", function () { zamok = null; });
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") zamkni(); });
  document.addEventListener("DOMContentLoaded", function () {
    var cb = document.getElementById("profilObrazovka"), pozn = document.getElementById("profilObrazovkaPozn");
    if (cb) {
      if (!podporene()) { cb.disabled = true; if (pozn) pozn.textContent = "Tento prehliadač to nepodporuje (alebo chýba HTTPS)."; }
      cb.checked = zapnute() && podporene();
      cb.addEventListener("change", function () { uloz(cb.checked); if (cb.checked) zamkni(); else pusti(); });
    }
    zamkni();
  });
  // prvé dotknutie pre prípad, že prehliadač povolí zámok až po geste
  document.addEventListener("click", zamkni, { passive: true });
})();
