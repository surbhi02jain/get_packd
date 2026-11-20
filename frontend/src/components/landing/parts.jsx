import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { loadImage, makeBalloon, makeCloud, stipplePhoto } from "./stipple";

/** Mounts a canvas produced by `make` (sync or async) and stretches it over the box. */
export function Stipple({ make, deps = [], className = "", style }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(make)
      .then((c) => {
        if (!alive || !c || !ref.current) return;
        Object.assign(c.style, { width: "100%", height: "100%", display: "block" });
        ref.current.replaceChildren(c);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div ref={ref} className={`lp-cloud ${className}`} style={style} aria-hidden />;
}

export const Cloud = ({ seed, w = 560, h = 240, flat, className, style }) => (
  <Stipple make={() => makeCloud({ width: w, height: h, seed, flat })} deps={[seed, w, h]} className={className} style={{ aspectRatio: `${w} / ${h}`, ...style }} />
);

export const Balloon = ({ seed = 3, className, style }) => (
  <Stipple make={() => makeBalloon({ width: 220, height: 300, seed })} deps={[seed]} className={className} style={{ aspectRatio: "220 / 300", ...style }} />
);

export const StipplePhoto = ({ url, seed = 7, w = 560, h = 460, mask = "blob", keep, className, style }) => (
  <Stipple make={async () => stipplePhoto(await loadImage(url), { width: w, height: h, seed, mask, keep })} deps={[url, seed, w, h, mask]} className={className} style={style} />
);

/** getPackd's backpack-with-a-tick, drawn as a single-colour line mark for this page. */
export function PackMark({ className = "h-5 w-5", stroke = 2.1 }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.3 8.6V7.2a3.7 3.7 0 0 1 7.4 0v1.4" />
      <rect x="6.6" y="8.6" width="18.8" height="19.6" rx="5.6" />
      <path d="M7.2 14.4 Q16 17.6 24.8 14.4" />
      <rect x="10.8" y="18" width="10.4" height="6.8" rx="2" />
      <path d="M13.5 21.4l1.8 1.6 3.1-3.2" />
    </svg>
  );
}

export const Wordmark = ({ className = "" }) => <span className={`font-['Newsreader'] font-medium tracking-[-0.02em] ${className}`}>getPackd</span>;

const LINKS = [["Trips", "/search"], ["Operators", "/operators"], ["Visas", "/visas"]];

/**
 * Full-width bar over the hero; once the page scrolls it gathers into a small centred pill (mark, links, two buttons).
 */
export function LandingNav({ visible }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <motion.header
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -10 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ visibility: visible ? "visible" : "hidden" }}
      data-testid="landing-nav"
    >
      <nav
        className="pointer-events-auto flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(.65,0,.35,1)]"
        style={compact
          ? { width: "min(640px, calc(100vw - 24px))", marginTop: 12, padding: "6px 6px 6px 12px", borderRadius: 6, background: "rgba(252,253,246,.88)", boxShadow: "0 1px 0 rgba(31,40,54,.04), 0 8px 24px rgba(31,40,54,.08)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }
          : { width: "100%", marginTop: 0, padding: "16px clamp(16px, 1.6vw, 24px)", borderRadius: 0, background: "rgba(252,253,246,0)", boxShadow: "none" }}
      >
        <div className="flex items-center gap-[clamp(18px,2.3vw,34px)]">
          <Link to="/landing" className="flex items-center gap-1.5 text-[#1f2836]" aria-label="getPackd home" data-testid="landing-logo">
            <PackMark className="h-[21px] w-[21px]" />
            <span className="overflow-hidden whitespace-nowrap transition-all duration-500" style={{ maxWidth: compact ? 0 : 120, opacity: compact ? 0 : 1 }}>
              <Wordmark className="text-[19px]" />
            </span>
          </Link>
          <div className="hidden items-center gap-[clamp(18px,2.3vw,34px)] md:flex">
            {LINKS.map(([l, to]) => (
              <Link key={l} to={to} className="font-['Inter_Tight'] text-[13px] font-medium tracking-[-0.01em] text-[#2b3240] transition-opacity hover:opacity-60">{l}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/list-your-departures" className="lp-btn lp-btn-peach lp-btn-sm hidden sm:inline-flex">List Your Trips</Link>
          <Link to="/search" className="lp-btn lp-btn-butter lp-btn-sm">Find A Trip</Link>
        </div>
      </nav>
    </motion.header>
  );
}

/** The thin column of ticks at the right edge that tracks how far down the page you are. */
export function ScrollTicks() {
  const bar = useRef(null);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? window.scrollY / max : 0;
        if (bar.current) bar.current.style.transform = `translateY(${p * 70}px)`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="pointer-events-none fixed right-[10px] top-1/2 z-40 hidden -translate-y-1/2 mix-blend-difference md:block" aria-hidden>
      <div className="relative flex h-[86px] flex-col justify-between">
        {Array.from({ length: 8 }).map((_, i) => <span key={i} className="block h-[5px] w-[2px] bg-white/35" />)}
        <span ref={bar} className="absolute left-0 top-0 block h-[16px] w-[2px] bg-white" />
      </div>
    </div>
  );
}
