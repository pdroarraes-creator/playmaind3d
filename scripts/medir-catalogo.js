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

// Busca las URLs de fotos (cadenas http) en cualquier parte del JSON.
function fotosDe(obj, acc = new Set()) {
  if (typeof obj === "string") {
    if (/^https?:\/\//.test(obj)) acc.add(obj);
  } else if (Array.isArray(obj)) obj.forEach((x) => fotosDe(x, acc));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((x) => fotosDe(x, acc));
  return acc;
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
  const piezas = data && (Array.isArray(data) ? data : data.piezas || data.productos || data.items);
  console.log("Piezas:", Array.isArray(piezas) ? piezas.length : "(no se pudo contar)");
  const fotos = [...fotosDe(data)].slice(0, 5);
  for (const f of fotos) {
    for (const [etq, u] of [["original", f], ["=w800", f.replace(/=[a-z0-9-]+$/i, "") + "=w800"]]) {
      try {
        const r = await medir(u);
        console.log(`Foto ${etq}: status ${r.status}, ${r.bytes} bytes, ${r.ms} ms  ${u}`);
      } catch (e) {
        console.log(`Foto ${etq}: error ${e.message}  ${u}`);
      }
    }
  }
}

module.exports = { resumir };

if (require.main === module) {
  main().catch((e) => { console.error("Falló:", e.message, e.cause ? e.cause.message || e.cause : ""); process.exit(1); });
}
