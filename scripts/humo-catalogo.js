// Smoke de la página pública (/) con Playwright (del ambiente, no es dependencia del repo).
// Uso: node scripts/humo-catalogo.js [carpeta-de-capturas]
// Sin red: el Apps Script se reemplaza por un catálogo inventado (abajo), así el resultado no cambia
// cuando se editan las piezas reales. Las fotos de Drive se reemplazan por un PNG.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..'), SALIDA = process.argv[2] || null;
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp4': 'video/mp4', '.gif': 'image/gif', '.png': 'image/png', '.json': 'application/json' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };

const foto = (n) => 'https://lh3.googleusercontent.com/d/FOTO' + n + '=w800';
const pieza = (nome, extra = {}) => Object.assign({ nome, cat: '', desc: '', libre: false, precio: 5000, medida: '', horas: 1, video: '', detalle: '', tags: '', stock: 0, vendidas: 0, fotos: [foto(nome.length)] }, extra);
// 21 piezas: una con 3 fotos, una personalizable con descripción, 3 de deco, y relleno para que haya 2 páginas
function catalogoInventado(extra = []) {
  const piezas = [
    pieza('Fidget Cube Toy', { precio: 4999, horas: 1.5, fotos: [foto(1), foto(2), foto(3)] }),
    pieza('Llavero Personalizado', { cat: 'Personalizados', desc: 'Podés personalizar tu llavero con un nombre.', precio: 3000 }),
    pieza('Tortuga Articulada'),
    pieza('Cono fidget toy', { fotos: [foto(4), foto(5)] }),
    pieza('Soporte para Lentes Gato'), pieza('Soporte de colitas'), pieza('Estojo para Protetor Labia'),
  ];
  for (let i = 1; i <= 14; i++) piezas.push(pieza('Pieza de relleno ' + i));
  return { ok: true, catalogo: { marca: 'PlayMind 3d', wa: '5491100000000', colores: [], packs: [], opiniones: [], leti: {}, piezas: piezas.concat(extra), hero: { v1: '', v2: '' } } };
}

async function paginaNueva(ctx, base, json, url = '/') {
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await p.route('**/script.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(json) }));
  await p.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p.route('**/fonts.g*apis.com/**', (r) => r.abort());
  await p.route('https://ejemplo.test/**', (r) => (/\.gif$/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: 'image/gif', body: GIF })
    : r.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(path.join(RAIZ, 'catalogo/assets/studio-hero.mp4')) })));
  await p.goto(base + url);
  await p.waitForSelector('.product-card', { timeout: 30000 });
  p.errores = errores;
  return p;
}

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // ---- escenario 1: catálogo normal, sin piezas navideñas ----
  const page = await paginaNueva(ctx, base, catalogoInventado());
  ok(await page.locator('.product-card').count() === 16, 'primera página con 16 tarjetas');
  ok(/21 piezas/.test(await page.textContent('#result-count')), 'contador: 21 piezas');
  ok(await page.locator('meta[name=robots]').count() === 0, 'sin noindex: la página se puede indexar');
  ok(await page.getAttribute('link[rel=canonical]', 'href') === 'https://playmind3d.com/', 'canonical apunta al dominio');
  ok(/D3cor/.test(await page.textContent('#hero-title')), 'el hero habla de la línea D3cor y la Navidad');
  ok(await page.locator('#holiday-section').isHidden(), 'sin piezas navideñas no se muestra la seccion de Navidad');
  ok((await page.textContent('#hero-cta-text')).trim() === 'Ver la línea D3cor', 'el botón del hero ofrece la línea D3cor');
  await page.click('#hero-cta');
  const nDeco = await page.locator('.product-card').count();
  ok(nDeco === 3 && (await page.locator('[data-category="deco"]').getAttribute('aria-pressed')) === 'true', 'el botón del hero abre D3cor (' + nDeco + ' piezas)');
  await page.click('[data-category="todos"]');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'sin scroll horizontal a 390px');
  ok(await page.locator('.footer-social a').count() === 1, 'redes: solo Instagram (las otras no están confirmadas)');
  if (SALIDA) await page.screenshot({ path: path.join(SALIDA, 'inicio.png') });

  await page.locator('.product-card', { hasText: 'Fidget Cube Toy' }).locator('h3 button').click();
  ok(await page.locator('#product-dialog').evaluate((d) => d.open), 'la ficha abre al clicar la pieza');
  const tabs = await page.locator('#detail-thumbs button').allTextContents();
  ok(tabs.join('|') === '1. Limpia|2. En mano|3. En uso', 'Fidget Cube: pestañas ' + tabs.join(' | '));
  await page.click('#detail-thumbs button:nth-child(3)');
  ok(await page.locator('#detail-thumbs button:nth-child(3)').getAttribute('aria-pressed') === 'true', 'la pestaña 3 queda activa');
  const rot = await page.locator('#detail-specs dt').allTextContents();
  ok(rot.includes('Material') && rot.includes('Disponibilidad') && rot.includes('Tiempo de impresión'), 'ficha: ' + rot.join(' / '));
  ok(!rot.includes('Tamaño real'), 'sin medida cargada no aparece "Tamaño real"');
  ok(/PLA, un bioplástico vegetal/.test(await page.textContent('#detail-specs')), 'material con el texto acordado');
  if (SALIDA) await page.screenshot({ path: path.join(SALIDA, 'ficha.png') });
  await page.click('#detail-form button[type=submit]');
  ok(await page.textContent('#bag-count') === '1', 'sumar desde la ficha pone 1 en la bolsa');
  await page.click('#bag-button'); await page.click('#preview-order');
  ok(/1 × Fidget Cube Toy|Fidget Cube Toy/.test(await page.textContent('#order-message')), 'el mensaje de WhatsApp lista la pieza');
  ok((await page.getAttribute('#whatsapp-link', 'href')).startsWith('https://wa.me/5491100000000?text='), 'el link usa el número del catálogo');
  await page.keyboard.press('Escape');

  await page.locator('.product-card', { hasText: 'Llavero Personalizado' }).locator('h3 button').click();
  ok(/Podés personalizar/.test(await page.textContent('#detail-specs')), '¿Para qué sirve? usa la descripción real cuando existe');
  await page.keyboard.press('Escape');
  ok(page.errores.length === 0, 'cero errores de consola (escenario 1)' + (page.errores.length ? ': ' + page.errores.join(' | ') : ''));

  // ---- escenario 2: enlace compartido ?pieza=Nombre ----
  const p2 = await paginaNueva(ctx, base, catalogoInventado(), '/?pieza=' + encodeURIComponent('Fidget Cube Toy'));
  await p2.waitForFunction(() => document.querySelector('#product-dialog')?.open, null, { timeout: 30000 });
  ok(/Fidget Cube Toy/.test(await p2.textContent('#detail-title')), '?pieza=Nombre abre la ficha de esa pieza');

  // ---- escenario 3: admin (destacadas, videos del hero, demo en gif) ----
  const j3 = catalogoInventado();
  j3.catalogo.piezas.forEach((x) => { if (x.nome === 'Tortuga Articulada' || x.nome === 'Cono fidget toy') x.destacada = true; });
  j3.catalogo.piezas.find((x) => x.nome === 'Tortuga Articulada').video = 'https://ejemplo.test/demo.gif';
  j3.catalogo.hero = { v1: 'https://ejemplo.test/uno.mp4', v2: 'https://ejemplo.test/dos.mp4' };
  const p3 = await paginaNueva(ctx, base, j3, '/?pieza=' + encodeURIComponent('Tortuga Articulada'));
  await p3.waitForFunction(() => document.querySelector('#product-dialog')?.open, null, { timeout: 30000 });
  await p3.waitForTimeout(800);
  const slides = await p3.locator('#showcase-track > *').count();
  ok(slides === 2, 'carrusel muestra solo las 2 piezas destacadas (' + slides + ')');
  ok((await p3.getAttribute('#hero-video', 'src')) === 'https://ejemplo.test/uno.mp4', 'hero usa el video 1 del admin');
  const vistas = await p3.locator('#detail-thumbs button').allTextContents();
  ok(vistas.at(-1) === 'Demo', 'la ficha suma la pestaña Demo para el gif (' + vistas.join(' | ') + ')');
  await p3.locator('#detail-thumbs button').last().click();
  ok((await p3.getAttribute('#detail-photo', 'src')) === 'https://ejemplo.test/demo.gif', 'la pestaña Demo muestra el gif');

  // ---- escenario 4: ya hay piezas de Navidad cargadas ----
  const j4 = catalogoInventado([pieza('Árbol de Navidad D3cor', { cat: 'D3cor', tags: 'navidad' })]);
  const p4 = await paginaNueva(ctx, base, j4);
  ok(await p4.locator('#holiday-section').isVisible(), 'con piezas navideñas aparece la sección de Navidad');
  ok((await p4.textContent('#hero-cta-text')).trim() === 'Ver la Navidad D3cor', 'el botón del hero pasa a ofrecer la Navidad');
  await p4.click('#hero-cta');
  ok(await p4.locator('.product-card').count() === 1, 'el botón del hero abre solo las piezas navideñas');

  const todos = [page, p2, p3, p4];
  ok(todos.every((x) => x.errores.length === 0), 'cero errores de consola en los 4 escenarios');
  await browser.close(); srv.close();
  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo ok');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
