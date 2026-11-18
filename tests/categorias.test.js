// Pruebas de las reglas de categorías. Correr con: node --test 'tests/*.test.js'
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/categorias.js");

test("slug", () => {
  assert.equal(C.slugCat(" Biología "), "biologia");
  assert.equal(C.slugCat("Decoración"), "decoracion");
});

test("migra desde cat", () => {
  const D = { cfg: {}, produtos: [{ cat: "Sensoriales" }, { cat: "" }, { cat: "sensoriales" }, { cat: "Llaveros" }] };
  C.migrarCategorias(D);
  assert.deepEqual(D.categorias, ["Sensoriales", "Llaveros", "Decoración", "Halloween", "Navidad", "Biología"]);
  assert.deepEqual(D.produtos[0].cats, ["Sensoriales"]);
  assert.deepEqual(D.produtos[1].cats, []);
  assert.deepEqual(D.produtos[2].cats, ["Sensoriales"]);
  assert.equal(D.produtos[2].cat, "Sensoriales");
  assert.equal(D.cfg.temaSitio, "");
  const copia = JSON.stringify(D);
  C.migrarCategorias(D);
  assert.equal(JSON.stringify(D), copia);
  const E = { cfg: { temaSitio: "navidad" }, produtos: [] };
  C.migrarCategorias(E);
  assert.equal(E.cfg.temaSitio, "navidad");
});

test("repara huérfanos", () => {
  const D = { cfg: {}, categorias: ["Navidad"], produtos: [{ cats: ["Halloween"], cat: "Halloween" }] };
  C.migrarCategorias(D);
  assert.equal(D.categorias[D.categorias.length - 1], "Halloween");
  assert.equal(D.categorias.filter((c) => c === "Halloween").length, 1);
});

test("app viejo", () => {
  const D = { cfg: {}, categorias: ["Navidad", "Sensoriales", "Halloween"], produtos: [{ cats: ["Navidad", "Sensoriales"], cat: "Halloween" }] };
  C.migrarCategorias(D);
  assert.deepEqual(D.produtos[0].cats, ["Halloween", "Sensoriales"]);
  assert.equal(D.produtos[0].cat, "Halloween");
});

test("texto", () => {
  const lista = ["Navidad", "Biología"];
  assert.deepEqual(C.catsDesdeTexto("navidad, Natal ,biologia", lista, { crear: false }), { cats: ["Navidad", "Biología"], nuevas: ["Natal"] });
  assert.deepEqual(C.catsDesdeTexto("navidad, Natal ,biologia", lista, { crear: true }).cats, ["Navidad", "Natal", "Biología"]);
  assert.deepEqual(C.catsDesdeTexto("", lista, { crear: true }), { cats: [], nuevas: [] });
});

test("renombra y funde", () => {
  const D = { cfg: {}, categorias: ["Navidad", "Natal"], produtos: [{ cats: ["Natal"] }, { cats: ["Natal", "Navidad"] }] };
  C.renombrarCategoria(D, "Natal", "navidad");
  assert.deepEqual(D.categorias, ["Navidad"]);
  assert.deepEqual(D.produtos[0].cats, ["Navidad"]);
  assert.deepEqual(D.produtos[1].cats, ["Navidad"]);
  assert.equal(D.produtos[0].cat, "Navidad");
  C.renombrarCategoria(D, "Navidad", "Navidad 2026");
  assert.deepEqual(D.categorias, ["Navidad 2026"]);
  assert.deepEqual(D.produtos[1].cats, ["Navidad 2026"]);
});

test("borra", () => {
  const D = { cfg: {}, categorias: ["Halloween", "Sensoriales"], produtos: [{ cats: ["Halloween"] }, { cats: ["Halloween", "Sensoriales"] }, { cats: [] }] };
  assert.equal(C.usoCategoria(D.produtos, "halloween"), 2);
  assert.equal(C.borrarCategoria(D, "Halloween"), 2);
  assert.deepEqual(D.categorias, ["Sensoriales"]);
  assert.deepEqual(D.produtos[0].cats, []);
  assert.equal(D.produtos[0].cat, "");
  assert.deepEqual(D.produtos[1].cats, ["Sensoriales"]);
  assert.equal(D.produtos[1].cat, "Sensoriales");
});

test("agrega sin duplicar", () => {
  const D = { cfg: {}, categorias: ["Navidad"], produtos: [] };
  assert.equal(C.agregarCategoria(D, " navidad "), "Navidad");
  assert.equal(C.agregarCategoria(D, "  "), null);
  assert.equal(C.agregarCategoria(D, "Biología"), "Biología");
  assert.deepEqual(D.categorias, ["Navidad", "Biología"]);
});

test("mueve", () => {
  const D = { cfg: {}, categorias: ["A", "B", "C"], produtos: [] };
  C.moverCategoria(D, "C", -1);
  assert.deepEqual(D.categorias, ["A", "C", "B"]);
  C.moverCategoria(D, "A", -1);
  assert.deepEqual(D.categorias, ["A", "C", "B"]);
  C.moverCategoria(D, "B", 1);
  assert.deepEqual(D.categorias, ["A", "C", "B"]);
});

test("filtra", () => {
  const ps = [{ nome: "a", cats: ["Navidad"] }, { nome: "b", cats: [] }, { nome: "c", cats: ["Sensoriales", "Navidad"] }];
  assert.equal(C.piezasDeCategoria(ps, "").length, 3);
  assert.deepEqual(C.piezasDeCategoria(ps, "navidad").map((p) => p.nome), ["a", "c"]);
});

test("ponerCats deduplica", () => {
  const p = {};
  C.ponerCats(p, ["Navidad", "navidad", "Sensoriales"]);
  assert.deepEqual(p.cats, ["Navidad", "Sensoriales"]);
  assert.equal(p.cat, "Navidad");
});

test("link", () => {
  assert.equal(C.linkCategoria("Biología"), "https://playmind3d.com/?cat=biologia");
});
