import { CATEGORIAS, adaptarCatalogo, linkWhatsApp, pedirCatalogo, totalesPedido } from './catalog-api.mjs';
import { textoDeBusqueda } from './catalog-logic.mjs';
import { introFinished } from './intro.mjs';
import { renderShowcase } from './showcase.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0, minimumGroupingDigits: 1 });
const formatPrice = (value) => `$${money.format(value)}`;
const fallbackImage = './assets/logo-mark.webp';
const image = (product, index = 0) => product.fotos[index] ?? fallbackImage;
const cacheKey = 'pm3d-catalogo-v2';
const bagKey = 'pm3d-bolsa-v1';
const pageSize = 16;
const maxCount = 99;
const bag = [];
const filters = [...document.querySelectorAll('[data-category]')];
const stockFilter = $('#stock-filter');
const grid = $('#product-grid');
const detail = $('#product-dialog');
const drawer = $('#bag-dialog');
const search = $('#search-input');
let productos = [];
let colores = [];
let reglas = [];
let whatsapp = '';
let loaded = false;
let bagRestored = false;
let lastCatalog = '';
let category = 'todos';
let holiday = false;
let onlyStock = false;
let page = 0;
let activeProduct;
let detailTrigger;
let toastTimer;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

function iconButton(name, label, className, onClick) {
  const button = element('button', undefined, className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(icon(name));
  button.addEventListener('click', onClick);
  return button;
}

function setPhoto(img, src) {
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => { img.src = fallbackImage; }, { once: true });
  img.src = src;
}

function pulse(node) {
  if (!node) return;
  node.classList.remove('is-pulsing');
  void node.offsetWidth;
  node.classList.add('is-pulsing');
}

function tagList(product, root) {
  const tags = [...(product.navidad ? ['Navidad'] : []), ...product.tags, ...(product.video ? ['Video'] : [])];
  root.replaceChildren(...tags.map((tag) => element('span', tag, `tag${tag === 'Navidad' ? ' holiday-tag' : ''}${tag === 'Video' ? ' video-tag' : ''}`)));
}

const productCount = (product) => bag.reduce((total, item) => total + (item.product.id === product.id ? item.count : 0), 0);

function stepper(count, label, onMinus, onPlus) {
  const control = element('div', undefined, 'stepper');
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', label);
  const value = element('span', String(count), 'stepper-value');
  value.setAttribute('aria-live', 'polite');
  const plus = iconButton('icon-plus', `Sumar uno más de ${label}`, 'stepper-button', onPlus);
  plus.disabled = count >= maxCount;
  control.append(iconButton('icon-minus', `Quitar uno de ${label}`, 'stepper-button', onMinus), value, plus);
  return control;
}

function renderControl(card, product, focus) {
  const slot = $('[data-control]', card);
  const count = productCount(product);
  if (count === 0) {
    const add = element('button', undefined, 'add-button');
    add.type = 'button';
    add.setAttribute('aria-label', `Sumar ${product.nombre} a la bolsa`);
    add.append(icon('icon-plus'), element('span', 'Sumar'));
    add.addEventListener('click', () => changeFromCard(product, 1, 'plus'));
    slot.replaceChildren(add);
    if (focus) add.focus();
    return add;
  }
  const control = stepper(count, product.nombre, () => changeFromCard(product, -1, 'minus'), () => changeFromCard(product, 1, 'plus'));
  slot.replaceChildren(control);
  if (focus) $(`.stepper-button:${focus === 'minus' ? 'first-of-type' : 'last-of-type'}`, control).focus();
  return control;
}

function refreshCards(product, focus) {
  const card = grid.querySelector(`[data-product="${product.id}"]`);
  if (card) pulse(renderControl(card, product, focus));
}

function changeFromCard(product, delta, focus) {
  if (delta > 0) addToBag(product, '', '', focus);
  else {
    const index = bag.findLastIndex((item) => item.product.id === product.id);
    if (index !== -1) changeRow(index, -1, focus);
  }
}

function productCard(product, index) {
  const fragment = $('#product-template').content.cloneNode(true);
  const card = $('.product-card', fragment);
  card.dataset.product = product.id;
  card.style.setProperty('--i', String(index % 4));
  const img = $('img', card);
  if (index > 3) img.loading = 'lazy';
  setPhoto(img, image(product));
  const media = $('.product-media', card);
  media.setAttribute('aria-label', `Ver detalles: ${product.nombre}`);
  const title = $('h3 button', card);
  title.textContent = product.nombre;
  for (const trigger of [media, title]) trigger.addEventListener('click', () => openDetail(product, trigger));
  tagList(product, $('[data-tags]', card));
  $('[data-trait]', card).textContent = product.rasgo;
  $('[data-product-category]', card).textContent = CATEGORIAS[product.linea];
  $('[data-price]', card).textContent = formatPrice(product.precio);
  renderControl(card, product);
  return fragment;
}

function renderCatalog() {
  const query = textoDeBusqueda(search.value);
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  stockFilter.setAttribute('aria-pressed', String(onlyStock));
  if (!loaded) return;
  const results = productos.filter((product) =>
    (category === 'todos' || product.linea === category) &&
    (!holiday || product.navidad) &&
    (!onlyStock || product.stock > 0) &&
    textoDeBusqueda(`${product.nombre} ${CATEGORIAS[product.linea]} ${product.tags.join(' ')} ${product.busqueda} ${product.rasgo}`).includes(query));
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  page = Math.min(pageCount - 1, Math.max(0, page));
  grid.replaceChildren(...results.slice(page * pageSize, (page + 1) * pageSize).map(productCard));
  for (const card of grid.children) revealObserver?.observe(card);
  $('#result-count').textContent = `${results.length} ${results.length === 1 ? 'pieza' : 'piezas'}`;
  $('#empty-catalog').hidden = results.length !== 0;
  $('#pagination').hidden = pageCount === 1;
  $('#page-label').textContent = `${page + 1} de ${pageCount}`;
  $('#page-prev').disabled = page === 0;
  $('#page-next').disabled = page + 1 === pageCount;
  $('#catalog-title').textContent = holiday ? 'Especial Navidad' : 'Elegí tu pieza';
}

function setCategory(next, onlyHoliday = false) {
  category = next;
  holiday = onlyHoliday;
  page = 0;
  renderCatalog();
}

function focusCatalog() {
  const heading = $('#catalog-title');
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

function setSearch(open, returnFocus = true) {
  const toggle = $('#search-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar búsqueda' : 'Abrir búsqueda');
  const panel = $('#search-panel');
  panel.classList.toggle('is-open', open);
  panel.inert = !open;
  if (open) search.focus();
  else {
    if (search.value) {
      search.value = '';
      page = 0;
      renderCatalog();
    }
    if (returnFocus) toggle.focus();
  }
}

for (const button of filters) button.addEventListener('click', () => setCategory(button.dataset.category));
stockFilter.addEventListener('click', () => { onlyStock = !onlyStock; page = 0; renderCatalog(); });
for (const link of document.querySelectorAll('[data-category-link]')) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setSearch(false, false);
    setCategory(link.dataset.categoryLink, link.hasAttribute('data-holiday-link'));
    focusCatalog();
  });
}
$('#reset-catalog').addEventListener('click', () => {
  search.value = '';
  onlyStock = false;
  setCategory('todos');
  focusCatalog();
});
for (const [id, delta] of [['#page-prev', -1], ['#page-next', 1]]) {
  $(id).addEventListener('click', () => { page += delta; renderCatalog(); focusCatalog(); });
}
$('#search-toggle').addEventListener('click', () => setSearch($('#search-panel').inert));
$('#search-close').addEventListener('click', () => setSearch(false));
$('#search-form').addEventListener('submit', (event) => { event.preventDefault(); focusCatalog(); });
search.addEventListener('input', () => { page = 0; renderCatalog(); });
search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    setSearch(false);
  }
});

function showPhoto(index) {
  const photo = $('#detail-photo');
  const total = activeProduct.fotos.length;
  setPhoto(photo, image(activeProduct, index));
  photo.alt = total > 1 ? `${activeProduct.nombre}, foto ${index + 1} de ${total}` : activeProduct.nombre;
  for (const [i, thumb] of [...$('#detail-thumbs').children].entries()) thumb.setAttribute('aria-pressed', String(i === index));
}

function openDetail(product, trigger) {
  activeProduct = product;
  detailTrigger = trigger;
  const show = () => {
    $('#detail-title').textContent = product.nombre;
    $('#detail-trait').textContent = product.rasgo;
    $('#detail-price').textContent = `${formatPrice(product.precio)} ARS`;
    tagList(product, $('#detail-tags'));
    const video = $('#video-link');
    video.hidden = !product.video;
    if (product.video) video.href = product.video;
    else video.removeAttribute('href');
    const thumbs = $('#detail-thumbs');
    thumbs.hidden = product.fotos.length < 2;
    thumbs.replaceChildren(...product.fotos.map((foto, index) => {
      const thumb = element('button');
      thumb.type = 'button';
      thumb.setAttribute('aria-label', `Ver foto ${index + 1} de ${product.fotos.length}`);
      const img = element('img');
      img.alt = '';
      img.width = 56;
      img.height = 56;
      setPhoto(img, foto);
      thumb.append(img);
      thumb.addEventListener('click', () => showPhoto(index));
      return thumb;
    }));
    showPhoto(0);
    const specs = [
      ['Detalle', product.detalle], ['Disponibilidad', product.disponibilidad],
      ['Tamaño real', product.medida], ['Tiempo de impresión', product.tiempo], ['Material', 'PLA vegetal'],
    ].filter(([, value]) => value);
    $('#detail-specs').replaceChildren(...specs.map(([label, value]) => {
      const entry = element('div');
      entry.append(element('dt', label), element('dd', value));
      return entry;
    }));
    const color = $('#detail-color');
    color.replaceChildren(new Option('El que quieras', ''), ...colores.map((nombre) => new Option(nombre, nombre)));
    $('#detail-color-field').hidden = !product.libre || colores.length === 0;
    $('#detail-name').value = '';
    detail.showModal();
    $('#detail-title').focus({ preventScroll: true });
    detail.scrollTop = 0;
  };
  show();
}

$('#detail-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!activeProduct) return;
  const color = $('#detail-color-field').hidden ? '' : $('#detail-color').value;
  addToBag(activeProduct, color, $('#detail-name').value.trim());
  detail.close();
});
detail.addEventListener('close', () => detailTrigger?.focus({ preventScroll: true }));

function announce(text) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('is-visible');
  $('#bag-status').textContent = text;
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function addToBag(product, color, note, focus) {
  const row = bag.find((item) => item.product.id === product.id && item.color === color && item.note === note);
  if (row) row.count = Math.min(maxCount, row.count + 1);
  else bag.push({ product, color, note, count: 1 });
  afterBagChange(product, focus);
  announce(`${product.nombre}: agregado a tu bolsa`);
}

function changeRow(index, delta, focus) {
  const item = bag[index];
  if (!item) return;
  item.count = Math.min(maxCount, item.count + delta);
  if (item.count <= 0) {
    bag.splice(index, 1);
    announce(`${item.product.nombre}: quitado de tu bolsa`);
  }
  afterBagChange(item.product, focus);
}

function afterBagChange(product, focus) {
  persistBag();
  renderBag();
  refreshCards(product, focus);
  pulse($('#bag-button'));
}

const rowTotal = (item) => item.count * item.product.precio;
const totals = () => totalesPedido(bag.map((item) => ({ nombre: item.product.nombre, precio: item.product.precio, cantidad: item.count })), reglas);
const colorLabel = (item) => item.color || (item.product.libre && colores.length ? 'el que quieras' : '');

function focusBagRow(index, selector) {
  const rows = $('#bag-list').children;
  const target = rows[Math.min(index, rows.length - 1)];
  ($(selector, target ?? document) ?? $('#bag-empty button')).focus();
}

function persistBag() {
  try {
    localStorage.setItem(bagKey, JSON.stringify(bag.map(({ product, color, note, count }) => ({ id: product.id, color, note, count }))));
  } catch {}
}

function restoreBag(byId) {
  try {
    const saved = JSON.parse(localStorage.getItem(bagKey) || '[]');
    if (!Array.isArray(saved)) return;
    for (const entry of saved) {
      const product = byId.get(entry?.id);
      if (!product || !Number.isInteger(entry.count) || entry.count < 1) continue;
      const color = typeof entry.color === 'string' && colores.includes(entry.color) ? entry.color : '';
      const note = typeof entry.note === 'string' ? entry.note.slice(0, 60) : '';
      bag.push({ product, color, note, count: Math.min(maxCount, entry.count) });
    }
  } catch {}
}

function renderBag() {
  const order = totals();
  const count = order.unidades;
  const mobileOrderBar = $('#mobile-order-bar');
  mobileOrderBar.hidden = count === 0;
  $('#mobile-order-count').textContent = `${count} ${count === 1 ? 'artículo' : 'artículos'}`;
  $('#mobile-order-total').textContent = formatPrice(order.total);
  mobileOrderBar.setAttribute('aria-label', `Ver pedido: ${count} ${count === 1 ? 'artículo' : 'artículos'}, total ${formatPrice(order.total)}`);
  const discount = $('#bag-discount');
  discount.hidden = !order.descuento && !order.falta;
  if (order.descuento) discount.textContent = `Descuento ${order.regla.off}%: −${formatPrice(order.descuento)}`;
  else if (order.falta) discount.textContent = `Sumá ${order.falta.unidades} más y tenés ${order.falta.off}% de descuento.`;
  $('#bag-count').textContent = count;
  $('#bag-button').setAttribute('aria-label', `Bolsa, ${count} ${count === 1 ? 'artículo' : 'artículos'}`);
  $('#bag-button').classList.toggle('has-items', count > 0);
  $('#bag-empty').hidden = Boolean(bag.length);
  $('#bag-summary').hidden = !bag.length || !$('#order-preview').hidden;
  $('#bag-total').textContent = `${formatPrice(order.total)} ARS`;
  $('#bag-list').replaceChildren(...bag.map((item, index) => {
    const row = element('li', undefined, 'bag-row');
    const img = element('img');
    setPhoto(img, image(item.product));
    img.alt = '';
    img.width = 64;
    img.height = 64;
    const info = element('div', undefined, 'bag-info');
    const top = element('div', undefined, 'bag-row-top');
    top.append(element('h3', item.product.nombre), iconButton('icon-trash', `Eliminar ${item.product.nombre} de la bolsa`, 'remove-button', () => {
      bag.splice(index, 1);
      afterBagChange(item.product);
      announce(`${item.product.nombre}: quitado de tu bolsa`);
      focusBagRow(index, '.remove-button');
    }));
    info.append(top);
    if (colorLabel(item)) info.append(element('p', `Color: ${colorLabel(item)}`, 'bag-meta'));
    if (item.note) info.append(element('p', `Aclaración: ${item.note}`, 'bag-meta'));
    const bottom = element('div', undefined, 'bag-row-bottom');
    bottom.append(
      stepper(item.count, item.product.nombre, () => {
        const removes = item.count === 1;
        changeRow(index, -1);
        focusBagRow(index, removes ? '.remove-button' : '.stepper-button');
      }, () => {
        changeRow(index, 1);
        focusBagRow(index, '.stepper-button:last-of-type');
      }),
      element('strong', formatPrice(rowTotal(item))),
    );
    info.append(bottom);
    row.append(img, info);
    return row;
  }));
}

function showOrderPreview(show) {
  $('#order-preview').hidden = !show;
  $('#bag-content').hidden = show;
  $('#bag-summary').hidden = show || !bag.length;
  if (show) {
    const order = totals();
    const lines = bag.map((item) => `• ${item.count}x ${item.product.nombre}${colorLabel(item) ? ` (${colorLabel(item)})` : ''} — ${formatPrice(rowTotal(item))}${item.note ? `\n  Aclaración: ${item.note}` : ''}`);
    const message = [
      '¡Hola PlayMind 3D! Quiero hacer este pedido:', '', ...lines, '',
      ...(order.descuento ? [`Descuento (${order.regla.off}%): −${formatPrice(order.descuento)}`] : []),
      `Total: ${formatPrice(order.total)} ARS`, '¿Coordinamos el envío o retiro?',
    ].join('\n');
    $('#order-message').textContent = message;
    setLink($('#whatsapp-link'), linkWhatsApp(whatsapp, message));
    $('#preview-title').focus();
  } else if (drawer.open) $('#preview-order').focus();
}

$('#bag-button').addEventListener('click', () => {
  showOrderPreview(false);
  renderBag();
  drawer.showModal();
  $('#bag-title').focus();
});
$('#mobile-order-bar').addEventListener('click', () => $('#bag-button').click());
$('#preview-order').addEventListener('click', () => showOrderPreview(true));
$('#back-to-bag').addEventListener('click', () => showOrderPreview(false));
drawer.addEventListener('close', () => $('#bag-button').focus());
for (const dialog of [detail, drawer]) {
  for (const button of dialog.querySelectorAll('[data-close]')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const { top, bottom, left, right } = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
  });
}

function setLink(link, href) {
  link.hidden = !href;
  if (href) link.href = href;
  else link.removeAttribute('href');
}

function applyCatalog(raw) {
  ({ productos, reglas, colores, whatsapp } = adaptarCatalogo(raw));
  loaded = true;
  const byId = new Map(productos.map((product) => [product.id, product]));
  if (!bagRestored) {
    restoreBag(byId);
    bagRestored = true;
  }
  for (let index = bag.length - 1; index >= 0; index--) {
    const current = byId.get(bag[index].product.id);
    if (current) bag[index].product = current;
    else bag.splice(index, 1);
  }
  persistBag();
  stockFilter.hidden = !productos.some((product) => product.stock > 0);
  if (stockFilter.hidden) onlyStock = false;
  const hasHoliday = productos.some((product) => product.navidad);
  if (!hasHoliday) holiday = false;
  $('#holiday-section').hidden = !hasHoliday;
  for (const link of document.querySelectorAll('[data-holiday-link]')) (link.closest('li') ?? link).hidden = !hasHoliday;
  const contactHref = linkWhatsApp(whatsapp, '¡Hola PlayMind 3D! Tengo una consulta sobre el catálogo.');
  for (const link of [$('#contact-link'), $('#whatsapp-float')]) setLink(link, contactHref);
  renderShowcase(productos, { openDetail, formatPrice, setPhoto, icon });
  renderCatalog();
  renderBag();
}

async function loadCatalog() {
  $('#catalog-error').hidden = true;
  if (!loaded) {
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        applyCatalog(JSON.parse(saved));
        lastCatalog = saved;
      }
    } catch {}
  }
  if (!loaded) $('#result-count').textContent = 'Cargando piezas…';
  try {
    const raw = await pedirCatalogo();
    const fresh = JSON.stringify(raw);
    if (fresh === lastCatalog) return;
    lastCatalog = fresh;
    applyCatalog(raw);
    try { localStorage.setItem(cacheKey, fresh); } catch {}
  } catch {
    if (loaded) return;
    $('#result-count').textContent = '';
    $('#catalog-error').hidden = false;
  }
}
$('#retry-catalog').addEventListener('click', loadCatalog);

function splitWords(root) {
  let index = 0;
  const wrap = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) { wrap(child); continue; }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
      const pieces = child.textContent.split(/(\s+)/).map((piece) => {
        if (!piece.trim()) return document.createTextNode(piece);
        const word = element('span', undefined, 'word');
        const inner = element('span', piece);
        word.style.setProperty('--w', String(index++));
        word.append(inner);
        return word;
      });
      child.replaceWith(...pieces);
    }
  };
  root.setAttribute('aria-label', root.textContent.trim());
  wrap(root);
  for (const word of root.querySelectorAll('.word')) word.setAttribute('aria-hidden', 'true');
}

const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const revealObserver = motionOk && 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' })
  : null;

if (revealObserver) {
  document.documentElement.classList.add('motion');
  for (const heading of document.querySelectorAll('[data-reveal]')) {
    splitWords(heading);
    if (heading.closest('.hero')) introFinished.then(() => revealObserver.observe(heading));
    else revealObserver.observe(heading);
  }
  for (const node of document.querySelectorAll('.benefits li, .showcase')) revealObserver.observe(node);
}

const heroVideo = document.getElementById('hero-video');
const heroVideoToggle = document.getElementById('hero-video-toggle');
const syncVideoToggle = () => {
  const paused = heroVideo.paused;
  heroVideoToggle.setAttribute('aria-pressed', String(paused));
  heroVideoToggle.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
  heroVideoToggle.querySelector('use').setAttribute('href', paused ? '#icon-play' : '#icon-pause');
};
heroVideo.addEventListener('play', syncVideoToggle);
heroVideo.addEventListener('pause', syncVideoToggle);
heroVideoToggle.addEventListener('click', () => {
  if (heroVideo.paused) heroVideo.play().catch(() => {});
  else heroVideo.pause();
});
if (!motionOk) heroVideo.pause();
introFinished.then(() => {
  if (!motionOk) return;
  heroVideo.currentTime = 0;
  heroVideo.play().catch(() => {});
});
syncVideoToggle();

renderBag();
loadCatalog();
