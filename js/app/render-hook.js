
      // Monkey-patch: intercept app's internal renderCards
      // We do this by replacing the services before render() runs
      const _origAppRender = window._render;
      window._render = function () {
        if (window.appState && window.appState.currentDriver) {
          const d = window.appState.selectedDate;
          const key =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0");
          if (!window.appState.servicesByDate[key]) {
            window.appState.servicesByDate[key] = DPBData.getServicesForDate(
              window.appState.currentDriver,
              key,
            );
          }
        }
        _origAppRender();
      };
    