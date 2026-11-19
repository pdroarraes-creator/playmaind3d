// Catálogo público: porte de catalogoPublico_ y fotoChica_ de server/Codigo.gs.
// Nunca expone costo, ganancia, clientes ni ventas: sólo lo que se arma acá.
import Calculo from "./calculo.js";
import { leerEstado, leerVersion } from "./estado.js";

// Ancho máximo de las fotos del catálogo; las originales quedan en Drive.
const FOTO_PARAM = "w800";

// Agrega el tamaño a las URLs de Drive que todavía no lo tienen. Cualquier otro
// valor (otra URL, ya medida, data:, vacío, no-string) vuelve igual.
export function fotoChica(url) {
  if (typeof url !== "string") return url;
  if (!/^https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_-]+$/.test(url)) return url;
  return url + "=" + FOTO_PARAM;
}

const n = (x) => {
  x = parseFloat(x);
  return isFinite(x) ? x : 0;
};

export function catalogoPublico(data) {
  if (!data || !data.produtos) return { marca: "", wa: "", piezas: [] };

  const piezas = [];
  for (const p of data.produtos || []) {
    if (p.oculta) continue;
    const r = Calculo.calcular(p, data);
    let fotos = [];
    if (p.fotos && p.fotos.length) fotos = p.fotos;
    else if (p.foto) fotos = [p.foto];
    fotos = fotos.map(fotoChica); // copia nueva: no se toca el estado guardado
    piezas.push({
      nome: p.nome || "",
      cat: p.cat || "",
      desc: p.desc || "",
      libre: !!p.libre,
      precio: Math.round(r.preco),
      medida: p.medida || "",
      horas: Math.round((n(p.h) + n(p.m) / 60) * 10) / 10,
      video: p.video || "",
      detalle: p.detalle || "",
      tags: p.tags || "",
      stock: n(p.stock),
      vendidas: 0,
      fotos,
    });
  }

  // cuántas se vendieron de cada una, para marcar la más pedida
  const cuenta = {};
  for (const v of data.vendas || []) {
    for (const i of v.itens || []) {
      const k = String(i.nome || "");
      cuenta[k] = (cuenta[k] || 0) + n(i.qtd);
    }
  }
  for (const p of piezas) p.vendidas = cuenta[p.nome] || 0;

  const colores = [];
  for (const f of data.filamentos || []) {
    if (!f.cor) continue;
    colores.push({ nome: f.cor, hex: f.hex || "" });
  }

  const packs = [];
  for (const k of data.packs || []) {
    if (!k.nome) continue;
    const off = n(k.off);
    if (off > 0) {
      // regla de descuento: se aplica sólo en el carrito
      packs.push({
        tipo: "descuento", nome: k.nome, off,
        desde: Math.max(n(k.desde), 2),
        piezas: String(k.piezas || ""),
        desc: k.desc || "", incluye: k.incluye || "",
      });
    } else if (n(k.preco) > 0) {
      packs.push({
        tipo: "fijo", nome: k.nome, qtd: n(k.qtd), precio: Math.round(n(k.preco)),
        sueltas: Math.round(n(k.sueltas)), incluye: k.incluye || "", desc: k.desc || "",
      });
    }
  }

  const opiniones = [];
  for (const o of data.opiniones || []) {
    if (o.visible === false || !o.texto) continue;
    opiniones.push({ quien: o.quien || "", pieza: o.pieza || "", texto: o.texto });
  }

  const leti = (data.cfg && data.cfg.leti) || {};
  return {
    opiniones,
    marca: (data.cfg && data.cfg.marca) || "Play Mind 3d",
    wa: (data.cfg && data.cfg.wa) || "",
    colores,
    packs,
    piezas,
    leti: {
      cita: leti.cita || "",
      historia: leti.historia || "",
      foto: fotoChica(leti.foto || ""),
    },
  };
}

const TTL_POR_DEFECTO = 900;

// La clave lleva la versión `v` de la fila: toda grabación la sube, así que el
// cache se invalida solo y nunca se sirve un precio más viejo que la última
// grabación. Se lee `v` ANTES que el estado: si una grabación llega en medio, el
// catálogo calculado es más nuevo que la clave (inofensivo), nunca más viejo.
export async function catalogoCacheado(db, cache, { ttl = TTL_POR_DEFECTO } = {}) {
  const v = await leerVersion(db);
  const req = new Request(`https://cache.playmind3d.invalid/catalogo?v=${v}`);

  try {
    const hit = await cache.match(req);
    if (hit) return await hit.json();
  } catch {
    // un cache roto no debe tumbar el catálogo: se calcula igual
  }

  const { data } = await leerEstado(db);
  const cat = catalogoPublico(data);

  try {
    if (cat.piezas.length > 0) {
      await cache.put(req, new Response(JSON.stringify(cat), {
        headers: { "Cache-Control": `max-age=${ttl}`, "Content-Type": "application/json" },
      }));
    }
  } catch {
    // idem: sin cache igual se responde
  }
  return cat;
}

const SIN_CACHE = { async match() { return undefined; }, async put() {} };

// Respuesta pública: CORS abierto (el catálogo es público por diseño y la
// página se sirve también desde otros orígenes). Si algo falla, HTTP 200 con
// error: la página muestra su propio mensaje.
export async function manejarCatalogo(env, cache) {
  const cabeceras = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" };
  try {
    const catalogo = await catalogoCacheado(env.DB, cache || SIN_CACHE);
    return new Response(JSON.stringify({ ok: true, catalogo }), { status: 200, headers: cabeceras });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "catalogo no disponible" }), { status: 200, headers: cabeceras });
  }
}
