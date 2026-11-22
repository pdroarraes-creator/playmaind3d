export const LINEAS = {
  sensartias: { titulo: "Juguetes & Sensartias", corto: "Sensartias", descripcion: "Para enfocarte en clase y calmar las manos, sin pantallas." },
  "3corn": { titulo: "3corn & Deco", corto: "3corn & Deco", descripcion: "Ordena tu escritorio y suma un toque de decoración." },
  navidad: { titulo: "Especial Navidad", corto: "Navidad", descripcion: "Para decorar y regalar durante las fiestas." },
};

const NOMBRES_DE_VISTA = ["1. Limpia", "2. En mano", "3. En uso"];
export const nombreDeVista = (indice) => NOMBRES_DE_VISTA[indice] ?? `Foto ${indice + 1}`;
export const MAX_UNIDADES_POR_ARTICULO = 99;
const PESOS = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0, useGrouping: "always" });
const WHATSAPP_DE_PRUEBA = "5491100000000";

export function lineaDe(pieza) {
  if (pieza.linea) return pieza.linea;
  if (/soporte|estojo|porta|maceta|organiz/i.test(pieza.nombre)) return "3corn";
  if (/navidad|navideñ|esfera|arbol|pino|campana/i.test(pieza.nombre)) return "navidad";
  return "sensartias";
}

export function vistasDe(pieza) {
  return NOMBRES_DE_VISTA.flatMap((nombre, indice) => {
    const foto = pieza.fotos?.[indice];
    return foto ? [{ foto, indice, etiqueta: pieza.nombresDeVista?.[indice] || nombre }] : [];
  });
}

// Qué es el enlace de "video" de una pieza: imagen animada (gif…), video de archivo, u otro enlace (YouTube, Drive…).
export function tipoDeMedia(url) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return "";
  if (/\.(gif|webp|png|jpe?g)(\?|#|$)/i.test(url)) return "imagen";
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return "video";
  return "enlace";
}

// Lo que muestra la ficha: las fotos con su nombre y, al final, la demo si es imagen o video de archivo.
export function vistasFicha(pieza) {
  const vistas = (pieza.fotos ?? []).map((src, indice) => ({ tipo: "foto", src, etiqueta: nombreDeVista(indice) }));
  const tipo = tipoDeMedia(pieza.video);
  if (tipo === "imagen" || tipo === "video") vistas.push({ tipo, src: pieza.video, etiqueta: "Demo" });
  return vistas;
}

// Si el dueño marcó piezas como destacadas, el carrusel muestra solo esas; si no, queda la selección automática.
export function destacadasDe(piezas, { automaticas, max = 6 }) {
  const marcadas = piezas.filter((p) => p.destacada && p.fotos.length);
  return (marcadas.length ? marcadas : automaticas).slice(0, marcadas.length ? 8 : max);
}

// Videos de la portada: los del admin (solo https) o, si no hay, el que viene con el catálogo.
export function videosDeHero(urls, porDefecto) {
  const lista = (urls ?? []).filter((u) => typeof u === "string" && /^https:\/\//i.test(u));
  return lista.length ? lista : [porDefecto];
}

export function horasTxt(horas) {
  if (!Number.isFinite(horas) || horas <= 0) return "";
  const minutos = Math.max(1, Math.round(horas * 60 / 5) * 5);
  const horasEnteras = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horasEnteras === 0) return `~${resto} min`;
  return `~${horasEnteras} h${resto ? ` ${resto} min` : ""}`;
}

export function precioTxt(precio) {
  return `$${PESOS.format(precio)}`;
}

export function ajustarPedido(pedido, articulo, cambio) {
  if (!Number.isInteger(cambio)) return pedido;
  const anterior = pedido.get(articulo) ?? 0;
  const cantidad = Math.max(0, Math.min(MAX_UNIDADES_POR_ARTICULO, anterior + cambio));
  if (cantidad === anterior) return pedido;
  const actualizado = new Map(pedido);
  if (cantidad > 0) actualizado.set(articulo, cantidad);
  else actualizado.delete(articulo);
  return actualizado;
}

export function resumenPedido(pedido) {
  let unidades = 0;
  let total = 0;
  for (const [articulo, cantidad] of pedido) {
    unidades += cantidad;
    total += articulo.precio * cantidad;
  }
  return { unidades, total };
}

export function mensajePedidoWA(pedido) {
  const items = [...pedido].flatMap(([articulo, cantidad]) => [
    `${cantidad} × ${articulo.nombre} · ${precioTxt(articulo.precio * cantidad)}`,
    ...(articulo.medida ? [`   Tamaño: ${articulo.medida}`] : []),
    ...(articulo.piezas ? [`   Incluye: ${articulo.piezas.join(" + ")}`] : []),
  ]);
  return [
    "¡Hola PlayMind 3D! Quiero hacer este pedido:",
    "",
    ...items,
    "",
    `Total estimado: ${precioTxt(resumenPedido(pedido).total)}`,
    "¿Me confirman la disponibilidad y la entrega en Pilar?",
  ].join("\n");
}

export function descuentoPct(kit) {
  if (kit.precioSeparado <= 0) return 0;
  return Math.max(0, Math.round((1 - kit.precio / kit.precioSeparado) * 100));
}

export function linkWA(mensaje) {
  return `https://wa.me/${WHATSAPP_DE_PRUEBA}?text=${encodeURIComponent(mensaje)}`;
}

export function textoDeBusqueda(texto) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-AR").trim();
}
