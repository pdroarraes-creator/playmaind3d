/* Carga del catálogo público. Misma fuente que el index.html de la raíz (Apps Script,
   ?action=catalogo, sin login). Si falla o tarda, usa datos-ejemplo.json (foto del
   catálogo real, sin el número de WhatsApp) para que la página de prueba nunca quede vacía. */
var CatalogoDatos = (function () {
  'use strict';
  var SERVIDOR = 'https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec';
  var ESPERA_MS = 12000;

  function pedirJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  function ejemplo() {
    return pedirJSON('./datos-ejemplo.json', ESPERA_MS).then(function (j) { return { catalogo: j.catalogo, deEjemplo: true }; });
  }

  function cargar() {
    var forzar = /[?&]datos=ejemplo\b/.test(location.search);
    if (forzar) return ejemplo();
    return pedirJSON(SERVIDOR + '?action=catalogo', ESPERA_MS)
      .then(function (j) {
        if (!j || !j.ok || !j.catalogo) throw new Error('sin datos');
        return { catalogo: j.catalogo, deEjemplo: false };
      })
      .catch(function (e) {
        if (window.console) console.warn('Catálogo en vivo no disponible, uso datos de ejemplo:', e && e.message);
        return ejemplo();
      });
  }

  return { cargar: cargar };
})();
