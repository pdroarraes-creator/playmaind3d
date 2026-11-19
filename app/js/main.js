"use strict";
import { $, el, uid, num, money, pct, hhmm, ceilTo, hoy, fechaCorta } from "./util.js";
import {
  D,
  reemplazarEstado,
  defaults,
  local,
  SERVIDOR,
  WORKER_CADASTRO,
  LOGO,
  LOGO_FULL,
} from "./estado.js";
import { toast, showTab, renderAll, renderLight } from "./ui.js";
import {
  calc,
  prod,
  gramosCon,
  unitario,
  migrarInsumos,
  proximoNumFil,
} from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import {
  fotosTmp,
  setFotosTmp,
  leerFoto,
  pintarFoto,
  pintarMarca,
  pintarLeti,
  thumb,
  iniciarFotos,
} from "./fotos.js";
import { renderCat, chgQty, sumarStock } from "./catalogo.js";
import {
  editId,
  nuevaPieza,
  cargarPieza,
  fillSel,
  abrirInsumos,
  renderCalc,
  buscarMercado,
  gastoSinVenta,
  addAlPedido,
  iniciarEditor,
} from "./editor.js";
import {
  iniciarPedido,
  mandarWA,
  registrarVenta,
  vaciarPedido,
  compartirPresupuesto,
  descargarPresupuesto,
  enviarPresupuesto,
} from "./pedido.js";
import {
  abrirPOS,
  cerrarPOS,
  salirModoVenta,
  cobrar,
  pintarBotonCobrar,
  pintarPOS,
  totalPOS,
  setPosForma,
} from "./pos.js";
import { aplicarVenta, cerrarSheet, migrarStockVentas, iniciarVentas } from "./ventas.js";
import { renderVit, compartirVitrina, bajarVitrina } from "./vitrina.js";
import {
  MODO_VENTA,
  renderRad,
  nuevaIdea,
  traerMundo,
  abrirPiezaDeLaUrl,
  ideaCompartida,
  pegarLink,
  abrirPegar,
  cargarRadarAgosto,
  iniciarRadar,
} from "./radar.js";
import {
  alternarTamanoMind,
  abrirChatCad,
  cerrarChatCad,
  confirmarChatCad,
  enviarChatCad,
  quitarFotoChat,
  revisarLinkCadastroMW,
  iniciarChat,
} from "./chat.js";
import {
  bindCfg,
  renderAccesos,
  renderCfgLists,
  addFil,
  addImp,
  addIns,
  addPack,
  addOpi,
  addCanal,
} from "./ajustes.js";

iniciarFotos();
iniciarEditor();
iniciarPedido();
iniciarRadar();

iniciarChat();

iniciarVentas();

/* ---------- entrada ---------- */
function alternarClave() {
  const i = $("#entClave"),
    b = $("#bVerClave");
  const mostrar = i.type === "password";
  i.type = mostrar ? "text" : "password";
  b.textContent = mostrar ? "Ocultar" : "Ver";
}
async function probarLogin(email, clave) {
  try {
    const r = await fetch(SERVIDOR, {
      method: "POST",
      body: JSON.stringify({ action: "login", email: email, clave: clave }),
    });
    const j = await r.json();
    // La clave viaja una sola vez, acá. Después se usa el token de sesión.
    return j && j.ok
      ? { ok: true, usuario: j.usuario || "", token: j.token || "" }
      : { ok: false, error: (j && j.error) || "clave" };
  } catch (e) {
    return { ok: false, error: "red" };
  }
}
function mostrarEntrada() {
  const lg = $("#entLogo");
  if (D.cfg.logo) lg.src = D.cfg.logo;
  else lg.removeAttribute("src");
  $("#entrada").hidden = false;
  $("#entMail").value = D.cfg.email || "";
  setTimeout(() => {
    (D.cfg.email ? $("#entClave") : $("#entMail")).focus();
  }, 150);
}
async function entrar() {
  const email = $("#entMail").value.trim(),
    clave = $("#entClave").value.trim();
  const err = $("#entErr"),
    btn = $("#entBtn");
  err.hidden = true;
  if (!clave) {
    err.textContent = "Falta la clave.";
    err.hidden = false;
    return;
  }
  btn.disabled = true;
  btn.textContent = "Entrando…";
  const r = await probarLogin(email, clave);
  btn.disabled = false;
  btn.textContent = "Entrar";
  if (!r.ok) {
    err.textContent =
      r.error === "red"
        ? "No pude conectar. Probá de nuevo en un momento."
        : "Ese mail o esa clave no coinciden.";
    err.hidden = false;
    return;
  }
  D.cfg.email = email;
  D.cfg.usuario = r.usuario || ""; // el nombre lindo, para que la Mind salude
  D.cfg.token = r.token; // token de sesión: la clave no se guarda en el equipo
  D.cfg.api = SERVIDOR;
  await local.set(D);
  $("#entrada").hidden = true;
  await sincronizarAlAbrir();
}
/** La clave guardada dejó de servir (la cambiaron en el servidor). */
function claveVencida() {
  setSync("err", "Hay que entrar de nuevo");
  D.cfg.token = "";
  local.set(D);
  listoParaSubir = false;
  const err = $("#entErr");
  mostrarEntrada();
  if (err) {
    err.textContent = "La clave cambió. Entrá otra vez.";
    err.hidden = false;
  }
}
function salir() {
  if (!confirm("¿Cerrar sesión en este equipo? Los datos siguen en la nube.")) return;
  // avisamos al servidor para que ese token deje de servir aunque quede copiado
  try {
    pedir({ action: "logout", token: D.cfg.token || "" });
  } catch (e) {}
  D.cfg.token = "";
  local.set(D);
  try {
    localStorage.removeItem("pm3d_admin");
    localStorage.removeItem("pm3d_clave");
  } catch (e) {}
  location.reload();
}

/* ---------- nube ---------- */
/** Todo lo privado va por POST: así ni la clave ni el token quedan en la URL.
    Sin encabezados propios, para no disparar el preflight de CORS. */
export async function pedir(cuerpo) {
  const url = (D.cfg.api || SERVIDOR || "").trim();
  if (!url) throw new Error("sin servidor");
  const r = await fetch(url, { method: "POST", body: JSON.stringify(cuerpo) });
  return await r.json();
}
let syncTimer = null;
function setSync(state, txt) {
  const b = $("#syncBox");
  b.className = "sync" + (state ? " " + state : "");
  $("#syncTxt").textContent = txt;
}
let reintentoTimer = null;
let avisoSyncPendiente = false;
/** Si quedó algo sin subir (por ej. sin señal), reintenta solo más tarde. */
function programarReintento() {
  if (reintentoTimer) return;
  reintentoTimer = setTimeout(() => {
    reintentoTimer = null;
    if (D._sucio && listoParaSubir) subirALaNube();
  }, 20000);
}
window.addEventListener("online", () => {
  if (D._sucio && listoParaSubir) subirALaNube();
});
async function subirALaNube() {
  const url = (D.cfg.api || "").trim();
  if (!url) return;
  if (!listoParaSubir) {
    setSync("err", "Esperando traer lo de la nube");
    return;
  }
  const enviado = JSON.parse(JSON.stringify(D)); // foto exacta que se manda, para calzar la respuesta
  try {
    setSync("", "Guardando…");
    const r = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        email: D.cfg.email || "",
        token: D.cfg.token || "",
        v: D._v || "",
        data: enviado,
      }),
    });
    const j = await r.json();
    if (j && j.ok) {
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
    } else if (j && j.error === "clave") {
      claveVencida();
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
async function subirAhora() {
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
    const j = await pedir({
      action: "load",
      email: D.cfg.email || "",
      token: D.cfg.token || "",
    });
    if (j && j.ok && j.data && j.data.cfg) {
      const api = D.cfg.api,
        tk = D.cfg.token;
      reemplazarEstado(Object.assign(defaults(), j.data));
      D.cfg.api = api;
      D.cfg.token = tk;
      // de qué versión salió esta copia: viaja de vuelta en cada save para
      // que el servidor sepa si tiene que fusionar o puede pisar tranquilo
      D._v = j.v || "";
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
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
    } else if (j && j.error === "clave") {
      claveVencida();
    } else {
      listoParaSubir = true;
      setSync("err", "No había datos guardados");
      toast("El servidor todavía no tiene datos.");
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
async function sincronizarAlAbrir() {
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
var listoParaSubir = false; // recién true cuando ya bajamos lo que hay en la nube
export function save() {
  D._sucio = true;
  local.set(D);
  if (D.cfg.api && listoParaSubir) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(subirALaNube, 1500);
  }
}
function exportar() {
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

/* ---------- plumbing ---------- */
document
  .querySelectorAll("nav.tabs button")
  .forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
["qFil", "qIns"].forEach((id) => $("#" + id).addEventListener("input", renderCfgLists));
$("#radMes").addEventListener("change", renderRad);
$("#entBtn").addEventListener("click", entrar);
$("#posCobrar").addEventListener("click", cobrar);
$("#posQ").addEventListener("input", pintarPOS);
$("#posRecibido").addEventListener("input", totalPOS);
document.querySelectorAll("#posFormas button").forEach((b) =>
  b.addEventListener("click", () => {
    setPosForma(b.dataset.forma);
    document
      .querySelectorAll("#posFormas button")
      .forEach((x) => x.classList.toggle("on", x === b));
    pintarBotonCobrar();
  }),
);
$("#entClave").addEventListener("keydown", (e) => {
  if (e.key === "Enter") entrar();
});
$("#radOrigen").addEventListener("change", renderRad);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

(async function init() {
  const s = await local.get();
  if (s && s.cfg) reemplazarEstado(Object.assign(defaults(), s));
  if (!D.cfg.logo) D.cfg.logo = LOGO;
  /* migración: logos base64 gigantes rompían el guardado (celda de Sheets = 50.000 chars) */
  if (typeof D.cfg.logo === "string" && D.cfg.logo.startsWith("data:") && D.cfg.logo.length > 50000)
    D.cfg.logo = LOGO;
  migrarInsumos();
  if (!D.pedidoFil) D.pedidoFil = {};
  if (!D.radar) D.radar = [];
  if (!D.packs) D.packs = [];
  if (!D.opiniones) D.opiniones = [];
  if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
  migrarStockVentas();
  migrarPresupuestos(D);
  if (D.cfg.merma === undefined || D.cfg.merma === null) D.cfg.merma = 12;
  if (!D.canais || !D.canais.length) D.canais = defaults().canais;
  bindCfg();
  pintarMarca();
  pintarLeti();
  cargarPieza(null);
  renderAll();
  if (MODO_VENTA) document.body.classList.add("modoventa");
  D.cfg.api = SERVIDOR;
  if (D.cfg.token) {
    await sincronizarAlAbrir();
  } else {
    listoParaSubir = false;
    mostrarEntrada();
  }
  ideaCompartida();
})();

/* ---------- PM: puente para los handlers inline del HTML ---------- */
/* Este archivo es un módulo: sus funciones no son globales. Los on*="..." de
 * index.html llaman PM.nombre(). D se reasigna al sincronizar, por eso va como getter. */
window.PM = {
  get D() {
    return D;
  },
  LOGO,
  salir,
  alternarClave,
  nuevaPieza,
  abrirInsumos,
  buscarMercado,
  addAlPedido,
  gastoSinVenta,
  pegarLink,
  abrirPegar,
  nuevaIdea,
  cargarRadarAgosto,
  traerMundo,
  enviarPresupuesto,
  mandarWA,
  registrarVenta,
  vaciarPedido,
  compartirPresupuesto,
  descargarPresupuesto,
  compartirVitrina,
  bajarVitrina,
  abrirPOS,
  salirModoVenta,
  cerrarPOS,
  traerDeLaNubeManual,
  subirAhora,
  exportar,
  addFil,
  addImp,
  addIns,
  addPack,
  addOpi,
  addCanal,
  abrirChatCad,
  alternarTamanoMind,
  cerrarChatCad,
  confirmarChatCad,
  enviarChatCad,
  quitarFotoChat,
  save,
  pintarMarca,
  pintarLeti,
  toast,
};
