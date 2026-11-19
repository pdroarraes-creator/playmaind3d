import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fusionar, LISTAS_CON_ID } from "../src/fusionar.js";

function cargarServidor() {
  const ctx = {};
  vm.createContext(ctx);
  const ruta = new URL("../../server/Codigo.gs", import.meta.url);
  vm.runInContext(fs.readFileSync(ruta, "utf8"), ctx);
  return ctx;
}

const clon = (x) => structuredClone(x);

test("item que solo el servidor tiene es preservado", () => {
  const s = { produtos: [{ id: "a", n: 1 }, { id: "b", n: 2 }] };
  const c = { produtos: [{ id: "a", n: 1 }] };
  assert.deepEqual(fusionar(s, c).produtos.map((p) => p.id), ["a", "b"]);
});

test("item del cliente vence al del servidor con el mismo id", () => {
  const s = { produtos: [{ id: "a", n: "viejo" }] };
  const c = { produtos: [{ id: "a", n: "nuevo" }] };
  assert.deepEqual(fusionar(s, c).produtos, [{ id: "a", n: "nuevo" }]);
});

test("baja hecha desde copia vieja no se aplica", () => {
  const s = { filamentos: [{ id: "f1" }, { id: "f2" }] };
  const c = { filamentos: [{ id: "f1" }] };
  assert.deepEqual(fusionar(s, c).filamentos.map((f) => f.id), ["f1", "f2"]);
});

test("cfg, pedido y pedidoFil: gana el cliente", () => {
  const s = { cfg: { mult: 1 }, pedido: [{ id: "x" }], pedidoFil: [{ id: "y" }] };
  const c = { cfg: { mult: 2 }, pedido: [], pedidoFil: [{ id: "z" }] };
  const r = fusionar(s, c);
  assert.deepEqual(r.cfg, { mult: 2 });
  assert.deepEqual(r.pedido, []);
  assert.deepEqual(r.pedidoFil, [{ id: "z" }]);
  assert.ok(!LISTAS_CON_ID.includes("pedido"));
});

test("vendas quedan de la más nueva a la más vieja por la cadena data", () => {
  const s = { vendas: [{ id: "v1", data: "2026-01-05" }, { id: "v3", data: "2026-03-01" }] };
  const c = { vendas: [{ id: "v2", data: "2026-02-01" }] };
  assert.deepEqual(fusionar(s, c).vendas.map((v) => v.id), ["v3", "v2", "v1"]);
});

test("entradas nulas", () => {
  const c = { a: 1 }, s = { b: 2 };
  assert.deepEqual(fusionar(null, c), c);
  assert.deepEqual(fusionar(s, null), s);
  assert.equal(fusionar(null, null), null);
});

test("no muta las entradas", () => {
  const s = { produtos: [{ id: "b" }] }, c = { produtos: [{ id: "a" }] };
  const s0 = clon(s), c0 = clon(c);
  fusionar(s, c);
  assert.deepEqual(s, s0);
  assert.deepEqual(c, c0);
});

test("items sin id solo sobreviven si vienen del cliente", () => {
  const s = { insumos: [{ n: "solo servidor" }, { id: "i1" }] };
  const c = { insumos: [{ n: "del cliente" }] };
  assert.deepEqual(fusionar(s, c).insumos, [{ n: "del cliente" }, { id: "i1" }]);
});

// PRNG determinístico (mulberry32) con semilla fija
function prng(semilla) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("paridad con fusionar_ en 100 pares generados", () => {
  const ctx = cargarServidor();
  const rnd = prng(20261119);
  const entero = (n) => Math.floor(rnd() * n);
  const fecha = () => {
    const f = [`2026-0${1 + entero(9)}-${10 + entero(19)}`, `2026-1${entero(3)}-0${1 + entero(9)}`, "", null];
    return f[entero(f.length)];
  };
  const item = (marca) => {
    const r = rnd();
    if (r < 0.15) return { n: `${marca}-sinid-${entero(5)}` };
    if (r < 0.2) return null;
    const it = { id: `id${entero(8)}`, n: `${marca}-${entero(100)}` };
    if (rnd() < 0.8) it.data = fecha();
    return it;
  };
  const lado = (marca) => {
    const o = { cfg: { mult: entero(5), marca }, pedido: [{ id: `p${entero(3)}` }] };
    for (const k of LISTAS_CON_ID) {
      const r = rnd();
      if (r < 0.1) continue;
      if (r < 0.15) { o[k] = null; continue; }
      o[k] = Array.from({ length: entero(7) }, () => item(marca));
    }
    return o;
  };
  for (let i = 0; i < 100; i++) {
    const s = lado("s"), c = lado("c");
    const esperado = ctx.fusionar_(clon(s), clon(c));
    // el vm tiene sus propios prototipos: se compara por contenido
    assert.deepEqual(JSON.parse(JSON.stringify(fusionar(s, c))),
      JSON.parse(JSON.stringify(esperado)), `par ${i}`);
  }
});
