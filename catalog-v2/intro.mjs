const STORAGE_KEY = 'pm3d-intro-seen';
const GRID = 5;
const BUILD_MS = 1900;
const HOLD_MS = 650;
const LEAVE_MS = 650;

const root = document.documentElement;
const screen = document.getElementById('intro');

function buildPieces(stage) {
  const fragment = document.createDocumentFragment();
  const center = (GRID - 1) / 2;
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const piece = document.createElement('span');
      const angle = Math.atan2(row - center, column - center) + (Math.random() - 0.5) * 0.9;
      const distance = 38 + Math.random() * 30;
      piece.className = 'intro-piece';
      piece.style.setProperty('--col', column);
      piece.style.setProperty('--row', row);
      piece.style.setProperty('--dx', `${(Math.cos(angle) * distance).toFixed(1)}vmin`);
      piece.style.setProperty('--dy', `${(Math.sin(angle) * distance).toFixed(1)}vmin`);
      piece.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 220)}deg`);
      piece.style.setProperty('--delay', `${Math.round(Math.random() * 520 + Math.hypot(row - center, column - center) * 90)}ms`);
      fragment.append(piece);
    }
  }
  stage.append(fragment);
}

function runIntro(resolve) {
  let finished = false;
  const timers = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    screen.classList.add('is-leaving');
    timers.push(setTimeout(() => {
      root.classList.remove('intro');
      screen.remove();
      document.removeEventListener('keydown', onKey);
      resolve();
    }, LEAVE_MS));
  };
  const onKey = (event) => { if (event.key === 'Escape') finish(); };

  buildPieces(screen.querySelector('.intro-stage'));
  screen.querySelector('.intro-skip').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => screen.classList.add('is-building'));
  timers.push(setTimeout(() => screen.classList.add('is-built'), BUILD_MS));
  timers.push(setTimeout(finish, BUILD_MS + HOLD_MS));
}

export const introFinished = new Promise((resolve) => {
  if (!screen || !root.classList.contains('intro')) {
    screen?.remove();
    resolve();
    return;
  }
  runIntro(resolve);
});
