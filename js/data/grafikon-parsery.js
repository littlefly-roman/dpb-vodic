/* =============================================================
   data/grafikon-parsery.js — načítanie a čítanie súborov grafikonu
   (.JR spoje, .SM smery, STANICE.ZS / CILE.CL páry kód -> názov).
   Načítava sa pred app/hlavna.js, ktorá si ich preberá z
   window.GrafikonParsery.
============================================================= */
window.GrafikonParsery = (() => {
// Súbory grafikonu sa sťahujú stlačené (.gz, 4-6x menšie = rýchle aj na slabom mobile).
// Ak .gz nie je alebo ho prehliadač nevie rozbaliť, použije sa pôvodný súbor.
// Načítaný text sa drží v pamäti (opakované otvorenie grafikonu je okamžité).
const _textCache = new Map();
async function loadText(path, ticho) {
  if (_textCache.has(path)) return _textCache.get(path);
  try {
    let buf = null;
    if (typeof DecompressionStream === "function") {
      try {
        const rz = await fetch(path + ".gz");
        if (rz.ok)
          buf = await new Response(rz.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      } catch (e) {}
    }
    if (!buf) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(res.status);
      buf = await res.arrayBuffer();
    }
    const text = new TextDecoder("windows-1250").decode(buf);
    if (_textCache.size >= 12) _textCache.delete(_textCache.keys().next().value);
    _textCache.set(path, text);
    return text;
  } catch (e) {
    if (!ticho) console.warn("Nepodarilo sa načítať:", path);
    return null;
  }
}

// Text JR pre potrebné obehy. Najprv skúsi malé súbory OBEH/<kód>.txt (rýchle aj na slabom mobile),
// ak nejaký chýba (starší export bez OBEH), stiahne celý <linka>.JR ako doteraz.
async function loadJR(base, linka, obehKody) {
  const kody = [...new Set(obehKody.map((k) => String(k).replace(/^#/, "")))];
  const casti = await Promise.all(kody.map((k) => loadText(base + "OBEH/" + k + ".txt", true)));
  if (casti.length && casti.every((c) => c)) return casti.join("\n");
  return loadText(base + linka + ".JR");
}

// Spoje linky, ktorú jazdí iná služba (napr. linka 31 v 39.JR), majú cieľ v <linka>.SM tej linky.
async function doplnSM(base, smMapa, spoje) {
  const chyba = [...new Set(spoje.map((s) => s.linka))].filter(
    (l) => !Object.keys(smMapa).some((k) => k.startsWith(l + "_")),
  );
  for (const l of chyba) {
    const t = await loadText(base + parseInt(l.slice(1)) + ".SM", true);
    if (t) Object.assign(smMapa, parseSM(t));
  }
}

// Označenie linky pre verejnosť: 8NN = X (výlukové), 4NN = N (nočné), inak číslo.
function nazovLinky(n) {
  return n >= 800 && n < 900 ? "X" + (n - 800) : n >= 400 && n < 500 ? "N" + (n - 400) : String(n);
}
// Nadpis spoja v grafikone: bežný spoj "91/51", spoj inej linky jazdený touto službou "N80 (91/51)"
// Školský spoj (neverejný): cieľ v CILE.CL je "Školská linka N" -> linka sa volá "Šk N"
function skolskaLinka(cielNazov) {
  const m = /^Školská linka\s*(\d*)\s*$/i.exec(String(cielNazov || "").trim());
  return m ? "Šk" + (m[1] ? " " + m[1] : "") : "";
}
// Úseky bez cestujúcich: služobná jazda (cieľ „Služobná jazda / Not in service“) a zastávky Dp xxx (vozovňa).
function jeSluzobna(cielNazov) {
  return /Služobná jazda|Not in service/i.test(String(cielNazov || ""));
}
function jeDp(nazovZastavky) {
  return /^Dp[.\s]/i.test(String(nazovZastavky || "").trim());
}
// Obeh školskej linky 932: služobné jazdy v ňom (do/z depa) patria tej istej školskej linke ako spoje obehu.
// Vráti cieľ ("Školská linka N") spoja; pre služobnú jazdu 932 ho zoberie zo školského spoja v tom istom obehu.
function cielSkolskehoSpoja(spoj, spoje, smMapa, ciele) {
  const vlastny = ciele[smMapa[spoj.linka + "_" + spoj.smer]] || spoj.smer;
  if (skolskaLinka(vlastny) || spoj.linka !== "L932") return vlastny;
  for (const o of spoje) {
    if (o.linka !== "L932") continue;
    const c = ciele[smMapa[o.linka + "_" + o.smer]];
    if (skolskaLinka(c)) return c;
  }
  return vlastny;
}
function popisSpoja(spoj, linka, kurz, cielNazov) {
  const sl = parseInt(String(spoj.linka).replace(/^L/, ""));
  const sluzba = linka + "/" + String(parseInt(kurz));
  const sk = skolskaLinka(cielNazov);
  if (sk) return sl && sl !== parseInt(linka) ? sk + " (" + sluzba + ")" : sk + "/" + String(parseInt(kurz));
  return sl && sl !== parseInt(linka) ? nazovLinky(sl) + " (" + sluzba + ")" : sluzba;
}

function extractObeh(jrText, obehCode) {
  let inside = false,
    result = [];
  for (let line of jrText.split("\n")) {
    line = line.trim();
    if (line.startsWith("#")) {
      if (line === obehCode) {
        inside = true;
        continue;
      } else if (inside) break;
    }
    if (inside) result.push(line);
  }
  return result;
}

function parseSpoje(lines) {
  let spoje = [],
    cur = null;
  for (let line of lines) {
    if (!line) continue;
    if (line.startsWith("L")) {
      if (cur) spoje.push(cur);
      const p = line.split("\t");
      cur = { linka: p[0], smer: p[1], zastavky: [] };
    } else if (cur) {
      const p = line.split("\t");
      const kod = p[0]?.trim();
      if (kod)
        cur.zastavky.push({ kod, time: p[2]?.trim() || p[1]?.trim() });
    }
  }
  if (cur) spoje.push(cur);
  return spoje;
}

function parseKV(text) {
  const mapa = {};
  for (let line of text.split("\n")) {
    const p = line.trim().split("\t");
    if (p.length >= 2) mapa[p[0].trim()] = p[1].trim();
  }
  return mapa;
}

function parseSM(text) {
  const mapa = {};
  for (let line of text.split("\n")) {
    line = line.trim();
    if (line.startsWith("L")) {
      const p = line.split("\t");
      mapa[p[0] + "_" + p[1]] = p[2]?.replace("C", "");
    }
  }
  return mapa;
}

  return { loadText, loadJR, doplnSM, popisSpoja, skolskaLinka, cielSkolskehoSpoja, jeSluzobna, jeDp, nazovLinky, extractObeh, parseSpoje, parseKV, parseSM };
})();
