// Las reglas de categorías del servidor (Codigo.gs) tienen que dar lo mismo que las del app.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const C = require("../app/categorias.js");

function cargar() {
  const ctx = { Utilities: { getUuid: () => "uuid-1" } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  return ctx;
}
const js = (x) => JSON.parse(JSON.stringify(x));

const CASOS = [
  () => ({ cfg: {}, produtos: [{ cat: "Sensoriales" }, { cat: "" }, { cat: "sensoriales" }, { cat: "Llaveros" }] }),
  () => ({ cfg: {}, categorias: ["Navidad"], produtos: [{ cats: ["Halloween"], cat: "Halloween" }] }),
  () => ({ cfg: {}, categorias: ["Navidad", "Sensoriales", "Halloween"], produtos: [{ cats: ["Navidad", "Sensoriales"], cat: "Halloween" }] }),
  () => ({ cfg: { temaSitio: "navidad" }, produtos: [] }),
  () => ({ cfg: {}, categorias: ["Navidad"], produtos: [{ cats: ["🎄", "Navidad"], cat: "🎄" }] }),
];

test("paridad de migración", () => {
  const g = cargar();
  CASOS.forEach((caso) => {
    const a = caso(), b = caso();
    C.migrarCategorias(a);
    g.migrarCategorias_(b);
    assert.deepEqual(js(b), js(a));
  });
});

test("paridad de texto", () => {
  const g = cargar();
  const lista = ["Navidad", "Biología"];
  for (const crear of [false, true]) {
    assert.deepEqual(js(g.catsDesdeTexto_("navidad, Natal ,biologia, ★", lista, crear)), C.catsDesdeTexto("navidad, Natal ,biologia, ★", lista, { crear }));
  }
});

function conEstado(g, data) {
  const guardado = {};
  g.leerEstadoYV_ = () => ({ data, v: "1" });
  g.leerEstado_ = () => data;
  g.guardarEstado_ = (d) => { guardado.data = d; return { ok: true }; };
  return guardado;
}

test("agregar desde chat no crea", () => {
  const g = cargar();
  const data = { cfg: {}, categorias: ["Navidad"], produtos: [], filamentos: [], impressoras: [] };
  const out = conEstado(g, data);
  g.agregarPieza_({ nome: "X", manual: 100, cat: "Natal, navidad", catSoloExistentes: true });
  assert.deepEqual(js(out.data.produtos[0].cats), ["Navidad"]);
  assert.deepEqual(js(out.data.categorias), ["Navidad"]);
  g.agregarPieza_({ nome: "Y", manual: 100, cat: "Natal, navidad" });
  assert.deepEqual(js(out.data.produtos[1].cats), ["Natal", "Navidad"]);
  assert.equal(out.data.categorias[out.data.categorias.length - 1], "Natal");
});

test("catálogo manda tema y categorías", () => {
  const g = cargar();
  const data = {
    cfg: { temaSitio: "navidad" },
    categorias: ["Halloween", "Navidad"],
    produtos: [{ id: "a", nome: "Arbolito", cats: ["Navidad"], cat: "Navidad", manual: 5000, peso: 10, h: 1, m: 0 }],
    filamentos: [{ id: "f", precoKg: 20000 }], impressoras: [{ id: "i" }], vendas: [],
  };
  conEstado(g, data);
  const c = g.catalogoPublico_();
  assert.equal(c.tema, "navidad");
  assert.deepEqual(js(c.categorias), ["Navidad"]);
  assert.deepEqual(js(c.piezas[0].cats), ["Navidad"]);
});
