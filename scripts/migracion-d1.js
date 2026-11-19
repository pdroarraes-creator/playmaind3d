// Migración del estado (Sheets -> D1): genera el SQL de carga y verifica que
// lo cargado coincide con el original (conteos por lista + hash del contenido).
//   node scripts/migracion-d1.js carga <estado.json> <salida.sql>
//   node scripts/migracion-d1.js resumen <estado.json>
//   node scripts/migracion-d1.js comparar <a.json> <b.json>
const crypto = require("node:crypto");
const fs = require("node:fs");

const LISTAS = ["produtos", "filamentos", "impressoras", "insumos", "vendas", "canais", "packs", "opiniones", "radar"];

// Misma regla que guardarEstado en api-worker/src/estado.js: sin token/key de
// sesión ni _v/_sucio. Trabaja sobre una copia.
function limpiar(data) {
  const copia = structuredClone(data);
  if (copia && copia.cfg) { copia.cfg.token = ""; copia.cfg.key = ""; }
  delete copia._v;
  delete copia._sucio;
  return copia;
}

function ordenar(x) {
  if (Array.isArray(x)) return x.map(ordenar);
  if (x && typeof x === "object") {
    const salida = {};
    for (const k of Object.keys(x).sort()) salida[k] = ordenar(x[k]);
    return salida;
  }
  return x;
}

function canonico(data) {
  return JSON.stringify(ordenar(limpiar(data)));
}

function resumen(data) {
  const listas = {};
  for (const k of LISTAS) listas[k] = Array.isArray(data[k]) ? data[k].length : 0;
  const c = canonico(data);
  return { listas, chars: c.length, hash: crypto.createHash("sha256").update(c).digest("hex") };
}

function comparar(a, b) {
  const diferencias = [];
  for (const k of new Set([...Object.keys(a.listas), ...Object.keys(b.listas)])) {
    const x = a.listas[k] || 0;
    const y = b.listas[k] || 0;
    if (x !== y) diferencias.push(`la lista ${k} tiene ${x} elementos en A y ${y} en B`);
  }
  if (a.hash !== b.hash) diferencias.push("el hash del contenido es distinto");
  return { iguales: diferencias.length === 0, diferencias };
}

function sqlCarga(data, ahora) {
  const json = JSON.stringify(limpiar(data)).replace(/'/g, "''");
  const fecha = String(ahora).replace(/'/g, "''");
  return `INSERT OR REPLACE INTO estado (clave, json, v, actualizado) VALUES ('estado', '${json}', 1, '${fecha}');\n`;
}

const leer = (ruta) => JSON.parse(fs.readFileSync(ruta, "utf8"));

function uso() {
  console.error([
    "Uso:",
    "  node scripts/migracion-d1.js carga <estado.json> <salida.sql>",
    "  node scripts/migracion-d1.js resumen <estado.json>",
    "  node scripts/migracion-d1.js comparar <a.json> <b.json>",
  ].join("\n"));
  process.exit(2);
}

function main(args) {
  const [cmd, a, b] = args;
  if (cmd === "carga" && a && b) {
    fs.writeFileSync(b, sqlCarga(leer(a), new Date().toISOString()));
  } else if (cmd === "resumen" && a) {
    console.log(JSON.stringify(resumen(leer(a)), null, 2));
  } else if (cmd === "comparar" && a && b) {
    const r = comparar(resumen(leer(a)), resumen(leer(b)));
    if (r.iguales) console.log("iguales: true");
    else { console.log("iguales: false"); r.diferencias.forEach((d) => console.log("- " + d)); process.exit(1); }
  } else {
    uso();
  }
}

module.exports = { canonico, resumen, comparar, sqlCarga };
if (require.main === module) main(process.argv.slice(2));
