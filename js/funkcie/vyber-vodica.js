/* Hľadanie vodiča pri prihlásení: pole nad zoznamom, píšeš časť mena alebo osobné číslo.
   Zoznam (select) ostáva ako doteraz; výber z hľadania len nastaví ten istý select. */
(function () {
  function bezDia(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }
  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("loginDriverSel");
    var wrap = sel && sel.parentNode;
    var login = document.getElementById("loginScreen");
    if (!sel || !wrap) return;

    var box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:340px;margin-bottom:-6px";
    var inp = document.createElement("input");
    inp.type = "search";
    inp.id = "loginDriverSearch";
    inp.placeholder = "Hľadaj vodiča (meno alebo číslo)";
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("autocapitalize", "off");
    inp.setAttribute("spellcheck", "false");
    inp.setAttribute("aria-label", "Hľadať vodiča");
    inp.style.cssText =
      "width:100%;box-sizing:border-box;padding:14px 16px;font-size:16px;font-weight:600;background:var(--surface);color:var(--text-1);border:1px solid var(--border);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.07);outline:none";
    var list = document.createElement("div");
    list.setAttribute("role", "listbox");
    list.style.cssText =
      "display:none;margin-top:6px;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.12)";
    box.appendChild(inp);
    box.appendChild(list);
    wrap.parentNode.insertBefore(box, wrap);

    var najdene = [];
    function zatvor() {
      list.style.display = "none";
      list.innerHTML = "";
      najdene = [];
    }
    function vyber(o) {
      sel.value = o.value;
      sel.dispatchEvent(new Event("change"));
      inp.value = o.textContent;
      zatvor();
      inp.blur();
    }
    function hladaj() {
      var q = bezDia(inp.value).trim();
      if (!q) return zatvor();
      var casti = q.split(/\s+/);
      najdene = [];
      for (var i = 0; i < sel.options.length; i++) {
        var o = sel.options[i];
        if (!o.value) continue;
        var t = bezDia(o.textContent) + " " + bezDia(o.value);
        if (casti.every(function (c) { return t.indexOf(c) >= 0; })) najdene.push(o);
      }
      list.innerHTML = "";
      if (!najdene.length) {
        var n = document.createElement("div");
        n.textContent = "Nikto taký";
        n.style.cssText = "padding:12px 16px;font-size:14px;color:var(--text-3)";
        list.appendChild(n);
      } else {
        najdene.slice(0, 8).forEach(function (o) {
          var r = document.createElement("div");
          r.setAttribute("role", "option");
          r.style.cssText =
            "padding:12px 16px;font-size:16px;font-weight:600;color:var(--text-1);cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px";
          var m = document.createElement("span");
          m.textContent = o.textContent;
          var c = document.createElement("span");
          c.textContent = o.value;
          c.style.cssText = "font-weight:500;font-size:13px;color:var(--text-3)";
          r.appendChild(m);
          r.appendChild(c);
          r.addEventListener("click", function () { vyber(o); });
          list.appendChild(r);
        });
        if (najdene.length > 8) {
          var d = document.createElement("div");
          d.textContent = "…a ďalších " + (najdene.length - 8) + ", spresni hľadanie";
          d.style.cssText = "padding:10px 16px;font-size:13px;color:var(--text-3)";
          list.appendChild(d);
        }
      }
      list.style.display = "block";
    }
    inp.addEventListener("input", hladaj);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && najdene.length) {
        e.preventDefault();
        vyber(najdene[0]);
      }
    });
    // keď zoznam zmení výber alebo sa obrazovka znova otvorí, pole sa vyčistí
    sel.addEventListener("change", function () {
      if (!sel.value) { inp.value = ""; zatvor(); }
    });
    if (login && window.MutationObserver)
      new MutationObserver(function () {
        if (!login.classList.contains("hidden")) { inp.value = ""; zatvor(); }
      }).observe(login, { attributes: true, attributeFilter: ["class"] });
  });
})();
