const assert = require("node:assert/strict");
const test = require("node:test");

const modulos = Promise.all([
  import("../catalog-v2/catalog-logic.mjs"),
  import("../catalog-v2/catalog-data.mjs"),
]);

test("clasifica las diez piezas y respeta la línea explícita", async () => {
  const [{ lineaDe }, { PIEZAS }] = await modulos;
  assert.equal(PIEZAS.length, 10);
  assert.deepEqual(PIEZAS.map(lineaDe), [...Array(8).fill("sensartias"), "3corn", "3corn"]);
  assert.equal(lineaDe({ nombre: "Esfera navideña" }), "navidad");
  assert.equal(lineaDe({ nombre: "Organizador de la mesa" }), "3corn");
  assert.equal(lineaDe({ nombre: "Soporte", linea: "navidad" }), "navidad");
});

test("solo expone las vistas que tienen una foto", async () => {
  const [{ vistasDe }, { PIEZAS }] = await modulos;
  assert.deepEqual(vistasDe(PIEZAS[0]).map(({ etiqueta }) => etiqueta), ["1. Limpia", "2. En mano", "3. En uso"]);
  assert.deepEqual(vistasDe(PIEZAS[1]).map(({ etiqueta }) => etiqueta), ["1. Limpia", "2. En mano"]);
  assert.equal(vistasDe(PIEZAS[3]).length, 1);
  assert.deepEqual(vistasDe({ fotos: ["a", "", "c"] }).map(({ indice, foto }) => [indice, foto]), [[0, "a"], [2, "c"]]);
  assert.deepEqual(vistasDe({}), []);
});

test("muestra los tiempos válidos en horas y minutos", async () => {
  const [{ horasTxt }] = await modulos;
  assert.equal(horasTxt(1.5), "~1 h 30 min");
  assert.equal(horasTxt(0.5), "~30 min");
  assert.equal(horasTxt(2.8), "~2 h 50 min");
  assert.equal(horasTxt(0.98), "~1 h");
  assert.equal(horasTxt(3), "~3 h");
  assert.equal(horasTxt(0), "");
});

test("formatea pesos argentinos y respeta los precios de los kits", async () => {
  const [{ precioTxt, descuentoPct }, { KITS }] = await modulos;
  assert.equal(precioTxt(4999), "$4.999");
  assert.equal(precioTxt(18000), "$18.000");
  assert.deepEqual(KITS.map(({ precio }) => precio), [10200, 15300]);
  assert.deepEqual(KITS.map(descuentoPct), [15, 15]);
  assert.deepEqual(KITS.map(({ precio, precioSeparado }) => precioTxt(precioSeparado - precio)), ["$1.799", "$2.700"]);
});

test("arma el mensaje con la vista activa y omite los datos ausentes", async () => {
  const [{ mensajeWA }, { PIEZAS }] = await modulos;
  assert.equal(mensajeWA(PIEZAS[0], 1), [
    "Hola PlayMind 3D! Quiero pedir:",
    "Línea: Juguetes & Sensartias",
    "Pieza: Fidget Cube Toy",
    "Vista: 2. En mano",
    "Tamaño: ~5 cm de lado · cabe en el bolsillo",
    "Precio: $4.999",
    "¿Coordinamos la entrega en Pilar?",
  ].join("\n"));
  assert.equal(mensajeWA(PIEZAS[3]), [
    "Hola PlayMind 3D! Quiero pedir:",
    "Línea: Juguetes & Sensartias",
    "Pieza: Tortuga Articulada",
    "Precio: $5.000",
    "¿Coordinamos la entrega en Pilar?",
  ].join("\n"));
});

test("codifica el pedido completo para el número de prueba", async () => {
  const [{ linkWA, mensajeKitWA }, { KITS }] = await modulos;
  const mensaje = mensajeKitWA(KITS[1]);
  assert.match(mensaje, /Kit: Kit Regalo & Deco\nIncluye: Soporte para Lentes Gato \+ Soporte de colitas\nPrecio: \$15\.300/);
  const enlace = new URL(linkWA(mensaje));
  assert.equal(enlace.origin, "https://wa.me");
  assert.equal(enlace.pathname, "/5491100000000");
  assert.equal(enlace.searchParams.get("text"), mensaje);
});

test("ignora tildes, mayúsculas y espacios al buscar por nombre", async () => {
  const [{ textoDeBusqueda }] = await modulos;
  assert.equal(textoDeBusqueda("  TÓRTUGA  "), "tortuga");
});
