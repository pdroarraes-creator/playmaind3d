// Prueba consumoDe y aplicarConsumo (app/js/stock.js). alertasStock no se prueba:
// depende de filName, que vive en catalogo.js (arrastra main.js, que toca document y no carga en Node).
const test = require("node:test");
const assert = require("node:assert/strict");
const { register } = require("node:module");

globalThis.Calculo = require("../app/calculo.js");
// stock.js importa filName de ./catalogo.js, que arrastra main.js y no carga en Node: se lo cambia por un stub.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(s, c, n) {
  if (s.endsWith("/catalogo.js") && c.parentURL && c.parentURL.endsWith("/js/stock.js"))
    return { url: "data:text/javascript,export const filName = (id) => id;", shortCircuit: true };
  return n(s, c);
}`),
);

const estadoBase = () => ({
  cfg: { kwh: 120, maoObra: 2000, risco: 10, mult: 2.5, round: 100, merma: 12 },
  filamentos: [
    { id: "f1", nome: "PLA negro", precoKg: 24000, rollo: 1000, stock: 800 },
    { id: "f2", nome: "PETG azul", precoKg: 26000, rollo: 1000, stock: 500 },
  ],
  impressoras: [{ id: "i1", nome: "Ender", watts: 200, custoHora: 150 }],
  insumos: [{ id: "n1", nome: "Imán", pack: 500, unid: 100, stock: 40 }],
  produtos: [
    { id: "p1", nome: "Maceta", fil: "f1", imp: "i1", peso: 30, h: 2, insumos: { n1: 2 } },
    { id: "p2", nome: "Llavero", fil: "f1", imp: "i1", peso: 10, h: 1, insumos: {} },
  ],
});

test("consumoDe suma gramos por filamento (con override) y unidades por insumo", async () => {
  const estado = await import("../app/js/estado.js");
  const { gramosCon } = await import("../app/js/calculo.js");
  const { consumoDe } = await import("../app/js/stock.js");
  estado.reemplazarEstado(estadoBase());
  const [p1, p2] = estado.D.produtos;
  const c = consumoDe([
    { p: p1, q: 2 },
    { p: p2, q: 3, fil: "f2" },
  ]);
  assert.equal(c.fil.f1, gramosCon(p1) * 2);
  assert.equal(c.fil.f2, gramosCon(p2) * 3);
  assert.deepEqual(c.ins, { n1: 4 });
});

test("aplicarConsumo resta y suma stock; null no hace nada", async () => {
  const estado = await import("../app/js/estado.js");
  const { aplicarConsumo } = await import("../app/js/stock.js");
  estado.reemplazarEstado(estadoBase());
  const c = { fil: { f1: 33.36, f2: 100 }, ins: { n1: 4, zz: 9 } };
  aplicarConsumo(c, -1);
  assert.equal(estado.D.filamentos[0].stock, 766.6);
  assert.equal(estado.D.filamentos[1].stock, 400);
  assert.equal(estado.D.insumos[0].stock, 36);
  aplicarConsumo(c, +1);
  assert.equal(estado.D.filamentos[0].stock, 800);
  assert.equal(estado.D.insumos[0].stock, 40);
  aplicarConsumo(null, 1);
  assert.equal(estado.D.filamentos[0].stock, 800);
});
