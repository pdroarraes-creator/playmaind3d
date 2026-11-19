// Prueba que app/calculo.js reproduce a calc() de app.js (casos dorados) y que
// calcular_() de server/Codigo.gs da lo mismo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const Calculo = require("../app/calculo.js");

const casos = JSON.parse(fs.readFileSync(__dirname + "/fixtures/calculo-dorados.json", "utf8"));

test("calculo.js reproduce los casos dorados del app", () => {
  for (const c of casos) {
    assert.deepEqual(Calculo.calcular(c.pieza, c.data), { ...c.esperado }, c.nombre);
  }
});

test("calcular_ del servidor coincide con calculo.js", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  for (const c of casos) {
    const s = ctx.calcular_(c.pieza, c.data);
    const a = Calculo.calcular(c.pieza, c.data);
    for (const k of ["custo", "preco", "horas", "gramos"]) assert.equal(s[k], a[k], c.nombre + " " + k);
  }
});

test("calcular no falla con data vacia", () => {
  const r = Calculo.calcular({ peso: 10, h: 1 }, {});
  for (const v of Object.values(r)) assert.ok(Number.isFinite(v));
});

// Ids duplicados: calcular_ (servidor) y Calculo.calcular (app) deben elegir el
// PRIMERO, si no el catálogo y la pantalla cobran distinto (restricción 9).
function servidor_() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  return ctx;
}
const CAMPOS = ["custo", "preco", "horas", "gramos"];
const cfgBase = { merma: 12, kwh: 120, maoObra: 3000, risco: 10, mult: 2.5, round: 50 };
const impBase = { id: "i1", preco: 300000, vida: 5000, watts: 150, bico: 2000, bicoVida: 500, mesa: 10000, mesaVida: 2000 };

function verificarDuplicado(nombre, duplicado, sinDuplicar, pieza) {
  const ctx = servidor_();
  const a = Calculo.calcular(pieza, duplicado);
  const s = ctx.calcular_(pieza, duplicado);
  const esperado = Calculo.calcular(pieza, sinDuplicar);
  for (const k of CAMPOS) {
    assert.equal(s[k], a[k], nombre + " servidor=app " + k);
    assert.equal(a[k], esperado[k], nombre + " app usa el primero " + k);
    assert.equal(s[k], esperado[k], nombre + " servidor usa el primero " + k);
  }
  assert.ok(a.custo > 0, nombre + " custo > 0");
}

test("id de filamento duplicado: gana el primero", () => {
  const pieza = { fil: "f1", imp: "i1", peso: 100, h: 2, m: 0, mo: 10 };
  const dup = { cfg: cfgBase, impressoras: [impBase], insumos: [],
    filamentos: [{ id: "f1", precoKg: 20000 }, { id: "f1", precoKg: 90000 }] };
  const solo = { ...dup, filamentos: [{ id: "f1", precoKg: 20000 }] };
  verificarDuplicado("filamento", dup, solo, pieza);
});

test("id de impresora duplicado: gana el primero", () => {
  const pieza = { fil: "f1", imp: "i1", peso: 100, h: 2, m: 0, mo: 10 };
  const dup = { cfg: cfgBase, filamentos: [{ id: "f1", precoKg: 20000 }], insumos: [],
    impressoras: [impBase, { ...impBase, preco: 3000000, watts: 900 }] };
  const solo = { ...dup, impressoras: [impBase] };
  verificarDuplicado("impresora", dup, solo, pieza);
});

test("id de insumo duplicado: gana el primero", () => {
  const pieza = { fil: "f1", imp: "i1", peso: 100, h: 2, m: 0, mo: 10, insumos: { s1: 2 } };
  const dup = { cfg: cfgBase, filamentos: [{ id: "f1", precoKg: 20000 }], impressoras: [impBase],
    insumos: [{ id: "s1", preco: 100 }, { id: "s1", preco: 5000 }] };
  const solo = { ...dup, insumos: [{ id: "s1", preco: 100 }] };
  verificarDuplicado("insumo", dup, solo, pieza);
});
