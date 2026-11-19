// Validación de sesión contra el Apps Script, con caché en memoria del isolate.
// "clave" solo significa token inválido: la app desloguea a todos al recibirlo.
// Si el Apps Script no responde, el error es "auth_no_disponible".

const NO_DISPONIBLE = { ok: false, error: "auth_no_disponible" };
const CLAVE = { ok: false, error: "clave" };

export function crearVerificador({ fetchFn, ahora = Date.now, ttlMs = 600000 } = {}) {
  // Acotado por las sesiones vivas; una entrada vencida se descarta al volver a consultar el mismo token.
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
    // Solo la respuesta exacta del Apps Script para un token inválido es "clave":
    // la app desloguea a todos al recibirla. Cualquier otra forma (acción
    // desconocida de un despliegue viejo, excepción interna, "migrado") no
    // prueba que la sesión sea inválida, así que cuenta como caída.
    if (datos.ok === false && datos.error === "clave") return CLAVE;
    return NO_DISPONIBLE;
  };
}

export const verificarSesion = crearVerificador();
