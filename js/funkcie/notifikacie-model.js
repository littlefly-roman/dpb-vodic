
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
                state.items.push({ id: uid(), kat: n.kat, titul: n.titul, text: n.text, cas: new Date(n.cas), precitana: !!n.precitana });
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
        function pridaj(titul, text, kat = "burza", cil) {
          state.items.unshift({
            id: uid(),
            kat,
            titul,
            text,
            cas: new Date(),
            precitana: false,
            cil: cil || null,
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
              if (n.cil && window.DpbIdiNa) {
                zavriet();
                window.DpbIdiNa(n.cil);
              }
            });
            if (n.cil) item.style.cursor = "pointer";
            list.appendChild(item);
          });
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
            // Označ všetky ako prečítané po 1.5s
            setTimeout(() => {
              state.items.forEach((n) => (n.precitana = true));
              aktualizujBadge();
              uloz();
              renderZoznam();
            }, 1500);
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

        return { init, pridaj, aktualizujBadge, zavriet, nastavVodica };
      })();

window.Notif = Notif;
