// Copia de seguridad de mejor esfuerzo en el Apps Script después de cada
// grabación, y registro visible de su resultado en la tabla meta (se lee
// desde GET /salud). Nada de esto puede cambiar la respuesta al cliente.
const CLAVE = "snapshot:ultimo";
const TIMEOUT_MS = 15000;

// Pregunta al Apps Script y devuelve { ok, motivo } sin lanzar nunca.
async function enviar(ctx, resultado) {
  try {
    const res = await ctx.fetchFn(ctx.env.APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "guardarSnapshot", token: ctx.token, data: resultado.data, v: resultado.v }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const r = JSON.parse(await res.text());
    if (r !== null && typeof r === "object") {
      if (r.ok === true && r.guardado === true) return { ok: true, motivo: null };
      if (r.ok === true && r.guardado === false && typeof r.motivo === "string" && r.motivo) {
        return { ok: false, motivo: r.motivo };
      }
      // /salud es público: el texto del error se acota
      if (r.ok === false && typeof r.error === "string" && r.error) {
        return { ok: false, motivo: "error: " + r.error.slice(0, 120) };
      }
    }
    return { ok: false, motivo: "respuesta inesperada" };
  } catch {
    return { ok: false, motivo: "red" };
  }
}

async function registrar(ctx, v, estado) {
  const cuando = new Date(ctx.ahora()).toISOString();
  const valor = JSON.stringify({ v, ok: estado.ok, motivo: estado.motivo, cuando });
  await ctx.db
    .prepare(
      "INSERT INTO meta (clave, valor, actualizado) VALUES (?, ?, ?) " +
        "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado " +
        // un snapshot más viejo que el registrado nunca lo pisa; sin v legible, se reemplaza
        "WHERE COALESCE(CASE WHEN json_valid(meta.valor) THEN CAST(json_extract(meta.valor, '$.v') AS INTEGER) END, -1) <= CAST(json_extract(excluded.valor, '$.v') AS INTEGER)"
    )
    .bind(CLAVE, valor, cuando)
    .run();
}

// Entrega el trabajo a ctx.esperar y vuelve enseguida; nunca lanza ni rechaza.
export function snapshotTrasGrabar(ctx, resultado) {
  if (ctx.env.SNAPSHOT !== "on") return;
  try {
    const trabajo = enviar(ctx, resultado)
      .then((estado) => registrar(ctx, resultado.v, estado))
      .catch(() => {});
    ctx.esperar(trabajo);
  } catch {
    // el snapshot nunca cambia la respuesta
  }
}

export async function leerUltimoSnapshot(db) {
  try {
    const fila = await db.prepare("SELECT valor FROM meta WHERE clave = ?").bind(CLAVE).first();
    return fila ? JSON.parse(fila.valor) : null;
  } catch {
    return null;
  }
}
