import { KITS, PIEZAS } from "./catalog-data.mjs";
import { LINEAS, MAX_UNIDADES_POR_ARTICULO, ajustarPedido, descuentoPct, horasTxt, lineaDe, linkWA, mensajePedidoWA, precioTxt, resumenPedido, textoDeBusqueda, vistasDe } from "./catalog-logic.mjs";
import { crearCarrusel } from "./carousel.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

const fichaPieza = document.querySelector("#product-template");
const fichaKit = document.querySelector("#kit-template");
const hoja = document.querySelector("#message-sheet");
const tituloHoja = document.querySelector("#message-title");
const textoHoja = document.querySelector("#message-text");
const enlaceWhatsApp = document.querySelector("#whatsapp-link");
let disparadorHoja;

function mostrarMensaje(texto, disparador, titulo) {
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

function iniciarBolsa() {
  const boton = document.querySelector("#bag-button");
  const contador = document.querySelector("#bag-count");
  const estadoCatalogo = document.querySelector("#bag-status");
  const dialogo = document.querySelector("#bag-sheet");
  const titulo = document.querySelector("#bag-title");
  const lista = document.querySelector("#bag-items");
  const vacia = document.querySelector("#bag-empty");
  const pie = document.querySelector("#bag-footer");
  const totalPedido = document.querySelector("#bag-total");
  const envio = document.querySelector("#send-order");
  const plantilla = document.querySelector("#bag-row-template");
  const estadoDetalle = document.querySelector("#bag-detail-status");
  const fichas = new Map();
  const filas = new Map();
  let pedido = new Map();

  function actualizarResumen() {
    const { unidades, total } = resumenPedido(pedido);
    const cantidad = unidades === 1 ? "1 artículo" : `${unidades} artículos`;
    contador.textContent = String(unidades);
    boton.setAttribute("aria-label", `Ver bolsa, ${cantidad}`);
    vacia.hidden = unidades > 0;
    lista.hidden = pie.hidden = unidades === 0;
    totalPedido.textContent = precioTxt(total);
    if (unidades) envio.href = linkWA(mensajePedidoWA(pedido));
    else envio.removeAttribute("href");
    return cantidad;
  }

  function crearFila(articulo) {
    const fila = plantilla.content.firstElementChild.cloneNode(true);
    const menos = fila.querySelector("[data-minus]");
    const mas = fila.querySelector("[data-plus]");
    const quitar = fila.querySelector("[data-remove]");
    const thumb = fila.querySelector("img");
    fila.querySelector("[data-bag-name]").textContent = articulo.nombre;
    fila.querySelector("[data-bag-unit]").textContent = `${precioTxt(articulo.precio)} c/u`;
    fila.querySelector(".quantity-control").setAttribute("aria-label", `Cantidad de ${articulo.nombre}`);
    menos.setAttribute("aria-label", `Quitar una unidad de ${articulo.nombre}`);
    mas.setAttribute("aria-label", `Sumar una unidad de ${articulo.nombre}`);
    quitar.setAttribute("aria-label", `Quitar ${articulo.nombre} de la bolsa`);
    menos.addEventListener("click", () => cambiar(articulo, -1));
    mas.addEventListener("click", () => cambiar(articulo, 1));
    quitar.addEventListener("click", () => cambiar(articulo, -pedido.get(articulo)));
    if (articulo.fotos?.[0]) {
      thumb.addEventListener("error", () => { thumb.hidden = true; });
      thumb.src = articulo.fotos[0];
      thumb.hidden = false;
    }
    filas.set(articulo, fila);
    lista.append(fila);
    return fila;
  }

  function cambiar(articulo, cambio) {
    const actualizado = ajustarPedido(pedido, articulo, cambio);
    if (actualizado === pedido) return;
    pedido = actualizado;
    const cantidad = pedido.get(articulo) ?? 0;
    const { orden, indicador } = fichas.get(articulo);
    let destinoDeFoco;
    indicador.textContent = `×${cantidad}`;
    indicador.hidden = cantidad === 0;
    orden.disabled = cantidad >= MAX_UNIDADES_POR_ARTICULO;
    orden.setAttribute("aria-label", `Sumar al pedido: ${articulo.nombre}${cantidad ? ` (${cantidad} en la bolsa)` : ""}`);

    if (cantidad) {
      const fila = filas.get(articulo) ?? crearFila(articulo);
      const mas = fila.querySelector("[data-plus]");
      fila.querySelector("[data-bag-quantity]").textContent = String(cantidad);
      fila.querySelector("[data-bag-subtotal]").textContent = precioTxt(articulo.precio * cantidad);
      if (cantidad === MAX_UNIDADES_POR_ARTICULO && mas === document.activeElement) {
        destinoDeFoco = fila.querySelector("[data-minus]");
      }
      mas.disabled = cantidad >= MAX_UNIDADES_POR_ARTICULO;
    } else {
      const fila = filas.get(articulo);
      if (fila.contains(document.activeElement)) {
        const vecina = fila.nextElementSibling ?? fila.previousElementSibling;
        destinoDeFoco = vecina?.querySelector("[data-remove]") ?? vacia.querySelector("button");
      }
      fila.remove();
      filas.delete(articulo);
    }

    const totalArticulos = actualizarResumen();
    destinoDeFoco?.focus();
    const anuncio = cantidad ? `${articulo.nombre}: ${cantidad} en la bolsa.` : `Quitaste ${articulo.nombre}.`;
    const estado = dialogo.open ? estadoDetalle : estadoCatalogo;
    estado.textContent = `${anuncio} ${totalArticulos} en total.`;
  }

  boton.addEventListener("click", () => {
    estadoDetalle.textContent = "";
    dialogo.showModal();
    titulo.focus({ preventScroll: true });
  });
  dialogo.addEventListener("close", () => boton.focus({ preventScroll: true }));
  boton.disabled = false;

  return function registrar(articulo, orden) {
    fichas.set(articulo, { orden, indicador: orden.querySelector("[data-added-quantity]") });
    orden.setAttribute("aria-label", `Sumar al pedido: ${articulo.nombre}`);
    orden.addEventListener("click", () => cambiar(articulo, 1));
  };
}

const registrarEnBolsa = iniciarBolsa();

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

function armarPieza(pieza) {
  const tarjeta = fichaPieza.content.firstElementChild.cloneNode(true);
  const foto = tarjeta.querySelector(".product-photo");
  const errorFoto = tarjeta.querySelector(".photo-unavailable");
  const medida = tarjeta.querySelector("[data-measure]");
  const stock = tarjeta.querySelector("[data-stock]");
  const pestañas = tarjeta.querySelector(".photo-tabs");
  const movimiento = tarjeta.querySelector(".motion-controls");
  const tipoMovimiento = tarjeta.querySelector(".motion-caption");
  const verGif = tarjeta.querySelector(".motion-toggle");
  const ficha = tarjeta.querySelector(".product-facts");
  const vistas = vistasDe(pieza);
  const botones = [];
  let vistaActiva;
  let reproduciendo = false;

  tarjeta.querySelector("[data-title]").textContent = pieza.nombre;
  tarjeta.querySelector("[data-price]").textContent = precioTxt(pieza.precio);
  stock.textContent = pieza.stock === 1 ? "1 disponible" : pieza.stock > 1 ? `${pieza.stock} disponibles` : "Se imprime a pedido";
  stock.classList.toggle("is-ready", pieza.stock > 0);
  medida.textContent = pieza.medida;
  medida.hidden = !pieza.medida;
  pestañas.setAttribute("aria-label", `Vistas de ${pieza.nombre}`);
  movimiento.hidden = !pieza.gif || !vistas.length;

  foto.loading = "lazy";

  function actualizarControlesDeVista() {
    tipoMovimiento.hidden = !reproduciendo;
    verGif.querySelector("span").textContent = reproduciendo ? "Detener GIF" : "Ver GIF";
    verGif.querySelector("use").setAttribute("href", `#icon-${reproduciendo ? "stop" : "play"}`);
    for (const { boton, indice } of botones) {
      boton.setAttribute("aria-pressed", String(!reproduciendo && indice === vistaActiva.indice));
    }
  }

  function mostrarVista(vista) {
    vistaActiva = vista;
    reproduciendo = false;
    foto.alt = `${pieza.nombre}: ${vista.etiqueta.toLocaleLowerCase("es-AR")}`;
    foto.src = vista.foto;
    foto.hidden = false;
    errorFoto.hidden = true;
    actualizarControlesDeVista();
  }

  verGif.addEventListener("click", () => {
    if (reproduciendo) {
      mostrarVista(vistaActiva);
      return;
    }
    reproduciendo = true;
    foto.alt = `${pieza.nombre}: secuencia animada de fotos`;
    foto.src = pieza.gif;
    foto.hidden = false;
    errorFoto.hidden = true;
    actualizarControlesDeVista();
  });

  foto.addEventListener("error", () => {
    if (reproduciendo) {
      mostrarVista(vistaActiva);
      movimiento.hidden = true;
      pestañas.querySelector('[aria-pressed="true"]')?.focus();
      return;
    }
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
        if (reproduciendo || vista !== vistaActiva) mostrarVista(vista);
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

  registrarEnBolsa(pieza, tarjeta.querySelector(".order-button"));
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
  registrarEnBolsa(kit, orden);
  return tarjeta;
}

const secciones = new Map([...document.querySelectorAll("[data-shelf]")].map((seccion) => [
  seccion.dataset.shelf, { seccion, mostrar: crearCarrusel(seccion, "Pieza", armarPieza), piezas: [] },
]));
const buscar = document.querySelector("#search-input");
const borrar = document.querySelector("#clear-search");
const estadoBusqueda = document.querySelector("#search-status");
const sinResultados = document.querySelector("#no-results");
const avisoNavidad = document.querySelector("#navidad-note");
const seccionKits = document.querySelector("#kits");
const cabecera = document.querySelector(".site-header");
const navegacion = document.querySelector("#line-nav");
const enlacesDeLinea = [...navegacion.querySelectorAll("a")];
let cuadroNavegacion;

function actualizarNavegacion() {
  cuadroNavegacion = undefined;
  const umbral = cabecera.offsetHeight + navegacion.offsetHeight + 16;
  let activa;
  for (const { seccion } of secciones.values()) {
    if (seccion.hidden) continue;
    if (!activa || seccion.getBoundingClientRect().top <= umbral) activa = seccion.id;
  }
  if (!seccionKits.hidden && seccionKits.getBoundingClientRect().top <= umbral) activa = seccionKits.id;
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
  for (const { seccion, mostrar, piezas } of secciones.values()) {
    const coincidencias = consulta ? piezas.filter(({ nombre }) => nombre.includes(consulta)).map(({ pieza }) => pieza) : piezas.map(({ pieza }) => pieza);
    seccion.hidden = Boolean(consulta) && coincidencias.length === 0;
    mostrar(coincidencias);
    resultados += coincidencias.length;
  }

  avisoNavidad.hidden = secciones.get("navidad").piezas.length > 0;
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

for (const pieza of PIEZAS) {
  secciones.get(lineaDe(pieza)).piezas.push({ pieza, nombre: textoDeBusqueda(pieza.nombre) });
}
crearCarrusel(seccionKits, "Kit", armarKit)(KITS);

for (const dialogo of document.querySelectorAll(".message-sheet")) {
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo || evento.target.closest("[data-close-sheet]")) dialogo.close();
  });
}
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
