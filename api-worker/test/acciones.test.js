import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { crearD1 } from "./d1-falso.js";
import { ACCIONES, manejarPost } from "../src/rutas.js";
import { leerEstado, guardarConFusion } from "../src/estado.js";

// La hora del Worker es la de Buenos Aires (como la zona del Apps Script);
// el vm del servidor usa la zona del proceso para armar el mes pasado.
process.env.TZ = "America/Argentina/Buenos_Aires";

const AHORA = Date.UTC(2026, 10, 19, 15, 0, 0); // 19/11/2026

function armar(estado, extra = {}) {
  const db = crearD1();
  const llamadas = [];
  const ctx = {
    env: { APPS_SCRIPT_URL: "https://apps.test/exec", SNAPSHOT: "off" },
    db,
    ahora: () => AHORA,
    fetchFn: async (url, init) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify({ ok: true }));
    },
    verificar: async () => ({ ok: true }),
    esperar: () => {},
    ...extra,
  };
  const sembrar = async () => {
    if (estado) await guardarConFusion(db, structuredClone(estado), 0);
  };
  return { ctx, db, llamadas, sembrar };
}
const post = (ctx, body) => manejarPost({ token: "tok-1", ...body }, ctx);

const base = () => ({
  filamentos: [
    { id: "f1", num: 3, marca: "Grilon", nome: "PLA", cor: "rojo", precoKg: 20000, rollo: 1000, stock: 400 },
    { id: "f2", num: 7, marca: "", nome: "PETG", cor: "", precoKg: 25000, rollo: 0, stock: 900 },
  ],
  impressoras: [{ id: "i1", preco: 600000, vida: 5000, watts: 120, bico: 1000, bicoVida: 500, mesa: 3000, mesaVida: 1000 }],
  insumos: [
    { id: "s1", nome: "Imán", pack: 500, unid: 50, stock: 12 },
    { id: "s2", nome: "Cadena", preco: 30, stock: 5 },
  ],
  canais: [{ id: "c1", nome: "Feria" }],
  cfg: { mult: 3, round: 50 },
  produtos: [
    { id: "p1", nome: "Llavero Dragón", peso: 12.34, h: 1, m: 30, fil: "f1", imp: "i1", cplx: 1, desc: "viejo", cat: "Llaveros", stock: 4, insumos: { s1: 1 } },
    { id: "p2", nome: "Maceta", peso: 80, h: 4, fil: "borrado", imp: "i1", cplx: 1.5, stock: "x" },
    { id: "p3", nome: "Soporte", peso: 20, h: 2, fil: "f2", imp: "i1", manual: 9999, cat: "Útiles" },
  ],
  vendas: [
    { id: "v1", data: "2026-11-10", cliente: "Ana", canal: "c1", forma: "efectivo", total: 5000.4, lucro: 2000.6, pago: true, entregue: true, itens: [{ nome: "Maceta", qtd: 2 }] },
    { id: "v2", data: "2026-10-28", cliente: "Beto", canal: "zz", total: 3000, lucro: 1000, pago: false, entregue: false, itens: [] },
    { id: "v3", data: "2026-09-01", total: 100, lucro: 10, pago: false, entregue: true },
  ],
  pedido: { p1: 3, p2: 0, nope: 2 },
});

// ---------- editarPieza ----------

test("editarPieza cambia sólo los cinco campos y ninguno más", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  const antes = (await leerEstado(ctx.db)).data.produtos[0];
  const r = await post(ctx, {
    action: "editarPieza",
    pieza: "Llavero Dragón",
    campos: { desc: "nueva", detalle: "d", medida: 5, tags: "a,b", cat: "X", preco: 1, manual: 2, nome: "otro", peso: 99 },
  });
  assert.deepEqual(r, { ok: true });
  const p = (await leerEstado(ctx.db)).data.produtos[0];
  assert.deepEqual(
    { desc: p.desc, detalle: p.detalle, medida: p.medida, tags: p.tags, cat: p.cat },
    { desc: "nueva", detalle: "d", medida: "5", tags: "a,b", cat: "X" },
  );
  for (const k of ["preco", "manual", "nome", "peso", "h", "fil"]) assert.deepEqual(p[k], antes[k], k);
});

test("editarPieza encuentra la pieza con acentos y mayúsculas y avanza la versión", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  const v0 = (await leerEstado(ctx.db)).v;
  const r = await post(ctx, { action: "editarPieza", pieza: "  LLAVERO  dragón!! ", campos: { desc: "ok" } });
  assert.deepEqual(r, { ok: true });
  const { data, v } = await leerEstado(ctx.db);
  assert.equal(data.produtos[0].desc, "ok");
  assert.equal(v, v0 + 1);
});

test("editarPieza con nombres repetidos gana la última coincidencia (como el servidor)", async () => {
  const e = base();
  e.produtos.push({ id: "p4", nome: "llavero dragón", peso: 1 });
  const { ctx, sembrar } = armar(e);
  await sembrar();
  await post(ctx, { action: "editarPieza", pieza: "Llavero Dragón", campos: { desc: "Z" } });
  const { data } = await leerEstado(ctx.db);
  assert.equal(data.produtos[0].desc, "viejo");
  assert.equal(data.produtos[3].desc, "Z");
});

test("editarPieza: pieza inexistente y banco vacío", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  assert.deepEqual(await post(ctx, { action: "editarPieza", pieza: "nada", campos: {} }), { ok: false, error: "pieza no encontrada" });
  const vacio = armar(null);
  assert.deepEqual(await post(vacio.ctx, { action: "editarPieza", pieza: "x", campos: {} }), { ok: false, error: "sin datos" });
});

// ---------- agregarPieza ----------

test("agregarPieza: sin nombre y sin datos", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  assert.deepEqual(await post(ctx, { action: "agregarPieza", pieza: { nome: "  " } }), { ok: false, error: "falta el nombre" });
  assert.deepEqual(await post(ctx, { action: "agregarPieza" }), { ok: false, error: "falta el nombre" });
  const vacio = armar(null);
  assert.deepEqual(await post(vacio.ctx, { action: "agregarPieza", pieza: { nome: "A" } }), { ok: false, error: "sin datos" });
});

test("agregarPieza: defaults del servidor e id nuevo cada vez", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  const r1 = await post(ctx, { action: "agregarPieza", pieza: { nome: " Nueva ", manual: "" } });
  const r2 = await post(ctx, { action: "agregarPieza", pieza: { nome: "Nueva", manual: "150", peso: "7", cplx: 2 } });
  assert.equal(r1.ok, true);
  assert.notEqual(r1.id, r2.id);
  const { data } = await leerEstado(ctx.db);
  const a = data.produtos.find((p) => p.id === r1.id);
  const b = data.produtos.find((p) => p.id === r2.id);
  assert.equal(a.nome, "Nueva");
  assert.equal(a.fil, "f1");
  assert.equal(a.imp, "i1");
  assert.equal(a.cplx, 1);
  assert.equal(a.manual, null);
  assert.equal(a.peso, 0);
  assert.deepEqual(a.fotos, []);
  assert.equal(a.foto, null);
  assert.equal(a.libre, false);
  assert.deepEqual(a.insumos, {});
  assert.equal(b.manual, 150);
  assert.equal(b.peso, 7);
  assert.equal(b.cplx, 2);
});

test("agregarPieza con foto base64 la sube con el token del usuario y no guarda data:image", async () => {
  const { ctx, sembrar, llamadas } = armar(base(), {
    fetchFn: async (url, init) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: { produtos: [{ id: "x", fotos: ["https://lh3.googleusercontent.com/d/abc"] }] } }));
    },
  });
  await sembrar();
  const r = await post(ctx, { action: "agregarPieza", pieza: { nome: "Con foto", fotos: ["data:image/jpeg;base64,AAAA"] } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(llamadas.length, 1);
  assert.equal(JSON.parse(llamadas[0].init.body).token, "tok-1");
  const crudo = JSON.stringify((await leerEstado(ctx.db)).data);
  assert.ok(!crudo.includes("data:image"));
});

test("agregarPieza: si la subida de fotos falla devuelve el error y no guarda nada", async () => {
  const { ctx, sembrar, db } = armar(base(), { fetchFn: async () => { throw new Error("red caída"); } });
  await sembrar();
  const v0 = (await leerEstado(db)).v;
  const r = await post(ctx, { action: "agregarPieza", pieza: { nome: "Con foto", fotos: ["data:image/jpeg;base64,AAAA"] } });
  assert.equal(r.ok, false);
  assert.match(r.error, /^fotos:/);
  const { data, v } = await leerEstado(db);
  assert.equal(v, v0);
  assert.equal(data.produtos.length, 3);
});

// ---------- agregarFilamento ----------

test("agregarFilamento: num = mayor + 1, rollo 1000 y stock = rollo", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  const r = await post(ctx, { action: "agregarFilamento", filamento: { nome: " PLA ", marca: "Sunlu", precoKg: "18000" } });
  assert.equal(r.ok, true);
  assert.equal(r.num, 8);
  const f = (await leerEstado(ctx.db)).data.filamentos.find((x) => x.id === r.id);
  assert.deepEqual(f, { id: r.id, num: 8, marca: "Sunlu", nome: "PLA", cor: "", hex: "#CFC3AE", precoKg: 18000, rollo: 1000, stock: 1000 });
  const r2 = await post(ctx, { action: "agregarFilamento", filamento: { nome: "ABS", rollo: 750 } });
  assert.equal(r2.num, 9);
  assert.notEqual(r2.id, r.id);
  const f2 = (await leerEstado(ctx.db)).data.filamentos.find((x) => x.id === r2.id);
  assert.equal(f2.stock, 750);
});

test("agregarFilamento: sin nombre y sin datos", async () => {
  const { ctx, sembrar } = armar(base());
  await sembrar();
  assert.deepEqual(await post(ctx, { action: "agregarFilamento", filamento: { nome: "" } }), { ok: false, error: "falta el nombre/tipo" });
  const vacio = armar(null);
  assert.deepEqual(await post(vacio.ctx, { action: "agregarFilamento", filamento: { nome: "A" } }), { ok: false, error: "sin datos" });
});

// ---------- resumenNegocio ----------

function servidorConEstado(estado) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL("../../server/Codigo.gs", import.meta.url), "utf8"), sandbox);
  const RealDate = vm.runInContext("Date", sandbox);
  // Date con "ahora" fijo cuando se llama sin argumentos
  sandbox.Date = class extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [AHORA]));
    }
    static now() {
      return AHORA;
    }
  };
  sandbox.Session = { getScriptTimeZone: () => "America/Argentina/Buenos_Aires" };
  sandbox.Utilities = {
    formatDate(d, tz) {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(d);
      return p.find((x) => x.type === "year").value + "-" + p.find((x) => x.type === "month").value;
    },
  };
  sandbox.leerEstado_ = () => structuredClone(estado);
  return sandbox;
}

test("resumenNegocio coincide con resumenNegocio_ del servidor sobre el mismo estado", async () => {
  const estado = base();
  const { ctx, sembrar } = armar(estado);
  await sembrar();
  const esperado = JSON.parse(JSON.stringify(servidorConEstado(estado).resumenNegocio_()));
  const r = JSON.parse(JSON.stringify(await post(ctx, { action: "resumenNegocio" })));
  assert.equal(r.ok, true);
  assert.deepEqual(r.resumen.piezas, esperado.resumen.piezas);
  assert.deepEqual(r.resumen.filamentos, esperado.resumen.filamentos);
  assert.deepEqual(r.resumen.insumos, esperado.resumen.insumos);
  assert.deepEqual(r, esperado);
  // el estado inventado ejercita lo difícil
  assert.equal(r.resumen.este_mes.mes, "2026-11");
  assert.equal(r.resumen.mes_pasado.mes, "2026-10");
  assert.equal(r.resumen.este_mes.ventas, 1);
  assert.equal(r.resumen.mes_pasado.ventas, 1);
});

test("resumenNegocio con banco vacío", async () => {
  const { ctx } = armar(null);
  assert.deepEqual(await post(ctx, { action: "resumenNegocio" }), { ok: false, error: "sin datos" });
});

test("ACCIONES expone load, save y las cuatro acciones nuevas", () => {
  for (const k of ["load", "save", "editarPieza", "agregarPieza", "agregarFilamento", "resumenNegocio"]) {
    assert.equal(typeof ACCIONES[k], "function", k);
  }
});
