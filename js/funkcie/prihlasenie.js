
      document.addEventListener("DOMContentLoaded", function () {
        // Init notif
        Notif.init();
        document
          .getElementById("notifClose")
          .addEventListener("click", () => Notif.zavriet && Notif.zavriet());

        // Populate driver select
        const sel = document.getElementById("loginDriverSel");
        DPBData.getDrivers()
          .filter((d) => parseInt(d.rid) < 99000)
          .forEach((d) => {
            const o = document.createElement("option");
            o.value = d.rid;
            o.textContent = d.meno;
            sel.appendChild(o);
          });

        const btn = document.getElementById("loginBtn");
        sel.addEventListener("change", () => {
          btn.disabled = !sel.value;
          // v strede kolotoča sa zastaví domovská trakcia vybraného vodiča
          if (sel.value && window.DpbIkony && DPBData.getTrakciaKod)
            DpbIkony.nastavPodlaKodu(DPBData.getTrakciaKod(sel.value));
        });

        btn.addEventListener("click", function () {
          if (!sel.value) return;
          window.appState.currentDriver = sel.value;
          try {
            localStorage.setItem(
              "dpb_relacia",
              JSON.stringify({ rid: sel.value, ts: Date.now() }),
            );
          } catch (e) {}
          window.appState.servicesByDate = {};

          // Pick last available date
          const availDates = Array.from(
            DPBData.getDatesWithService(sel.value),
          ).sort();
          const today = new Date();
          const todayKey =
            today.getFullYear() +
            "-" +
            String(today.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(today.getDate()).padStart(2, "0");
          let pick = availDates.includes(todayKey) ||
            (availDates.length && availDates[0] <= todayKey && todayKey <= availDates[availDates.length - 1])
            ? todayKey
            : availDates.filter((d) => d <= todayKey).slice(-1)[0] ||
              availDates[0];
          if (pick) {
            const [y, m, d] = pick.split("-").map(Number);
            window.appState.selectedDate = new Date(y, m - 1, d);
          }

          document.getElementById("loginScreen").classList.add("hidden");
          if (window.Notif && Notif.nastavVodica) Notif.nastavVodica(sel.value);
          window._render();
          if (window.DpbZmeny) DpbZmeny.skontroluj();
        });
      });
    