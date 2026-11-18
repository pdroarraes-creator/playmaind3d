// Mide el catálogo público: tiempo y peso de ?action=catalogo y de las fotos.
// Uso: node scripts/medir-catalogo.js [urlDelServidor]
// Sin argumento, lee SERVIDOR de index.html (raíz del repo).
const fs = require("fs");
const path = require("path");

function resumir(ms) {
  const o = [...ms].sort((a, b) => a - b);
  const n = o.length;
  const mediana = n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
  return { min: o[0], mediana, max: o[n - 1] };
}

function leerServidor() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/var\s+SERVIDOR\s*=\s*["']([^"']+)["']/);
  if (!m) throw new Error("No se encontró SERVIDOR en index.html");
  return m[1];
}

async function medir(url) {
  const t0 = performance.now();
  const r = await fetch(url);
  const buf = await r.arrayBuffer();
  return { status: r.status, bytes: buf.byteLength, ms: Math.round(performance.now() - t0), buf };
}

// Fotos del catálogo: piezas[].fotos y leti.foto, sin vacíos ni duplicados.
function fotosDe(data) {
  const c = (data && data.catalogo) || {};
  const todas = [];
  for (const p of Array.isArray(c.piezas) ? c.piezas : []) {
    if (p && Array.isArray(p.fotos)) todas.push(...p.fotos);
  }
  if (c.leti) todas.push(c.leti.foto);
  return [...new Set(todas.filter((u) => typeof u === "string" && u))];
}

// Quita el sufijo de tamaño (=w800) solo de fotos de Drive; el catálogo ya
// publicado devuelve las fotos con sufijo y "original" tiene que ser sin él.
function urlOriginal(url) {
  if (typeof url !== "string") return url;
  return /^https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_-]+=[A-Za-z0-9-]+$/.test(url)
    ? url.replace(/=[A-Za-z0-9-]+$/, "")
    : url;
}

function contarPiezas(data) {
  const c = data && data.catalogo;
  return c && Array.isArray(c.piezas) ? c.piezas.length : 0;
}

async function main() {
  const base = process.argv[2] || leerServidor();
  const url = base + (base.includes("?") ? "&" : "?") + "action=catalogo";
  console.log("Servidor:", base);
  const tiempos = [];
  let ultimo;
  for (let i = 1; i <= 5; i++) {
    ultimo = await medir(url);
    tiempos.push(ultimo.ms);
    console.log(`GET ${i}: ${ultimo.ms} ms (status ${ultimo.status})`);
  }
  console.log("Resumen (ms):", resumir(tiempos));
  console.log("Cuerpo:", ultimo.bytes, "bytes");
  let data = null;
  try { data = JSON.parse(Buffer.from(ultimo.buf).toString("utf8")); } catch (e) { console.log("El cuerpo no es JSON"); }
  console.log("Piezas:", contarPiezas(data));
  const fotos = fotosDe(data).slice(0, 5);
  for (const f of fotos) {
    for (const [etq, u] of [["original", urlOriginal(f)], ["=w800", urlOriginal(f) + "=w800"]]) {
      try {
        const r = await medir(u);
        console.log(`Foto ${etq}: status ${r.status}, ${r.bytes} bytes, ${r.ms} ms  ${u}`);
      } catch (e) {
        console.log(`Foto ${etq}: error ${e.message}  ${u}`);
      }
    }
  }
}

module.exports = { resumir, fotosDe, contarPiezas, urlOriginal };

if (require.main === module) {
  main().catch((e) => { console.error("Falló:", e.message, e.cause ? e.cause.message || e.cause : ""); process.exit(1); });
}
