// Stippled, pastel "risograph" art for the landing page: clouds, a hot-air balloon and photos repainted in the
// same grain. Everything is drawn once into a canvas, pixel by pixel, with a seeded dither, so the dots are stable
// between renders.

export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// 4x4 Bayer matrix, as thresholds in [0, 1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// dark (shadow, under the cloud) to light (sunlit top)
export const CLOUD_RAMP = ["#7a80d6", "#9a9ae2", "#bba9df", "#e2b4b3", "#f3c29f", "#fbd8ad", "#ffeccb", "#fff8ea"].map(hex);
const PHOTO_RAMP = ["#545a9c", "#8086d0", "#b7a5d8", "#eeb69a", "#fbd8b0", "#fff4e2"].map(hex);
const BASKET_RAMP = ["#8a6a8e", "#b98a86", "#dca88c", "#f1c9a3"].map(hex);
const STRIPES = [
  ["#7d83d6", "#a6a4e6", "#d3bde9", "#f1e2f2", "#fff6fb"].map(hex), // lavender gore
  ["#c98e86", "#eba58f", "#f7c19f", "#fde0bf", "#fff4e0"].map(hex), // peach gore
  ["#9fb7a6", "#bcd8c4", "#d8ecd9", "#f0f8ea", "#fffff6"].map(hex), // mint gore
];

function pick(ramp, t) {
  return ramp[Math.round(clamp(t) * (ramp.length - 1))];
}

function lerpRamp(ramp, t) {
  const x = clamp(t) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(x)), f = x - i;
  const a = ramp[i], b = ramp[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// separable box blur, in place, run twice for a near-gaussian
function blur(a, W, H, rad) {
  if (rad < 1) return a;
  const tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      let s = 0; const row = y * W;
      for (let x = -rad; x <= rad; x++) s += a[row + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        tmp[row + x] = s / (2 * rad + 1);
        s += a[row + Math.min(W - 1, x + rad + 1)] - a[row + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -rad; y <= rad; y++) s += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / (2 * rad + 1);
        s += tmp[Math.min(H - 1, y + rad + 1) * W + x] - tmp[Math.max(0, y - rad) * W + x];
      }
    }
  }
  return a;
}

// smooth value noise for the cloud's small lumps
function noise2(seed) {
  const r = rng(seed), N = 64, g = new Float32Array(N * N).map(() => r());
  const at = (x, y) => g[((y % N) + N) % N * N + (((x % N) + N) % N)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

const LIGHT = (() => { const v = [0.42, -0.72, 0.55], n = Math.hypot(...v); return v.map((x) => x / n); })();

/**
 * A cumulus cloud: puffs (spheres) over a soft base make a height field, which is blurred so the puffs melt into
 * one another, then lit from the top right, cooled towards the base and dithered into the pastel ramp. Its outline
 * breaks up into scattered dots.
 */
export function makeCloud({ width = 520, height = 240, seed = 1, scale = 0.62, flat = 0.8 } = {}) {
  const W = Math.max(8, Math.round(width * scale)), H = Math.max(8, Math.round(height * scale));
  const r = rng(seed), nz = noise2(seed + 11);
  const base = H * flat;
  const puffs = [];
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const bell = Math.sin(Math.PI * (0.1 + 0.8 * u));
    const rad = H * (0.1 + 0.2 * bell * (0.8 + 0.4 * r()));
    puffs.push({ cx: W * (0.1 + 0.8 * u) + (r() - 0.5) * W * 0.04, cy: base - rad * (0.4 + 0.25 * r()), rad });
  }
  for (let k = 0; k < 4; k++) {
    const u = 0.25 + r() * 0.5, rad = H * (0.15 + r() * 0.12);
    puffs.push({ cx: W * u, cy: base - rad * (0.95 + r() * 0.45), rad });
  }
  for (let k = 0; k < 7; k++) {
    // little lumps along the silhouette
    const host = puffs[Math.floor(r() * puffs.length)], a = -Math.PI * (0.1 + 0.8 * r());
    const rad = H * (0.05 + r() * 0.06);
    puffs.push({ cx: host.cx + Math.cos(a) * host.rad * 0.85, cy: Math.min(base - rad * 0.5, host.cy + Math.sin(a) * host.rad * 0.85), rad });
  }
  const top = Math.min(...puffs.map((p) => p.cy - p.rad));
  if (top < H * 0.06) {
    const s = (base - H * 0.06) / (base - top);
    puffs.forEach((p) => { p.cy = base - (base - p.cy) * s; p.rad *= s; });
  }
  const cloudTop = Math.min(...puffs.map((p) => p.cy - p.rad));

  // height field and coverage
  const hf = new Float32Array(W * H), cov = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fade = clamp((base + H * 0.02 - y) / (H * 0.1));
    if (fade <= 0) continue;
    for (let x = 0; x < W; x++) {
      let best = 0;
      for (const p of puffs) {
        const dx = x - p.cx, dy = y - p.cy, q = p.rad * p.rad - dx * dx - dy * dy;
        if (q > 0) { const z = Math.sqrt(q); if (z > best) best = z; }
      }
      if (best > 0) {
        const i = y * W + x;
        hf[i] = (best + nz(x * 0.09, y * 0.09) * H * 0.05) * fade;
        cov[i] = fade;
      }
    }
  }
  blur(hf, W, H, Math.max(1, Math.round(H * 0.025)));
  blur(cov, W, H, Math.max(1, Math.round(H * 0.018)));

  const c = canvasOf(W, H), g = c.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, m = cov[i];
      if (m <= 0.02) continue;
      // a soft, dotty outline: coverage decides how likely a dot is
      if (m < 0.95 && m < 0.08 + r() * 0.85) continue;
      const gx = (hf[i + 1] - hf[i - 1]) * 0.5, gy = (hf[i + W] - hf[i - W]) * 0.5;
      const inv = 1 / Math.hypot(gx, gy, 1);
      const nxv = -gx * inv, nyv = -gy * inv, nzv = inv;
      const diff = Math.max(0, nxv * LIGHT[0] + nyv * LIGHT[1] + nzv * LIGHT[2]);
      const vy = clamp((y - cloudTop) / (base - cloudTop));
      let t = 0.22 + 0.72 * diff - 0.5 * vy * vy + 0.12 * (1 - vy);
      t += (bayer(x, y) - 0.5) * 0.3 + (r() - 0.5) * 0.16;
      const col = pick(CLOUD_RAMP, t), j = i * 4;
      d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A striped hot-air balloon with its basket, in the same grain as the clouds. */
export function makeBalloon({ width = 220, height = 300, seed = 3, scale = 0.62 } = {}) {
  const W = Math.round(width * scale), H = Math.round(height * scale);
  const r = rng(seed);
  const cx = W / 2, cy = H * 0.36, R = W * 0.44, neckY = H * 0.74, neckW = W * 0.09;
  const bTop = H * 0.84, bBot = H * 0.95, bW = W * 0.11;
  const c = canvasOf(W, H), g = c.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  const put = (x, y, col) => { const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  for (let y = 0; y < H; y++) {
    // envelope half-width at this height: a sphere on top, tapering to the neck
    let hw = 0;
    if (y >= cy - R && y <= cy) hw = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
    else if (y > cy && y <= neckY) { const u = (y - cy) / (neckY - cy); hw = R + (neckW - R) * Math.pow(u, 1.25); }
    for (let x = 0; x < W; x++) {
      if (hw > 0 && Math.abs(x - cx) <= hw) {
        const nx = (x - cx) / hw, ny = y < cy ? (y - cy) / R : 0.35 * ((y - cy) / (neckY - cy)), nzv = Math.sqrt(Math.max(0, 1 - nx * nx));
        const diff = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nzv * LIGHT[2]);
        const gore = Math.floor((Math.asin(clamp(nx, -1, 1)) / Math.PI + 0.5) * 7);
        const ramp = STRIPES[gore % 3];
        const t = clamp(0.12 + 0.85 * diff + (bayer(x, y) - 0.5) * 0.3 + (r() - 0.5) * 0.12);
        if (nzv < r() * 0.25) continue;
        put(x, y, pick(ramp, t));
        continue;
      }
      if (y >= bTop && y <= bBot && Math.abs(x - cx) <= bW) {
        const t = clamp(0.75 - 0.6 * ((x - cx + bW) / (2 * bW)) + (r() - 0.5) * 0.35);
        put(x, y, pick(BASKET_RAMP, t));
        continue;
      }
      if (y > neckY && y < bTop) {
        const u = (y - neckY) / (bTop - neckY);
        for (const s of [-1, 1]) {
          const rx = cx + s * (neckW + (bW - neckW) * u);
          if (Math.abs(x - rx) < 0.8 && r() > 0.25) put(x, y, BASKET_RAMP[0]);
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Repaint a photo in the page's pastel print: soften it, blend its own colour with a lavender-to-cream gradient
 * map, quantise each channel through an ordered dither, and let the rim break up into dots.
 */
export function stipplePhoto(image, { width = 520, height = 420, scale = 0.85, seed = 7, keep = 0.5, soft = 2.2, mask = "blob" } = {}) {
  const W = Math.round(width * scale), H = Math.round(height * scale);
  // draw the photo small, then scale it back up smoothly, which flattens it into painted shapes
  const Ws = Math.max(8, Math.round(W / soft)), Hs = Math.max(8, Math.round(H / soft));
  const small = canvasOf(Ws, Hs), sg = small.getContext("2d");
  const ir = image.width / image.height, cr = W / H;
  let sw = image.width, sh = image.height, sx = 0, sy = 0;
  if (ir > cr) { sw = image.height * cr; sx = (image.width - sw) / 2; } else { sh = image.width / cr; sy = (image.height - sh) / 2; }
  sg.imageSmoothingQuality = "high";
  sg.drawImage(image, sx, sy, sw, sh, 0, 0, Ws, Hs);
  const src = canvasOf(W, H), g0 = src.getContext("2d", { willReadFrequently: true });
  g0.imageSmoothingQuality = "high";
  g0.drawImage(small, 0, 0, W, H);
  const px = g0.getImageData(0, 0, W, H).data;

  const r = rng(seed);
  const c = canvasOf(W, H), g = c.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  const levels = 6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let m = 1;
      if (mask === "blob") {
        const u = (x / W - 0.5) * 2, v = (y / H - 0.5) * 2;
        const wob = 0.05 * Math.sin(u * 5.3 + seed) + 0.04 * Math.sin(v * 6.1 - seed * 0.7);
        const dist = Math.pow(Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.6), 1 / 2.6) + wob;
        m = clamp((1 - dist) / 0.22);
      }
      if (m < 1 && m < r() * 0.85 + 0.1 * bayer(x, y)) continue;
      const R0 = px[i] / 255, G0 = px[i + 1] / 255, B0 = px[i + 2] / 255;
      const l = clamp((0.299 * R0 + 0.587 * G0 + 0.114 * B0 - 0.5) * 1.2 + 0.57);
      const gm = lerpRamp(PHOTO_RAMP, l);
      const th = bayer(x, y);
      const rgb = [R0, G0, B0];
      for (let k = 0; k < 3; k++) {
        const mixed = rgb[k] * keep + (gm[k] / 255) * (1 - keep);
        const lifted = mixed * 0.84 + 0.16;
        d[i + k] = Math.round(clamp(Math.floor(lifted * levels + th) / levels) * 255);
      }
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const imageCache = new Map();
export function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    }));
  }
  return imageCache.get(url);
}
