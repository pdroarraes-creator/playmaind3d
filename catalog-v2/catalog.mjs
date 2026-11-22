import { CATEGORIAS, PRODUCTOS, PACKS } from './storefront-data.mjs';
import { linkWA, textoDeBusqueda } from './catalog-logic.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0, minimumGroupingDigits: 1 });
const formatPrice = (value) => `$${money.format(value)}`;
const image = (name) => `./assets/${name}.webp`;
const defaultPack = (product) => PACKS.find(({ unidades }) => unidades === (product.pack ?? 1));
const packPrice = (product, pack) => Math.round(product.precio * pack.unidades * (100 - pack.descuento) / 100);
const pageSize = 16;
const colors = new Map();
const bag = [];
const filters = [...document.querySelectorAll('[data-category]')];
const grid = $('#product-grid');
const detail = $('#product-dialog');
const drawer = $('#bag-dialog');
const search = $('#search-input');
let category = 'todos';
let holiday = false;
let page = 0;
let activeProduct;
let detailTrigger;
let detailColor;
let toastTimer;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function selectSwatch(group, name) {
  for (const button of group.querySelectorAll('.swatch')) {
    button.setAttribute('aria-pressed', String(button.dataset.color === name));
  }
}

function swatches(product, selected, onChange) {
  const group = element('div', undefined, 'swatches');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `Colores de ${product.nombre}`);
  for (const color of product.colores) {
    const button = element('button', undefined, 'swatch');
    button.type = 'button';
    button.dataset.color = color.nombre;
    button.setAttribute('aria-pressed', String(color.nombre === selected.nombre));
    button.setAttribute('aria-label', color.nombre);
    button.title = color.nombre;
    button.style.setProperty('--swatch', color.hex);
    button.append(element('span'));
    button.addEventListener('click', () => {
      selectSwatch(group, color.nombre);
      onChange(color);
    });
    group.append(button);
  }
  return group;
}

function productCard(product, index) {
  const fragment = $('#product-template').content.cloneNode(true);
  const card = $('.product-card', fragment);
  card.dataset.product = product.id;
  const img = $('img', card);
  if (index > 3) img.loading = 'lazy';
  img.src = image(product.id);
  const media = $('.product-media', card);
  media.setAttribute('aria-label', `Ver detalles: ${product.nombre}`);
  const title = $('h3 button', card);
  title.textContent = product.nombre;
  for (const trigger of [media, title]) trigger.addEventListener('click', () => openDetail(product, trigger));
  const badge = $('[data-badge]', card);
  if (product.navidad || product.demo) {
    badge.hidden = false;
    badge.textContent = product.navidad ? 'Navidad' : '▷ Video';
    badge.classList.toggle('holiday-tag', Boolean(product.navidad));
  }
  const pack = defaultPack(product);
  $('[data-product-category]', card).textContent = CATEGORIAS[product.linea];
  $('[data-price]', card).textContent = `${formatPrice(packPrice(product, pack))}${product.pack ? ` · x${product.pack}` : ''}`;
  $('[data-colors]', card).append(swatches(product, colors.get(product.id) ?? product.colores[0], (color) => colors.set(product.id, color)));
  const add = $('[data-add]', card);
  add.setAttribute('aria-label', `Sumar ${product.nombre} a la bolsa`);
  add.addEventListener('click', () => addToBag(product, colors.get(product.id) ?? product.colores[0], pack, ''));
  return fragment;
}

function renderCatalog() {
  const query = textoDeBusqueda(search.value);
  const results = PRODUCTOS.filter((product) =>
    (category === 'todos' || product.linea === category) &&
    (!holiday || product.navidad) &&
    textoDeBusqueda(`${product.nombre} ${CATEGORIAS[product.linea]}`).includes(query));
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  page = Math.min(pageCount - 1, Math.max(0, page));
  grid.replaceChildren(...results.slice(page * pageSize, (page + 1) * pageSize).map(productCard));
  $('#result-count').textContent = `${results.length} ${results.length === 1 ? 'pieza' : 'piezas'}`;
  $('#empty-catalog').hidden = results.length !== 0;
  $('#pagination').hidden = pageCount === 1;
  $('#page-label').textContent = `${page + 1} de ${pageCount}`;
  $('#page-prev').disabled = page === 0;
  $('#page-next').disabled = page + 1 === pageCount;
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  $('#catalog-title').textContent = holiday ? 'Packs navideños' : 'Elegí tu pieza';
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

function updateDetailPrice() {
  const pack = PACKS.find(({ unidades }) => unidades === Number($('#detail-pack').value));
  $('#detail-price').textContent = `${formatPrice(packPrice(activeProduct, pack))} ARS`;
}

function setDemo(playing) {
  const button = $('#demo-toggle');
  const photo = $('#detail-photo');
  button.setAttribute('aria-pressed', String(playing));
  $('span', button).textContent = playing ? 'Pausar demo' : 'Ver demo';
  photo.src = image(playing ? activeProduct.demo : activeProduct.id);
  photo.alt = playing ? `Demostración en bucle de ${activeProduct.nombre}` : activeProduct.nombre;
}

function openDetail(product, trigger) {
  activeProduct = product;
  detailTrigger = trigger;
  detailColor = colors.get(product.id) ?? product.colores[0];
  $('#detail-title').textContent = product.nombre;
  $('#demo-toggle').hidden = !product.demo;
  setDemo(false);
  const specs = [
    ['¿Para qué sirve?', product.uso], ['Tamaño real', product.medida],
    ['Tiempo de impresión', product.tiempo], ['Material', 'PLA vegetal'],
  ];
  $('#detail-specs').replaceChildren(...specs.map(([label, value]) => {
    const entry = element('div');
    entry.append(element('dt', label), element('dd', value));
    return entry;
  }));
  const label = element('div', `Color · ${detailColor.nombre}`, 'swatch-label');
  $('#detail-colors').replaceChildren(label, swatches(product, detailColor, (color) => {
    detailColor = color;
    colors.set(product.id, color);
    label.textContent = `Color · ${color.nombre}`;
    const cardSwatches = grid.querySelector(`[data-product="${product.id}"] .swatches`);
    if (cardSwatches) selectSwatch(cardSwatches, color.nombre);
  }));
  const select = $('#detail-pack');
  select.replaceChildren(...PACKS.map((pack) => new Option(pack.etiqueta, String(pack.unidades))));
  select.value = String(defaultPack(product).unidades);
  $('#detail-name').value = '';
  updateDetailPrice();
  detail.showModal();
  $('#detail-title').focus({ preventScroll: true });
  detail.scrollTop = 0;
}

$('#detail-pack').addEventListener('change', updateDetailPrice);
$('#demo-toggle').addEventListener('click', (event) => setDemo(event.currentTarget.getAttribute('aria-pressed') !== 'true'));
$('#detail-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const pack = PACKS.find(({ unidades }) => unidades === Number($('#detail-pack').value));
  if (!pack || !activeProduct) return;
  addToBag(activeProduct, detailColor, pack, $('#detail-name').value.trim());
  detail.close();
});
detail.addEventListener('close', () => { setDemo(false); detailTrigger?.focus({ preventScroll: true }); });

function addToBag(product, color, pack, note) {
  const row = bag.find((item) => item.product.id === product.id && item.color.nombre === color.nombre && item.pack.unidades === pack.unidades && item.note === note);
  if (row) row.count += 1;
  else bag.push({ product, color, pack, note, count: 1 });
  renderBag();
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = `${product.nombre}: agregado a tu bolsa`;
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 2600);
}

const rowTotal = (item) => item.count * packPrice(item.product, item.pack);
const subtotal = () => bag.reduce((total, item) => total + rowTotal(item), 0);
const rowQuantity = (item) => item.pack.unidades === 1 ? `${item.count} ${item.count === 1 ? 'unidad' : 'unidades'}` : `${item.count} × Pack x${item.pack.unidades} (−${item.pack.descuento}%)`;

function renderBag() {
  const count = bag.reduce((total, item) => total + item.count * item.pack.unidades, 0);
  $('#bag-count').textContent = count;
  $('#bag-button').setAttribute('aria-label', `Bolsa, ${count} ${count === 1 ? 'artículo' : 'artículos'}`);
  $('#bag-empty').hidden = Boolean(bag.length);
  $('#bag-summary').hidden = !bag.length;
  $('#bag-total').textContent = `${formatPrice(subtotal())} ARS`;
  $('#bag-list').replaceChildren(...bag.map((item, index) => {
    const row = element('li', undefined, 'bag-row');
    const img = element('img');
    img.src = image(item.product.id);
    img.alt = '';
    img.width = 56;
    img.height = 56;
    const info = element('div');
    const remove = element('button', 'Quitar');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Quitar ${item.product.nombre}`);
    remove.addEventListener('click', () => {
      bag.splice(index, 1);
      renderBag();
      ($('#bag-list button') ?? $('#bag-empty button')).focus();
    });
    info.append(element('h3', item.product.nombre), element('p', `${item.color.nombre} · ${rowQuantity(item)}`));
    if (item.note) info.append(element('p', `Personalización: ${item.note}`));
    info.append(remove);
    row.append(img, info, element('strong', formatPrice(rowTotal(item))));
    return row;
  }));
}

function showOrderPreview(show) {
  $('#order-preview').hidden = !show;
  $('#bag-content').hidden = show;
  $('#bag-summary').hidden = show || !bag.length;
  if (show) {
    const lines = bag.map((item) => `• ${item.product.nombre} — ${item.color.nombre} · ${rowQuantity(item)} — ${formatPrice(rowTotal(item))}${item.note ? `\n  Personalización: ${item.note}` : ''}`);
    const message = ['¡Hola PlayMind 3D! Quiero consultar por este pedido:', '', ...lines, '', `Subtotal: ${formatPrice(subtotal())} ARS`, '¿Coordinamos el envío o retiro?'].join('\n');
    $('#order-message').textContent = message;
    $('#whatsapp-link').href = linkWA(message);
    $('#preview-title').focus();
  } else if (drawer.open) $('#preview-order').focus();
}

$('#bag-button').addEventListener('click', () => {
  showOrderPreview(false);
  renderBag();
  drawer.showModal();
  $('#bag-title').focus();
});
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

renderCatalog();
renderBag();
