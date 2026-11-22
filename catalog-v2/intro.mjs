const STORAGE_KEY = 'pm3d-assembly-seen';
const ASSEMBLY_MS = 2240;
const FLY_MS = 880;
const LEAVE_MS = 300;

const root = document.documentElement;
const screen = document.getElementById('intro');

function flightKeyframes(build, mark) {
  const from = build.getBoundingClientRect();
  const to = mark.getBoundingClientRect();
  const scale = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  return [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }];
}

function runIntro(resolve) {
  const build = screen.querySelector('.intro-build');
  const mark = document.getElementById('brand-logo');
  const skipButton = screen.querySelector('.intro-skip');
  const logo = build.querySelector('img');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const inertNodes = [...document.body.children].filter((node) => node !== screen && !node.inert && !node.matches('svg, script'));
  for (const node of inertNodes) node.inert = true;

  let finished = false;
  let skipping = false;
  const timers = [];
  const after = (ms, fn) => timers.push(setTimeout(fn, ms));

  const cleanup = () => {
    if (finished) return;
    finished = true;
    const restoreFocus = screen.contains(document.activeElement);
    timers.forEach(clearTimeout);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    for (const node of inertNodes) node.inert = false;
    root.classList.remove('intro');
    screen.remove();
    document.removeEventListener('keydown', onKey);
    motion.removeEventListener('change', onMotion);
    if (restoreFocus) mark.closest('a')?.focus({ preventScroll: true });
    resolve();
  };

  const skip = () => {
    if (finished || skipping) return;
    skipping = true;
    timers.forEach(clearTimeout);
    screen.classList.add('is-leaving');
    after(LEAVE_MS, cleanup);
  };

  const flyToHeader = () => {
    if (!build.animate) { skip(); return; }
    screen.classList.add('is-flying');
    const flight = build.animate(flightKeyframes(build, mark), { duration: FLY_MS, easing: 'cubic-bezier(.65, 0, .2, 1)', fill: 'forwards' });
    flight.finished.then(() => { if (!skipping) cleanup(); }, skip);
  };

  const onKey = (event) => { if (event.key === 'Escape') skip(); };
  const onMotion = (event) => { if (event.matches) cleanup(); };
  skipButton.addEventListener('click', skip);
  document.addEventListener('keydown', onKey);
  motion.addEventListener('change', onMotion);
  window.scrollTo(0, 0);
  after(5000, cleanup);

  logo.decode().then(() => {
    if (skipping || finished) return;
    const fragments = Array.from({ length: 10 }, () => {
      const fragment = document.createElement('span');
      fragment.className = 'assembly-fragment';
      return fragment;
    });
    build.prepend(...fragments);
    screen.classList.add('is-assembling');
    after(ASSEMBLY_MS - 300, () => screen.classList.add('is-assembled'));
    after(ASSEMBLY_MS, flyToHeader);
  }, skip);
}

export const introFinished = new Promise((resolve) => {
  if (!screen || !root.classList.contains('intro')) {
    screen?.remove();
    resolve();
    return;
  }
  runIntro(resolve);
});
