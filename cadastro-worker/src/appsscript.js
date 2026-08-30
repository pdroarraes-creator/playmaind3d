// Cliente contra el Apps Script existente de PlayMind 3d (mismo /exec que usa
// la PWA). No duplica la lógica de sesión/guardado — sólo llama las actions.

async function pedir(env, cuerpo) {
  const r = await fetch(env.APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(cuerpo),
  });
  return r.json();
}

/** Resumen + validación de sesión en un solo viaje: del otro lado el token se
    verifica antes de atender cualquier action, así que un {ok:false} acá ya
    dice que la sesión no sirve. Antes se llamaba validarSesion aparte y cada
    mensaje del chat costaba dos idas al Apps Script, que no es rápido. */
export async function resumenYSesion(env, token) {
  const j = await pedir(env, { action: "resumenNegocio", token });
  if (j && j.ok) return { sesionOk: true, resumen: j.resumen || null };
  // 'clave' es el error de sesión; cualquier otro (ej. 'sin datos') no lo es
  return { sesionOk: (j && j.error) !== "clave", resumen: null };
}

/** pieza: mismo shape que agregarPieza_ espera en server/Codigo.gs. */
export async function agregarPieza(env, token, pieza) {
  return pedir(env, { action: "agregarPieza", token, pieza });
}

/** filamento: {marca, nome, cor, hex, precoKg, rollo}. */
export async function agregarFilamento(env, token, filamento) {
  return pedir(env, { action: "agregarFilamento", token, filamento });
}
