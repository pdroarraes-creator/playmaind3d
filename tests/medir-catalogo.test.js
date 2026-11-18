// Pruebas del script de medición del catálogo. Correr con: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { resumir } = require("../scripts/medir-catalogo.js");

test("resumir devuelve min, mediana y max", () => {
  assert.deepEqual(resumir([300, 100, 200]), { min: 100, mediana: 200, max: 300 });
  assert.equal(resumir([100, 200]).mediana, 150);
});
