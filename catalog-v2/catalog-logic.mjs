export const LINEAS = {
  sensartias: { titulo: "Juguetes & Sensartias", corto: "Sensartias", descripcion: "Para enfocarte en clase y calmar las manos, sin pantallas." },
  "3corn": { titulo: "3corn & Deco", corto: "3corn & Deco", descripcion: "Ordena tu escritorio y suma un toque de decoración." },
  navidad: { titulo: "Especial Navidad", corto: "Navidad", descripcion: "Para decorar y regalar durante las fiestas." },
};

const NOMBRES_DE_VISTA = ["Vista principal", "Otra vista", "Vista en uso"];
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
