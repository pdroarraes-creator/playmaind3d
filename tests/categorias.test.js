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

test("arma catálogo de una categoría", () => {
  const ps = [
    { nome: "Reno", cats: ["Navidad"], manual: 5000 },
    { nome: "Arbolito", cats: ["Navidad"], oculta: true, manual: 4000 },
    { nome: "Calabaza", cats: ["Halloween"], manual: 3000 },
    { nome: "Estrella", cats: ["Navidad", "Sensoriales"], manual: 2000, libre: true, fotos: ["f1"] },
  ];
  const cat = C.armarCatalogo(ps, "navidad", { precioDe: (p) => p.manual, fecha: new Date(2026, 10, 18), marca: "PlayMind 3d", wa: "+54", ig: "@playmind3d", lista: ["Navidad", "Halloween"] });
  assert.equal(cat.nombre, "Navidad");
  assert.equal(cat.titulo, "Catálogo · Navidad");
  assert.equal(cat.fecha, "18/11/2026");
  assert.equal(cat.link, "https://playmind3d.com/?cat=navidad");
  assert.deepEqual(cat.items.map((i) => i.nome), ["Estrella", "Reno"]);
  assert.deepEqual(cat.items[0], { nome: "Estrella", precio: 2000, foto: "f1", color: "Elegís el color" });
  assert.equal(cat.items[1].color, "");
  for (const k of ["custo", "lucro", "horas"]) assert.ok(!JSON.stringify(cat).includes(k), k);
});

test("nombre del archivo del catálogo", () => {
  assert.equal(C.nombreArchivoCatalogo("Biología"), "Catalogo-Biologia.pdf");
  assert.equal(C.nombreArchivoCatalogo("Navidad 2026"), "Catalogo-Navidad-2026.pdf");
});

test("chat con categoría desconocida no borra las que había", () => {
  const p = { cats: ["Navidad", "Sensoriales"], cat: "Navidad" };
  const r = C.catsDelChat(p, "Natal", ["Navidad", "Sensoriales"]);
  assert.equal(r.cambio, false);
  assert.deepEqual(r.nuevas, ["Natal"]);
  assert.deepEqual(p.cats, ["Navidad", "Sensoriales"]);
  assert.equal(C.catsDelChat(p, "", ["Navidad"]).cambio, false);
  assert.deepEqual(p.cats, ["Navidad", "Sensoriales"]);
  const r2 = C.catsDelChat(p, "sensoriales, Natal", ["Navidad", "Sensoriales"]);
  assert.equal(r2.cambio, true);
  assert.deepEqual(p.cats, ["Sensoriales"]);
});

test("depura categorías que ya no existen", () => {
  assert.deepEqual(C.depurarCats(["Navidad", "Halloween", "biologia"], ["Navidad", "Biología"]), ["Navidad", "Biología"]);
});

test("nombre sin letras ni números no entra ni se duplica", () => {
  const D = { cfg: {}, categorias: ["Navidad"], produtos: [{ cats: ["🎄"], cat: "🎄" }] };
  assert.equal(C.agregarCategoria(D, "🎄"), null);
  C.migrarCategorias(D);
  C.migrarCategorias(D);
  assert.deepEqual(D.categorias, ["Navidad"]);
  assert.deepEqual(D.produtos[0].cats, []);
  assert.deepEqual(C.catsDesdeTexto("★, navidad", ["Navidad"], { crear: true }).cats, ["Navidad"]);
});
