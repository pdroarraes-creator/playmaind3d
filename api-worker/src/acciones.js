// Acciones que modifican el estado, portadas de editarPieza_, agregarPieza_,
// agregarFilamento_ y resumenNegocio_ de server/Codigo.gs. Mismos errores,
// mismas respuestas. Cada una lee { data, v }, modifica y guarda con fusión.
import { leerEstado, guardarConFusion } from "./estado.js";
import { contieneFotosNuevas, subirFotos } from "./fotos.js";
import { snapshotTrasGrabar } from "./snapshot.js";
import Calculo from "./calculo.js";

const CAMPOS_EDITABLES = ["desc", "detalle", "medida", "tags", "cat"];

// La misma zona que usa el Apps Script del negocio (Argentina, sin horario de verano).
const OFFSET_HORAS = -3;

const norm = (x) =>
  String(x || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Igual que n() del servidor: parseFloat y 0 si no es finito.
const n = (x) => {
  x = parseFloat(x);
  return Number.isFinite(x) ? x : 0;
};

// Guarda y devuelve la respuesta de éxito, o el conflicto tal cual.
async function guardar(ctx, data, v, exito) {
  const r = await guardarConFusion(ctx.db, data, v);
  if (!r.ok) return r;
  snapshotTrasGrabar(ctx, r);
  return exito;
}

export async function editarPieza(body, ctx) {
  const { data, v } = await leerEstado(ctx.db);
  if (!data || !data.produtos) return { ok: false, error: "sin datos" };
  let p = null;
  // como el servidor: si varias piezas coinciden, queda la última
  for (const x of data.produtos) if (norm(x.nome) === norm(body.pieza)) p = x;
  if (!p) return { ok: false, error: "pieza no encontrada" };
  const campos = body.campos;
  for (const k of CAMPOS_EDITABLES) {
    // un null llega como el texto "null": fiel al servidor
    if (campos && campos[k] !== undefined) p[k] = String(campos[k]);
  }
  return guardar(ctx, data, v, { ok: true });
}

export async function agregarPieza(body, ctx) {
  const pieza = body.pieza;
  if (!pieza || !String(pieza.nome || "").trim()) return { ok: false, error: "falta el nombre" };
  const { data, v } = await leerEstado(ctx.db);
  if (!data) return { ok: false, error: "sin datos" };
  data.produtos = data.produtos || [];
  const fil = (data.filamentos || [])[0];
  const imp = (data.impressoras || [])[0];
  const fotos = pieza.fotos || (pieza.foto ? [pieza.foto] : []);
  const p = {
    id: crypto.randomUUID(),
    nome: String(pieza.nome).trim(),
    ref: "",
    foto: fotos[0] || null,
    fotos,
    fil: pieza.fil || (fil && fil.id) || null,
    imp: pieza.imp || (imp && imp.id) || null,
    peso: Number(pieza.peso) || 0,
    h: Number(pieza.h) || 0,
    m: Number(pieza.m) || 0,
    mo: Number(pieza.mo) || 0,
    insumos: pieza.insumos || {},
    risco: null,
    mult: null,
    cplx: Number(pieza.cplx) || 1,
    manual: pieza.manual != null && pieza.manual !== "" ? Number(pieza.manual) : null,
    mercado: null,
    cat: String(pieza.cat || "").trim(),
    desc: String(pieza.desc || "").trim(),
    libre: !!pieza.libre,
    medida: String(pieza.medida || "").trim(),
    video: "",
    detalle: String(pieza.detalle || "").trim(),
    tags: String(pieza.tags || "").trim(),
  };
  data.produtos.push(p);
  let nuevo = data;
  if (contieneFotosNuevas(nuevo)) {
    try {
      nuevo = await subirFotos(ctx.env, ctx.token, nuevo, ctx.fetchFn);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return guardar(ctx, nuevo, v, { ok: true, id: p.id });
}

export async function agregarFilamento(body, ctx) {
  const fil = body.filamento;
  if (!fil || !String(fil.nome || "").trim()) return { ok: false, error: "falta el nombre/tipo" };
  const { data, v } = await leerEstado(ctx.db);
  if (!data) return { ok: false, error: "sin datos" };
  data.filamentos = data.filamentos || [];
  const rollo = Number(fil.rollo) || 1000;
  // siempre uno más que el mayor: borrar uno del medio no reusa su número
  let proximo = 0;
  for (const x of data.filamentos) proximo = Math.max(proximo, Number(x.num) || 0);
  proximo++;
  const f = {
    id: crypto.randomUUID(),
    num: proximo,
    marca: String(fil.marca || "").trim(),
    nome: String(fil.nome || "").trim(),
    cor: String(fil.cor || "").trim(),
    hex: String(fil.hex || "#CFC3AE"),
    precoKg: Number(fil.precoKg) || 0,
    rollo,
    stock: rollo,
  };
  data.filamentos.push(f);
  return guardar(ctx, data, v, { ok: true, id: f.id, num: f.num });
}

// "yyyy-MM" de un instante en la zona del negocio
function mesDe(ms) {
  const d = new Date(ms + OFFSET_HORAS * 3600 * 1000);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

export async function resumenNegocio(_body, ctx) {
  const { data } = await leerEstado(ctx.db);
  if (!data) return { ok: false, error: "sin datos" };

  const piezas = (data.produtos || []).map((p) => {
    const r = Calculo.calcular(p, data);
    return {
      nome: p.nome || "",
      cat: p.cat || "",
      stock: n(p.stock),
      custo: Math.round(r.custo),
      preco: Math.round(r.preco),
      margen_pct: r.preco ? Math.round(((r.preco - r.custo) / r.preco) * 100) : 0,
    };
  });

  const filamentos = (data.filamentos || []).map((f) => ({
    num: n(f.num) || null,
    nome: ((f.marca || "") + " " + (f.nome || "") + (f.cor ? " - " + f.cor : "")).trim(),
    stock_g: n(f.stock),
    rollo_g: n(f.rollo) || 1000,
    precoKg: n(f.precoKg),
  }));

  const insumos = (data.insumos || []).map((i) => ({
    nome: i.nome || "",
    stock: n(i.stock),
    paquete: n(i.unid) || 1,
  }));

  const canales = {};
  for (const c of data.canais || []) canales[c.id] = c.nome;

  const ahora = ctx.ahora();
  const mesActual = mesDe(ahora);
  const local = new Date(ahora + OFFSET_HORAS * 3600 * 1000);
  const mesPasado = mesDe(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - OFFSET_HORAS * 3600 * 1000);

  const vendas = data.vendas || [];
  const totalesDe = (mes) => {
    const t = { mes, facturado: 0, ganancia: 0, ventas: 0 };
    for (const v of vendas) {
      if (String(v.data || "").slice(0, 7) !== mes) continue;
      t.facturado += n(v.total);
      t.ganancia += n(v.lucro);
      t.ventas++;
    }
    t.facturado = Math.round(t.facturado);
    t.ganancia = Math.round(t.ganancia);
    return t;
  };

  let pendiente = 0;
  let sinEntregar = 0;
  for (const v of vendas) {
    if (!v.pago) pendiente += n(v.total);
    if (!v.entregue) sinEntregar++;
  }

  const recientes = vendas.slice(0, 20).map((v) => ({
    data: v.data || "",
    cliente: v.cliente || "",
    canal: canales[v.canal] || "",
    forma: v.forma || "",
    total: Math.round(n(v.total)),
    lucro: Math.round(n(v.lucro)),
    pago: !!v.pago,
    entregue: !!v.entregue,
    itens: (v.itens || []).map((i) => n(i.qtd) + "x " + (i.nome || "")).join(", "),
  }));

  const porId = {};
  for (const p of data.produtos || []) porId[p.id] = p;
  const pedido = [];
  for (const id in data.pedido || {}) {
    const q = n(data.pedido[id]);
    if (q > 0 && porId[id]) pedido.push({ nome: porId[id].nome || "", qtd: q });
  }

  return {
    ok: true,
    resumen: {
      piezas,
      filamentos,
      insumos,
      pedido_a_imprimir: pedido,
      este_mes: totalesDe(mesActual),
      mes_pasado: totalesDe(mesPasado),
      por_cobrar: Math.round(pendiente),
      ventas_sin_entregar: sinEntregar,
      ventas_recientes: recientes,
    },
  };
}
