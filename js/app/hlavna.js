
      (() => {
        const {
          formatDateKey,
          formatDisplayDate,
          formatMonthTitle,
          isToday,
          isSameDay,
          timeToSeconds,
        } = window.DpbCas;
        const { loadText, loadJR, doplnSM, popisSpoja, skolskaLinka, cielSkolskehoSpoja, jeSluzobna, jeDp, extractObeh, parseSpoje, parseKV, parseSM } =
          window.GrafikonParsery;

        /* ==========================
   STATE
========================== */

        /* ==========================
   BURZA BRIDGE
   Prepojenie burzy s kalendárom vodiča
========================== */

        function getBurzaSluzbyPreDen(dateKey) {
          if (typeof Burza === "undefined") return [];
          return Burza.getVolnePreDen(dateKey);
        }

        window.aplikujBurzuDoKalendara = function (rezervacia) {
          // Po schválení rezervácie pridaj službu do kalendára vodiča
          const key = rezervacia.dateKey;
          if (!appState.servicesByDate[key]) appState.servicesByDate[key] = [];
          appState.servicesByDate[key].push({
            line: rezervacia.line,
            linka: /\d+\/\d+/.test(rezervacia.line) ? parseInt(rezervacia.line.split("/")[0]) : "",
            kurz: /\d+\/\d+/.test(rezervacia.line) ? parseInt(rezervacia.line.split("/")[1]) : "",
            vehicle: "—",
            time: rezervacia.cas,
            route: rezervacia.od && rezervacia.kam ? `${rezervacia.od} → ${rezervacia.kam}` : "",
            before: null,
            after: null,
            _zBurzy: true,
          });
          // Prerender ak je tento deň zobrazený
          const sel = appState.selectedDate;
          const selKey =
            sel.getFullYear() +
            "-" +
            String(sel.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(sel.getDate()).padStart(2, "0");
          if (selKey === key) render();
        };

        const appState = {
          selectedDate: new Date(),
          servicesByDate: {},
          viewMode: "cards",
          mainView: "services",
          grafikonInterval: null,
          dataFolders: [
            "20260216",
            "20260829",
            "20260901",
            "20260904",
            "20260904_corr",
            "20260907",
            "20260915",
            "20260919",
            "20260926",
            "20261003",
          ],
        };

        /* ==========================
   DOM
========================== */

        const container = document.getElementById("servicesContainer");
        const dateHeader = document.getElementById("todayDate");
        const btnList = document.getElementById("btnList");
        const btnToday = document.getElementById("btnToday");
        const calendarPanel = document.getElementById("calendarPanel");
        const grafikonModal = document.getElementById("grafikonModal");
        const grafikonContent = document.getElementById("grafikonContent");
        const grafikonLeft = document.getElementById("grafikonLeft");
        const grafikonRight = document.getElementById("grafikonRight");
        const grafikonLive = document.getElementById("grafikonLive");
        const closeGrafikonBtn = document.getElementById("closeGrafikon");
        const toast = document.getElementById("toast");
        const dpbToggle = document.getElementById("dpbToggle");
        const servicesView = document.getElementById("servicesView");
        const employerView = document.getElementById("employerView");

        /* ==========================
   HELPERS
========================== */

        let toastTimer = null;
        function showToast(msg, duration = 2200) {
          toast.textContent = msg;
          toast.classList.add("show");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(
            () => toast.classList.remove("show"),
            duration,
          );
        }

        /* ==========================
   PREPÍNANIE HLAVNÉHO POHĽADU
========================== */

        dpbToggle.addEventListener("click", () => {
          document.getElementById("burzaView").classList.add("hidden");
          document.getElementById("profilView").classList.add("hidden");
          if (appState.mainView === "services") {
            servicesView.classList.add("hidden");
            employerView.classList.remove("hidden");
            dpbToggle.classList.add("active-view");
            appState.mainView = "employer";
          } else {
            employerView.classList.add("hidden");
            servicesView.classList.remove("hidden");
            dpbToggle.classList.remove("active-view");
            appState.mainView = "services";
          }
        });

        /* ==========================
   EMPLOYER VIEW
========================== */

        const employerStructure = {
          DEaT: {
            label: "Divízia električ. a trolejbusov",
            operations: {
              DPE: {
                label: "Prevádzka električka",
                workplaces: ["Jurajov dvor", "Krasňany"],
              },
              DPT: {
                label: "Prevádzka trolejbus",
                workplaces: ["Hroboňova", "Trnávka"],
              },
            },
          },
          DA: {
            label: "Divízia autobusov",
            operations: {
              "I.DPA": { label: "1. prevádzka autobus", workplaces: [] },
              "II.DPA": { label: "2. prevádzka autobus", workplaces: [] },
              "III.DPA": { label: "3. prevádzka autobus", workplaces: [] },
            },
          },
        };

        let activeDiv = "DEaT";
        let activeOp = "DPE";
        let activeWp = "Jurajov dvor";

        function renderEmployer() {
          const divRow = document.getElementById("divisionRow");
          const opRow = document.getElementById("operationRow");
          const wpRow = document.getElementById("workplaceRow");
          const content = document.getElementById("overlayContent");

          divRow.innerHTML = "";
          opRow.innerHTML = "";
          wpRow.innerHTML = "";
          wpRow.style.display = "none";

          // Divízie
          Object.keys(employerStructure).forEach((divKey) => {
            const btn = document.createElement("button");
            btn.className =
              "hier-btn" + (divKey === activeDiv ? " active" : "");
            btn.textContent = divKey;
            btn.title = employerStructure[divKey].label;
            btn.addEventListener("click", () => {
              activeDiv = divKey;
              activeOp = Object.keys(employerStructure[divKey].operations)[0];
              activeWp =
                employerStructure[divKey].operations[activeOp].workplaces[0] ||
                null;
              renderEmployer();
            });
            divRow.appendChild(btn);
          });

          // Prevádzky
          const ops = employerStructure[activeDiv].operations;
          Object.keys(ops).forEach((opKey) => {
            const btn = document.createElement("button");
            btn.className = "hier-btn" + (opKey === activeOp ? " active" : "");
            btn.textContent = opKey;
            btn.title = ops[opKey].label;
            btn.addEventListener("click", () => {
              activeOp = opKey;
              activeWp = ops[opKey].workplaces[0] || null;
              renderEmployer();
            });
            opRow.appendChild(btn);
          });

          // Pracoviská – zobraziť len ak existujú
          const workplaces = ops[activeOp]?.workplaces || [];
          if (workplaces.length > 0) {
            wpRow.style.display = "";
            workplaces.forEach((wp) => {
              const btn = document.createElement("button");
              btn.className = "hier-btn" + (wp === activeWp ? " active" : "");
              btn.textContent = wp;
              btn.addEventListener("click", () => {
                activeWp = wp;
                renderEmployer();
              });
              wpRow.appendChild(btn);
            });
          } else {
            wpRow.style.display = "none";
          }

          // Kontakty
          const contacts = window.DpbKontakty
            ? window.DpbKontakty.zamestnanciPre(activeOp, activeWp)
            : [];

          const title =
            ops[activeOp]?.label + (activeWp ? " – " + activeWp : "");
          content.innerHTML = `<div class="hier-section-title">${title}</div>`;
          if (!contacts.length)
            content.insertAdjacentHTML(
              "beforeend",
              '<div style="color:var(--text-3);font-size:15px;padding:12px 2px">Kontakty sa pripravujú.</div>',
            );

          contacts.forEach((p) => {
            const card = document.createElement("div");
            card.className = "person-card";
            card.innerHTML = `
      <div class="person-role">${p.role}</div>
      <div class="person-name">${p.name}</div>
      <div class="person-contacts">
        ${p.mobil ? `<a href="tel:${p.mobil.replace(/\s/g, "")}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> ${p.mobil}</a>` : ""}
        ${p.pevna ? `<a href="tel:${p.pevna.replace(/\s/g, "")}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93 19.79 19.79 0 0 1 1.61 3.3 2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7A16 16 0 0 0 14 15.76l.94-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg> ${p.pevna}</a>` : ""}
        ${p.email ? `<a href="mailto:${p.email}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> ${p.email}</a>` : ""}
      </div>
    `;
            content.appendChild(card);
          });
        }

        renderEmployer();

        /* ==========================
   RENDER
========================== */

        function render() {
          // DPB: ensure current date is loaded before rendering
          if (appState.currentDriver && typeof DPBData !== "undefined") {
            const d = appState.selectedDate;
            const key =
              d.getFullYear() +
              "-" +
              String(d.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(d.getDate()).padStart(2, "0");
            if (!appState.servicesByDate[key]) {
              appState.servicesByDate[key] = DPBData.getServicesForDate(
                appState.currentDriver,
                key,
              );
            }
          }
          if (window._ikonaPrepnutia) window._ikonaPrepnutia(appState.viewMode);
          if (appState.viewMode === "cards") renderCards();
          else renderList();

          if (!calendarPanel.classList.contains("hidden")) {
            calendarMonth = appState.selectedDate.getMonth();
            calendarYear = appState.selectedDate.getFullYear();
            renderCalendar();
          }
        }

        /* ==========================
   CARDS
========================== */

        // Karta „Voľno“ s burzou prepne okno na flex-stĺpec; pri každom novom vykreslení ho treba vrátiť,
        // inak sa zoznam mesiaca stlačí na tenké prázdne pruhy.
        function resetContainerLayout() {
          container.style.display = "";
          container.style.flexDirection = "";
          container.style.height = "";
        }

        // Menu na karte „Voľno“ (tri bodky vpravo hore): položky podľa toho, či je deň minulý, dnešný alebo budúci
        function pridajMenuVolno(volno, kluc) {
          const dnes = formatDateKey(new Date());
          const polozky = [];
          if (kluc < dnes) polozky.push({ a: "reklamacia", t: "Reklamácia" });
          else {
            polozky.push({ a: "ziadost_sluzba", t: "Žiadosť o službu" });
            polozky.push({ a: "zmena_stavu", t: "Zmena stavu" });
          }
          volno.classList.add("volno-s-menu");
          const mb = document.createElement("div");
          mb.className = "card-menu-btn service-menu-trigger volno-menu-btn";
          mb.innerHTML =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
          const menu = document.createElement("div");
          menu.className = "service-menu volno-menu";
          polozky.forEach(function (it) {
            const d = document.createElement("div");
            d.className = "menu-item";
            d.textContent = it.t;
            d.addEventListener("click", function (e) {
              e.stopPropagation();
              if (it.a === "reklamacia" && window.DpbReklamacia) window.DpbReklamacia.otvor({ date: kluc, volno: true });
              else if (it.a === "ziadost_sluzba" && window.DpbZiadostSluzby) window.DpbZiadostSluzby.otvor({ date: kluc });
              else if (it.a === "zmena_stavu" && window.DpbZmenaStavu) window.DpbZmenaStavu.otvor({ date: kluc, volno: true });
              else if (window._showToast) window._showToast("Pripravuje sa");
              closeAllGlobal();
            });
            menu.appendChild(d);
          });
          const cd = document.createElement("div");
          cd.className = "menu-item menu-item-cancel";
          cd.textContent = "Zrušiť";
          cd.addEventListener("click", function (e) { e.stopPropagation(); closeAllGlobal(); });
          menu.appendChild(cd);
          mb.addEventListener("click", function (e) {
            e.stopPropagation();
            const bolo = menu.classList.contains("active");
            closeAllGlobal();
            if (!bolo) { menu.classList.add("active"); mb.classList.add("open"); }
          });
          volno.appendChild(mb);
          volno.appendChild(menu);
        }

        function renderCards() {
          const key = formatDateKey(appState.selectedDate);
          const services = appState.servicesByDate[key] || [];

          dateHeader.innerHTML = formatDisplayDate(appState.selectedDate);
          dateHeader.classList.toggle("je-dnes", formatDateKey(appState.selectedDate) === formatDateKey(new Date()));
          container.innerHTML = "";
          resetContainerLayout();

          if (services.length === 0) {
            const selKey =
              appState.selectedDate.getFullYear() +
              "-" +
              String(appState.selectedDate.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(appState.selectedDate.getDate()).padStart(2, "0");
            const jeVBuduco = appState.selectedDate > new Date();
            const burzaSluzby = jeVBuduco ? getBurzaSluzbyPreDen(selKey) : [];
            const maVBurze = burzaSluzby.length > 0;

            const volno = document.createElement("div");
            volno.className = "volno-card";
            volno.innerHTML = `
      <div class="volno-icon"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
      <div class="volno-text">Voľno</div>
    `;
            pridajMenuVolno(volno, selKey);

            container.appendChild(volno);
            if (maVBurze) {
              const r = document.createElement("button");
              r.type = "button";
              r.className = "burza-link-row";
              r.textContent = "Z burzy sa dá pridať: " + burzaSluzby.length + " " + (burzaSluzby.length === 1 ? "služba" : burzaSluzby.length < 5 ? "služby" : "služieb") + "  ›";
              r.addEventListener("click", () => otvorBurzuPreDen(selKey));
              container.appendChild(r);
            }
            return;
          }

          const fragment = document.createDocumentFragment();

          services.forEach((service) => {
            // DPB: use new card builder if available
            if (service._vzor && typeof window.buildNewCard === "function") {
              service.date = key;
              fragment.appendChild(window.buildNewCard(service));
              return;
            }
            const card = document.createElement("div");
            card.className = "service-card";

            // ── Vodič (striedam / strieda ma) ──
            function buildDriverSection(driver, align) {
              if (!driver) return null;
              const sec = document.createElement("div");
              sec.className = "driver-section driver-" + align;

              const nameEl = document.createElement("div");
              nameEl.className = "driver-name";
              const arrow = align === "left" ? "↑" : "↓";
              nameEl.innerHTML = `<span class="drv-swap">${arrow}</span><span class="drv-text">${driver.name}</span>`;

              if (driver.phone) {
                const chev = document.createElement("span");
                chev.className = "chevron";
                chev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
                nameEl.appendChild(chev);

                const contact = document.createElement("div");
                contact.className = "driver-contact";
                contact.innerHTML = `<a class="driver-phone" href="tel:${driver.phone.replace(/\s/g, "")}"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93 19.79 19.79 0 0 1 1.61 3.3 2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7A16 16 0 0 0 14 15.76l.94-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg> ${driver.phone}</a>`;
                sec.appendChild(nameEl);
                sec.appendChild(contact);

                nameEl.addEventListener("click", (e) => {
                  e.stopPropagation();
                  const isOpen = contact.classList.contains("active");
                  closeAllGlobal();
                  if (!isOpen) {
                    contact.classList.add("active");
                    nameEl.classList.add("open");
                    scrollCardIntoView(card);
                  }
                });
              } else {
                sec.appendChild(nameEl);
              }
              return sec;
            }

            const beforeSection = buildDriverSection(service.before, "left");
            const afterSection = buildDriverSection(service.after, "right");

            // ── Hlavná sekcia služby ──
            const main = document.createElement("div");
            main.className = "service-main";
            main.innerHTML = `
      <div class="service-head">
        <span class="service-title clickable-line">${service.line}</span>
        <span class="service-menu-trigger"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></span>
      </div>
      <div class="service-meta">
        <div class="service-meta-item">
          <span class="service-meta-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          <span class="service-meta-val">${service.time}</span>
        </div>
        <div class="service-meta-item">
          <span class="service-meta-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
          <span class="service-meta-val">${service.route}</span>
        </div>
        <div class="service-meta-item">
          <span class="service-meta-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>
          <span class="service-meta-val">Vozidlo ${service.vehicle}</span>
        </div>
      </div>
    `;

            const menuTrigger = main.querySelector(".service-menu-trigger");

            // ── Riadok vodičov ──
            const driversRow = document.createElement("div");
            driversRow.className = "drivers-row";
            if (beforeSection) driversRow.appendChild(beforeSection);
            if (afterSection) driversRow.appendChild(afterSection);

            const menu = document.createElement("div");
            menu.className = "service-menu";
            menu.innerHTML = `
      <div class="menu-item" data-action="grafikon"><span class="menu-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span> Grafikon</div>
      <div class="menu-item" data-action="vymena"><span class="menu-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></span> Požiadať o výmenu</div>
      <div class="menu-item" data-action="stav"><span class="menu-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> Zmeniť stav</div>
    `;

            if (beforeSection) card.appendChild(beforeSection);
            card.appendChild(main);
            if (afterSection) card.appendChild(afterSection);
            card.appendChild(menu);

            card.addEventListener("click", (e) => {
              if (
                e.target.closest(".driver-name") ||
                e.target.closest(".driver-contact") ||
                e.target.closest(".clickable-line") ||
                e.target.closest(".service-menu-trigger")
              )
                return;
              const isOpen = menu.classList.contains("active");
              closeAllGlobal();
              if (!isOpen) {
                menu.classList.add("active");
                card.classList.add("menu-open");
                menuTrigger.classList.add("open");
                scrollCardIntoView(card);
              }
            });

            menuTrigger.addEventListener("click", (e) => {
              e.stopPropagation();
              const isOpen = menu.classList.contains("active");
              closeAllGlobal();
              if (!isOpen) {
                menu.classList.add("active");
                card.classList.add("menu-open");
                menuTrigger.classList.add("open");
                scrollCardIntoView(card);
              }
            });

            menu.querySelectorAll(".menu-item").forEach((item) => {
              item.addEventListener("click", (e) => {
                e.stopPropagation();
                if (item.dataset.action === "grafikon") openGrafikon(service);
                else if (item.dataset.action === "vymena")
                  showToast("Žiadosť o výmenu odoslaná");
                else if (item.dataset.action === "stav")
                  showToast("Zmena stavu – pripravujeme…");
                closeAllGlobal();
              });
            });

            main
              .querySelector(".clickable-line")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                openGrafikon(service);
              });

            fragment.appendChild(card);
          });

          container.appendChild(fragment);
          (function () {
            if (!(appState.selectedDate > new Date())) return;
            var bs = getBurzaSluzbyPreDen(key);
            if (!bs.length) return;
            var r = document.createElement("button");
            r.type = "button";
            r.className = "burza-link-row";
            r.textContent = "Z burzy sa dá pridať: " + bs.length + " " + (bs.length === 1 ? "služba" : bs.length < 5 ? "služby" : "služieb") + "  ›";
            r.addEventListener("click", function () { otvorBurzuPreDen(key); });
            container.appendChild(r);
          })();
        }

        /* ==========================
   INTERACTIONS
========================== */

        function closeAllGlobal() {
          container
            .querySelectorAll(".service-menu")
            .forEach((m) => m.classList.remove("active"));
          container
            .querySelectorAll(".driver-contact")
            .forEach((c) => c.classList.remove("active"));
          container
            .querySelectorAll(".driver-name")
            .forEach((n) => n.classList.remove("open"));
          container
            .querySelectorAll(".service-card")
            .forEach((c) => c.classList.remove("menu-open"));
          container
            .querySelectorAll(".service-menu-trigger")
            .forEach((t) => t.classList.remove("open"));
        }

        function scrollCardIntoView(card) {
          const cr = container.getBoundingClientRect();
          const br = card.getBoundingClientRect();
          const p = 12;
          if (br.top < cr.top + p)
            container.scrollBy({
              top: br.top - cr.top - p,
              behavior: "smooth",
            });
          else if (br.bottom > cr.bottom - p)
            container.scrollBy({
              top: br.bottom - cr.bottom + p,
              behavior: "smooth",
            });
        }

        document.addEventListener("click", (e) => {
          if (
            !e.target.closest(".service-card") &&
            !e.target.closest(".grafikon-modal")
          )
            closeAllGlobal();
        });

        /* ==========================
   LIST
========================== */

        const DAY_NAMES = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

        function renderList() {
          container.innerHTML = "";
          resetContainerLayout();
          const year = appState.selectedDate.getFullYear();
          const month = appState.selectedDate.getMonth();
          // Mesiac rovnakým štýlom ako date-date
          dateHeader.innerHTML = `<span class="date-date" style="text-transform:capitalize">${formatMonthTitle(appState.selectedDate)}</span>`;

          const lastDay = new Date(year, month + 1, 0).getDate();

          // DPB: prefill all days in this month
          if (appState.currentDriver && typeof DPBData !== "undefined") {
            for (let d = 1; d <= lastDay; d++) {
              const key = formatDateKey(new Date(year, month, d));
              if (!appState.servicesByDate[key]) {
                appState.servicesByDate[key] = DPBData.getServicesForDate(
                  appState.currentDriver,
                  key,
                );
              }
            }
          }

          const fragment = document.createDocumentFragment();

          for (let d = 1; d <= lastDay; d++) {
            const date = new Date(year, month, d);
            const key = formatDateKey(date);
            const services = appState.servicesByDate[key] || [];
            const today = isToday(date);
            const dayName = DAY_NAMES[date.getDay()];
            const dow = date.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isHoliday =
              window.Calendar && window.Calendar.isHoliday(date);
            const group = document.createElement("div");
            group.className =
              "list-day-group" +
              (isHoliday ? " is-holiday" : isWeekend ? " is-weekend" : "");

            if (services.length === 0) {
              const row = buildListRow(
                d,
                dayName,
                "Voľno",
                "",
                today,
                true,
                false,
              );
              row.addEventListener("click", () => {
                appState.selectedDate = date;
                appState.viewMode = "cards";
                render();
              });
              group.appendChild(row);
            } else {
              services.forEach((s, i) => {
                const isSluzba =
                  s._vzor !== "NEPRÍTOMNOSŤ" && s._vzor !== "VOLNO";
                const row = buildListRow(
                  i === 0 ? d : "",
                  i === 0 ? dayName : "",
                  s.line,
                  s.time,
                  today && i === 0,
                  false,
                  isHoliday && isSluzba,
                );
                row.addEventListener("click", () => {
                  appState.selectedDate = date;
                  appState.viewMode = "cards";
                  render();
                });
                group.appendChild(row);
              });
            }
            fragment.appendChild(group);
          }
          container.appendChild(fragment);
        }

        function buildListRow(
          date,
          dayName,
          line,
          time,
          today,
          volno,
          sviatokSluzba,
        ) {
          const row = document.createElement("div");
          row.className = "list-row" + (today ? " is-today" : "");
          const lineClass =
            "list-line" +
            (volno ? " volno" : "") +
            (sviatokSluzba ? " sviatok-sluzba" : "");
          row.innerHTML = `
    <div class="list-date">${date}</div>
    <div class="list-day-name">${dayName}</div>
    <div class="${lineClass}">${line}</div>
    <div class="list-time">${time}</div>
  `;
          return row;
        }

        /* ==========================
   SWIPE
========================== */

        let touchStartX = 0,
          touchStartY = 0,
          isSwiping = false,
          swipeAnimating = false;
        let swipeGhost = null,
          swipeDir = 0;
        const SWIPE_THRESHOLD = 50;
        const swipeWrapper = document.getElementById("swipeWrapper");

        function buildGhostForOffset(offset) {
          const ghost = document.createElement("div");
          ghost.className = "swipe-slide-ghost";

          if (appState.viewMode === "cards") {
            const d = new Date(appState.selectedDate);
            d.setDate(d.getDate() + offset);
            const key = formatDateKey(d);
            if (
              !appState.servicesByDate[key] &&
              appState.currentDriver &&
              typeof DPBData !== "undefined"
            ) {
              appState.servicesByDate[key] = DPBData.getServicesForDate(
                appState.currentDriver,
                key,
              );
            }
            // header
            // cards — shallow clone of what renderCards would produce (no date header — stays fixed above)
            const services = appState.servicesByDate[key] || [];
            if (services.length === 0) {
              const v = document.createElement("div");
              v.className = "volno-card";
              v.innerHTML =
                '<div class="volno-icon"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><div class="volno-text">Voľno</div>';
              ghost.appendChild(v);
            } else {
              services.forEach((s) => {
                if (s._vzor && typeof window.buildNewCard === "function") {
                  const tmpService = Object.assign({}, s, { date: key });
                  try {
                    ghost.appendChild(window.buildNewCard(tmpService));
                  } catch (e) {}
                } else {
                  const c = document.createElement("div");
                  c.className = "service-card";
                  const t = document.createElement("div");
                  t.className = "service-title";
                  t.textContent = s.line;
                  const tm = document.createElement("div");
                  tm.className = "service-time";
                  tm.textContent = s.time;
                  c.appendChild(t);
                  c.appendChild(tm);
                  ghost.appendChild(c);
                }
              });
            }
          } else {
            // list mode — no header in ghost, just spacer so content starts at same vertical offset
          }
          return ghost;
        }

        swipeWrapper.addEventListener(
          "touchstart",
          (e) => {
            if (grafikonModal.classList.contains("active") || swipeAnimating)
              return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
            swipeDir = 0;
            container.classList.remove("swipe-anim");
          },
          { passive: true },
        );

        swipeWrapper.addEventListener(
          "touchmove",
          (e) => {
            if (!isSwiping || grafikonModal.classList.contains("active"))
              return;
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            if (Math.abs(deltaY) > Math.abs(deltaX) + 8) {
              isSwiping = false;
              _cleanGhost();
              return;
            }

            const newDir = deltaX < 0 ? -1 : 1;

            // smer sa zmenil — znič starý ghost
            if (swipeGhost && newDir !== swipeDir) {
              _cleanGhost();
            }

            // vytvor ghost ak ešte neexistuje
            if (!swipeGhost && Math.abs(deltaX) > 8) {
              swipeDir = newDir;
              swipeGhost = buildGhostForOffset(-newDir); // -1 = nasledujúci (príde zľava pri swipe left)
              const _gap = 32;
              const ghostStart =
                newDir < 0
                  ? swipeWrapper.offsetWidth + _gap
                  : -(swipeWrapper.offsetWidth + _gap);
              swipeGhost.style.transform = `translateX(${ghostStart}px)`;
              swipeWrapper.appendChild(swipeGhost);
            }

            if (swipeGhost) {
              const w = swipeWrapper.offsetWidth + 32;
              const ghostBase = swipeDir < 0 ? w : -w;
              container.style.transform = `translateX(${deltaX}px)`;
              swipeGhost.style.transform = `translateX(${ghostBase + deltaX}px)`;
            } else {
              container.style.transform = `translateX(${deltaX}px)`;
            }
          },
          { passive: true },
        );

        function _cleanGhost() {
          if (swipeGhost) {
            swipeGhost.remove();
            swipeGhost = null;
          }
          swipeDir = 0;
        }

        function finishSwipe(direction) {
          swipeAnimating = true;
          const w = swipeWrapper.offsetWidth;
          const exitTo = direction < 0 ? -w : w;
          const ghostFinal = 0;

          container.classList.add("swipe-anim");
          container.style.transform = `translateX(${exitTo}px)`;
          if (swipeGhost) {
            swipeGhost.classList.add("swipe-anim");
            swipeGhost.style.transform = `translateX(${ghostFinal}px)`;
          }

          setTimeout(() => {
            container.classList.remove("swipe-anim");
            _cleanGhost();
            container.style.transform = "";
            if (direction < 0) {
              appState.viewMode === "cards" ? changeDay(1) : changeMonth(1);
            } else {
              appState.viewMode === "cards" ? changeDay(-1) : changeMonth(-1);
            }
            swipeAnimating = false;
          }, 290);
        }

        swipeWrapper.addEventListener(
          "touchend",
          (e) => {
            if (!isSwiping || grafikonModal.classList.contains("active"))
              return;
            const diffX = e.changedTouches[0].clientX - touchStartX;
            isSwiping = false;

            if (diffX < -SWIPE_THRESHOLD) {
              finishSwipe(-1);
            } else if (diffX > SWIPE_THRESHOLD) {
              finishSwipe(1);
            } else {
              // vráť späť
              container.classList.add("swipe-anim");
              container.style.transform = "";
              if (swipeGhost) {
                const w = swipeWrapper.offsetWidth;
                swipeGhost.classList.add("swipe-anim");
                swipeGhost.style.transform = `translateX(${swipeDir < 0 ? w : -w}px)`;
              }
              setTimeout(() => {
                container.classList.remove("swipe-anim");
                _cleanGhost();
              }, 290);
            }
          },
          { passive: true },
        );

        function changeDay(offset) {
          const d = new Date(appState.selectedDate);
          d.setDate(d.getDate() + offset);
          appState.selectedDate = d;
          render();
        }

        function changeMonth(offset) {
          const d = new Date(appState.selectedDate);
          d.setMonth(d.getMonth() + offset);
          const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(appState.selectedDate.getDate(), max));
          appState.selectedDate = d;
          render();
        }

        /* ==========================
   KALENDÁR
========================== */

        let calendarMonth = appState.selectedDate.getMonth();
        let calendarYear = appState.selectedDate.getFullYear();

        // Klik na dátum otvára/zatvára kalendár
        dateHeader.addEventListener("click", () => {
          if (!calendarPanel.classList.contains("hidden")) {
            calendarPanel.classList.add("hidden");
            return;
          }
          calendarMonth = appState.selectedDate.getMonth();
          calendarYear = appState.selectedDate.getFullYear();
          renderCalendar();
          calendarPanel.classList.remove("hidden");
        });

        function renderCalendar() {
          calendarPanel.innerHTML = "";

          const header = document.createElement("div");
          header.className = "calendar-header";

          const prev = document.createElement("button");
          prev.textContent = "‹";
          prev.addEventListener("click", () => {
            calendarMonth--;
            if (calendarMonth < 0) {
              calendarMonth = 11;
              calendarYear--;
            }
            renderCalendar();
          });

          const title = document.createElement("div");
          title.className = "cal-title";
          const ts = new Date(calendarYear, calendarMonth).toLocaleDateString(
            "sk-SK",
            { month: "long", year: "numeric" },
          );
          title.textContent = ts.charAt(0).toUpperCase() + ts.slice(1);

          const next = document.createElement("button");
          next.textContent = "›";
          next.addEventListener("click", () => {
            calendarMonth++;
            if (calendarMonth > 11) {
              calendarMonth = 0;
              calendarYear++;
            }
            renderCalendar();
          });

          header.append(prev, title, next);
          calendarPanel.appendChild(header);

          const weekdays = document.createElement("div");
          weekdays.className = "calendar-weekdays";
          ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].forEach((d) => {
            const wd = document.createElement("div");
            wd.className = "calendar-weekday";
            wd.textContent = d;
            weekdays.appendChild(wd);
          });
          calendarPanel.appendChild(weekdays);

          const grid = document.createElement("div");
          grid.className = "calendar-grid";
          const startDay =
            (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
          const daysInMonth = new Date(
            calendarYear,
            calendarMonth + 1,
            0,
          ).getDate();

          for (let i = 0; i < startDay; i++)
            grid.appendChild(document.createElement("div"));

          for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(calendarYear, calendarMonth, d);
            const key = formatDateKey(cellDate);
            const cell = document.createElement("div");
            cell.className = "calendar-cell";
            cell.textContent = d;
            if (isToday(cellDate)) cell.classList.add("today");
            if (isSameDay(cellDate, appState.selectedDate))
              cell.classList.add("selected");
            // služby dňa načítame pre celý mesiac (nielen pre dni, ktoré si už otvoril)
            if (!appState.servicesByDate[key] && appState.currentDriver)
              appState.servicesByDate[key] = DPBData.getServicesForDate(appState.currentDriver, key);
            if (window.DpbKalZnacky) DpbKalZnacky.pridaj(cell, appState.servicesByDate[key] || []);
            else if ((appState.servicesByDate[key] || []).length > 0) cell.classList.add("has-service");
            if (Calendar.isHoliday(cellDate)) cell.classList.add("is-holiday");
            cell.addEventListener("click", () => {
              appState.selectedDate = cellDate;
              appState.viewMode = "cards";
              calendarPanel.classList.add("hidden");
              render();
            });
            grid.appendChild(cell);
          }
          calendarPanel.appendChild(grid);
        }

        /* ==========================
   GRAFIKON – PARSER
========================== */

        /* ==========================
   GRAFIKON – MODAL
========================== */

        async function openGrafikon(service) {
          const dateKey = formatDateKey(appState.selectedDate);
          // zCP = otvorené zo Službového cestovného poriadku: LIVE tlačidlo je dostupné vždy
          // (sleduje aktuálny čas dňa), ale predvolene vypnuté. Z dashboardu (dnes) je LIVE zapnutý.
          const today = isToday(appState.selectedDate) || !!service.zCP;

          if (appState.grafikonInterval) {
            clearInterval(appState.grafikonInterval);
            appState.grafikonInterval = null;
          }

          // LIVE prepínač: zapnutý = poriadok sleduje aktuálny čas (posun na „Teraz“),
          // vypnutý = len ručné rolovanie, pozícia sa pri obnovení nemení.
          appState.grafikonFollow = !service.zCP;
          grafikonLive.classList.toggle("off", !appState.grafikonFollow);
          grafikonLive.textContent = appState.grafikonFollow ? "● LIVE" : "○ LIVE";
          grafikonLive.setAttribute("aria-pressed", appState.grafikonFollow ? "true" : "false");
          grafikonModal.classList.add("active");
          grafikonContent.innerHTML = `<div class="grafikon-loading">Načítavam grafikon…</div>`;
          grafikonLeft.textContent = `Linka ${service.line}`;
          grafikonRight.textContent = `Vozidlo ${service.vehicle}`;
          grafikonLive.classList.add("hidden");

          const folder = Calendar.findDataFolder(dateKey, appState.dataFolders);
          if (!folder) {
            grafikonContent.innerHTML = `<div class="grafikon-error">Dáta pre tento dátum nie sú dostupné.</div>`;
            return;
          }

          const base = `data/${folder}/`;
          const linka = service.linka || parseInt(service.line.split("/")[0]);
          const kurz = String(
            service.kurz || service.line.split("/")[1],
          ).padStart(2, "0");
          const typ = service.typ || Calendar.getDayType(appState.selectedDate);
          const obehCode = "#" + String(linka).padStart(3, "0") + kurz + typ;

          const [jr, sm, cileText, staniceText] = await Promise.all([
            loadJR(base, linka, [obehCode]),
            loadText(base + linka + ".SM"),
            loadText(base + "CILE.CL"),
            loadText(base + "STANICE.ZS"),
          ]);

          if (!jr || !sm || !cileText || !staniceText) {
            grafikonContent.innerHTML = `<div class="grafikon-error">Nepodarilo sa načítať dáta.</div>`;
            return;
          }

          const stanice = parseKV(staniceText);
          const ciele = parseKV(cileText);
          const smMapa = parseSM(sm);
          const spoje = parseSpoje(extractObeh(jr, obehCode));
          await doplnSM(base, smMapa, spoje);

          if (spoje.length === 0) {
            grafikonContent.innerHTML = `<div class="grafikon-error">Grafikon nenájdený (${obehCode})</div>`;
            return;
          }

          const times = service.time.match(/(\d{1,2}:\d{2})/g) || [];
          const startSec = times[0] ? timeToSeconds(times[0] + ":00") : null;
          const endSec = times[1] ? timeToSeconds(times[1] + ":00") : null;
          const strRanges = (service.strTime || "")
            .split("|")
            .map(function (r) {
              const m = r.match(/(\d{1,2}:\d{2})/g) || [];
              return m.length >= 2
                ? {
                    s: timeToSeconds(m[0] + ":00"),
                    e: timeToSeconds(m[1] + ":00"),
                  }
                : null;
            })
            .filter(Boolean);

          function draw() {
            const ulozenaPozicia = grafikonContent.scrollTop;
            const now = new Date();
            const nowSec =
              now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            renderGrafikonContent(
              spoje,
              stanice,
              ciele,
              smMapa,
              startSec,
              endSec,
              nowSec,
              today,
              strRanges,
              linka,
              kurz,
              typ,
            );
            if (!appState.grafikonFollow) grafikonContent.scrollTop = ulozenaPozicia;
          }

          draw();
          window._grafikonRedraw = draw;

          if (today) {
            grafikonLive.classList.remove("hidden");
            appState.grafikonInterval = setInterval(() => {
              if (grafikonModal.classList.contains("active")) draw();
            }, 30000);
          }
        }

        function renderGrafikonContent(
          spoje,
          stanice,
          ciele,
          smMapa,
          startSec,
          endSec,
          nowSec,
          isLive,
          strRanges,
          linka,
          kurz,
          obehTyp,
        ) {
          grafikonContent.innerHTML = "";
          const fragment = document.createDocumentFragment();
          let nearestEl = null;
          let nearestDiff = Infinity;

          spoje.forEach((spoj, _spojIdx) => {
            const cielKod = smMapa[spoj.linka + "_" + spoj.smer];
            const _cielBS = cielSkolskehoSpoja(spoj, spoje, smMapa, ciele);
            // školský spoj: cieľ = posledná zastávka spoja
            const cielNazov = skolskaLinka(_cielBS) && spoj.zastavky.length
              ? (stanice[spoj.zastavky[spoj.zastavky.length - 1].kod] || _cielBS) : _cielBS;

            // Zisti či nasledujúci spoj ide do vozovne (prvá zastávka = Depo)
            const _nextSpoj = spoje[_spojIdx + 1];
            const _nextFirstNazov = _nextSpoj && _nextSpoj.zastavky.length
              ? (stanice[_nextSpoj.zastavky[0].kod] || "")
              : "";
            const _nextIsVozovna = _nextFirstNazov.toLowerCase().indexOf("depo") >= 0;

            // Čas odchodu z prvej zastávky (pre lookup výnimiek) + smer pôvodu
            const _casOdchodu = spoj.zastavky.length ? spoj.zastavky[0].time.substring(0, 5) : "";
            const _smerPovodu = spoj.zastavky.length ? (stanice[spoj.zastavky[0].kod] || "") : "";

            const dir = document.createElement("div");
            const _vlastnyBS = ciele[cielKod] || spoj.smer; // cieľ spoja podľa BS300 (bez úpravy školských)
            const _bezCestujucich = jeSluzobna(_vlastnyBS) || (spoj.zastavky.length > 0 && spoj.zastavky.every((z) => /^(Dp|Depo)[.\s]/i.test(stanice[z.kod] || ""))); // služobná jazda / presun len po vozovni
            const _nLinky = parseInt(String(spoj.linka).replace(/^L/, ""));
            dir.className = "grafikon-direction" + (_bezCestujucich ? " np" : _nLinky >= 400 && _nLinky < 500 ? " noc" : "");
            dir.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;";
            const _kurzEl = document.createElement("span");
            _kurzEl.style.cssText = "font-size:17px;font-weight:700;color:inherit;";
            _kurzEl.textContent = popisSpoja(spoj, linka, kurz, _cielBS);
            const _smerEl = document.createElement("span");
            _smerEl.className = "g-ciel";
            _smerEl.textContent = "→ " + cielNazov;
            dir.appendChild(_kurzEl);
            dir.appendChild(_smerEl);
            fragment.appendChild(dir);

            spoj.zastavky.forEach((z) => {
              const stopSec = timeToSeconds(z.time);
              const nazov = stanice[z.kod] || z.kod;
              const inService =
                startSec !== null &&
                endSec !== null &&
                stopSec >= startSec &&
                stopSec <= endSec;

              const row = document.createElement("div");
              row.className = "grafikon-row";
              if (inService) row.classList.add("my-service");
              if (_bezCestujucich || jeDp(nazov)) row.classList.add("nepreprava");
              if (
                strRanges &&
                strRanges.some(function (r) {
                  return stopSec >= r.s && stopSec <= r.e;
                })
              )
                row.classList.add("highlight");

              if (isLive) {
                // Prevádzkový deň: časy po polnoci (do 3:00) patria na koniec dňa
                const _norm = (t) => (t < 3 * 3600 ? t + 86400 : t);
                const _stopN = _norm(stopSec),
                  _nowN = _norm(nowSec);
                if (_stopN < _nowN) {
                  row.classList.add("past");
                } else {
                  const diff = _stopN - _nowN;
                  if (diff < nearestDiff) {
                    nearestDiff = diff;
                    nearestEl = row;
                  }
                }
              }

              const _isLast = spoj.zastavky.indexOf(z) === spoj.zastavky.length - 1;
              const _kolajInfo = _isLast
                ? window.getKolajInfo(linka, parseInt(kurz), obehTyp || Calendar.getDayType(appState.selectedDate), nazov, _casOdchodu, _smerPovodu)
                : null;
              row.innerHTML = `
        <div class="g-time">${z.time}</div>
        <div class="g-stop">${nazov}</div>
        ${inService ? '<div class="g-my">●</div>' : ""}
        ${_kolajInfo ? `<div class="g-kolaj">${_kolajInfo}</div>` : ""}
      `;
              fragment.appendChild(row);
            });
          });

          grafikonContent.appendChild(fragment);

          if (nearestEl) {
            nearestEl.classList.add("highlight");
            // hlavička spoja, do ktorého aktuálny riadok patrí, je výrazná (čierna)
            for (let _p = nearestEl.previousElementSibling; _p; _p = _p.previousElementSibling) {
              if (_p.classList && _p.classList.contains("grafikon-direction")) { _p.classList.add("aktualny"); break; }
            }
            nearestEl.innerHTML += '<div class="g-badge">Teraz ›</div>';
            if (appState.grafikonFollow !== false) setTimeout(() => {
              const offset =
                nearestEl.offsetTop -
                grafikonContent.clientHeight / 2 +
                nearestEl.clientHeight / 2;
              grafikonContent.scrollTo({
                top: Math.max(0, offset),
                behavior: "smooth",
              });
            }, 60);
          } else if (startSec !== null) {
            // Nie je live alebo nie je najbližší – scroll na začiatok služby
            let anchorEl = null;
            let anchorDiff = Infinity;
            grafikonContent
              .querySelectorAll(".grafikon-row")
              .forEach(function (row) {
                const tEl = row.querySelector(".g-time");
                if (!tEl) return;
                const tSec = timeToSeconds(tEl.textContent.trim() + ":00");
                const diff = Math.abs(tSec - startSec);
                if (diff < anchorDiff) {
                  anchorDiff = diff;
                  anchorEl = row;
                }
              });
            if (anchorEl) {
              setTimeout(() => {
                const offset =
                  anchorEl.offsetTop -
                  grafikonContent.clientHeight / 2 +
                  anchorEl.clientHeight / 2;
                grafikonContent.scrollTo({
                  top: Math.max(0, offset),
                  behavior: "smooth",
                });
              }, 60);
            }
          }
        }

        function closeGrafikon() {
          grafikonModal.classList.remove("active");
          // Grafikon otvorený z Cestovných poriadkov: po zavretí sa vrátime do okna Cestovných poriadkov
          if (window._grafikonSpatCp) {
            window._grafikonSpatCp = false;
            const cp = document.getElementById("cpModal");
            if (cp) cp.classList.add("active");
          }
          if (appState.grafikonInterval) {
            clearInterval(appState.grafikonInterval);
            appState.grafikonInterval = null;
          }
        }

        closeGrafikonBtn.addEventListener("click", closeGrafikon);

        function prepniLive() {
          appState.grafikonFollow = !appState.grafikonFollow;
          grafikonLive.classList.toggle("off", !appState.grafikonFollow);
          grafikonLive.textContent = appState.grafikonFollow ? "● LIVE" : "○ LIVE";
          grafikonLive.setAttribute("aria-pressed", appState.grafikonFollow ? "true" : "false");
          // po zapnutí sa hneď posunie na aktuálny čas
          if (appState.grafikonFollow && window._grafikonRedraw) window._grafikonRedraw();
        }
        grafikonLive.addEventListener("click", prepniLive);
        grafikonLive.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            prepniLive();
          }
        });

        // Zatváranie grafikonu potiahnutím prstom bolo zrušené (zatváralo ho aj omylom) – zatvára sa len tlačidlom Zavrieť.

        /* ==========================
   BOTTOM NAV
========================== */

        function otvorBurzuPreDen(dateKey) {
          setActiveNav("burza");
          servicesView.classList.add("hidden");
          employerView.classList.add("hidden");
          document.getElementById("burzaView").classList.remove("hidden");
          Burza.init(dateKey);
        }

        function setActiveNav(id) {
          var pv = document.getElementById("profilView");
          if (pv && id !== "profil") pv.classList.add("hidden");
          var hv = document.getElementById("hladatView");
          if (hv && id !== "hladat") hv.classList.add("hidden");
          document
            .querySelectorAll(".bottom-nav button")
            .forEach((btn) =>
              btn.classList.toggle("active", btn.dataset.nav === id),
            );
        }

        btnToday.addEventListener("click", () => {
          appState.selectedDate = new Date();
          appState.viewMode = "cards";
          setActiveNav("today");
          document.getElementById("burzaView").classList.add("hidden");
          employerView.classList.add("hidden");
          servicesView.classList.remove("hidden");
          dpbToggle.classList.remove("active-view");
          appState.mainView = "services";
          render();
        });

        document
          .querySelectorAll(".bottom-nav button:not(#btnToday)")
          .forEach((btn) => {
            btn.addEventListener("click", () => {
              setActiveNav(btn.dataset.nav);
              if (btn.dataset.nav === "burza") {
                servicesView.classList.add("hidden");
                employerView.classList.add("hidden");
                document.getElementById("burzaView").classList.remove("hidden");
                Burza.init();
              } else {
                document.getElementById("burzaView").classList.add("hidden");
                if (btn.dataset.nav === "prehlad") {
                  document.getElementById("cpModal").classList.add("active");
                  if (window._zastavkyDomov) window._zastavkyDomov();
                  setTimeout(function () {
                    var el = document.getElementById("cpStanicaInput");
                    if (el) el.focus();
                  }, 100);
                } else if (btn.dataset.nav === "hladat" && window.Hladat) {
                  window.Hladat.otvor();
                } else if (btn.dataset.nav === "profil" && window.Profil) {
                  servicesView.classList.add("hidden");
                  employerView.classList.add("hidden");
                  window.Profil.otvor();
                } else
                  showToast(
                    `${btn.querySelector(".nav-label").textContent} – pripravujeme…`,
                  );
              }
            });
          });

        // Ikona prepínača ukazuje, NA ČO sa prepne: v kartách = zoznam, v zozname = karta
        const IKONA_ZOZNAM =
          '<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />';
        const IKONA_KARTA = '<rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />';
        function ikonaPrepnutia(mode) {
          const sv = btnList.querySelector("svg");
          if (sv) sv.innerHTML = mode === "list" ? IKONA_KARTA : IKONA_ZOZNAM;
          btnList.setAttribute("aria-label", mode === "list" ? "Zobraziť karty" : "Zobraziť zoznam");
        }
        window._ikonaPrepnutia = ikonaPrepnutia;
        btnList.addEventListener("click", () => {
          appState.viewMode = appState.viewMode === "cards" ? "list" : "cards";
          btnList.style.color = appState.viewMode === "list" ? "#2f6cb0" : "";
          ikonaPrepnutia(appState.viewMode);
          render();
        });

        /* ==========================
   INIT
========================== */

        // DPB: expose internals
        window.appState = appState;
        window._render = render;
        window._closeAllGlobal = closeAllGlobal;
        window._openGrafikon = openGrafikon;
        window._showToast = showToast;
        window._loadText = loadText;
        window._loadJR = loadJR;
        window._doplnSM = doplnSM;
        window._popisSpoja = popisSpoja;
        window._skolskaLinka = skolskaLinka;
        window._jeSluzobna = jeSluzobna;
        window._jeDp = jeDp;
        window._cielSkolskehoSpoja = cielSkolskehoSpoja;
        window._parseSpoje = parseSpoje;
        window._extractObeh = extractObeh;
        window._parseKV = parseKV;
        window._parseSM = parseSM;
        window._grafikonModal = () => grafikonModal;
        window._grafikonContent = () => grafikonContent;
        window._grafikonLeft = () => grafikonLeft;
        window._grafikonRight = () => grafikonRight;
        window._grafikonLive = () => grafikonLive;
        window._appState = () => appState;
        window._dataFolders = () => appState.dataFolders;
      })();
    