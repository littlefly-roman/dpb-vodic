
      (function () {
        var _drivers = {};
        var _models = {};
        var _trakcie = {}; // rid -> kód TYPDOPRAVY z CSV
        var _volne = []; // voľné služby pre Burzu (js/data/volne-sluzby.js)
        var _volneVerzia = 0;

        function fmt(t) {
          if (!t) return "";
          var p = t.split(":");
          return parseInt(p[0]) + ":" + p[1];
        }
        function fmtRange(od, do_) {
          if (!od) return "";
          return fmt(od) + " – " + fmt(do_);
        }

        function getDrivers() {
          return Object.entries(_drivers)
            .map(function (e) {
              return { rid: e[0], meno: e[1] };
            })
            .filter(function (d) {
              return d.meno && d.meno.trim() && d.meno !== "1 A";
            })
            .sort(function (a, b) {
              return a.meno.localeCompare(b.meno, "sk");
            });
        }
        // Rozsah dní, ktoré export pre trakciu vodiča vôbec pokrýva (od najstaršieho po najnovší deň v dátach)
        var _rozsahCache = {};
        function rozsahDat(rid) {
          var tk = _trakcie[rid] || "";
          if (_rozsahCache[tk]) return _rozsahCache[tk];
          var od = null, doo = null;
          Object.keys(_models).forEach(function (r) {
            if ((_trakcie[r] || "") !== tk) return;
            (_models[r] || []).forEach(function (d) {
              if (!d || !d.datum) return;
              if (od === null || d.datum < od) od = d.datum;
              if (doo === null || d.datum > doo) doo = d.datum;
            });
          });
          return (_rozsahCache[tk] = { od: od, do: doo });
        }
        // true, ak pre daný deň nie sú v dátach žiadne údaje (deň je mimo rozsahu exportu pre trakciu vodiča)
        function jeMimoDat(rid, dateKey) {
          var r = rozsahDat(rid);
          if (!r.od || !r.do) return false;
          return dateKey < r.od || dateKey > r.do;
        }
        function getServicesForDate(rid, dateKey) {
          var model = _models[rid];
          if (!model) return [];
          var den = model.find(function (d) {
            return d.datum === dateKey;
          });
          if (!den || !den.karty) return [];
          return den.karty.map(function (k) {
            var line =
              k.vzor === "NEPRÍTOMNOSŤ" ? k.popis || k.vzor : k.kurz || k.vzor;
            if (window.DpbNazvy && (k.vzor === "POHOTOVOSŤ" || k.vzor === "TRKR"))
              line = window.DpbNazvy.nazovSluzby(line);
            return {
              _vzor: k.vzor,
              _karta: k,
              line: line,
              time: k.od && k.do ? fmt(k.od) + " – " + fmt(k.do) : "",
              route:
                k.stan_od && k.stan_do ? k.stan_od + " – " + k.stan_do : "",
              vehicle:
                (k.vozidla && k.vozidla.length ? k.vozidla[0].cislo : null) ||
                "—",
              linka: k.kurz ? k.kurz.split("/")[0] : "",
              kurz: k.kurz ? k.kurz.split("/")[1] : "",
              before: k.pred ? { name: k.pred.meno, phone: null } : null,
              after: k.nasl ? { name: k.nasl.meno, phone: null } : null,
              zacvik: k.zacvikVedie && k.zacvikVedie.length
                ? { rola: "vedie", mena: k.zacvikVedie.map(function (z) { return z.meno; }) }
                : k.zacvikSkym
                  ? { rola: "skym", mena: [k.zacvikSkym.meno] }
                  : null,
              date: dateKey,
            };
          });
        }
        function getDatesWithService(rid) {
          var model = _models[rid];
          if (!model) return new Set();
          return new Set(
            model
              .filter(function (d) {
                return d.karty && d.karty.length > 0;
              })
              .map(function (d) {
                return d.datum;
              }),
          );
        }
        function _replaceRAW(nd, nm, nt, nv) {
          // Voľné služby: dni, ktoré export pokrýva, sa nahradia novými; ostatné dni ostanú
          if (nv && nv.volne) {
            var dni = {};
            (nv.volneDni || []).forEach(function (d) { dni[d] = 1; });
            _volne = _volne.filter(function (x) { return !dni[x.dateKey]; }).concat(nv.volne);
            _volneVerzia++;
          }
          _rozsahCache = {};
          if (nt) Object.keys(nt).forEach(function (r) { _trakcie[r] = nt[r]; });
          Object.keys(nd).forEach(function (r) {
            _drivers[r] = nd[r];
          });
          Object.keys(nm).forEach(function (r) {
            if (!_models[r]) _models[r] = [];
            nm[r].forEach(function (d) {
              var idx = _models[r].findIndex(function (x) {
                return x.datum === d.datum;
              });
              if (idx >= 0) _models[r][idx] = d;
              else _models[r].push(d);
            });
          });
          window.RAW = { drivers: _drivers, models: _models };
          if (window.appState) {
            window.appState.servicesByDate = {};
          }
        }

        window.RAW = { drivers: _drivers, models: _models };
        window.DPBData = {
          getDrivers: getDrivers,
          getServicesForDate: getServicesForDate,
          jeMimoDat: jeMimoDat,
          rozsahDat: rozsahDat,
          getDatesWithService: getDatesWithService,
          fmt: fmt,
          fmtRange: fmtRange,
          _replaceRAW: _replaceRAW,
          getTrakciaKod: function (rid) { return _trakcie[rid] || null; },
          getVolneSluzby: function () { return _volne.slice(); },
          getVolneVerzia: function () { return _volneVerzia; },
        };
      })();
    