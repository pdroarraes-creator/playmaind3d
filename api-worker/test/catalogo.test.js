import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { crearD1 } from "./d1-falso.js";
import { guardarEstado } from "../src/estado.js";
import { fotoChica, catalogoPublico, catalogoCacheado, manejarCatalogo } from "../src/catalogo.js";
import worker from "../src/index.js";

// Estado inventado, con de todo lo que el catálogo tiene que filtrar o transformar.
function estadoInventado() {
  return {
    cfg: {
      marca: "Marca de Prueba", wa: "5491100000000", merma: 12, kwh: 120, maoObra: 3000,
      risco: 10, mult: 2.5, round: 50, token: "tok-secreto", key: "clave-secreta",
      leti: { cita: "Una cita", historia: "Una historia", foto: "https://lh3.googleusercontent.com/d/FOTOLETI_1" },
      hero: { v1: " https://ejemplo.com/uno.mp4 ", v2: "javascript:alert(1)" },
    },
    filamentos: [
      { id: "f1", precoKg: 20000, cor: "Rojo", hex: "#ff0000" },
      { id: "f2", precoKg: 35000, cor: "Azul", hex: "#0000ff" },
      { id: "f3", precoKg: 30000, cor: "" },
    ],
    impressoras: [{ id: "i1", preco: 300000, vida: 5000, watts: 150, bico: 2000, bicoVida: 500, mesa: 10000, mesaVida: 2000 }],
    insumos: [{ id: "s1", pack: 5000, unid: 10 }],
    produtos: [
      { nome: "Llavero", cat: "Varios", desc: "d", fil: "f1", imp: "i1", peso: 12.34, h: 1, m: 20, mo: 5, stock: 3,
        fotos: ["https://lh3.googleusercontent.com/d/ABC_123", "https://ejemplo.com/foto.jpg", "", "https://lh3.googleusercontent.com/d/XYZ=s400"],
        ref: "https://ref.example/x", mercado: 9999, tags: "a,b", video: "v", detalle: "det", libre: true, medida: "5cm", destacada: true },
      { nome: "Maceta", cat: "Hogar", fil: "borrado", imp: "i1", peso: 80, h: 4, m: 45, stock: "2", foto: "https://lh3.googleusercontent.com/d/MACETA9" },
      { nome: "Oculta", oculta: true, fil: "f1", imp: "i1", peso: 10, h: 1, m: 0 },
      { nome: "Manual", fil: "f2", imp: "i1", peso: 20, h: 1, m: 0, manual: 12345, insumos: { s1: 2 } },
      { nome: "Sin foto", fil: "f2", imp: "i1", peso: 5, h: 0, m: 30 },
    ],
    vendas: [
      { cliente: "Juan Perez", total: 55555, forma: "efectivo", itens: [{ nome: "Llavero", qtd: 2, custo: 10, lucro: 20, consumo: [{ id: "f1", g: 3 }], stockUsado: 1 }, { nome: "Maceta", qtd: "1" }] },
      { cliente: "Ana", total: 1, forma: "mp", itens: [{ nome: "Llavero", qtd: 1, custo: 1, lucro: 1 }, { nome: "Inexistente", qtd: 4 }] },
    ],
    packs: [
      { nome: "Pack -10%", off: 10, desde: 3, piezas: "Llavero", desc: "dd", incluye: "inc" },
      { nome: "Pack off chico", off: 5, desde: 0 },
      { nome: "Combo fijo", qtd: 3, preco: 4999.6, sueltas: 5400.4, incluye: "x", desc: "y" },
      { nome: "Sin precio", preco: 0 },
      { nome: "", off: 5 },
    ],
    opiniones: [
      { quien: "Marta", pieza: "Llavero", texto: "Muy lindo" },
      { quien: "Oculta", texto: "no se ve", visible: false },
      { quien: "Vacía", texto: "" },
    ],
  };
}

test("fotoChica agrega el tamaño sólo a URLs de Drive sin medida", () => {
  assert.equal(fotoChica("https://lh3.googleusercontent.com/d/ABC_1-2"), "https://lh3.googleusercontent.com/d/ABC_1-2=w800");
  assert.equal(fotoChica("https://lh3.googleusercontent.com/d/ABC=s400"), "https://lh3.googleusercontent.com/d/ABC=s400");
  assert.equal(fotoChica("https://otro.example/a.jpg"), "https://otro.example/a.jpg");
  assert.equal(fotoChica(""), "");
  assert.equal(fotoChica(null), null);
  assert.equal(fotoChica(5), 5);
});

test("paridad: catalogoPublico coincide con catalogoPublico_ de Codigo.gs", () => {
  const estado = estadoInventado();
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL("../../server/Codigo.gs", import.meta.url), "utf8"), ctx);
  ctx.leerEstado_ = () => JSON.parse(JSON.stringify(estado));
  const servidor = JSON.parse(JSON.stringify(ctx.catalogoPublico_()));
  const worker_ = JSON.parse(JSON.stringify(catalogoPublico(estado)));
  assert.deepEqual(worker_, servidor);
  assert.equal(worker_.piezas.length, 4); // la oculta no sale
  assert.equal(worker_.piezas[0].vendidas, 3);
});

test("paridad con estado vacío o sin productos", () => {
  assert.deepEqual(catalogoPublico(null), { marca: "", wa: "", piezas: [] });
  assert.deepEqual(catalogoPublico({}), { marca: "", wa: "", piezas: [] });
});

test("privacidad: el catálogo no expone costo, ganancia, clientes ni credenciales", () => {
  const txt = JSON.stringify(catalogoPublico(estadoInventado()));
  for (const k of ["custo", "lucro", "consumo", "cliente", "stockUsado", "token", "key", "manual", "mercado", "ref"]) {
    assert.ok(!txt.includes(`"${k}"`), `no debe tener la clave ${k}`);
  }
  assert.ok(!txt.includes("tok-secreto") && !txt.includes("clave-secreta") && !txt.includes("Juan Perez"));
});

// Cache falso con la forma de caches.default (match/put por URL).
function cacheFalso({ falla = false } = {}) {
  const m = new Map();
  return {
    m,
    async match(req) {
      if (falla) throw new Error("cache roto");
      const r = m.get(req.url);
      return r ? r.clone() : undefined;
    },
    async put(req, res) {
      if (falla) throw new Error("cache roto");
      m.set(req.url, res);
    },
  };
}

// Cuenta cuántas veces se lee la fila completa del estado (SELECT json, v).
function espiarLecturas(db) {
  const espia = { lecturas: 0, prepare(sql) { if (/SELECT json/.test(sql)) espia.lecturas++; return db.prepare(sql); } };
  return espia;
}

test("cache: misma versión lee el estado una vez; una grabación recalcula", async () => {
  const db = crearD1();
  const estado = estadoInventado();
  await guardarEstado(db, estado, 0);
  const espia = espiarLecturas(db);
  const cache = cacheFalso();

  const a = await catalogoCacheado(espia, cache);
  const b = await catalogoCacheado(espia, cache);
  assert.equal(espia.lecturas, 1);
  assert.deepEqual(b, a);
  assert.ok([...cache.m.keys()].every((k) => k === "https://cache.playmind3d.invalid/catalogo?v=1"));

  const nuevo = estadoInventado();
  nuevo.produtos[0].manual = 77777;
  await guardarEstado(db, nuevo, 1);
  const c = await catalogoCacheado(espia, cache);
  assert.equal(espia.lecturas, 2);
  assert.equal(c.piezas[0].precio, 77777);
  assert.ok(cache.m.has("https://cache.playmind3d.invalid/catalogo?v=2"));
});

test("cache: guarda con el ttl pedido (900 por defecto)", async () => {
  const db = crearD1();
  await guardarEstado(db, estadoInventado(), 0);
  const cache = cacheFalso();
  await catalogoCacheado(db, cache);
  assert.equal([...cache.m.values()][0].headers.get("Cache-Control"), "max-age=900");
  const cache2 = cacheFalso();
  await catalogoCacheado(db, cache2, { ttl: 60 });
  assert.equal([...cache2.m.values()][0].headers.get("Cache-Control"), "max-age=60");
});

test("cache: un catálogo vacío no se guarda", async () => {
  const db = crearD1();
  const cache = cacheFalso();
  assert.deepEqual(await catalogoCacheado(db, cache), { marca: "", wa: "", piezas: [] });
  assert.equal(cache.m.size, 0);
});

test("cache que lanza no tumba la respuesta", async () => {
  const db = crearD1();
  await guardarEstado(db, estadoInventado(), 0);
  const cat = await catalogoCacheado(db, cacheFalso({ falla: true }));
  assert.equal(cat.piezas.length, 4);
});

test("manejarCatalogo: responde ok con CORS abierto y sin Vary", async () => {
  const db = crearD1();
  await guardarEstado(db, estadoInventado(), 0);
  const r = await manejarCatalogo({ DB: db }, cacheFalso());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).catalogo.piezas.length, 4);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(r.headers.get("vary"), null);
});

test("manejarCatalogo: un fallo interno responde catalogo no disponible con HTTP 200", async () => {
  const db = { prepare() { throw new Error("D1 caído"); } };
  const r = await manejarCatalogo({ DB: db }, cacheFalso());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: false, error: "catalogo no disponible" });
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});

for (const [ruta, origen] of [["/catalogo", "https://malo.example"], ["/?action=catalogo", null], ["/catalogo", "https://playmind3d.com"]]) {
  test(`index: GET ${ruta} (origen ${origen}) responde el catálogo sin token y con *`, async () => {
    const db = crearD1();
    await guardarEstado(db, estadoInventado(), 0);
    const headers = origen ? { Origin: origen } : {};
    const r = await worker.fetch(new Request("https://api.test" + ruta, { headers }), { DB: db });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.catalogo.piezas.length, 4);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    assert.equal(r.headers.get("vary"), null);
  });
}

test("index: GET / sin action sigue siendo 404", async () => {
  const r = await worker.fetch(new Request("https://api.test/"), {});
  assert.equal(r.status, 404);
});

test("destacada y videos del hero salen al catálogo; sólo enlaces https", () => {
  const c = catalogoPublico(estadoInventado());
  assert.equal(c.piezas[0].destacada, true);
  assert.equal(c.piezas[1].destacada, false);
  assert.deepEqual(c.hero, { v1: "https://ejemplo.com/uno.mp4", v2: "" });
  const sinHero = catalogoPublico({ ...estadoInventado(), cfg: { marca: "M" } });
  assert.deepEqual(sinHero.hero, { v1: "", v2: "" });
});
