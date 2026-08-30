// Fuente del bookmarklet que el usuario instala una vez (arrastrar a favoritos)
// y clickea estando en una página de modelo del MakerWorld. Corre en el
// origen de makerworld.com, así que puede leer el <script id="__NEXT_DATA__">
// de la propia página sin ningún problema de CORS ni bloqueo anti-bot —
// eso sólo pasa cuando un SERVIDOR intenta pedir la página (probado en esta
// sesión: falla igual desde Cloudflare Workers y desde Google Apps Script).
//
// RIESGO CONOCIDO: depende de que MakerWorld siga usando Next.js con esa
// estructura (props.pageProps.design). Si cambia, hay que abrir una página
// real de nuevo y mirar el HTML para encontrar dónde quedaron los datos.

const APP_URL = "https://playmind3d.com/app/";

export const BOOKMARKLET_JS = `
(function () {
  try {
    var script = document.getElementById('__NEXT_DATA__');
    if (!script) { alert('No encontré los datos del modelo en esta página.'); return; }
    var data = JSON.parse(script.textContent);
    var design = data && data.props && data.props.pageProps && data.props.pageProps.design;
    if (!design || !design.title) { alert('Esta página no parece ser un modelo válido.'); return; }

    var instancias = design.instances || [];
    var instancia = instancias.filter(function (i) { return i.id === design.defaultInstanceId; })[0]
      || instancias[0] || null;

    var resumen = {
      titulo: design.title,
      descripcion: String(design.summary || '')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/\\s+/g, ' ').trim().slice(0, 600),
      tags: (design.tags || []).join(', '),
      imagen: design.coverUrl || null,
      peso_g: instancia ? Number(instancia.weight) || 0 : 0,
      tiempo_min: instancia ? Math.round((Number(instancia.prediction) || 0) / 60) : 0,
      link: location.href,
    };

    var url = '${APP_URL}?cadastro=mw&mw=' + encodeURIComponent(JSON.stringify(resumen));
    window.open(url, '_blank');
  } catch (e) {
    alert('No pude leer los datos de esta página: ' + e.message);
  }
})();
`.trim();
