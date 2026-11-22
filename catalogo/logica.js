/* Lógica pura del catálogo (sin DOM ni red). Script clásico: en el navegador queda
   el global CatalogoLogica; en Node se carga con require() (tests/catalogo-logica.test.js). */
var CatalogoLogica = (function () {
  'use strict';

  var LINEAS = {
    sensartias: { titulo: 'Juguetes & Sensartias', corto: 'Sensartias', uso: 'Para tener las manos ocupadas y enfocarte, sin pantallas.' },
    '3corn': { titulo: '3corn & Deco', corto: '3corn & Deco', uso: 'Para ordenar tu escritorio y sumar un toque de decoración.' },
    navidad: { titulo: 'Especial Navidad', corto: 'Navidad', uso: 'Para decorar y regalar durante las fiestas.' }
  };
  var NOMBRES_DE_VISTA = ['1. Limpia', '2. En mano', '3. En uso'];
  var MAX_UNIDADES = 99;
  var MATERIAL = 'PLA, un bioplástico vegetal.';

  function pesos(n) {
    // separador de miles con punto (es-AR), sin depender de Intl en Node mínimo
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function limpiarTexto(x) { return (x == null ? '' : String(x)).trim(); }

  function lineaDe(p) {
    if (p.linea && LINEAS[p.linea]) return p.linea;
    if (/navidad|navide[ñn]|esfera|[aá]rbol|pino\b|campana/i.test(p.nombre)) return 'navidad';
    if (/soporte|estojo|porta|maceta|organiz/i.test(p.nombre)) return '3corn';
    return 'sensartias';
  }

  function esPersonalizable(p) {
    return p.cat === 'Personalizados' || !!p.libre || /personaliz/i.test(p.nombre + ' ' + p.desc);
  }

  // Convierte una pieza tal como la manda el servidor (campo "nome") a la forma que usa la página.
  function normalizarPieza(raw, indice) {
    var nombre = limpiarTexto(raw.nome || raw.nombre) || 'Pieza ' + (indice + 1);
    var p = {
      id: 'p' + indice,
      nombre: nombre,
      cat: limpiarTexto(raw.cat),
      desc: limpiarTexto(raw.desc),
      libre: !!raw.libre,
      precio: Math.max(0, Math.round(Number(raw.precio) || 0)),
      medida: limpiarTexto(raw.medida),
      horas: Number(raw.horas) > 0 ? Number(raw.horas) : 0,
      video: limpiarTexto(raw.video),
      detalle: limpiarTexto(raw.detalle),
      tags: limpiarTexto(raw.tags).split(/[,;]/).map(limpiarTexto).filter(Boolean),
      stock: Math.max(0, Number(raw.stock) || 0),
      vendidas: Math.max(0, Number(raw.vendidas) || 0),
      fotos: (Array.isArray(raw.fotos) ? raw.fotos : []).filter(function (f) { return typeof f === 'string' && f; }).slice(0, 3),
      linea: limpiarTexto(raw.linea)
    };
    p.linea = lineaDe(p);
    p.personalizable = esPersonalizable(p);
    return p;
  }

  function normalizarCatalogo(c) {
    c = c || {};
    return {
      marca: limpiarTexto(c.marca) || 'PlayMind 3d',
      wa: limpiarTexto(c.wa).replace(/[^0-9]/g, ''),
      piezas: (Array.isArray(c.piezas) ? c.piezas : []).map(normalizarPieza)
    };
  }

  // Solo las vistas que de verdad tienen foto; sin foto no hay pestaña.
  function vistasDe(p) {
    var out = [];
    for (var i = 0; i < NOMBRES_DE_VISTA.length; i++) {
      if (p.fotos[i]) out.push({ foto: p.fotos[i], indice: i, etiqueta: NOMBRES_DE_VISTA[i] });
    }
    return out;
  }

  function horasTxt(horas) {
    if (!isFinite(horas) || horas <= 0) return '';
    var min = Math.max(1, Math.round(horas * 60 / 5) * 5);
    var h = Math.floor(min / 60), r = min % 60;
    if (h === 0) return '~' + r + ' min';
    return '~' + h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  // Las cuatro informaciones de la ficha. Cada una se oculta si no hay dato real.
  function especificaciones(p) {
    var out = [];
    out.push(['¿Para qué sirve?', p.desc || (LINEAS[p.linea] || LINEAS.sensartias).uso]);
    if (p.medida) out.push(['Tamaño real', p.medida]);
    var t = horasTxt(p.horas);
    if (t) out.push(['Tiempo de impresión', t]);
    out.push(['Material', MATERIAL]);
    out.push(['Disponibilidad', p.stock > 0
      ? 'Hay ' + p.stock + ' lista' + (p.stock > 1 ? 's' : '') + ' para entregar'
      : 'Se imprime a pedido, una por una']);
    return out;
  }

  function ajustarPedido(pedido, id, cambio) {
    if (!Number.isInteger(cambio)) return pedido;
    var antes = pedido.get(id) || 0;
    var cant = Math.max(0, Math.min(MAX_UNIDADES, antes + cambio));
    if (cant === antes) return pedido;
    var nuevo = new Map(pedido);
    if (cant > 0) nuevo.set(id, cant); else nuevo.delete(id);
    return nuevo;
  }

  function resumenPedido(lineas) {
    var unidades = 0, total = 0;
    lineas.forEach(function (l) { unidades += l.cantidad; total += l.pieza.precio * l.cantidad; });
    return { unidades: unidades, total: total };
  }

  function mensajePedido(lineas) {
    var items = [];
    lineas.forEach(function (l) {
      items.push(l.cantidad + ' × ' + l.pieza.nombre + ' · ' + pesos(l.pieza.precio * l.cantidad));
      if (l.nota) items.push('   Personalización: ' + l.nota);
    });
    return ['¡Hola PlayMind 3d! Quiero hacer este pedido:', ''].concat(items, [
      '', 'Total estimado: ' + pesos(resumenPedido(lineas).total),
      '¿Me confirman la disponibilidad y la entrega?'
    ]).join('\n');
  }

  function linkWA(mensaje, numero) {
    if (!numero) return '';
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje);
  }

  function textoDeBusqueda(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function filtrar(piezas, linea, consulta) {
    var q = textoDeBusqueda(consulta);
    return piezas.filter(function (p) {
      if (linea !== 'todos' && p.linea !== linea) return false;
      return !q || textoDeBusqueda([p.nombre, LINEAS[p.linea].corto, p.tags.join(' '), p.desc].join(' ')).indexOf(q) !== -1;
    });
  }

  // Con foto primero, y las que hay para llevar antes que las que se imprimen a pedido.
  function ordenar(piezas) {
    return piezas.slice().sort(function (a, b) {
      return (b.fotos.length ? 2 : 0) + (b.stock > 0 ? 1 : 0) - ((a.fotos.length ? 2 : 0) + (a.stock > 0 ? 1 : 0));
    });
  }

  var api = {
    LINEAS: LINEAS, MAX_UNIDADES: MAX_UNIDADES, MATERIAL: MATERIAL,
    pesos: pesos, lineaDe: lineaDe, esPersonalizable: esPersonalizable,
    normalizarPieza: normalizarPieza, normalizarCatalogo: normalizarCatalogo,
    vistasDe: vistasDe, horasTxt: horasTxt, especificaciones: especificaciones,
    ajustarPedido: ajustarPedido, resumenPedido: resumenPedido, mensajePedido: mensajePedido,
    linkWA: linkWA, textoDeBusqueda: textoDeBusqueda, filtrar: filtrar, ordenar: ordenar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
