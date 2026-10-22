
      (function () {
        var root = document.documentElement;
        var btn = document.getElementById("themeBtn");
        if (!btn) return;
        function current() {
          var t = root.getAttribute("data-theme");
          if (t) return t;
          return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        }
        function meta(t) {
          var m = document.querySelector('meta[name="theme-color"]');
          if (!m) {
            m = document.createElement("meta");
            m.name = "theme-color";
            document.head.appendChild(m);
          }
          m.content = t === "dark" ? "#0d0e11" : "#e8001a";
        }
        root.setAttribute("data-theme", current());
        meta(current());
        btn.addEventListener("click", function () {
          var next = current() === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          try { localStorage.setItem("dpb_theme", next); } catch (e) {}
          meta(next);
        });
      })();
    