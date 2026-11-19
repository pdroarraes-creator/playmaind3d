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
