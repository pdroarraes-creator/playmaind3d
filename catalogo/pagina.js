/* Comportamiento de la página del catálogo (adaptado del prototipo de diseño). */
(function () {
  'use strict';
  var L = CatalogoLogica;
  var TAM_PAGINA = 16;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var piezas = [], wa = '';
  var bolsa = []; // { pieza, nota, cantidad }
  var linea = 'todos', pagina = 0, activa = null, disparador = null, timerToast = null;
  var grid = $('#product-grid'), detalle = $('#product-dialog'), cajon = $('#bag-dialog'), buscar = $('#search-input');
  var filtros = [].slice.call(document.querySelectorAll('[data-category]'));

  function el(tag, texto, clase) {
    var n = document.createElement(tag);
    if (texto !== undefined) n.textContent = texto;
    if (clase) n.className = clase;
    return n;
  }
  function icono(nombre) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(ns, 'use'); use.setAttribute('href', '#' + nombre); svg.appendChild(use);
    return svg;
  }
  function botonIcono(nombre, etiqueta, clase, onClick) {
    var b = el('button', undefined, clase); b.type = 'button'; b.setAttribute('aria-label', etiqueta);
    b.appendChild(icono(nombre)); b.addEventListener('click', onClick); return b;
  }
  function pulso(n) { if (!n) return; n.classList.remove('is-pulsing'); void n.offsetWidth; n.classList.add('is-pulsing'); }
  function foto(url) { return url || '../assets/logo-app.png'; }

  /* ---------- bolsa ---------- */
  function cantidadDe(p) { return bolsa.reduce(function (t, l) { return t + (l.pieza.id === p.id ? l.cantidad : 0); }, 0); }
  function lineasPedido() { return bolsa.map(function (l) { return { pieza: l.pieza, cantidad: l.cantidad, nota: l.nota }; }); }

  function anunciar(texto) {
    var t = $('#toast'); clearTimeout(timerToast);
    t.textContent = texto; t.classList.add('is-visible'); $('#bag-status').textContent = texto;
    timerToast = setTimeout(function () { t.classList.remove('is-visible'); }, 2200);
  }

  function sumar(p, nota, foco) {
    var fila = bolsa.filter(function (l) { return l.pieza.id === p.id && l.nota === nota; })[0];
    if (fila) fila.cantidad = Math.min(L.MAX_UNIDADES, fila.cantidad + 1);
    else bolsa.push({ pieza: p, nota: nota, cantidad: 1 });
    despuesDeCambio(p, foco);
    anunciar(p.nombre + ': agregada a tu bolsa');
  }
  function cambiarFila(i, delta, foco) {
    var l = bolsa[i]; if (!l) return;
    l.cantidad = Math.min(L.MAX_UNIDADES, l.cantidad + delta);
    if (l.cantidad <= 0) { bolsa.splice(i, 1); anunciar(l.pieza.nombre + ': quitada de tu bolsa'); }
    despuesDeCambio(l.pieza, foco);
  }
  function cambiarDesdeTarjeta(p, delta, foco) {
    if (delta > 0) return sumar(p, '', foco);
    for (var i = bolsa.length - 1; i >= 0; i--) if (bolsa[i].pieza.id === p.id) return cambiarFila(i, -1, foco);
  }
  function despuesDeCambio(p, foco) {
    pintarBolsa();
    var tarjeta = grid.querySelector('[data-product="' + p.id + '"]');
    if (tarjeta) pulso(pintarControl(tarjeta, p, foco));
    pulso($('#bag-button'));
  }

  function stepper(cant, etiqueta, menos, mas) {
    var c = el('div', undefined, 'stepper'); c.setAttribute('role', 'group'); c.setAttribute('aria-label', etiqueta);
    var v = el('span', String(cant), 'stepper-value'); v.setAttribute('aria-live', 'polite');
    var b2 = botonIcono('icon-plus', 'Sumar una más de ' + etiqueta, 'stepper-button', mas); b2.disabled = cant >= L.MAX_UNIDADES;
    c.appendChild(botonIcono('icon-minus', 'Quitar una de ' + etiqueta, 'stepper-button', menos)); c.appendChild(v); c.appendChild(b2);
    return c;
  }

  function pintarControl(tarjeta, p, foco) {
    var slot = $('[data-control]', tarjeta), cant = cantidadDe(p), nodo;
    if (cant === 0) {
      nodo = el('button', undefined, 'add-button'); nodo.type = 'button';
      nodo.setAttribute('aria-label', 'Sumar ' + p.nombre + ' a la bolsa');
      nodo.appendChild(icono('icon-plus')); nodo.appendChild(el('span', 'Sumar'));
      nodo.addEventListener('click', function () { cambiarDesdeTarjeta(p, 1, 'plus'); });
      slot.replaceChildren(nodo);
      if (foco) nodo.focus();
      return nodo;
    }
    nodo = stepper(cant, p.nombre, function () { cambiarDesdeTarjeta(p, -1, 'minus'); }, function () { cambiarDesdeTarjeta(p, 1, 'plus'); });
    slot.replaceChildren(nodo);
    if (foco) $('.stepper-button:' + (foco === 'minus' ? 'first-of-type' : 'last-of-type'), nodo).focus();
    return nodo;
  }

  function enfocarFila(i, sel) {
    var filas = $('#bag-list').children, f = filas[Math.min(i, filas.length - 1)];
    var destino = f ? $(sel, f) : null;
    (destino || $('#bag-empty button')).focus();
  }

  function pintarBolsa() {
    var r = L.resumenPedido(lineasPedido());
    $('#bag-count').textContent = r.unidades;
    $('#bag-button').setAttribute('aria-label', 'Bolsa, ' + r.unidades + (r.unidades === 1 ? ' artículo' : ' artículos'));
    $('#bag-button').classList.toggle('has-items', r.unidades > 0);
    $('#bag-empty').hidden = bolsa.length > 0;
    $('#bag-summary').hidden = !bolsa.length || !$('#order-preview').hidden;
    $('#bag-total').textContent = L.pesos(r.total);
    $('#preview-order').hidden = !wa;
    $('#bag-list').replaceChildren.apply($('#bag-list'), bolsa.map(function (l, i) {
      var fila = el('li', undefined, 'bag-row');
      var img = el('img'); img.src = foto(l.pieza.fotos[0]); img.alt = ''; img.width = 64; img.height = 64;
      var info = el('div', undefined, 'bag-info'), arriba = el('div', undefined, 'bag-row-top');
      arriba.appendChild(el('h3', l.pieza.nombre));
      arriba.appendChild(botonIcono('icon-trash', 'Eliminar ' + l.pieza.nombre + ' de la bolsa', 'remove-button', function () {
        bolsa.splice(i, 1); despuesDeCambio(l.pieza); anunciar(l.pieza.nombre + ': quitada de tu bolsa'); enfocarFila(i, '.remove-button');
      }));
      info.appendChild(arriba);
      if (l.nota) info.appendChild(el('p', 'Personalización: ' + l.nota, 'bag-meta'));
      var abajo = el('div', undefined, 'bag-row-bottom');
      abajo.appendChild(stepper(l.cantidad, l.pieza.nombre, function () {
        var quita = l.cantidad === 1; cambiarFila(i, -1); enfocarFila(i, quita ? '.remove-button' : '.stepper-button');
      }, function () { cambiarFila(i, 1); enfocarFila(i, '.stepper-button:last-of-type'); }));
      abajo.appendChild(el('strong', L.pesos(l.pieza.precio * l.cantidad)));
      info.appendChild(abajo);
      fila.appendChild(img); fila.appendChild(info);
      return fila;
    }));
  }

  function verPedido(mostrar) {
    $('#order-preview').hidden = !mostrar;
    $('#bag-content').hidden = mostrar;
    $('#bag-summary').hidden = mostrar || !bolsa.length;
    if (mostrar) {
      var msg = L.mensajePedido(lineasPedido());
      $('#order-message').textContent = msg;
      $('#whatsapp-link').href = L.linkWA(msg, wa);
      $('#preview-title').focus();
    } else if (cajon.open) $('#preview-order').focus();
  }

  /* ---------- catálogo ---------- */
  function etiquetasTarjeta(p) { return p.stock > 0 ? ['Lista para llevar'] : []; }
  function pintarEtiquetas(p, raiz) {
    raiz.replaceChildren.apply(raiz, etiquetasTarjeta(p).concat(p.tags).map(function (t) {
      return el('span', t, 'tag' + (t === 'Lista para llevar' ? ' stock-tag' : ''));
    }));
  }
  function frase(p) { return p.desc ? p.desc.split('\n')[0] : ''; }

  function tarjeta(p, i) {
    var f = $('#product-template').content.cloneNode(true), c = $('.product-card', f);
    c.dataset.product = p.id; c.style.setProperty('--i', String(i % 4));
    var img = $('img', c); if (i > 3) img.loading = 'lazy'; img.src = foto(p.fotos[0]);
    var media = $('.product-media', c); media.setAttribute('aria-label', 'Ver detalles: ' + p.nombre);
    var titulo = $('h3 button', c); titulo.textContent = p.nombre;
    [media, titulo].forEach(function (t) { t.addEventListener('click', function () { abrirDetalle(p, t); }); });
    pintarEtiquetas(p, $('[data-tags]', c));
    $('[data-trait]', c).textContent = frase(p);
    $('[data-product-category]', c).textContent = L.LINEAS[p.linea].corto;
    $('[data-price]', c).textContent = L.pesos(p.precio);
    pintarControl(c, p);
    return f;
  }

  function pintar() {
    var res = L.filtrar(piezas, linea, buscar.value);
    var paginas = Math.max(1, Math.ceil(res.length / TAM_PAGINA));
    pagina = Math.min(paginas - 1, Math.max(0, pagina));
    grid.replaceChildren.apply(grid, res.slice(pagina * TAM_PAGINA, (pagina + 1) * TAM_PAGINA).map(tarjeta));
    $('#result-count').textContent = res.length + (res.length === 1 ? ' pieza' : ' piezas');
    $('#empty-catalog').hidden = res.length !== 0;
    $('#pagination').hidden = paginas === 1;
    $('#page-label').textContent = (pagina + 1) + ' de ' + paginas;
    $('#page-prev').disabled = pagina === 0;
    $('#page-next').disabled = pagina + 1 === paginas;
    filtros.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.category === linea)); });
    $('#catalog-title').textContent = linea === 'todos' ? 'Elegí tu pieza' : L.LINEAS[linea].titulo;
  }
  function elegirLinea(l) { linea = l; pagina = 0; pintar(); }
  function irAlCatalogo() { var h = $('#catalog-title'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }

  function busqueda(abrir, devolverFoco) {
    var t = $('#search-toggle'), panel = $('#search-panel');
    if (devolverFoco === undefined) devolverFoco = true;
    t.setAttribute('aria-expanded', String(abrir));
    t.setAttribute('aria-label', abrir ? 'Cerrar búsqueda' : 'Abrir búsqueda');
    panel.classList.toggle('is-open', abrir); panel.inert = !abrir;
    if (abrir) buscar.focus();
    else {
      if (buscar.value) { buscar.value = ''; pagina = 0; pintar(); }
      if (devolverFoco) t.focus();
    }
  }

  /* ---------- ficha ---------- */
  function mostrarVista(p, vista) {
    var img = $('#detail-photo'); img.src = foto(vista ? vista.foto : p.fotos[0]);
    img.alt = vista ? p.nombre + ' — ' + vista.etiqueta : p.nombre;
    [].forEach.call($('#view-tabs').children, function (b) { b.setAttribute('aria-pressed', String(vista && Number(b.dataset.i) === vista.indice)); });
  }

  function abrirDetalle(p, quien) {
    activa = p; disparador = quien;
    $('#detail-title').textContent = p.nombre;
    $('#detail-price').textContent = L.pesos(p.precio) + ' ARS';
    pintarEtiquetas(p, $('#detail-tags'));
    var vistas = L.vistasDe(p), tabs = $('#view-tabs');
    tabs.hidden = vistas.length < 2;
    tabs.replaceChildren.apply(tabs, vistas.length < 2 ? [] : vistas.map(function (v) {
      var b = el('button', v.etiqueta); b.type = 'button'; b.dataset.i = String(v.indice);
      b.addEventListener('click', function () { mostrarVista(p, v); });
      return b;
    }));
    mostrarVista(p, vistas[0]);
    var dl = $('#detail-specs');
    dl.replaceChildren.apply(dl, L.especificaciones(p).map(function (e) {
      var d = el('div'); d.appendChild(el('dt', e[0])); d.appendChild(el('dd', e[1])); return d;
    }));
    $('#detail-name-label').hidden = !p.personalizable;
    $('#detail-name').value = '';
    detalle.showModal();
    $('#detail-title').focus({ preventScroll: true });
    detalle.scrollTop = 0;
  }

  /* ---------- arranque ---------- */
  function cerrarAlClicFuera(d) {
    d.addEventListener('click', function (ev) {
      if (ev.target !== d) return;
      var r = d.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) d.close();
    });
  }

  function ligar() {
    filtros.forEach(function (b) { b.addEventListener('click', function () { elegirLinea(b.dataset.category); }); });
    [].forEach.call(document.querySelectorAll('[data-category-link]'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); busqueda(false, false); elegirLinea(a.dataset.categoryLink); irAlCatalogo(); });
    });
    $('#reset-catalog').addEventListener('click', function () { buscar.value = ''; elegirLinea('todos'); irAlCatalogo(); });
    [['#page-prev', -1], ['#page-next', 1]].forEach(function (x) {
      $(x[0]).addEventListener('click', function () { pagina += x[1]; pintar(); irAlCatalogo(); });
    });
    $('#search-toggle').addEventListener('click', function () { busqueda($('#search-panel').inert); });
    $('#search-close').addEventListener('click', function () { busqueda(false); });
    $('#search-form').addEventListener('submit', function (ev) { ev.preventDefault(); irAlCatalogo(); });
    buscar.addEventListener('input', function () { pagina = 0; pintar(); });
    buscar.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); busqueda(false); }
    });
    $('#detail-form').addEventListener('submit', function (ev) {
      ev.preventDefault(); if (!activa) return;
      sumar(activa, activa.personalizable ? $('#detail-name').value.trim() : '');
      detalle.close();
    });
    detalle.addEventListener('close', function () { if (disparador) disparador.focus({ preventScroll: true }); });
    $('#bag-button').addEventListener('click', function () { verPedido(false); pintarBolsa(); cajon.showModal(); $('#bag-title').focus(); });
    $('#preview-order').addEventListener('click', function () { verPedido(true); });
    $('#back-to-bag').addEventListener('click', function () { verPedido(false); });
    cajon.addEventListener('close', function () { $('#bag-button').focus(); });
    [detalle, cajon].forEach(function (d) {
      [].forEach.call(d.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', function () { d.close(); }); });
      cerrarAlClicFuera(d);
    });
  }

  function arrancar() {
    ligar();
    pintarBolsa();
    CatalogoDatos.cargar().then(function (r) {
      var c = L.normalizarCatalogo(r.catalogo);
      piezas = L.ordenar(c.piezas); wa = c.wa;
      var hayNavidad = piezas.some(function (p) { return p.linea === 'navidad'; });
      [].forEach.call(document.querySelectorAll('[data-solo-navidad]'), function (n) { n.hidden = !hayNavidad; });
      $('#seccion-navidad').hidden = !hayNavidad;
      var consulta = L.linkWA('¡Hola PlayMind 3d! Tengo una consulta sobre el catálogo.', wa);
      [$('#contact-link'), $('#whatsapp-float')].forEach(function (a) { if (consulta) { a.href = consulta; a.hidden = false; } });
      if (r.deEjemplo) $('#result-count').title = 'Datos de ejemplo (sin conexión al servidor)';
      if (!piezas.length) { grid.replaceChildren(el('p', 'Todavía no hay piezas cargadas.', 'catalog-error')); return; }
      pintar();
      document.documentElement.dataset.listo = '1';
    });
  }
  arrancar();
})();
