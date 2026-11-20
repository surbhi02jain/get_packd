import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// "How it works" as a glowing loop on a navy blueprint: operators (a cube) feed getPackd (a sphere of departures),
// which lines them up as your shortlist (stacked panels), which sends you back to book with the operator.
// Scroll moves the camera from one node to the next. HTML labels in the container follow their 3D anchors.

const NAVY = "#2a3748";
const GLOW = "#e4fbfa";
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function glowTexture(inner = "rgba(220,255,252,1)", mid = "rgba(150,230,230,0.35)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(tex, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

const lineMat = (opacity = 1, color = GLOW) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

function makeCube(tex) {
  const g = new THREE.Group();
  const size = 1.45;
  const box = new THREE.BoxGeometry(size, size, size);
  g.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: "#7fc9cf", transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat(1)));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 0.92, size * 0.92, size * 0.92)), lineMat(0.25)));
  // a little circuit on three faces: a ring in the middle and traces running to the edges
  const h = size / 2 + 0.001, pts = [];
  const faces = [
    (u, v) => [u, h, v], (u, v) => [h, u, v], (u, v) => [u, v, h],
  ];
  for (const f of faces) {
    for (let a = 0; a < 24; a++) {
      const t0 = (a / 24) * Math.PI * 2, t1 = ((a + 1) / 24) * Math.PI * 2;
      pts.push(...f(Math.cos(t0) * 0.16, Math.sin(t0) * 0.16), ...f(Math.cos(t1) * 0.16, Math.sin(t1) * 0.16));
    }
    pts.push(...f(0.16, 0), ...f(0.5, 0), ...f(0.5, 0), ...f(0.5, 0.3));
    pts.push(...f(-0.16, 0), ...f(-0.45, 0), ...f(0, -0.16), ...f(0, -0.5), ...f(0, -0.5), ...f(-0.3, -0.5));
    pts.push(...f(0, 0.16), ...f(0, 0.42), ...f(0, 0.42), ...f(0.25, 0.42));
  }
  const det = new THREE.BufferGeometry();
  det.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(det, lineMat(0.55)));
  const core = glowSprite(tex, 0.9, 0.9);
  g.add(core);
  g.add(glowSprite(tex, 3.4, 0.25));
  g.rotation.set(0.62, 0.78, 0);
  return g;
}

function makeSphere(tex) {
  const g = new THREE.Group();
  const R = 0.95, N = 1700;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = R * (0.25 + 0.75 * Math.pow(Math.random(), 0.35));
    pos[i * 3] = s * Math.cos(th) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = s * Math.sin(th) * r;
    size[i] = 1 + Math.pow(Math.random(), 3) * 4; seed[i] = Math.random() * 6.28;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pg.setAttribute("size", new THREE.BufferAttribute(size, 1));
  pg.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float size; attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.55 + 0.45 * sin(uTime * 2.0 + seed);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale * (6.0 / -mv.z);
      }`,
    fragmentShader: `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.93, 1.0, 1.0), vA * smoothstep(0.5, 0.1, d)); }`,
  });
  const points = new THREE.Points(pg, pm);
  g.add(points);
  // a fresnel shell gives the bright rim
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 64, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(0.0, dot(vN, vV)), 2.6); gl_FragColor = vec4(vec3(0.75, 0.97, 0.95), f * 0.95 + 0.04); }`,
  }));
  g.add(shell);
  g.add(glowSprite(tex, 4.2, 0.22));
  return { group: g, material: pm };
}

function makePanels(tex) {
  const g = new THREE.Group();
  const specs = [[0.5, 0.66, -0.95, -0.42], [0.74, 1.0, -0.15, -0.1], [1.08, 1.46, 0.85, 0.3]];
  const corners = [];
  for (const [w, h, x, y] of specs) {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    corners.push({ obj: p, local: new THREE.Vector3(-w / 2, h / 2, 0) });
    p.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: "#8fd8d6", transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })));
    p.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), lineMat(1)));
    const dashed = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineDashedMaterial({ color: "#cfeeee", dashSize: 0.035, gapSize: 0.03, transparent: true, opacity: 0.8 }));
    dashed.computeLineDistances();
    dashed.position.set(0.06, -0.05, -0.12);
    p.add(dashed);
    g.add(p);
  }
  const core = glowSprite(tex, 0.7, 1);
  core.position.set(0.95, 0.42, 0.05);
  g.add(core);
  g.add(glowSprite(tex, 3.6, 0.2));
  g.rotation.set(0.12, -0.72, 0.04);
  g.userData.corners = corners;
  return g;
}

function arc(points, { arrow = true, nodes = [] } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.013, 6, false), new THREE.MeshBasicMaterial({ color: GLOW })));
  if (arrow) {
    const end = curve.getPoint(1), tan = curve.getTangent(1);
    const side = new THREE.Vector3(-tan.y, tan.x, 0).normalize();
    const back = end.clone().addScaledVector(tan, -0.16);
    for (const s of [1, -1]) {
      const tip = back.clone().addScaledVector(side, 0.1 * s);
      const seg = new THREE.LineCurve3(end, tip);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(seg, 2, 0.013, 6, false), new THREE.MeshBasicMaterial({ color: GLOW })));
    }
  }
  for (const t of nodes) {
    const p = curve.getPoint(t);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.07, 32), new THREE.MeshBasicMaterial({ color: GLOW }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.046, 32), new THREE.MeshBasicMaterial({ color: NAVY }));
    ring.position.copy(p); fill.position.copy(p); ring.position.z += 0.002;
    g.add(fill, ring);
  }
  return { group: g, curve };
}

function comet(tex) {
  const g = new THREE.Group();
  const head = glowSprite(tex, 0.42, 1);
  g.add(head);
  const tail = [];
  for (let i = 0; i < 14; i++) { const s = glowSprite(tex, 0.3 - i * 0.016, 0.7 - i * 0.045); tail.push(s); g.add(s); }
  return { group: g, head, tail };
}

function leader(from, to) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
  return new THREE.Line(g, lineMat(0.6));
}

export const ANCHORS = {
  cube: [-3.55, -0.05, 0], sphere: [0.75, 2.42, 0], panels: [3.75, -2.35, 0],
  "i-dates": [-0.55, 2.05, 0], "i-price": [2.15, 2.1, 0], "i-group": [-0.45, 0.25, 0],
  // the panel tags are placed from the panels' own corners once the scene is built
  "p-dates": [0, 0, 0], "p-price": [0, 0, 0], "p-incl": [0, 0, 0],
};

export function createLoopScene(canvas, container, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NAVY);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const tex = glowTexture();

  // blueprint grid behind everything
  const gp = [];
  for (let x = -12; x <= 12; x += 2.4) gp.push(x, -9, -1.6, x, 9, -1.6);
  for (let y = -9; y <= 9; y += 3.3) gp.push(-12, y, -1.6, 12, y, -1.6);
  const grid = new THREE.BufferGeometry();
  grid.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  scene.add(new THREE.LineSegments(grid, new THREE.LineBasicMaterial({ color: "#41536a" })));

  const CUBE = new THREE.Vector3(-2.7, -1.15, 0), SPH = new THREE.Vector3(0.75, 1.15, 0), PAN = new THREE.Vector3(2.75, -1.2, 0);
  const cube = makeCube(tex); cube.position.copy(CUBE); scene.add(cube);
  const sphere = makeSphere(tex); sphere.group.position.copy(SPH); scene.add(sphere.group);
  const panels = makePanels(tex); panels.position.copy(PAN); scene.add(panels);

  const arcs = [
    arc([[-2.05, -0.3, 0], [-1.25, 0.35, 0], [-0.25, 0.92, 0]], { nodes: [0.3, 0.72] }),
    arc([[1.75, 1.32, 0], [3.1, 1.25, 0], [3.75, 0.45, 0], [3.35, -0.2, 0]], { nodes: [0.35, 0.8] }),
    arc([[1.6, -2.05, 0], [0.2, -2.45, 0], [-1.4, -2.4, 0], [-2.35, -2.0, 0]], { nodes: [0.25, 0.6] }),
  ];
  arcs.forEach((a) => scene.add(a.group));
  const comets = arcs.map(() => comet(tex));
  comets.forEach((c) => scene.add(c.group));

  // short leader lines from the sphere and the panels out to their HTML icons
  const L = { ...ANCHORS };
  [["i-dates", [0.05, 1.75, 0]], ["i-price", [1.55, 1.65, 0]], ["i-group", [0.1, 0.6, 0]]]
    .forEach(([k, from]) => scene.add(leader(from, [L[k][0] + (L[k][0] > 0.75 ? -0.16 : 0.16), L[k][1] + (L[k][1] > 1.15 ? -0.07 : 0.07), 0])));
  // each panel gets a short leader up and to the left from its top-left corner, ending at its tag
  panels.updateMatrixWorld(true);
  ["p-dates", "p-price", "p-incl"].forEach((k, i) => {
    const { obj, local } = panels.userData.corners[i];
    const c = obj.localToWorld(local.clone());
    const tag = c.clone().add(new THREE.Vector3(-0.42, 0.34, 0));
    scene.add(leader([c.x, c.y, c.z], [tag.x + 0.05, tag.y - 0.05, tag.z]));
    L[k] = [tag.x - 0.32, tag.y + 0.02, tag.z];
  });

  const labels = [...container.querySelectorAll("[data-anchor]")].map((el) => ({ el, v: new THREE.Vector3(...(L[el.dataset.anchor] || [0, 0, 0])) }));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.5);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const KEYS = {
    overview: { p: new THREE.Vector3(0.35, -0.2, 10.6), t: new THREE.Vector3(0.35, -0.2, 0) },
    cube: { p: new THREE.Vector3(-1.75, -0.55, 5.4), t: new THREE.Vector3(-2.2, -0.85, 0) },
    sphere: { p: new THREE.Vector3(1.35, 0.85, 4.9), t: new THREE.Vector3(1.0, 0.95, 0) },
    panels: { p: new THREE.Vector3(2.05, -0.8, 5.3), t: new THREE.Vector3(2.45, -0.95, 0) },
  };
  const ORDER = [[0, "overview"], [0.1, "cube"], [0.28, "cube"], [0.4, "sphere"], [0.6, "sphere"], [0.72, "panels"], [0.9, "panels"], [1, "overview"]];
  const state = { progress: 0, w: 1, h: 1, fit: 1, pointer: { x: 0, y: 0 }, sp: { x: 0, y: 0 }, running: true };
  const camP = new THREE.Vector3(), camT = new THREE.Vector3(), tmp = new THREE.Vector3();

  function cameraAt(p) {
    for (let i = 0; i < ORDER.length - 1; i++) {
      const [a, ka] = ORDER[i], [b, kb] = ORDER[i + 1];
      if (p <= b || i === ORDER.length - 2) {
        const k = smooth(a, b, p);
        camP.lerpVectors(KEYS[ka].p, KEYS[kb].p, k);
        camT.lerpVectors(KEYS[ka].t, KEYS[kb].t, k);
        return;
      }
    }
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    state.w = Math.max(1, r.width); state.h = Math.max(1, r.height);
    renderer.setSize(state.w, state.h, false);
    composer.setSize(state.w, state.h);
    camera.aspect = state.w / state.h;
    camera.updateProjectionMatrix();
    state.fit = Math.max(1, 1.62 / camera.aspect);
    sphere.material.uniforms.uScale.value = dpr;
  }
  resize();

  const start = performance.now();
  let raf = 0, last = start;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!state.running) { last = now; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    // the first frame's timestamp can be a touch earlier than `start`
    const t = Math.max(0, (now - start) / 1000);
    state.sp.x += (state.pointer.x - state.sp.x) * 0.05;
    state.sp.y += (state.pointer.y - state.sp.y) * 0.05;

    cameraAt(state.progress);
    // pull back on narrow panels so the whole loop still fits
    tmp.subVectors(camP, camT).multiplyScalar(state.fit);
    camera.position.copy(camT).add(tmp);
    camera.position.x += state.sp.x * 0.25; camera.position.y += -state.sp.y * 0.18;
    camera.lookAt(camT);

    if (!reduced) {
      cube.rotation.y += dt * 0.18;
      sphere.group.rotation.y += dt * 0.12;
      panels.position.y = PAN.y + Math.sin(t * 0.9) * 0.04;
    }
    sphere.material.uniforms.uTime.value = t;
    comets.forEach((c, i) => {
      const u = (((t * 0.16 + i / 3) % 1) + 1) % 1;
      const { curve } = arcs[i];
      c.head.position.copy(curve.getPoint(u));
      c.tail.forEach((s, k) => { const uu = Math.max(0, u - (k + 1) * 0.008); s.position.copy(curve.getPoint(uu)); });
      const fade = Math.min(1, u * 8, (1 - u) * 8);
      c.head.material.opacity = fade;
      c.tail.forEach((s, k) => { s.material.opacity = fade * (0.7 - k * 0.045); });
    });

    composer.render();

    // HTML labels follow their anchors
    for (const l of labels) {
      tmp.copy(l.v).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * state.w, y = (-tmp.y * 0.5 + 0.5) * state.h;
      const inside = tmp.z < 1 && x > -40 && x < state.w + 40 && y > -20 && y < state.h + 20;
      l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      l.el.style.opacity = inside ? "1" : "0";
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    resize,
    setProgress(p) { state.progress = p; },
    setPointer(x, y) { state.pointer.x = x; state.pointer.y = y; },
    setRunning(v) { state.running = v; },
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); });
      tex.dispose();
      composer.dispose?.();
      renderer.dispose();
    },
  };
}
