
      /* ==========================
   CALENDAR HELPER
   Určuje typ dňa pre grafikon:
   1 = pracovný deň
   2 = sobota
   3 = nedeľa / deň pracovného pokoja
   4 = pracovný deň počas školských prázdnin
========================== */

      const Calendar = (() => {
        // Dni pracovného pokoja 2026 – autorizované
        const HOLIDAYS_2026 = new Set([
          "2026-01-01",
          "2026-01-06",
          "2026-04-03",
          "2026-04-06",
          "2026-05-01",
          "2026-07-05",
          "2026-08-29",
          "2026-11-01",
          "2026-12-24",
          "2026-12-25",
          "2026-12-26",
        ]);

        // Školské prázdniny 2025/2026 – Bratislavský kraj – autorizované
        const SCHOOL_HOLIDAYS = [
          ["2025-10-30", "2025-10-31"],
          ["2025-12-22", "2026-01-07"],
          ["2026-02-02", "2026-02-02"],
          ["2026-02-16", "2026-02-20"],
          ["2026-04-02", "2026-04-07"],
          ["2026-07-01", "2026-08-31"],
          // jeseň a Vianoce 2026 – podľa GTFS DPB (platný 5.10.–31.12.2026, služba „Leto“);
          // po 31.12. doplniť z ďalšieho GTFS
          ["2026-10-29", "2026-10-30"],
          ["2026-12-23", "2026-12-31"],
        ];

        function toKey(date) {
          return (
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getDate()).padStart(2, "0")
          );
        }

        function parseDate(str) {
          const [y, m, d] = str.split("-").map(Number);
          return new Date(y, m - 1, d);
        }

        function isHoliday(date) {
          return HOLIDAYS_2026.has(toKey(date));
        }

        function isSchoolHoliday(date) {
          const key = toKey(date);
          return SCHOOL_HOLIDAYS.some(([from, to]) => key >= from && key <= to);
        }

        /**
         * 1 = pracovný deň
         * 2 = sobota
         * 3 = nedeľa / deň pracovného pokoja
         * 4 = pracovný deň počas školských prázdnin
         */
        function getDayType(date) {
          if (typeof date === "string") date = parseDate(date);
          const dow = date.getDay();
          if (dow === 0 || isHoliday(date)) return 3;
          if (dow === 6) return 2;
          if (isSchoolHoliday(date)) return 4;
          return 1;
        }

        function getDayTypeLabel(date) {
          return (
            {
              1: "Pracovný deň",
              2: "Sobota",
              3: "Nedeľa / sviatok",
              4: "Prázdniny",
            }[getDayType(date)] || "?"
          );
        }

        /**
         * Nájde najbližší platný priečinok s dátami.
         * folders = ["20260216", "20260101", ...]
         * Vráti najbližší priečinok <= dátumu služby.
         */
        function findDataFolder(dateKey, folders) {
          if (!folders || !folders.length) return null;
          var key = String(dateKey || "").replace(/-/g, "");
          var sorted = [...folders].sort(function (a, b) {
            return b.localeCompare(a);
          });
          // najnovší priečinok platný k danému dňu (názov = RRRRMMDD[_prípona])
          for (var i = 0; i < sorted.length; i++) {
            if (sorted[i].slice(0, 8) <= key) return sorted[i];
          }
          // dátum je pred všetkými grafikonmi -> najstarší dostupný
          return sorted[sorted.length - 1];
        }

        window.Calendar = {
          getDayType,
          getDayTypeLabel,
          findDataFolder,
          isHoliday,
          isSchoolHoliday,
        };
        return window.Calendar;
      })();
    