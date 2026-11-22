const TEXTURE_URL = new URL('./assets/globe-texture.webp', import.meta.url);
const REVOLUTION_MS = 14000;
const AXIAL_TILT = 0.2;
const LIGHT = normalize([-0.45, -0.55, 0.7]);

let texturePromise;

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function loadTexture() {
  texturePromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = reject;
    image.src = TEXTURE_URL.href;
  });
  return texturePromise;
}

function buildSphere(size, texture) {
  const radius = size / 2;
  const cosTilt = Math.cos(AXIAL_TILT);
  const sinTilt = Math.sin(AXIAL_TILT);
  const pixels = [];
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const sx = (px + 0.5 - radius) / radius;
      const sy = (py + 0.5 - radius) / radius;
      const distance = Math.hypot(sx, sy);
      const coverage = Math.min(1, Math.max(0, (1 - distance) * radius + 0.5));
      if (coverage <= 0) continue;
      const sz = Math.sqrt(Math.max(0, 1 - Math.min(1, distance) ** 2));
      const tx = sx * cosTilt - sy * sinTilt;
      const ty = sx * sinTilt + sy * cosTilt;
      const latitude = Math.asin(Math.max(-1, Math.min(1, ty)));
      const longitude = Math.atan2(tx, sz);
      const diffuse = Math.max(0, sx * LIGHT[0] + sy * LIGHT[1] + sz * LIGHT[2]);
      const rim = 1 - 0.28 * (1 - sz) ** 2;
      const highlight = diffuse ** 24 * 0.22;
      pixels.push({
        offset: (py * size + px) * 4,
        u: (longitude + Math.PI / 2) / (Math.PI * 2),
        row: Math.min(texture.height - 1, Math.floor((latitude / Math.PI + 0.5) * texture.height)) * texture.width,
        shade: (0.72 + 0.4 * diffuse) * rim,
        highlight: highlight * 255,
        alpha: coverage * 255,
      });
    }
  }
  return pixels;
}

export async function mountGlobe(canvas, { animate = true } = {}) {
  const texture = await loadTexture();
  const size = canvas.width;
  const context = canvas.getContext('2d');
  const frame = context.createImageData(size, size);
  const pixels = buildSphere(size, texture);
  const { data: source, width: textureWidth } = texture;
  const target = frame.data;

  const draw = (rotation) => {
    for (const pixel of pixels) {
      let u = (pixel.u + rotation) % 1;
      if (u < 0) u += 1;
      const index = (pixel.row + Math.floor(u * textureWidth)) * 4;
      target[pixel.offset] = Math.min(255, source[index] * pixel.shade + pixel.highlight);
      target[pixel.offset + 1] = Math.min(255, source[index + 1] * pixel.shade + pixel.highlight);
      target[pixel.offset + 2] = Math.min(255, source[index + 2] * pixel.shade + pixel.highlight);
      target[pixel.offset + 3] = pixel.alpha;
    }
    context.putImageData(frame, 0, 0);
  };

  draw(0);
  canvas.classList.add('is-live');
  if (!animate) return;

  const start = performance.now();
  const tick = (now) => {
    draw(((now - start) % REVOLUTION_MS) / REVOLUTION_MS);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
