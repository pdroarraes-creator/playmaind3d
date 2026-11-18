// Pruebas del script de medición del catálogo. Correr con: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { resumir } = require("../scripts/medir-catalogo.js");

test("resumir devuelve min, mediana y max", () => {
  assert.deepEqual(resumir([300, 100, 200]), { min: 100, mediana: 200, max: 300 });
  assert.equal(resumir([100, 200]).mediana, 150);
});

const { fotosDe, contarPiezas } = require("../scripts/medir-catalogo.js");

const real = () => ({
  ok: true,
  catalogo: {
    marca: "PlayMind 3d",
    wa: "https://wa.me/5491100000000",
    colores: ["Azul"],
    packs: [{ nome: "Pack", link: "https://ejemplo.com/pack.jpg" }],
    piezas: [
      { nome: "A", precio: 3000, fotos: ["https://lh3.googleusercontent.com/d/1", "https://lh3.googleusercontent.com/d/2"] },
      { nome: "B", precio: 4000, fotos: ["https://lh3.googleusercontent.com/d/2", "", null, 5] },
    ],
    opiniones: [{ texto: "ok", foto: "https://ejemplo.com/opinion.jpg" }],
    leti: { cita: "", historia: "", foto: "https://lh3.googleusercontent.com/d/9" },
  },
});

test("fotosDe toma solo piezas[].fotos y leti.foto, sin duplicados ni wa/opiniones", () => {
  assert.deepEqual(fotosDe(real()), [
    "https://lh3.googleusercontent.com/d/1",
    "https://lh3.googleusercontent.com/d/2",
    "https://lh3.googleusercontent.com/d/9",
  ]);
});

test("fotosDe ignora leti.foto vacío y catálogos sin piezas", () => {
  const d = real();
  d.catalogo.leti.foto = "";
  assert.equal(fotosDe(d).length, 2);
  assert.deepEqual(fotosDe({ catalogo: {} }), []);
  assert.deepEqual(fotosDe({}), []);
});

test("contarPiezas cuenta data.catalogo.piezas, 0 si falta", () => {
  assert.equal(contarPiezas(real()), 2);
  assert.equal(contarPiezas({ catalogo: {} }), 0);
  assert.equal(contarPiezas(null), 0);
});
