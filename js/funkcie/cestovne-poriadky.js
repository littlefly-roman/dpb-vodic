
      (function () {
        var modal = document.getElementById("cpModal");
        var closeBtn = document.getElementById("cpClose");
        var kurzInput = document.getElementById("cpKurzInput");
        var kurzGo = document.getElementById("cpKurzGo");
        var kurzError = document.getElementById("cpKurzError");
        var sluzPanel = document.getElementById("cpSluzobnyPanel");
        var zastPanel = document.getElementById("cpZastavkovyPanel");

        ["cpBtnZastavkovyRoz", "cpBtnSluzobny"].forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          el.addEventListener("click", function () {
            document.querySelectorAll(".cp-type-btn").forEach(function (b) {
              b.classList.remove("cp-type-active");
            });
            this.classList.add("cp-type-active");
            sluzPanel.style.display = id === "cpBtnSluzobny" ? "" : "none";
            zastPanel.style.display = id === "cpBtnZastavkovyRoz" ? "" : "none";
            if (id === "cpBtnZastavkovyRoz")
              setTimeout(function () {
                var el = document.getElementById("cpStanicaInput");
                if (el) el.focus();
              }, 100);
          });
        });

        if (closeBtn)
          closeBtn.addEventListener("click", function () {
            modal.classList.remove("active");
            if (kurzInput) kurzInput.value = "";
            if (kurzError) kurzError.style.display = "none";
            if (window._cpSluzobnyVyber) window._cpSluzobnyVyber();
          });

        function doGo() {
          var raw = (kurzInput.value || "").trim(),
            kurzStr = null,
            typ = null;
          // LLLKKT, LLKKT alebo LKKT: posledná číslica = typ dňa, pred ňou 2 číslice kurz,
          // zvyšok (1 až 3 číslice) je linka.
          if (/^\d{4,6}$/.test(raw)) {
            kurzStr =
              parseInt(raw.slice(0, -3)) +
              "/" +
              parseInt(raw.slice(-3, -1));
            typ = parseInt(raw.slice(-1));
          } else if (/^\d+\/\d+$/.test(raw)) {
            kurzStr = raw;
          }
          if (!kurzStr) {
            if (kurzError) kurzError.style.display = "";
            return;
          }
          if (kurzError) kurzError.style.display = "none";
          modal.classList.remove("active");
          var strTime = "";
          try {
            if (window.RAW && typ) {
              var seen = {};
              Object.keys(window.RAW.models).forEach(function (rid) {
                (window.RAW.models[rid] || []).forEach(function (d) {
                  var dTyp = window.Calendar
                    ? window.Calendar.getDayType(d.datum)
                    : 1;
                  if (dTyp !== typ) return;
                  d.karty.forEach(function (k) {
                    if (
                      k.vzor !== "SLUŽBA" ||
                      k.kurz !== kurzStr ||
                      !k["prestávka"]
                    )
                      return;
                    k["prestávka"].forEach(function (p) {
                      var pm =
                        parseInt((p.prebera || "").split(":")[0]) * 60 +
                        parseInt((p.prebera || "").split(":")[1] || 0);
                      if (pm >= (k.od_min || 0) && pm <= (k.do_min || 1440)) {
                        var key = p.prebera + "-" + p.odovzdava;
                        if (!seen[key]) {
                          seen[key] = 1;
                          strTime +=
                            (strTime ? "|" : "") +
                            p.prebera +
                            " \u2013 " +
                            p.odovzdava;
                        }
                      }
                    });
                  });
                });
              });
            }
          } catch (e) {}
          window._grafikonSpatCp = true;
          window.openGrafikonKurz &&
            window.openGrafikonKurz(
              kurzStr,
              null,
              null,
              null,
              strTime || null,
              null,
              typ,
              true,
            );
        }
        if (kurzGo) kurzGo.addEventListener("click", doGo);

        // ---- Výber kurzu tlačidlami: typ dňa -> linka -> kurz (zoznam kurzov z OBEH/_zoznam.txt) ----
        (function () {
          var btn = document.getElementById("cpBtnSluzobny");
          if (!btn || !sluzPanel) return;
          var TYPY = { 1: "Pracovný deň", 2: "Sobota", 3: "Nedeľa / sviatok", 4: "Pracovný deň (prázdniny)" };
          var box = null, zoznam = null, vyber = { typ: null, linka: null };
          function css(e, t) { e.style.cssText = t; return e; }
          function mk(tag, t, text) { var e = document.createElement(tag); if (t) e.style.cssText = t; if (text != null) e.textContent = text; return e; }
          function hm(m) { m = m % 1440; return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
          function dnes() {
            var d = new Date();
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          }
          async function nacitaj() {
            if (zoznam) return zoznam;
            try {
              var P = window.GrafikonParsery, C = window.Calendar;
              var folder = C && C.findDataFolder(dnes(), window._dataFolders ? window._dataFolders() : []);
              if (!folder || !P) return null;
              var txt = await P.loadText("data/" + folder + "/OBEH/_zoznam.txt", true);
              if (!txt) return null;
              zoznam = txt.split("\n").filter(Boolean).map(function (r) {
                var f = r.split("\t");
                return { kod: f[0], linka: parseInt(f[0].slice(0, 3), 10), kurz: parseInt(f[0].slice(3, 5), 10), typ: +f[0].slice(5), od: +f[1], do: +f[2] };
              });
            } catch (e) { zoznam = null; }
            return zoznam;
          }
          function chip(text, on, klik, extra) {
            var c = mk("button", "padding:7px 11px;border-radius:16px;border:1px solid var(--border);font-size:14px;cursor:pointer;" +
              (on ? "background:var(--red);color:#fff" : "background:var(--surface-2);color:var(--text-1)") + (extra || ""), text);
            c.type = "button";
            c.addEventListener("click", klik);
            return c;
          }
          function nadpis(t) { return mk("div", "font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--text-3);margin:14px 0 6px", t); }
          function vykresli() {
            if (!box || !zoznam) return;
            box.innerHTML = "";
            var typy = [];
            zoznam.forEach(function (z) { if (typy.indexOf(z.typ) < 0) typy.push(z.typ); });
            typy.sort();
            if (vyber.typ == null) {
              var t0 = window.Calendar ? window.Calendar.getDayType(new Date()) : 1;
              vyber.typ = typy.indexOf(t0) >= 0 ? t0 : typy[0];
            }
            box.appendChild(nadpis("TYP DŇA"));
            var rt = mk("div", "display:flex;flex-wrap:wrap;gap:6px");
            typy.forEach(function (t) {
              rt.appendChild(chip(TYPY[t] || "Typ " + t, t === vyber.typ, function () { vyber.typ = t; vyber.linka = null; vykresli(); }));
            });
            box.appendChild(rt);
            var linky = [];
            zoznam.forEach(function (z) { if (z.typ === vyber.typ && linky.indexOf(z.linka) < 0) linky.push(z.linka); });
            linky.sort(function (a, b) { return a - b; });
            box.appendChild(nadpis("LINKA"));
            var rl = mk("div", "display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow-y:auto");
            linky.forEach(function (l) {
              rl.appendChild(chip(String(l), l === vyber.linka, function () { vyber.linka = l; vykresli(); }, ";min-width:44px"));
            });
            box.appendChild(rl);
            if (vyber.linka != null) {
              box.appendChild(nadpis("KURZ"));
              var rk = mk("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px");
              zoznam.filter(function (z) { return z.typ === vyber.typ && z.linka === vyber.linka; })
                .sort(function (a, b) { return a.kurz - b.kurz; })
                .forEach(function (z) {
                  var b = mk("button", "padding:7px 4px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);cursor:pointer;text-align:center");
                  b.type = "button";
                  b.appendChild(mk("div", "font-size:15px;font-weight:700", vyber.linka + "/" + z.kurz));
                  b.appendChild(mk("div", "font-size:11px;color:var(--text-3)", hm(z.od) + "–" + hm(z.do)));
                  b.addEventListener("click", function () {
                    kurzInput.value = z.kod;
                    if (kurzGo) kurzGo.click();
                  });
                  rk.appendChild(b);
                });
              box.appendChild(rk);
            }
          }
          async function otvor() {
            if (!box) { box = mk("div", ""); sluzPanel.appendChild(box); }
            await nacitaj();
            vykresli();
          }
          btn.addEventListener("click", otvor);
          window._cpSluzobnyVyber = function () { vyber.linka = null; vyber.typ = null; if (box) vykresli(); };
        })();
        if (kurzInput)
          kurzInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doGo();
          });
      })();
    