const test = require("node:test");
const assert = require("node:assert/strict");

test("reemplazarEstado cambia D visto por otros módulos", async () => {
  const E = await import("../app/js/estado.js");
  E.reemplazarEstado({ a: 1 });
  assert.deepEqual(E.D, { a: 1 });
});

test("defaults() trae v:2 y las listas vacías esperadas", async () => {
  const E = await import("../app/js/estado.js");
  const d = E.defaults();
  assert.equal(d.v, 2);
  for (const k of ["produtos", "vendas", "radar", "packs", "opiniones"]) assert.deepEqual(d[k], [], k);
});
