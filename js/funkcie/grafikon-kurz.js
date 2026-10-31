
function openGrafikonSmart(ctx) {
  try {
    if (ctx.typ === "full") return openGrafikon(ctx.source);
    if (ctx.typ === "segment") return openGrafikonSegment(ctx);
    if (ctx.typ === "composed") return openGrafikonComposed(ctx);
  } catch (e) {
    console.error("openGrafikonSmart error", e);
    if (ctx.source) return openGrafikon(ctx.source);
  }
}

function openGrafikonSegment(ctx) {
  const g = openGrafikon(ctx.source);
  if (!g || !ctx.od || !ctx.do) return g;

  const od = toMin(ctx.od);
  const do_ = toMin(ctx.do);

  setTimeout(() => {
    const rows = document.querySelectorAll(".grafikon-row");
    rows.forEach(r => {
      const t = r.querySelector(".g-time");
      if (!t) return;
      const m = toMin(t.textContent);
      if (m >= od && m <= do_) r.classList.add("highlight");
    });

    const first = Array.from(rows).find(r => {
      const t = r.querySelector(".g-time");
      return t && toMin(t.textContent) >= od;
    });

    if (first) first.scrollIntoView({ block: "center" });
  }, 50);

  return g;
}

async function openGrafikonStriedac(kurzy, dateKey) {
  const modal = window._grafikonModal();
  const content = window._grafikonContent();
  const left = window._grafikonLeft();
  const right = window._grafikonRight();
  const live = window._grafikonLive();
  const appState = window._appState();

  if (!modal || !content) return;

  modal.classList.add("active");
  content.innerHTML = '<div class="grafikon-loading">Načítavam grafikon striedača…</div>';
  left.textContent = kurzy.length ? kurzy[0].kurz.split("/")[0] + " – striedač" : "Striedač";
  right.textContent = "";
  live.classList.add("hidden");

  const folders = window._dataFolders ? window._dataFolders() : ["20260216"];
  const folder = (window.Calendar && window.Calendar.findDataFolder)
    ? window.Calendar.findDataFolder(dateKey, folders)
    : folders[0];

  if (!folder) {
    content.innerHTML = '<div class="grafikon-error">Dáta nie sú dostupné.</div>';
    return;
  }

  const base = "data/" + folder + "/";
  const typDna = window.Calendar ? window.Calendar.getDayType(dateKey || appState.selectedDate) : 1;

  // Načítaj podporné súbory (raz pre všetky kurzy)
  const linky = [...new Set(kurzy.map(k => parseInt(k.kurz.split("/")[0])))];
  const jrMap = {}, smMap = {};
  let cileText, staniceText;

  try {
    [cileText, staniceText] = await Promise.all([
      window._loadText(base + "CILE.CL"),
      window._loadText(base + "STANICE.ZS"),
    ]);
    await Promise.all(linky.map(async (l) => {
      const kody = kurzy
        .filter((k) => parseInt(k.kurz.split("/")[0]) === l)
        .map((k) => String(l).padStart(3, "0") + String(parseInt(k.kurz.split("/")[1])).padStart(2, "0") + typDna);
      [jrMap[l], smMap[l]] = await Promise.all([
        window._loadJR(base, l, kody),
        window._loadText(base + l + ".SM"),
      ]);
    }));
  } catch(e) {
    content.innerHTML = '<div class="grafikon-error">Chyba načítania dát.</div>';
    return;
  }

  if (!cileText || !staniceText) {
    content.innerHTML = '<div class="grafikon-error">Chýbajú súbory CILE.CL alebo STANICE.ZS.</div>';
    return;
  }

  const stanice = window._parseKV(staniceText);
  const ciele = window._parseKV(cileText);

  content.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const isToday = dateKey === (window.formatDateKey ? window.formatDateKey(new Date()) : "");

  let scrollTarget = null;

  for (const seg of kurzy) {
    const parts = seg.kurz.split("/");
    const linka = parseInt(parts[0]);
    const kurz = String(parseInt(parts[1])).padStart(2, "0");
    const jr = jrMap[linka];
    const sm = smMap[linka];

    if (!jr || !sm) continue;

    const smMapa = window._parseSM(sm);
    const obehCode = "#" + String(linka).padStart(3, "0") + kurz + typDna;
    const spoje = window._parseSpoje(window._extractObeh(jr, obehCode));

    if (!spoje.length) continue;
    await window._doplnSM(base, smMapa, spoje);

    const preberaSec = seg.prebera ? seg.prebera.split(":").reduce((a,v,i) => a + parseInt(v) * [3600,60,1][i], 0) : null;
    const odovzdavaSec = seg.odovzdava ? seg.odovzdava.split(":").reduce((a,v,i) => a + parseInt(v) * [3600,60,1][i], 0) : null;

    for (let _spojIdx = 0; _spojIdx < spoje.length; _spojIdx++) {
      const spoj = spoje[_spojIdx];
      const cielKod = smMapa[spoj.linka + "_" + spoj.smer];
      const cielBS = window._cielSkolskehoSpoja(spoj, spoje, smMapa, ciele);
      // školský spoj: cieľ = posledná zastávka spoja
      const cielNazov = window._skolskaLinka(cielBS) && spoj.zastavky.length
        ? (stanice[spoj.zastavky[spoj.zastavky.length - 1].kod] || cielBS) : cielBS;

      const nextSpoj = spoje[_spojIdx + 1];
      const nextFirstNazov = nextSpoj && nextSpoj.zastavky.length
        ? (stanice[nextSpoj.zastavky[0].kod] || "") : "";
      const nextIsVozovna = nextFirstNazov.toLowerCase().indexOf("depo") >= 0;

      const casOdchodu = spoj.zastavky.length ? spoj.zastavky[0].time.substring(0, 5) : "";
      const smerPovodu = spoj.zastavky.length ? (stanice[spoj.zastavky[0].kod] || "") : "";

      // Filtruj len relevantné zastávky (v rozsahu prebera–odovzdava)
      const relevantne = preberaSec !== null && odovzdavaSec !== null
        ? spoj.zastavky.filter(z => {
            const s = z.time.split(":").reduce((a,v,i) => a + parseInt(v) * [3600,60,1][i], 0);
            return s >= preberaSec && s <= odovzdavaSec;
          })
        : spoj.zastavky;

      if (!relevantne.length) continue;

      const dir = document.createElement("div");
      const vlastnyBS = ciele[cielKod] || spoj.smer; // cieľ spoja podľa BS300 (bez úpravy školských)
      const bezCestujucich = window._jeSluzobna(vlastnyBS) || (spoj.zastavky.length > 0 && spoj.zastavky.every((z) => /^(Dp|Depo)[.\s]/i.test(stanice[z.kod] || ""))); // služobná jazda / presun len po vozovni
      const nLinky = parseInt(String(spoj.linka).replace(/^L/, ""));
      dir.className = "grafikon-direction" + (bezCestujucich ? " np" : nLinky >= 400 && nLinky < 500 ? " noc" : "");
      dir.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;";
      const kEl = document.createElement("span");
      kEl.style.cssText = "font-size:17px;font-weight:700;color:inherit;";
      kEl.textContent = window._popisSpoja(spoj, linka, kurz, cielBS);
      const sEl = document.createElement("span");
      sEl.className = "g-ciel";
      sEl.textContent = "→ " + cielNazov;
      dir.appendChild(kEl);
      dir.appendChild(sEl);
      fragment.appendChild(dir);

      relevantne.forEach((z) => {
        const stopSec = z.time.split(":").reduce((a,v,i) => a + parseInt(v) * [3600,60,1][i], 0);
        const nazov = stanice[z.kod] || z.kod;

        const row = document.createElement("div");
        row.className = "grafikon-row my-service";
        if (bezCestujucich || window._jeDp(nazov)) row.classList.add("nepreprava");

        if (isToday) {
          if (stopSec < nowSec) row.classList.add("past");
          else if (!scrollTarget) scrollTarget = row;
        } else if (!scrollTarget) scrollTarget = row;

        const isLast = relevantne.indexOf(z) === relevantne.length - 1;
        const kolajInfo = isLast
          ? window.getKolajInfo(linka, parseInt(kurz), typDna, nazov, casOdchodu, smerPovodu)
          : null;

        row.innerHTML = `
          <div class="g-time">${z.time.substring(0,5)}</div>
          <div class="g-stop">${nazov}</div>
          <div class="g-my">●</div>
          ${kolajInfo ? `<div class="g-kolaj">${kolajInfo}</div>` : ""}
        `;
        fragment.appendChild(row);
      });
    }
  }

  content.appendChild(fragment);

  if (scrollTarget) {
    setTimeout(() => {
      const offset = scrollTarget.offsetTop - content.clientHeight / 2 + scrollTarget.clientHeight / 2;
      content.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }, 60);
  }
}

function openGrafikonComposed(ctx) {
  // Preposielame na novú funkciu
  const appState = window._appState ? window._appState() : null;
  const dateKey = appState && window.formatDateKey ? window.formatDateKey(appState.selectedDate) : "";
  openGrafikonStriedac(ctx.segments || [], dateKey);
}

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
