// Smoke de la página de prueba /catalogo/ con Playwright (del ambiente, no es dependencia del repo).
// Uso: node scripts/humo-catalogo.js [carpeta-de-capturas]
// Sube un servidor estático, intercepta el Apps Script (usa datos-ejemplo.json) y las fotos de Drive.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..');
const SALIDA = process.argv[2] || null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
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
  const ejemplo = fs.readFileSync(path.join(RAIZ, 'catalogo/datos-ejemplo.json'), 'utf8');
  const j = JSON.parse(ejemplo); j.catalogo.wa = '5491100000000';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.route('**/script.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) }));
  await page.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route('**/fonts.g*apis.com/**', (r) => r.abort());

  await page.goto(base + '/catalogo/');
  await page.waitForSelector('html[data-listo="1"]');
  ok(await page.locator('.product-card').count() === 16, 'primera página con 16 tarjetas');
  ok(/43 piezas/.test(await page.textContent('#result-count')), 'contador dice 43 piezas');
  ok(await page.locator('#seccion-navidad').isHidden(), 'sección Navidad oculta sin piezas navideñas');
  ok(await page.locator('[data-category="navidad"]').isHidden(), 'filtro Navidad oculto');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'sin scroll horizontal a 390px');
  if (SALIDA) await page.screenshot({ path: path.join(SALIDA, 'inicio.png') });

  // filtro por línea
  await page.click('[data-category="3corn"]');
  const n3 = await page.locator('.product-card').count();
  ok(n3 >= 1 && n3 < 10, '3corn & Deco filtra (' + n3 + ' piezas)');
  await page.click('[data-category="todos"]');

  // ficha al hacer clic
  const cubo = page.locator('.product-card', { hasText: 'Fidget Cube Toy' });
  await cubo.locator('h3 button').click();
  ok(await page.locator('#product-dialog').evaluate((d) => d.open), 'la ficha abre al clicar la pieza');
  const specs = await page.locator('#detail-specs dt').allTextContents();
  ok(specs.includes('Material') && specs.includes('¿Para qué sirve?'), 'ficha con info (' + specs.join(' / ') + ')');
  const tabs = await page.locator('#view-tabs button').allTextContents();
  ok(tabs.join('|') === '1. Limpia|2. En mano|3. En uso', 'Fidget Cube tiene las 3 vistas');
  await page.click('#view-tabs button:nth-child(2)');
  ok(await page.locator('#view-tabs button:nth-child(2)').getAttribute('aria-pressed') === 'true', 'pestaña 2 queda activa');
  if (SALIDA) await page.screenshot({ path: path.join(SALIDA, 'ficha.png') });
  await page.click('#detail-form button[type=submit]');
  ok(await page.textContent('#bag-count') === '1', 'sumar desde la ficha pone 1 en la bolsa');

  // stepper en tarjeta y bolsa
  await cubo.locator('.stepper-button').last().click();
  ok(await page.textContent('#bag-count') === '2', 'stepper + sube a 2');
  await page.click('#bag-button');
  ok(await page.locator('.bag-row').count() === 1, 'la bolsa tiene 1 fila');
  await page.click('#preview-order');
  const msg = await page.textContent('#order-message');
  ok(/2 × Fidget Cube Toy · \$9\.998/.test(msg), 'mensaje de WhatsApp con total correcto');
  ok((await page.getAttribute('#whatsapp-link', 'href')).startsWith('https://wa.me/5491100000000?text='), 'link de WhatsApp usa el número del catálogo');
  if (SALIDA) await page.screenshot({ path: path.join(SALIDA, 'bolsa.png') });
  await page.keyboard.press('Escape');

  // búsqueda
  await page.click('#search-toggle'); await page.fill('#search-input', 'cerebro');
  ok(await page.locator('.product-card').count() === 1, 'búsqueda sin tildes: "cerebro" encuentra "Cérebro" la pieza (' + await page.locator('.product-card').count() + ')');
  await page.keyboard.press('Escape');

  // pieza personalizable muestra el campo
  await page.fill('#search-input', '').catch(() => {});
  await page.reload(); await page.waitForSelector('html[data-listo="1"]');
  await page.click('#search-toggle'); await page.fill('#search-input', 'llavero 2 clickers nombre');
  await page.locator('.product-card h3 button').first().click();
  ok(await page.locator('#detail-name-label').isVisible(), 'pieza personalizable muestra el campo de nombre');

  ok(errores.length === 0, 'cero errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));

  // sin número de WhatsApp: no aparecen botones de contacto
  const p2 = await ctx.newPage(); const j2 = JSON.parse(ejemplo);
  await p2.route('**/script.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j2) }));
  await p2.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p2.goto(base + '/catalogo/'); await p2.waitForSelector('html[data-listo="1"]');
  ok(await p2.locator('#whatsapp-float').isHidden() && await p2.locator('#contact-link').isHidden(), 'sin número no se muestran botones de WhatsApp');

  // servidor caído: cae a los datos de ejemplo
  const p3 = await ctx.newPage();
  await p3.route('**/script.google.com/**', (r) => r.abort());
  await p3.route('**/lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p3.goto(base + '/catalogo/'); await p3.waitForSelector('html[data-listo="1"]', { timeout: 20000 });
  ok(await p3.locator('.product-card').count() === 16, 'con el servidor caído muestra los datos de ejemplo');

  await browser.close(); srv.close();
  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo ok');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
