/* ---------- protocolo de dos servidores ----------
 * Lógica pura (sin DOM ni red): decide a qué servidor va cada acción
 * (Apps Script o Worker) y cómo reaccionar ante su respuesta.
 * Se prueba con Node en tests/protocolo.test.js.
 */
(function (raiz) {
  /** Acciones sobre el estado: las únicas que pueden ir al Worker. */
  const ACCIONES_ESTADO = ["load", "save", "editarPieza", "agregarPieza", "agregarFilamento", "resumenNegocio"];
  const CLAVE_MODO = "pm3d:servidor-estado";

  /** "worker" solo si el modo es worker y la acción es de estado. */
  function servidorPara(accion, modo) {
    return modo === "worker" && ACCIONES_ESTADO.indexOf(accion) !== -1 ? "worker" : "apps";
  }

  /** Traduce la respuesta de un servidor en lo que la app debe hacer. */
  function reaccion(servidor, respuesta) {
    if (!respuesta || typeof respuesta !== "object") return { tipo: "error" };
    if (respuesta.ok === true) return { tipo: "ok" };
    const e = respuesta.error;
    if (e === "migrado" && servidor === "apps") return { tipo: "cambiarModo", modo: "worker" };
    if (e === "revertido" && servidor === "worker") return { tipo: "cambiarModo", modo: "apps" };
    if (e === "clave") return { tipo: "clave" };
    if (e === "auth_no_disponible") return { tipo: "sinAcceso" };
    if (e === "conflicto") return { tipo: "conflicto" };
    if (typeof e === "string" && e.indexOf("fotos:") === 0) return { tipo: "fotos" };
    return { tipo: "error" };
  }

  function leerModo(almacen) {
    try {
      return almacen.getItem(CLAVE_MODO) === "worker" ? "worker" : "apps";
    } catch (e) {
      return "apps";
    }
  }

  function guardarModo(almacen, modo) {
    try {
      almacen.setItem(CLAVE_MODO, modo);
    } catch (e) {
      /* sin almacenamiento: se sigue igual */
    }
  }

  /** Envía la acción; si el servidor avisa que cambió de modo, repite UNA vez. */
  async function pedirEstado(o) {
    let modo = o.modo;
    let servidor = servidorPara(o.cuerpo.action, modo);
    let respuesta = await o.enviar(servidor, o.cuerpo);
    let r = reaccion(servidor, respuesta);
    if (r.tipo === "cambiarModo") {
      modo = r.modo;
      o.alCambiarModo(modo);
      servidor = servidorPara(o.cuerpo.action, modo);
      respuesta = await o.enviar(servidor, o.cuerpo);
      r = reaccion(servidor, respuesta);
      if (r.tipo === "cambiarModo") r = { tipo: "error" }; // sin lazo
    }
    return { respuesta, servidor, reaccion: r, modo };
  }

  const api = { ACCIONES_ESTADO, CLAVE_MODO, servidorPara, reaccion, leerModo, guardarModo, pedirEstado };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Protocolo = api;
})(typeof window !== "undefined" ? window : globalThis);
