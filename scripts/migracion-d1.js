// Migración del estado (Sheets -> D1): genera el SQL de carga y verifica que
// lo cargado coincide con el original (conteos por lista + hash del contenido).
//   node scripts/migracion-d1.js carga <estado.json> <salida.sql> [--v-inicial N]
//   node scripts/migracion-d1.js resumen <estado.json>
//   node scripts/migracion-d1.js comparar <a.json> <b.json>
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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

// INSERT puro, sin OR REPLACE ni ON CONFLICT: si ya hay una fila 'estado' la
// clave primaria rechaza la carga y la fila existente queda intacta. Así una
// carga repetida por error nunca pisa el estado vivo.
// La v inicial sale del reloj en segundos (10 dígitos): la versión que emite el
// D1 cuenta desde 1 y no puede repetir una ya emitida, y tampoco debe parecerse
// a los sellos de hora del Sheets (13 dígitos, milisegundos).
function sqlCarga(data, ahora, vInicial = Math.floor(Date.now() / 1000)) {
  if (!Number.isSafeInteger(vInicial) || vInicial < 1) {
    throw new TypeError("vInicial debe ser un entero seguro mayor o igual a 1");
  }
  const json = JSON.stringify(limpiar(data)).replace(/'/g, "''");
  const fecha = String(ahora).replace(/'/g, "''");
  return `INSERT INTO estado (clave, json, v, actualizado) VALUES ('estado', '${json}', ${vInicial}, '${fecha}');\n`;
}

class ErrorLectura extends Error {}

function leer(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch (e) {
    // sin eco del contenido del archivo: puede ser el estado real
    throw new ErrorLectura(`No se pudo leer ${ruta} como JSON (${e.code || "JSON inválido"})`);
  }
}

function uso() {
  console.error([
    "Uso:",
    "  node scripts/migracion-d1.js carga <estado.json> <salida.sql> [--v-inicial N]",
    "  node scripts/migracion-d1.js resumen <estado.json>",
    "  node scripts/migracion-d1.js comparar <a.json> <b.json>",
    "Códigos de salida: 0 ok, 1 comparar con diferencias, 2 uso incorrecto,",
    "3 no se pudo leer o escribir un archivo, o JSON inválido.",
  ].join("\n"));
  process.exit(2);
}

// ¿entrada y salida son el mismo archivo? (por ruta o, si la salida existe, por archivo real)
function mismoArchivo(entrada, salida) {
  if (path.resolve(entrada) === path.resolve(salida)) return true;
  try {
    return fs.realpathSync(entrada) === fs.realpathSync(salida);
  } catch {
    return false;
  }
}

function main(args) {
  let vInicial;
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--v-inicial") {
      const n = args[++i];
      if (vInicial !== undefined) uso();
      if (!/^\d+$/.test(n || "") || !Number.isSafeInteger(Number(n)) || Number(n) < 1) uso();
      vInicial = Number(n);
    } else if (args[i].startsWith("--")) {
      uso();
    } else pos.push(args[i]);
  }
  const [cmd, a, b] = pos;
  const esperados = { carga: 3, resumen: 2, comparar: 3 }[cmd];
  if (!esperados || pos.length !== esperados || (vInicial !== undefined && cmd !== "carga")) uso();
  try {
    if (cmd === "carga") {
      if (mismoArchivo(a, b)) {
        console.error("La salida no puede ser el mismo archivo que la entrada.");
        process.exit(2);
      }
      const sql = sqlCarga(leer(a), new Date().toISOString(), vInicial);
      try {
        fs.writeFileSync(b, sql);
      } catch (e) {
        throw new ErrorLectura(`No se pudo escribir ${b} (${e.code || "error"})`);
      }
    } else if (cmd === "resumen") {
      console.log(JSON.stringify(resumen(leer(a)), null, 2));
    } else {
      const r = comparar(resumen(leer(a)), resumen(leer(b)));
      if (r.iguales) console.log("iguales: true");
      else { console.log("iguales: false"); r.diferencias.forEach((d) => console.log("- " + d)); process.exit(1); }
    }
  } catch (e) {
    if (!(e instanceof ErrorLectura)) throw e;
    console.error(e.message);
    process.exit(3);
  }
}

module.exports = { canonico, resumen, comparar, sqlCarga };
if (require.main === module) main(process.argv.slice(2));
