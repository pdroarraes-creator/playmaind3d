"use strict";
import { $ } from "./util.js";
import {
  D,
  reemplazarEstado,
  defaults,
  local,
  SERVIDOR,
  LOGO,
} from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { migrarInsumos } from "./calculo.js";
import { pintarMarca, pintarLeti, iniciarFotos } from "./fotos.js";
import {
  nuevaPieza,
  cargarPieza,
  abrirInsumos,
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
import { migrarStockVentas, iniciarVentas } from "./ventas.js";
import { compartirVitrina, bajarVitrina } from "./vitrina.js";
import { alternarClave, mostrarEntrada, entrar, salir } from "./entrada.js";
import {
  exportar,
  iniciarNube,
  listoParaSubir,
  reintentoTimer,
  save,
  setListoParaSubir,
  sincronizarAlAbrir,
  subirALaNube,
  subirAhora,
  traerDeLaNubeManual,
} from "./nube.js";
import {
  MODO_VENTA,
  renderRad,
  nuevaIdea,
  traerMundo,
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
  iniciarChat,
} from "./chat.js";
import {
  bindCfg,
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

iniciarNube();

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
  if (!D.cfg.hero) D.cfg.hero = { v1: "", v2: "" };
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
    setListoParaSubir(false);
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

/* ---------- PM_ENSAYO: solo para scripts/ensayo-protocolo.js ---------- */
/* Con app.js monolítico, el ensayo leía D, listoParaSubir y reintentoTimer y llamaba a
   subirALaNube()/save() como globales. En módulos no lo son: se exponen acá, sin
   cambiar nada de lo que ve el usuario. D es un getter para leer siempre el estado vivo. */
window.PM_ENSAYO = {
  get D() {
    return D;
  },
  get listoParaSubir() {
    return listoParaSubir;
  },
  get reintentoPendiente() {
    return reintentoTimer !== null;
  },
  subirALaNube,
  save,
};
