
      /* ==========================
   NOTIFIKÁCIE — globálny systém
   Závisí na: style.css, notif.css
========================== */

      const Notif = (() => {
        const KATEGORIE = {
          burza: { label: "Burza", color: "red" },
          zmena: { label: "Zmena", color: "orange" },
          system: { label: "Systém", color: "blue" },
        };

        const state = {
          items: [],
          open: false,
          rid: null,
        };

        // Uloženie správ v telefóne (po vodičoch), aby sa po zatvorení appky nestratili
        function uloz() {
          if (!state.rid) return;
          try {
            localStorage.setItem(
              "dpb-notif-" + state.rid,
              JSON.stringify(
                state.items.slice(0, 50).map((n) => ({
                  kat: n.kat,
                  titul: n.titul,
                  text: n.text,
                  cas: new Date(n.cas).toISOString(),
                  precitana: !!n.precitana,
                  ciel: n.ciel || null,
                })),
              ),
            );
          } catch (e) {}
        }
        function nastavVodica(rid) {
          state.rid = rid || null;
          state.items = [];
          if (rid) {
            try {
              (JSON.parse(localStorage.getItem("dpb-notif-" + rid) || "[]") || []).forEach((n) => {
                state.items.push({ id: uid(), kat: n.kat, titul: n.titul, text: n.text, cas: new Date(n.cas), precitana: !!n.precitana, ciel: n.ciel || null });
              });
            } catch (e) {}
          }
          aktualizujBadge();
          if (state.open) renderZoznam();
        }

        let nextId = 1;
        function uid() {
          return `n-${nextId++}`;
        }

        // ── DEMO dáta (zmeny + systém) ──────────────────────────────
        // Vymyslené ukážkové správy sú vypnuté: zoznam ostáva prázdny, kým neprídu skutočné upozornenia.
        function generujDemo() {
          const demo = []; // žiadne ukážkové správy

          demo.forEach((d) => {
            const cas = new Date();
            cas.setMinutes(cas.getMinutes() + d.offset);
            state.items.push({
              id: uid(),
              kat: d.kat,
              titul: d.titul,
              text: d.text,
              cas,
              precitana: true,
            });
          });
        }

        // ── PUBLIC: pridaj notifikáciu (volá burza.js) ──────────────
        // ciel (nepovinné): { typ: "den", d: "2026-10-28", l: "linka/kurz", k: "vozidlo" } alebo { typ: "burza", d: "2026-10-28" }
        function pridaj(titul, text, kat = "burza", ciel = null) {
          state.items.unshift({
            id: uid(),
            kat,
            titul,
            text,
            cas: new Date(),
            precitana: false,
            ciel,
          });
          aktualizujBadge();
          uloz();
          if (state.open) renderZoznam();
        }

        // ── BADGE ───────────────────────────────────────────────────
        function neprec() {
          return state.items.filter((n) => !n.precitana).length;
        }

        function aktualizujBadge() {
          const badge = document.getElementById("notifBadge");
          if (!badge) return;
          const count = neprec();
          badge.textContent = count > 9 ? "9+" : count;
          badge.classList.toggle("hidden", count === 0);
        }

        // ── FORMAT ──────────────────────────────────────────────────
        function padZ(n) {
          return String(n).padStart(2, "0");
        }
        function formatCas(date) {
          const diff = Math.floor((new Date() - date) / 1000);
          if (diff < 60) return "práve teraz";
          if (diff < 3600) return `pred ${Math.floor(diff / 60)} min`;
          if (diff < 86400) return `pred ${Math.floor(diff / 3600)} hod`;
          return `${date.getDate()}.${date.getMonth() + 1}. ${padZ(date.getHours())}:${padZ(date.getMinutes())}`;
        }

        // ── RENDER zoznamu ───────────────────────────────────────────
        function renderZoznam() {
          const list = document.getElementById("notifList");
          if (!list) return;

          if (state.items.length === 0) {
            list.innerHTML = `<div class="notif-empty">
      <div class="notif-empty-icon">🔔</div>
      <div class="notif-empty-text">Žiadne notifikácie</div>
    </div>`;
            return;
          }

          list.innerHTML = "";
          state.items.forEach((n) => {
            const kat = KATEGORIE[n.kat] || KATEGORIE.system;
            const item = document.createElement("div");
            item.className = `notif-item ${n.precitana ? "precitana" : "nova"}`;
            item.innerHTML = `
      <div class="notif-item-header">
        <span class="notif-kat notif-kat-${kat.color}">${kat.label}</span>
        <span class="notif-titul">${n.titul}</span>
        ${!n.precitana ? '<span class="notif-dot-nova"></span>' : ""}
      </div>
      <div class="notif-item-text">${n.text}</div>
      <div class="notif-item-cas">${formatCas(n.cas)}</div>
    `;
            item.addEventListener("click", () => {
              n.precitana = true;
              aktualizujBadge();
              item.classList.remove("nova");
              item.classList.add("precitana");
              item.querySelector(".notif-dot-nova")?.remove();
              uloz();
              ideNaCiel(n);
            });
            list.appendChild(item);
          });
        }

        // ── PRESKOK na miesto upozornenia ────────────────────────────
        function ideNaCiel(n) {
          const c = n.ciel;
          if (!c) return;
          try {
            if (c.typ === "den" && c.d) {
              // zmena odklikne mini kartu na tom dni a otvorí kartu dňa
              if (window.DpbZmeny && DpbZmeny.odklikni) DpbZmeny.odklikni(c.d, c.l, c.k);
              zavriet();
              if (window._otvorDen) window._otvorDen(c.d);
            } else if (c.typ === "burza") {
              zavriet();
              if (window._otvorBurzu) window._otvorBurzu(c.d || undefined);
            }
          } catch (e) {}
        }

        // ── PUBLIC: označ ako prečítané (volá zmeny.js a burza.js) ────
        function oznacPrecitane(pred) {
          let zmena = false;
          state.items.forEach((n) => {
            if (!n.precitana && pred(n)) {
              n.precitana = true;
              zmena = true;
            }
          });
          if (!zmena) return;
          aktualizujBadge();
          uloz();
          if (state.open) renderZoznam();
        }
        // všetky neprečítané zmeny pre konkrétny deň a kartu (linku/kurz)
        function precitajDen(d, l) {
          oznacPrecitane((n) => n.ciel && n.ciel.typ === "den" && n.ciel.d === d && (n.ciel.l || "") === (l || ""));
        }
        // celá kategória (napr. burza – stačí, že sa Burza zobrazí)
        function precitajKat(kat) {
          oznacPrecitane((n) => n.kat === kat);
        }

        // ── TOGGLE dropdown ──────────────────────────────────────────
        function toggle() {
          state.open = !state.open;
          const panel = document.getElementById("notifPanel");
          const btn = document.getElementById("notifBtn");
          if (!panel) return;

          if (state.open) {
            panel.classList.remove("hidden");
            btn.classList.add("active");
            renderZoznam();
            // Prečítané sa označí až ťuknutím na konkrétnu správu (alebo odklikom zmeny / otvorením Burzy).
          } else {
            panel.classList.add("hidden");
            btn.classList.remove("active");
          }
        }

        function zavriet() {
          state.open = false;
          document.getElementById("notifPanel")?.classList.add("hidden");
          document.getElementById("notifBtn")?.classList.remove("active");
        }

        // ── INIT ─────────────────────────────────────────────────────
        function init() {
          generujDemo();

          const btn = document.getElementById("notifBtn");
          if (btn)
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              toggle();
            });

          // Klik mimo — zavrieť
          document.addEventListener("click", (e) => {
            if (
              state.open &&
              !e.target.closest("#notifPanel") &&
              !e.target.closest("#notifBtn")
            ) {
              zavriet();
            }
          });

          aktualizujBadge();
        }

        return { init, pridaj, aktualizujBadge, zavriet, nastavVodica, precitajDen, precitajKat };
      })();

window.Notif = Notif;
