// Cliente contra el Apps Script existente de PlayMind 3d (mismo /exec que usa
// la PWA). No duplica la lógica de sesión/guardado — sólo llama las actions.

async function pedir(env, cuerpo) {
  const r = await fetch(env.APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(cuerpo),
  });
  return r.json();
}

export async function validarSesion(env, token) {
  const j = await pedir(env, { action: "validarSesion", token });
  return !!(j && j.ok);
}

/** pieza: mismo shape que agregarPieza_ espera en server/Codigo.gs. */
export async function agregarPieza(env, token, pieza) {
  return pedir(env, { action: "agregarPieza", token, pieza });
}
