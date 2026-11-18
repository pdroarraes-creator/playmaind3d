// Prueba el cache del catálogo público y su invalidación al gravar (server/Codigo.gs).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");

// Estado mínimo que funciona con el calcular_ real.
function estado(nombre) {
  return {
    cfg: { merma: 12, kwh: 0, maoObra: 0, risco: 0, mult: 2, round: 1 },
    filamentos: [{ id: "f1", cor: "Rojo", hex: "#f00", precoKg: 10000 }],
    impressoras: [{ id: "i1", preco: 0, vida: 1, watts: 0, bico: 0, bicoVida: 1, mesa: 0, mesaVida: 1 }],
    produtos: [{ nome: nombre || "Pieza", fil: "f1", imp: "i1", peso: 20, h: 1, m: 0 }],
  };
}

// Contexto con CacheService falso (Map + contadores), hoja falsa y leerEstado_ que cuenta.
function cargar(opts) {
  opts = opts || {};
  const mapa = new Map();
  const cuenta = { get: 0, put: 0, remove: 0, leer: 0, escrito: 0 };
  const cache = {
    get: (k) => { cuenta.get++; return mapa.has(k) ? mapa.get(k) : null; },
    put: (k, v) => { cuenta.put++; if (opts.putFalla) throw new Error("put"); mapa.set(k, v); },
    remove: (k) => { cuenta.remove++; mapa.delete(k); },
  };
  const ctx = {
    CacheService: {
      getScriptCache: () => { if (opts.cacheFalla) throw new Error("cache"); return cache; },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => ({
          getLastRow: () => 2,
          getRange: () => ({
            getValues: () => [[ctx.CLAVE, "{}", new Date()]],
            setValues: () => { cuenta.escrito++; },
          }),
        }),
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  ctx.moverFotosADrive_ = (d) => d;
  ctx.volcarVentas_ = () => {};
  ctx.volcarPiezas_ = () => {};
  ctx.volcarStock_ = () => {};
  const data = opts.data === undefined ? estado() : opts.data;
  ctx.leerEstado_ = () => { cuenta.leer++; return data; };
  return { ctx, cuenta, mapa };
}

const plano = (x) => JSON.parse(JSON.stringify(x));

test("la segunda llamada sale del cache", () => {
  const { ctx, cuenta } = cargar();
  const a = plano(ctx.catalogoCacheado_());
  const b = plano(ctx.catalogoCacheado_());
  assert.equal(cuenta.leer, 1);
  assert.equal(a.piezas.length, 1);
  assert.deepEqual(a, b);
});

test("guardarEstado_ invalida el catálogo", () => {
  const { ctx, cuenta } = cargar();
  ctx.catalogoCacheado_();
  ctx.guardarEstado_(estado(), "");
  assert.equal(cuenta.escrito, 1);
  ctx.catalogoCacheado_();
  assert.equal(cuenta.leer, 2);
});

test("editarPieza_ invalida el catálogo", () => {
  const { ctx, cuenta } = cargar();
  ctx.catalogoCacheado_();
  const r = ctx.editarPieza_("Pieza", { desc: "nueva" });
  assert.equal(r.ok, true);
  assert.equal(cuenta.escrito, 1);
  ctx.catalogoCacheado_();
  assert.equal(cuenta.leer, 3); // 1 al calentar + 1 dentro de editarPieza_ + 1 recalculado
});

test("no cachea un catálogo vacío", () => {
  const { ctx, cuenta } = cargar({ data: null });
  ctx.catalogoCacheado_();
  ctx.catalogoCacheado_();
  assert.equal(cuenta.leer, 2);
  assert.equal(cuenta.put, 0);
});

test("si el cache falla, sirve igual", () => {
  const a = cargar({ cacheFalla: true });
  assert.equal(plano(a.ctx.catalogoCacheado_()).piezas.length, 1);
  const b = cargar({ putFalla: true });
  assert.equal(plano(b.ctx.catalogoCacheado_()).piezas.length, 1);
});

test("invalidarCatalogo_ ignora errores", () => {
  const { ctx } = cargar({ cacheFalla: true });
  ctx.invalidarCatalogo_();
});

test("no cachea lo demasiado grande", () => {
  const d = estado();
  d.produtos[0].desc = "x".repeat(91000);
  const { ctx, cuenta } = cargar({ data: d });
  const r = plano(ctx.catalogoCacheado_());
  assert.equal(r.piezas.length, 1);
  assert.equal(cuenta.put, 0);
});

test("doGet sirve el catálogo cacheado", () => {
  const { ctx, cuenta } = cargar();
  ctx.json_ = (o) => o;
  const r1 = plano(ctx.doGet({ parameter: { action: "catalogo" } }));
  ctx.doGet({ parameter: { action: "catalogo" } });
  assert.equal(r1.ok, true);
  assert.equal(r1.catalogo.piezas.length, 1);
  assert.equal(cuenta.leer, 1);
});
