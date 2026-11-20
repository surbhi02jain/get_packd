import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { createPlaneScene } from "./planeScene";
import { Cloud, Wordmark } from "./parts";

const ease = [0.22, 1, 0.36, 1];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

// the intro window, as [time, left, right, top, bottom] in fractions of the screen
const CELL = [
  [0, 0.5, 0.5, 0.5, 0.5],
  [0.3, 0.5, 0.5, 0.5, 0.5],
  [0.62, 0.365, 0.645, 0.27, 0.73],
  [1.45, 0.315, 0.69, 0.23, 0.775],
  [2.0, 0.065, 0.935, 0.055, 0.945],
  [2.3, 0, 1, 0, 1],
];
const INTRO_END = 2.35;

function cellAt(t) {
  for (let i = 0; i < CELL.length - 1; i++) {
    const a = CELL[i], b = CELL[i + 1];
    if (t <= b[0]) {
      const k = smooth(clamp((t - a[0]) / (b[0] - a[0])));
      return [1, 2, 3, 4].map((j) => a[j] + (b[j] - a[j]) * k);
    }
  }
  return CELL[CELL.length - 1].slice(1);
}

/**
 * Cream sheet with a cross of hairlines; the cross opens into a window onto the sky, the name shows over it, and the
 * window grows until the sky fills the screen. Labels ride the window's corners.
 */
function Intro({ onDone }) {
  const root = useRef(null);
  const els = useRef({});
  useEffect(() => {
    const start = performance.now();
    let raf = 0, done = false;
    const finish = () => { if (!done) { done = true; onDone(); } };
    const tick = (now) => {
      const t = (now - start) / 1000;
      const [l, r, tp, b] = cellAt(t);
      const W = window.innerWidth, H = window.innerHeight;
      const e = els.current;
      if (e.top) {
        e.top.style.height = `${tp * 100}%`;
        e.bottom.style.top = `${b * 100}%`;
        Object.assign(e.left.style, { top: `${tp * 100}%`, height: `${(b - tp) * 100}%`, width: `${l * 100}%` });
        Object.assign(e.right.style, { top: `${tp * 100}%`, height: `${(b - tp) * 100}%`, left: `${r * 100}%` });
        e.vl.style.left = `${l * 100}%`; e.vr.style.left = `${r * 100}%`;
        e.ht.style.top = `${tp * 100}%`; e.hb.style.top = `${b * 100}%`;
        const lineFade = 1 - clamp((t - 1.9) / 0.35);
        [e.vl, e.vr, e.ht, e.hb].forEach((x) => { x.style.opacity = lineFade; });
        e.la.style.transform = `translate(${l * W - 8}px, ${tp * H - 6}px) translate(-100%, -100%)`;
        e.lb.style.transform = `translate(${r * W + 8}px, ${b * H + 6}px)`;
        e.la.style.opacity = e.lb.style.opacity = 1 - clamp((t - 2.05) / 0.25);
        const wm = clamp((t - 0.4) / 0.22) * (1 - clamp((t - 1.5) / 0.3));
        e.wm.style.opacity = wm;
        e.wm.style.filter = `blur(${(1 - wm) * 8}px)`;
      }
      if (t >= INTRO_END) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => { cancelAnimationFrame(raf); finish(); };
    const node = root.current;
    node?.addEventListener("click", skip);
    return () => { cancelAnimationFrame(raf); node?.removeEventListener("click", skip); };
  }, [onDone]);

  const set = (k) => (el) => { els.current[k] = el; };
  const sheet = "absolute bg-[#f8f9eb]";
  const label = "absolute left-0 top-0 whitespace-nowrap font-['Newsreader'] text-[11.5px] text-[#8b8e84]";
  return (
    <div ref={root} className="fixed inset-0 z-[70] cursor-pointer" data-testid="landing-intro" aria-hidden>
      <div ref={set("top")} className={`${sheet} inset-x-0 top-0`} style={{ height: "50%" }} />
      <div ref={set("bottom")} className={`${sheet} inset-x-0 bottom-0`} style={{ top: "50%" }} />
      <div ref={set("left")} className={`${sheet} left-0`} />
      <div ref={set("right")} className={`${sheet} right-0`} />
      <div ref={set("vl")} className="absolute inset-y-0 w-px bg-[#dfe2cd]" style={{ left: "50%" }} />
      <div ref={set("vr")} className="absolute inset-y-0 w-px bg-[#dfe2cd]" style={{ left: "50%" }} />
      <div ref={set("ht")} className="absolute inset-x-0 h-px bg-[#dfe2cd]" style={{ top: "50%" }} />
      <div ref={set("hb")} className="absolute inset-x-0 h-px bg-[#dfe2cd]" style={{ top: "50%" }} />
      <span ref={set("la")} className={label}>Group Trips</span>
      <span ref={set("lb")} className={label}>Side By Side</span>
      <div ref={set("wm")} className="absolute inset-0 flex items-center justify-center opacity-0">
        <Wordmark className="text-[clamp(64px,12.5vw,210px)] leading-none text-[#1f2836]" />
      </div>
    </div>
  );
}

/** The two halves of the headline: staggered with the plane between them, merging into one line as you scroll. */
function useHeadline(card, l1, l2, progress) {
  const sizes = useRef({ w1: 0, w2: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      sizes.current = { w1: l1.current?.offsetWidth || 0, w2: l2.current?.offsetWidth || 0, h: l1.current?.offsetHeight || 0 };
      place(progress.current);
    };
    const place = (p) => {
      const c = card.current;
      if (!c || !l1.current || !l2.current) return;
      const W = c.clientWidth, H = c.clientHeight, { w1, w2, h } = sizes.current;
      const narrow = W < 700;
      const gap = h * 0.24;
      let a, b;
      if (narrow) {
        a = { x: Math.max(16, W * 0.07), y: H * 0.31 };
        b = { x: Math.min(W - 16, W * 0.93) - w2, y: H * 0.31 + h * 0.98 };
      } else {
        a = { x: W * 0.531 - w1, y: H * 0.433 - h / 2 };
        b = { x: W * 0.542, y: H * 0.57 - h / 2 };
      }
      const k = narrow ? 0 : smooth(clamp(p * 1.15));
      const left = (W - (w1 + gap + w2)) / 2, y = H * 0.47 - h / 2;
      l1.current.style.transform = `translate3d(${a.x + (left - a.x) * k}px, ${a.y + (y - a.y) * k}px, 0)`;
      l2.current.style.transform = `translate3d(${b.x + (left + w1 + gap - b.x) * k}px, ${b.y + (y - b.y) * k}px, 0)`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (card.current) ro.observe(card.current);
    document.fonts?.ready.then(measure);
    progress.place = place;
    return () => ro.disconnect();
  }, [card, l1, l2, progress]);
}

export default function SkyHero({ stats, reduced, onReveal }) {
  const [phase, setPhase] = useState(reduced ? "shown" : "intro");
  // stable, so a re-render (the data arriving) can't restart the intro
  const endIntro = useCallback(() => setPhase("shown"), []);
  const section = useRef(null), card = useRef(null), canvas = useRef(null), l1 = useRef(null), l2 = useRef(null);
  const clouds = useRef([]);
  const scene = useRef(null);
  const progress = useRef(0);
  useHeadline(card, l1, l2, progress);

  // the plane scene
  useEffect(() => {
    let s;
    try { s = createPlaneScene(canvas.current, { intro: !reduced, reduced }); } catch { return undefined; } // no WebGL: sky and clouds only
    scene.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(card.current);
    const io = new IntersectionObserver(([e]) => s.setRunning(e.isIntersecting), { threshold: 0 });
    io.observe(section.current);
    return () => { ro.disconnect(); io.disconnect(); s.dispose(); scene.current = null; };
  }, [reduced]);

  // pointer parallax for the plane and the clouds, and the scroll-out
  useEffect(() => {
    let raf = 0, px = 0, py = 0, sx = 0, sy = 0;
    const onMove = (e) => { px = (e.clientX / window.innerWidth) * 2 - 1; py = (e.clientY / window.innerHeight) * 2 - 1; scene.current?.setPointer(px, py); };
    const start = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const t = (now - start) / 1000;
      sx += (px - sx) * 0.04; sy += (py - sy) * 0.04;
      const vh = window.innerHeight;
      const p = clamp(window.scrollY / (vh * 0.75));
      if (p !== progress.current) {
        progress.current = p;
        progress.place?.(p);
        scene.current?.setScroll(p);
        const c = card.current;
        if (c) {
          const m = p * 16;
          c.style.inset = `${m * 0.6}px ${m}px 0 ${m}px`;
          c.style.borderRadius = `${p * 14}px`;
        }
      }
      clouds.current.forEach((el, i) => {
        if (!el) return;
        const depth = [10, 6, 16][i] || 8;
        const drift = reduced ? 0 : Math.sin(t * 0.12 + i * 1.7) * 10;
        el.style.transform = `translate3d(${drift - sx * depth}px, ${-sy * depth * 0.6 - p * (i === 2 ? 60 : 24)}px, 0)`;
      });
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); };
  }, [reduced]);

  // keep the page still while the intro plays
  useEffect(() => {
    if (phase !== "intro") return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => { document.documentElement.style.overflow = prev; };
  }, [phase]);

  const shown = phase !== "intro";
  useEffect(() => { if (shown) onReveal?.(); }, [shown, onReveal]);

  const deps = stats?.departures?.toLocaleString("en-IN");
  const fade = (delay, y = 0) => ({ initial: { opacity: 0, y }, animate: shown ? { opacity: 1, y: 0 } : { opacity: 0, y }, transition: { duration: 0.9, delay, ease } });
  const blurIn = (delay) => ({
    initial: { opacity: 0, filter: "blur(16px)" },
    animate: shown ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: "blur(16px)" },
    transition: { duration: 1.1, delay, ease },
  });
  const line = "absolute left-0 top-0 whitespace-nowrap font-['Inter_Tight'] text-[clamp(46px,6.6vw,116px)] font-medium leading-[1.02] tracking-[-0.045em] text-[#1f2836] will-change-transform";

  return (
    <section ref={section} className="relative h-[100svh] min-h-[560px] bg-[var(--paper)]" data-testid="landing-hero">
      {phase === "intro" && <Intro onDone={endIntro} />}
      <div ref={card} className="lp-sky lp-grain absolute inset-0 overflow-hidden" style={{ inset: 0 }}>
        {/* clouds behind the plane */}
        <div ref={(el) => (clouds.current[0] = el)} className="absolute left-[-4%] top-[46%] w-[29%] min-w-[180px]"><Cloud seed={4} w={600} h={250} /></div>
        <div ref={(el) => (clouds.current[1] = el)} className="absolute left-[68%] top-[29%] w-[19%] min-w-[130px]"><Cloud seed={9} w={520} h={190} flat={0.86} /></div>

        <div ref={l1} className={line} style={{ opacity: 1 }}><motion.span className="inline-block" {...blurIn(0.05)}>Group trips</motion.span></div>
        <div ref={l2} className={line}><motion.span className="inline-block" {...blurIn(0.35)}>side by side</motion.span></div>

        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />

        {/* the cloud in front, which the dust trail runs behind */}
        <div ref={(el) => (clouds.current[2] = el)} className="absolute left-[35%] top-[83%] w-[33%] min-w-[220px]"><Cloud seed={21} w={640} h={260} /></div>

        <motion.div {...fade(0.25)} className="absolute inset-x-0 top-[26.5%] flex justify-center px-4 sm:top-[28%]">
          <span className="rounded-full border border-[#c9a28c]/80 bg-white/10 px-3 py-[5px] font-['Newsreader'] text-[12px] text-[#5d4a40]">One Search For Every Group Trip</span>
        </motion.div>

        <motion.div {...fade(0.7, 10)} className="absolute bottom-[7%] left-4 right-4 sm:left-auto sm:right-[clamp(16px,1.6vw,24px)] sm:w-[clamp(240px,23vw,330px)]">
          <p className="font-['Newsreader'] text-[15px] leading-[1.38] text-[#47454b]">
            getPackd lines up {deps ? `${deps} group departures` : "every group departure"}{stats?.operators ? ` from ${stats.operators} operators` : ""}, so you can compare them side by side.
          </p>
          <Link to="/search" className="lp-btn lp-btn-navy mt-4" data-testid="hero-find">Find A Trip</Link>
        </motion.div>
      </div>
    </section>
  );
}
