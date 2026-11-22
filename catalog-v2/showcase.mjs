const section = document.getElementById('showcase');
const track = document.getElementById('showcase-track');
const previous = document.getElementById('showcase-prev');
const next = document.getElementById('showcase-next');
const counter = document.getElementById('showcase-counter');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const indexOfNearest = () => {
  const left = track.getBoundingClientRect().left;
  return Array.from(track.children).reduce((nearest, card, index, cards) => (
    Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[nearest].getBoundingClientRect().left - left) ? index : nearest
  ), 0);
};

function syncControls() {
  const total = track.children.length;
  if (!total) return;
  const current = indexOfNearest();
  const label = `${String(current + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  if (counter.textContent !== label) counter.textContent = label;
  previous.setAttribute('aria-disabled', String(current === 0));
  next.setAttribute('aria-disabled', String(current === total - 1));
}

function step(delta) {
  const card = track.children[indexOfNearest() + delta];
  if (!card) return;
  track.scrollTo({ left: track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left, behavior: motion.matches ? 'auto' : 'smooth' });
}

previous.addEventListener('click', () => step(-1));
next.addEventListener('click', () => step(1));
track.addEventListener('scroll', syncControls, { passive: true });

export function renderShowcase(products, { openDetail, formatPrice, setPhoto, icon }) {
  const eligible = products.filter((product) => product.fotos.length && !product.navidad);
  const isCurated = (product) => /(?:^|\s)vitrine(?:\s|$)/i.test(product.busqueda);
  const featured = [...eligible.filter(isCurated), ...eligible.filter((product) => !isCurated(product))].slice(0, 6);
  const cards = featured.map((product, index) => {
    const item = document.createElement('li');
    item.className = 'showcase-item';
    const button = document.createElement('button');
    button.className = 'showcase-card';
    button.type = 'button';
    button.addEventListener('click', () => openDetail(product, button));

    const photo = document.createElement('img');
    photo.alt = '';
    photo.loading = 'lazy';
    photo.decoding = 'async';
    setPhoto(photo, product.fotos[0]);

    const serial = document.createElement('span');
    serial.className = 'showcase-serial';
    serial.setAttribute('aria-hidden', 'true');
    serial.textContent = `PM / ${String(index + 1).padStart(2, '0')}`;
    const caption = document.createElement('span');
    caption.className = 'showcase-caption';
    const name = document.createElement('strong');
    name.textContent = product.nombre;
    const price = document.createElement('span');
    price.textContent = formatPrice(product.precio);
    caption.append(name, price);
    button.append(photo, serial, caption, icon('icon-up-right'));
    item.append(button);
    return item;
  });
  track.replaceChildren(...cards);
  section.hidden = cards.length === 0;
  track.scrollLeft = 0;
  syncControls();
}
