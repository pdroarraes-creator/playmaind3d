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
  assert.deepEqual(vistasDe(PIEZAS[0]).map(({ etiqueta }) => etiqueta), ["Frente", "Detalles", "Perspectiva"]);
  assert.deepEqual(vistasDe(PIEZAS[1]).map(({ etiqueta }) => etiqueta), ["Vista principal", "Otra vista"]);
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

test("agrupa unidades, calcula el total y quita artículos sin cambiar el pedido anterior", async () => {
  const [{ ajustarPedido, resumenPedido }, { PIEZAS, KITS }] = await modulos;
  const pieza = PIEZAS[0];
  const kit = KITS[1];
  const vacio = new Map();
  const primero = ajustarPedido(ajustarPedido(vacio, pieza, 1), kit, 1);
  const segundo = ajustarPedido(primero, pieza, 1);
  assert.equal(vacio.size, 0);
  assert.equal(primero.get(pieza), 1);
  assert.equal(segundo.get(pieza), 2);
  assert.equal(segundo.size, 2);
  assert.deepEqual(resumenPedido(segundo), { unidades: 3, total: 25298 });
  const ultimo = ajustarPedido(ajustarPedido(segundo, kit, -1), pieza, -2);
  assert.deepEqual(resumenPedido(ultimo), { unidades: 0, total: 0 });
});

test("ignora cantidades no válidas y limita el máximo por artículo", async () => {
  const [{ ajustarPedido, MAX_UNIDADES_POR_ARTICULO }, { PIEZAS }] = await modulos;
  const pieza = PIEZAS[0];
  const vacio = new Map();
  assert.equal(ajustarPedido(vacio, pieza, 0.5), vacio);
  assert.equal(ajustarPedido(vacio, pieza, -1), vacio);
  const pedido = ajustarPedido(vacio, pieza, MAX_UNIDADES_POR_ARTICULO + 1);
  assert.equal(pedido.get(pieza), MAX_UNIDADES_POR_ARTICULO);
  assert.equal(ajustarPedido(pedido, pieza, 1), pedido);
});

test("codifica piezas, kits y el total en un único mensaje para el número de prueba", async () => {
  const [{ linkWA, mensajePedidoWA }, { PIEZAS, KITS }] = await modulos;
  const mensaje = mensajePedidoWA(new Map([[PIEZAS[0], 2], [KITS[1], 1]]));
  assert.match(mensaje, /2 × Fidget Cube Toy · \$9\.998\n   Tamaño: ~5 cm de lado/);
  assert.match(mensaje, /1 × Kit Regalo & Deco · \$15\.300\n   Incluye: Soporte para Lentes Gato \+ Soporte de colitas/);
  assert.match(mensaje, /Total estimado: \$25\.298/);
  assert.match(mensaje, /disponibilidad y la entrega en Pilar/);
  const enlace = new URL(linkWA(mensaje));
  assert.equal(enlace.origin, "https://wa.me");
  assert.equal(enlace.pathname, "/5491100000000");
  assert.equal(enlace.searchParams.get("text"), mensaje);
});

test("ignora tildes, mayúsculas y espacios al buscar por nombre", async () => {
  const [{ textoDeBusqueda }] = await modulos;
  assert.equal(textoDeBusqueda("  TÓRTUGA  "), "tortuga");
});
