// Pruebas del modelo de presupuesto. Correr con: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/presupuesto.js");

function totales() {
  return {
    it: [
      { p: { id: "a", nome: "Llavero", fotos: ["a", "b"] }, q: 2, r: { preco: 3000, custo: 900, horas: 1 }, fil: "f1" },
      { p: { id: "b", nome: "Estrella", foto: "x" }, q: 1, r: { preco: 5000, custo: 1500, horas: 2 }, fil: null },
    ],
    bruto: 11000, custo: 3300, horas: 4, piezas: 3, desc: 0.1, envio: 1500, total: 11400, com: 0.05, lucro: 999,
  };
}
const opts = (o = {}) => Object.assign({
  n: 42, cliente: "Ana", fecha: new Date(2026, 10, 17), dias: 7,
  marca: "PlayMind 3d", wa: "+54 9 11", ig: "@playmind3d", colorDe: (f) => (f ? "Azul" : "el que elijas"),
}, o);

test("migra sin pisar", () => {
  const D = { cfg: {} };
  P.migrarPresupuestos(D);
  assert.deepEqual(D.presupuestos, []);
  assert.equal(D.cfg.presupNum, 0);
  assert.equal(D.cfg.presupDias, 7);
  const E = { cfg: { presupNum: 5, presupDias: 10 }, presupuestos: [{ n: 5 }] };
  P.migrarPresupuestos(E);
  assert.deepEqual(E, { cfg: { presupNum: 5, presupDias: 10 }, presupuestos: [{ n: 5 }] });
});

test("numera", () => {
  const cfg = { presupNum: 41 };
  assert.equal(P.siguienteNumero(cfg), 42);
  assert.equal(cfg.presupNum, 42);
  assert.equal(P.numeroTxt(42), "042");
  assert.equal(P.numeroTxt(7), "007");
  assert.equal(P.numeroTxt(1234), "1234");
});

test("arma sin datos internos", () => {
  const pr = P.armarPresupuesto(totales(), opts());
  assert.equal(pr.bruto, 11000);
  assert.equal(pr.descMonto, 1100);
  assert.equal(pr.total, 11400);
  assert.equal(pr.items[0].sub, 6000);
  assert.equal(pr.items[0].color, "Azul");
  assert.equal(pr.items[1].color, "el que elijas");
  assert.equal(pr.fecha, "17/11/2026");
  assert.equal(pr.valido, "24/11/2026");
  assert.equal(pr.numero, "042");
  const s = JSON.stringify(pr);
  for (const k of ["custo", "lucro", "horas", '"com"']) assert.ok(!s.includes(k), k);
});

test("foto", () => {
  const pr = P.armarPresupuesto(totales(), opts());
  assert.equal(pr.items[0].foto, "a");
  assert.equal(pr.items[1].foto, "x");
  const t = totales();
  t.it[0].p = { id: "c", nome: "Sin foto" };
  assert.equal(P.armarPresupuesto(t, opts()).items[0].foto, "");
});

test("archivo", () => {
  assert.equal(P.nombreArchivo(P.armarPresupuesto(totales(), opts({ cliente: "María José 🎉" }))), "Presupuesto-042-Maria-Jose.pdf");
  assert.equal(P.nombreArchivo(P.armarPresupuesto(totales(), opts({ cliente: "" }))), "Presupuesto-042.pdf");
});

test("historial", () => {
  let l = [];
  for (let i = 1; i <= 35; i++) l = P.registrar(l, P.armarPresupuesto(totales(), opts({ n: i })));
  assert.equal(l.length, 30);
  assert.equal(l[0].n, 6);
  assert.deepEqual(Object.keys(l[0]).sort(), ["c", "f", "n", "t"]);
  assert.equal(l[0].f, "2026-11-17");
});

test("texto", () => {
  const t = P.textoCompartir(P.armarPresupuesto(totales(), opts()));
  assert.ok(t.includes("Presupuesto N° 042"), t);
  assert.ok(t.includes("$11.400"), t);
  assert.ok(t.startsWith("¡Hola Ana!"), t);
  assert.ok(P.textoCompartir(P.armarPresupuesto(totales(), opts({ cliente: "" }))).startsWith("¡Hola!"));
});

test("reservar número no lo gasta hasta confirmar", () => {
  const cfg = { presupNum: 41 };
  assert.equal(P.reservarNumero(cfg), 42);
  assert.equal(cfg.presupNum, 41);
  P.confirmarNumero(cfg, 42);
  assert.equal(cfg.presupNum, 42);
  P.confirmarNumero(cfg, 40);
  assert.equal(cfg.presupNum, 42);
});

test("cómo entregar el PDF", () => {
  assert.equal(P.comoEntregar({ puedeCompartir: true, ms: 1200 }), "compartir");
  assert.equal(P.comoEntregar({ puedeCompartir: true, ms: 4500 }), "boton");
  assert.equal(P.comoEntregar({ puedeCompartir: false, ms: 500 }), "descargar");
});

test("si compartir falla o se cancela, queda el botón", () => {
  assert.equal(P.despuesDeCompartir(null), "listo");
  assert.equal(P.despuesDeCompartir({ name: "AbortError" }), "boton");
  assert.equal(P.despuesDeCompartir({ name: "NotAllowedError" }), "boton");
  assert.equal(P.despuesDeCompartir({ name: "TypeError" }), "descargar");
});
