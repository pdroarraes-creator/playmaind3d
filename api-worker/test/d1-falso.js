// D1 falso para los tests: SQL real sobre node:sqlite en memoria, con la
// misma forma de API que D1 (prepare/bind/first/run/all).
import { readFileSync } from "node:fs";

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

const MIGRACION = readFileSync(new URL("../migrations/0001_estado.sql", import.meta.url), "utf8");

export function crearD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRACION);
  return {
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
