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

const api = import("../catalog-v2/catalog-api.mjs");

const CATALOGO = {
  wa: "+54 9 11 5555-0000",
  colores: [{ nome: "Azul", hex: "#00f" }, { nome: "Azul" }, { nome: "" }],
  packs: [
    { tipo: "descuento", nome: "Llevá 3", off: 10, desde: 3, piezas: "" },
    { tipo: "descuento", nome: "Cubos", off: 20, desde: 2, piezas: "Fidget Cube Toy" },
    { tipo: "fijo", nome: "Kit Regalo", precio: 15300, incluye: "Cubo + cono" },
  ],
  piezas: [
    { nome: "Soporte de colitas", precio: 8000, stock: 1, libre: true, horas: 3, fotos: [] },
    { nome: "Fidget Cube Toy", precio: 4999, stock: 0, vendidas: 5, horas: 1.5, tags: "bolsillo, clásico", fotos: ["https://lh3.googleusercontent.com/d/a=w800", "javascript:alert(1)"] },
    { nome: "Fidget Cube Toy", precio: 5000, cat: "Personalizados", desc: "Con tu nombre", horas: 7, fotos: [] },
    { nome: "", precio: 100 },
  ],
};

test("adapta las piezas reales: precio, stock, color, fotos y orden del servidor", async () => {
  const { adaptarCatalogo } = await api;
  const { productos, colores, whatsapp } = adaptarCatalogo(CATALOGO);
  assert.deepEqual(productos.map(({ id }) => id), ["fidget-cube-toy", "fidget-cube-toy-2", "soporte-de-colitas", "kit-regalo"]);
  const [cubo, personalizado, soporte, kit] = productos;
  assert.equal(cubo.precio, 4999);
  assert.deepEqual(cubo.fotos, ["https://lh3.googleusercontent.com/d/a=w800"]);
  assert.deepEqual(cubo.tags, ["Más pedido", "bolsillo", "clásico"]);
  assert.equal(cubo.rasgo, "Hecha a pedido, una por una.");
  assert.equal(cubo.disponibilidad, "Se imprime a pedido");
  assert.equal(cubo.tiempo, "~1 h 30 min");
  assert.equal(personalizado.linea, "personalizados");
  assert.equal(personalizado.rasgo, "Con tu nombre");
  assert.equal(soporte.linea, "deco");
  assert.equal(soporte.disponibilidad, "Hay 1 lista para entregar");
  assert.deepEqual(soporte.tags, ["Lista para llevar", "Elegís el color"]);
  assert.equal(soporte.rasgo, "Se imprime a pedido, en el color que elijas.");
  assert.deepEqual([kit.linea, kit.precio, kit.detalle], ["kits", 15300, "Incluye: Cubo + cono"]);
  assert.deepEqual(colores, ["Azul"]);
  assert.equal(whatsapp, "5491155550000");
  assert.deepEqual(adaptarCatalogo(undefined), { productos: [], reglas: [], colores: [], whatsapp: "" });
});

test("aplica la regla que más descuenta y avisa cuánto falta", async () => {
  const { adaptarCatalogo, totalesPedido } = await api;
  const { reglas } = adaptarCatalogo(CATALOGO);
  const cubo = { nombre: "Fidget Cube Toy", precio: 5000 };
  const otro = { nombre: "Tortuga", precio: 2000 };
  assert.deepEqual(totalesPedido([], reglas), { unidades: 0, bruto: 0, descuento: 0, regla: null, falta: null, total: 0 });
  const uno = totalesPedido([{ ...cubo, cantidad: 1 }], reglas);
  assert.deepEqual([uno.descuento, uno.falta], [0, { unidades: 1, off: 20 }]);
  const dos = totalesPedido([{ ...cubo, cantidad: 2 }, { ...otro, cantidad: 1 }], reglas);
  assert.deepEqual([dos.bruto, dos.descuento, dos.regla.off, dos.total], [12000, 2000, 20, 10000]);
  const sinReglas = totalesPedido([{ ...cubo, cantidad: 9 }], []);
  assert.deepEqual([sinReglas.descuento, sinReglas.total], [0, 45000]);
});

test("arma el enlace de WhatsApp sólo si hay número cargado", async () => {
  const { linkWhatsApp } = await api;
  assert.equal(linkWhatsApp("", "hola"), "");
  const enlace = new URL(linkWhatsApp("+54 9 11 5555-0000", "hola ¿qué tal?"));
  assert.equal(enlace.pathname, "/5491155550000");
  assert.equal(enlace.searchParams.get("text"), "hola ¿qué tal?");
});

test("pide el catálogo al servidor y rechaza una respuesta sin datos", async () => {
  const { pedirCatalogo, SERVIDOR_CATALOGO } = await api;
  const pedidas = [];
  const ok = await pedirCatalogo(async (url) => { pedidas.push(url); return { json: async () => ({ ok: true, catalogo: CATALOGO }) }; });
  assert.equal(ok, CATALOGO);
  assert.deepEqual(pedidas, [SERVIDOR_CATALOGO]);
  await assert.rejects(pedirCatalogo(async () => ({ json: async () => ({ ok: false }) })));
});
