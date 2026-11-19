// Prueba los delegadores de app/js/calculo.js (calc, gramosCon, unitario, prod)
// y la migración migrarInsumos/proximoNumFil, con el Calculo global de siempre.
const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.Calculo = require("../app/calculo.js");

const estadoBase = () => ({
  cfg: { kwh: 120, maoObra: 2000, risco: 10, mult: 2.5, round: 100, merma: 12 },
  filamentos: [{ id: "f1", nome: "PLA negro", precoKg: 24000, rollo: 1000, stock: 800, num: 3 }],
  impressoras: [{ id: "i1", nome: "Ender", watts: 200, custoHora: 150 }],
  insumos: [],
  produtos: [
    { id: "p1", nome: "Maceta", fil: "f1", imp: "i1", peso: 33.33, h: 2.5, insumos: {} },
    { id: "p2", nome: "Llavero", fil: "f1", imp: "i1", peso: 8, h: 0.5, insumos: {} },
  ],
});

test("calc, gramosCon y unitario delegan en Calculo", async () => {
  const estado = await import("../app/js/estado.js");
  const m = await import("../app/js/calculo.js");
  estado.reemplazarEstado(estadoBase());
  const p = estado.D.produtos[0];
  assert.deepEqual(m.calc(p), Calculo.calcular(p, estado.D));
  assert.ok(m.calc(p).preco > 0);
  assert.equal(m.gramosCon(p), Calculo.gramosCon(p, estado.D.cfg));
  assert.ok(m.gramosCon(p) > p.peso);
  const it = { id: "x", nome: "Imán", pack: 500, unid: 100 };
  assert.equal(m.unitario(it), Calculo.unitario(it));
  assert.equal(m.unitario(it), 5);
});

test("prod busca por id y devuelve undefined si no existe", async () => {
  const estado = await import("../app/js/estado.js");
  const m = await import("../app/js/calculo.js");
  estado.reemplazarEstado(estadoBase());
  assert.equal(m.prod("p2").nome, "Llavero");
  assert.equal(m.prod("nada"), undefined);
});

test("migrarInsumos convierte preco en pack, completa rollo/stock y numera filamentos", async () => {
  const estado = await import("../app/js/estado.js");
  const m = await import("../app/js/calculo.js");
  const e = estadoBase();
  e.insumos = [{ id: "i1", nome: "Imán", preco: 5 }];
  e.filamentos = [
    { id: "a", nome: "PLA rojo", precoKg: 20000 },
    { id: "b", nome: "PETG azul", precoKg: 26000, rollo: 750, stock: 100, num: 7 },
    { id: "c", nome: "PLA verde", precoKg: 20000 },
  ];
  estado.reemplazarEstado(e);
  assert.equal(m.proximoNumFil(), 8);
  m.migrarInsumos();
  const D = estado.D;
  assert.equal(D.insumos[0].pack, 5);
  assert.equal(D.insumos[0].unid, 1);
  assert.equal(D.insumos[0].stock, 1);
  assert.equal("preco" in D.insumos[0], false);
  assert.equal(D.filamentos[0].rollo, 1000);
  assert.equal(D.filamentos[0].stock, 1000);
  assert.equal(D.filamentos[1].rollo, 750);
  assert.equal(D.filamentos[1].stock, 100);
  assert.deepEqual(D.filamentos.map((f) => f.num), [8, 7, 9]);
  assert.equal(m.proximoNumFil(), 10);
});
