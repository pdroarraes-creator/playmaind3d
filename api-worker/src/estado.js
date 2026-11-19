// Estado de la app en D1: una fila ('estado') con el JSON completo y un número
// de versión `v`. El lock es optimista: sólo se graba si la versión sigue
// siendo la que leyó el cliente, y esa condición se decide dentro del SQL.
import { fusionar } from "./fusionar.js";

const CLAVE = "estado";

export async function leerEstado(db) {
  const fila = await db.prepare("SELECT json, v FROM estado WHERE clave = 'estado'").first();
  if (!fila) return { data: null, v: 0 };
  return { data: JSON.parse(fila.json), v: fila.v };
}

// Copia del estado sin lo que no se archiva: token/key de sesión (son del
// navegador, no del negocio) y los marcadores locales _v y _sucio (la versión
// vive en la columna). No muta lo que pasó quien llama.
export function sanear(data) {
  const limpio = structuredClone(data);
  if (limpio && limpio.cfg) { limpio.cfg.token = ""; limpio.cfg.key = ""; }
  delete limpio._v;
  delete limpio._sucio;
  return limpio;
}

export async function guardarEstado(db, data, baseV) {
  // baseV viene de JSON no confiable: se valida antes de tocar la base
  if (!Number.isInteger(baseV) || baseV < 0) throw new TypeError("baseV inválido");
  const json = JSON.stringify(sanear(data));
  const ahora = new Date().toISOString();

  const r = baseV === 0
    ? await db.prepare(
        "INSERT INTO estado (clave, json, v, actualizado) VALUES (?, ?, 1, ?) ON CONFLICT(clave) DO NOTHING"
      ).bind(CLAVE, json, ahora).run()
    : await db.prepare(
        "UPDATE estado SET json = ?, v = v + 1, actualizado = ? WHERE clave = 'estado' AND v = ?"
      ).bind(json, ahora, baseV).run();

  if (r.meta.changes === 1) return { ok: true, v: baseV + 1 };
  return { ok: false, conflicto: true, actual: await leerEstado(db) };
}

// Graba con lock optimista; si la base quedó vieja, funde con lo que hay en el
// servidor y reintenta. maxIntentos = total de intentos de grabar.
export async function guardarConFusion(db, data, baseV, { maxIntentos = 5 } = {}) {
  let fusionado = false;
  for (let intento = 1; ; intento++) {
    const r = await guardarEstado(db, data, baseV);
    if (r.ok) return { ok: true, data: sanear(data), v: r.v, fusionado };
    if (intento >= maxIntentos) return { ok: false, error: "conflicto" };
    data = fusionar(r.actual.data, data);
    baseV = r.actual.v;
    fusionado = true;
  }
}
