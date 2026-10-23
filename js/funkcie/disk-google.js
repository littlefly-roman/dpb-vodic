/* Automatické načítanie najnovšieho exportu z Disku Google (po jednorazovom prihlásení cez Google).
   Súbor sa hľadá podľa názvu; stiahne sa len keď je novší než naposledy načítaný. */
(function () {
  var CFG = window.DPB_GOOGLE || {};
  var K_LINK = "dpb-disk-pripojeny", K_MT = "dpb-disk-mt", K_KONTROLA = "dpb-disk-kontrola";
  var K_TOK = "dpb-disk-tok", popupUz = false, token = null, tokenDo = 0, klient = null, gsiP = null, caka = null, bezi = false, poslednyPokus = 0;

  function el(id) { return document.getElementById(id); }
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function nastavene() { return !!(CFG.clientId && CFG.clientId.length > 10); }
  function pripojene() { return ls(K_LINK) === "1"; }
  function toast(t, ms) { if (window._showToast) window._showToast(t, ms); }
  function pred(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "práve teraz";
    if (m < 60) return "pred " + m + " min";
    if (m < 1440) return "pred " + Math.round(m / 60) + " hod";
    return "pred " + Math.round(m / 1440) + " dň";
  }

  (function () {
    try {
      var t = JSON.parse(ls(K_TOK) || "null");
      if (t && t.t && t.do > Date.now() + 120000) { token = t.t; tokenDo = t.do; }
    } catch (e) {}
  })();
  function platnyToken() { return !!(token && Date.now() < tokenDo - 60000); }

  function gsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!gsiP) gsiP = new Promise(function (ok, zle) {
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = ok;
      s.onerror = function () { gsiP = null; s.remove(); zle(new Error("Bez pripojenia")); };
      document.head.appendChild(s);
    });
    return gsiP;
  }
  // tichá požiadavka (prompt "") funguje, ak už raz prebehlo povolenie a Chrome dovolí okno
  function dajToken(prvy) {
    if (token && Date.now() < tokenDo - 60000) return Promise.resolve(token);
    return gsi().then(function () {
      return new Promise(function (ok, zle) {
        caka = { ok: ok, zle: zle };
        if (!klient) klient = google.accounts.oauth2.initTokenClient({
          client_id: CFG.clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly",
          callback: function (r) {
            var c = caka; caka = null;
            if (!c) return;
            if (r && r.access_token) { token = r.access_token; tokenDo = Date.now() + (r.expires_in || 3600) * 1000; ls(K_TOK, JSON.stringify({ t: token, do: tokenDo })); c.ok(token); }
            else c.zle(new Error((r && r.error) || "Prihlásenie zlyhalo"));
          },
          error_callback: function (e) {
            var c = caka; caka = null;
            if (c) c.zle(new Error((e && e.type) || "Prihlásenie zlyhalo"));
          },
        });
        klient.requestAccessToken(prvy ? {} : { prompt: "" });
      });
    });
  }
  function api(url, ako) {
    return fetch(url, { headers: { Authorization: "Bearer " + token } }).then(function (r) {
      if (r.status === 401) { token = null; ls(K_TOK, null); throw new Error("Prihlásenie vypršalo"); }
      if (!r.ok) throw new Error("Disk Google: chyba " + r.status);
      return ako === "blob" ? r.blob() : r.json();
    });
  }
  function najdi() {
    var q = "name='" + CFG.nazovSuboru + "' and trashed=false";
    return api("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&orderBy=modifiedTime%20desc&pageSize=5&fields=files(id,name,modifiedTime,size)").then(function (j) {
      return (j.files || [])[0] || null;
    });
  }

  function stav(t) { var e = el("profilDiskStav"); if (e) e.textContent = t; }
  function obnovStav() {
    if (!nastavene()) return;
    var k = parseInt(ls(K_KONTROLA) || "0", 10), b = el("profilDiskBtn");
    stav(pripojene() ? (k ? "Pripojené · kontrola " + pred(k) : "Pripojené") : "Nepripojené");
    if (b) b.textContent = pripojene() ? "Skontrolovať Disk teraz" : "Pripojiť Disk Google";
  }

  // hlavná funkcia: prvy = prvé pripojenie (okno s povolením); ticho = bez hlášok, ak sa nič nenašlo
  function skontroluj(prvy, ticho, start) {
    if (!nastavene() || bezi) return Promise.resolve(false);
    bezi = true; poslednyPokus = Date.now();
    var b = el("profilDiskBtn"); if (b) { b.disabled = true; }
    stav("Kontrolujem…");
    return dajToken(!!prvy).then(function () {
      ls(K_LINK, "1");
      return najdi();
    }).then(function (f) {
      ls(K_KONTROLA, String(Date.now()));
      if (!f) { if (!ticho) toast("Súbor " + CFG.nazovSuboru + " som na Disku nenašiel", 4000); return false; }
      if (ls(K_MT) === f.modifiedTime) { if (!ticho) toast("Dáta sú aktuálne"); return false; }
      stav("Sťahujem…");
      return api("https://www.googleapis.com/drive/v3/files/" + f.id + "?alt=media", "blob").then(function (blob) {
        var file = new File([blob], f.name, { type: "text/csv" });
        if (start) {
          var inp = el("importCsvInput"), dt = new DataTransfer();
          dt.items.add(file); inp.files = dt.files;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return window._nacitajNoveData(file);
      }).then(function () {
        ls(K_MT, f.modifiedTime);
        toast("Nové dáta z Disku načítané");
        if (window.Profil && Profil.obnovInfo) Profil.obnovInfo();
        return true;
      });
    }).catch(function (e) {
      if (!ticho || (e && /Prihlásenie vypršalo/.test(e.message))) toast("Disk Google: " + (e && e.message ? e.message : "chyba"), 4000);
      return false;
    }).then(function (r) {
      bezi = false;
      if (b) b.disabled = false;
      obnovStav();
      return r;
    });
  }

  // automaticky: pri prvom dotyku po otvorení appky a potom keď sa appka vráti do popredia (najviac raz za 10 min)
  function auto() {
    if (!nastavene() || !pripojene() || bezi) return;
    var ls_ = el("loginScreen"); if (!ls_ || !ls_.classList.contains("hidden")) return;
    if (Date.now() - poslednyPokus < 10 * 60000) return;
    if (!platnyToken()) {
      if (popupUz) return;
      popupUz = true;
    }
    skontroluj(false, true);
  }
  document.addEventListener("click", auto, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && platnyToken()) { poslednyPokus = Math.min(poslednyPokus, Date.now() - 10 * 60000); setTimeout(auto, 300); }
  });

  document.addEventListener("DOMContentLoaded", function () {
    var sb = el("importDiskBtn");
    if (sb && nastavene()) {
      sb.classList.remove("hidden");
      sb.addEventListener("click", function () {
        var pr = el("importProgress");
        if (pr) pr.textContent = "Pripájam Disk Google…";
        skontroluj(true, false, true).then(function (ok) {
          if (!ok && pr && /Pripájam/.test(pr.textContent)) pr.textContent = "Nepodarilo sa načítať z Disku. Skús Nahrať CSV.";
        });
      });
    }
    var karta = el("profilDiskKarta");
    if (!karta) return;
    if (!nastavene()) { karta.classList.add("hidden"); var bt = el("profilDiskBtn"); if (bt) bt.classList.add("hidden"); return; }
    var b = el("profilDiskBtn");
    if (b) b.addEventListener("click", function () { skontroluj(!pripojene(), false); });
    obnovStav();
  });
  window.DpbDisk = { skontroluj: skontroluj, auto: auto, obnovStav: obnovStav };
})();
