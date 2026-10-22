
      (function () {
        var modal = document.getElementById("ziadostModal");
        var title = document.getElementById("ziadostTitle");
        var body = document.getElementById("ziadostBody");
        var btnO = document.getElementById("ziadostOdoslat");
        var btnZ = document.getElementById("ziadostZrusit");
        function close() {
          modal.style.display = "none";
          body.innerHTML = "";
        }
        if (btnZ) btnZ.addEventListener("click", close);
        if (btnO)
          btnO.addEventListener("click", function () {
            window._showToast && window._showToast("Pripravuje sa");
            close();
          });
        modal.addEventListener("click", function (e) {
          if (e.target === modal) close();
        });
        window._showZiadostModal = function (typ, service) {
          body.innerHTML = "";
          if (typ === "nepritomnost") {
            title.textContent = "Nahlásiť neprítomnosť";
            var s = document.createElement("div");
            s.style.cssText = "display:flex;flex-direction:column;gap:8px";
            [
              { kod: "lekar", label: "Lekár" },
              { kod: "pn", label: "PN" },
              { kod: "ine", label: "Iné" },
            ].forEach(function (t) {
              var btn = document.createElement("button");
              btn.style.cssText =
                "padding:12px 16px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;font-size:15px;color:var(--text-1);text-align:left;cursor:pointer";
              btn.textContent = t.label;
              if (t.kod === "ine") {
                btn.addEventListener("click", function () {
                  body.innerHTML = "";
                  title.textContent = "Iný dôvod";
                  var inp = document.createElement("textarea");
                  inp.placeholder = "Popíš dôvod...";
                  inp.style.cssText =
                    "width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-1);outline:none;resize:none;min-height:80px";
                  body.appendChild(inp);
                });
              } else
                btn.addEventListener("click", function () {
                  window._showToast && window._showToast("Pripravuje sa");
                  close();
                });
              s.appendChild(btn);
            });
            body.appendChild(s);
          } else {
            title.textContent =
              typ === "zmena_sluzby" ? "Zmena služby" : "Iná žiadosť";
            var inp = document.createElement("textarea");
            inp.placeholder = "Popíš žiadosť...";
            inp.style.cssText =
              "width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-1);outline:none;resize:none;min-height:80px";
            body.appendChild(inp);
          }
          modal.style.display = "flex";
        };
      })();
    