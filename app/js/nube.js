"use strict";
import { D, SERVIDOR, defaults, local, reemplazarEstado } from "./estado.js";
import { $, el, hoy } from "./util.js";
import { cargarPieza, editId } from "./editor.js";
import { fotosTmp, pintarFoto, pintarLeti, pintarMarca, setFotosTmp } from "./fotos.js";
import { renderCat } from "./catalogo.js";
import { renderVit } from "./vitrina.js";
import { renderAll, showTab, toast } from "./ui.js";
import { claveVencida } from "./entrada.js";
import { migrarInsumos } from "./calculo.js";
import { migrarStockVentas } from "./ventas.js";
import { bindCfg } from "./ajustes.js";
import { MODO_VENTA, abrirPiezaDeLaUrl } from "./radar.js";
import { abrirPOS } from "./pos.js";
import { revisarLinkCadastroMW } from "./chat.js";
/* ---------- nube ---------- */
/* Servidor nuevo del estado (Worker + D1). Hasta el corte, todo sigue yendo al
   Apps Script; el modo pasa a "worker" cuando el Apps Script contesta "migrado"
   y vuelve a "apps" si el Worker contesta "revertido" (ver protocolo.js). */
const SERVIDOR_ESTADO = "https://playmind3d-api-prod.pdroarraes.workers.dev/";
/* Si el navegador bloquea el almacenamiento, el getter de window.localStorage lanza:
   se protege acá para que app.js cargue igual (sin memoria del modo, queda en "apps"). */
function almacenModo() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}
let MODO_SERVIDOR = Protocolo.leerModo(almacenModo());
/** POST sin encabezados propios (evita el preflight de CORS). Devuelve el JSON. */
async function enviarEstado(servidor, cuerpo) {
  const url = servidor === "worker" ? SERVIDOR_ESTADO : (D.cfg.api || SERVIDOR || "").trim();
  if (!url) throw new Error("sin servidor");
  const r = await fetch(url, { method: "POST", body: JSON.stringify(cuerpo) });
  return await r.json();
}
/** Acción sobre el estado (load/save): elige servidor y reacciona al error recibido. */
function pedirEstado(cuerpo) {
  return Protocolo.pedirEstado({
    modo: MODO_SERVIDOR,
    cuerpo,
    enviar: enviarEstado,
    alCambiarModo(m) {
      MODO_SERVIDOR = m;
      Protocolo.guardarModo(almacenModo(), m);
    },
  });
}
/** Todo lo privado va por POST: así ni la clave ni el token quedan en la URL.
    Sin encabezados propios, para no disparar el preflight de CORS. */
export async function pedir(cuerpo) {
  const url = (D.cfg.api || SERVIDOR || "").trim();
  if (!url) throw new Error("sin servidor");
  const r = await fetch(url, { method: "POST", body: JSON.stringify(cuerpo) });
  return await r.json();
}
let syncTimer = null;
export function setSync(state, txt) {
  const b = $("#syncBox");
  b.className = "sync" + (state ? " " + state : "");
  $("#syncTxt").textContent = txt;
}
export let reintentoTimer = null;
let avisoSyncPendiente = false;
/** Si quedó algo sin subir (por ej. sin señal), reintenta solo más tarde. */
function programarReintento() {
  if (reintentoTimer) return;
  reintentoTimer = setTimeout(() => {
    reintentoTimer = null;
    if (D._sucio && listoParaSubir) subirALaNube();
  }, 20000);
}
export async function subirALaNube() {
  const url = (D.cfg.api || "").trim();
  if (!url) return;
  if (!listoParaSubir) {
    setSync("err", "Esperando traer lo de la nube");
    return;
  }
  const enviado = JSON.parse(JSON.stringify(D)); // foto exacta que se manda, para calzar la respuesta
  try {
    setSync("", "Guardando…");
    const { respuesta: j, reaccion: rc } = await pedirEstado({
      action: "save",
      email: D.cfg.email || "",
      token: D.cfg.token || "",
      v: D._v || "",
      data: enviado,
    });
    if (rc.tipo === "ok") {
      if (j.data && j.data.produtos) {
        // Cambiamos las fotos pesadas por los links que ya guardó el servidor,
        // calzando por el contenido (la foto en sí), no por la posición: si
        // agregaste o sacaste una foto mientras esto subía, el largo ya no
        // coincide, pero las fotos que sí se subieron igual quedan resueltas.
        // Antes, ese desfasaje dejaba la foto en base64 para siempre y se
        // volvía a subir a Drive en cada guardado siguiente.
        const mapaFotosPorPieza = {};
        j.data.produtos.forEach(function (np) {
          const viejo = enviado.produtos.find((x) => x.id === np.id);
          if (!np.fotos || !viejo || !viejo.fotos) return;
          const mapa = {};
          viejo.fotos.forEach((f, i) => {
            if (
              String(f).indexOf("data:image") === 0 &&
              String(np.fotos[i]).indexOf("http") === 0
            )
              mapa[f] = np.fotos[i];
          });
          mapaFotosPorPieza[np.id] = mapa;
          const p = D.produtos.find((x) => x.id === np.id);
          if (!p) return;
          const mias = p.fotos && p.fotos.length ? p.fotos : p.foto ? [p.foto] : [];
          let cambio = false;
          const nuevas = mias.map((f) => {
            if (mapa[f]) {
              cambio = true;
              return mapa[f];
            }
            return f;
          });
          if (cambio) {
            p.fotos = nuevas;
            p.foto = nuevas[0];
          }
        });
        if (j.data.cfg && j.data.cfg.logo) D.cfg.logo = j.data.cfg.logo;
        local.set(D);
        if (editId && mapaFotosPorPieza[editId]) {
          const mapa = mapaFotosPorPieza[editId];
          let cambio = false;
          setFotosTmp(
            fotosTmp.map((f) => {
              if (mapa[f]) {
                cambio = true;
                return mapa[f];
              }
              return f;
            }),
          );
          if (cambio) pintarFoto();
        }
        renderCat();
        renderVit();
      }
      // la versión que quedó guardada pasa a ser la base del próximo save
      if (j.v) D._v = j.v;
      D._sucio = false;
      avisoSyncPendiente = false;
      local.set(D);
      setSync(
        "on",
        "En la nube · " +
          new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      );
      // El servidor junto esta copia con cosas que habia cargado otra
      // persona. Lo guardado ya esta completo, pero acá todavía falta verlo:
      // por eso se baja de nuevo, que ahora es seguro (no quedó nada sucio).
      if (j.fusionado) {
        toast("Había cambios de otra persona: se juntaron los dos.");
        await bajarDeLaNube();
      }
    } else if (rc.tipo === "clave") {
      claveVencida();
    } else if (rc.tipo === "sinAcceso") {
      // el servidor que valida sesiones no contesta: no es una clave mala, no se desloguea
      setSync("err", "El servidor de acceso no responde. Reintento solo.");
      programarReintento();
    } else if (rc.tipo === "conflicto") {
      setSync("err", "Choque de cambios");
      toast("Hubo un choque de cambios. Se reintenta solo.");
      programarReintento();
    } else if (rc.tipo === "fotos") {
      setSync("err", "Error al subir fotos");
      toast("No se pudieron subir las fotos. Se reintenta solo.");
      programarReintento();
    } else {
      setSync("err", "Error al guardar");
      if (!avisoSyncPendiente) {
        avisoSyncPendiente = true;
        toast("No pude guardar en la nube. Se va a reintentar solo.");
      }
      programarReintento();
    }
  } catch (e) {
    setSync("err", "No se pudo guardar");
    if (!avisoSyncPendiente) {
      avisoSyncPendiente = true;
      toast("No pude guardar en la nube. Se va a reintentar solo.");
    }
    programarReintento();
  }
}
/** Botón manual: si hay algo sin subir todavía, avisa antes de pisarlo. */
export async function traerDeLaNubeManual() {
  if (
    D._sucio &&
    !confirm(
      "Hay cambios acá que todavía no se subieron a la nube (por ej. una venta). " +
        "Si traés la nube ahora, se pierden. ¿Traer igual?",
    )
  )
    return;
  await bajarDeLaNube();
}
export async function subirAhora() {
  if (!D.cfg.api) {
    toast("Primero conectá el servidor.");
    return;
  }
  listoParaSubir = true;
  await subirALaNube();
}
async function bajarDeLaNube() {
  const url = (D.cfg.api || "").trim();
  if (!url) {
    toast("Primero pegá la dirección del servidor.");
    return;
  }
  try {
    setSync("", "Trayendo…");
    const { respuesta: j, reaccion: rc } = await pedirEstado({
      action: "load",
      email: D.cfg.email || "",
      token: D.cfg.token || "",
    });
    if (rc.tipo === "ok" && j.data && j.data.cfg) {
      const api = D.cfg.api,
        tk = D.cfg.token;
      reemplazarEstado(Object.assign(defaults(), j.data));
      D.cfg.api = api;
      D.cfg.token = tk;
      // de qué versión salió esta copia: viaja de vuelta en cada save para
      // que el servidor sepa si tiene que fusionar o puede pisar tranquilo
      D._v = j.v || "";
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      if (!D.cfg.hero) D.cfg.hero = { v1: "", v2: "" };
      migrarInsumos();
      migrarStockVentas();
      migrarPresupuestos(D);
      await local.set(D);
      cargarPieza(null);
      bindCfg();
      renderAll();
      pintarMarca();
      pintarLeti();
      listoParaSubir = true;
      setSync("on", "En la nube");
      toast("Datos traídos de la nube.");
      abrirPiezaDeLaUrl();
      if (MODO_VENTA) {
        showTab("ven");
        abrirPOS();
      }
    } else if (rc.tipo === "clave") {
      claveVencida();
    } else if (rc.tipo === "ok") {
      // respuesta buena pero sin datos: el servidor está vacío, se puede subir lo local
      listoParaSubir = true;
      setSync("err", "No había datos guardados");
      toast("El servidor todavía no tiene datos.");
    } else {
      // Un load con error NO libera el save: si se subiera ahora, el estado
      // local (posiblemente viejo o vacío) pisaría lo que hay en el servidor.
      setSync(
        "err",
        rc.tipo === "sinAcceso" ? "El servidor de acceso no responde" : "No se pudo traer de la nube",
      );
      toast("No se pudo traer lo de la nube.");
    }
  } catch (e) {
    setSync("err", "Sin conexión");
    toast("No se pudo conectar.");
  }
}
/**
 * Se llama al abrir la app o al entrar. Si hay algo grabado acá que todavía
 * no llegó a la nube (por ej. una venta con el celular sin señal), lo sube
 * primero: bajar de la nube en ese momento pisaría eso sin avisar.
 */
export async function sincronizarAlAbrir() {
  listoParaSubir = false;
  if (D._sucio) {
    setSync("", "Subiendo cambios pendientes…");
    listoParaSubir = true;
    await subirALaNube();
  }
  if (D._sucio) {
    setSync("err", "Sin subir · va a reintentar solo");
    if (MODO_VENTA) {
      showTab("ven");
      abrirPOS();
    }
    return;
  }
  setSync("", "Trayendo de la nube…");
  await bajarDeLaNube();
  revisarLinkCadastroMW();
}
export var listoParaSubir = false; // recién true cuando ya bajamos lo que hay en la nube
/** Lo usa la entrada (y el arranque) para volver a trabar la subida. */
export function setListoParaSubir(v) {
  listoParaSubir = v;
}
export function save() {
  D._sucio = true;
  local.set(D);
  if (D.cfg.api && listoParaSubir) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(subirALaNube, 1500);
  }
}
export function exportar() {
  const copia = JSON.parse(JSON.stringify(D));
  copia.cfg.token = "";
  copia.cfg.api = ""; // la clave no viaja en el archivo
  const b = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(b), download: "playmind3d-" + hoy() + ".json" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Copia descargada.");
}
/* Lo que corría al cargar la sección: main.js lo llama en el mismo lugar. */
export function iniciarNube() {
  window.addEventListener("online", () => {
    if (D._sucio && listoParaSubir) subirALaNube();
  });
  $("#fImp").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d.cfg) throw 0;
        const api = D.cfg.api,
          tk = D.cfg.token;
        reemplazarEstado(Object.assign(defaults(), d));
        D.cfg.api = api;
        D.cfg.token = tk;
        if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      if (!D.cfg.hero) D.cfg.hero = { v1: "", v2: "" };
        migrarInsumos();
        migrarStockVentas();
        migrarPresupuestos(D);
        cargarPieza(null);
        bindCfg();
        save();
        renderAll();
        pintarMarca();
        pintarLeti();
        toast("Copia restaurada.");
      } catch (err) {
        toast("Ese archivo no sirve.");
      }
    };
    rd.readAsText(f);
    e.target.value = "";
  });
}

