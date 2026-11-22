import { horasTxt } from "./catalog-logic.mjs";

export const SERVIDOR_CATALOGO =
  "https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec?action=catalogo";

export const CATEGORIAS = {
  todos: "Todos",
  sensoriales: "Juegos Sensoriales",
  deco: "D3cor",
  personalizados: "Personalizados",
  kits: "Kits para Regalo",
};

const MAS_PEDIDO_DESDE = 3;
const MAX_ETIQUETAS = 3;

const numero = (valor) => {
  const n = parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
};
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const slug = (valor) =>
  String(valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function lineaDe({ cat, nome }) {
  const categoria = slug(cat);
  if (/personaliz/.test(categoria)) return "personalizados";
  if (/deco|d3cor|hogar|escritorio/.test(categoria)) return "deco";
  if (/kit|pack|regalo/.test(categoria)) return "kits";
  if (/sensor|fidget|jugue|juego/.test(categoria)) return "sensoriales";
  const nombre = slug(nome);
  if (/personaliz/.test(nombre)) return "personalizados";
  if (/(^|-)(kit|pack)(-|$)|sorpresa/.test(nombre)) return "kits";
  if (/soporte|estojo|porta|maceta|organiz/.test(nombre)) return "deco";
  return "sensoriales";
}

// Mismas frases que el catálogo actual cuando la pieza no tiene descripción.
function fraseAuto(pieza) {
  if (pieza.libre) return "Se imprime a pedido, en el color que elijas.";
  if (numero(pieza.horas) >= 6) return "Una de las piezas más trabajadas del catálogo.";
  return "Hecha a pedido, una por una.";
}

function disponibilidadTxt(stock) {
  if (stock <= 0) return "Se imprime a pedido";
  return `Hay ${stock} lista${stock > 1 ? "s" : ""} para entregar`;
}

export function adaptarCatalogo(catalogo) {
  const c = catalogo ?? {};
  const usados = new Set();
  const idUnico = (nombre) => {
    const base = slug(nombre) || "pieza";
    let id = base;
    for (let i = 2; usados.has(id); i++) id = `${base}-${i}`;
    usados.add(id);
    return id;
  };

  const peso = (p) => (p.fotos?.length ? 2 : 0) + (p.desc ? 1 : 0);
  const piezas = (c.piezas ?? []).filter((p) => texto(p?.nome)).sort((a, b) => peso(b) - peso(a));

  const productos = piezas.map((p) => {
    const stock = Math.max(0, Math.floor(numero(p.stock)));
    const libre = Boolean(p.libre);
    const propias = texto(p.tags).split(",").map((t) => t.trim()).filter(Boolean);
    const navidad = /navid|arbol|papa-noel|reno/.test(slug(`${p.nome} ${p.cat} ${p.tags}`));
    const etiquetas = [
      ...(numero(p.vendidas) >= MAS_PEDIDO_DESDE ? ["Más pedido"] : []),
      ...(stock > 0 ? ["Lista para llevar"] : []),
      ...(libre ? ["Elegís el color"] : []),
      ...propias,
    ].slice(0, MAX_ETIQUETAS);
    return {
      id: idUnico(p.nome),
      nombre: texto(p.nome),
      linea: lineaDe(p),
      precio: Math.max(0, Math.round(numero(p.precio))),
      fotos: (p.fotos ?? []).filter((foto) => typeof foto === "string" && /^https:\/\//.test(foto)),
      video: /^https:\/\//.test(texto(p.video)) ? texto(p.video) : "",
      tags: etiquetas,
      busqueda: propias.join(" "),
      navidad,
      libre,
      stock,
      rasgo: texto(p.desc) || fraseAuto(p),
      detalle: texto(p.detalle) || (stock > 0 ? "" : "Se imprime a pedido, una por una."),
      medida: texto(p.medida),
      tiempo: horasTxt(numero(p.horas)),
      disponibilidad: disponibilidadTxt(stock),
    };
  });

  const packs = c.packs ?? [];
  for (const k of packs) {
    if (k?.tipo !== "fijo" || !texto(k.nome) || numero(k.precio) <= 0) continue;
    productos.push({
      id: idUnico(k.nome),
      nombre: texto(k.nome),
      linea: "kits",
      precio: Math.round(numero(k.precio)),
      fotos: [],
      video: "",
      tags: ["Pack"],
      busqueda: "pack",
      navidad: /navid/.test(slug(k.nome)),
      libre: false,
      stock: 0,
      rasgo: texto(k.desc) || texto(k.incluye) || "Pack armado, listo para regalar.",
      detalle: texto(k.incluye) ? `Incluye: ${texto(k.incluye)}` : "Se imprime a pedido, una por una.",
      medida: "",
      tiempo: "",
      disponibilidad: disponibilidadTxt(0),
    });
  }

  const reglas = packs
    .filter((k) => k?.tipo === "descuento" && numero(k.off) > 0)
    .map((k) => ({
      nombre: texto(k.nome),
      off: numero(k.off),
      desde: Math.max(2, numero(k.desde)),
      piezas: texto(k.piezas).split(",").map(slug).filter(Boolean),
    }));

  const colores = [...new Set((c.colores ?? []).map((color) => texto(color?.nome)).filter(Boolean))];

  return { productos, reglas, colores, whatsapp: String(c.wa ?? "").replace(/\D/g, "") };
}

const aplica = (regla, nombre) => regla.piezas.length === 0 || regla.piezas.includes(slug(nombre));

// Porte de totales() del catálogo actual: se aplica la regla que más descuenta
// y se avisa cuánto falta para la más cercana.
export function totalesPedido(items, reglas) {
  let unidades = 0;
  let bruto = 0;
  for (const item of items) {
    unidades += item.cantidad;
    bruto += item.cantidad * item.precio;
  }
  let descuento = 0;
  let regla = null;
  let falta = null;
  for (const r of reglas) {
    let cantidad = 0;
    let base = 0;
    for (const item of items) {
      if (!aplica(r, item.nombre)) continue;
      cantidad += item.cantidad;
      base += item.cantidad * item.precio;
    }
    if (cantidad >= r.desde) {
      const d = Math.round(base * r.off / 100);
      if (d > descuento) {
        descuento = d;
        regla = r;
      }
    } else if (cantidad > 0 && (!falta || r.desde - cantidad < falta.unidades)) {
      falta = { unidades: r.desde - cantidad, off: r.off };
    }
  }
  return { unidades, bruto, descuento, regla, falta, total: bruto - descuento };
}

export function linkWhatsApp(numeroWA, mensaje) {
  const digitos = String(numeroWA ?? "").replace(/\D/g, "");
  return digitos ? `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}` : "";
}

export async function pedirCatalogo(pedir = fetch) {
  const respuesta = await pedir(SERVIDOR_CATALOGO, { method: "GET" });
  if (!respuesta.ok) throw new Error("No se pudo conectar con el catálogo");
  const json = await respuesta.json();
  if (!json?.ok || !json.catalogo) throw new Error("Catálogo no disponible");
  return json.catalogo;
}
