const section = document.getElementById('showcase');
const track = document.getElementById('showcase-track');
const viewport = track.parentElement;
const previous = document.getElementById('showcase-prev');
const next = document.getElementById('showcase-next');
const dotsRoot = document.getElementById('showcase-dots');
const counter = document.getElementById('showcase-counter');
const swipeDistance = 48;
let slides = [];
let dots = [];
let current = 0;
let swipeStart = null;

function place(slide, state) {
  slide.classList.toggle('is-active', state === 'active');
  slide.classList.toggle('is-before', state === 'before');
  slide.classList.toggle('is-after', state === 'after');
  slide.inert = state !== 'active';
}

function syncControls() {
  dots.forEach((dot, index) => {
    if (index === current) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  counter.textContent = `Pieza ${current + 1} de ${slides.length}`;
}

function go(index, direction) {
  const total = slides.length;
  const target = (index + total) % total;
  if (!total || target === current) return;
  const dir = direction ?? (target > current ? 1 : -1);
  const incoming = slides[target];
  slides.forEach((slide, i) => { if (i !== current && i !== target) place(slide, dir > 0 ? 'after' : 'before'); });
  incoming.classList.add('is-snapping');
  place(incoming, dir > 0 ? 'after' : 'before');
  void incoming.offsetWidth;
  incoming.classList.remove('is-snapping');
  place(slides[current], dir > 0 ? 'before' : 'after');
  place(incoming, 'active');
  current = target;
  syncControls();
}

previous.addEventListener('click', () => go(current - 1, -1));
next.addEventListener('click', () => go(current + 1, 1));
section.addEventListener('keydown', (event) => {
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (event.target.closest('input, select, textarea')) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1, -1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1, 1); }
});
viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  swipeStart = { x: event.clientX, y: event.clientY };
});
viewport.addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < swipeDistance || Math.abs(dx) < Math.abs(dy) * 1.4) return;
  go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
});
viewport.addEventListener('pointercancel', () => { swipeStart = null; });

export function renderShowcase(products, { openDetail, formatPrice, setPhoto, renderControl, categoryOf }) {
  const eligible = products.filter((product) => product.fotos.length && !product.navidad);
  const isCurated = (product) => /(?:^|\s)vitrine(?:\s|$)/i.test(product.busqueda);
  const featured = [...eligible.filter(isCurated), ...eligible.filter((product) => !isCurated(product))].slice(0, 6);
  const keep = Math.min(current, Math.max(0, featured.length - 1));

  slides = featured.map((product, index) => {
    const slide = document.createElement('li');
    slide.className = 'showcase-slide';
    slide.dataset.product = product.id;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'diapositiva');
    slide.setAttribute('aria-label', `${index + 1} de ${featured.length}`);

    const card = document.createElement('article');
    card.className = 'showcase-card';

    const photoButton = document.createElement('button');
    photoButton.className = 'showcase-photo';
    photoButton.type = 'button';
    photoButton.setAttribute('aria-label', `Ver detalles: ${product.nombre}`);
    photoButton.addEventListener('click', () => openDetail(product, photoButton));
    const photo = document.createElement('img');
    photo.alt = '';
    photo.width = 480;
    photo.height = 480;
    photo.decoding = 'async';
    if (index > 0) photo.loading = 'lazy';
    setPhoto(photo, product.fotos[0]);
    photoButton.append(photo);

    const copy = document.createElement('div');
    copy.className = 'showcase-copy';
    const kicker = document.createElement('p');
    kicker.className = 'showcase-kicker';
    kicker.textContent = categoryOf(product);
    const title = document.createElement('h3');
    title.textContent = product.nombre;
    const trait = document.createElement('p');
    trait.className = 'showcase-trait';
    trait.textContent = product.rasgo;
    const tags = document.createElement('div');
    tags.className = 'tags showcase-tags';
    for (const tag of product.tags.slice(0, 4)) {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = tag;
      tags.append(chip);
    }
    const actions = document.createElement('div');
    actions.className = 'showcase-actions';
    const price = document.createElement('p');
    price.className = 'showcase-price';
    price.textContent = formatPrice(product.precio);
    const control = document.createElement('div');
    control.className = 'cart-control';
    control.dataset.control = '';
    const more = document.createElement('button');
    more.className = 'showcase-more';
    more.type = 'button';
    more.textContent = 'Ver ficha';
    more.setAttribute('aria-label', `Ver ficha de ${product.nombre}`);
    more.addEventListener('click', () => openDetail(product, more));
    actions.append(price, control, more);

    copy.append(kicker, title, trait);
    if (tags.children.length) copy.append(tags);
    copy.append(actions);
    card.append(photoButton, copy);
    slide.append(card);
    renderControl(slide, product);
    return slide;
  });

  slides.forEach((slide, index) => place(slide, index === keep ? 'active' : index < keep ? 'before' : 'after'));
  track.replaceChildren(...slides);
  current = keep;
  dots = slides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'showcase-dot';
    dot.setAttribute('aria-label', `Ir a la pieza ${index + 1}: ${featured[index].nombre}`);
    dot.setAttribute('aria-controls', track.id);
    dot.append(document.createElement('span'));
    dot.addEventListener('click', () => go(index));
    return dot;
  });
  dotsRoot.replaceChildren(...dots);
  dotsRoot.hidden = slides.length < 2;
  previous.hidden = next.hidden = slides.length < 2;
  section.hidden = slides.length === 0;
  syncControls();
}
