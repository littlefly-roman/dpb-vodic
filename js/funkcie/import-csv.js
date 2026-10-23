
      (function () {
        var importScreen = document.getElementById("importScreen");
        var loginScreen = document.getElementById("loginScreen");
        var csvInput = document.getElementById("importCsvInput");
        var skipBtn = document.getElementById("importSkipBtn");
        var progress = document.getElementById("importProgress");

        // Ako sa stránka otvorila: "reload" = obnovenie (F5, Live Server, potiahnutie nadol), "navigate" = nové otvorenie
        var navTyp = "";
        try {
          navTyp = (performance.getEntriesByType("navigation")[0] || {}).type || "";
          var _st = JSON.parse(localStorage.getItem("dpb_starty") || "[]");
          _st.push({ t: Date.now(), typ: navTyp });
          localStorage.setItem("dpb_starty", JSON.stringify(_st.slice(-30)));
        } catch (e) {}

        function goToLogin() {
          if (window.DpbIkony) DpbIkony.nacitava(false);
          importScreen.classList.add("hidden");
          var sel = document.getElementById("loginDriverSel");
          var btn = document.getElementById("loginBtn");
          if (sel) {
            sel.innerHTML = '<option value="">— vyber vodiča —</option>';
            DPBData.getDrivers()
              .filter(function (d) {
                return parseInt(d.rid) < 99000;
              })
              .forEach(function (d) {
                var o = document.createElement("option");
                o.value = d.rid;
                o.textContent = d.meno;
                sel.appendChild(o);
              });
            if (btn) btn.disabled = true;
          }
          loginScreen.classList.remove("hidden");
          if (window.DpbIkony) DpbIkony.prehraj();
          // Automatické pokračovanie po obnovení stránky: prihlási rovnakého vodiča
          if (window._autoRid && sel) {
            var rid = window._autoRid;
            window._autoRid = null;
            if (sel.querySelector('option[value="' + rid + '"]')) {
              sel.value = rid;
              sel.dispatchEvent(new Event("change"));
              if (btn) btn.click();
              var kt = new Date();
              setTimeout(function () {
                if (window._showToast)
                  window._showToast(
                    "Stránka sa obnovila o " +
                      String(kt.getHours()).padStart(2, "0") +
                      ":" +
                      String(kt.getMinutes()).padStart(2, "0") +
                      " – pokračujem",
                    3500,
                  );
              }, 400);
            }
          }
        }

        // Posledne načítaný CSV sa ukladá v prehliadači (IndexedDB), aby po obnovení
        // stránky (napr. automatické obnovenie Live Servera, F5) nebolo treba súbor načítať znova.
        var Ulozisko = {
          otvor: function () {
            return new Promise(function (ok, zle) {
              var rq = indexedDB.open("dpb-dashboard", 1);
              rq.onupgradeneeded = function () {
                rq.result.createObjectStore("kv");
              };
              rq.onsuccess = function () {
                ok(rq.result);
              };
              rq.onerror = function () {
                zle(rq.error);
              };
            });
          },
          uloz: function (hodnota) {
            return Ulozisko.otvor().then(function (db) {
              return new Promise(function (ok, zle) {
                var tx = db.transaction("kv", "readwrite");
                tx.objectStore("kv").put(hodnota, "csv");
                tx.oncomplete = ok;
                tx.onerror = function () {
                  zle(tx.error);
                };
              });
            });
          },
          nacitaj: function () {
            return Ulozisko.otvor().then(function (db) {
              return new Promise(function (ok, zle) {
                var rq = db.transaction("kv").objectStore("kv").get("csv");
                rq.onsuccess = function () {
                  ok(rq.result || null);
                };
                rq.onerror = function () {
                  zle(rq.error);
                };
              });
            });
          },
        };

        csvInput.addEventListener("change", function () {
          var f = this.files[0];
          if (!f) return;
          progress.style.display = "block";
          progress.textContent = "Spracúvam " + f.name + "...";
          if (window.DpbIkony) DpbIkony.nacitava(true);
          var fr = new FileReader();
          fr.onload = function (e) {
            try {
              // Kódovanie sa rozpozná samo: nový export býva UTF-8, starý windows-1250
              var text;
              try {
                text = new TextDecoder("utf-8", { fatal: true }).decode(
                  e.target.result,
                );
              } catch (encErr) {
                text = new TextDecoder("windows-1250").decode(
                  e.target.result,
                );
              }
              if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
              spracuj(text, f.name, true);
            } catch (ex) {
              progress.textContent = "Chyba: " + ex.message;
              if (window.DpbIkony) DpbIkony.nacitava(false);
            }
          };
          fr.readAsArrayBuffer(f);
          this.value = "";
        });

        function spracuj(text, nazov, ulozit, zostat) {
          try {
            {
              var raw = window._csv2raw(text);
              if (window.DPBData && window.DPBData._replaceRAW)
                window.DPBData._replaceRAW(raw.drivers, raw.models, raw.trakcie, raw);
              if (window.appState) {
                var _t = new Date();
                var _tk =
                  _t.getFullYear() +
                  "-" +
                  String(_t.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(_t.getDate()).padStart(2, "0");
                var _av = [];
                Object.values(raw.models).forEach(function (days) {
                  days.forEach(function (d) {
                    if (_av.indexOf(d.datum) < 0) _av.push(d.datum);
                  });
                });
                _av.sort();
                var _pick =
                  (_av.indexOf(_tk) >= 0 || (_av.length && _av[0] <= _tk && _tk <= _av[_av.length - 1]))
                    ? _tk
                    : _av
                        .filter(function (d) {
                          return d <= _tk;
                        })
                        .slice(-1)[0] || _av[0];
                if (_pick) {
                  var _p = _pick.split("-").map(Number);
                  window.appState.selectedDate = new Date(
                    _p[0],
                    _p[1] - 1,
                    _p[2],
                  );
                }
                window.appState.servicesByDate = {};
              }
              progress.textContent = "\u2713 " + nazov;
              if (ulozit)
                Ulozisko.uloz({ text: text, nazov: nazov, cas: Date.now() }).catch(
                  function () {},
                );
              if (zostat) {
                // obnova dát z Profilu: vodič ostáva prihlásený, len sa prekreslí
                var rid = window.appState && window.appState.currentDriver;
                var stale = rid && window.DPBData && DPBData.getDrivers().some(function (x) {
                  return String(x.rid) === String(rid);
                });
                if (stale) {
                  if (window._render) window._render();
                } else if (window.Profil && Profil.odhlas) {
                  Profil.odhlas();
                }
              } else setTimeout(goToLogin, 600);
              return true;
            }
          } catch (ex) {
            progress.textContent = "Chyba: " + ex.message;
            if (window.DpbIkony) DpbIkony.nacitava(false);
            return false;
          }
        }

        function dekoduj(buf) {
          var text;
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
          } catch (encErr) {
            text = new TextDecoder("windows-1250").decode(buf);
          }
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
          return text;
        }

        // Pre Profil: načítanie nového CSV bez odhlásenia a informácia o posledných dátach.
        window._nacitajNoveData = function (f) {
          return new Promise(function (ok, zle) {
            var fr = new FileReader();
            fr.onload = function (e) {
              try {
                var res = spracuj(dekoduj(e.target.result), f.name, true, true);
                if (res) ok(f.name);
                else zle(new Error(progress.textContent || "Súbor sa nepodarilo načítať"));
              } catch (ex) {
                zle(ex);
              }
            };
            fr.onerror = function () { zle(new Error("Súbor sa nepodarilo prečítať")); };
            fr.readAsArrayBuffer(f);
          });
        };
        window._infoODatach = function () {
          return Ulozisko.nacitaj().then(function (z) {
            return z && z.text ? { nazov: z.nazov, cas: z.cas } : null;
          });
        };

        // Ak je v prehliadači uložený posledný CSV, pod výberom súboru sa objaví tlačidlo,
        // ktorým sa dá pokračovať bez opätovného načítania.
        try {
          Ulozisko.nacitaj()
            .then(function (z) {
              if (!z || !z.text) return;
              var b = document.createElement("button");
              b.type = "button";
              b.id = "importPokracujBtn";
              var kedy = new Date(z.cas);
              b.textContent =
                "Pokračovať s " +
                z.nazov +
                " (načítaný " +
                kedy.getDate() +
                ". " +
                (kedy.getMonth() + 1) +
                ". " +
                String(kedy.getHours()).padStart(2, "0") +
                ":" +
                String(kedy.getMinutes()).padStart(2, "0") +
                ")";
              b.style.cssText =
                "margin-top:12px;padding:12px 16px;border-radius:12px;border:1px solid var(--red);background:transparent;color:var(--red);font-size:14px;font-weight:600;cursor:pointer;max-width:320px";
              // Zostaň prihlásený: pri každom otvorení appky pokračuj automaticky,
              // kým sa vodič sám neodhlási v Profile (max. 90 dní nečinnosti).
              try {
                var rel = JSON.parse(localStorage.getItem("dpb_relacia") || "null");
                if (
                  rel &&
                  rel.rid &&
                  Date.now() - rel.ts < 90 * 24 * 3600 * 1000
                ) {
                  window._autoRid = rel.rid;
                  progress.style.display = "block";
                  progress.textContent = "Obnovujem " + z.nazov + "...";
                  if (window.DpbIkony) DpbIkony.nacitava(true);
                  setTimeout(function () {
                    spracuj(z.text, z.nazov, false);
                  }, 30);
                }
              } catch (e) {}
              b.addEventListener("click", function () {
                progress.style.display = "block";
                progress.textContent = "Spracúvam " + z.nazov + "...";
                setTimeout(function () {
                  spracuj(z.text, z.nazov, false);
                }, 30);
              });
              progress.parentNode.insertBefore(b, progress.nextSibling);
            })
            .catch(function () {});
        } catch (e) {}
      })();
    