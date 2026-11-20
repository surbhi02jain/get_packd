import * as THREE from "three";

// One illustrated world for the landing page's journey: mountains, then backwaters, then the coast, then a city, laid
// out along a road the camera follows as you scroll. Every frame is drawn twice: first each surface writes which way
// it faces, how far away it is, how lit it is and which colour it is painted into a float buffer; then one pass turns
// that buffer into a pastel illustration, with soft blue outlines where depth or facing jumps and cool shadows.

const FAR = 700;

// the paint box, by index. Each surface is stored in the buffer's alpha as index * 2 + how lit it is.
const P = { INK: 0, WATER: 1, WHITE: 2, ROCK: 3, GRASS: 4, LEAF: 5, SAND: 6, ROAD: 7, MAROON: 8, GOLD: 9, CORAL: 10, BUTTER: 11, BLUSH: 12, MINT: 13, LILAC: 14, PEACH: 15, SKY: 16, WOOD: 17, WHEAT: 18 };
const PALETTE = ["#5b6aa8", "#b9dde3", "#fbf6ec", "#c9c3de", "#d2e3b6", "#9fc59b", "#f3e1b6", "#efe4d0", "#cf8f8a", "#ecc66a", "#f2a391", "#f8de8c",
  "#f4c6c3", "#bfe4d2", "#d6cdee", "#f7d0b0", "#b5cdf3", "#c7a588", "#ead29c"];
const BUILDINGS = [P.BLUSH, P.MINT, P.LILAC, P.PEACH, P.BUTTER, P.WHITE];
const hexRGB = (hex) => new THREE.Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

// where each place sits along the road (z falls as the road goes on)
export const ZONES = [
  { key: "mountains", from: 60, to: -140 },
  { key: "backwaters", from: -140, to: -270 },
  { key: "beaches", from: -270, to: -400 },
  { key: "cities", from: -400, to: -620 },
];
const Z_START = 34, Z_END = -505;
// where along the road (0 to 1) the camera stands in front of each place's landmark
const CENTRES = { mountains: -62, backwaters: -205, beaches: -335, cities: -465 };
export const zoneT = (key) => (Z_START - CENTRES[key]) / (Z_START - Z_END);

// ---------- the shape of the land ----------
const roadX = (z) => Math.sin(z * 0.011) * 14 + Math.sin(z * 0.027) * 4;
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return v; }
// 1 once the road is past `edge`, blending over 30 units either side
const past = (z, edge) => smooth(edge + 15, edge - 15, z);
function zoneWeights(z) {
  const p = ZONES.map((zn) => past(z, zn.to));
  return [1 - p[0], p[0] - p[1], p[1] - p[2], p[2]];
}
// random numbers that come out the same every time, so the world is the same world on every visit
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

function naturalHeight(x, z) {
  const dx = x - roadX(z), a = Math.abs(dx);
  const n = fbm(x * 0.045 + 20, z * 0.045);
  const [wm, wb, ws, wc] = zoneWeights(z);
  // mountains: a valley along the road, its walls climbing to snowy ridges
  const hm = Math.min(0.6 + Math.max(0, a - 7) ** 1.38 * 0.3 + n * 10 * smooth(6, 22, a), 80);
  // backwaters: a canal the width of the road, low green banks either side
  const hb = (a < 6 ? -1.4 : 0.7 + n * 1.4 * smooth(6, 14, a)) + Math.max(0, a - 45) * 0.3;
  // coast: dunes on the left, a beach, then the sea on the right
  const hs = Math.max(-4, 0.45 - Math.max(0, dx + 2) * 0.32) + (dx < -10 ? n * 2.5 * smooth(-10, -24, dx) + Math.max(0, -dx - 34) * 0.35 : 0);
  // city: flat ground, hills well beyond the last streets
  const hc = 0.3 + n * 0.5 + Math.max(0, a - 75) * 0.45;
  return hm * wm + hb * wb + hs * ws + hc * wc + Math.max(0, -z - 530) * 0.9;
}
// the monastery's terrace: the hillside is cut level where it stands, as the real ones are
const MON = { x: roadX(-66) - 26, z: -66 };
MON.y = naturalHeight(MON.x, MON.z);
function height(x, z) {
  const h = naturalHeight(x, z), r = Math.hypot((x - MON.x) / 1.2, z - MON.z);
  return h + (MON.y - h) * smooth(19, 12, r);
}

// ---------- materials ----------
const SCENE_VERT = `
uniform float uTime;
uniform float uSway;
uniform float uPal;
varying vec3 vN;
varying vec3 vWN;
varying vec3 vW;
varying float vDepth;
varying float vPal;
void main() {
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  vPal = uPal;
  #ifdef USE_INSTANCING_COLOR
    vPal = instanceColor.r; // instances can each carry their own colour
  #endif
  vec4 wp = m * vec4(position, 1.);
  // flags and fronds move in the wind, more the further they are from where they are tied
  wp.xyz += vec3(sin(uTime * 2.3 + wp.z * .7 + wp.x * .3), sin(uTime * 1.7 + wp.x), cos(uTime * 2. + wp.z)) * uSway * max(uv.x, 0.) * .25;
  vec3 wn = normalize(mat3(m) * normal);
  vWN = wn;
  vW = wp.xyz;
  vN = normalize(mat3(viewMatrix) * wn);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const SCENE_FRAG = `
uniform float uGround;
uniform float uTone;
varying vec3 vN;
varying vec3 vWN;
varying vec3 vW;
varying float vDepth;
varying float vPal;
void main() {
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec3 wn = normalize(gl_FrontFacing ? vWN : -vWN);
  float tone = uTone * (.3 + .7 * max(dot(wn, normalize(vec3(-.45, .8, .4))), 0.));
  float pal = vPal;
  if (uGround > .5) {
    // the ground takes its colour from where it is: grass in the valleys, lavender rock on the slopes, snow on top,
    // sand along the shore and warm paving in the city
    pal = ${P.GRASS}.;
    if (vW.z > -140. && vW.y > 4. + sin(vW.x * .3) * 1.5) pal = ${P.ROCK}.;
    if (vW.y > 17. + sin(vW.x * .2 + vW.z * .1) * 2.) { pal = ${P.WHITE}.; tone = max(tone, .8); }
    if (vW.z < -265. && vW.z > -405. && vW.y < 1.6) pal = ${P.SAND}.;
    if (vW.z < -405. && vW.y < 2.) pal = ${P.ROAD}.;
  }
  gl_FragColor = vec4(n.xy * .5 + .5, vDepth / ${FAR.toFixed(1)}, floor(pal + .5) * 2. + clamp(tone, 0., .999));
}`;

const POINTS_VERT = `
uniform float uTime;
uniform float uScale;
uniform float uFall;
attribute float aSeed;
varying float vDepth;
void main() {
  vec3 p = position;
  // drifting down and sideways, wrapping round inside its own box
  p.y = mod(position.y - uTime * uFall * (.6 + aSeed), 24.);
  p.x += sin(uTime * .7 + aSeed * 30.) * 1.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vDepth = -mv.z;
  gl_PointSize = min(uScale * (.6 + aSeed * .8) / max(-mv.z, 1.), 5.);
  gl_Position = projectionMatrix * mv;
}`;

const POINTS_FRAG = `
uniform float uPal;
varying float vDepth;
void main() {
  if (length(gl_PointCoord - .5) > .5) discard;
  gl_FragColor = vec4(.5, .5, vDepth / ${FAR.toFixed(1)}, uPal * 2. + .999);
}`;

const POST_VERT = `
void main() { gl_Position = vec4(position.xy, 0., 1.); }`;

const POST_FRAG = `
uniform sampler2D uBuf;
uniform vec2 uRes;
uniform vec4 uRect;  // the box being drawn, in device pixels: left, bottom, width, height
uniform float uScale; // device pixels per css pixel, so lines keep their weight on any screen
uniform float uTime;
uniform vec3 uPal[${PALETTE.length}];
const vec3 INK = vec3(.29, .39, .82);
const vec3 SKY_TOP = vec3(.79, .87, .97), SKY_LOW = vec3(.99, .9, .83);
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float hatch(vec2 px, float ang, float gap, float w) {
  vec2 d = vec2(cos(ang), sin(ang)), n = vec2(-d.y, d.x);
  float t = dot(px, d) / gap + (noise(px * .01) - .5) * 1.2;
  float line = 1. - smoothstep(w * .5, w, abs(fract(t + .5) - .5));
  return line * smoothstep(.32, .46, noise(vec2(dot(px, n) * .02, floor(t + .5) * 7.3)));
}
void main() {
  vec2 px = gl_FragCoord.xy / uScale;
  // the pen wanders a little off the true edge
  vec2 wob = (vec2(noise(px * .03 + 3.), noise(px * .03 + 9.)) - .5) * 1.6 * uScale / uRes;
  vec2 uv = gl_FragCoord.xy / uRes + wob;
  vec4 c = texture2D(uBuf, uv);
  float d = c.b;
  float dd = 0., nn = 0.;
  vec2 k = 1.15 * uScale / uRes;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    vec4 s = texture2D(uBuf, uv + vec2(float(i), float(j)) * k);
    dd = max(dd, abs(s.b - d) / max(min(s.b, d), .004));
    nn = max(nn, length(s.rg - c.rg));
  }
  float haze = smoothstep(.05, .45, d); // far things fade into the sky
  float line = max(smoothstep(.06, .14, dd), smoothstep(.22, .4, nn) * (1. - smoothstep(.3, .55, d)));
  // a sky from peach at the horizon to pale blue overhead, measured inside whichever box is being drawn
  float ly = clamp((gl_FragCoord.y - uRect.y) / uRect.w, 0., 1.);
  vec3 sky = mix(SKY_LOW, SKY_TOP, smoothstep(.25, 1., ly));
  vec3 col = sky;
  if (d < .999) {
    float id = floor(c.a / 2. + .0005), tone = c.a - id * 2.;
    vec3 base = uPal[int(id)];
    // soft cel shading: lit faces keep their colour, the far side cools towards lilac
    col = mix(base * vec3(.8, .8, .92), base, smoothstep(.2, .55, tone));
    // a few pen strokes only in the deepest shadow, so it still looks drawn
    col = mix(col, INK, hatch(px, .8, 7., .16) * (1. - smoothstep(.1, .22, tone)) * .3 * (1. - haze));
    if (id > .5 && id < 1.5) {
      // water: the sky in it, and long wavering strokes
      col = mix(col, sky, .3);
      float t = (px.y + sin(px.x * .045 + uTime * .8) * 2.2) / 6.;
      float ripple = (1. - smoothstep(.06, .16, abs(fract(t) - .5) - .3)) * smoothstep(.5, .66, noise(vec2(px.x * .012, floor(t) * 3.1 + uTime * .1)));
      col = mix(col, INK, ripple * .3 * (1. - haze));
    }
    col = mix(col, mix(SKY_LOW, sky, .4), haze * .85);
  }
  col = mix(col, INK, line * .8 * (1. - haze * .9));
  col *= .98 + .02 * noise(px * .35); // paper tooth
  gl_FragColor = vec4(col, 1.);
}`;

function paint(pal, { tone = 1, sway = 0, ground = false, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uPal: { value: pal }, uTone: { value: tone }, uSway: { value: sway }, uGround: { value: ground ? 1 : 0 }, uTime: { value: 0 } },
    vertexShader: SCENE_VERT, fragmentShader: SCENE_FRAG, side,
  });
}

// ---------- building the world ----------
const tmpColor = new THREE.Color();
/** Places copies of `geo`: each entry is [x, y, z, sx, sy, sz, ry, rx, rz, colour]; the colour is optional. */
function scatter(geo, mat, list, scene) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, pal], i) => {
    m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    mesh.setMatrixAt(i, m);
    // the colour index rides in the red channel; the shader reads it back as a number
    if (pal !== undefined) { tmpColor.r = pal; tmpColor.g = 0; tmpColor.b = 0; mesh.setColorAt(i, tmpColor); }
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/** A frond: a long strip bent down from where it leaves the trunk. uv.x runs out along it, which is what sways. */
function frondGeometry() {
  const g = new THREE.PlaneGeometry(3.6, 0.7, 8, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 1.8, y = p.getY(i);
    p.setXYZ(i, x, -0.08 * x * x, y * (1 - x / 4.2));
  }
  g.computeVertexNormals();
  return g;
}

/** A houseboat's hull: ten long and narrowing to both ends, the prow and stern swept up out of the water. */
function hullGeometry() {
  const g = new THREE.BoxGeometry(2.6, 1, 10, 1, 1, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), e = Math.abs(z) / 5;
    p.setXYZ(i, x * (1 - e ** 3 * 0.85), y + (y > 0 ? e ** 4 * 1.4 : e ** 2 * 0.5), z);
  }
  g.computeVertexNormals();
  return g;
}

/** A unit block whose walls lean in as they rise, as the whitewashed walls of a Himalayan monastery do. */
function leaningBlock(lean = 0.86) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * lean, Math.SQRT1_2, 1, 4, 1).toNonIndexed();
  g.rotateY(Math.PI / 4);
  g.computeVertexNormals();
  return g;
}

/** Prayer flags along a sagging line from a to b, in the five colours they always come in. */
function flagLine(a, b, count, sag, out) {
  const colours = [P.SKY, P.WHITE, P.CORAL, P.LEAF, P.BUTTER];
  const ry = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
  for (let f = 0; f < count; f++) {
    const t = (f + 0.5) / count;
    out.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag, a.z + (b.z - a.z) * t, 1, 1, 1, ry, 0, 0, colours[f % 5]]);
  }
}

function buildWorld(scene, mats) {
  const rnd = seeded(7);
  const landmarks = {};
  const box = new THREE.BoxGeometry(1, 1, 1);

  // ground: one sheet from the first valley to the hills behind the city, coloured by where it is
  const ground = new THREE.PlaneGeometry(300, 700, 150, 350);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, -260);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, height(gp.getX(i), gp.getZ(i)));
  ground.computeVertexNormals();
  scene.add(new THREE.Mesh(ground, mats.ground));
  const water = new THREE.PlaneGeometry(300, 700, 1, 1);
  water.rotateX(-Math.PI / 2);
  water.translate(0, -0.05, -260);
  scene.add(new THREE.Mesh(water, mats.water));

  // the road through the valley and, later, the boulevard through the city
  const road = (z0, z1, w) => {
    const segs = Math.round(Math.abs(z1 - z0));
    const pos = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const z = z0 + ((z1 - z0) * s) / segs, x = roadX(z);
      for (const side of [-1, 1]) pos.push(x + (side * w) / 2, height(x, z) + 0.06, z);
      if (s) { const a = (s - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, mats.road));
  };
  road(40, -130, 3.2);
  road(-405, -520, 6);

  // clouds high over the whole road: a few soft lumps each
  const clouds = [];
  for (let k = 0; k < 26; k++) {
    const z = 20 - rnd() * 560, x = roadX(z) + (rnd() - 0.5) * 160, y = 48 + rnd() * 22, s = 4 + rnd() * 5;
    for (let b = 0; b < 4; b++) clouds.push([x + (b - 1.5) * s * 0.9, y + (b % 2) * s * 0.3, z + (rnd() - 0.5) * s, s * (0.9 + rnd() * 0.5), s * 0.55, s * 0.8, rnd()]);
  }
  scatter(new THREE.SphereGeometry(1, 12, 8), mats.cloud, clouds, scene);

  // ----- mountains -----
  const pines = [], tops = [];
  for (let k = 0; k < 170; k++) {
    const z = 30 - rnd() * 165, dx = (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 34), x = roadX(z) + dx, h = height(x, z), s = 0.8 + rnd() * 0.5;
    if (h > 2 && h < 15) { pines.push([x, h + 1.3 * s, z, s, s, s, rnd() * 6]); tops.push([x, h + 3 * s, z, s, s, s, rnd() * 6]); }
  }
  scatter(new THREE.ConeGeometry(1.3, 2.6, 7), mats.pine, pines, scene);
  scatter(new THREE.ConeGeometry(0.9, 2.2, 7), mats.pine, tops, scene);

  // the monastery, after the ones in Spiti and Ladakh: whitewashed blocks stepping up the hillside, walls leaning in
  // as they rise, a maroon band under every flat roof, small dark windows under red lintels, gold on the highest hall
  const mz = MON.z, mx = MON.x + 6;
  const halls = [
    // [across, along, width, height, depth] from the foot of the hill, upwards
    [0, 0, 8, 4, 6], [3.5, 7, 5, 3, 5], [2, -7.5, 5.5, 3.4, 5], [-6, 3, 6, 4.4, 5.5], [-5, -5, 5, 3.6, 5],
    [-11, 7, 4.5, 3.2, 4.5], [-11, -1.5, 7, 5.2, 7], [-10.5, -10, 4.5, 3.2, 4.5], [-17, 3, 6, 4, 5],
  ];
  const walls = [], bands = [], parapets = [], wins = [], lintels = [];
  let top = null;
  halls.forEach(([ax, az, w, hh, d]) => {
    const x = mx + ax, z = mz + az;
    // the halls step up the terrace as they go back from the road; each stands on its own plinth
    const base = MON.y - 0.4, y = MON.y + Math.max(0, -ax) * 0.32, wall = y + hh - base;
    walls.push([x, base + wall / 2, z, w, wall, d]);
    bands.push([x, y + hh + 0.35, z, w * 0.88, 0.7, d * 0.88]);
    parapets.push([x, y + hh + 0.78, z, w * 0.9, 0.16, d * 0.9]);
    // windows on the face that looks down the valley
    const cols = Math.max(1, Math.floor(d / 1.8)), rows = hh > 3.6 ? 2 : 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wy = y + hh * (rows === 2 ? 0.32 + r * 0.33 : 0.5), wz = z - d / 2 + ((c + 0.5) * d) / cols;
      const face = x + (w / 2) * (1 - 0.14 * ((wy - y) / hh)) + 0.03;
      wins.push([face, wy, wz, 0.12, 0.85, 0.55]);
      lintels.push([face + 0.08, wy + 0.55, wz, 0.22, 0.18, 0.85]);
    }
    if (!top || y + hh > top.y) top = { x, y: y + hh, z, w, d };
  });
  scatter(leaningBlock(), mats.white, walls, scene);
  scatter(box, mats.maroon, bands, scene);
  scatter(box, mats.white, parapets, scene);
  scatter(box, mats.ink, wins, scene);
  scatter(box, mats.maroon, lintels, scene);
  // the highest hall wears a small golden roof with a finial
  scatter(new THREE.ConeGeometry(1, 1, 4), mats.gold, [[top.x, top.y + 2, top.z, top.w * 0.32, 1.5, top.d * 0.32, Math.PI / 4]], scene);
  scatter(new THREE.CylinderGeometry(0.12, 0.2, 1, 6), mats.gold, [[top.x, top.y + 3.3, top.z, 1, 1.6, 1]], scene);
  scatter(new THREE.SphereGeometry(0.35, 10, 8), mats.gold, [[top.x, top.y + 4.2, top.z, 1, 1, 1]], scene);
  landmarks.monastery = new THREE.Vector3(mx - 5, height(mx, mz) + 3, mz);
  const flags = [];
  flagLine({ x: top.x, y: top.y + 3.6, z: top.z }, { x: mx + 6, y: height(mx + 6, mz + 10) + 2, z: mz + 10 }, 18, 1.2, flags);
  flagLine({ x: top.x, y: top.y + 3.6, z: top.z }, { x: mx + 5, y: height(mx + 5, mz - 11) + 2, z: mz - 11 }, 18, 1.2, flags);

  // chortens along the road: a white base, a white dome, a gold spire
  const chorten = [];
  for (const z of [-22, -48, -104]) { const x = roadX(z) + 4.2, h = height(x, z); chorten.push([x, h, z]); }
  scatter(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 8), mats.white, chorten.map(([x, h, z]) => [x, h + 0.6, z, 1, 1, 1]), scene);
  scatter(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.white, chorten.map(([x, h, z]) => [x, h + 1.2, z, 1.1, 1.2, 1.1]), scene);
  scatter(new THREE.ConeGeometry(0.45, 2.2, 8), mats.gold, chorten.map(([x, h, z]) => [x, h + 3.2, z, 1, 1, 1]), scene);

  // prayer flags strung across the road
  const poles = [];
  for (const z of [-34, -88]) {
    const a = { x: roadX(z) - 9, z }, b = { x: roadX(z) + 9, z };
    a.y = height(a.x, z) + 7; b.y = height(b.x, z) + 7;
    poles.push([a.x, a.y - 3.5, z, 1, 7, 1], [b.x, b.y - 3.5, z, 1, 7, 1]);
    flagLine(a, b, 22, 2.2, flags);
  }
  const flagGeo = new THREE.PlaneGeometry(0.7, 0.55, 3, 1);
  flagGeo.translate(0.35, -0.3, 0);
  scatter(flagGeo, mats.flag, flags, scene);
  scatter(new THREE.CylinderGeometry(0.08, 0.1, 1, 5), mats.wood, poles, scene);
  landmarks.flags = new THREE.Vector3(roadX(-34), height(roadX(-34), -34) + 5, -34);

  // ----- backwaters -----
  const trunks = [], crowns = [];
  const palm = (x, z, lean) => {
    const h = height(x, z), tall = 6 + rnd() * 4;
    trunks.push([x, h + tall / 2, z, 1, tall, 1, 0, 0, lean]);
    const crown = [x - (Math.sin(lean) * tall) / 2, h + tall / 2 + (Math.cos(lean) * tall) / 2, z];
    for (let f = 0; f < 7; f++) crowns.push([crown[0], crown[1], crown[2], 1, 1, 1, (f / 7) * Math.PI * 2 + rnd(), 0, 0.1]);
  };
  for (let k = 0; k < 90; k++) {
    const z = -150 - rnd() * 115, side = rnd() < 0.5 ? -1 : 1, x = roadX(z) + side * (7.5 + rnd() * 22);
    palm(x, z, side * (0.12 + rnd() * 0.2));
  }
  for (let k = 0; k < 26; k++) {
    const z = -285 - rnd() * 100, x = roadX(z) - 6 - rnd() * 22;
    palm(x, z, -0.1 - rnd() * 0.2);
  }
  scatter(new THREE.CylinderGeometry(0.22, 0.35, 1, 6), mats.wood, trunks, scene);
  scatter(frondGeometry(), mats.frond, crowns, scene);
  // Kerala houseboats on the canal: a long wooden hull swept up at both ends, a little cabin, and an arched roof
  // of woven palm over it, all sitting on the water
  const hulls = [], cabins = [], roofs = [];
  [[-168, 1.2, P.PEACH], [-205, -1.5, P.MINT], [-246, 1.2, P.BLUSH]].forEach(([z, off, colour]) => {
    const x = roadX(z) + off, rot = Math.atan2(roadX(z - 1) - roadX(z + 1), -2);
    hulls.push([x, 0.2, z, 1, 1, 1, rot]);
    cabins.push([x, 1.1, z, 1.8, 0.8, 5, rot, 0, 0, colour]);
    roofs.push([x, 0.72, z, 1, 0.85, 1, rot]);
  });
  landmarks.houseboat = new THREE.Vector3(roadX(-205) - 1.5, 1, -205);
  scatter(hullGeometry(), mats.wood, hulls, scene);
  scatter(box, mats.white, cabins, scene);
  const roofGeo = new THREE.CylinderGeometry(1.3, 1.3, 6.4, 14, 1, true, Math.PI / 2, Math.PI); // the half that arches upwards
  roofGeo.rotateX(Math.PI / 2);
  scatter(roofGeo, mats.thatch, roofs, scene);
  // bushes crowding the banks
  const bushes = [];
  for (let k = 0; k < 140; k++) {
    const z = -148 - rnd() * 118, dx = (rnd() < 0.5 ? -1 : 1) * (6.5 + rnd() * 18), x = roadX(z) + dx, s = 0.8 + rnd() * 1.2;
    bushes.push([x, height(x, z) + 0.3 * s, z, s * 1.4, s * 0.9, s * 1.4, rnd() * 6]);
  }
  scatter(new THREE.SphereGeometry(1, 10, 7), mats.pine, bushes, scene);
  // huts on the banks, in sunwashed colours
  const huts = [], hutRoofs = [];
  for (let k = 0; k < 12; k++) {
    const z = -150 - rnd() * 115, x = roadX(z) + (rnd() < 0.5 ? -1 : 1) * (9 + rnd() * 10), h = height(x, z), r = rnd() * 3;
    huts.push([x, h + 1, z, 3, 2, 2.6, r, 0, 0, [P.PEACH, P.BLUSH, P.WHITE, P.MINT][k % 4]]);
    hutRoofs.push([x, h + 2.9, z, 2.6, 1.8, 2.3, r + Math.PI / 4]);
  }
  scatter(box, mats.white, huts, scene);
  scatter(new THREE.ConeGeometry(1, 1, 4), mats.wheat, hutRoofs, scene);

  // ----- coast -----
  const umbrellas = [], sticks = [];
  for (let k = 0; k < 22; k++) {
    const z = -285 - rnd() * 100, x = roadX(z) - 1 - rnd() * 7, h = height(x, z);
    sticks.push([x, h + 1.2, z, 1, 2.4, 1]);
    umbrellas.push([x, h + 2.5, z, 1, 1, 1, rnd(), 0, 0, [P.CORAL, P.BUTTER, P.SKY, P.BLUSH][k % 4]]);
  }
  scatter(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), mats.wood, sticks, scene);
  scatter(new THREE.ConeGeometry(1.5, 0.7, 8), mats.white, umbrellas, scene);
  const boats = [], sails = [];
  const sailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 3.6, 0)]);
  sailGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
  sailGeo.computeVertexNormals();
  for (let k = 0; k < 9; k++) {
    const z = -280 - rnd() * 110, x = roadX(z) + 14 + rnd() * 50;
    boats.push([x, 0.1, z, 1.2, 0.5, 3.6, rnd(), 0, 0, [P.CORAL, P.SKY, P.BUTTER][k % 3]]);
    sails.push([x, 0.35, z, 1, 1, 1, rnd()]);
  }
  scatter(box, mats.wood, boats, scene);
  scatter(sailGeo, mats.sail, sails, scene);
  // a lighthouse on a spit, banded coral
  const lz = -352, lx = roadX(lz) + 9, lh = Math.max(height(lx, lz), 0);
  landmarks.lighthouse = new THREE.Vector3(lx, lh + 6, lz);
  scatter(new THREE.CylinderGeometry(3, 3.4, 1.6, 10), mats.sand, [[lx, lh + 0.4, lz, 1, 1, 1]], scene);
  for (let b = 0; b < 4; b++) {
    const r0 = 1.5 - b * 0.18;
    scatter(new THREE.CylinderGeometry(r0 - 0.18, r0, 3, 12), b % 2 ? mats.coral : mats.white, [[lx, lh + 2.6 + b * 3, lz, 1, 1, 1]], scene);
  }
  scatter(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), mats.butter, [[lx, lh + 14.4, lz, 1, 1, 1]], scene);
  scatter(new THREE.ConeGeometry(1.2, 1.4, 10), mats.coral, [[lx, lh + 15.9, lz, 1, 1, 1]], scene);
  // the sun, low over the sea
  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 48), mats.sun);
  sun.position.set(roadX(-470) + 150, 22, -620);
  sun.lookAt(roadX(-330), 6, -330);
  scene.add(sun);

  // ----- city -----
  const towers = [], windows = [];
  for (let k = 0; k < 190; k++) {
    const z = -410 - rnd() * 125, side = rnd() < 0.5 ? -1 : 1, a = 7 + rnd() * 58, x = roadX(z) + side * a;
    const w = 3 + rnd() * 4, d = 3 + rnd() * 4, tall = 3 + rnd() * (a < 25 ? 10 : 26) * (1 - a / 90);
    const h = height(x, z);
    towers.push([x, h + tall / 2, z, w, tall, d, 0, 0, 0, BUILDINGS[k % BUILDINGS.length]]);
    // windows on the face that looks at the street
    const face = x - side * (w / 2 + 0.03);
    for (let r = 1.4; r < tall - 0.8; r += 1.9) for (let c = -d / 2 + 0.9; c < d / 2 - 0.5; c += 1.3) windows.push([face, h + r, z + c, 0.08, 0.9, 0.6]);
  }
  scatter(box, mats.white, towers, scene);
  scatter(box, mats.glass, windows, scene);
  // the old town: domes and minarets
  const domes = [], drums = [], minarets = [];
  for (let k = 0; k < 6; k++) {
    const z = -420 - k * 17, x = roadX(z) + (k % 2 ? 1 : -1) * (12 + rnd() * 6), h = height(x, z), r = 2.4 + rnd() * 1.4;
    drums.push([x, h + 2, z, r, 4, r]);
    domes.push([x, h + 4, z, r, r * 1.15, r, 0, 0, 0, k % 2 ? P.MINT : P.GOLD]);
    minarets.push([x + r + 1.6, h + 6, z, 1, 12, 1]);
  }
  scatter(new THREE.CylinderGeometry(1, 1, 1, 14), mats.white, drums, scene);
  scatter(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.white, domes, scene);
  scatter(new THREE.CylinderGeometry(0.4, 0.55, 1, 8), mats.white, minarets, scene);
  // one tall tower with a coral tip, the city's landmark
  const tz = -488, tx = roadX(tz) + 26, th = height(tx, tz);
  landmarks.tower = new THREE.Vector3(tx, th + 22, tz);
  scatter(new THREE.CylinderGeometry(1.3, 4.5, 46, 6), mats.lilac, [[tx, th + 23, tz, 1, 1, 1]], scene);
  scatter(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 10), mats.white, [[tx, th + 33, tz, 1, 1, 1]], scene);
  scatter(new THREE.CylinderGeometry(0.2, 0.5, 9, 6), mats.coral, [[tx, th + 50, tz, 1, 1, 1]], scene);
  const lamps = [];
  for (let z = -410; z > -530; z -= 7) for (const side of [-1, 1]) { const x = roadX(z) + side * 4, h = height(x, z); lamps.push([x, h + 3.2, z, 0.35, 0.35, 0.35]); }
  scatter(new THREE.SphereGeometry(1, 8, 6), mats.butter, lamps, scene);

  // drifting things: snow in the hills, leaves on the canal, petals in the city
  const drift = [];
  [[-60, 0.9, 0.06, 220, P.WHITE], [-205, 0.35, 0.08, 90, P.LEAF], [-465, 0.3, 0.07, 80, P.CORAL]].forEach(([zc, fall, size, count, pal]) => {
    const pos = [], seed = [];
    for (let k = 0; k < count; k++) {
      const z = zc + (rnd() - 0.5) * 120;
      pos.push(roadX(z) + (rnd() - 0.5) * 70, rnd() * 24, z);
      seed.push(rnd());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uFall: { value: fall }, uPal: { value: pal } }, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG });
    m.userData.size = size;
    const pts = new THREE.Points(g, m);
    pts.position.y = zc < -150 ? 0 : 2;
    pts.frustumCulled = false;
    scene.add(pts);
    drift.push(pts);
  });
  return { landmarks, drift };
}

// ---------- the camera along the road ----------
const lift = (z) => { const [m, b, s, c] = zoneWeights(z); return m * 6.5 + b * 3.2 + s * 4.6 + c * 12; };
function camAt(t) {
  const z = Z_START + (Z_END - Z_START) * t;
  const x = roadX(z) - zoneWeights(z)[2] * 4;
  const y = Math.max(height(roadX(z), z), 0) + lift(z) + 13 * (1 - smooth(0, 0.07, t)); // the opening shot starts high
  const az = z - 28, ax = roadX(az) + zoneWeights(z)[2] * 9;
  return { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(ax, Math.max(height(roadX(az), az), 0) + lift(az) * 0.55, az) };
}

// each live window watches one landmark, circling it slowly
const VIEWS = {
  mountains: { at: "monastery", r: 44, y: 10, a: 0.35 },
  backwaters: { at: "houseboat", r: 19, y: 3.5, a: 0.1 },
  beaches: { at: "lighthouse", r: 26, y: 4, a: -1.9 },
  cities: { at: "tower", r: 46, y: -6, a: 2.3 },
  flags: { at: "flags", r: 14, y: 1, a: 2.6 },
};

/**
 * The world, drawn on a canvas of its own inside `host`. `setProgress(t)` moves the camera along the road (0 to 1).
 * `watch(el, key)` makes the element a live window: the world, seen from that view, is drawn into the element's box.
 */
export function createInkWorld(host, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
  host.appendChild(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, FAR);
  const winCam = new THREE.PerspectiveCamera(38, 1, 0.5, FAR);

  const mats = {
    ground: paint(P.GRASS, { ground: true }),
    water: paint(P.WATER),
    road: paint(P.ROAD),
    cloud: paint(P.WHITE),
    pine: paint(P.LEAF),
    white: paint(P.WHITE),
    ink: paint(P.INK),
    maroon: paint(P.MAROON),
    gold: paint(P.GOLD),
    wood: paint(P.WOOD),
    wheat: paint(P.WHEAT),
    thatch: paint(P.WHEAT, { side: THREE.DoubleSide }),
    sand: paint(P.SAND),
    coral: paint(P.CORAL),
    butter: paint(P.BUTTER),
    lilac: paint(P.LILAC),
    glass: paint(P.SKY),
    frond: paint(P.LEAF, { sway: 1, side: THREE.DoubleSide }),
    flag: paint(P.WHITE, { sway: 1, side: THREE.DoubleSide }),
    sail: paint(P.WHITE, { side: THREE.DoubleSide }),
    sun: paint(P.BUTTER, { side: THREE.DoubleSide }),
  };
  const { landmarks, drift } = buildWorld(scene, mats);

  // a 32-bit buffer where the device has one, so colour index and light never blur into each other
  const fullFloat = renderer.extensions.has("EXT_color_buffer_float");
  const buf = new THREE.WebGLRenderTarget(1, 1, { type: fullFloat ? THREE.FloatType : THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const post = new THREE.ShaderMaterial({
    uniforms: {
      uBuf: { value: buf.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uScale: { value: dpr }, uTime: { value: 0 }, uPal: { value: PALETTE.map(hexRGB) },
    },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let W = 1, H = 1;
  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    buf.setSize(Math.round(W * dpr), Math.round(H * dpr));
    post.uniforms.uRes.value.set(Math.round(W * dpr), Math.round(H * dpr));
    const perUnit = (H * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (const p of drift) p.material.uniforms.uScale.value = p.material.userData.size * perUnit;
  };
  resize();
  window.addEventListener("resize", resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => { pointer.tx = e.clientX / window.innerWidth - 0.5; pointer.ty = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener("pointermove", onMove, { passive: true });

  const windows = new Map(); // element -> view key
  let target = 0, shown = 0, active = false, raf = 0, last = performance.now(), clock = 0;
  const allMats = [...Object.values(mats), ...drift.map((p) => p.material)];
  const clearColor = new THREE.Color(0.5, 0.5, 1);

  // draw the world from `cam` into the box (css px, from the top left), or the whole screen
  const draw = (cam, box) => {
    const x = box ? box.left * dpr : 0, y = box ? (H - box.bottom) * dpr : 0, w = (box ? box.width : W) * dpr, h = (box ? box.height : H) * dpr;
    buf.viewport.set(x, y, w, h); buf.scissor.set(x, y, w, h); buf.scissorTest = true;
    renderer.setRenderTarget(buf);
    renderer.setClearColor(clearColor, 1); // alpha 1: three premultiplies the clear colour, and 0 would wipe out the 'nothing here' depth
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    post.uniforms.uRect.value.set(x, y, w, h);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(!!box);
    if (box) renderer.setScissor(box.left, H - box.bottom, box.width, box.height);
    renderer.render(postScene, postCam);
    renderer.setScissorTest(false);
  };

  // build every shader now, so the first scroll into the journey doesn't stall
  renderer.compile(scene, camera);
  renderer.compile(postScene, postCam);

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!active || document.hidden) return;
    if (!reduced) clock += dt;
    // ease towards where the scroll says we are, so the camera glides rather than jumps
    shown += (target - shown) * (1 - Math.exp(-dt * 4));
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
    for (const m of allMats) if (m.uniforms.uTime) m.uniforms.uTime.value = clock;
    post.uniforms.uTime.value = clock;

    const { pos, look } = camAt(shown);
    camera.position.copy(pos).add(new THREE.Vector3(pointer.x * 3, -pointer.y * 1.5, 0));
    camera.lookAt(look);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    draw(camera);

    for (const [el, key] of windows) {
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > H || box.width < 4) continue;
      const v = VIEWS[key], c = landmarks[v.at];
      const a = v.a + clock * 0.06 + pointer.x * 0.5;
      winCam.position.set(c.x + Math.cos(a) * v.r, c.y + v.y - pointer.y * 2, c.z + Math.sin(a) * v.r);
      winCam.lookAt(c);
      winCam.aspect = box.width / box.height;
      winCam.updateProjectionMatrix();
      draw(winCam, box);
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    setProgress(t) { target = Math.min(Math.max(t, 0), 1); },
    setActive(on) { active = on; },
    watch(el, key) { windows.set(el, key); return () => windows.delete(el); },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => { o.geometry?.dispose(); });
      allMats.forEach((m) => m.dispose());
      post.dispose(); quad.geometry.dispose(); buf.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
