// Cliente contra el Apps Script existente de PlayMind 3d (mismo /exec que usa
// la PWA). No duplica la lógica de sesión/guardado — sólo llama las actions.
// Si el Apps Script responde 'migrado', repite el pedido en el Worker.
import Protocolo from "../../app/protocolo.js";

async function enviar(env, servidor, cuerpo) {
  const url = servidor === "worker" ? env.API_WORKER_URL : env.APPS_SCRIPT_URL;
  const r = await fetch(url, { method: "POST", body: JSON.stringify(cuerpo) });
  return r.json();
}

/** Va al servidor vigente; si el Apps Script avisa 'migrado', repite una vez
    en el Worker (lo resuelve Protocolo.pedirEstado). Devuelve sólo el JSON. */
async function pedir(env, cuerpo) {
  const { respuesta } = await Protocolo.pedirEstado({
    modo: env.MODO_SERVIDOR === "worker" ? "worker" : "apps",
    cuerpo,
    enviar: (servidor, c) => enviar(env, servidor, c),
    alCambiarModo() {}, // sin estado entre pedidos: cada uno arranca desde MODO_SERVIDOR
  });
  return respuesta;
}

/** Resumen + validación de sesión en un solo viaje: del otro lado el token se
    verifica antes de atender cualquier action, así que un {ok:false} acá ya
    dice que la sesión no sirve. Antes se llamaba validarSesion aparte y cada
    mensaje del chat costaba dos idas al Apps Script, que no es rápido. */
export async function resumenYSesion(env, token) {
  const j = await pedir(env, { action: "resumenNegocio", token });
  if (j && j.ok) return { sesionOk: true, resumen: j.resumen || null };
  // 'clave' es el error de sesión; cualquier otro (ej. 'sin datos' o
  // 'auth_no_disponible', el servidor de acceso caído) no lo es: el chat
  // sigue sin contexto del negocio en vez de expulsar al usuario
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
