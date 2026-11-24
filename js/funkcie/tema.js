// Vzhľad: svetlý / tmavý / podľa telefónu / podľa času (z denného na nočný a z nočného na denný).
// Ikona slnka/mesiaca: ťuknutie = rýchle prepnutie, dlhé podržanie = okno s nastavením (rovnaké okno je aj v Profile).
(function () {
  var root = document.documentElement;
  var btn = document.getElementById("themeBtn");
  if (!btn) return;
  var KL = "dpb_theme_mode";
  var NAST = { m: "", t: "18:00", s: "06:00", over: null }; // m: svetly|tmavy|system|cas ("" = podľa poslednej voľby); over: {th, do}
  try { var u = JSON.parse(localStorage.getItem(KL) || "null"); if (u) Object.keys(NAST).forEach(function (k) { if (u[k] !== undefined) NAST[k] = u[k]; }); } catch (e) {}
  function uloz() { try { localStorage.setItem(KL, JSON.stringify(NAST)); } catch (e) {} }

  function systemTmavy() { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  function current() {
    var t = root.getAttribute("data-theme");
    return t ? t : systemTmavy() ? "dark" : "light";
  }
  function meta(t) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.content = t === "dark" ? "#17181d" : "#ffffff";
  }
  function nastav(th) {
    if (root.getAttribute("data-theme") !== th) root.setAttribute("data-theme", th);
    meta(th);
    try { localStorage.setItem("dpb_theme", th); } catch (e) {} // aby sa pri ďalšom štarte neblikalo
  }
  function min(hm) { var p = String(hm || "").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  // je teraz „noc" podľa nastavených časov (tmavý od t do s; môže prechádzať cez polnoc)
  function jeNoc(d) {
    var n = d.getHours() * 60 + d.getMinutes(), a = min(NAST.t), b = min(NAST.s);
    if (a === b) return false;
    return a < b ? n >= a && n < b : n >= a || n < b;
  }
  // najbližšie nastavené prepnutie po okamihu d (ms)
  function dalsiPrepnutie(d) {
    var best = Infinity;
    [NAST.t, NAST.s].forEach(function (hm) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min(hm), 0, 0);
      if (x.getTime() <= d.getTime()) x = new Date(x.getTime() + 86400000);
      if (x.getTime() < best) best = x.getTime();
    });
    return best;
  }
  function pouzi() {
    var th;
    if (NAST.m === "svetly") th = "light";
    else if (NAST.m === "tmavy") th = "dark";
    else if (NAST.m === "system") th = systemTmavy() ? "dark" : "light";
    else if (NAST.m === "cas") {
      var now = new Date();
      if (NAST.over && NAST.over.do > now.getTime()) th = NAST.over.th;
      else { if (NAST.over) { NAST.over = null; uloz(); } th = jeNoc(now) ? "dark" : "light"; }
    } else return; // bez nastavenia: ostáva posledná ručná voľba / systém
    nastav(th);
  }

  // počiatočný stav
  if (NAST.m) pouzi(); else nastav(current());
  setInterval(function () { if (NAST.m === "cas" || NAST.m === "system") pouzi(); }, 20000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") pouzi(); });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var oz = function () { if (NAST.m === "system") pouzi(); };
    if (mq.addEventListener) mq.addEventListener("change", oz); else if (mq.addListener) mq.addListener(oz);
  }

  // rýchle prepnutie ikonou
  function prepni() {
    var next = current() === "dark" ? "light" : "dark";
    if (NAST.m === "cas") NAST.over = { th: next, do: dalsiPrepnutie(new Date()) }; // platí do najbližšieho nastaveného času
    else { NAST.m = next === "dark" ? "tmavy" : "svetly"; NAST.over = null; }
    uloz(); nastav(next);
  }

  // ── okno nastavení ──
  var ov = null;
  function zavri() { if (ov) { ov.remove(); ov = null; } }
  function otvor() {
    zavri();
    ov = document.createElement("div");
    ov.setAttribute("data-spat-prekryv", "1");
    ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box";
    var box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:400px;background:var(--surface);color:var(--text-1);border-radius:20px;padding:18px 16px 16px;box-sizing:border-box";
    var MES = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var SLN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var VOLBY = [["svetly", "Svetlý"], ["tmavy", "Tmavý"], ["system", "Podľa telefónu"], ["cas", "Podľa času"]];
    function vykresli() {
      var m = NAST.m || (current() === "dark" ? "tmavy" : "svetly");
      var h = '<div style="font-size:1.0625rem;font-weight:700;margin-bottom:12px">Vzhľad</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      VOLBY.forEach(function (v) {
        var on = m === v[0];
        h += '<button type="button" data-m="' + v[0] + '" style="height:43px;border-radius:14px;font:inherit;font-size:.9375rem;border:1px solid ' + (on ? "var(--red)" : "var(--border-2)") + ";background:" + (on ? "var(--red)" : "var(--surface)") + ";color:" + (on ? "#fff" : "var(--text-1)") + '">' + v[1] + "</button>";
      });
      h += "</div>";
      if (m === "cas") {
        var riadok = function (l, ic, k) {
          return '<label style="display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 14px;border:1px solid var(--border-2);border-radius:16px;margin-top:8px"><span style="display:flex;gap:10px;align-items:center">' + ic + l +
            '</span><input type="time" data-k="' + k + '" value="' + NAST[k] + '" style="font:inherit;font-size:1.375rem;font-weight:700;border:0;background:transparent;color:var(--text-1);text-align:right;width:6.5em"></label>';
        };
        h += riadok("Tmavý od", MES, "t") + riadok("Svetlý od", SLN, "s") +
          '<div style="font-size:.8125rem;color:var(--text-3);margin:10px 2px 0">Ručné prepnutie ikonou platí do najbližšieho nastaveného času.</div>';
      }
      h += '<button type="button" data-zat="1" style="width:100%;height:43px;margin-top:14px;border-radius:14px;font:inherit;font-size:.9375rem;border:1px solid var(--border-2);background:var(--surface);color:var(--text-1)">Zavrieť</button>';
      box.innerHTML = h;
      box.querySelectorAll("[data-m]").forEach(function (b) {
        b.addEventListener("click", function () { NAST.m = b.getAttribute("data-m"); NAST.over = null; uloz(); pouzi(); vykresli(); });
      });
      box.querySelectorAll("input[type=time]").forEach(function (i) {
        i.addEventListener("change", function () { if (i.value) { NAST[i.getAttribute("data-k")] = i.value; NAST.over = null; uloz(); pouzi(); } });
      });
      box.querySelector("[data-zat]").addEventListener("click", zavri);
    }
    vykresli();
    ov.appendChild(box);
    ov.addEventListener("click", function (e) { if (e.target === ov) zavri(); });
    document.body.appendChild(ov);
  }
  window.DpbTema = { otvor: otvor };
  btn.classList.add("podrz"); // značka: dá sa podržať

  // ťuknutie = prepnutie, dlhé podržanie = okno
  var tm = null, dlhe = false, x0 = 0, y0 = 0;
  btn.addEventListener("pointerdown", function (e) {
    dlhe = false; x0 = e.clientX; y0 = e.clientY;
    clearTimeout(tm);
    tm = setTimeout(function () { tm = null; dlhe = true; try { if (navigator.vibrate) navigator.vibrate(30); } catch (er) {} otvor(); }, 550);
  });
  btn.addEventListener("pointermove", function (e) { if (tm && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) { clearTimeout(tm); tm = null; } });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { btn.addEventListener(n, function () { if (tm) { clearTimeout(tm); tm = null; } }); });
  btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  btn.addEventListener("click", function (e) {
    if (dlhe) { dlhe = false; e.preventDefault(); e.stopPropagation(); return; }
    prepni();
  });
})();
