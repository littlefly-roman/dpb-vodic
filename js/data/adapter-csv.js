
      (function () {
        "use strict";

        window._loadCSV = function (f) {
          if (!f) return;
          var lbl = document.getElementById("_csvLbl");
          if (lbl) lbl.textContent = "...";
          var fr = new FileReader();
          fr.onload = function (e) {
            try {
              var raw = window._csv2raw(e.target.result);
              if (window.DPBData && window.DPBData._replaceRAW) {
                window.DPBData._replaceRAW(raw.drivers, raw.models, raw.trakcie, raw);
                if (lbl) {
                  lbl.textContent = "\u2713 " + f.name.slice(0, 15);
                  lbl.style.background = "rgba(80,220,80,.25)";
                }
              }
            } catch (ex) {
              alert("CSV chyba: " + ex.message);
              if (lbl) lbl.textContent = "CSV";
            }
          };
          fr.readAsText(f, "windows-1252");
        };

        window._csv2raw = function (txt) {
          function parseLine(l) {
            var r = [],
              c = "",
              q = false;
            for (var i = 0; i < l.length; i++) {
              var ch = l[i];
              if (ch === '"') q = !q;
              else if (ch === ";" && !q) {
                r.push(c.trim());
                c = "";
              } else c += ch;
            }
            r.push(c.trim());
            return r;
          }
          function gt(ts) {
            return ts && ts.length >= 16 ? ts.substring(11, 16) : "";
          }
          function toMin(t) {
            if (!t) return 0;
            var p = t.split(":");
            return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
          }

          function cleanName(j, p) {
            j = j
              .replace(/\s*(KP\u010c|Ing\.|Mgr\.|Bc\.|Dr\.|PhD\.?)\s*/g, " ")
              .trim();
            return (j + " " + p).trim();
          }

          function cleanKurz(lk) {
            lk = lk.trim();
            if (!/\d+\/\d+/.test(lk) && !/^[A-Za-z\u00c0-\u017e]+\/\d+/.test(lk)) return lk;
            var parts = lk.split("+"),
              res = [],
              lin = null;
            for (var i = 0; i < parts.length; i++) {
              var p = parts[i].trim();
              p = p.replace(/^(?:JME|JD|D\u00fabr\.?)/, "");
              var prev;
              do {
                prev = p;
                p = p
                  .replace(/(?:str\.?|\u017e|JME|JD|D\u00fabr\.?)\s*$/, "")
                  .trim();
              } while (p !== prev);
              if (!p) continue;
              if (p.indexOf("/") >= 0) {
                lin = p.split("/")[0];
                res.push(p);
              } else if (lin) res.push(lin + "/" + p);
              else res.push(p);
            }
            return res.join("+");
          }
          function stripZeros(k) {
            return k.replace(/\/(0+)(\d)/g, "/$2");
          }
          function normKurz(lk, trid) {
            var k = stripZeros(cleanKurz(lk));
            if (k.indexOf("+") >= 0) {
              var p = k.split("+");
              return p[trid === 2 && p.length > 1 ? 1 : 0];
            }
            return k;
          }
          function isPoh(lk) {
            return /pohotovos/i.test(lk);
          }
          function is944(lk) {
            return /^944\//.test(cleanKurz(lk));
          }
          var TRKR = {
            "denn\u00e1KR": 1,
            "no\u010dn\u00e1KR": 1,
            "denn\u00e1TR": 1,
            "no\u010dn\u00e1TR": 1,
          };
          function vzorFor(lk, stan) {
            var c = cleanKurz(lk);
            if (TRKR[c]) return "TRKR";
            if (isPoh(lk)) return "POHOTOVOS\u0164";
            if (is944(lk)) return "944";
            if (/strieda/i.test(stan || "")) return "STRIEDAC";
            return "SLUZBA";
          }

          var lines = txt.split(/\r?\n/);
          var hdrs = parseLine(lines[0]).map(function (h) {
            return h.replace(/"/g, "").trim();
          });
          var rows = [];
          for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            var vals = parseLine(lines[i]),
              row = {};
            hdrs.forEach(function (h, hi) {
              row[h] = (vals[hi] || "").replace(/"/g, "").trim();
            });
            rows.push(row);
          }

          // Čistenie riadkov (najnovšie verzie, zastarané pozostatky) – js/data/cisti-riadky.js
          rows = window.DpbCistiRiadky.cisti(rows);

          var names = {};
          rows.forEach(function (r) {
            var cid = r.RIDIC_CISLO;
            if (cid && !names[cid]) {
              var n = cleanName(r.RIDIC_JMENO || "", r.RIDIC_PRIJMENI || "");
              if (n && n !== "1 A") names[cid] = n;
            }
          });

          var byDate = {};
          rows.forEach(function (r) {
            var d = (r.DATUM || "").substring(0, 10);
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(r);
          });

          function getZacvik(r) {
            var res = [],
              seen = {},
              om = gt(r.SKUTNASTUP || ""),
              dm = gt(r.SKUTKONEC || "");
            for (var i = 1; i <= 3; i++) {
              var rid = (r["ZACVIK" + i] || "").trim();
              if (!rid || seen[rid]) continue;
              seen[rid] = 1;
              res.push({
                rid: rid,
                meno: names[rid] || rid,
                od: gt(r["ZAC" + i + "OD"] || "") || om,
                do: gt(r["ZAC" + i + "DO"] || "") || dm,
              });
            }
            return res;
          }
          // Predchodca a nasledovník: js/data/karta-z-useku.js (index prítomných úsekov podľa dňa)
          var dnaIdx = null;
          function getPredNasl(r) {
            if (!dnaIdx) dnaIdx = window.DpbKartaZUseku.indexDna(byDate, window.DpbOsVodica.usek);
            return window.DpbKartaZUseku.predNasl(window.DpbOsVodica.usek(r), dnaIdx, names);
          }
          function getPredNaslVypravca(r) {
            if (!dnaIdx) dnaIdx = window.DpbKartaZUseku.indexDna(byDate, window.DpbOsVodica.usek);
            return window.DpbKartaZUseku.predNaslVypravca(window.DpbOsVodica.usek(r), dnaIdx, names);
          }

          function makeKarta(r, dateRows) {
            var u = window.DpbOsVodica.usek(r);
            if ((r.STAVTURNUSU || "0") !== "0") return window.DpbKartaZUseku.nepritomnost(u);
            var vzor = vzorFor(r.LINKAKURZ || "", r.STANSMERVYJEZD || "");
            if (vzor === "SLUZBA") vzor = "SLU\u017dBA";
            if (vzor === "STRIEDAC") vzor = "STRIEDAČ";
            var pn = vzor === "TRKR" ? getPredNaslVypravca(r) : getPredNasl(r);
            // Základ karty (SLUŽBA, POHOTOVOSŤ, TRKR, STRIEDAČ) z osi: karta-z-useku.js
            var k = window.DpbKartaZUseku.kartaZaklad(u, vzor, pn);
            if (vzor === "STRIEDAČ") return k;
            var zac = getZacvik(r);
            if (zac.length) {
              k.zacvik = zac;
              // Rola v zácviku: kto je v stĺpcoch ZACVIK1-3, je zácvikový vodič (zacvičovaný);
              // ostatní vodiči toho istého riadku výpravenky ho vedú.
              var vlastne = (r.RIDIC_CISLO || "").trim();
              var cudzi = zac.filter(function (z) {
                return z.rid !== vlastne;
              });
              if (cudzi.length) {
                k.zacvikVedie = cudzi.map(function (z) {
                  return { rid: z.rid, meno: z.meno };
                });
              } else {
                var zRid = {};
                zac.forEach(function (z) {
                  zRid[z.rid] = 1;
                });
                var kto = null;
                dateRows.forEach(function (x) {
                  var xr = (x.RIDIC_CISLO || "").trim();
                  if (
                    kto ||
                    !xr ||
                    xr === vlastne ||
                    zRid[xr] ||
                    x.STAVTURNUSU !== "0" ||
                    x.CISLO_VYPRAVENKY !== r.CISLO_VYPRAVENKY ||
                    x.RADEK !== r.RADEK
                  )
                    return;
                  kto = { rid: xr, meno: names[xr] || xr };
                });
                if (kto) k.zacvikSkym = kto;
              }
            }
            if (vzor === "POHOTOVOSŤ") k.segmenty = [];
            return k;
          }

          // Reťaze 944 a hradenia: logika je v js/data/karta-z-useku.js (zasuvka944)
          function build944(active, dateRows) {
            var res = window.DpbKartaZUseku.zasuvka944(
              active.map(window.DpbOsVodica.usek),
              function (row) {
                return getPredNasl(row, dateRows);
              },
              normKurz,
            );
            return {
              karty: res.karty,
              remaining: res.zostatok.map(function (u) {
                return u.zdroj;
              }),
            };
          }

          // Zlúčenie pohotovostí a vnorenie úsekov do pohotovosti: js/data/karta-z-useku.js
          function mergePoh(karty) {
            return window.DpbKartaZUseku.zlucPohotovosti(karty);
          }
          function nestInPoh(karty, activeRows) {
            return window.DpbKartaZUseku.vnorDoPohotovosti(
              karty,
              activeRows
                .filter(function (r) {
                  return isPoh(normKurz(r.LINKAKURZ || "", parseInt(r.TRIDENI) || 1));
                })
                .map(window.DpbOsVodica.usek),
            );
          }

          var driverRows = {};
          rows.forEach(function (r) {
            var rid = (r.RIDIC_CISLO || "").trim();
            if (!rid) return;
            var d = (r.DATUM || "").substring(0, 10);
            if (!d) return;
            if (!driverRows[rid]) driverRows[rid] = {};
            if (!driverRows[rid][d]) driverRows[rid][d] = [];
            driverRows[rid][d].push(r);
          });

          var driversOut = {},
            modelsOut = {};
          Object.keys(driverRows)
            .sort()
            .forEach(function (rid) {
              Object.values(driverRows[rid]).forEach(function (dr) {
                if (!driversOut[rid] && dr[0]) {
                  var n = cleanName(
                    dr[0].RIDIC_JMENO || "",
                    dr[0].RIDIC_PRIJMENI || "",
                  );
                  if (n && n !== "1 A") driversOut[rid] = n;
                }
              });
              var days = [];
              Object.keys(driverRows[rid])
                .sort()
                .forEach(function (date) {
                  var myRows = driverRows[rid][date],
                    dateRows = byDate[date] || [];
                  var active = myRows.filter(function (r) {
                    return r.STAVTURNUSU === "0";
                  });
                  var absent = myRows.filter(function (r) {
                    return r.STAVTURNUSU !== "0";
                  });
                  var karty = [];
                  if (
                    active.some(function (r) {
                      return is944(r.LINKAKURZ || "");
                    })
                  ) {
                    var res = build944(active, dateRows);
                    karty = karty.concat(res.karty);
                    active = res.remaining;
                  }
                  var seen = {};
                  active.forEach(function (r) {
                    var key =
                      (r.LINKAKURZ || "") +
                      "|" +
                      (r.TRIDENI || "") +
                      "|" +
                      gt(r.SKUTNASTUP || "");
                    if (seen[key]) return;
                    seen[key] = 1;
                    karty.push(makeKarta(r, dateRows));
                  });
                  karty = mergePoh(karty);
                  karty = nestInPoh(karty, active);
                  absent.forEach(function (r) {
                    karty.push(window.DpbKartaZUseku.nepritomnost(window.DpbOsVodica.usek(r)));
                  });
                  if (karty.length) days.push({ datum: date, karty: karty });
                });
              if (days.length) modelsOut[rid] = days;
            });

          // --- Prestávky z DPB_STATIC.str (logika v karta-z-useku.js) ---
          if (window.DPB_STATIC && window.DPB_STATIC.str) {
            window.DpbKartaZUseku.pridajPrestavky(
              modelsOut,
              driversOut,
              window.DPB_STATIC.str,
              function (date) {
                return window.Calendar ? window.Calendar.getDayType(date) : 1;
              },
              toMin,
            );
          }
          // --- end prestávka resolution ---

          // Domovská trakcia vodiča: osobné číslo patrí jednej trakcii, berie sa TYPDOPRAVY
          // z jeho riadkov (pri zmesi vyhráva najčastejší kód).
          var trakcieOut = {};
          var _poc = {};
          rows.forEach(function (r) {
            var rid = (r.RIDIC_CISLO || "").trim();
            var t = (r.TYPDOPRAVY || "").trim();
            if (!rid || !t) return;
            _poc[rid] = _poc[rid] || {};
            _poc[rid][t] = (_poc[rid][t] || 0) + 1;
          });
          Object.keys(_poc).forEach(function (rid) {
            trakcieOut[rid] = Object.keys(_poc[rid]).sort(function (a, b) {
              return _poc[rid][b] - _poc[rid][a];
            })[0];
          });

          // Voľné služby pre Burzu (js/data/volne-sluzby.js) a dni, ktoré export pokrýva
          var dniExportu = {};
          rows.forEach(function (r) {
            var d = (r.DATUM || "").substring(0, 10);
            if (d) dniExportu[d] = 1;
          });
          return {
            drivers: driversOut,
            models: modelsOut,
            trakcie: trakcieOut,
            volne: window.DpbVolneSluzby ? window.DpbVolneSluzby.najdi(rows) : [],
            volneDni: Object.keys(dniExportu),
          };
        };
      })();
    