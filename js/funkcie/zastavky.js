
      (function () {
        function stripDia(s) {
          return (s || "")
            .toLowerCase()
            .replace(/[áàä]/g, "a")
            .replace(/[éèë]/g, "e")
            .replace(/[íìï]/g, "i")
            .replace(/[óòöô]/g, "o")
            .replace(/[úùü]/g, "u")
            .replace(/[ý]/g, "y")
            .replace(/[č]/g, "c")
            .replace(/[š]/g, "s")
            .replace(/[ž]/g, "z")
            .replace(/[ň]/g, "n")
            .replace(/[ľĺ]/g, "l")
            .replace(/[ď]/g, "d")
            .replace(/[ť]/g, "t")
            .replace(/[ŕ]/g, "r");
        }
        function timeToSec(t) {
          if (!t) return 0;
          var p = t.split(":");
          return (
            parseInt(p[0] || 0) * 3600 +
            parseInt(p[1] || 0) * 60 +
            parseInt(p[2] || 0)
          );
        }
        var staInput = document.getElementById("cpStanicaInput");
        var staResults = document.getElementById("cpStanicaResults");
        var staOdchody = document.getElementById("cpStanicaOdchody");
        if (!staInput) return;
        var _stanice = null,
          _jrCache = {},
          _smCache = {};
        function getFolder() {
          if (!window.appState || !window.appState.dataFolders) return null;
          var d = new Date();
          var key =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0");
          return window.Calendar.findDataFolder(
            key,
            window.appState.dataFolders,
          );
        }
        async function loadTxt(path) {
          try {
            var r = await fetch(path);
            if (!r.ok) return null;
            var b = await r.arrayBuffer();
            return new TextDecoder("windows-1250").decode(b);
          } catch (e) {
            return null;
          }
        }
        // Stiahne súbor v stlačenej podobe (.gz, ~6x menší = rýchle aj na slabom mobile).
        // Ak .gz nie je alebo ho prehliadač nevie rozbaliť, použije sa pôvodný súbor.
        // Vráti {buf, status}; buf je null, ak server odpovedal chybou. Pri výpadku siete VYHODÍ výnimku.
        var _gzNie = {};
        async function nacitajBajty(path) {
          var kluc = path.split("/").slice(0, 2).join("/");
          if (typeof DecompressionStream === "function" && !_gzNie[kluc]) {
            var rz = null;
            try {
              rz = await fetch(path + ".gz");
            } catch (e) {}
            if (rz && rz.ok) {
              try {
                var rozbalene = await new Response(
                  rz.body.pipeThrough(new DecompressionStream("gzip")),
                ).arrayBuffer();
                return { buf: rozbalene, status: 200 };
              } catch (e) {
                _gzNie[kluc] = 1;
              }
            } else if (rz && /(STANICE\.ZS|CILE\.CL)$/.test(path)) {
              _gzNie[kluc] = 1; // priečinok nemá stlačené kópie
            }
          }
          var r = await fetch(path);
          if (!r.ok) return { buf: null, status: r.status };
          return { buf: await r.arrayBuffer(), status: 200 };
        }
        async function getStanice() {
          var f = getFolder();
          if (!f) return null;
          if (_stanice && _stanice.folder === f) return _stanice;
          var t = null;
          try {
            var sb = await nacitajBajty("data/" + f + "/STANICE.ZS");
            if (sb.buf) t = new TextDecoder("windows-1250").decode(sb.buf);
          } catch (e) {}
          if (!t) return null;
          var mapa = {},
            groups = {};
          t.split("\n").forEach(function (l) {
            var p = l.trim().split("\t");
            if (!p[0] || !p[1]) return;
            var kod = p[0].trim(),
              n = p[1].trim();
            mapa[kod] = n;
            var g = kod.substring(0, 4);
            if (!groups[g]) groups[g] = { nazov: n, platformy: [], pos: null };
            groups[g].platformy.push(kod);
            if (!groups[g].pos) {
              var lon = parseFloat(String(p[2] || "").replace(",", ".")),
                lat = parseFloat(String(p[3] || "").replace(",", "."));
              if (isFinite(lon) && isFinite(lat)) groups[g].pos = { lat: lat, lon: lon };
            }
          });
          _stanice = { mapa: mapa, groups: groups, folder: f };
          return _stanice;
        }
        async function getSM(linka, folder) {
          var key = linka + "_" + folder;
          if (_smCache[key]) return _smCache[key];
          var t = await loadTxt("data/" + folder + "/" + linka + ".SM");
          var m = {};
          if (t)
            t.split("\n").forEach(function (l) {
              l = l.trim();
              if (!l.startsWith("L")) return;
              var p = l.split("\t");
              var sn = parseInt((p[1] || "").replace(/^S/, ""));
              var ck = "";
              for (var i = 2; i < p.length; i++) {
                if ((p[i] || "").match(/^C\d/)) {
                  ck = p[i].replace(/^C0*/, "");
                  break;
                }
              }
              if (sn && ck) m[linka + "_" + sn] = ck;
            });
          _smCache[key] = m;
          return m;
        }
        var _base = [], // všetky odchody zastávky zo všetkých typov dňa (čas v sekundách od polnoci)
          _poTyp = {},
          _renderInt = null;
        // Filtre pod názvom zastávky: nástupište (stĺpik), linka a typ dňa. Zakliknuté = vybrané.
        // Nič nevybrané = bez obmedzenia. Viac vybraných v jednom filte = ktorékoľvek z nich.
        // Typ dňa: bez výberu platí kalendár (včera/dnes/zajtra podľa ich typu dňa),
        // s výberom sa ukáže poriadok vybraného typu (aj iného ako dnešného) pre včera/dnes/zajtra.
        var _fNast = {},
          _fLinka = {},
          _fTyp = {};
        // Okno zobrazených odchodov: koľko predchádzajúcich a nasledujúcich sa ukazuje.
        var _predPocet = 5,
          _poPocet = 10,
          _btnPred = null,
          _btnPo = null;
        function nieco(stav) {
          return Object.keys(stav).some(function (k) {
            return stav[k];
          });
        }
        // Linky X (JR 801, 803, ...) sa v exporte vedú ako 8NN, cestujúcim sú známe ako XNN.
        function nazovLinky(n) {
          n = parseInt(n);
          // 8NN = výlukové/pomocné linky (X), 4NN = nočné linky (N) – v GTFS aj na vozidlách N21, N29…
          return n >= 800 && n < 900 ? "X" + (n - 800) : n >= 400 && n < 500 ? "N" + (n - 400) : String(n);
        }
        // Linky X (8NN) a ostatné 9NN sú náhradné/technické linky (napr. za električky pri výpadku) – neverejné,
        // v zozname odchodov sa neponúkajú. Školské spoje (Šk) sa zobrazujú. Ak sa niektorá z nich objaví
        // v GTFS s cestovným poriadkom (napr. 908), stačí ju tu vyňať.
        function skrytaLinka(o) {
          var n = o.lraw || 0;
          return n >= 800 && n < 1000 && !/^Šk/.test(o.linka);
        }
        // Linky X (8NN) a ostatné 9NN sú náhradné/technické linky (napr. za električky pri výpadku) – neverejné,
        // v zozname odchodov sa neponúkajú. Školské spoje (Šk) sa zobrazujú. Ak sa niektorá z nich objaví
        // v GTFS s cestovným poriadkom (napr. 908), stačí ju tu vyňať.
        function skrytaLinka(o) {
          var n = o.lraw || 0;
          return n >= 800 && n < 1000 && !/^Šk/.test(o.linka);
        }
        function cisloLinky(h) {
          var ms = /^Šk ?(\d*)$/.exec(h);
          if (ms) return 1000 + (parseInt(ms[1]) || 0);
          var m = /^X(\d+)$/.exec(h);
          if (m) return 800 + parseInt(m[1]);
          var mn = /^N(\d+)$/.exec(h);
          return mn ? 400 + parseInt(mn[1]) : parseInt(h);
        }
        function typDna(off) {
          var d = new Date();
          d.setDate(d.getDate() + off);
          return window.Calendar ? window.Calendar.getDayType(d) : 1;
        }
        function typyOkna() {
          var t = {};
          for (var off = -1; off <= 1; off++) t[typDna(off)] = 1;
          return t;
        }
        // Zhoda odchodu so všetkými filtrami okrem jedného (vynechaj) – na ponuku tlačidiel
        function sedi(o, vynechaj) {
          if (vynechaj !== "nast" && nieco(_fNast) && !_fNast[o.nast]) return false;
          if (vynechaj !== "linka" && nieco(_fLinka) && !_fLinka[o.linka]) return false;
          if (vynechaj !== "typ") {
            if (nieco(_fTyp)) {
              if (!_fTyp[o.typ]) return false;
            } else if (!typyOkna()[o.typ]) return false;
          }
          return true;
        }
        // Odchody včera, dnes a zajtra, aby po polnoci a v noci bolo vždy čo ukázať.
        // casN je posunutý o celé dni (včera -86400, zajtra +86400).
        // Prevádzkový deň: odchody po polnoci až do rannej výpravy (pred ZACIATOK_DNA)
        // patria ešte k predchádzajúcemu dňu, t. j. v pondelok o 00:01 sa ide podľa nedele,
        // o 4:30 už podľa pondelka.
        var ZACIATOK_DNA = 3 * 3600;
        function rozvinDni() {
          var vyber = Object.keys(_fTyp).filter(function (k) { return _fTyp[k]; });
          var vsetky = [];
          for (var off = -1; off <= 1; off++) {
            var typy = vyber.length ? vyber : [String(typDna(off))];
            typy.forEach(function (t) {
              (_poTyp[t] || []).forEach(function (b) {
                var poPolnoci = b.casN < ZACIATOK_DNA;
                var posun = off + (poPolnoci ? 1 : 0);
                vsetky.push({
                  typ: b.typ, linka: b.linka, kurz: b.kurz, sluz: b.sluz, lraw: b.lraw, ciel: b.ciel, nast: b.nast, sd: off,
                  cas: b.cas, den: posun, casN: b.casN + posun * 86400,
                });
              });
            });
          }
          vsetky.sort(function (a, b) {
            return a.casN - b.casN;
          });
          return vsetky;
        }
        function filtrovane() {
          return rozvinDni().filter(function (o) {
            return sedi(o, "typ");
          });
        }
        async function findOdchody(kodFilter, todayTyp) {
          var folder = getFolder();
          if (!folder) return [];
          var linky = [1, 3, 4, 9];
          var cileText = await loadTxt("data/" + folder + "/CILE.CL");
          var cileMapa = {};
          if (cileText)
            cileText.split("\n").forEach(function (l) {
              var p = l.trim().split("\t");
              if (p[0] && p[1]) cileMapa[p[0].trim()] = p[1].trim();
            });
          var smAll = {};
          await Promise.all(
            linky.map(async function (l) {
              var sm = await getSM(l, folder);
              Object.assign(smAll, sm);
            }),
          );
          var odchody = [];
          await Promise.all(
            linky.map(async function (linka) {
              var key = linka + "_" + folder;
              if (!_jrCache[key])
                _jrCache[key] = await loadTxt(
                  "data/" + folder + "/" + linka + ".JR",
                );
              var t = _jrCache[key];
              if (!t) return;
              var curObeh = null,
                curSpoj = null,
                curKurz = 0;
              t.split("\n").forEach(function (line) {
                line = line.trim();
                if (!line) return;
                if (line.startsWith("#")) {
                  var ot = parseInt(line.slice(-1));
                  if (ot === todayTyp) {
                    curObeh = line;
                    curKurz = parseInt(line.substring(4, 6)) || 0;
                  } else {
                    curObeh = null;
                    curKurz = 0;
                  }
                  curSpoj = null;
                  return;
                }
                if (!curObeh) return;
                if (line.startsWith("L")) {
                  var p = line.split("\t");
                  var sn = parseInt((p[1] || "").replace(/^S/, "")) || 0;
                  var ck = smAll[linka + "_" + sn] || "";
                  curSpoj = {
                    linka: linka,
                    kurz: curKurz,
                    ciel: cileMapa[ck] || ck,
                  };
                  return;
                }
                if (!curSpoj) return;
                var p = line.split("\t");
                var kod = (p[0] || "").trim();
                var cas = (p[2] || "").trim();
                if (!cas) return;
                if (kod && kodFilter(kod))
                  odchody.push({
                    typ: todayTyp,
                    linka: linka,
                    kurz: curKurz,
                    ciel: curSpoj.ciel,
                    nast: kod.substring(4, 6),
                    cas: cas,
                    casN: timeToSec(cas),
                  });
              });
            }),
          );
          odchody.sort(function (a, b) {
            return a.casN - b.casN;
          });
          var seen = {};
          odchody = odchody.filter(function (o) {
            var k = o.cas + "|" + o.linka + "|" + o.kurz;
            if (seen[k]) return false;
            seen[k] = 1;
            return true;
          });
          return odchody;
        }
        var _cileCache = {};
        async function getCile(folder) {
          if (_cileCache[folder]) return _cileCache[folder];
          var cb = await nacitajBajty("data/" + folder + "/CILE.CL"); // pri výpadku siete vyhodí výnimku (nezapíše sa prázdna cache)
          var t = cb.buf ? new TextDecoder("windows-1250").decode(cb.buf) : null;
          var m = {};
          if (t)
            t.split("\n").forEach(function (l) {
              var p = l.trim().split("\t");
              if (p[0] && p[1]) m[p[0].trim().replace(/^0+/, "")] = p[1].trim(); // kód bez úvodných núl (ako v indexe)
            });
          return (_cileCache[folder] = m);
        }
        // Všetky odchody zastávky (skupiny nástupíšť) zo všetkých liniek a typov dňa.
        // Zdroj: predpočítaný index data/<priečinok>/ZAST/<kód>.txt (tools/zastavky-index.mjs).
        // Ak index chýba, použije sa pôvodné čítanie surových .JR (električky 1, 3, 4, 9).
        var _txtCache = {};
        async function nacitajBase(grp, kodFilter) {
          var folder = getFolder();
          if (!folder) return [];
          var out = [];
          var t = null;
          var siet = false;
          var kluc = folder + "/" + grp;
          var cilePromise = getCile(folder);
          cilePromise.catch(function () {});
          if (_txtCache[kluc] !== undefined) {
            t = _txtCache[kluc];
          } else {
            try {
              var zr = await nacitajBajty("data/" + folder + "/ZAST/" + grp + ".txt");
              if (zr.buf) t = new TextDecoder("utf-8").decode(zr.buf);
              else if (zr.status === 404) {
                // priečinok s indexom, ale zastávka bez odchodov = prázdny výsledok (nie návrat k surovým .JR)
                var ok = await nacitajBajty("data/" + folder + "/ZAST/_index.txt");
                if (ok.buf) t = "";
              }
            } catch (e) {
              siet = true;
            }
            if (t !== null) {
              var kl = Object.keys(_txtCache);
              if (kl.length > 40) delete _txtCache[kl[0]];
              _txtCache[kluc] = t;
            }
          }
          if (t !== null) {
            var cile = await cilePromise;
            var stan = await getStanice();
            t.split("\n").forEach(function (l) {
              if (!l) return;
              var p = l.split("\t");
              // Školský spoj (neverejný): cieľ "S<N>:<skupina>" = linka "Šk N", cieľ = posledná zastávka spoja
              var sk = /^S(\d*):(\d{4})$/.exec(p[5]);
              out.push({
                typ: p[0],
                linka: sk ? "Šk" + (sk[1] ? " " + sk[1] : "") : nazovLinky(p[1]),
                lraw: parseInt(p[1]), // číslo linky v exporte (pre vozidlá/kurz)
                kurz: parseInt(p[2]),
                sluz: p[6] ? parseInt(p[6]) : 0, // prejazd: služba (súbor) inej linky
                nast: p[3],
                cas: p[4],
                casN: timeToSec(p[4]),
                ciel: sk ? (stan && stan.groups[sk[2]] ? stan.groups[sk[2]].nazov : sk[2]) : cile[p[5]] || p[5],
              });
            });
          } else {
            for (var typ = 1; typ <= 9; typ++) {
              (await findOdchody(kodFilter, typ)).forEach(function (o) {
                o.typ = String(typ);
                o.lraw = parseInt(o.linka);
                o.lraw = parseInt(o.linka);
                o.linka = nazovLinky(o.linka);
                out.push(o);
              });
            }
            if (!out.length && siet) throw new Error("siet");
          }
          return out.filter(function (o) {
            return !skrytaLinka(o);
          });
        }
        // rezim: "zamer" = po zmene filtra / otvorení odrolovať na najbližší odchod,
        //        "pred" = pribudli riadky hore, drž pozíciu, inak ostáva pozícia scrollu
        // Písmená nástupíšť z GTFS: data/<priečinok>/NAST.txt, riadok = skupina TAB nástupište(2 číslice) TAB písmeno.
        // Ak nástupište nemá písmeno v GTFS, použije sa poradie v abecede (nastPismeno); nad 26 ostáva číslo.
        var _nastCache = {},
          _nastMapa = {};
        async function nacitajNast(grp) {
          var f = getFolder();
          if (!f) return {};
          if (!_nastCache[f]) {
            var m = {};
            try {
              var nb = await nacitajBajty("data/" + f + "/NAST.txt");
              if (nb.buf)
                new TextDecoder("utf-8").decode(nb.buf).split("\n").forEach(function (l) {
                  var p = l.split("\t");
                  if (p.length >= 3) (m[p[0]] = m[p[0]] || {})[p[1]] = p[2].trim();
                });
            } catch (e) {}
            _nastCache[f] = m;
          }
          return _nastCache[f][grp] || {};
        }
        // Pravidlo overené na všetkých nástupištiach v GTFS (1378 z 1378): písmeno = poradie čísla nástupišťa
        // v abecede (01=A, 02=B, … 26=Z). GTFS má prednosť; pravidlo dopĺňa nástupištia, ktoré v GTFS chýbajú
        // (napr. depové 01/02/05 na Depe Jurajov dvor).
        function nastPismeno(pp) {
          var n = parseInt(pp, 10);
          return n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : "";
        }
        // Smer nástupišťa voči centru (data/<priečinok>/SMER.txt: C = do centra, Z = z centra, ? = nejasné)
        var _smerCache = {},
          _smerMapa = {};
        async function nacitajSmer(grp) {
          var f = getFolder();
          if (!f) return {};
          if (!_smerCache[f]) {
            var m = {};
            try {
              var sb = await nacitajBajty("data/" + f + "/SMER.txt");
              if (sb.buf)
                new TextDecoder("utf-8").decode(sb.buf).split("\n").forEach(function (l) {
                  var p = l.split("\t");
                  if (p.length >= 3) (m[p[0]] = m[p[0]] || {})[p[1]] = p[2].trim();
                });
            } catch (e) {}
            _smerCache[f] = m;
          }
          return _smerCache[f][grp] || {};
        }
        function smerText(pp) {
          var s = _smerMapa[pp];
          return s === "C" ? "do centra" : s === "Z" ? "z centra" : "";
        }
        // Názvy typov dňa: 1 = pracovný deň, 2 = sobota, 3 = nedeľa/sviatok, 4 = pracovný deň počas prázdnin
        var TYP_NAZOV = { "1": "Po–Pi", "2": "So", "3": "Ne", "4": "Prázdniny" };
        function typLabel(t) {
          return TYP_NAZOV[t] || t;
        }
        function nastLabel(pp) {
          return _nastMapa[pp] || nastPismeno(pp) || pp;
        }
        function nastPorovnaj(x, y) {
          var lx = nastLabel(x),
            ly = nastLabel(y),
            px = /^[A-Z]$/.test(lx),
            py = /^[A-Z]$/.test(ly);
          if (px !== py) return px ? -1 : 1; // najprv písmená, potom nástupištia bez písmena
          return lx < ly ? -1 : lx > ly ? 1 : 0;
        }
        // Číslo vozidla na kurze – len pre dnešný deň, z nahratej výpravy (RAW.models všetkých vodičov).
        // Index: služobný deň (posun voči dnešku) -> { "linka/kurz": [{o, d, cislo}] } (minúty od polnoci služobného dňa).
        var _vozIdx = {};
        function minut(t) {
          var p = String(t || "").split(":");
          return parseInt(p[0] || 0, 10) * 60 + parseInt(p[1] || 0, 10);
        }
        function vozidlaDna(posun) {
          if (_vozIdx[posun]) return _vozIdx[posun];
          var idx = {};
          var d = new Date();
          d.setDate(d.getDate() + posun);
          var kl =
            d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          var modely = (window.RAW && window.RAW.models) || {};
          Object.keys(modely).forEach(function (rid) {
            (modely[rid] || []).forEach(function (den) {
              if (den.datum !== kl) return;
              (den.karty || []).forEach(function (k) {
                if (k.vzor !== "SLUŽBA" || !k.kurz || !k.vozidla) return;
                k.vozidla.forEach(function (v) {
                  if (!v.cislo) return;
                  var o = minut(v.od),
                    dd = minut(v.do);
                  if (dd < o) dd += 1440; // vozidlo cez polnoc
                  (idx[k.kurz] = idx[k.kurz] || []).push({ o: o, d: dd, cislo: v.cislo });
                });
              });
            });
          });
          return (_vozIdx[posun] = idx);
        }
        // vozidlo odchodu: len ak je odchod dnes (kalendárny deň), inak ""
        function vozidloOdchodu(o) {
          if (o.den !== 0) return "";
          var kurz = (o.sluz || o.lraw || o.linka) + "/" + o.kurz;
          var iv = vozidlaDna(o.sd)[kurz];
          if (!iv) return "";
          var t = Math.floor(o.casN / 60) + (o.casN < ZACIATOK_DNA ? 1440 : 0);
          for (var i = 0; i < iv.length; i++) if (iv[i].o <= t && t < iv[i].d) return iv[i].cislo;
          for (var j = 0; j < iv.length; j++) if (iv[j].o <= t && t <= iv[j].d) return iv[j].cislo; // koniec intervalu (výmena)
          return "";
        }
        // Vodiči kurzov dňa: { "3/12": [{o,d,meno}] } – z karty SLUŽBA a z kurzov striedača (minúty)
        var _vodIdx = {}, _vsetciVodici = false, _vodOtv = {};
        function vodiciDna(posun) {
          if (_vodIdx[posun]) return _vodIdx[posun];
          var idx = {};
          var d = new Date();
          d.setDate(d.getDate() + posun);
          var kl =
            d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          var drv = {};
          try { (window.DPBData ? DPBData.getDrivers() : []).forEach(function (x) { drv[String(x.rid)] = x.meno; }); } catch (e) {}
          var modely = (window.RAW && window.RAW.models) || {};
          Object.keys(modely).forEach(function (rid) {
            (modely[rid] || []).forEach(function (den) {
              if (den.datum !== kl) return;
              (den.karty || []).forEach(function (k) {
                var pridaj = function (kurz, od, do_, typ) {
                  if (!kurz || !od || !do_) return;
                  var o = minut(od), dd = minut(do_);
                  if (dd < o) dd += 1440;
                  (idx[kurz] = idx[kurz] || []).push({ o: o, d: dd, meno: drv[String(rid)] || String(rid), typ: typ });
                };
                if (k.vzor === "SLUŽBA") pridaj(k.kurz, k.od, k.do, "sluzba");
                else if (k.vzor === "STRIEDAČ") (k.kurzy || []).forEach(function (r) { pridaj(r.kurz, r.prebera, r.odovzdava, "striedac"); });
              });
            });
          });
          return (_vodIdx[posun] = idx);
        }
        // vodič odchodu: len pre dnešný deň; vráti { meno } alebo null
        function vodicOdchodu(o) {
          if (o.den !== 0) return null;
          var kurz = (o.sluz || o.lraw || o.linka) + "/" + o.kurz;
          var iv = vodiciDna(o.sd)[kurz];
          if (!iv) return null;
          var t = Math.floor(o.casN / 60) + (o.casN < ZACIATOK_DNA ? 1440 : 0);
          var najdi = function (typ, strict) {
            return iv.filter(function (x) { return x.typ === typ && x.o <= t && (strict ? t < x.d : t <= x.d); })[0];
          };
          return najdi("striedac", true) || najdi("sluzba", true) || najdi("striedac", false) || najdi("sluzba", false) || null;
        }
        function renderRows(rezim) {
          var cont = document.getElementById("_zastavkyRows");
          if (!cont) return;
          var _staraVyska = cont.scrollHeight, _staryTop = cont.scrollTop;
          var nowSec = (function () {
            var n = new Date();
            return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
          })();
          var _data = filtrovane();
          var viacTypov = Object.keys(_fTyp).filter(function (k) { return _fTyp[k]; }).length > 1;
          var pivot = _data.length;
          for (var i = 0; i < _data.length; i++) {
            if (_data[i].casN >= nowSec) {
              pivot = i;
              break;
            }
          }
          var vis = _data.slice(
            Math.max(0, pivot - _predPocet),
            Math.min(_data.length, pivot + _poPocet),
          );
          if (_btnPred) _btnPred.style.display = pivot - _predPocet > 0 ? "" : "none";
          if (_btnPo) _btnPo.style.display = pivot + _poPocet < _data.length ? "" : "none";
          var firstNext = vis.find(function (x) {
            return x.casN >= nowSec;
          });
          cont.innerHTML = "";
          cont._dalsi = null;
          if (!vis.length) {
            cont.innerHTML =
              '<div style="color:var(--text-3);font-size:15px;padding:8px 0">Žiadne odchody</div>';
            return;
          }
          // nástupište sa ukáže, len ak je v zozname viac ako jedno
          var nastSet = {};
          _data.forEach(function (o) { nastSet[o.nast] = 1; });
          var viacNast = Object.keys(nastSet).length > 1;
          // linky sa zarovnajú na lomku: ľavá časť doprava, pravá (od lomky) doľava
          function casti(o) {
            return o.sluz
              ? [o.linka + " (" + o.sluz, "/" + o.kurz + ")"]
              : [String(o.linka), "/" + o.kurz];
          }
          var sirL = 0, sirP = 0;
          vis.forEach(function (o) {
            var c = casti(o);
            sirL = Math.max(sirL, c[0].length);
            sirP = Math.max(sirP, c[1].length);
          });
          var vozMapa = new Map(),
            maVoz = false;
          vis.forEach(function (o) {
            var v = vozidloOdchodu(o);
            vozMapa.set(o, v);
            if (v) maVoz = true;
          });
          vis.forEach(function (o) {
            var isPast = o.casN < nowSec,
              isNext = firstNext && o === firstNext;
            var row = document.createElement("div");
            row.style.cssText =
              "display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);" +
              (isPast ? "opacity:0.6" : "");
            var cp = o.cas.split(":");
            var cas = document.createElement("span");
            cas.style.cssText =
              "font-size:15px;min-width:52px;font-variant-numeric:tabular-nums;color:" +
              (isNext ? "var(--red-text)" : "var(--text-1)") +
              (isNext ? ";font-weight:600" : "");
            cas.textContent = cp[0] + ":" + (cp[1] || "00");
            row.appendChild(cas);
            if (viacNast) {
              var nast = document.createElement("span");
              nast.style.cssText =
                "font-size:15px;font-weight:600;min-width:20px;text-align:center;color:var(--text-2)";
              nast.textContent = nastLabel(o.nast);
              row.appendChild(nast);
            }
            var c = casti(o);
            var lnk = document.createElement("span");
            lnk.style.cssText =
              "display:inline-flex;flex:none;font-size:15px;font-weight:600;color:var(--text-1);white-space:nowrap;font-variant-numeric:tabular-nums";
            var l1 = document.createElement("span");
            l1.style.cssText = "min-width:" + sirL + "ch;text-align:right";
            l1.textContent = c[0];
            var l2 = document.createElement("span");
            l2.style.cssText = "min-width:" + sirP + "ch;text-align:left";
            l2.textContent = c[1];
            lnk.appendChild(l1);
            lnk.appendChild(l2);
            if (viacTypov) {
              var l3 = document.createElement("span");
              l3.style.cssText = "min-width:7ch;font-weight:400;color:var(--text-3);padding-left:6px";
              l3.textContent = "\u00B7 typ " + o.typ;
              lnk.appendChild(l3);
            }
            row.appendChild(lnk);
            if (maVoz) {
              var voz = document.createElement("span");
              voz.style.cssText =
                "flex:none;min-width:4ch;margin-left:6px;font-size:15px;font-variant-numeric:tabular-nums;color:var(--text-2);text-align:right";
              voz.textContent = vozMapa.get(o) || "";
              row.appendChild(voz);
            }
            var ciel = document.createElement("span");
            ciel.style.cssText = "font-size:15px;color:var(--text-2);flex:1;margin-left:10px";
            ciel.textContent = "\u2192 " + (o.ciel || "");
            row.appendChild(ciel);
            // šípka na konci riadku: rozbalí meno vodiča
            var vod = vodicOdchodu(o);
            var kl = o.typ + "|" + o.linka + "|" + o.kurz + "|" + o.cas + "|" + o.den;
            var otvorene = _vsetciVodici || _vodOtv[kl];
            var sip = document.createElement("button");
            sip.type = "button";
            sip.setAttribute("aria-label", "Vodič");
            sip.setAttribute("aria-expanded", otvorene ? "true" : "false");
            sip.style.cssText = "flex:none;border:none;background:transparent;padding:4px 2px 4px 6px;cursor:pointer;color:var(--text-3);font-size:15px;line-height:1;transition:transform .15s;transform:rotate(" + (otvorene ? "90deg" : "0deg") + ")";
            sip.textContent = "\u203A";
            row.appendChild(sip);
            var wrap = document.createElement("div");
            wrap.appendChild(row);
            var det = document.createElement("div");
            det.style.cssText = "display:" + (otvorene ? "block" : "none") + ";padding:2px 0 8px 62px;font-size:15px;color:var(--text-2);border-bottom:1px solid var(--border);" + (isPast ? "opacity:0.6" : "");
            det.textContent = vod ? "Vodič: " + vod.meno : (o.den === 0 ? "Vodič nie je známy" : "Vodič je známy len pre dnešný deň");
            wrap.appendChild(det);
            row.addEventListener("click", function () {
              _vodOtv[kl] = !_vodOtv[kl];
              var ot = _vsetciVodici || _vodOtv[kl];
              det.style.display = ot ? "block" : "none";
              sip.style.transform = "rotate(" + (ot ? "90deg" : "0deg") + ")";
              sip.setAttribute("aria-expanded", ot ? "true" : "false");
            });
            row.style.cursor = "pointer";
            cont.appendChild(wrap);
            if (isNext) cont._dalsi = wrap;
          });
          if (rezim === "zamer") {
            var d = cont._dalsi;
            cont.scrollTop = d ? Math.max(0, d.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 2 * d.offsetHeight) : 0;
          } else if (rezim === "pred") {
            cont.scrollTop = _staryTop + (cont.scrollHeight - _staraVyska);
          } else {
            cont.scrollTop = _staryTop;
          }
        }
        var _zpet = null;
        function spatNaZoznam() {
          if (_renderInt) { clearInterval(_renderInt); _renderInt = null; }
          staOdchody.innerHTML = "";
          staResults.innerHTML = "";
          if (_zpet && _zpet.childNodes.length) { staResults.appendChild(_zpet); _zpet = null; }
          else if (window._zastavkyDomov) window._zastavkyDomov();
        }
        function vynuluj() {
          if (_renderInt) { clearInterval(_renderInt); _renderInt = null; }
          _zpet = null;
          staInput.value = "";
          staOdchody.innerHTML = "";
          staResults.innerHTML = "";
        }
        window._zastavkyVynuluj = vynuluj;
        async function showOdchody(nazov, kodFilter, grp) {
          if (_renderInt) {
            clearInterval(_renderInt);
            _renderInt = null;
          }
          // zoznam, z ktorého sa zastávka otvorila (obľúbené / výsledky hľadania / zastávky v okolí), si odložíme pre „Späť“
          if (staResults.childNodes.length) {
            _zpet = document.createDocumentFragment();
            while (staResults.firstChild) _zpet.appendChild(staResults.firstChild);
          }
          staResults.innerHTML = "";
          staOdchody.innerHTML =
            '<div style="color:var(--text-3);font-size:15px;padding:8px 0">Načítavam...</div>';
          _vozIdx = {}; // vozidlá sa načítajú nanovo (nová výprava)
          _vodIdx = {}; _vsetciVodici = false; _vodOtv = {};
          var nastSlub = nacitajNast(grp); // súbežne s odchodmi
          var smerSlub = nacitajSmer(grp);
          try {
            _base = await nacitajBase(grp, kodFilter);
          } catch (e) {
            staOdchody.innerHTML = "";
            var chyba = document.createElement("div");
            chyba.style.cssText = "padding:14px 0;text-align:center";
            chyba.innerHTML =
              '<div style="font-size:15px;font-weight:600;color:var(--text-1);margin-bottom:4px">Odchody sa nepodarilo načítať</div>' +
              '<div style="font-size:15px;color:var(--text-3);margin-bottom:12px">Skontroluj pripojenie na internet.</div>';
            var znova = document.createElement("button");
            znova.type = "button";
            znova.textContent = "Skúsiť znova";
            znova.style.cssText =
              "height:38px;padding:0 20px;border-radius:19px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid var(--red);background:var(--red);color:#fff";
            znova.addEventListener("click", function () {
              showOdchody(nazov, kodFilter, grp);
            });
            chyba.appendChild(znova);
            staOdchody.appendChild(chyba);
            return;
          }
          _nastMapa = await nastSlub;
          _smerMapa = await smerSlub;
          _poTyp = {};
          _base.forEach(function (b) { (_poTyp[b.typ] = _poTyp[b.typ] || []).push(b); });
          Object.keys(_poTyp).forEach(function (t) {
            _poTyp[t].sort(function (a, b) { return a.casN - b.casN; });
          });
          staOdchody.innerHTML = "";
          var hdr = document.createElement("div");
          hdr.style.cssText =
            "font-size:15px;font-weight:600;color:var(--text-1);padding:8px 0 6px;border-bottom:1px solid var(--border);margin-bottom:4px";
          hdr.style.display = "flex";
          hdr.style.justifyContent = "space-between";
          hdr.style.alignItems = "center";
          var spat = document.createElement("button");
          spat.type = "button";
          spat.textContent = "\u2039 Späť";
          spat.style.cssText = "border:none;background:transparent;font-size:15px;font-weight:600;padding:4px 8px 4px 0;cursor:pointer;color:var(--red-text);flex:none";
          spat.addEventListener("click", spatNaZoznam);
          hdr.appendChild(spat);
          var hdrNaz = document.createElement("span");
          hdrNaz.style.cssText = "flex:1;min-width:0";
          hdrNaz.textContent = nazov;
          hdr.appendChild(hdrNaz);
          var hviezda = document.createElement("button");
          hviezda.type = "button";
          hviezda.style.cssText = "border:none;background:transparent;font-size:22px;line-height:1;padding:2px 6px;cursor:pointer;color:var(--red-text)";
          var nastavHviezdu = function () {
            var o = jeObluben(grp);
            hviezda.textContent = o ? "\u2605" : "\u2606";
            hviezda.setAttribute("aria-label", o ? "Odstrániť z obľúbených" : "Pridať do obľúbených");
            hviezda.setAttribute("aria-pressed", o ? "true" : "false");
          };
          nastavHviezdu();
          hviezda.addEventListener("click", function () {
            prepniObluben(grp, nazov);
            nastavHviezdu();
          });
          var vodLab = document.createElement("label");
          vodLab.style.cssText = "display:inline-flex;align-items:center;gap:5px;font-size:15px;font-weight:500;color:var(--text-2);margin-right:6px;cursor:pointer;flex:none";
          var vodCb = document.createElement("input");
          vodCb.type = "checkbox";
          vodCb.checked = _vsetciVodici;
          vodCb.addEventListener("change", function () { _vsetciVodici = vodCb.checked; renderRows(""); });
          vodLab.appendChild(vodCb);
          vodLab.appendChild(document.createTextNode("Vodiči"));
          hdr.appendChild(vodLab);
          hdr.appendChild(hviezda);
          staOdchody.appendChild(hdr);
          _fNast = {};
          _fLinka = {};
          _fTyp = {};
          // Dynamické filtre: tlačidlo sa zobrazí, ak je vybrané alebo ak existuje aspoň
          // jeden odchod, ktorý sa s ním zhoduje pri aktuálnom výbere v druhom filte
          // (napr. po výbere nástupišťa 2 sa neukážu linky, ktoré tade nechodia).
          var fWrapN = document.createElement("div"),
            fWrapL = document.createElement("div"),
            fWrapT = document.createElement("div");
          // Filter je skrývací box (ako Výpravňa): predvolene zbalený, v záhlaví je súhrn zapnutých filtrov
          var fOtvoreny = false;
          try {
            fOtvoreny = localStorage.getItem("zastFilterOtvoreny") === "1";
          } catch (e) {}
          var fBox = document.createElement("div");
          fBox.className = "zf-box";
          var fHead = document.createElement("button");
          fHead.type = "button";
          fHead.className = "zf-nadpis";
          var fSumar = document.createElement("span");
          fSumar.className = "zf-sumar";
          var fSipka = document.createElement("span");
          fSipka.className = "zf-sipka";
          fSipka.textContent = "\u25BC";
          var fNaz = document.createElement("span");
          fNaz.className = "zf-naz";
          fNaz.textContent = "FILTER";
          fHead.appendChild(fNaz);
          fHead.appendChild(fSumar);
          fHead.appendChild(fSipka);
          var fTelo = document.createElement("div");
          fTelo.className = "zf-telo";
          var fZrus = document.createElement("button");
          fZrus.type = "button";
          fZrus.className = "zf-zrus";
          fZrus.textContent = "Zrušiť filtre";
          fTelo.appendChild(fWrapN);
          fTelo.appendChild(fWrapL);
          fTelo.appendChild(fWrapT);
          fTelo.appendChild(fZrus);
          fBox.appendChild(fHead);
          fBox.appendChild(fTelo);
          staOdchody.appendChild(fBox);
          function nastavBox() {
            fBox.classList.toggle("otvorena", fOtvoreny);
            fHead.setAttribute("aria-expanded", fOtvoreny ? "true" : "false");
          }
          fHead.addEventListener("click", function () {
            fOtvoreny = !fOtvoreny;
            try {
              localStorage.setItem("zastFilterOtvoreny", fOtvoreny ? "1" : "0");
            } catch (e) {}
            nastavBox();
          });
          fZrus.addEventListener("click", function () {
            [_fNast, _fLinka, _fTyp].forEach(function (st) {
              Object.keys(st).forEach(function (k) {
                st[k] = false;
              });
            });
            obnovFiltre();
            renderRows("zamer");
          });
          function sumarFiltrov() {
            var casti = [];
            var n = Object.keys(_fNast).filter(function (k) { return _fNast[k]; }).map(nastLabel);
            var l = Object.keys(_fLinka).filter(function (k) { return _fLinka[k]; });
            var t = Object.keys(_fTyp).filter(function (k) { return _fTyp[k]; });
            if (n.length) casti.push("Nást. " + n.join(", "));
            if (l.length) casti.push("Linka " + l.join(", "));
            if (t.length) casti.push(t.map(typLabel).join(", "));
            fSumar.textContent = casti.join(" \u00B7 ");
            fBox.classList.toggle("aktivny", casti.length > 0);
          }
          nastavBox();
          function vykresliFilter(wrap, popis, pole, stav) {
            // názov filtra je ukotvený vľavo, posúvajú sa len tlačidlá; pri prekreslení sa drží poloha posunu
            var predch = wrap.querySelector(".zast-filter");
            var posun = predch ? predch.scrollLeft : 0;
            wrap.innerHTML = "";
            var u = {};
            _base.forEach(function (o) {
              if (sedi(o, pole)) u[o[pole]] = 1;
            });
            Object.keys(stav).forEach(function (h) {
              if (stav[h]) u[h] = 1;
            });
            var hodnoty = Object.keys(u).sort(function (x, y) {
              if (pole === "nast") return nastPorovnaj(x, y);
              return pole === "linka" ? cisloLinky(x) - cisloLinky(y) : parseInt(x) - parseInt(y);
            });
            if (!hodnoty.length) return;
            wrap.style.cssText =
              "display:flex;align-items:center;gap:8px;flex-wrap:nowrap;padding:6px 0 2px";
            var lbl = document.createElement("span");
            lbl.style.cssText =
              "font-size:15px;color:var(--text-3);min-width:68px;flex:none";
            lbl.textContent = popis;
            wrap.appendChild(lbl);
            var scr = document.createElement("div");
            scr.className = "zast-filter";
            scr.style.cssText =
              "display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow-x:auto";
            wrap.appendChild(scr);
            // Predvolený stav: všetky nástupištia a linky sú zapnuté (= bez filtra); typ dňa = ten z kalendára.
            var ziadny = !nieco(stav);
            var predvolenyTyp = pole === "typ" ? String(typDna(0)) : null;
            hodnoty.forEach(function (h) {
              var vsetko = ziadny && pole !== "typ"; // „všetko zapnuté“ – jemnejšie zvýraznenie
              var on = pole === "typ" ? (ziadny ? h === predvolenyTyp : !!stav[h]) : ziadny || !!stav[h];
              var btn = document.createElement("button");
              btn.type = "button";
              btn.style.cssText =
                "flex:none;min-width:44px;height:34px;padding:0 14px;border-radius:17px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid " +
                (on ? "var(--red)" : "var(--border)") +
                ";background:" +
                (on ? (vsetko ? "var(--red-soft)" : "var(--red)") : "transparent") +
                ";color:" +
                (on ? (vsetko ? "var(--red-text)" : "#fff") : "var(--text-2)");
              btn.setAttribute("aria-pressed", on ? "true" : "false");
              btn.textContent = pole === "nast" ? nastLabel(h) : pole === "typ" ? typLabel(h) : h;
              btn.addEventListener("click", function () {
                var vymaz = function () {
                  Object.keys(stav).forEach(function (k) {
                    delete stav[k];
                  });
                };
                if (pole === "typ") {
                  // jeden typ dňa naraz; znovu ťuknutie na zvolený = späť na typ z kalendára
                  if (stav[h]) vymaz();
                  else if (ziadny && h === predvolenyTyp) return;
                  else {
                    vymaz();
                    stav[h] = true;
                  }
                } else if (ziadny) {
                  vymaz();
                  stav[h] = true; // zo „všetko“ ťuknutím vyberieš len tento
                } else {
                  stav[h] = !stav[h];
                  if (!stav[h]) delete stav[h];
                }
                obnovFiltre();
                renderRows("zamer");
              });
              scr.appendChild(btn);
            });
            scr.scrollLeft = posun;
          }
          function obnovFiltre() {
            vykresliFilter(fWrapN, "Nástupište", "nast", _fNast);
            vykresliFilter(fWrapL, "Linka", "linka", _fLinka);
            vykresliFilter(fWrapT, "Typ dňa", "typ", _fTyp);
            sumarFiltrov();
          }
          obnovFiltre();
          _predPocet = 5;
          _poPocet = 10;
          function tlacidloOkna(text, krok) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = text;
            b.style.cssText =
              "display:block;width:100%;margin:8px 0;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text-1);font-size:15px;font-weight:600;cursor:pointer";
            b.addEventListener("click", krok);
            return b;
          }
          _btnPred = tlacidloOkna("Predchádzajúce odchody", function () {
            _predPocet += 10;
            renderRows("pred");
          });
          _btnPo = tlacidloOkna("Nasledujúce odchody", function () {
            _poPocet += 10;
            renderRows();
          });
          staOdchody.appendChild(_btnPred);
          var cont = document.createElement("div");
          cont.id = "_zastavkyRows";
          staOdchody.appendChild(cont);
          staOdchody.appendChild(_btnPo);
          renderRows("zamer");
          _renderInt = setInterval(function () { renderRows(); }, 60000);
        }
        // ---- Obľúbené, naposledy použité a blízke zastávky (len v tomto zariadení: localStorage)
        function lsCitaj(k) {
          try {
            var v = JSON.parse(localStorage.getItem(k) || "[]");
            return Array.isArray(v) ? v : [];
          } catch (e) {
            return [];
          }
        }
        function lsZapis(k, v) {
          try {
            localStorage.setItem(k, JSON.stringify(v));
          } catch (e) {}
        }
        function jeObluben(g) {
          return lsCitaj("zastObl").some(function (x) { return x.g === g; });
        }
        function prepniObluben(g, n) {
          var l = lsCitaj("zastObl");
          var i = l.findIndex(function (x) { return x.g === g; });
          if (i >= 0) l.splice(i, 1);
          else l.unshift({ g: g, n: n });
          lsZapis("zastObl", l.slice(0, 20));
        }
        // História („Naposledy“) sa už neukladá; starý záznam sa zmaže
        try { localStorage.removeItem("zastNaposledy"); } catch (e) {}
        function otvorZastavku(g, n) {
          showOdchody(n, function (kod) { return kod.substring(0, 4) === g; }, g);
        }
        function riadokVyberu(g, n, vedlajsi) {
          var div = document.createElement("div");
          div.style.cssText =
            "display:flex;justify-content:space-between;gap:10px;font-size:15px;font-weight:500;color:var(--text-1);cursor:pointer;padding:9px 0;border-bottom:1px solid var(--border)";
          var a = document.createElement("span");
          a.textContent = n;
          div.appendChild(a);
          if (vedlajsi) {
            var b = document.createElement("span");
            b.style.cssText = "font-size:15px;color:var(--text-3);flex:none;align-self:center";
            b.textContent = vedlajsi;
            div.appendChild(b);
          }
          div.addEventListener("click", function () { otvorZastavku(g, n); });
          return div;
        }
        function nadpisSkupiny(t) {
          var h = document.createElement("div");
          h.style.cssText = "font-size:15px;font-weight:800;letter-spacing:1px;color:var(--text-3);padding:12px 0 2px";
          h.textContent = t;
          return h;
        }
        function vzdialenost(a, b) {
          var dy = (a.lat - b.lat) * 111320,
            dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
          return Math.hypot(dx, dy);
        }
        async function ukazBlizke(kam) {
          kam.innerHTML = '<div style="color:var(--text-3);font-size:15px;padding:6px 0">Zisťujem polohu...</div>';
          if (!navigator.geolocation) {
            kam.innerHTML = '<div style="color:var(--text-3);font-size:15px;padding:6px 0">Poloha nie je v tomto zariadení dostupná.</div>';
            return;
          }
          navigator.geolocation.getCurrentPosition(
            async function (pos) {
              var sta = await getStanice();
              if (!sta) return;
              var ja = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              var bl = Object.keys(sta.groups)
                .filter(function (g) { return sta.groups[g].pos; })
                .map(function (g) { return { g: g, n: sta.groups[g].nazov, d: vzdialenost(ja, sta.groups[g].pos) }; })
                .sort(function (x, y) { return x.d - y.d; })
                .slice(0, 8);
              kam.innerHTML = "";
              bl.forEach(function (z) {
                kam.appendChild(riadokVyberu(z.g, z.n, z.d < 1000 ? Math.round(z.d / 10) * 10 + " m" : (z.d / 1000).toFixed(1).replace(".", ",") + " km"));
              });
            },
            function () {
              kam.innerHTML =
                '<div style="color:var(--text-3);font-size:15px;padding:6px 0">Polohu sa nepodarilo zistiť (povoľ ju v prehliadači; v nezabezpečenom spojení http ju prehliadač nedovolí).</div>';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
          );
        }
        // Domovský pohľad vyhľadávania: obľúbené, naposledy použité a tlačidlo „Zastávky v okolí“
        function ukazDomov() {
          if (staOdchody.innerHTML) return; // práve je otvorená nejaká zastávka
          staResults.innerHTML = "";
          var obl = lsCitaj("zastObl");
          if (obl.length) {
            staResults.appendChild(nadpisSkupiny("\u2605 OBĽÚBENÉ"));
            obl.forEach(function (x) { staResults.appendChild(riadokVyberu(x.g, x.n)); });
          }
          staResults.appendChild(nadpisSkupiny("BLÍZKO"));
          var kamBlizke = document.createElement("div");
          var tl = document.createElement("button");
          tl.type = "button";
          tl.textContent = "Zastávky v okolí";
          tl.style.cssText =
            "width:100%;margin-top:4px;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text-1);font-size:15px;font-weight:600;cursor:pointer";
          tl.addEventListener("click", function () {
            ukazBlizke(kamBlizke);
            tl.style.display = "none";
          });
          kamBlizke.appendChild(tl);
          staResults.appendChild(kamBlizke);
        }
        window._zastavkyDomov = ukazDomov;
        async function doSearch(val) {
          staResults.innerHTML =
            '<div style="color:var(--text-3);font-size:15px">Hľadám...</div>';
          staOdchody.innerHTML = "";
          if (_renderInt) {
            clearInterval(_renderInt);
            _renderInt = null;
          }
          var sta = await getStanice();
          if (!sta) {
            staResults.innerHTML =
              '<div style="color:var(--red);font-size:15px">Chyba</div>';
            return;
          }
          var q = stripDia(val);
          var matches = Object.keys(sta.groups)
            .filter(function (g) {
              return stripDia(sta.groups[g].nazov).indexOf(q) >= 0;
            })
            .map(function (g) {
              return { grp: g, nazov: sta.groups[g].nazov };
            });
          if (!matches.length) {
            staResults.innerHTML =
              '<div style="color:var(--text-3);font-size:15px;padding:4px 0">Nič nenájdené</div>';
            return;
          }
          staResults.innerHTML = "";
          matches.slice(0, 8).forEach(function (m) {
            var div = document.createElement("div");
            div.style.cssText =
              "font-size:15px;font-weight:500;color:var(--text-1);cursor:pointer;padding:8px 0;border-bottom:1px solid var(--border)";
            div.textContent = m.nazov;
            div.addEventListener(
              "click",
              (function (g, n) {
                return function () {
                  showOdchody(n, function (kod) {
                    return kod.substring(0, 4) === g;
                  }, g);
                };
              })(m.grp, m.nazov),
            );
            staResults.appendChild(div);
          });
        }
        window._zastavkyTest = { nacitajBase: nacitajBase, getStanice: getStanice, vozidloOdchodu: vozidloOdchodu };
        var _timer = null;
        staInput.addEventListener("input", function () {
          clearTimeout(_timer);
          var v = this.value.trim();
          if (v.length < 2) {
            staResults.innerHTML = "";
            staOdchody.innerHTML = "";
            if (_renderInt) {
              clearInterval(_renderInt);
              _renderInt = null;
            }
            ukazDomov();
            return;
          }
          _timer = setTimeout(function () {
            doSearch(v);
          }, 300);
        });
        var cpClose = document.getElementById("cpClose");
        if (cpClose)
          cpClose.addEventListener("click", function () {
            vynuluj();
            // po zatvorení okna sa spodné menu vráti na záložku, ktorej obsah je naozaj vidieť
            var skryty = function (id) {
              var e = document.getElementById(id);
              return !e || e.classList.contains("hidden");
            };
            var aktivna = !skryty("burzaView") ? "burza" : !skryty("profilView") ? "profil" : "today";
            document.querySelectorAll(".bottom-nav button").forEach(function (b) {
              b.classList.toggle("active", b.dataset.nav === aktivna);
            });
          });
      })();
    