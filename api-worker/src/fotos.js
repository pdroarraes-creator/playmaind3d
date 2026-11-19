// Las fotos nuevas (base64) nunca se guardan en D1: solo el Apps Script puede
// subirlas a Drive. Estos son los mismos lugares que mira moverFotosADrive_
// en server/Codigo.gs.

const esBase64 = (v) => typeof v === "string" && v.startsWith("data:image");

export function contieneFotosNuevas(data) {
  if (data === null || typeof data !== "object") return false;
  const { produtos, cfg } = data;
  if (Array.isArray(produtos)) {
    for (const p of produtos) {
      if (p === null || typeof p !== "object") continue;
      if (esBase64(p.foto)) return true;
      if (Array.isArray(p.fotos) && p.fotos.some(esBase64)) return true;
    }
  }
  if (cfg !== null && typeof cfg === "object") {
    if (esBase64(cfg.logo)) return true;
    const leti = cfg.leti;
    if (leti !== null && typeof leti === "object" && esBase64(leti.foto)) return true;
  }
  return false;
}

// Manda el estado al Apps Script (acción subirFotos) con el token del propio
// usuario y devuelve el estado con las fotos ya reemplazadas por links de Drive.
// No registrar el token ni el contenido de las fotos.
export async function subirFotos(env, token, data, fetchFn) {
  let datos;
  try {
    const f = fetchFn ?? globalThis.fetch;
    // Sin encabezados propios, igual que la app: evita el preflight de CORS.
    const res = await f(env.APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "subirFotos", token, data }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    datos = JSON.parse(await res.text());
  } catch (e) {
    throw new Error(`fotos: ${e.message}`);
  }

  if (datos === null || typeof datos !== "object") {
    throw new Error("fotos: respuesta inválida");
  }
  if (datos.ok !== true) {
    throw new Error(`fotos: ${datos.error ?? "error desconocido"}`);
  }
  const devuelto = datos.data;
  if (devuelto === null || typeof devuelto !== "object") {
    throw new Error("fotos: respuesta sin data");
  }
  // Nunca guardar base64, aunque el Apps Script falle en subirlo.
  if (contieneFotosNuevas(devuelto)) {
    throw new Error("fotos: el Apps Script devolvió fotos sin subir");
  }
  return devuelto;
}
