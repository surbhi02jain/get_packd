import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/SearchBar";
import { Reveal } from "@/components/Decor";
import { InkTitle, useInkPage } from "@/components/Ink";
// the 3D book (three.js) downloads on its own, so the headline and search show while it loads
const Sketchbook = lazy(() => import("@/components/Sketchbook"));
import Journal from "@/components/Journal";
import { http } from "@/lib/api";
import { SKETCHES } from "@/lib/sketches";

const searchFor = (d) => `/search?q=${encodeURIComponent(d.destination)}`;

// ---------- hero ----------
const AUTO_MS = 5000;

const Chevron = ({ flip }) => (
  <svg viewBox="0 0 18 44" className="h-11 w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden>
    <path d={flip ? "M2 2 L16 22 L2 42" : "M16 2 L2 22 L16 42"} />
  </svg>
);

function Hero({ dests, stats }) {
  const ref = useRef(null);
  const nav = useNavigate();
  const reduced = useReducedMotion();
  // a landmark for every destination that has departures (lib/sketches.js), alternating between abroad and India
  const spreads = useMemo(() => {
    const by = new Map(dests.map((d) => [d.slug, d]));
    return SKETCHES.filter((s) => by.has(s.dest)).map((s) => {
      const d = by.get(s.dest);
      return {
        slug: s.id, destination: d.destination, stamp: s.stamp, price: d.min_price, image: s.src, credit: s.credit,
        label: s.where ? `${s.place} · ${s.where}` : s.place,
      };
    });
  }, [dests]);
  const n = spreads.length;
  const [idx, setIdx] = useState(0);
  // the spread on the open pages: it follows idx once the book has painted and turned to it, so the caption under the
  // book never names a place before its picture is there
  const [shownIdx, setShownIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const step = useCallback((d) => n && setIdx((i) => (i + d + n) % n), [n]);
  const open = useCallback((i) => spreads[i] && nav(searchFor(spreads[i])), [spreads, nav]);
  const cur = spreads[shownIdx];
  // the name tucks behind the top of the book and the place sits under it, wherever the book lands on this screen
  const [box, setBox] = useState(null);
  const narrow = box?.width < 640;
  const nameSize = box ? (narrow ? box.width * 0.2 : Math.min(box.width * 0.125, box.height * 0.26)) : 0;

  // the book leafs on by itself, counting from when a page is shown; any turn by hand restarts the wait. It stops for
  // the pause button, while the pointer is on the book, and with reduced motion
  useEffect(() => {
    if (n < 2 || reduced || paused || hovering) return undefined;
    const t = setTimeout(() => step(1), AUTO_MS);
    return () => clearTimeout(t);
  }, [idx, shownIdx, n, reduced, paused, hovering, step]);
  useEffect(() => {
    const onKey = (e) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r || r.bottom < window.innerHeight / 2 || e.target.closest?.("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return (
    <section ref={ref} data-testid="home-hero" className="relative z-10 flex min-h-[100svh] flex-col overflow-hidden bg-[#f8f4ec]">
      <Navbar overlay />
      {/* the stage: the book, the name out of focus behind it, an arrow either side and the place underneath */}
      <div className="relative h-[66svh] min-h-[470px] shrink-0">
        {/* the name, out of focus behind the book: decoration (the page's heading is the line under the book) */}
        <p aria-hidden className={`pointer-events-none absolute inset-x-0 select-none text-center font-['Jost'] font-medium leading-none tracking-[.01em] text-coral/75 blur-[7px] transition-opacity duration-700 ${box ? "" : "opacity-0"}`}
          style={{ top: box ? box.top - nameSize * (narrow ? 0.85 : 0.6) : 0, fontSize: nameSize || "12vw" }}>getPackd</p>

        <div onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)} onPointerLeave={() => setHovering(false)} className="absolute inset-0 z-10">
          <Suspense fallback={null}>
            <Sketchbook spreads={spreads} index={idx} reduced={reduced} fill={0.56} lower={0.13} onOpen={open} onStep={step} onLayout={setBox} onShown={setShownIdx} className="absolute inset-0" />
          </Suspense>
        </div>

        {[-1, 1].map((d) => (
          <button key={d} onClick={() => step(d)} data-testid={d < 0 ? "hero-prev" : "hero-next"} aria-label={d < 0 ? "Previous destination" : "Next destination"}
            className={`absolute z-20 -translate-y-1/2 p-3 text-[#898d90] transition-colors hover:text-[#16181b] ${d < 0 ? "left-[1.5%]" : "right-[1.5%]"}`}
            style={{ top: box ? (box.top + box.bottom) / 2 : "57%" }}><Chevron flip={d > 0} /></button>
        ))}

        <div className="absolute inset-x-0 z-20 flex items-center justify-center px-4" style={{ top: box ? box.bottom + 20 : "85%" }}>
          <AnimatePresence mode="wait">
            {cur && (
              <motion.div key={cur.slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <Link to={searchFor(cur)} data-testid="hero-place" title={cur.credit ? `Sketched from a photo by ${cur.credit.by} (${cur.credit.license})` : undefined} className="text-[11px] uppercase tracking-[.14em] text-[#5f656b] transition-colors hover:text-[#16181b] sm:text-[12px]">{cur.label}</Link>
              </motion.div>
            )}
          </AnimatePresence>
          {n > 1 && !reduced && (
            <button onClick={() => setPaused((p) => !p)} data-testid="hero-pause" aria-pressed={paused} aria-label={paused ? "Play the sketchbook" : "Pause the sketchbook"}
              className="ml-3 grid h-6 w-6 place-items-center text-[#5f656b] transition-colors hover:text-[#16181b]">
              <svg viewBox="0 0 10 12" className="h-3 w-2.5" fill="currentColor" aria-hidden>{paused ? <path d="M1 0 L10 6 L1 12 Z" /> : <><rect x="0" y="0" width="3" height="12" /><rect x="6" y="0" width="3" height="12" /></>}</svg>
            </button>
          )}
        </div>
      </div>

      {/* where to next, and the search */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-4 pt-6 sm:px-8">
        <WhereNext className="w-full" testId="hero-what" atTop stats={stats} />
        <button onClick={() => document.getElementById("home-below")?.scrollIntoView({ behavior: "smooth" })} data-testid="hero-scroll" aria-label="Scroll down"
          className="mt-auto p-2 pb-6 pt-8 text-[#a8acaf] transition-colors hover:text-[#16181b]">
          <svg viewBox="0 0 30 16" className="h-4 w-[30px]" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden><path d="M1 1 L15 8 L29 1 M1 8 L15 15 L29 8" /></svg>
        </button>
      </div>
    </section>
  );
}

// ---------- where to next ----------
const FadeIn = ({ children, delay = 0, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.7 }} className={className}>{children}</motion.div>
);

/**
 * What getPackd is, in one line under the sketchbook, and the search right under it. At the top (`atTop`) the text and
 * search fade in on load, because a scroll-triggered reveal can leave the search bar hidden just below the fold.
 */
function WhereNext({ className = "", testId, atTop = false, stats }) {
  const Fade = atTop ? FadeIn : Reveal;
  return (
    <div className={`text-center ${className}`} data-testid={testId}>
      <InkTitle as="h1" ink="compared.">Every group trip in India,</InkTitle>
      <Fade delay={0.1}>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#5b6066]">
          {stats ? `${stats.departures.toLocaleString("en-IN")} departures from ${stats.operators} operators` : "Every operator's departures"}, with dates and prices read from their own sites. Find the one that fits, then book with the operator.
        </p>
      </Fade>
      <Fade delay={0.2} className="mx-auto mt-10 max-w-[1040px] text-left"><SearchBar /></Fade>
    </div>
  );
}

export default function Home() {
  useInkPage();
  const { data } = useQuery({ queryKey: ["home"], queryFn: () => http.get("/home").then((r) => r.data) });
  const dests = data?.destinations || [];
  // no loading screen: the search is there at once, and the book shows its blank pages until the first spread is painted
  return (
    <MotionConfig reducedMotion="user">
      {/* one sheet of warm paper from top to bottom: the sketchbook and the search, then two back pages of the same
          journal (the trip styles and the next departures) */}
      <div className="overflow-x-clip bg-[#f8f4ec] font-['Jost'] text-[#16181b]">
        <main id="main">
          <Hero dests={dests} stats={data?.stats} />
          <Journal styles={data?.styles} />
        </main>
        <div className="relative z-10"><Footer /></div>
      </div>
    </MotionConfig>
  );
}
