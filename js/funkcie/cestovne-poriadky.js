
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
        if (kurzInput)
          kurzInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doGo();
          });
      })();
    