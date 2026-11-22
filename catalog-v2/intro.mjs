const STORAGE_KEY = 'pm3d-intro-seen';
const PRINT_MS = 2800;
const LIFT_MS = 520;
const FLY_MS = 950;
const LEAVE_MS = 650;

const root = document.documentElement;
const screen = document.getElementById('intro');

function flightKeyframes(build, mark) {
  const from = build.getBoundingClientRect();
  const to = mark.getBoundingClientRect();
  const scale = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  return [{ transform: 'none' }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})` }];
}

function runIntro(resolve) {
  let finished = false;
  let skipping = false;
  const timers = [];
  const after = (ms, fn) => timers.push(setTimeout(fn, ms));

  const cleanup = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    root.classList.remove('intro', 'intro-landing');
    screen.remove();
    document.removeEventListener('keydown', onKey);
    resolve();
  };

  const skip = () => {
    if (finished || skipping) return;
    skipping = true;
    timers.forEach(clearTimeout);
    root.classList.add('intro-landing');
    screen.classList.add('is-leaving');
    after(LEAVE_MS, cleanup);
  };

  const flyToHeader = () => {
    const build = screen.querySelector('.intro-build');
    const mark = document.getElementById('brand-logo');
    if (!build || !mark || !build.animate) { skip(); return; }
    screen.classList.add('is-flying');
    const flight = build.animate(flightKeyframes(build, mark), { duration: FLY_MS, easing: 'cubic-bezier(.65, 0, .2, 1)', fill: 'forwards' });
    after(FLY_MS * 0.72, () => root.classList.add('intro-landing'));
    flight.finished.then(() => after(160, cleanup), skip);
  };

  const onKey = (event) => { if (event.key === 'Escape') skip(); };

  screen.querySelector('.intro-skip').addEventListener('click', skip);
  document.addEventListener('keydown', onKey);
  window.scrollTo(0, 0);
  requestAnimationFrame(() => screen.classList.add('is-printing'));
  after(PRINT_MS, () => screen.classList.add('is-printed'));
  after(PRINT_MS + LIFT_MS, flyToHeader);
}

export const introFinished = new Promise((resolve) => {
  if (!screen || !root.classList.contains('intro')) {
    screen?.remove();
    resolve();
    return;
  }
  runIntro(resolve);
});
