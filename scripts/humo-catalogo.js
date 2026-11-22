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
  await page.goto(base + '/catalogo/');
  await page.waitForSelector('.product-card', { timeout: 30000 });
  ok(await page.locator('.product-card').count() === 16, 'primera página con 16 tarjetas reales');
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
  ok(errores.length === 0, 'cero errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo ok');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
