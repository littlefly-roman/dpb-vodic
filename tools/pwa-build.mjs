// Vygeneruje pwa-manifest.js (zoznam súborov appky a dát + verzie) pre service worker.
// Spusti po každej zmene appky alebo dát:  node tools/pwa-build.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const koren = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HTML = "dpb_app_v11.html";
const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

// --- appka: všetko, na čo odkazuje HTML, + obrázky ---
const html = fs.readFileSync(path.join(koren, HTML), "utf8");
const shell = new Set([HTML, "manifest.webmanifest", "sw.js"]);
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const u = m[1];
  if (/^(https?:|data:|mailto:|tel:|\/\/)/.test(u)) continue;
  shell.add(u);
}
function dajSubory(dir, pred = () => true) {
  const out = [];
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) out.push(...dajSubory(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}
for (const p of dajSubory(path.join(koren, "img"))) shell.add(path.relative(koren, p).split(path.sep).join("/"));
const shellList = [...shell].filter((u) => fs.existsSync(path.join(koren, u.split("?")[0])));
const chybajuce = [...shell].filter((u) => !fs.existsSync(path.join(koren, u.split("?")[0])));
if (chybajuce.length) console.warn("Preskočené (neexistujú):", chybajuce.join(", "));

let hs = crypto.createHash("sha1");
for (const u of shellList.slice().sort()) {
  if (u === "sw.js") continue;
  hs.update(u).update(fs.readFileSync(path.join(koren, u.split("?")[0])));
}

// --- dáta: iba stlačené (.gz) súbory a súbory bez .gz kópie ---
const data = {};
const dd = path.join(koren, "data");
for (const f of fs.readdirSync(dd, { withFileTypes: true })) {
  if (!f.isDirectory() || !/^\d{8}/.test(f.name)) continue;
  const dir = path.join(dd, f.name);
  const vsetky = new Set(dajSubory(dir));
  const files = [...vsetky]
    .filter((p) => p.endsWith(".gz") || !vsetky.has(p + ".gz"))
    .map((p) => path.relative(dir, p).split(path.sep).join("/"))
    .sort();
  const h = crypto.createHash("sha1");
  let bytes = 0;
  for (const n of files) {
    const b = fs.readFileSync(path.join(dir, n));
    bytes += b.length;
    h.update(n).update(sha(b));
  }
  data[f.name] = { hash: h.digest("hex"), files, bytes };
}

const buildId = sha(pwaVersionSeed(hs, data));
function pwaVersionSeed(h, d) {
  return h.copy().digest("hex") + Object.keys(d).map((k) => k + d[k].hash).join("");
}
const pwa = { version: buildId.slice(0, 12), start: HTML, shell: shellList, data };
// BUILD do sw.js (zmena súboru = prehliadač zistí novú verziu)
const swP = path.join(koren, "sw.js");
fs.writeFileSync(swP, fs.readFileSync(swP, "utf8").replace(/const BUILD = "[^"]*";/, 'const BUILD = "' + pwa.version + '";'));
fs.writeFileSync(path.join(koren, "pwa-manifest.js"), "self.PWA = " + JSON.stringify(pwa) + ";\n");
const mb = Object.values(data).reduce((a, d) => a + d.bytes, 0) / 1e6;
console.log("PWA verzia", pwa.version, "· súborov appky:", shellList.length, "· priečinkov dát:", Object.keys(data).length, "· dáta spolu", mb.toFixed(1), "MB");
