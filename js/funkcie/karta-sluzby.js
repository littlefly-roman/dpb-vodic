
      (function () {
        function phoneBtn() {
          const b = document.createElement("button");
          b.className = "drv-phone-btn";
          b.title = "Zavolať";
          b.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93 19.79 19.79 0 0 1 1.61 3.3 2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7A16 16 0 0 0 14 15.76l.94-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>';
          return b;
        }

        function driverRow(data, side) {
          if (!data) return null;
          const s = document.createElement("div");
          s.className = "driver-section " + side;
          const ar = document.createElement("span");
          ar.className = "arrow";
          ar.textContent = "↓";
          const nm = document.createElement("span");
          nm.style.flex = "1";
          nm.style.fontWeight = "600";
          nm.textContent = data.name;
          s.appendChild(ar);
          s.appendChild(nm);
          // Telefón len ak je k vodičovi číslo (zatiaľ nikto nemá, súhlas so zobrazením sa rieši);
          // keď číslo pribudne, ikona sa objaví sama a ťuk zavolá.
          if (data.phone) {
            const pb = phoneBtn();
            pb.addEventListener("click", function (e) {
              e.stopPropagation();
              window.location.href = "tel:" + String(data.phone).replace(/\s/g, "");
            });
            s.appendChild(pb);
          }
          return s;
        }

        function menuBtn() {
          const b = document.createElement("div");
          b.className = "card-menu-btn service-menu-trigger";
          b.innerHTML =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
          return b;
        }

        function addRow(parent, cls, txt) {
          if (!txt) return null;
          const d = document.createElement("div");
          d.className = cls;
          d.textContent = txt;
          parent.appendChild(d);
          return d;
        }

        // Ikony pred riadkami karty (úplne vľavo): hodiny, poloha, druh vozidla
        var SVG_IK = {
          cas: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
          poloha: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
          elektricka: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
          autobus: '<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>',
          trolejbus: '<rect width="16" height="13" x="4" y="8" rx="2"/><path d="M4 14h16"/><path d="M8 18h.01"/><path d="M16 18h.01"/><path d="M6 21v1"/><path d="M18 21v1"/><path d="M10 8 7 2"/><path d="M14 8l-3-6"/>',
        };
        function pridajIkonu(riadok, druh) {
          if (!riadok || !SVG_IK[druh]) return;
          riadok.classList.add("s-ikonou");
          var i = document.createElement("span");
          i.className = "card-ic";
          i.setAttribute("aria-hidden", "true");
          if (druh === "elektricka" || druh === "autobus" || druh === "trolejbus") {
            // rovnaké siluety vozidiel ako pri animácii loga v úvode
            i.innerHTML = '<span class="card-ic-voz druh-' + druh + '" style="--ik:url(img/doprava/' + druh + '.png)"></span>';
          } else
          i.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            SVG_IK[druh] + "</svg>";
          riadok.insertBefore(i, riadok.firstChild);
        }
        // Druh vozidla podľa čísla: 7xxx električky, 6xxx trolejbusy, ostatné autobusy;
        // fiktívne vozy 5000 a 7000 bez ikony.
        function druhVozidla(cislo) {
          var c = String(cislo || "").trim();
          if (!/^\d{4}$/.test(c) || c === "5000" || c === "7000") return null;
          if (c[0] === "7") return "elektricka";
          if (c[0] === "6") return "trolejbus";
          return "autobus";
        }

        // Časy „od – do“ zarovnané podľa pomlčky: začiatok doprava, koniec doľava (riadky pod sebou)
        function zarovnajCas(el, txt) {
          var p = String(txt || "").split(/\s*[–-]\s*/);
          if (p.length !== 2) { el.textContent = txt; return; }
          var a = document.createElement("span"); a.className = "cas-od"; a.textContent = p[0];
          var m = document.createElement("span"); m.className = "cas-pom"; m.textContent = "–";
          var b = document.createElement("span"); b.className = "cas-do"; b.textContent = p[1];
          el.textContent = ""; el.appendChild(a); el.appendChild(m); el.appendChild(b);
        }

        function buildSegList(segs) {
          const wrap = document.createElement("div");
          wrap.className = "seg-section";
          const list = document.createElement("div");
          list.className = "seg-list";
          segs.forEach((s) => {
            const row = document.createElement("div");
            row.className = "seg-row";
            const k = document.createElement("span");
            k.className = "seg-kurz" + (s.dim ? " dim" : "");
            k.textContent = s.kurz;
            k.addEventListener("click", (e) => {
              e.stopPropagation();
              window.openGrafikonKurz(
                s.kurz,
                s.od || null,
                s.do_ || null,
                s.voz,
              );
            });
            const c = document.createElement("span");
            c.className = "seg-cas";
            zarovnajCas(c, s.cas);
            row.appendChild(k);
            row.appendChild(c);
            if (s.voz) {
              const v = document.createElement("span");
              v.className = "seg-voz";
              v.textContent = s.voz;
              row.appendChild(v);
            }
            list.appendChild(row);
          });
          wrap.appendChild(list);
          return wrap;
        }

        function buildStrList(kurzy, service) {
          const list = document.createElement("div");
          list.className = "str-list";

          kurzy.forEach((k, i) => {
            const row = document.createElement("div");
            row.className = "str-row";
            const main = document.createElement("div");
            main.className = "str-main";

            const sk = document.createElement("span");
            sk.className = "str-kurz";
            sk.textContent = k.kurz;
            sk.addEventListener("click", (e) => {
              e.stopPropagation();
              window.openGrafikonKurz(
                k.kurz,
                k.prebera,
                k.odovzdava,
                k.vozidlo,
                k.prebera + " – " + k.odovzdava,
              );
            });

            const sc = document.createElement("span");
            sc.className = "str-cas";
            zarovnajCas(sc, DPBData.fmt(k.prebera) + " – " + DPBData.fmt(k.odovzdava));

            const sv = document.createElement("span");
            sv.className = "str-chevron";
            sv.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

            main.appendChild(sk);
            // Vozidlo (ak je) hneď v riadku, medzi kurzom a časom
            if (k.vozidlo) {
              const sz = document.createElement("span");
              sz.className = "str-voz";
              sz.textContent = k.vozidlo;
              main.appendChild(sz);
            }
            main.appendChild(sc);
            main.appendChild(sv);
            if (window.DpbPrestavka && !k.trasa) {
              var _pi = window.DpbPrestavka.ikona(service, k);
              if (_pi) main.appendChild(_pi);
            }
            main.addEventListener("click", () => row.classList.toggle("open"));

            const det = document.createElement("div");
            det.className = "str-detail" + (k.trasa ? " hrad" : "");
            if (k.trasa && (k.grafOd || k.grafDo) && window.DpbStretnutia && window.DpbStretnutia.miesto && k.datum) {
              window.DpbStretnutia.miesto(k.kurz, k.datum, k.prebera, k.odovzdava).then(function (m) {
                if (!m) return;
                var t = det.querySelector(".str-detail-voz");
                if (!t) return;
                t.textContent = [k.grafOd && m.od ? m.od : k.stanOd, k.grafDo && m.do ? m.do : k.stanDo].filter(Boolean).join("\n");
              }).catch(function () {});
            }
            det.innerHTML =
              (k.trasa ? '<span class="str-detail-voz">' + k.trasa + "</span>" : "") +
              '<span class="str-detail-meno">' +
              (k.ridic || "—") +
              "</span>";
            row.appendChild(main);
            row.appendChild(det);
            list.appendChild(row);
          });
          return list;
        }

        // Živé prepínanie menu podľa času (začiatok/koniec služby)
        const _menuKarty = new Set();
        let _menuBudik = null;
        function _naplanujMenu() {
          clearTimeout(_menuBudik);
          const n = new Date();
          const teraz = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
          const sek = function (t) {
            const q = String(t).split(":");
            return parseInt(q[0], 10) * 3600 + parseInt(q[1] || 0, 10) * 60;
          };
          let najblizsie = null;
          _menuKarty.forEach(function (c) {
            const kk = (c._menuSluzba && c._menuSluzba._karta) || {};
            if (!c.isConnected || !kk.od || !kk.do) return;
            [sek(kk.od), sek(kk.do)].forEach(function (t) {
              if (t > teraz && (najblizsie === null || t < najblizsie)) najblizsie = t;
            });
          });
          if (najblizsie === null) return;
          // +2 s rezerva, aby čas už určite bol za hranicou
          const ms = Math.min((najblizsie - teraz) * 1000 + 2000, 2147000000);
          _menuBudik = setTimeout(_obnovMenu, ms);
        }
        let _menuCaka = false;
        function _obnovMenu() {
          _menuCaka = false;
          _menuKarty.forEach(function (c) {
            if (!c.isConnected) return _menuKarty.delete(c);
            const m = c._menuEl;
            if (m && m.classList.contains("active")) { _menuCaka = true; return; } // otvorené menu nemeníme
            attachMenu(c, c._menuMb, c._menuSluzba);
          });
          _naplanujMenu();
        }
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) _obnovMenu();
        });
        // otvorené menu sa prepne po zatvorení, nie hneď
        document.addEventListener("click", function () {
          if (_menuCaka) setTimeout(_obnovMenu, 400);
        }, true);

        function attachMenu(card, mb, service) {
          if (card._menuEl) {
            card._menuEl.remove();
            mb.removeEventListener("click", card._menuToggle);
            card._menuEl = null;
          }
          const k = service._karta || {},
            vzor = k.vzor || "";
          const datum = service.date || "",
            today = window.DpbCas
              ? window.DpbCas.formatDateKey(new Date())
              : "";
          let isPast = datum < today;
          const isFuture = datum > today;
          let isToday = datum === today;
          const items = [];
          // Služba práve prebieha (dnes, medzi začiatkom a koncom) -> bez zmeny stavu a zmeny služby
          var prebieha = false;
          if (isToday && k.od && k.do) {
            var _m = function (t) {
              var q = String(t).split(":");
              return parseInt(q[0], 10) * 60 + parseInt(q[1] || 0, 10);
            };
            var _od = _m(k.od), _do = _m(k.do), _n = new Date();
            var _now = _n.getHours() * 60 + _n.getMinutes();
            if (_do <= _od) _do += 1440;
            prebieha = _now >= _od && _now < _do;
            // Po skončení služby sa menu správa ako pre minulý deň
            if (_now >= _do && _do > _od && _do <= 1440) { isPast = true; isToday = false; }
          }
          if (
            ["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].includes(vzor)
          )
            items.push({ action: "grafikon", label: "Grafikon" });
          if (isToday && vzor === "SLUŽBA" && /^[1349]\//.test(k.kurz || ""))
            items.push({ action: "stretnutia", label: "Koho stretnem" });
          if (isPast) {
            items.push({ action: "reklamacia", label: "Reklamácia" });
          } else if (isToday) {
            if (vzor === "NEPRÍTOMNOSŤ")
              items.push({ action: "zmena_stavu", label: "Zmena stavu" });
            else if (["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].includes(vzor)) {
              // Dnes: Grafikon, Zmena stavu, porucha vozidla (len ak je vozidlo), udalosť, zmena služby
              if (!prebieha)
                items.push({ action: "zmena_stavu_sluzba", label: "Zmena stavu" });
              items.push({ action: "nahlasit", label: "Nahlásiť" });
              if (!prebieha)
                items.push({ action: "zmena_sluzby", label: "Zmena služby" });
            } else if (!k.kod || k.kod === 0)
              items.push({
                action: "ziadost_sluzba",
                label: "Žiadosť o službu",
              });
            else
              items.push({
                action: "nepritomnost",
                label: "Nahlásiť neprítomnosť",
              });
          } else if (isFuture) {
            if (vzor === "NEPRÍTOMNOSŤ")
              items.push({ action: "zmena_stavu", label: "Zmena stavu" });
            else if (["SLUŽBA", "944", "STRIEDAČ", "POHOTOVOSŤ", "TRKR"].includes(vzor)) {
              // Budúcnosť: Grafikon, Zmena stavu, Zmena služby (+ kalendár)
              items.push({ action: "zmena_stavu_sluzba", label: "Zmena stavu" });
              items.push({ action: "zmena_sluzby", label: "Zmena služby" });
            } else if (!k.kod || k.kod === 0)
              items.push({
                action: "ziadost_sluzba",
                label: "Žiadosť o službu",
              });
            else {
              items.push({ action: "dovolenka", label: "Žiadosť o dovolenku" });
              items.push({ action: "volno", label: "Žiadosť o voľno" });
              items.push({ action: "lekar", label: "Nahlásiť lekára" });
              items.push({ action: "ine_ziadost", label: "Iná žiadosť" });
              items.push({ action: "zmena_sluzby", label: "Zmena služby" });
            }
          }
          // Export do kalendára je len zo zoznamu služieb (tlačidlo Export), nie z menu karty.
          if (!items.length) return;
          const menu = document.createElement("div");
          menu.className = "service-menu";
          items.forEach(function (it) {
            const div = document.createElement("div");
            div.className = "menu-item";
            div.dataset.action = it.action;
            div.textContent = it.label;
            menu.appendChild(div);
          });
          const cd = document.createElement("div");
          cd.className = "menu-item menu-item-cancel";
          cd.textContent = "Zrušiť";
          menu.appendChild(cd);
          card.appendChild(menu);
          function toggle(e) {
            e.stopPropagation();
            const was = menu.classList.contains("active");
            window._closeAllGlobal && window._closeAllGlobal();
            if (!was) {
              menu.classList.add("active");
              card.classList.add("menu-open");
              mb.classList.add("open");
            }
          }
          mb.addEventListener("click", toggle);
          card._menuEl = menu;
          card._menuToggle = toggle;
          card._menuMb = mb;
          card._menuSluzba = service;
          _menuKarty.add(card);
          clearTimeout(card._menuPlan);
          card._menuPlan = setTimeout(_naplanujMenu, 0);
          cd.addEventListener("click", function (e) {
            e.stopPropagation();
            window._closeAllGlobal && window._closeAllGlobal();
          });
          menu
            .querySelectorAll(".menu-item:not(.menu-item-cancel)")
            .forEach(function (item) {
              item.addEventListener("click", function (e) {
                e.stopPropagation();
                const act = item.dataset.action;
                if (act === "grafikon")
                  window._openGrafikon && window._openGrafikon(service);
                else if (act === "kal_google") window.DpbExport.kartaGoogle(service);
                else if (act === "kal_ics") window.DpbExport.kartaIcs(service);
                else if (act === "stretnutia")
                  window.DpbMiniGrafikon.stretnutia(k.kurz, service.date, k.od, k.do, "");
                else if (act === "nahlasit")
                  window.DpbNahlasit.otvor({ date: service.date, service: service });
                else if (act === "reklamacia")
                  window.DpbReklamacia.otvor({ date: service.date, service: service });
                else if (act === "zmena_sluzby" || act === "ziadost_sluzba")
                  window.DpbZiadostSluzby.otvor({ date: service.date, service: service, zmena: act === "zmena_sluzby" });
                else if (act === "zmena_stavu_sluzba" || act === "zmena_stavu")
                  window.DpbZmenaStavu.otvor({ date: service.date, service: service });
                else if (
                  ["nepritomnost", "ine_ziadost", "zmena_sluzby"].includes(act)
                )
                  window._showZiadostModal &&
                    window._showZiadostModal(act, service);
                else window._showToast && window._showToast("Pripravuje sa");
                window._closeAllGlobal && window._closeAllGlobal();
              });
            });
        }

        window.openGrafikonKurz = function (
          kurzStr,
          od,
          do_,
          vozidlo,
          strOd,
          strDo,
          typ,
          zCP,
        ) {
          const parts = (kurzStr || "").split("/");
          const linka = parseInt(parts[0]) || 0;
          const kurz = parseInt(parts[1]) || 0;
          if (!linka || !kurz) {
            window._showToast &&
              window._showToast("Grafikon pre túto službu nie je dostupný");
            return;
          }
          window._openGrafikon &&
            window._openGrafikon({
              line: kurzStr,
              linka,
              kurz,
              vehicle: vozidlo || "—",
              time: (od || "") + " – " + (do_ || ""),
              strTime: strOd || "",
              typ: typ || null,
              zCP: !!zCP,
              route: "",
              before: null,
              after: null,
            });
        };

        window.buildNewCard = function (service) {
          const k = service._karta;
          const vzor = service._vzor;
          const card = document.createElement("div");
          card.className = "service-card";

          function addTitle(parent, txt) {
            if (!txt) return;
            const d = document.createElement("div");
            d.className = "card-title";
            d.textContent = txt;
            d.addEventListener("click", (e) => {
              e.stopPropagation();
              // Build strTime from prestávka
              var _prs = k.prestávka && k.prestávka.length ? k.prestávka : [];
              var _strTime = _prs
                .map(function (p) {
                  return p.prebera + " – " + p.odovzdava;
                })
                .join("|");
              window.openGrafikonKurz(
                k.kurz,
                k.od,
                k.do,
                (k.vozidla && k.vozidla.length ? k.vozidla[0].cislo : null) ||
                  null,
                _strTime || null,
              );
            });
            parent.appendChild(d);
          }

          const bef = driverRow(service.before, "before");
          if (bef) card.appendChild(bef);

          const body = document.createElement("div");
          body.className = "card-body";
          const head = document.createElement("div");
          head.className = "card-head";
          const spacer = document.createElement("div");
          spacer.className = "card-spacer";
          const center = document.createElement("div");
          center.className = "card-center";
          const mb = menuBtn();
          head.appendChild(spacer);
          head.appendChild(center);
          head.appendChild(mb);

          if (vzor === "NEPRÍTOMNOSŤ") {
            card.classList.add("je-nepritomnost");
            addTitle(center, k.kurz || "—");
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
            addRow(center, "card-route card-nepritomnost", k.popis || "");
          } else if (vzor === "TRKR") {
            const _vp = window.DpbNazvy && window.DpbNazvy.vypravca(k.kurz);
            const lbl = document.createElement("div");
            lbl.className = "card-label";
            lbl.textContent = _vp ? "Výpravňa " + _vp.miesto : "Výpravca";
            center.appendChild(lbl);
            addTitle(center, _vp ? _vp.nazov : k.kurz);
            if (_vp) center.lastChild.classList.add("card-title-md");
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
          } else if (vzor === "944") {
            addTitle(center, k.kurz);
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
            if (k.stan_od && k.stan_do) {
              const rw = document.createElement("div");
              rw.className = "card-route-wrap";
              rw.innerHTML = `<span class="card-route-od">${k.stan_od}</span><span class="card-route-do">${k.stan_do}</span>`;
              pridajIkonu(rw, "poloha");
              center.appendChild(rw);
            }
            // vozidlo 944: od prvého výskytu na 944/x po koniec posledného úseku vrátane hradení tým istým vodičom
            (function () {
              var zdroj = (k.vozidla || []).concat(
                (k.hradenia || []).reduce(function (a, h) { return a.concat(h.vozidla || []); }, []),
              );
              var poradie = [], mapa = {};
              zdroj.forEach(function (v) {
                var c = String(v.cislo);
                if (!mapa[c]) { mapa[c] = { cislo: c, od: v.od || "", do: v.do || "" }; poradie.push(mapa[c]); }
                else {
                  if (v.od && (!mapa[c].od || v.od < mapa[c].od)) mapa[c].od = v.od;
                  if (v.do && (!mapa[c].do || v.do > mapa[c].do)) mapa[c].do = v.do;
                }
              });
              poradie.sort(function (x, y) { return (x.od || "") < (y.od || "") ? -1 : 1; });
              poradie.forEach(function (v, vi) {
                var d = document.createElement("div");
                d.className = "card-vehicle";
                d.textContent = v.cislo + (v.od && v.do ? " • " + String(v.od).replace(/^0(\d:)/, "$1") + "–" + String(v.do).replace(/^0(\d:)/, "$1") : "");
                if (vi === 0) pridajIkonu(d, druhVozidla(v.cislo));
                center.appendChild(d);
              });
            })();
            body.appendChild(head);
            var _hrad = k.hradenia || [];
            if (_hrad.length) {
              var hb = document.createElement("div");
              hb.className = "card-prs-blk";
              var hh = document.createElement("div");
              hh.className = "card-prs-hdr";
              hh.textContent = "HRADENIA";
              hb.appendChild(hh);
              // Mená vodičov, ktorí mali ten istý kurz v čase hradenia (iní vodiči toho istého dňa)
              var _mm = function (t) { var q = String(t || "").split(":"); return parseInt(q[0] || 0, 10) * 60 + parseInt(q[1] || 0, 10); };
              var _kto = function (h) {
                var a = _mm(h.od), b = _mm(h.do);
                if (b <= a) b += 1440;
                var me = window.appState && window.appState.currentDriver, out = [];
                if (!window.RAW || !window.RAW.models) return "";
                Object.keys(window.RAW.models).forEach(function (rid) {
                  if (String(rid) === String(me)) return;
                  (window.RAW.models[rid] || []).forEach(function (d) {
                    if (d.datum !== service.date) return;
                    (d.karty || []).forEach(function (kk) {
                      if ((kk.vzor !== "SLUŽBA" && kk.vzor !== "STRIEDAČ") || kk.kurz !== h.kurz) return;
                      var x = _mm(kk.od), y = _mm(kk.do);
                      if (y <= x) y += 1440;
                      if (x < b && y > a) { var n = window.RAW.drivers[rid] || ""; if (n && out.indexOf(n) < 0) out.push(n); }
                    });
                  });
                });
                return out.join("<br>");
              };
              var hList = buildStrList(
                _hrad.map(function (h) {
                  return {
                    kurz: h.kurz,
                    prebera: h.od,
                    odovzdava: h.do,
                    vozidlo: h.vozidla && h.vozidla.length ? h.vozidla[0].cislo : null,
                    ridic: _kto(h),
                    trasa: [h.stan_od, h.stan_do].filter(Boolean).join("\n"),
                    grafOd: !!h.graf_od, grafDo: !!h.graf_do, stanOd: h.stan_od, stanDo: h.stan_do,
                    datum: service.date,
                  };
                }),
                service,
              );
              hb.appendChild(hList);
              body.appendChild(hb);
            }
            card.appendChild(body);
            const aft = driverRow(service.after, "after");
            if (aft) card.appendChild(aft);
            attachMenu(card, mb, service);
            return card;
          } else if (vzor === "POHOTOVOSŤ") {
            const _ph = window.DpbNazvy && window.DpbNazvy.pohotovost(k.kurz);
            if (_ph) {
              const lbl = document.createElement("div");
              lbl.className = "card-label";
              lbl.textContent = _ph.podnazov;
              center.appendChild(lbl);
              addTitle(center, _ph.nazov);
              center.lastChild.classList.add("card-title-md");
            } else addTitle(center, k.kurz);
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
            if (_ph && _ph.miesto) {
              const mr = addRow(center, "card-route card-miesto", _ph.miesto);
              pridajIkonu(mr, "poloha");
            }
            body.appendChild(head);
            const zaskoky = (k.segmenty || []).filter((s) => !s.is_poh);
            if (zaskoky.length)
              body.appendChild(
                buildSegList(
                  zaskoky.map((s) => ({
                    kurz: s.kurz,
                    cas: DPBData.fmtRange(s.od, s.do),
                    voz: s.vozidlo || null,
                  })),
                ),
              );
            card.appendChild(body);
            const aft = driverRow(service.after, "after");
            if (aft) card.appendChild(aft);
            attachMenu(card, mb, service);
            return card;
          } else if (vzor === "STRIEDAČ") {
            const lbl = document.createElement("div");
            lbl.className = "card-label";
            lbl.textContent = "Striedač";
            center.appendChild(lbl);
            // Title pre striedača — handler sa nastaví neskôr keď je _kurzy hotové
            const _strTitleEl = document.createElement("div");
            _strTitleEl.className = "card-title";
            _strTitleEl.textContent = k.kurz || "—";
            center.appendChild(_strTitleEl);
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
            // Zastávka: najprv skús DPB_STATIC.str slot.z (z PDF), potom RAW
            if (window.DPB_STATIC && window.DPB_STATIC.str && service.date) {
              var _zTyp = window.Calendar
                ? window.Calendar.getDayType(service.date)
                : 1;
              var _zOdM = (function (t) {
                var p = (t || "").split(":");
                return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
              })(k.od);
              var _zSlots = window.DPB_STATIC.str[k.kurz + "|" + _zTyp] || [];
              var _zSlot = _zSlots.reduce(function (b, s) {
                var sm = (function (t) {
                  var p = (t || "").split(":");
                  return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
                })(s.od);
                var bm = b
                  ? (function (t) {
                      var p = (t || "").split(":");
                      return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
                    })(b.od)
                  : 99999;
                return Math.abs(sm - _zOdM) < Math.abs(bm - _zOdM) ? s : b;
              }, null);
              if (_zSlot && _zSlot.z) k.zastávka = _zSlot.z;
            }
            if (k.zastávka) {
              const z = document.createElement("div");
              z.className = "str-zastávka";
              z.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                k.zastávka;
              center.appendChild(z);
            }
            body.appendChild(head);
            // kurzy: z karty alebo z DPB_STATIC + lookup meno/voz z RAW
            var _kurzy =
              k.kurzy && k.kurzy.length
                ? k.kurzy
                : (function () {
                    if (!window.DPB_STATIC || !service.date) return [];
                    var _typ = window.Calendar
                      ? window.Calendar.getDayType(service.date)
                      : 1;
                    var _odM = (function (t) {
                      var p = (t || "").split(":");
                      return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
                    })(k.od);
                    var _slots =
                      window.DPB_STATIC.str[k.kurz + "|" + _typ] || [];
                    var _slot = _slots.reduce(function (b, s) {
                      var sm = (function (t) {
                        var p = (t || "").split(":");
                        return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
                      })(s.od);
                      var bm = b
                        ? (function (t) {
                            var p = (t || "").split(":");
                            return (
                              parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0)
                            );
                          })(b.od)
                        : 99999;
                      return Math.abs(sm - _odM) < Math.abs(bm - _odM) ? s : b;
                    }, null);
                    // Zastávka z PDF (slot.z) má prednosť pred RAW hodnotou
                    if (_slot && _slot.z) k.zastávka = _slot.z;
                    if (!_slot) return [];
                    // Len hradenia v rozsahu služby tohto vodiča (ak robil len časť striedača); ak by nezostalo nič, celý zoznam
                    var _mm = function (t) { var p = (t || "").split(":"); return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0); };
                    var _kOd = _mm(k.od), _kDo = _mm(k.do);
                    if (_kDo <= _kOd) _kDo += 1440;
                    var _vRozsahu = (_slot.k || []).filter(function (kz) {
                      var a = _mm(kz.prebera), b = _mm(kz.odovzdava);
                      if (b <= a) b += 1440;
                      return a < _kDo && b > _kOd;
                    });
                    return (_vRozsahu.length ? _vRozsahu : _slot.k || []).map(function (kz) {
                      var _pm = (function (t) {
                        var p = (t || "").split(":");
                        return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
                      })(kz.prebera);
                      var _ridic = "",
                        _voz = "";
                      if (window.RAW)
                        Object.keys(window.RAW.models).some(function (rid) {
                          return (window.RAW.models[rid] || []).some(
                            function (d) {
                              if (d.datum !== service.date) return false;
                              return d.karty.some(function (kk) {
                                if (kk.kurz !== kz.kurz || kk.vzor !== "SLUŽBA")
                                  return false;
                                var _ok = (function (t) {
                                  var p = (t || "").split(":");
                                  return (
                                    parseInt(p[0] || 0) * 60 +
                                    parseInt(p[1] || 0)
                                  );
                                })(kk.od);
                                var _dk =
                                  kk.do_min ||
                                  (function (t) {
                                    var p = (t || "").split(":");
                                    return (
                                      parseInt(p[0] || 0) * 60 +
                                      parseInt(p[1] || 0)
                                    );
                                  })(kk.do);
                                if (_ok > _pm || _pm > _dk) return false;
                                _ridic = window.RAW.drivers[rid] || "";
                                var voz = (kk.vozidla || []).find(function (v) {
                                  var vo = (function (t) {
                                    var p = (t || "").split(":");
                                    return (
                                      parseInt(p[0] || 0) * 60 +
                                      parseInt(p[1] || 0)
                                    );
                                  })(v.od);
                                  var vd = (function (t) {
                                    var p = (t || "").split(":");
                                    return (
                                      parseInt(p[0] || 0) * 60 +
                                      parseInt(p[1] || 0)
                                    );
                                  })(v.do);
                                  return vo <= _pm && _pm <= vd;
                                });
                                _voz = voz
                                  ? voz.cislo
                                  : ((kk.vozidla || [])[0] || {}).cislo || "";
                                return true;
                              });
                            },
                          );
                        });
                      return {
                        kurz: kz.kurz,
                        prebera: kz.prebera,
                        odovzdava: kz.odovzdava,
                        vozidlo: _voz,
                        ridic: _ridic,
                      };
                    });
                  })();
            if (_kurzy.length) {
              // Teraz keď máme _kurzy, nastavíme handler na title
              _strTitleEl.addEventListener("click", function(e) {
                e.stopPropagation();
                const _appState = window._appState ? window._appState() : null;
                const _dateKey = _appState && window.formatDateKey ? window.formatDateKey(_appState.selectedDate) : "";
                openGrafikonStriedac(_kurzy.map(function(s) {
                  return { kurz: s.kurz, prebera: s.prebera, odovzdava: s.odovzdava, vozidlo: s.vozidlo };
                }), _dateKey);
              });
              body.appendChild(
                buildStrList(
                  _kurzy.map((s) => ({
                    kurz: s.kurz,
                    prebera: s.prebera,
                    odovzdava: s.odovzdava,
                    vozidlo: s.vozidlo,
                    ridic: s.ridic || "",
                  })),
                  service,
                ),
              );
            }
            card.appendChild(body);
            attachMenu(card, mb, service);
            return card;
          } else {
            // SLUŽBA
            addTitle(center, k.kurz);
            pridajIkonu(addRow(center, "card-time", DPBData.fmtRange(k.od, k.do)), "cas");
            if (k.stan_od && k.stan_do) {
              const rw = document.createElement("div");
              rw.className = "card-route-wrap";
              rw.innerHTML = `<span class="card-route-od">${k.stan_od}</span><span class="card-route-do">${k.stan_do}</span>`;
              pridajIkonu(rw, "poloha");
              center.appendChild(rw);
              // Vodič robil len časť úseku: miesto podľa grafikonu v čase karty (export má stanice celého úseku)
              if ((k.graf_od || k.graf_do) && /^\d+\/\d+$/.test(k.kurz || "") && window.DpbStretnutia && window.DpbStretnutia.miesto && service.date) {
                window.DpbStretnutia.miesto(k.kurz, service.date, k.od, k.do).then(function (m) {
                  if (!m) return;
                  var o = rw.querySelector(".card-route-od"), d = rw.querySelector(".card-route-do");
                  if (o && k.graf_od && m.od) o.textContent = m.od;
                  if (d && k.graf_do && m.do) d.textContent = m.do;
                }).catch(function () {});
              }
            }
            (
              k.vozidla ||
              (k.vozidlo ? [{ cislo: k.vozidlo, od: "", do: "" }] : [])
            ).forEach(function (v, vi) {
              const d = document.createElement("div");
              d.className = "card-vehicle";
              d.textContent =
                v.cislo + (v.od && v.do ? " • " + String(v.od).replace(/^0(\d:)/, "$1") + "–" + String(v.do).replace(/^0(\d:)/, "$1") : "");
              if (vi === 0) pridajIkonu(d, druhVozidla(v.cislo));
              center.appendChild(d);
            });
          }

          if (service.zacvik && service.zacvik.mena && service.zacvik.mena.length) {
            const zc = document.createElement("div");
            zc.className = "card-zacvik";
            zc.textContent =
              (service.zacvik.rola === "skym" ? "Zácvik, vedie: " : "Zácvik: ") +
              service.zacvik.mena.join(", ");
            center.appendChild(zc);
          }

          body.appendChild(head);
          // Prestávka: z karty alebo z DPB_STATIC + lookup meno z RAW
          var _prs = k.prestávka && k.prestávka.length ? k.prestávka : [];
          if (vzor === "SLUŽBA" && _prs.length) {
            var _odM = k.od_min || 0,
              _doM = k.do_min || 1440;
            function _tm(t) {
              var p = (t || "").split(":");
              return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
            }
            var _rel = _prs.filter(function (p) {
              var pm = _tm(p.prebera);
              return pm >= _odM && pm <= _doM;
            });
            if (_rel.length) {
              var pb = document.createElement("div");
              pb.className = "card-prs-blk";
              var ph = document.createElement("div");
              ph.className = "card-prs-hdr";
              ph.textContent = "PRESTÁVKA";
              pb.appendChild(ph);
              var pz = document.createElement("div");
              pz.className = "card-prs-zas";
              pz.textContent = _rel[0].zastávka || "";
              pb.appendChild(pz);
              _rel.forEach(function (p) {
                var row = document.createElement("div");
                row.className = "card-prs-row";
                var cas = document.createElement("span");
                cas.className = "prs-cas";
                zarovnajCas(cas, p.prebera + "–" + p.odovzdava);
                row.appendChild(cas);
                var meno = document.createElement("span");
                meno.className = "prs-meno";
                var _km = (p.str_meno || "").trim();
                meno.textContent = _km || "";
                row.appendChild(meno);
                var kurz = document.createElement("span");
                kurz.className = "prs-kurz";
                kurz.textContent = p.str_kurz ? "(" + p.str_kurz + ")" : "";
                row.appendChild(kurz);
                if (window.DpbPrestavka && window.DpbPrestavka.ikonaPrs) {
                  var _pk = window.DpbPrestavka.ikonaPrs(service, k, p);
                  if (_pk) row.appendChild(_pk);
                }
                pb.appendChild(row);
              });
              body.appendChild(pb);
            }
          }
          card.appendChild(body);
          const aft = driverRow(service.after, "after");
          if (aft) card.appendChild(aft);
          attachMenu(card, mb, service);
          return card;
        };
      })();
    