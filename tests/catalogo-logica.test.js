'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../catalogo/logica.js');

const crudo = (o) => Object.assign({ nome: 'Pieza', cat: '', desc: '', libre: false, precio: 5000, medida: '', horas: 0, video: '', detalle: '', tags: '', stock: 0, vendidas: 0, fotos: [] }, o);

test('pesos usa punto de miles', () => {
  assert.equal(L.pesos(4999), '$4.999');
  assert.equal(L.pesos(12500), '$12.500');
  assert.equal(L.pesos(0), '$0');
});

test('horasTxt: redondea a 5 min y oculta lo vacío', () => {
  assert.equal(L.horasTxt(0), '');
  assert.equal(L.horasTxt(NaN), '');
  assert.equal(L.horasTxt(1.5), '~1 h 30 min');
  assert.equal(L.horasTxt(0.5), '~30 min');
  assert.equal(L.horasTxt(2), '~2 h');
});

test('normalizarPieza lee "nome" y limpia campos', () => {
  const p = L.normalizarPieza(crudo({ nome: ' Cono fidget ', tags: 'silencioso, foco ;  ', fotos: ['a', '', 'b', 'c', 'd'] }), 3);
  assert.equal(p.nombre, 'Cono fidget');
  assert.equal(p.id, 'p3');
  assert.deepEqual(p.tags, ['silencioso', 'foco']);
  assert.deepEqual(p.fotos, ['a', 'b', 'c']);
});

test('lineaDe: reglas por nombre y override explícito', () => {
  assert.equal(L.normalizarPieza(crudo({ nome: 'Soporte para Lentes Gato' }), 0).linea, '3corn');
  assert.equal(L.normalizarPieza(crudo({ nome: 'Esfera navideña' }), 0).linea, 'navidad');
  assert.equal(L.normalizarPieza(crudo({ nome: 'Tortuga Articulada' }), 0).linea, 'sensartias');
  assert.equal(L.normalizarPieza(crudo({ nome: 'Tortuga', linea: '3corn' }), 0).linea, '3corn');
  assert.equal(L.normalizarPieza(crudo({ nome: 'Tortuga', linea: 'inventada' }), 0).linea, 'sensartias');
});

test('personalizable: cat, libre o texto', () => {
  assert.equal(L.normalizarPieza(crudo({ cat: 'Personalizados' }), 0).personalizable, true);
  assert.equal(L.normalizarPieza(crudo({ libre: true }), 0).personalizable, true);
  assert.equal(L.normalizarPieza(crudo({ desc: 'Podés personalizar el nombre' }), 0).personalizable, true);
  assert.equal(L.normalizarPieza(crudo({}), 0).personalizable, false);
});

test('vistasDe: solo las vistas con foto, con los nombres acordados', () => {
  const una = L.normalizarPieza(crudo({ fotos: ['x'] }), 0);
  assert.deepEqual(L.vistasDe(una).map((v) => v.etiqueta), ['1. Limpia']);
  const tres = L.normalizarPieza(crudo({ fotos: ['x', 'y', 'z'] }), 0);
  assert.deepEqual(L.vistasDe(tres).map((v) => v.etiqueta), ['1. Limpia', '2. En mano', '3. En uso']);
  assert.deepEqual(L.vistasDe(L.normalizarPieza(crudo({}), 0)), []);
});

test('especificaciones: oculta tamaño y tiempo sin dato, nunca inventa', () => {
  const vacia = L.especificaciones(L.normalizarPieza(crudo({}), 0)).map((e) => e[0]);
  assert.deepEqual(vacia, ['¿Para qué sirve?', 'Material', 'Disponibilidad']);
  const llena = L.especificaciones(L.normalizarPieza(crudo({ medida: '5 cm', horas: 1.5, stock: 2, desc: 'Para calmar' }), 0));
  assert.deepEqual(llena.map((e) => e[0]), ['¿Para qué sirve?', 'Tamaño real', 'Tiempo de impresión', 'Material', 'Disponibilidad']);
  assert.equal(llena[0][1], 'Para calmar');
  assert.equal(llena[2][1], '~1 h 30 min');
  assert.equal(llena[4][1], 'Hay 2 listas para entregar');
});

test('ajustarPedido respeta 0 y el máximo', () => {
  let m = new Map();
  m = L.ajustarPedido(m, 'a', 1);
  assert.equal(m.get('a'), 1);
  m = L.ajustarPedido(m, 'a', -1);
  assert.equal(m.has('a'), false);
  assert.equal(L.ajustarPedido(m, 'a', -1), m);
  assert.equal(L.ajustarPedido(new Map([['a', 99]]), 'a', 1).get('a'), 99);
});

test('mensajePedido: sin descuentos inventados, con personalización y total', () => {
  const pz = L.normalizarPieza(crudo({ nome: 'Llavero', precio: 3000 }), 0);
  const msg = L.mensajePedido([{ pieza: pz, cantidad: 2, nota: 'Sofi' }]);
  assert.match(msg, /2 × Llavero · \$6\.000/);
  assert.match(msg, /Personalización: Sofi/);
  assert.match(msg, /Total estimado: \$6\.000/);
  assert.doesNotMatch(msg, /descuento|%/i);
});

test('linkWA: sin número no hay link', () => {
  assert.equal(L.linkWA('hola', ''), '');
  assert.equal(L.linkWA('a b', '549'), 'https://wa.me/549?text=a%20b');
});

test('filtrar ignora tildes y mayúsculas, y filtra por línea', () => {
  const ps = ['Cráneo clicker', 'Soporte gato', 'Tortuga'].map((n, i) => L.normalizarPieza(crudo({ nome: n }), i));
  assert.deepEqual(L.filtrar(ps, 'todos', 'craneo').map((p) => p.nombre), ['Cráneo clicker']);
  assert.deepEqual(L.filtrar(ps, '3corn', '').map((p) => p.nombre), ['Soporte gato']);
  assert.equal(L.filtrar(ps, 'navidad', '').length, 0);
});

test('catálogo de ejemplo: normaliza las 43 piezas sin romper y sin número de WhatsApp', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '../catalogo/datos-ejemplo.json'), 'utf8'));
  const c = L.normalizarCatalogo(j.catalogo);
  assert.equal(c.piezas.length, 43);
  assert.equal(c.wa, '');
  assert.ok(c.piezas.every((p) => p.nombre && p.precio > 0));
  assert.ok(c.piezas.every((p) => L.especificaciones(p).length >= 3));
});
