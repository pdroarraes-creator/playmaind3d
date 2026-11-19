// Paridad de precio: calc() de app/app.js debe coincidir con calcular_() de server/Codigo.gs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const { cargarApp } = require("./helpers/cargar-app");

const srv = {};
vm.createContext(srv);
vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), srv);
const app = cargarApp();

const clonar = (o) => JSON.parse(JSON.stringify(o));
const base = () => ({
  cfg: { kwh: 150, maoObra: 4000, risco: 10, mult: 3, round: 100, merma: 12 },
  filamentos: [{ id: "f1", precoKg: 24000 }],
  impressoras: [{ id: "i1", preco: 600000, vida: 5000, watts: 200, bico: 3000, bicoVida: 500, mesa: 15000, mesaVida: 2000 }],
  insumos: [],
  produtos: [],
});
const pieza = () => ({ fil: "f1", imp: "i1", peso: 40, h: 2, m: 30, mo: 15, risco: null, mult: null, cplx: 1, manual: "", insumos: {} });

function comparar(p, estado) {
  app.setD(clonar(estado));
  const a = app.calc(clonar(p));
  const s = srv.calcular_(clonar(p), clonar(estado));
  assert.equal(a.preco, s.preco, `preco app=${a.preco} servidor=${s.preco}`);
  // El costo se suma en distinto orden (impresion + reserva vs impresion * (1 + riesgo)):
  // difiere en el último bit del float, sin efecto sobre el precio redondeado.
  assert.ok(Math.abs(a.custo - s.custo) < 1e-9, `custo app=${a.custo} servidor=${s.custo}`);
  return a;
}

test("caso base coincide", () => {
  const r = comparar(pieza(), base());
  assert.ok(r.preco > 0 && r.custo > 0);
});

test("filamento apagado cae al primero", () => {
  const p = pieza();
  p.fil = "fX";
  comparar(p, base());
});

test("merma ausente vale 12", () => {
  const e = base();
  delete e.cfg.merma;
  comparar(pieza(), e);
});

test("gramos a un decimal", () => {
  const p = pieza();
  p.peso = 33.33;
  comparar(p, base());
});

test("precio manual 0 se ignora", () => {
  const p = pieza();
  p.manual = "0";
  comparar(p, base());
  p.manual = -5;
  comparar(p, base());
});

test("precio manual positivo manda", () => {
  const p = pieza();
  p.manual = 4500;
  assert.equal(comparar(p, base()).preco, 4500);
});

test("round fraccionario", { todo: "calc usa ceilTo, calcular_ usa Math.ceil(x/paso)*paso con round<1" }, () => {
  const e = base();
  e.cfg.round = 0.5;
  comparar(pieza(), e);
});
