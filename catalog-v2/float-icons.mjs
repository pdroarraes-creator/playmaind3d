const easing = 0.12;
const settle = 0.08;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fields = [...document.querySelectorAll('.float-field')].map((element) => ({
  element,
  visible: false,
  items: [...element.querySelectorAll('.float-icon')].map((node) => ({
    node,
    speed: Number(node.dataset.speed) || 0.2,
    spin: Number(node.dataset.spin) || 0.05,
    y: null,
    rotate: null,
  })),
}));

let frame = 0;

function update() {
  frame = 0;
  let moving = false;
  const middle = innerHeight / 2;
  for (const field of fields) {
    if (!field.visible) continue;
    const box = field.element.getBoundingClientRect();
    const offset = box.top + box.height / 2 - middle;
    for (const item of field.items) {
      const targetY = offset * item.speed;
      const targetRotate = offset * item.spin;
      if (item.y === null) {
        item.y = targetY;
        item.rotate = targetRotate;
      } else {
        item.y += (targetY - item.y) * easing;
        item.rotate += (targetRotate - item.rotate) * easing;
      }
      if (Math.abs(targetY - item.y) > settle || Math.abs(targetRotate - item.rotate) > settle) moving = true;
      item.node.style.setProperty('--fy', `${item.y.toFixed(2)}px`);
      item.node.style.setProperty('--fr', `${item.rotate.toFixed(2)}deg`);
    }
  }
  if (moving) schedule();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

if (fields.length && !reduced.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const field = fields.find((candidate) => candidate.element === entry.target);
      if (field) field.visible = entry.isIntersecting;
    }
    schedule();
  }, { rootMargin: '30% 0px' });
  for (const field of fields) observer.observe(field.element);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
}
