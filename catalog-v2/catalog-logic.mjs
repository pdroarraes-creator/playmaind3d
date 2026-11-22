export const LINEAS = {
  sensartias: { titulo: "Juguetes & Sensartias", corto: "Sensartias", descripcion: "Para enfocarte en clase y calmar las manos, sin pantallas." },
  "3corn": { titulo: "3corn & Deco", corto: "3corn & Deco", descripcion: "Ordena tu escritorio y suma un toque de decoración." },
  navidad: { titulo: "Especial Navidad", corto: "Navidad", descripcion: "Para decorar y regalar durante las fiestas." },
};

const NOMBRES_DE_VISTA = ["Limpia", "En mano", "En uso"];
const PESOS = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0, useGrouping: "always" });
const WHATSAPP_DE_PRUEBA = "5491100000000";
const SALUDO = "Hola PlayMind 3D! Quiero pedir:";
const ENTREGA = "¿Coordinamos la entrega en Pilar?";

export function lineaDe(pieza) {
  if (pieza.linea) return pieza.linea;
  if (/soporte|estojo|porta|maceta|organiz/i.test(pieza.nombre)) return "3corn";
  if (/navidad|navideñ|esfera|arbol|pino|campana/i.test(pieza.nombre)) return "navidad";
  return "sensartias";
}

export function vistasDe(pieza) {
  return NOMBRES_DE_VISTA.flatMap((nombre, indice) => {
    const foto = pieza.fotos?.[indice];
    return foto ? [{ foto, nombre, indice, etiqueta: `${indice + 1}. ${nombre}` }] : [];
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

export function mensajeWA(pieza, vistaActiva = 0) {
  const vistas = vistasDe(pieza);
  const vista = vistas.find(({ indice }) => indice === vistaActiva) ?? vistas[0];
  return [
    SALUDO,
    `Línea: ${LINEAS[lineaDe(pieza)].titulo}`,
    `Pieza: ${pieza.nombre}`,
    vistas.length > 1 ? `Vista: ${vista.etiqueta}` : null,
    pieza.medida ? `Tamaño: ${pieza.medida}` : null,
    `Precio: ${precioTxt(pieza.precio)}`,
    ENTREGA,
  ].filter(Boolean).join("\n");
}

export function mensajeKitWA(kit) {
  return [
    SALUDO,
    `Línea: ${LINEAS[kit.linea].corto}`,
    `Kit: ${kit.nombre}`,
    `Incluye: ${kit.piezas.join(" + ")}`,
    `Precio: ${precioTxt(kit.precio)}`,
    ENTREGA,
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
