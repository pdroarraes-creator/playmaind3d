import { KITS, PIEZAS } from "./catalog-data.mjs";
import { LINEAS, descuentoPct, horasTxt, lineaDe, linkWA, mensajeKitWA, mensajeWA, precioTxt, textoDeBusqueda, vistasDe } from "./catalog-logic.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const PIEZAS_DESTACADAS = 3;
const DETALLE_DE_VISTA = ["vista de la pieza", "vista en mano", "vista en uso"];
const TITULO_PEDIDO = "Tu pedido ya está escrito";

const fichaPieza = document.querySelector("#product-template");
const fichaKit = document.querySelector("#kit-template");
const hoja = document.querySelector("#message-sheet");
const tituloHoja = document.querySelector("#message-title");
const textoHoja = document.querySelector("#message-text");
const enlaceWhatsApp = document.querySelector("#whatsapp-link");
let disparadorHoja;

function mostrarMensaje(texto, disparador, titulo = TITULO_PEDIDO) {
  disparadorHoja = disparador;
  tituloHoja.textContent = titulo;
  textoHoja.textContent = texto;
  enlaceWhatsApp.href = linkWA(texto);
  hoja.showModal();
  tituloHoja.focus({ preventScroll: true });
}

function icono(nombre) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const uso = document.createElementNS(SVG_NS, "use");
  uso.setAttribute("href", `#icon-${nombre}`);
  svg.append(uso);
  return svg;
}

function agregarDato(ficha, simbolo, etiqueta, valor) {
  if (!valor) return;
  const grupo = document.createElement("div");
  grupo.className = "product-fact";
  const titulo = document.createElement("dt");
  const marca = document.createElement("span");
  marca.className = "fact-icon";
  marca.append(icono(simbolo));
  titulo.append(marca, etiqueta);
  const dato = document.createElement("dd");
  dato.textContent = valor;
  grupo.append(titulo, dato);
  ficha.append(grupo);
}

function armarPieza(pieza, destacada) {
  const tarjeta = fichaPieza.content.firstElementChild.cloneNode(true);
  const foto = tarjeta.querySelector(".product-photo");
  const errorFoto = tarjeta.querySelector(".photo-unavailable");
  const medida = tarjeta.querySelector("[data-measure]");
  const stock = tarjeta.querySelector("[data-stock]");
  const pestañas = tarjeta.querySelector(".photo-tabs");
  const orden = tarjeta.querySelector(".order-button");
  const ficha = tarjeta.querySelector(".product-facts");
  const vistas = vistasDe(pieza);
  const botones = [];
  let vistaActiva;

  tarjeta.querySelector("[data-title]").textContent = pieza.nombre;
  tarjeta.querySelector("[data-price]").textContent = precioTxt(pieza.precio);
  stock.textContent = pieza.stock === 1 ? "1 disponible" : pieza.stock > 1 ? `${pieza.stock} disponibles` : "Se imprime a pedido";
  stock.classList.toggle("is-ready", pieza.stock > 0);
  medida.textContent = pieza.medida;
  pestañas.setAttribute("aria-label", `Vistas de ${pieza.nombre}`);

  foto.loading = destacada ? "eager" : "lazy";
  if (destacada) foto.fetchPriority = "high";

  function mostrarVista(vista) {
    vistaActiva = vista.indice;
    foto.alt = `${pieza.nombre}: ${DETALLE_DE_VISTA[vista.indice]}`;
    foto.src = vista.foto;
    foto.hidden = false;
    errorFoto.hidden = true;
    medida.hidden = vista.indice !== 1 || !pieza.medida;
    for (const { boton, indice } of botones) {
      boton.setAttribute("aria-pressed", String(indice === vistaActiva));
    }
  }

  foto.addEventListener("error", () => {
    foto.hidden = true;
    errorFoto.hidden = false;
  });

  if (vistas.length > 1) {
    for (const vista of vistas) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "photo-tab";
      boton.textContent = vista.etiqueta;
      boton.addEventListener("click", () => {
        if (vista.indice !== vistaActiva) mostrarVista(vista);
      });
      pestañas.append(boton);
      botones.push({ boton, indice: vista.indice });
    }
    pestañas.hidden = false;
  }
  if (vistas.length) mostrarVista(vistas[0]);
  else {
    errorFoto.textContent = "Esta pieza aún no tiene foto.";
    errorFoto.hidden = false;
  }

  const tiempo = horasTxt(pieza.horas);
  agregarDato(ficha, "bulb", "¿Para qué sirve?", pieza.desc || LINEAS[lineaDe(pieza)].descripcion);
  agregarDato(ficha, "ruler", "Tamaño real", pieza.medida);
  agregarDato(ficha, "clock", "Tiempo de impresión", tiempo ? `Se imprime en ${tiempo}` : "");
  agregarDato(ficha, "shield", "Material", "PLA, un bioplástico vegetal.");

  orden.setAttribute("aria-label", `Pedir este por WhatsApp: ${pieza.nombre}`);
  orden.addEventListener("click", () => mostrarMensaje(mensajeWA(pieza, vistaActiva), orden));
  return tarjeta;
}

function armarKit(kit) {
  const tarjeta = fichaKit.content.firstElementChild.cloneNode(true);
  const ahorro = tarjeta.querySelector("[data-kit-saving]");
  const orden = tarjeta.querySelector(".order-button");
  tarjeta.querySelector("[data-kit-line]").textContent = LINEAS[kit.linea].corto;
  tarjeta.querySelector("[data-kit-title]").textContent = kit.nombre;
  tarjeta.querySelector("[data-kit-description]").textContent = `${kit.piezas.join(" + ")}. ${kit.desc}`;
  tarjeta.querySelector("[data-kit-separate]").textContent = precioTxt(kit.precioSeparado);
  tarjeta.querySelector("[data-kit-price]").textContent = precioTxt(kit.precio);
  ahorro.textContent = `Ahorrás ${precioTxt(kit.precioSeparado - kit.precio)}`;
  ahorro.title = `${descuentoPct(kit)}% de descuento`;
  orden.setAttribute("aria-label", `Pedir este kit por WhatsApp: ${kit.nombre}`);
  orden.addEventListener("click", () => mostrarMensaje(mensajeKitWA(kit), orden));
  return tarjeta;
}

const secciones = new Map([...document.querySelectorAll("[data-shelf]")].map((seccion) => [
  seccion.dataset.shelf, { seccion, lista: seccion.querySelector("[data-products]"), tarjetas: [] },
]));
const buscar = document.querySelector("#search-input");
const borrar = document.querySelector("#clear-search");
const estadoBusqueda = document.querySelector("#search-status");
const sinResultados = document.querySelector("#no-results");
const verTodas = document.querySelector("#expand-sensartias");
const avisoNavidad = document.querySelector("#navidad-note");
const seccionKits = document.querySelector("#kits");
const navegacion = document.querySelector("#line-nav");
const enlacesDeLinea = [...navegacion.querySelectorAll("a")];
let sensartiasCompleta = false;
let cuadroNavegacion;

function actualizarNavegacion() {
  cuadroNavegacion = undefined;
  const umbral = navegacion.offsetHeight + 16;
  let activa;
  for (const { seccion } of secciones.values()) {
    if (seccion.hidden) continue;
    if (!activa || seccion.getBoundingClientRect().top <= umbral) activa = seccion.id;
  }
  for (const enlace of enlacesDeLinea) {
    if (enlace.hash === `#${activa}`) enlace.setAttribute("aria-current", "location");
    else enlace.removeAttribute("aria-current");
  }
}

function programarNavegacion() {
  if (cuadroNavegacion === undefined) cuadroNavegacion = requestAnimationFrame(actualizarNavegacion);
}

function filtrarCatalogo() {
  const consulta = textoDeBusqueda(buscar.value);
  let resultados = 0;
  for (const [linea, { seccion, tarjetas }] of secciones) {
    let visibles = 0;
    for (const [indice, { tarjeta, nombre }] of tarjetas.entries()) {
      const coincide = consulta ? nombre.includes(consulta) : linea !== "sensartias" || sensartiasCompleta || indice < PIEZAS_DESTACADAS;
      tarjeta.hidden = !coincide;
      if (coincide) visibles++;
    }
    seccion.hidden = Boolean(consulta) && visibles === 0;
    resultados += visibles;
  }

  verTodas.hidden = Boolean(consulta) || secciones.get("sensartias").tarjetas.length <= PIEZAS_DESTACADAS;
  avisoNavidad.hidden = secciones.get("navidad").tarjetas.length > 0;
  seccionKits.hidden = Boolean(consulta);
  sinResultados.hidden = !consulta || resultados > 0;
  borrar.hidden = !buscar.value;
  estadoBusqueda.textContent = consulta ? (resultados === 1 ? "1 pieza encontrada" : `${resultados} piezas encontradas`) : "";
  programarNavegacion();
}

function limpiarBusqueda() {
  buscar.value = "";
  filtrarCatalogo();
  buscar.focus();
}

for (const [indice, pieza] of PIEZAS.entries()) {
  const destino = secciones.get(lineaDe(pieza));
  const tarjeta = armarPieza(pieza, indice === 0);
  destino.tarjetas.push({ tarjeta, nombre: textoDeBusqueda(pieza.nombre) });
  destino.lista.append(tarjeta);
}

document.querySelector("#kit-list").append(...KITS.map(armarKit));

hoja.addEventListener("click", (evento) => {
  if (evento.target === hoja || evento.target.closest("[data-close-sheet]")) hoja.close();
});
hoja.addEventListener("close", () => disparadorHoja?.focus({ preventScroll: true }));

document.querySelector("#contact-button").addEventListener("click", (evento) => {
  mostrarMensaje("¡Hola PlayMind 3D! Estoy mirando el catálogo y quería consultar por una pieza.", evento.currentTarget, "Escribinos por WhatsApp");
});
document.querySelector("#holiday-button").addEventListener("click", (evento) => {
  mostrarMensaje("¡Hola PlayMind 3D! ¿Me avisan por acá cuando esté lista la línea Especial Navidad?", evento.currentTarget, "Aviso de Navidad");
});

document.querySelector("#search-form").addEventListener("submit", (evento) => evento.preventDefault());
buscar.addEventListener("input", (evento) => {
  if (!evento.isComposing) filtrarCatalogo();
});
buscar.addEventListener("compositionend", filtrarCatalogo);
borrar.addEventListener("click", limpiarBusqueda);
document.querySelector("#reset-search").addEventListener("click", limpiarBusqueda);

verTodas.addEventListener("click", () => {
  sensartiasCompleta = !sensartiasCompleta;
  verTodas.setAttribute("aria-expanded", String(sensartiasCompleta));
  verTodas.querySelector("span").textContent = sensartiasCompleta ? "Mostrar solo las destacadas" : "Ver todas las piezas de esta línea";
  filtrarCatalogo();
  if (sensartiasCompleta) {
    const siguiente = secciones.get("sensartias").tarjetas[PIEZAS_DESTACADAS].tarjeta;
    siguiente.setAttribute("tabindex", "-1");
    siguiente.focus({ preventScroll: true });
    siguiente.scrollIntoView({ block: "start" });
  }
});

for (const enlace of document.querySelectorAll("[data-shelf-link]")) {
  enlace.addEventListener("click", (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return;
    const destino = document.getElementById(enlace.hash.slice(1));
    if (destino?.hidden) {
      buscar.value = "";
      filtrarCatalogo();
    }
  });
}

window.addEventListener("scroll", programarNavegacion, { passive: true });
window.addEventListener("resize", programarNavegacion);
window.addEventListener("hashchange", programarNavegacion);
filtrarCatalogo();
