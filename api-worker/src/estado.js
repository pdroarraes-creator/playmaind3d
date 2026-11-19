// Estado de la app en D1: una fila ('estado') con el JSON completo y un número
// de versión `v`. El lock es optimista: sólo se graba si la versión sigue
// siendo la que leyó el cliente, y esa condición se decide dentro del SQL.
const CLAVE = "estado";

export async function leerEstado(db) {
  const fila = await db.prepare("SELECT json, v FROM estado WHERE clave = 'estado'").first();
  if (!fila) return { data: null, v: 0 };
  return { data: JSON.parse(fila.json), v: fila.v };
}

export async function guardarEstado(db, data, baseV) {
  // baseV viene de JSON no confiable: se valida antes de tocar la base
  if (!Number.isInteger(baseV) || baseV < 0) throw new TypeError("baseV inválido");
  // copia: no se muta lo que pasó quien llama
  const limpio = structuredClone(data);
  // el token de sesión es del navegador, no del negocio: no se archiva
  if (limpio && limpio.cfg) { limpio.cfg.token = ""; limpio.cfg.key = ""; }
  // la versión vive en la columna, no adentro del json
  delete limpio._v;
  delete limpio._sucio;
  const json = JSON.stringify(limpio);
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
