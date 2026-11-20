import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { short } from "@/lib/format";
import { inkColor } from "@/components/Ink";

// A sketchbook lying open on the page, drawn with three.js. Each spread is a destination photo repainted as pen ink and
// watercolour on cream paper (or a real painting, if one is saved as public/sketches/<slug>.jpg). Turning to the next
// spread lifts the right-hand page, curls it over the spine and lays it down on the left.

const PAGE_W = 1, PAGE_H = 1.4; // one page; the open spread is 2 × 1.4
const NS = 48, NV = 24; // page mesh resolution, across and up
const STACK = 4; // blank leaves under each top page, so the book has some thickness
const TURN_MS = 1100;
const CACHE = 5; // painted spreads kept on the GPU at once
const CURL = 0.75; // how far the free edge leads, then trails, the rest of a turning page

const PAINT_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const PAINT_FRAG = `
varying vec2 vUv;
uniform sampler2D uPhoto;
uniform sampler2D uOverlay;
uniform vec2 uRes;
uniform float uAspect; // photo width / height
uniform float uOwn;    // 1 for a real painting, shown as it is
uniform float uSeed;

const vec3 PAPER = vec3(.945, .922, .875);
const vec3 INK = vec3(.12, .14, .22);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }

// the photo cropped to cover the spread
vec2 cover(vec2 uv) {
  float r = uRes.x / uRes.y;
  vec2 s = r > uAspect ? vec2(1., uAspect / r) : vec2(r / uAspect, 1.);
  return (uv - .5) * s + .5;
}
vec3 photo(vec2 uv) { return texture2D(uPhoto, cover(uv)).rgb; }
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }

// a painter's simplification of the photo: each pixel takes the average of whichever corner around it is most even,
// so detail melts into flat shapes but the edges between them stay crisp (a Kuwahara filter)
vec3 flatten(vec2 uv, float r) {
  vec3 m0 = vec3(0.), m1 = vec3(0.), m2 = vec3(0.), m3 = vec3(0.), s0 = vec3(0.), s1 = vec3(0.), s2 = vec3(0.), s3 = vec3(0.);
  // the corners are turned a little differently at every spot, so the shapes come out as brush marks, not squares
  float a = noise(uv * uRes / 40. + uSeed) * 6.283;
  mat2 turn = mat2(cos(a), sin(a), -sin(a), cos(a));
  for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++) {
    vec2 o = turn * vec2(float(i), float(j)) * r / 3. / uRes;
    vec3 c = photo(uv - o); m0 += c; s0 += c * c;
    c = photo(uv + vec2(o.x, -o.y)); m1 += c; s1 += c * c;
    c = photo(uv + vec2(-o.x, o.y)); m2 += c; s2 += c * c;
    c = photo(uv + o); m3 += c; s3 += c * c;
  }
  m0 /= 16.; m1 /= 16.; m2 /= 16.; m3 /= 16.;
  vec3 v0 = abs(s0 / 16. - m0 * m0), v1 = abs(s1 / 16. - m1 * m1), v2 = abs(s2 / 16. - m2 * m2), v3 = abs(s3 / 16. - m3 * m3);
  float e0 = v0.r + v0.g + v0.b, e1 = v1.r + v1.g + v1.b, e2 = v2.r + v2.g + v2.b, e3 = v3.r + v3.g + v3.b;
  vec3 best = m0; float lo = e0;
  if (e1 < lo) { lo = e1; best = m1; }
  if (e2 < lo) { lo = e2; best = m2; }
  if (e3 < lo) { best = m3; }
  return best;
}

void main() {
  vec2 uv = vUv, px = uv * uRes;
  vec3 col;
  if (uOwn > .5) {
    col = photo(uv);
  } else {
    // the pen never quite follows the photo
    vec2 st = uv + (vec2(fbm(uv * 9. + uSeed), fbm(uv * 9. + uSeed + 31.)) - .5) * .006;
    // two blurs of the light: their difference finds the edges worth a line
    float sig1 = uRes.x / 620., sig2 = sig1 * 1.6, stepPx = sig2 * .8;
    float s1 = 0., s2 = 0., w1 = 0., w2 = 0.;
    for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++) {
      vec2 o = vec2(float(x), float(y)) * stepPx;
      float l = luma(photo(st + o / uRes)), r2 = dot(o, o);
      float k1 = exp(-r2 / (2. * sig1 * sig1)), k2 = exp(-r2 / (2. * sig2 * sig2));
      s1 += l * k1; w1 += k1; s2 += l * k2; w2 += k2;
    }
    float g1 = s1 / w1, g2 = s2 / w2;
    float dog = g2 - g1; // positive on the dark side of an edge
    float line = smoothstep(.012, .05, dog);

    vec3 shapes = flatten(st, uRes.x / 140.);
    float v = luma(shapes);
    float lv = v * 4. + (fbm(px * .004 + uSeed) - .5) * 1.1;
    float q = (floor(lv) + .6) / 4.; // pigment settles into a few values
    vec3 tint = shapes * (q + .1) / (v + .1);
    tint = clamp(mix(vec3(luma(tint)), tint, 1.5), 0., 1.);
    tint = mix(tint, vec3(1.), .1); // watercolour never quite reaches black
    float edge = min(min(uv.x, 1. - uv.x) * uRes.x / uRes.y, min(uv.y, 1. - uv.y));
    // a ragged unpainted margin and an open sky, with the crisp edge a wash dries to
    float rag = (fbm(uv * 3.5 + uSeed) - .5) * .2 + (noise(px * .02) - .5) * .015;
    float mask = smoothstep(.085, .095, edge + rag);
    mask *= smoothstep(.86, .85, uv.y + (fbm(uv * 4. + uSeed + 3.) - .5) * .18 + (noise(px * .02 + 5.) - .5) * .015);
    float amt = mask * smoothstep(.9, .55, v) * (.72 + .34 * fbm(px * .003 + uSeed)); // pigment pools unevenly
    vec3 wash = mix(vec3(1.), tint, amt);
    wash *= 1. - .16 * (1. - smoothstep(0., .12, fract(lv))) * amt; // wet edges where one wash dried against the next
    wash *= .93 + .07 * noise(px * .35); // granulation
    col = PAPER * wash;
    float lines = line * smoothstep(.2, .4, noise(px * .015 + uSeed));
    col = mix(col, INK, lines * .75 * mask);
  }
  col *= .975 + .025 * fbm(px * .05); // paper fibres
  vec4 ov = texture2D(uOverlay, uv);
  col *= mix(vec3(1.), ov.rgb, ov.a);
  gl_FragColor = vec4(col, 1.);
}`;

const PAGE_VERT = `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

// The front of a leaf is the right-hand page it shows before turning, the back the left-hand page after.
const PAGE_FRAG = `
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform float uFrontInk;
uniform float uBackInk;
uniform float uShade;
varying vec2 vUv;
varying vec3 vN;
const vec3 PAPER = vec3(.945, .922, .875);
void main() {
  bool front = gl_FrontFacing;
  vec2 uv = vec2(front ? .5 + .5 * vUv.x : .5 - .5 * vUv.x, vUv.y);
  vec3 col = mix(PAPER, front ? texture2D(uFront, uv).rgb : texture2D(uBack, uv).rgb, front ? uFrontInk : uBackInk);
  vec3 n = normalize(front ? vN : -vN);
  float lit = .9 + .12 * max(dot(n, normalize(vec3(-.3, .5, 1.))), 0.);
  float gutter = mix(.8, 1., smoothstep(0., .035, vUv.x));
  gl_FragColor = vec4(col * lit * gutter * uShade, 1.);
}`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// a page at rest: it rises out of the gutter, arches a little and settles; the middle rows rise more, so the edges wave
const rest = (s, v) => 0.4 * (1 + 0.3 * Math.sin(Math.PI * v)) * Math.exp(-s / 0.09) + 0.05 * (0.5 - s);

/** Bends one leaf: t = 0 lies on the right, t = 1 on the left, in between it is curling over the spine. */
function shapeLeaf(geo, t, z = 0, dx = 0, dy = 0) {
  const p = geo.attributes.position.array;
  const e = ease(t);
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    let x = 0, zz = 0;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS, k = (j * (NS + 1) + i) * 3;
      p[k] = x + dx; p[k + 1] = (v - 0.5) * PAGE_H + dy; p[k + 2] = zz + z;
      const r = rest(s, v);
      // the free edge leads while the page lifts and trails while it lands; the bottom corner more than the top
      const th = r + (Math.PI - 2 * r) * e + CURL * Math.sin(2 * Math.PI * e) * s ** 1.5 * (0.8 + 0.4 * (1 - v));
      const a = Math.min(Math.max(th, r), Math.PI - r);
      x += (Math.cos(a) * PAGE_W) / NS; zz += (Math.sin(a) * PAGE_W) / NS;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

function leafGeometry() {
  const geo = new THREE.BufferGeometry();
  const uv = [], index = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NS; i++) uv.push(i / NS, j / NV);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((NS + 1) * (NV + 1) * 3), 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

/** What is written on a spread: our passport stamp in red ink, and a pencilled note of the number and the price. */
function drawOverlay(w, h, spread, n) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const r = w * 0.042, cx = w * 0.885, cy = h * 0.115;
  g.save();
  g.translate(cx, cy); g.rotate(-0.21);
  g.strokeStyle = g.fillStyle = "#c9302a";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = r * 0.07; g.beginPath(); g.arc(0, 0, r * 0.95, 0, 7); g.stroke();
  g.lineWidth = r * 0.03; g.beginPath(); g.arc(0, 0, r * 0.62, 0, 7); g.stroke();
  // getPackd round the rim, as on the stamp the enquiry form gives
  const rim = [..."GETPACKD ✦ GROUP TRIPS ✦ "];
  g.font = `700 ${r * 0.15}px "DM Sans", sans-serif`;
  rim.forEach((ch, i) => { g.save(); g.rotate((i / rim.length) * Math.PI * 2); g.fillText(ch, 0, -r * 0.785); g.restore(); });
  g.lineWidth = r * 0.075; g.lineCap = g.lineJoin = "round";
  g.beginPath(); g.moveTo(-r * 0.16, -r * 0.3); g.lineTo(-r * 0.05, -r * 0.19); g.lineTo(r * 0.17, -r * 0.41); g.stroke();
  const place = (spread.stamp || spread.destination).toUpperCase().slice(0, 13);
  g.font = `800 ${r * (place.length > 9 ? 0.13 : 0.17)}px "DM Sans", sans-serif`;
  g.fillText(place, 0, r * 0.03);
  g.font = `600 ${r * 0.11}px "JetBrains Mono", monospace`;
  g.fillText(`NO. ${String(n).padStart(2, "0")}`, 0, r * 0.27);
  // worn ink: specks where the stamp didn't take
  g.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 220; k++) {
    g.globalAlpha = Math.random() * 0.85;
    g.beginPath(); g.arc((Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r, Math.random() * r * 0.035, 0, 7); g.fill();
  }
  g.restore();
  g.fillStyle = inkColor();
  g.font = `600 ${r * 0.5}px Caveat, cursive`;
  g.textBaseline = "top";
  ["from", spread.price ? short(spread.price) : ""].forEach((t, k) => g.fillText(t, cx + r * 1.15, cy - r * 0.55 + k * r * 0.5));
  return c;
}

function createBook(host, spreads, { start, reduced, fill, lower, onOpen, onStep, onLayout, onReady, onShown }) {
  const n = spreads.length;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", touchAction: "pan-y" });
  host.appendChild(canvas);

  const RT_W = Math.min(window.innerWidth, window.innerHeight) < 700 ? 1280 : 1792, RT_H = Math.round((RT_W * PAGE_H) / (2 * PAGE_W));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const book = new THREE.Group();
  book.rotation.set(-0.08, 0.16, 0); // turned a little, so it reads as a book lying open; it doesn't follow the pointer
  scene.add(book);

  // a soft shadow on the wall behind the book
  const sh = document.createElement("canvas");
  sh.width = sh.height = 256;
  const sg = sh.getContext("2d"), grad = sg.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, "rgba(28,34,44,.34)"); grad.addColorStop(0.5, "rgba(28,34,44,.12)"); grad.addColorStop(1, "rgba(28,34,44,0)");
  sg.fillStyle = grad; sg.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(sh);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.position.set(0, -0.2, -0.3);
  book.add(shadow);

  const leaves = [];
  const leaf = (t, { z = 0, dx = 0, dy = 0, shade = 1 } = {}) => {
    const geo = leafGeometry();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFront: { value: null }, uBack: { value: null }, uFrontInk: { value: 0 }, uBackInk: { value: 0 }, uShade: { value: shade } },
      vertexShader: PAGE_VERT, fragmentShader: PAGE_FRAG, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { ink: { front: 0, back: 0 }, shade };
    shapeLeaf(geo, t, z, dx, dy);
    book.add(mesh);
    leaves.push(mesh);
    return mesh;
  };
  // the page block peeks out a little below and beyond the top pages
  for (let k = STACK; k >= 1; k--) {
    const o = { z: -0.004 - k * 0.005, dy: -k * 0.004, shade: 0.95 - k * 0.012 };
    leaf(0, { ...o, dx: k * 0.003 });
    leaf(1, { ...o, dx: -k * 0.003 });
  }
  const left = leaf(1, { z: -0.004 }), right = leaf(0, { z: -0.004 }), turner = leaf(0);
  turner.visible = false;
  const show = (mesh, side, tex) => {
    mesh.material.uniforms[side === "front" ? "uFront" : "uBack"].value = tex;
    mesh.userData.ink[side] = tex ? 1 : 0;
  };

  // ---------- painting the spreads ----------
  const paintMat = new THREE.ShaderMaterial({
    uniforms: { uPhoto: { value: null }, uOverlay: { value: null }, uRes: { value: new THREE.Vector2(RT_W, RT_H) }, uAspect: { value: 1.5 }, uOwn: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: PAINT_VERT, fragmentShader: PAINT_FRAG, depthTest: false, depthWrite: false,
  });
  const paintScene = new THREE.Scene();
  paintScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMat));
  const paintCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
  const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const fonts = document.fonts ? Promise.all(["600 48px Caveat", "800 48px \"DM Sans\"", "600 48px \"JetBrains Mono\""].map((f) => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  let disposed = false;

  async function paint(i) {
    const sp = spreads[i];
    const own = await load(`/sketches/${sp.slug}.jpg`).catch(() => null);
    const img = own || (await load(sp.image));
    await fonts;
    if (disposed) { img.dispose(); return null; }
    const overlay = new THREE.CanvasTexture(drawOverlay(RT_W, RT_H, sp, i + 1));
    const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const u = paintMat.uniforms;
    u.uPhoto.value = img; u.uOverlay.value = overlay;
    u.uAspect.value = img.image.width / img.image.height;
    u.uOwn.value = own ? 1 : 0;
    u.uSeed.value = (i * 7.31) % 10;
    renderer.setRenderTarget(rt);
    renderer.render(paintScene, paintCam);
    renderer.setRenderTarget(null);
    img.dispose(); overlay.dispose();
    return rt;
  }

  const cache = new Map(); // spread index -> { promise, rt, used }
  let shown = start, turn = null, queued = null;
  const keep = () => [shown, (shown + 1) % n, (shown - 1 + n) % n, turn?.to, turn?.from];
  function spread(i) {
    let e = cache.get(i);
    if (!e) {
      e = { promise: paint(i).then((rt) => (e.rt = rt) && rt.texture).catch(() => null) };
      cache.set(i, e);
    }
    e.used = performance.now();
    const pinned = keep(), old = [...cache.entries()].filter(([k, c]) => c.rt && !pinned.includes(k)).sort((a, b) => a[1].used - b[1].used);
    while (cache.size > CACHE && old.length) {
      const [k, c] = old.shift();
      c.rt.dispose(); cache.delete(k);
    }
    return e.promise;
  }
  const preload = (i) => [1, -1].forEach((d) => spread((i + d + n) % n));

  spread(start).then((tex) => {
    if (disposed) return;
    show(left, "back", tex); show(right, "front", tex);
    onReady();
    onShown(start);
    preload(start);
  });

  // ---------- turning ----------
  async function go(to) {
    if (turn) { queued = to; return; }
    if (to === shown) return;
    const from = shown, dir = (to - from + n) % n <= n / 2 ? 1 : -1;
    turn = { from, to, dir };
    const [a, b] = await Promise.all([spread(from), spread(to)]);
    if (disposed) return;
    if (dir > 0) { show(turner, "front", a); show(turner, "back", b); show(right, "front", b); }
    else { show(turner, "back", a); show(turner, "front", b); show(left, "back", b); }
    for (const side of ["front", "back"]) turner.material.uniforms[side === "front" ? "uFrontInk" : "uBackInk"].value = turner.userData.ink[side];
    shapeLeaf(turner.geometry, dir > 0 ? 0 : 1);
    turner.visible = true;
    turn.start = performance.now();
    shown = to;
    // the page is painted and turning now: anything that names the spread (the caption under the book) changes with it
    onShown(to);
  }
  function finish() {
    const { to, dir } = turn;
    const tex = cache.get(to)?.rt?.texture ?? null;
    if (dir > 0) show(left, "back", tex); else show(right, "front", tex);
    left.material.uniforms.uBackInk.value = left.userData.ink.back;
    right.material.uniforms.uFrontInk.value = right.userData.ink.front;
    left.material.uniforms.uShade.value = right.material.uniforms.uShade.value = 1;
    turner.visible = false;
    turn = null;
    if (queued !== null) { const q = queued; queued = null; go(q); }
    else setTimeout(() => !disposed && !turn && preload(shown), 150);
  }

  // ---------- size, pointer, loop ----------
  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // `fill` is the share of the height the book takes, `lower` how far below the middle it sits (both of this box)
    const wantW = w < 640 ? 0.86 : 0.56;
    const visH = Math.max(PAGE_H / fill, (2 * PAGE_W) / wantW / camera.aspect);
    camera.position.set(0, lower * visH, visH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
    const half = (PAGE_H / 2 / visH) * h, mid = h * (0.5 + lower);
    onLayout({ top: mid - half, bottom: mid + half, width: w, height: h });
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(host);

  const ndc = new THREE.Vector2(9, 9), ray = new THREE.Raycaster();
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  };
  const overBook = () => {
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([left, right], false).length > 0;
  };
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onStep(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 8) { onMove(e); if (overBook()) onOpen(shown); }
  };
  window.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(host);

  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    book.position.y = reduced ? 0 : Math.sin(now / 1600) * 0.012;
    if (turn?.start) {
      const k = reduced ? 1 : Math.min((now - turn.start) / TURN_MS, 1);
      const t = turn.dir > 0 ? k : 1 - k;
      shapeLeaf(turner.geometry, t);
      // the lifted page throws a little shade on the one it uncovers
      (turn.dir > 0 ? right : left).material.uniforms.uShade.value = 1 - 0.14 * Math.sin(Math.PI * ease(k));
      if (k >= 1) finish();
    }
    // freshly painted pages fade in
    for (const m of leaves) {
      const u = m.material.uniforms;
      u.uFrontInk.value += (m.userData.ink.front - u.uFrontInk.value) * 0.08;
      u.uBackInk.value += (m.userData.ink.back - u.uBackInk.value) * 0.08;
    }
    canvas.style.cursor = overBook() ? "pointer" : "";
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    go,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove);
      for (const m of leaves) { m.geometry.dispose(); m.material.dispose(); }
      for (const c of cache.values()) c.rt?.dispose();
      shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose();
      paintMat.dispose(); paintScene.children[0].geometry.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/** The open sketchbook. `index` is the spread to show; changing it turns the pages there. */
export default function Sketchbook({ spreads, index, reduced, fill = 0.5, lower = 0, onOpen, onStep, onLayout, onReady, onShown, className = "" }) {
  const host = useRef(null);
  const book = useRef(null);
  const [failed, setFailed] = useState(false);
  const live = useRef({ index, onOpen, onStep, onLayout, onReady, onShown });
  live.current = { index, onOpen, onStep, onLayout, onReady, onShown };

  useEffect(() => {
    if (!spreads.length || !host.current) return undefined;
    try {
      book.current = createBook(host.current, spreads, {
        start: live.current.index, reduced, fill, lower,
        onOpen: (i) => live.current.onOpen?.(i), onStep: (d) => live.current.onStep?.(d), onLayout: (b) => live.current.onLayout?.(b), onReady: () => live.current.onReady?.(),
        onShown: (i) => live.current.onShown?.(i),
      });
    } catch {
      setFailed(true); // no WebGL: the plain photo below stands in
      return undefined;
    }
    return () => { book.current?.dispose(); book.current = null; };
  }, [spreads, reduced, fill, lower]);

  useEffect(() => { book.current?.go(index); }, [index]);
  // without WebGL the plain photo swaps at once, so the spread is shown as soon as it's picked
  useEffect(() => { if (failed) live.current.onShown?.(index); }, [failed, index]);

  const cur = spreads[index];
  return (
    <div ref={host} className={className} data-testid="sketchbook">
      {failed && cur && <img src={cur.image} alt="" className="absolute left-1/2 top-1/2 w-[86%] max-w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-sm shadow-soft sm:w-[54%]" />}
    </div>
  );
}
