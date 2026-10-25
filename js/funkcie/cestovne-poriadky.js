
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

        // ---- Výber kurzu kolieskami: Linka | Poradie | Typ dňa (zoznam kurzov z OBEH/_zoznam.txt) ----
        (function () {
          var btn = document.getElementById("cpBtnSluzobny");
          if (!btn || !sluzPanel) return;
          var TYPY = { 1: "Pracovný deň", 2: "Sobota", 3: "Nedeľa", 4: "Prázdniny" };
          var H = 44, RIADKY = 5;
          var box = null, zoznam = null, kolesa = null, info = null, otvorBtn = null;
          var vyber = { typ: null, trak: null, linka: null, kurz: null };
          // Trakcia podľa čísla linky: električky 1, 3, 4, 9; trolejbusy zatiaľ nie sú zadané (doplniť); ostatné autobusy
          var ELEKTRICKY = [1, 3, 4, 9], TROLEJBUSY = [];
          var TRAK_NAZOV = { trolejbus: "Trolejbus", elektricka: "Električka", autobus: "Autobus" };
          function trakcia(l) { return ELEKTRICKY.indexOf(l) >= 0 ? "elektricka" : TROLEJBUSY.indexOf(l) >= 0 ? "trolejbus" : "autobus"; }
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
          // Jedno koleso: items = [text], onChange(index) po zastavení posúvania
          function koleso(nadpis, sirka, onChange, cervene) {
            var w = mk("div", "flex:" + sirka + ";min-width:0");
            w.appendChild(mk("div", "text-align:center;font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--text-3);margin-bottom:4px", nadpis));
            var okno = mk("div", "position:relative;height:" + RIADKY * H + "px;border-radius:12px;background:" + (cervene ? "var(--red)" : "var(--surface-2)") + ";overflow:hidden");
            var pas = mk("div", "position:absolute;left:4px;right:4px;top:" + (2 * H) + "px;height:" + H + "px;border-radius:10px;background:" + (cervene ? "rgba(255,255,255,.22)" : "rgba(220,40,40,.14)") + ";border:1px solid " + (cervene ? "#fff" : "var(--red)") + ";pointer-events:none");
            var sc = mk("div", "position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory;scroll-padding:" + (2 * H) + "px 0;padding:" + (2 * H) + "px 0;box-sizing:border-box;scrollbar-width:none;-webkit-overflow-scrolling:touch");
            okno.appendChild(pas); okno.appendChild(sc); w.appendChild(okno);
            var st = { items: [], idx: 0, potlac: false, t: null, riadky: [] };
            function styl() {
              var p = sc.scrollTop / H;
              st.riadky.forEach(function (r, i) {
                var d = Math.abs(p - i);
                r.style.opacity = Math.max(0.25, 1 - d * 0.3);
                r.style.fontWeight = d < 0.5 ? "700" : "500";
              });
            }
            sc.addEventListener("scroll", function () {
              styl();
              clearTimeout(st.t);
              st.t = setTimeout(function () {
                var i = Math.max(0, Math.min(st.items.length - 1, Math.round(sc.scrollTop / H)));
                if (i !== st.idx) { st.idx = i; if (!st.potlac) onChange(i); }
                st.potlac = false;
              }, 110);
            });
            return {
              el: w,
              idx: function () { return st.idx; },
              nastav: function (items, idx) {
                st.items = items; st.idx = idx; st.riadky = [];
                sc.innerHTML = "";
                items.forEach(function (t, i) {
                  var r = mk("div", "height:" + H + "px;display:flex;align-items:center;justify-content:center;scroll-snap-align:start;font-size:17px;color:var(--text-1);cursor:pointer;white-space:nowrap");
                  if (t && typeof t === "object") {
                    var ik = mk("span", "display:inline-block;width:34px;height:26px;flex:none;background:currentColor;-webkit-mask:url(img/doprava/" + t.ikona + ".png) center/contain no-repeat;mask:url(img/doprava/" + t.ikona + ".png) center/contain no-repeat");
                    ik.setAttribute("role", "img"); ik.setAttribute("aria-label", t.alt || "");
                    var cs = mk("span", "display:inline-block;width:3ch;text-align:right;margin-left:14px;font-variant-numeric:tabular-nums", t.text);
                    r.appendChild(ik); r.appendChild(cs);
                  } else r.textContent = t;
                  r.addEventListener("click", function () { sc.scrollTo({ top: i * H, behavior: "smooth" }); });
                  sc.appendChild(r); st.riadky.push(r);
                });
                st.potlac = true;
                sc.scrollTop = idx * H;
                styl();
                setTimeout(function () { st.potlac = false; }, 200);
              },
            };
          }
          function typy() {
            var t = [];
            zoznam.forEach(function (z) { if (t.indexOf(z.typ) < 0) t.push(z.typ); });
            return t.sort();
          }
          var TRAK_PORADIE = ["elektricka", "trolejbus", "autobus"];
          function linky() {
            var l = [];
            zoznam.forEach(function (z) { if (z.typ === vyber.typ && l.indexOf(z.linka) < 0) l.push(z.linka); });
            return l.sort(function (a, b) {
              var d = TRAK_PORADIE.indexOf(trakcia(a)) - TRAK_PORADIE.indexOf(trakcia(b));
              return d || a - b;
            });
          }
          function kurzy() {
            return zoznam.filter(function (z) { return z.typ === vyber.typ && z.linka === vyber.linka; })
              .sort(function (a, b) { return a.kurz - b.kurz; });
          }
          function obnovInfo() {
            var z = zoznam.filter(function (q) { return q.typ === vyber.typ && q.linka === vyber.linka && q.kurz === vyber.kurz; })[0];
            if (!z) { info.textContent = ""; otvorBtn.disabled = true; return; }
            info.textContent = vyber.linka + "/" + z.kurz + " · " + hm(z.od) + "–" + hm(z.do) + " · " + (TYPY[z.typ] || "typ " + z.typ);
            otvorBtn.disabled = false;
            otvorBtn._kod = z.kod;
          }
          function nastavKurzy() {
            var k = kurzy();
            var i = Math.max(0, k.map(function (z) { return z.kurz; }).indexOf(vyber.kurz));
            vyber.kurz = k.length ? k[i].kurz : null;
            kolesa.kurz.nastav(k.map(function (z) { return String(z.kurz); }), i);
            obnovInfo();
          }
          function nastavLinky() {
            var l = linky();
            var i = Math.max(0, l.indexOf(vyber.linka));
            vyber.linka = l.length ? l[i] : null;
            kolesa.linka.nastav(l.map(function (x) { return { ikona: trakcia(x), text: String(x), alt: TRAK_NAZOV[trakcia(x)] }; }), i);
            nastavKurzy();
          }
          function postav() {
            box.innerHTML = "";
            var t = typy();
            if (vyber.typ == null) {
              var t0 = window.Calendar ? window.Calendar.getDayType(new Date()) : 1;
              vyber.typ = t.indexOf(t0) >= 0 ? t0 : t[0];
            }
            kolesa = {};
            kolesa.linka = koleso("LINKA", 1.1, function (i) { vyber.linka = linky()[i]; nastavKurzy(); });
            kolesa.kurz = koleso("PORADIE", 1, function (i) { vyber.kurz = kurzy()[i].kurz; obnovInfo(); });
            kolesa.typ = koleso("TYP", 1.6, function (i) { vyber.typ = typy()[i]; nastavLinky(); });
            var rad = mk("div", "display:flex;gap:6px;margin-top:16px");
            rad.appendChild(kolesa.linka.el); rad.appendChild(kolesa.kurz.el); rad.appendChild(kolesa.typ.el);
            box.appendChild(rad);
            info = mk("div", "text-align:center;font-size:14px;color:var(--text-2);margin:10px 0 8px;min-height:20px");
            box.appendChild(info);
            otvorBtn = mk("button", "width:100%;padding:12px;border-radius:12px;border:none;background:var(--red);color:#fff;font-size:16px;font-weight:700;cursor:pointer", "Zobraziť");
            otvorBtn.type = "button";
            otvorBtn.addEventListener("click", function () {
              if (!otvorBtn._kod) return;
              kurzInput.value = otvorBtn._kod;
              if (kurzGo) kurzGo.click();
            });
            box.appendChild(otvorBtn);
            kolesa.typ.nastav(t.map(function (x) { return TYPY[x] || "Typ " + x; }), Math.max(0, t.indexOf(vyber.typ)));
            nastavLinky();
          }
          async function otvor() {
            if (!box) { box = mk("div", ""); sluzPanel.appendChild(box); }
            await nacitaj();
            if (zoznam && !kolesa) postav();
          }
          btn.addEventListener("click", otvor);
          window._cpSluzobnyVyber = function () { vyber = { typ: null, trak: null, linka: null, kurz: null }; kolesa = null; if (box) box.innerHTML = ""; };
        })();
        if (kurzInput)
          kurzInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doGo();
          });
      })();
    