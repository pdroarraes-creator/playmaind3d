// Smoke de /catalogo/ con Playwright (del ambiente, no es dependencia del repo).
// Uso: node scripts/humo-catalogo.js [carpeta-de-capturas]
// Lee el catálogo real (Apps Script, GET público); las fotos de Drive se reemplazan por un PNG.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..'), SALIDA = process.argv[2] || null;
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp4': 'video/mp4', '.gif': 'image/gif', '.png': 'image/png', '.json': 'application/json' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route('**/fonts.g*apis.com/**', (r) => r.abort());
  await page.goto(base + '/');
  await page.waitForSelector('.product-card', { timeout: 30000 });
  ok(await page.locator('.product-card').count() === 16, 'primera página con 16 tarjetas reales');
  ok(/D3cor/.test(await page.textContent('#hero-title')), 'el hero habla de la novedad D3cor (Navidad)');
  await page.click('.hero .button.primary');
  const nDeco = await page.locator('.product-card').count();
  ok(nDeco >= 1 && nDeco < 16 && (await page.locator('[data-category="deco"]').getAttribute('aria-pressed')) === 'true', 'el botón del hero abre la línea D3cor con piezas (' + nDeco + ')');
  await page.click('[data-category="todos"]');
  ok(await page.locator('meta[name=robots]').count() === 0, 'sin noindex: la página se puede indexar');
  ok(await page.getAttribute('link[rel=canonical]', 'href') === 'https://playmind3d.com/', 'canonical apunta al dominio');
  ok(/\d+ piezas/.test(await page.textContent('#result-count')), 'contador de piezas');
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

  await page.locator('.product-card', { hasText: 'Llavero 2 Clickers Nombre' }).locator('h3 button').click();
  ok(/Podés personalizar/.test(await page.textContent('#detail-specs')) , '¿Para qué sirve? usa la descripción real cuando existe');
  // enlace compartido ?pieza=Nombre abre la ficha
  const p2 = await page.context().newPage();
  await p2.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p2.route('**/fonts.g*apis.com/**', (r) => r.abort());
  await p2.goto(base + '/?pieza=' + encodeURIComponent('Fidget Cube Toy'));
  await p2.waitForFunction(() => document.querySelector('#product-dialog')?.open, null, { timeout: 30000 });
  ok(/Fidget Cube Toy/.test(await p2.textContent('#detail-title')), '?pieza=Nombre abre la ficha de esa pieza');
  // admin: destacadas en el carrusel, videos del hero y demo en gif dentro de la ficha
  const p3 = await page.context().newPage();
  await p3.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p3.route('**/fonts.g*apis.com/**', (r) => r.abort());
  const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  await p3.route('https://ejemplo.test/**', (r) => (/\.gif$/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: 'image/gif', body: GIF })
    : r.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(path.join(RAIZ, 'catalogo/assets/studio-hero.mp4')) })));
  await p3.route('**/script.google.com/**', async (r) => {
    const resp = await r.fetch(); const j = await resp.json();
    j.catalogo.piezas.forEach((x) => { if (x.nome === 'Tortuga Articulada' || x.nome === 'Cono fidget toy') x.destacada = true; });
    j.catalogo.piezas.find((x) => x.nome === 'Tortuga Articulada').video = 'https://ejemplo.test/demo.gif';
    j.catalogo.hero = { v1: 'https://ejemplo.test/uno.mp4', v2: 'https://ejemplo.test/dos.mp4' };
    r.fulfill({ response: resp, json: j });
  });
  await p3.goto(base + '/?pieza=' + encodeURIComponent('Tortuga Articulada')); await p3.waitForSelector('.product-card', { timeout: 30000 });
  await p3.waitForFunction(() => document.querySelector('#product-dialog')?.open, null, { timeout: 30000 });
  await p3.waitForTimeout(800);
  const slides = await p3.locator('#showcase-track > *').count();
  ok(slides === 2, 'carrusel muestra solo las 2 piezas destacadas (' + slides + ')');
  ok((await p3.getAttribute('#hero-video', 'src')) === 'https://ejemplo.test/uno.mp4', 'hero usa el video 1 del admin');
  const vistas = await p3.locator('#detail-thumbs button').allTextContents();
  ok(vistas.at(-1) === 'Demo', 'la ficha suma la pestaña Demo para el gif (' + vistas.join(' | ') + ')');
  await p3.locator('#detail-thumbs button').last().click();
  ok((await p3.getAttribute('#detail-photo', 'src')) === 'https://ejemplo.test/demo.gif', 'la pestaña Demo muestra el gif');
  ok(errores.length === 0, 'cero errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo ok');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
