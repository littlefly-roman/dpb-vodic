/* Service worker DPB – appka a dáta fungujú aj offline.
   Zoznam súborov a verzie generuje tools/pwa-build.mjs do pwa-manifest.js (netreba ručne upravovať).
   - Appka (HTML/CSS/JS): najprv sieť (vždy čerstvá verzia), pri výpadku alebo slabom signáli (3,5 s) kópia z pamäte.
   - Dáta grafikonu (data/<priečinok>/...): kópia z pamäte, inak sieť a uloženie. Každý priečinok má vlastnú pamäť
     podľa obsahu, takže zmenené dáta sa stiahnu znova a staré sa zmažú. */
// BUILD sa prepisuje pri každom zostavení (tools/pwa-build.mjs): zmena tohto riadku je to, čo prehliadaču
// povie, že je nová verzia, a zároveň obíde vyrovnávaciu pamäť pri sťahovaní zoznamu súborov.
const BUILD = "2bc911bcb6cd";
importScripts("pwa-manifest.js?v=" + BUILD);
const P = self.PWA;
const BASE = new URL("./", self.location.href).href;
const SHELL = "dpb-shell-" + P.version;
const dataCache = (f) => "dpb-data-" + f + "-" + P.data[f].hash.slice(0, 12);
const POZDRZ = 3500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      Promise.all(
        P.shell.map((u) =>
          fetch(new Request(u, { cache: "reload" })).then((r) => {
            if (!r.ok) throw new Error("PWA: " + u + " " + r.status);
            return c.put(u, r);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (e) => {
  const platne = new Set([SHELL].concat(Object.keys(P.data).map(dataCache)));
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.indexOf("dpb-") === 0 && !platne.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function priecinok(url) {
  if (url.indexOf(BASE + "data/") !== 0) return null;
  const f = url.slice((BASE + "data/").length).split("/")[0];
  return P.data[f] ? f : null;
}

async function dataOdpoved(req, f) {
  const c = await caches.open(dataCache(f));
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone());
  return r;
}

async function appOdpoved(req) {
  const c = await caches.open(SHELL);
  // no-cache = vždy sa opýta servera (ETag, rýchle 304), nespolieha sa na 10-minútovú pamäť hostingu
  const sietou = fetch(req.url, { cache: "no-cache" }).then((r) => {
    if (r.ok) c.put(req, r.clone());
    return r;
  });
  const kopia = () => c.match(req).then((m) => m || (req.mode === "navigate" ? c.match(P.start, { ignoreSearch: true }) : undefined));
  try {
    return await Promise.race([
      sietou,
      new Promise((_, no) => setTimeout(no, POZDRZ)),
    ]);
  } catch (e) {
    const m = await kopia();
    if (m) return m;
    return sietou; // nie je kópia – počkaj na sieť
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.url.indexOf(BASE) !== 0) return;
  const f = priecinok(req.url);
  if (f) e.respondWith(dataOdpoved(req, f).catch(() => Response.error()));
  else e.respondWith(appOdpoved(req).catch(() => Response.error()));
});

// ---- správy zo stránky ----
async function stav(f) {
  const c = await caches.open(dataCache(f));
  const kl = await c.keys();
  return { folder: f, mam: kl.length, spolu: P.data[f].files.length, bajty: P.data[f].bytes };
}

async function stiahni(folders, klient) {
  for (const f of folders) {
    if (!P.data[f]) continue;
    const c = await caches.open(dataCache(f));
    const mam = new Set((await c.keys()).map((r) => r.url));
    const treba = P.data[f].files.map((n) => BASE + "data/" + f + "/" + n).filter((u) => !mam.has(u));
    let hotovo = P.data[f].files.length - treba.length,
      chyby = 0,
      i = 0;
    const spolu = P.data[f].files.length;
    const clnt = async () => {
      while (i < treba.length) {
        const u = treba[i++];
        try {
          const r = await fetch(u);
          if (r.ok) await c.put(u, r);
          else chyby++;
        } catch (e) {
          chyby++;
        }
        hotovo++;
        if (hotovo % 50 === 0) klient.postMessage({ type: "PROGRESS", folder: f, hotovo, spolu });
      }
    };
    await Promise.all([clnt(), clnt(), clnt(), clnt()]);
    klient.postMessage({ type: "DONE", folder: f, stiahnute: treba.length, chyby, spolu });
  }
}

self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type === "SKIP_WAITING") self.skipWaiting();
  else if (m.type === "PREFETCH") e.waitUntil(stiahni(m.folders || [], e.source));
  else if (m.type === "STAV")
    e.waitUntil(Promise.all((m.folders || []).filter((f) => P.data[f]).map(stav)).then((v) => e.source.postMessage({ type: "STAV", v })));
});
