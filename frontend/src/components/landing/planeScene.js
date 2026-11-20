import * as THREE from "three";

// The hero's WebGL layer: a folded paper plane flying up and to the right, trailing a stream of sparkling dust.
// The sky and the clouds are DOM layers around it; this canvas is transparent.

const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function paperPlane() {
  // forward is +Z, up is +Y; a dart with a crease along each wing and a keel folded underneath
  const N = [0, 0, 1.55], T = [0, 0.02, -0.9];
  const WL = [-1.02, 0.2, -0.98], WR = [1.02, 0.2, -0.98];
  const ML = [-0.3, 0.05, -0.93], MR = [0.3, 0.05, -0.93];
  const KL = [-0.025, -0.4, -0.86], KR = [0.025, -0.4, -0.86];
  const wing = new THREE.Color("#ffece2"), inner = new THREE.Color("#fbd6cb"), keel = new THREE.Color("#e2bcd9"), keel2 = new THREE.Color("#efcde0");
  const tris = [
    [N, ML, T, inner], [N, WL, ML, wing],
    [N, T, MR, inner], [N, MR, WR, wing],
    [N, T, KL, keel], [N, KR, T, keel2],
  ];
  const pos = [], col = [];
  for (const [a, b, c, k] of tris) {
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) col.push(k.r, k.g, k.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, roughness: 1, metalness: 0 });
  return new THREE.Mesh(g, m);
}

const MAX = 3200;

function trailPoints() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
  g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(MAX), 1));
  g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX), 1));
  g.setAttribute("tone", new THREE.BufferAttribute(new Float32Array(MAX), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
      attribute float alpha; attribute float size; attribute float tone;
      varying float vA; varying float vT;
      uniform float uScale;
      void main() {
        vA = alpha; vT = tone;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale;
      }`,
    fragmentShader: `
      varying float vA; varying float vT;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        if (d > 0.5) discard;
        vec3 a = vec3(1.0, 0.975, 0.86), b = vec3(0.98, 0.86, 0.6);
        gl_FragColor = vec4(mix(a, b, vT), vA * smoothstep(0.5, 0.2, d));
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export function createPlaneScene(canvas, { intro = true, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.AmbientLight("#fff3ee", 1.55));
  const key = new THREE.DirectionalLight("#fff8f0", 1.45);
  key.position.set(-2, 4, 6);
  scene.add(key);
  scene.add(new THREE.HemisphereLight("#d8d4ff", "#ffc8a6", 0.7));

  const plane = paperPlane();
  const rig = new THREE.Group();
  rig.add(plane);
  scene.add(rig);
  const trail = trailPoints();
  scene.add(trail);

  const P = trail.geometry.attributes.position.array, A = trail.geometry.attributes.alpha.array;
  const S = trail.geometry.attributes.size.array, TONE = trail.geometry.attributes.tone.array;
  const vel = new Float32Array(MAX * 3), age = new Float32Array(MAX).fill(99), life = new Float32Array(MAX), tw = new Float32Array(MAX);
  let head = 0;

  // where the plane sits on screen (fractions of the hero) and how it points
  const dir = new THREE.Vector3(1, 0.78, 0.22).normalize();
  const baseQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const rollQ = new THREE.Quaternion().setFromAxisAngle(dir, -0.55);
  const restQ = rollQ.multiply(baseQ);
  const state = { w: 1, h: 1, visW: 1, visH: 1, pointer: { x: 0, y: 0 }, sp: { x: 0, y: 0 }, scroll: 0, rest: new THREE.Vector3(), scale: 1, running: true };
  const tailLocal = new THREE.Vector3(0, -0.05, -0.9);
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const perp1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
  const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();

  function toWorld(fx, fy, out) {
    return out.set((fx - 0.5) * state.visW, (0.5 - fy) * state.visH, 0);
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    state.w = Math.max(1, r.width); state.h = Math.max(1, r.height);
    renderer.setSize(state.w, state.h, false);
    camera.aspect = state.w / state.h;
    camera.updateProjectionMatrix();
    state.visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    state.visW = state.visH * camera.aspect;
    const narrow = state.w < 700;
    toWorld(narrow ? 0.5 : 0.475, narrow ? 0.56 : 0.6, state.rest);
    state.scale = Math.min(state.visW * (narrow ? 0.15 : 0.074), state.visH * 0.135);
    trail.material.uniforms.uScale.value = dpr * (narrow ? 0.85 : 1);
  }
  resize();

  const start = performance.now();
  const flyInAt = intro && !reduced ? 0.75 : -10;
  let last = start, raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!state.running) { last = now; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const t = Math.max(0, (now - start) / 1000);

    // pointer parallax eases towards the cursor
    state.sp.x += (state.pointer.x - state.sp.x) * 0.05;
    state.sp.y += (state.pointer.y - state.sp.y) * 0.05;

    // fly in from the lower left during the intro, then hover; scrolling sends it off to the upper right
    const k = easeOut((t - flyInAt) / 1.5);
    const from = toWorld(-0.25, 1.35, tmp.clone());
    rig.position.lerpVectors(from, state.rest, k);
    const bob = reduced ? 0 : Math.sin(t * 1.15) * 0.06;
    rig.position.y += bob + state.sp.y * -0.12;
    rig.position.x += state.sp.x * 0.16;
    const away = Math.pow(state.scroll, 1.4) * state.visW * 0.75;
    rig.position.addScaledVector(dir, away);
    rig.scale.setScalar(state.scale * (1 + state.scroll * 0.35));
    e.set(state.sp.y * 0.12 + (reduced ? 0 : Math.sin(t * 0.8) * 0.04), state.sp.x * -0.18, reduced ? 0 : Math.sin(t * 0.65) * 0.07);
    q.setFromEuler(e);
    rig.quaternion.copy(restQ).premultiply(q);

    // emit dust from the tail; it keeps its world position, so the stream draws the path behind the plane
    if (!reduced || t < 3) {
      const rate = state.scroll > 0.95 ? 0 : 1100;
      const n = Math.floor(rate * dt + Math.random());
      const tail = plane.localToWorld(tailLocal.clone());
      const speed = state.visH * 0.21;
      for (let i = 0; i < n; i++) {
        const j = head; head = (head + 1) % MAX;
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.05 * state.scale;
        P[j * 3] = tail.x + Math.cos(a) * rr; P[j * 3 + 1] = tail.y + Math.sin(a) * rr; P[j * 3 + 2] = tail.z;
        const sp = speed * (0.75 + Math.random() * 0.5), spread = state.visH * 0.022;
        const s1 = (Math.random() - 0.5) * 2 * spread, s2 = (Math.random() - 0.5) * 2 * spread;
        vel[j * 3] = -dir.x * sp + perp1.x * s1 + perp2.x * s2;
        vel[j * 3 + 1] = -dir.y * sp + perp1.y * s1 + perp2.y * s2;
        vel[j * 3 + 2] = -dir.z * sp + perp1.z * s1 + perp2.z * s2;
        age[j] = 0; life[j] = 2.2 + Math.random() * 1.4; tw[j] = Math.random() * 6.28;
        S[j] = 1.4 + Math.pow(Math.random(), 2.2) * 3.2; TONE[j] = Math.random();
      }
    }
    for (let j = 0; j < MAX; j++) {
      if (age[j] > life[j]) { A[j] = 0; continue; }
      age[j] += dt;
      P[j * 3] += vel[j * 3] * dt; P[j * 3 + 1] += vel[j * 3 + 1] * dt - 0.02 * dt; P[j * 3 + 2] += vel[j * 3 + 2] * dt;
      const u = age[j] / life[j];
      A[j] = Math.max(0, (1 - u) * Math.min(1, age[j] * 8)) * (0.55 + 0.45 * Math.sin(t * 7 + tw[j]));
    }
    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.alpha.needsUpdate = true;
    trail.geometry.attributes.size.needsUpdate = true;
    trail.geometry.attributes.tone.needsUpdate = true;

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    resize,
    setPointer(x, y) { state.pointer.x = x; state.pointer.y = y; },
    setScroll(p) { state.scroll = p; },
    setRunning(v) { state.running = v; },
    dispose() {
      cancelAnimationFrame(raf);
      plane.geometry.dispose(); plane.material.dispose();
      trail.geometry.dispose(); trail.material.dispose();
      renderer.dispose();
    },
  };
}
