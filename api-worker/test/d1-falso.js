// D1 falso para los tests: SQL real sobre node:sqlite en memoria, con la
// misma forma de API que D1 (prepare/bind/first/run/all).
import { readFileSync, readdirSync } from "node:fs";

// node:sqlite imprime un ExperimentalWarning al importarse; se silencia sólo
// ese aviso para que la salida de los tests quede limpia.
const emitOriginal = process.emitWarning;
process.emitWarning = (w, ...resto) => {
  const msg = typeof w === "string" ? w : w && w.message;
  if (msg && msg.includes("SQLite")) return;
  return emitOriginal.call(process, w, ...resto);
};
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} finally {
  process.emitWarning = emitOriginal;
}

const DIR = new URL("../migrations/", import.meta.url);
const MIGRACIONES = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ f, sql: readFileSync(new URL(f, DIR), "utf8") }));

// Aplica todas las migraciones en orden; con { soloEstado: true } sólo la 0001
// (un banco al que todavía no llegó la tabla meta).
export function crearD1({ soloEstado = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of MIGRACIONES) {
    if (soloEstado && m.f !== "0001_estado.sql") continue;
    sqlite.exec(m.sql);
  }
  return {
    // para cargar SQL de varias sentencias (p. ej. la carga de migración)
    exec(sql) {
      sqlite.exec(sql);
    },
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      const armar = (valores) => ({
        async first() {
          const fila = stmt.get(...valores);
          return fila ? { ...fila } : null;
        },
        async run() {
          const r = stmt.run(...valores);
          return { success: true, meta: { changes: Number(r.changes) } };
        },
        async all() {
          return { results: stmt.all(...valores).map((f) => ({ ...f })) };
        },
      });
      return { ...armar([]), bind: (...valores) => armar(valores) };
    },
  };
}
