
      /* ==========================
   BURZA SLUŽIEB
   Samostatný modul — zapracovať do projektu
   Závislosti: style.css (zdieľané CSS premenné)
========================== */

      const Burza = (() => {
        /* --------------------------
   POMOCNÉ
-------------------------- */

        function padZ(n) {
          return String(n).padStart(2, "0");
        }

        function dateKey(date) {
          return (
            date.getFullYear() +
            "-" +
            padZ(date.getMonth() + 1) +
            "-" +
            padZ(date.getDate())
          );
        }

        /* --------------------------
   VOĽNÉ SLUŽBY (z CSV: js/data/volne-sluzby.js)
   Voľná služba je štandardná služba (linka/poradie) alebo pohotovosť bez vodiča; pri delenej
   službe len voľná časť. Vodič ju vidí, len ak je rovnakej trakcie, ešte nezačala a ten deň
   nemá žiadnu službu ani neprítomnosť. (Neskôr pribudne kontrola povinných odpočinkov.)
-------------------------- */

        let _volneVerzia = -1;

        function syncVolne() {
          if (typeof DPBData === "undefined" || !DPBData.getVolneSluzby) return;
          const v = DPBData.getVolneVerzia();
          if (v === _volneVerzia) return;
          _volneVerzia = v;
          const nove = DPBData.getVolneSluzby();
          const noveId = new Set(nove.map((x) => x.id));
          // preč idú len nerezervované služby, ktoré už nie sú v dátach
          state.sluzby = state.sluzby.filter(
            (s) => s.stav !== "volna" || noveId.has(s.id),
          );
          const mam = new Set(state.sluzby.map((s) => s.id));
          nove.forEach((x) => {
            if (mam.has(x.id)) return;
            const p = x.dateKey.split("-").map(Number);
            const datum = new Date(p[0], p[1] - 1, p[2]);
            state.sluzby.push({
              id: x.id,
              datum,
              dateKey: x.dateKey,
              line: x.line,
              nazov: x.nazov || x.line,
              podnazov: x.podnazov || "",
              pohotovost: !!x.pohotovost,
              cas: x.cas,
              odMin: x.odMin,
              doMin: x.doMin,
              startH: x.odMin / 60,
              startMs: x.startMs,
              od: x.stanicaOd || "",
              kam: x.stanicaDo || "",
              trakcia: x.trakcia || "",
              stav: "volna", // volna | rezervovana | obsadena
              rezervaciaId: null,
            });
          });
          state.sluzby.sort((a, b) => a.startMs - b.startMs);
        }

        // Práca vodiča (všetky karty s časom okrem neprítomnosti) + jeho vlastné aktívne rezervácie z burzy
        function kontrolaOdpocinku(rid, s) {
          const O = window.DpbOdpocinok;
          if (!O) return { ok: true, skrateny: null };
          const prace = O.praceVodica(window.RAW && window.RAW.models, rid);
          state.rezervacie.forEach((r) => {
            if (r.stav !== "odoslana" && r.stav !== "riesenie" && r.stav !== "schvalena") return;
            const q = state.sluzby.find((x) => x.id === r.sluzbaId);
            if (q && q.id !== s.id && q.doMin > q.odMin) prace.push({ od: O.abs(q.dateKey, q.odMin), do: O.abs(q.dateKey, q.doMin) });
          });
          const r = O.skontroluj(prace, { od: O.abs(s.dateKey, s.odMin), do: O.abs(s.dateKey, s.doMin) });
          let skr = null;
          if (r.skrateny) {
            const f = (m) => (m === Infinity ? "" : Math.floor(m / 60) + " h " + String(Math.round(m % 60)).padStart(2, "0") + " min");
            const a = r.skrateny.pred !== Infinity && r.skrateny.pred < O.DEN_OK ? "pred " + f(r.skrateny.pred) : "";
            const b = r.skrateny.po !== Infinity && r.skrateny.po < O.DEN_OK ? "po " + f(r.skrateny.po) : "";
            skr = "Skrátený odpočinok: " + [a, b].filter(Boolean).join(", ");
          }
          return { ok: r.ok, skrateny: skr, delena: r.delena };
        }

        function dostupna(s) {
          if (s.stav === "obsadena") return false;
          if (s.stav === "rezervovana") return true; // vlastná rezervácia ostáva vidieť
          if (s.startMs <= Date.now()) return false; // len od aktuálneho času
          const rid = window.appState && window.appState.currentDriver;
          if (rid && typeof DPBData !== "undefined") {
            const tr = DPBData.getTrakciaKod ? DPBData.getTrakciaKod(rid) : null;
            if (tr && s.trakcia && tr !== s.trakcia) return false;
            // neprítomnosť (dovolenka, PN…) v ten deň = nie; iná služba v ten deň je v poriadku (delená zmena), ak sa neprekrýva
            if (DPBData.getServicesForDate(rid, s.dateKey).some((x) => x._vzor === "NEPRÍTOMNOSŤ")) return false;
            // Odpočinok (zákon 462/2007): denný 11 h (skrátený 6–11 h sa ukáže s upozornením) a týždenný 35 h
            const o = kontrolaOdpocinku(rid, s);
            s.upozornenie = o.skrateny || null;
            s.delena = !!o.delena;
            if (!o.ok) return false;
          }
          return true;
        }

        /* --------------------------
   STATE
-------------------------- */

        const state = {
          sluzby: [],
          rezervacie: [], // { id, sluzbaId, cas, stav: odoslana|riesenie|schvalena|zamietnuta|zrusena }
          notifikacie: [], // { id, text, cas, precitana, typ }
          aktZalozka: "volne", // volne | rezervacie | notifikacie
          expandSluzba: null,
          expandRez: null,
          notifBadge: 0,
          denFilter: null, // ak je set, zobrazí len služby z tohto dňa
        };

        let nextId = 1;
        function uid() {
          return `id-${nextId++}`;
        }

        /* --------------------------
   SIMULÁCIA SCHVAĽOVANIA
-------------------------- */

        function simulujSchvalenie(rezervaciaId) {
          const delay = 5000 + Math.random() * 10000; // 5-15s

          // po 2s → stav "riesenie"
          setTimeout(() => {
            const rez = state.rezervacie.find((r) => r.id === rezervaciaId);
            if (!rez || rez.stav !== "odoslana") return;
            rez.stav = "riesenie";
            pridajNotifikaciu(
              `Tvoja rezervácia ${pop(rez)} je v riešení.`,
              "info",
            );
            render();
          }, 2000);

          // po delay → schválenie alebo zamietnutie
          setTimeout(() => {
            const rez = state.rezervacie.find((r) => r.id === rezervaciaId);
            if (!rez || rez.stav !== "riesenie") return;

            const schvalena = Math.random() < 0.7;

            if (schvalena) {
              rez.stav = "schvalena";
              rez.casRiesenia = new Date();
              // služba zmizne z burzy
              const sluzba = state.sluzby.find((s) => s.id === rez.sluzbaId);
              if (sluzba) sluzba.stav = "obsadena";
              // Zapíš do kalendára vodiča
              if (typeof aplikujBurzuDoKalendara === "function")
                aplikujBurzuDoKalendara(rez);
              // automaticky zamietnuť ostatné rezervácie na tú istú službu
              state.rezervacie
                .filter(
                  (r) =>
                    r.sluzbaId === rez.sluzbaId &&
                    r.id !== rezervaciaId &&
                    r.stav !== "schvalena",
                )
                .forEach((r) => {
                  r.stav = "zamietnuta";
                  r.casRiesenia = new Date();
                  pridajNotifikaciu(
                    `Rezervácia ${pop(r)} bola zamietnutá — služba obsadená.`,
                    "error",
                  );
                });
              pridajNotifikaciu(
                `Rezervácia ${pop(rez)} bola schválená!`,
                "success",
              );
            } else {
              rez.stav = "zamietnuta";
              rez.casRiesenia = new Date();
              // služba sa vráti späť ako voľná
              const sluzba = state.sluzby.find((s) => s.id === rez.sluzbaId);
              if (sluzba) sluzba.stav = "volna";
              pridajNotifikaciu(
                `Rezervácia ${pop(rez)} bola zamietnutá.`,
                "error",
              );
            }
            render();
          }, delay);
        }

        // „linky 3/16" pre kurz, „služby Dispozičný vodič" pre pohotovosť
        function pop(x) {
          return x.pohotovost ? `služby ${x.line}` : `linky ${x.line}`;
        }

        function pridajNotifikaciu(text, typ) {
          state.notifikacie.unshift({
            id: uid(),
            text,
            typ,
            cas: new Date(),
            precitana: false,
          });
          state.notifBadge++;
          updateBadge();
          // Pošli aj do globálneho notif systému
          if (typeof Notif !== "undefined") {
            const titul =
              typ === "success"
                ? "Burza — schválené"
                : typ === "error"
                  ? "Burza — zamietnuté"
                  : "Burza";
            Notif.pridaj(titul, text, "burza");
          }
        }

        function updateBadge() {
          const badge = document.getElementById("burzaBadge");
          if (!badge) return;
          if (state.notifBadge > 0) {
            badge.textContent = state.notifBadge > 9 ? "9+" : state.notifBadge;
            badge.classList.remove("hidden");
          } else {
            badge.classList.add("hidden");
          }
        }

        /* --------------------------
   FORMAT HELPERS
-------------------------- */

        const DNI = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
        const MESIAC = [
          "jan",
          "feb",
          "mar",
          "apr",
          "máj",
          "jún",
          "júl",
          "aug",
          "sep",
          "okt",
          "nov",
          "dec",
        ];

        // Ikony: hodiny pred časom, poloha pred trasou (jeden riadok „od – kam“)

        const IK_CAS = '<svg class="burza-ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

        const IK_POLOHA = '<svg class="burza-ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

        // Text trasy: rovnaký začiatok a koniec sa píše len raz, „striedač“ len raz
        // Pohotovosť (sedavá záloha) má len miesto nástupu; ostatné služby miesto nástupu aj ukončenia
        function trasaText(od, kam, pohotovost) {
          if (pohotovost) return od || kam || "";
          const pre = /^striedač\s+/i;
          if (od && kam && pre.test(od) && pre.test(kam)) kam = kam.replace(pre, "");
          return [od, kam].filter(Boolean).join(" \u2013 ");
        }
        function trasaHtml(od, kam, pohotovost) {

          const t = trasaText(od, kam, pohotovost);

          return t ? `<div class="burza-trasa">${IK_POLOHA}<span class="burza-trasa-val">${t}</span></div>` : "";

        }


        function formatDatum(date) {
          return `${DNI[date.getDay()]} ${date.getDate()}. ${MESIAC[date.getMonth()]}`;
        }

        function formatCas(date) {
          return padZ(date.getHours()) + ":" + padZ(date.getMinutes());
        }

        function formatRelative(date) {
          const diff = Math.floor((new Date() - date) / 1000);
          if (diff < 60) return "práve teraz";
          if (diff < 3600) return `pred ${Math.floor(diff / 60)} min`;
          if (diff < 86400) return `pred ${Math.floor(diff / 3600)} hod`;
          return formatDatum(date);
        }

        /* --------------------------
   RENDER
-------------------------- */

        function render() {
          const el = document.getElementById("burzaView");
          if (!el || el.classList.contains("hidden")) return;

          renderZalozky();

          if (state.aktZalozka === "volne") renderVolne();
          else if (state.aktZalozka === "rezervacie") renderRezacie();
          else if (state.aktZalozka === "notifikacie") renderNotifikacie();
        }

        function renderZalozky() {
          ["volne", "rezervacie", "notifikacie"].forEach((id) => {
            const btn = document.getElementById(`burza-tab-${id}`);
            if (btn) btn.classList.toggle("active", state.aktZalozka === id);
          });
        }

        /* ---- VOĽNÉ SLUŽBY ---- */

        function renderVolne() {
          const cont = document.getElementById("burzaContent");
          cont.innerHTML = "";

          syncVolne();
          const visible = state.sluzby.filter(
            (s) =>
              dostupna(s) &&
              (!state.denFilter || s.dateKey === state.denFilter),
          );

          if (visible.length === 0) {
            cont.innerHTML = prazdnyStav(
              "calendar-x",
              "Žiadne voľné služby",
              "Momentálne nie sú k dispozícii žiadne voľné služby.",
            );
            return;
          }

          // Skupiny podľa dátumu
          const skupiny = {};
          visible.forEach((s) => {
            if (!skupiny[s.dateKey])
              skupiny[s.dateKey] = { datum: s.datum, sluzby: [] };
            skupiny[s.dateKey].sluzby.push(s);
          });

          const frag = document.createDocumentFragment();

          Object.values(skupiny).forEach((skupina) => {
            // Hlavička dňa
            const hdr = document.createElement("div");
            hdr.className = "burza-day-header";
            const dnes = new Date();
            dnes.setHours(0, 0, 0, 0);
            const jeDnes = skupina.datum.getTime() === dnes.getTime();
            hdr.textContent = jeDnes ? "Dnes" : formatDatum(skupina.datum);
            frag.appendChild(hdr);

            // Karty skupiny
            const group = document.createElement("div");
            group.className = "burza-group";

            skupina.sluzby.forEach((s) => {
              const row = document.createElement("div");
              const rezervovana = s.stav === "rezervovana";

              // Má vodič na tento deň už aktívnu rezerváciu?
              const uzRezervovanyDen = state.rezervacie.some(
                (r) =>
                  r.dateKey === s.dateKey &&
                  r.sluzbaId !== s.id &&
                  (r.stav === "odoslana" ||
                    r.stav === "riesenie" ||
                    r.stav === "schvalena"),
              );

              const mozeRezervovat = !rezervovana && !uzRezervovanyDen;

              row.className = "burza-row" + (rezervovana ? " rezervovana" : "");
              row.dataset.id = s.id;

              row.innerHTML = `
        <div class="burza-row-main">
          <div class="burza-row-left">
            <span class="burza-linka ${rezervovana ? "italic" : ""}">${s.nazov || s.line}${s.podnazov ? `<span class="burza-podnazov">${s.podnazov}</span>` : ""}</span>
            <span class="burza-cas">${IK_CAS}${s.cas}</span>
            ${s.upozornenie ? `<span class="burza-upoz">${s.upozornenie}</span>` : ""}
          </div>
          <div class="burza-row-right burza-row-actions">
            ${
              rezervovana
                ? `<span class="burza-stav-badge">v riešení</span><span class="burza-kriz">✕</span>`
                : uzRezervovanyDen
                  ? `<span class="burza-uz-rez">Nedostupné</span>`
                  : `<button class="burza-btn-rez">Rezervovať</button>`
            }
          </div>
        </div>
        <div class="burza-row-detail hidden" id="detail-${s.id}">
          ${trasaHtml(s.od, s.kam, s.pohotovost)}
          ${s.upozornenie ? `<div class="burza-upoz">${s.upozornenie}</div>` : ""}
          <div class="burza-detail-btns">
            <button class="burza-btn-close">Zavrieť</button>
            ${mozeRezervovat ? `<button class="burza-btn-rez-detail">Rezervovať</button>` : ""}
          </div>
        </div>
      `;

              // Klik na riadok → rozbalí detail a schová tlačidlo Rezervovať v riadku
              row
                .querySelector(".burza-row-main")
                .addEventListener("click", (e) => {
                  if (e.target.closest(".burza-btn-rez")) return;
                  toggleDetail(s.id);
                });

              // Rezervovať (riadok) — schová sa pri rozbalení cez CSS .expanded
              const btnRez = row.querySelector(".burza-btn-rez");
              if (btnRez)
                btnRez.addEventListener("click", (e) => {
                  e.stopPropagation();
                  rezervuj(s.id);
                });

              // Zavrieť (detail)
              row
                .querySelector(".burza-btn-close")
                .addEventListener("click", (e) => {
                  e.stopPropagation();
                  closeDetail(s.id);
                });

              // Rezervovať (detail)
              const btnRezDet = row.querySelector(".burza-btn-rez-detail");
              if (btnRezDet)
                btnRezDet.addEventListener("click", (e) => {
                  e.stopPropagation();
                  rezervuj(s.id);
                });

              group.appendChild(row);
            });

            frag.appendChild(group);
          });

          cont.appendChild(frag);
        }

        function toggleDetail(id) {
          const det = document.getElementById(`detail-${id}`);
          if (!det) return;
          const isOpen = !det.classList.contains("hidden");
          // zatvoriť všetky
          document
            .querySelectorAll(".burza-row-detail")
            .forEach((d) => d.classList.add("hidden"));
          document
            .querySelectorAll(".burza-row")
            .forEach((r) => r.classList.remove("expanded"));
          if (!isOpen) {
            det.classList.remove("hidden");
            det.closest(".burza-row").classList.add("expanded");
          }
        }

        function closeDetail(id) {
          const det = document.getElementById(`detail-${id}`);
          if (det) det.classList.add("hidden");
          const row = det?.closest(".burza-row");
          if (row) row.classList.remove("expanded");
        }

        function rezervuj(sluzbaId) {
          const sluzba = state.sluzby.find((s) => s.id === sluzbaId);
          if (!sluzba || sluzba.stav !== "volna") return;

          sluzba.stav = "rezervovana";

          const rez = {
            id: uid(),
            sluzbaId,
            line: sluzba.nazov || sluzba.line,
            podnazov: sluzba.podnazov || "",
            pohotovost: !!sluzba.pohotovost,
            cas: sluzba.cas,
            datum: sluzba.datum,
            dateKey: sluzba.dateKey,
            od: sluzba.od,
            kam: sluzba.kam,
            stav: "odoslana",
            casOdoslania: new Date(),
            casRiesenia: null,
          };
          state.rezervacie.unshift(rez);
          sluzba.rezervaciaId = rez.id;

          pridajNotifikaciu(
            `Rezervácia ${pop({ line: sluzba.nazov || sluzba.line, pohotovost: sluzba.pohotovost })} bola odoslaná.`,
            "info",
          );

          closeDetail(sluzbaId);
          render();

          // Kým nie je server: ukáž text hlásenia (dá sa upraviť), nič sa neposiela
          try {
            const rid = window.appState && window.appState.currentDriver;
            const meno = (window.RAW && window.RAW.drivers && window.RAW.drivers[rid]) || "—";
            const dk = String(sluzba.dateKey || "").split("-");
            const riadky = [
              "Žiadosť o službu z burzy",
              "Vodič: " + meno + " (os. č. " + rid + ")",
              "Dátum: " + (dk.length === 3 ? parseInt(dk[2], 10) + ". " + parseInt(dk[1], 10) + ". " + dk[0] : (sluzba.datum || "")),
              "Služba: " + (sluzba.nazov || sluzba.line) + (sluzba.podnazov ? " (" + sluzba.podnazov + ")" : ""),
              sluzba.cas ? "Čas: " + sluzba.cas : "",
            ].filter(Boolean);
            if (window.DpbZmenaStavu && window.DpbZmenaStavu.ukaz) window.DpbZmenaStavu.ukaz(riadky.join("\n"), "Žiadosť o službu z burzy");
          } catch (e) {}

          simulujSchvalenie(rez.id);
        }

        function zrusRezervaciju(rezId) {
          const rez = state.rezervacie.find((r) => r.id === rezId);
          if (!rez || (rez.stav !== "odoslana" && rez.stav !== "riesenie"))
            return;
          rez.stav = "zrusena";
          rez.casRiesenia = new Date();
          const sluzba = state.sluzby.find((s) => s.id === rez.sluzbaId);
          if (sluzba) {
            sluzba.stav = "volna";
            sluzba.rezervaciaId = null;
          }
          pridajNotifikaciu(
            `Rezervácia ${pop(rez)} bola zrušená vodičom.`,
            "info",
          );
          render();
        }

        /* ---- MOJE REZERVÁCIE ---- */

        const STAVY = {
          odoslana: { label: "Odoslaná", color: "orange" },
          riesenie: { label: "V riešení", color: "blue" },
          schvalena: { label: "Schválená", color: "green" },
          zamietnuta: { label: "Zamietnutá", color: "red" },
          zrusena: { label: "Zrušená vodičom", color: "gray" },
        };

        function renderRezacie() {
          const cont = document.getElementById("burzaContent");
          cont.innerHTML = "";

          if (state.rezervacie.length === 0) {
            cont.innerHTML = prazdnyStav(
              "inbox",
              "Žiadne rezervácie",
              "Zatiaľ si si nežiadal o žiadnu službu.",
            );
            return;
          }

          const frag = document.createDocumentFragment();

          state.rezervacie.forEach((rez) => {
            const stav = STAVY[rez.stav];
            const card = document.createElement("div");
            card.className = `burza-rez-card stav-${rez.stav}`;

            const isOpen = state.expandRez === rez.id;

            card.innerHTML = `
      <div class="burza-rez-main">
        <div class="burza-rez-left">
          <span class="burza-linka">${rez.line}${rez.podnazov ? `<span class="burza-podnazov">${rez.podnazov}</span>` : ""}</span>
          <span class="burza-cas">${IK_CAS}${rez.cas}</span>
          <span class="burza-datum-small">${formatDatum(rez.datum)}</span>
        </div>
        <div class="burza-rez-right">
          <span class="burza-stav-dot stav-${rez.stav}"></span>
          <span class="burza-stav-text">${stav.label}</span>
        </div>
      </div>
      <div class="burza-rez-detail ${isOpen ? "" : "hidden"}">
        ${trasaHtml(rez.od, rez.kam, rez.pohotovost)}
        <div class="burza-timeline">
          <div class="burza-tl-item">
            <span class="burza-tl-dot stav-odoslana"></span>
            <span class="burza-tl-label">Odoslaná</span>
            <span class="burza-tl-cas">${formatCas(rez.casOdoslania)}</span>
          </div>
          ${
            rez.casRiesenia
              ? `
          <div class="burza-tl-item">
            <span class="burza-tl-dot stav-${rez.stav}"></span>
            <span class="burza-tl-label">${stav.label}</span>
            <span class="burza-tl-cas">${formatCas(rez.casRiesenia)}</span>
          </div>`
              : ""
          }
        </div>
        ${
          rez.stav === "odoslana" || rez.stav === "riesenie"
            ? `
        <div class="burza-detail-btns" style="margin-top:12px;">
          <button class="burza-btn-zrus">Zrušiť rezerváciu</button>
        </div>`
            : ""
        }
      </div>
    `;

            card.addEventListener("click", (e) => {
              if (e.target.closest(".burza-btn-zrus")) return;
              state.expandRez = isOpen ? null : rez.id;
              renderRezacie();
            });

            const btnZrus = card.querySelector(".burza-btn-zrus");
            if (btnZrus)
              btnZrus.addEventListener("click", (e) => {
                e.stopPropagation();
                zrusRezervaciju(rez.id);
              });

            frag.appendChild(card);
          });

          cont.appendChild(frag);
        }

        /* ---- NOTIFIKÁCIE ---- */

        function renderNotifikacie() {
          const cont = document.getElementById("burzaContent");
          cont.innerHTML = "";

          // Označiť všetky ako prečítané
          state.notifikacie.forEach((n) => (n.precitana = true));
          state.notifBadge = 0;
          updateBadge();

          if (state.notifikacie.length === 0) {
            cont.innerHTML = prazdnyStav(
              "bell-off",
              "Žiadne notifikácie",
              "Zatiaľ nemáš žiadne správy.",
            );
            return;
          }

          const frag = document.createDocumentFragment();

          state.notifikacie.forEach((n) => {
            const item = document.createElement("div");
            item.className = `burza-notif typ-${n.typ} ${n.precitana ? "precitana" : ""}`;
            item.innerHTML = `
      <span class="burza-notif-dot typ-${n.typ}"></span>
      <div class="burza-notif-body">
        <div class="burza-notif-text">${n.text}</div>
        <div class="burza-notif-cas">${formatRelative(n.cas)}</div>
      </div>
    `;
            frag.appendChild(item);
          });

          cont.appendChild(frag);
        }

        /* --------------------------
   HELPERS
-------------------------- */

        function prazdnyStav(icon, title, sub) {
          return `<div class="burza-empty">
    <div class="burza-empty-icon">${icon === "calendar-x" ? "📅" : icon === "inbox" ? "📭" : "🔔"}</div>
    <div class="burza-empty-title">${title}</div>
    <div class="burza-empty-sub">${sub}</div>
  </div>`;
        }

        /* --------------------------
   INIT — volaj po DOMContentLoaded
-------------------------- */

        function init(dateKey) {
          // Nastav filter ak bol zadaný
          state.denFilter = dateKey || null;
          state.aktZalozka = "volne";

          // Záložky
          ["volne", "rezervacie", "notifikacie"].forEach((id) => {
            const btn = document.getElementById(`burza-tab-${id}`);
            if (!btn) return;
            // Odstráň starý listener (clone trick)
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            clone.addEventListener("click", () => {
              state.aktZalozka = id;
              render();
            });
          });

          // Hlavička filtra
          const cont = document.getElementById("burzaContent");
          if (state.denFilter) {
            let hdr = document.getElementById("burza-filter-hdr");
            if (!hdr) {
              hdr = document.createElement("div");
              hdr.id = "burza-filter-hdr";
              hdr.className = "burza-filter-hdr";
              cont.parentNode.insertBefore(hdr, cont);
            }
            const d = new Date(state.denFilter);
            const DNI2 = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
            const MES2 = [
              "jan",
              "feb",
              "mar",
              "apr",
              "máj",
              "jún",
              "júl",
              "aug",
              "sep",
              "okt",
              "nov",
              "dec",
            ];
            hdr.innerHTML = `
      <span>Služby: <strong>${DNI2[d.getDay()]} ${d.getDate()}. ${MES2[d.getMonth()]}</strong></span>
    `;
          } else {
            const hdr = document.getElementById("burza-filter-hdr");
            if (hdr) hdr.remove();
          }

          render();
        }

        // Gesto späť: ak je Burza otvorená s filtrom dňa, vráti na zoznam služieb dňa
        function zrusFilter() {
          if (!state.denFilter) return false;
          state.denFilter = null;
          const h = document.getElementById("burza-filter-hdr");
          if (h) h.remove();
          document.getElementById("burzaView").classList.add("hidden");
          document.getElementById("servicesView").classList.remove("hidden");
          document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.remove("active"));
          document.getElementById("btnToday").classList.add("active");
          return true;
        }

        function getVolnePreDen(dateKey) {
          syncVolne();
          return state.sluzby.filter(
            (s) => s.dateKey === dateKey && s.stav === "volna" && dostupna(s),
          );
        }

        return { init, render, zrusFilter, getVolnePreDen, rezervuj, getStav: (id) => state.rezervacie.find(r => r.sluzbaId === id && ["odoslana","riesenie","schvalena"].includes(r.stav)) || null };
      })();
    