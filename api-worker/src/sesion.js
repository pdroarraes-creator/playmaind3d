// Validación de sesión contra el Apps Script, con caché en memoria del isolate.
// "clave" solo significa token inválido: la app desloguea a todos al recibirlo.
// Si el Apps Script no responde, el error es "auth_no_disponible".

const NO_DISPONIBLE = { ok: false, error: "auth_no_disponible" };
const CLAVE = { ok: false, error: "clave" };

export function crearVerificador({ fetchFn, ahora = Date.now, ttlMs = 600000 } = {}) {
  const validos = new Map(); // token -> instante en que vence la validación

  return async function verificar(token, env) {
    if (!token) return CLAVE;

    const vence = validos.get(token);
    if (vence !== undefined && ahora() < vence) return { ok: true };
    validos.delete(token);

    let datos;
    try {
      const f = fetchFn ?? globalThis.fetch;
      // Sin encabezados propios, igual que la app: evita el preflight de CORS.
      const res = await f(env.APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "validarSesion", token }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return NO_DISPONIBLE;
      datos = JSON.parse(await res.text());
    } catch {
      return NO_DISPONIBLE;
    }

    // JSON que no es un objeto no lo mandó nuestro Apps Script: tratarlo como caída.
    if (datos === null || typeof datos !== "object") return NO_DISPONIBLE;
    if (datos.ok === true) {
      validos.set(token, ahora() + ttlMs);
      return { ok: true };
    }
    return CLAVE;
  };
}

export const verificarSesion = crearVerificador();
