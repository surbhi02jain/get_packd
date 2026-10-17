import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion, useInView, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Compass, Users, ShieldCheck, Scale, Search, Map as MapIcon, LayoutGrid, Sparkles, Footprints, MoveRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/SearchBar";
import { SampleBadge, Counter } from "@/components/Motion";
import { EASE, Reveal, Star, Glow, Kicker, SplitHeading, EllipseLink, Tilt, CountUp, Frame } from "@/components/Decor";
import { MapView } from "@/components/Views";
import { StatusPill } from "@/components/DepartureCard";
import { VerifiedStamp } from "@/components/TripBits";
import { http } from "@/lib/api";
import { STYLES } from "@/lib/constants";
import { short, fmtRange, inr } from "@/lib/format";

const DEMO = "/search?start=2026-11-01&end=2026-11-08&flex=0&as=solo_woman&max_price=100000";
const SLIDE_MS = 6000;
const searchFor = (d) => `/search?q=${encodeURIComponent(d.destination)}`;
const placeLabel = (d) => (d.dtype === "domestic" ? "India" : d.country);

// ---------- hero ----------
const BIRD_UP = "M0 6 Q6 -2 12 6 Q18 -2 24 6";
const BIRD_DOWN = "M0 4 Q6 9 12 6 Q18 9 24 4";
const FLOCK = [[0, 10, 1], [34, 24, 0.8], [62, 4, 0.7], [92, 30, 0.6], [16, 44, 0.65]];

/** A small flock that flaps its way across the sky every half minute or so. */
function Birds() {
  return (
    <motion.svg aria-hidden viewBox="0 0 130 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      className="pointer-events-none absolute left-0 top-[19%] z-[4] w-28 text-white/80 sm:w-40"
      initial={{ x: "-20vw" }} animate={{ x: "110vw", y: [0, -30, 10, -20, 0] }} transition={{ duration: 30, delay: 2.5, repeat: Infinity, repeatDelay: 5, ease: "linear" }}>
      {FLOCK.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <motion.path d={BIRD_UP} animate={{ d: [BIRD_UP, BIRD_DOWN, BIRD_UP] }} transition={{ duration: 0.55 + i * 0.06, repeat: Infinity, ease: "easeInOut" }} />
        </g>
      ))}
    </motion.svg>
  );
}

/** Warm motes that drift up and blink, like fireflies at dusk. */
function Fireflies({ count = 24 }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="firefly" style={{
          left: `${(i * 37 + 11) % 100}%`, top: `${36 + ((i * 53) % 60)}%`, width: 3 + (i % 3), height: 3 + (i % 3),
          animationDuration: `${7 + (i % 5) * 2}s`, animationDelay: `${-i * 1.7}s`,
        }} />
      ))}
    </div>
  );
}

/** One destination name. It measures itself and shrinks to fit the line, so long names are never cut off. */
function Word({ text, wait }) {
  const probe = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const el = probe.current;
      if (!el) return;
      const room = el.parentElement.clientWidth * 0.96;
      setScale(el.offsetWidth > room ? room / el.offsetWidth : 1);
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text]);
  return (
    <motion.span initial="hidden" animate="show" exit="exit" transition={{ staggerChildren: 0.045, delayChildren: wait }} className="absolute inset-0 flex items-center justify-center whitespace-nowrap">
      <span ref={probe} aria-hidden className="invisible absolute px-[0.04em]">{text}</span>
      <span className="relative inline-block" style={{ fontSize: `${scale}em` }}>
        {Array.from(text).map((ch, i) => (
          <motion.span key={i} className="sheen inline-block" style={{ animationDelay: `${i * 0.12}s` }} variants={{
            hidden: { y: "105%", opacity: 0, rotate: 12, filter: "blur(10px)" },
            show: { y: 0, opacity: 1, rotate: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 160, damping: 18 } },
            exit: { y: "-105%", opacity: 0, filter: "blur(8px)", transition: { duration: 0.25 } },
          }}>{ch === " " ? " " : ch}</motion.span>
        ))}
        {/* underline sits below the descenders and is wiped in from the left */}
        <motion.svg aria-hidden viewBox="0 0 300 12" preserveAspectRatio="none" fill="none" className="absolute -bottom-[0.07em] left-[4%] h-[0.09em] min-h-[5px] w-[92%] text-amber"
          variants={{ hidden: { clipPath: "inset(0% 100% 0% 0%)", opacity: 1 }, show: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, delay: wait + 0.45, ease: "easeInOut" } }, exit: { opacity: 0, transition: { duration: 0.15 } } }}>
          <path d="M2 8 C 60 1, 150 13, 298 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </motion.svg>
      </span>
    </motion.span>
  );
}

/** The destination name: letters rise out of a blur, a gold glint runs across them, and an underline draws itself. */
function RotatingWord({ text }) {
  // the first word waits for the curtain to open
  const first = useRef(true);
  useEffect(() => { first.current = false; }, []);
  return (
    <span className="relative block h-[1.22em] w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <Word key={text} text={text} wait={first.current ? 1.1 : 0} />
      </AnimatePresence>
    </span>
  );
}

function Hero({ dests, stats }) {
  const ref = useRef(null);
  // three destinations across the price range, preferring the ones we have our own full-size photo for
  const slides = useMemo(() => {
    const withPhoto = dests.filter((d) => d.image);
    const s = withPhoto.filter((d) => d.curated).length >= 3 ? withPhoto.filter((d) => d.curated) : withPhoto;
    return s.length > 3 ? [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]] : s;
  }, [dests]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const cur = slides[idx % (slides.length || 1)];

  // hold the curtain until the first photo has loaded (or give up waiting after a moment)
  useEffect(() => {
    const giveUp = setTimeout(() => setReady(true), 3500);
    if (slides.length) {
      const img = new Image();
      img.onload = () => setReady(true);
      img.src = slides[0].image;
    }
    return () => clearTimeout(giveUp);
  }, [slides]);

  useEffect(() => {
    if (!ready || slides.length < 2 || paused) return undefined;
    new Image().src = slides[(idx + 1) % slides.length].image;
    const t = setTimeout(() => setIdx((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, slides, paused, ready]);

  // scrolling away: the photo shrinks into a rounded card while the words and cards drift off together
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const shrink = useTransform(scrollYProgress, [0, 1], [1, 0.86]);
  const radius = useTransform(scrollYProgress, [0, 0.5], [0, 44]);
  const zoom = useTransform(scrollYProgress, [0, 1], [1, 1.2]);

  // cursor: the photo drifts against it, and a pool of light follows it
  const mx = useMotionValue(0), my = useMotionValue(0);
  const px = useSpring(useTransform(mx, (v) => v * -30), { stiffness: 60, damping: 20 });
  const py = useSpring(useTransform(my, (v) => v * -20), { stiffness: 60, damping: 20 });
  const lx = useSpring(useMotionValue(typeof window === "undefined" ? 600 : window.innerWidth / 2), { stiffness: 120, damping: 24 });
  const ly = useSpring(useMotionValue(280), { stiffness: 120, damping: 24 });
  const spotlight = useMotionTemplate`radial-gradient(460px circle at ${lx}px ${ly}px, rgba(0,0,0,0.12), rgba(0,0,0,1) 100%)`;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5);
    lx.set(e.clientX - r.left); ly.set(e.clientY - r.top);
  };
  // each new photo opens as a circle growing out of its own card
  const wipeX = slides.length > 1 ? 22 + (56 * idx) / (slides.length - 1) : 50;
  const wide = "max-w-[1040px] xl:max-w-[min(1040px,calc(76vw-3.5rem))] xl:px-0";

  return (
    <section ref={ref} data-testid="home-hero" className="relative flex min-h-[100svh] flex-col overflow-hidden bg-midnight text-white" onMouseMove={onMove}>
      <Navbar overlay />

      <motion.div className="absolute inset-0 overflow-hidden" style={{ scale: shrink, borderRadius: radius }}>
        {/* the curtain: the first photo opens from a small window in the middle of the page */}
        <motion.div className="absolute inset-0" initial={false}
          animate={ready ? { clipPath: "inset(0% 0% 0% 0% round 0px)", scale: 1 } : { clipPath: "inset(30% 36% 30% 36% round 28px)", scale: 1.25 }}
          transition={{ duration: 1.7, ease: [0.76, 0, 0.24, 1] }}>
          <motion.div className="absolute -inset-10" style={{ x: px, y: py, scale: zoom }}>
            <AnimatePresence initial={false}>
              {cur && (
                <motion.div key={cur.slug} className="absolute inset-0"
                  initial={ready ? { clipPath: `circle(0% at ${wipeX}% 88%)` } : false} animate={{ clipPath: `circle(150% at ${wipeX}% 88%)` }}
                  exit={{ opacity: 0.99, transition: { duration: 1.5 } }} transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }}>
                  <motion.img src={cur.image} alt="" className="h-full w-full object-cover" initial={{ scale: 1.25 }} animate={{ scale: 1.04 }} transition={{ duration: SLIDE_MS / 1000 + 2, ease: "easeOut" }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <div className="absolute inset-0 bg-midnight/25" />
          <motion.div className="absolute inset-0 bg-midnight/50" style={{ maskImage: spotlight, WebkitMaskImage: spotlight }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(7,20,28,.65)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-midnight/90 to-transparent" />
          {/* mist drifting through */}
          <motion.div aria-hidden className="absolute top-[24%] h-32 w-[55vw] rounded-full bg-white/10 blur-3xl" animate={{ x: ["-60vw", "110vw"] }} transition={{ duration: 46, repeat: Infinity, ease: "linear" }} />
          <motion.div aria-hidden className="absolute top-[55%] h-40 w-[70vw] rounded-full bg-white/[0.07] blur-3xl" animate={{ x: ["110vw", "-80vw"] }} transition={{ duration: 62, repeat: Infinity, ease: "linear" }} />
          <Birds />
          <Fireflies />
        </motion.div>
      </motion.div>
      <motion.div style={{ opacity: fade }} className="pointer-events-none absolute inset-0">{ready && <Frame navTop={88} />}</motion.div>

      {!ready && <div className="absolute inset-0 z-10 grid place-items-center"><Star size={34} className="text-amber" /></div>}

      {ready && (
        <motion.div style={{ y: contentY, opacity: fade }} className={`relative z-10 mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 pb-6 pt-[100px] text-center ${wide}`}>
          <motion.div initial={{ opacity: 0, letterSpacing: "0.9em" }} animate={{ opacity: 1, letterSpacing: "0.38em" }} transition={{ delay: 0.9, duration: 1.2, ease: EASE }} className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase text-white/80">
            <span>Skyscanner for group trips</span><span className="tracking-normal"><SampleBadge /></span>
          </motion.div>
          <h1 className="mt-3 w-full font-elegant">
            <span className="block overflow-hidden pb-[0.1em] text-[clamp(1.6rem,3.3vw,3.25rem)] leading-[1.1] [text-shadow:0_2px_24px_rgba(7,20,28,.5)]">
              <motion.span className="block" initial={{ y: "115%" }} animate={{ y: 0 }} transition={{ duration: 1, ease: EASE, delay: 1.0 }}>Find your people in</motion.span>
            </span>
            <span className="block text-[clamp(3.5rem,min(18vw,21vh),11.5rem)] leading-[1.02]"><RotatingWord text={cur ? cur.destination : "the wild"} /></span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 0.7 }} className="mt-4 max-w-xl text-sm text-white/85 sm:text-base [@media(max-height:800px)]:hidden">
            Every group trip, one honest price. Compare <b><Counter value={stats?.departures} /></b> fixed departures from Indian operators, with prices read from their own sites.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.6, type: "spring", stiffness: 90, damping: 16 }} className="mt-6 w-full text-left text-foreground">
            <SearchBar />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-white/60">Try:</span>
            <Link to={DEMO} data-testid="hero-demo-search" className="rounded-full border border-white/30 bg-midnight/30 px-3 py-1 backdrop-blur transition-colors hover:border-amber hover:text-amber">Anywhere · 1–8 Nov · Solo woman · up to ₹1L</Link>
            <Link to="/trips/spiti-group-trips-october" data-testid="hero-try-spiti" className="rounded-full border border-white/30 bg-midnight/30 px-3 py-1 backdrop-blur transition-colors hover:border-amber hover:text-amber">Spiti in October</Link>
          </motion.div>
        </motion.div>
      )}

      {/* glass destination cards: each one is a slide; hovering one opens its photo behind the page */}
      {ready && slides.length > 0 && (
        <motion.div style={{ y: contentY, opacity: fade }} initial="hidden" animate="show" transition={{ staggerChildren: 0.14, delayChildren: 1.9 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          className={`relative z-10 mx-auto flex w-full snap-x gap-4 overflow-x-auto px-4 pb-8 no-scrollbar md:grid md:grid-cols-3 md:gap-5 md:overflow-visible ${wide}`}>
          {slides.map((s, i) => {
            const active = i === idx;
            return (
              <motion.div key={s.slug} className="w-60 shrink-0 snap-start md:w-auto" whileHover={{ y: -8 }}
                variants={{ hidden: { opacity: 0, y: 60, rotateX: -25 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { type: "spring", stiffness: 90, damping: 15 } } }} style={{ transformPerspective: 800 }}>
                <Link to={searchFor(s)} data-testid={`hero-slide-${s.slug}`} onMouseEnter={() => setIdx(i)} onFocus={() => setIdx(i)}
                  className={`group relative block overflow-hidden rounded-2xl border p-4 text-left backdrop-blur-md transition-colors duration-500 ${active ? "border-white/60 bg-white/15" : "border-white/20 bg-midnight/40"}`}>
                  {/* light glancing across the glass */}
                  <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[520%]" />
                  <ArrowUpRight size={18} className={`absolute right-4 top-4 transition-all duration-300 ${active ? "opacity-100" : "-translate-x-1 translate-y-1 opacity-0"}`} />
                  <p className="text-[10px] font-medium uppercase tracking-[.42em] text-white/70">{placeLabel(s)}</p>
                  <p className="mt-0.5 text-xl font-medium">{s.destination}</p>
                  <span className="relative mt-3 block h-0.5 w-16 overflow-hidden bg-white/40">
                    {active && <motion.span key={`${idx}-${paused}`} className="absolute inset-y-0 left-0 bg-amber" initial={{ width: paused ? "100%" : "0%" }} animate={{ width: "100%" }} transition={{ duration: SLIDE_MS / 1000, ease: "linear" }} />}
                  </span>
                  <p className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="text-xl font-semibold">{inr(s.min_price)}</span>
                    <span className="text-xs text-white/60">{s.count} departures</span>
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* gutter details, like notes in the margin of a map */}
      <motion.div aria-hidden style={{ opacity: fade }} className="pointer-events-none absolute bottom-10 left-[6%] z-10 hidden -translate-x-1/2 flex-col items-center gap-3 xl:flex">
        <span className="text-[10px] uppercase tracking-[.4em] text-white/70 [writing-mode:vertical-rl]">Scroll</span>
        <span className="relative h-14 w-px overflow-hidden bg-white/25">
          <motion.span className="absolute inset-x-0 top-0 h-1/2 bg-white" animate={{ y: ["-100%", "200%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        </span>
      </motion.div>
      {ready && slides.length > 1 && (
        <motion.div aria-hidden style={{ opacity: fade }} className="absolute bottom-10 right-[6%] z-10 hidden translate-x-1/2 font-elegant text-2xl xl:block">
          <AnimatePresence mode="wait">
            <motion.span key={idx} className="inline-block" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>0{idx + 1}</motion.span>
          </AnimatePresence>
          <span className="text-base text-white/50"> / 0{slides.length}</span>
        </motion.div>
      )}
    </section>
  );
}

// ---------- marquee ----------
function Marquee({ dests }) {
  if (!dests.length) return null;
  const row = (hidden) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {dests.map((d) => (
        <Link key={d.slug} to={searchFor(d)} tabIndex={hidden ? -1 : 0} className="flex items-center gap-4 pl-10 transition-colors hover:text-amber">
          <span className="font-elegant text-3xl">{d.destination}</span>
          <span className="text-xs uppercase tracking-[.25em] text-white/60">from {short(d.min_price)}</span>
          <Star size={14} className="ml-6 text-amber" />
        </Link>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-t border-white/15 bg-midnight py-5 text-white" data-testid="home-marquee">
      <div className="marquee flex w-max">{row(false)}{row(true)}</div>
    </div>
  );
}

// ---------- numbers ----------
function Numbers({ stats }) {
  const items = [[stats?.departures, "departures to compare"], [stats?.operators_listed, `operators listed · ${stats?.operators ?? "–"} with live trips`, "/operators"], [stats?.destinations, "destinations, Spiti to Kyoto"]];
  return (
    <section className="relative isolate mx-auto grid max-w-[1400px] px-4 pt-20 sm:grid-cols-3 sm:px-8">
      <Glow className="left-1/3 top-0 h-56 w-[36rem] bg-amber/10" />
      {items.map(([n, label, to], i) => (
        <Reveal key={i} delay={i * 0.12} className={`py-4 text-center ${i ? "sm:border-l" : ""}`}>
          <p className="font-elegant text-7xl text-amber sm:text-8xl"><CountUp value={n} /></p>
          {to
            ? <Link to={to} data-testid="home-all-operators" className="mt-2 inline-block text-[11px] uppercase tracking-[.3em] text-muted-foreground underline-offset-4 transition-colors hover:text-coral hover:underline">{label} →</Link>
            : <p className="mt-2 text-[11px] uppercase tracking-[.3em] text-muted-foreground">{label}</p>}
        </Reveal>
      ))}
    </section>
  );
}

// ---------- explore ----------
function Explore({ dests }) {
  const [mode, setMode] = useState("grid");
  const nav = useNavigate();
  return (
    <section className="relative isolate mx-auto max-w-[1400px] px-4 pt-24 sm:px-8" data-testid="explore-everywhere">
      <Glow className="-right-20 top-40 h-96 w-96 bg-[#22B8A7]/15" drift={-70} />
      <Star size={16} delay={0.8} className="absolute right-[38%] top-16 text-white/50" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><Kicker>Explore everywhere</Kicker><SplitHeading text="Cheapest group trip, by destination" className="mt-3" /></div>
        <div className="relative flex rounded-full bg-muted p-1 text-sm">
          {[["grid", LayoutGrid, "Grid"], ["map", MapIcon, "Map"]].map(([m, Icon, label]) => (
            <button key={m} data-testid={`explore-mode-${m}`} onClick={() => setMode(m)} className={`relative flex items-center gap-1 rounded-full px-4 py-1.5 ${mode === m ? "font-semibold" : ""}`}>
              {mode === m && <motion.span layoutId="explore-mode-pill" className="absolute inset-0 rounded-full bg-card shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative flex items-center gap-1"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10">
        {mode === "map" ? <MapView points={dests} onPick={(p) => nav(searchFor(p))} /> : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {dests.slice(0, 12).map((d, i) => (
              <motion.div key={d.slug} className={i === 0 ? "col-span-2 row-span-2" : ""}
                initial={{ opacity: 0, y: 50, scale: 0.92 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: (i % 4) * 0.07, duration: 0.7, ease: EASE }}>
                <Tilt className="h-full" max={i === 0 ? 5 : 10}>
                  <Link to={searchFor(d)} data-testid={`explore-dest-${d.slug}`} className="group relative block h-full min-h-[220px] overflow-hidden rounded-2xl shadow-soft">
                    <img src={d.image} alt={d.destination} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/30 to-transparent" />
                    <span className="absolute right-3 top-3 grid h-9 w-9 -translate-y-2 place-items-center rounded-full border border-white/60 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"><ArrowUpRight size={16} /></span>
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="text-[10px] font-medium uppercase tracking-[.36em] text-white/70">{placeLabel(d)}</p>
                      <p className={i === 0 ? "font-elegant text-5xl sm:text-6xl" : "mt-0.5 text-xl font-medium"}>{d.destination}</p>
                      <span className="mt-2 block h-px w-10 bg-white/50 transition-all duration-500 group-hover:w-20 group-hover:bg-amber" />
                      <p className="mt-2 flex items-baseline justify-between text-sm"><b className="text-base">{short(d.min_price)}</b><span className="text-xs text-white/60">{d.count} departures</span></p>
                    </div>
                  </Link>
                </Tilt>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- trending ----------
function Trending({ items }) {
  const scroller = useRef(null);
  const slide = (dir) => scroller.current?.scrollBy({ left: dir * 620, behavior: "smooth" });
  const arrow = "grid h-11 w-11 place-items-center rounded-full border bg-card transition-all hover:border-coral hover:text-coral";
  return (
    <section className="relative isolate mx-auto max-w-[1400px] px-4 pt-28 sm:px-8">
      <Glow className="-left-32 top-24 h-[26rem] w-[26rem] bg-amber/15" duration={22} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><Kicker>Filling fast</Kicker><SplitHeading text="Trending departures" className="mt-3" /></div>
        <div className="flex items-center gap-2">
          <button onClick={() => slide(-1)} data-testid="trending-prev" aria-label="Previous" className={`${arrow} hover:-translate-x-0.5`}><ChevronLeft size={18} /></button>
          <button onClick={() => slide(1)} data-testid="trending-next" aria-label="Next" className={`${arrow} hover:translate-x-0.5`}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={scroller} className="-mx-4 mt-8 flex snap-x gap-5 overflow-x-auto px-4 pb-8 pt-2 no-scrollbar sm:-mx-8 sm:px-8">
        {items.map((c, i) => (
          <motion.div key={c.dep_id} className="flex w-72 shrink-0 snap-start"
            initial={{ opacity: 0, x: 80, rotate: 3 }} whileInView={{ opacity: 1, x: 0, rotate: 0 }} viewport={{ once: true }}
            transition={{ delay: Math.min(i, 4) * 0.08, type: "spring", stiffness: 80, damping: 16 }} whileHover={{ y: -8, rotate: -1 }}>
            <Link to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} data-testid={`trending-card-${c.dep_id}`} className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-card shadow-soft transition-all hover:border-white/30 hover:shadow-lift">
              <div className="relative h-44 overflow-hidden"><img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-3 top-3"><StatusPill status={c.status} seatsLeft={c.seats_left} /></span></div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{c.op.name}</span><VerifiedStamp status={c.op.verified_status} small /></div>
                <p className="mt-1 line-clamp-2 font-display text-lg leading-snug">{c.title}</p>
                <div className="perf my-3" />
                <div className="flex items-end justify-between"><span className="text-sm">{fmtRange(c.start, c.end)}</span><span className="font-display text-xl font-semibold">{short(c.true_price)}</span></div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex justify-center"><EllipseLink to="/search?sort=soonest" testId="trending-see-all">See all departures</EllipseLink></div>
    </section>
  );
}

// ---------- vibes ----------
function TileAnim({ kind, color }) {
  if (kind === "hiker") return <Footprints size={18} className="absolute bottom-3 left-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color, animation: "walk 2.4s linear infinite" }} />;
  if (kind === "sparkle") return <>{[0, 1, 2].map((i) => <Sparkles key={i} size={14} className="absolute opacity-0 group-hover:opacity-100" style={{ color, top: 12 + i * 18, right: 14 + i * 22, animation: `sparkle 1.2s ${i * 0.3}s infinite` }} />)}</>;
  if (kind === "compass") return <Compass size={42} className="absolute bottom-3 right-3 opacity-20 group-hover:opacity-60" style={{ color, animation: "spinslow 6s linear infinite" }} />;
  return null;
}

function Vibes({ counts }) {
  const tiles = [
    ...Object.entries(STYLES).map(([k, v]) => ({ k, ...v, to: `/search?style=${k}`, n: counts?.[k] })),
    { k: "seniors", label: "60+ solo friendly", icon: Compass, color: "#0F766E", anim: "compass", to: "/trips/solo-travel-60-plus" },
    { k: "women", label: "Women-only", icon: Users, color: "#FF6B4A", to: "/trips/women-only-trips" },
  ];
  return (
    <section className="relative isolate mx-auto max-w-[1400px] px-4 pt-28 text-center sm:px-8">
      <Glow className="right-10 top-10 h-80 w-80 bg-coral/15" drift={-50} duration={20} />
      <Glow className="bottom-0 left-1/4 h-72 w-72 bg-[#22B8A7]/10" duration={24} />
      <Star size={18} delay={1.2} className="absolute left-[12%] top-28 text-white/50" />
      <Kicker className="justify-center">Browse by vibe</Kicker>
      <SplitHeading text="What kind of trip are you in the mood for?" className="mx-auto mt-3 max-w-3xl" />
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} transition={{ staggerChildren: 0.04 }} className="mt-10 grid grid-cols-2 gap-3 text-left sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <motion.div key={t.k} variants={{ hidden: { opacity: 0, scale: 0.8, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 18 } } }}
            whileHover={{ y: -6, rotate: -1.5 }} whileTap={{ scale: 0.96 }}>
            <Link to={t.to} data-testid={`vibe-tile-${t.k}`} className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:shadow-lift">
              {/* colour wash that floods the tile from the icon on hover */}
              <span className="absolute -left-6 -top-6 h-20 w-20 scale-0 rounded-full opacity-25 transition-transform duration-500 ease-out group-hover:scale-[7]" style={{ background: t.color }} />
              <t.icon size={26} strokeWidth={1.5} style={{ color: t.color }} className="relative brightness-150 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12" />
              <div className="relative"><p className="font-medium leading-tight">{t.label}</p>{t.n != null && <p className="mt-0.5 text-[10px] uppercase tracking-[.2em] text-muted-foreground">{t.n} departures</p>}</div>
              <TileAnim kind={t.anim} color={t.color} />
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ---------- why true price ----------
function WhyTrue() {
  // an illustration of the one thing we add: GST, when the operator's listing says it is extra
  const extras = [["GST 5% (listed as extra)", 900]];
  const listed = 17999;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [shown, setShown] = useState(0);
  // the extras drop onto the receipt one by one and the total climbs with them
  useEffect(() => {
    if (!inView || shown >= extras.length) return undefined;
    const t = setTimeout(() => setShown((n) => n + 1), 550);
    return () => clearTimeout(t);
  }, [inView, shown, extras.length]);
  const running = listed + extras.slice(0, shown).reduce((s, [, a]) => s + a, 0);
  const done = shown >= extras.length;
  return (
    <section className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-8">
      <div ref={ref} className="relative grid items-center gap-10 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1B3F44] via-[#122C36] to-[#2A2434] p-8 text-white md:grid-cols-2 md:p-16">
        <motion.span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-coral/25 blur-3xl" animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <motion.span aria-hidden className="pointer-events-none absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-amber/20 blur-3xl" animate={{ x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
        <Star size={22} className="absolute right-8 top-8 text-white/70" />
        <Star size={14} delay={1.5} className="absolute bottom-8 left-8 text-white/70" />
        <div className="relative z-10">
          <Kicker className="!text-amber">One honest price</Kicker>
          <SplitHeading text="The same checklist for every trip." className="mt-4" />
          <Reveal delay={0.2}><p className="mt-5 max-w-lg text-white/75">Prices come straight from each operator's own page. We check every listing against the same checklist — transport, stays, meals, permits/visa, guide, activities, insurance and taxes — and show what the operator says is included, not included, or doesn't say. The only thing we ever add is 5% GST, when the operator lists it as extra. Tap the ⓘ on any card to see it.</p></Reveal>
        </div>
        <motion.div className="relative z-10" initial={{ opacity: 0, y: 60, rotate: 6 }} whileInView={{ opacity: 1, y: 0, rotate: 2 }} viewport={{ once: true, margin: "-120px" }} transition={{ type: "spring", stiffness: 70, damping: 14 }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="rounded-2xl border border-white/25 bg-white/10 p-6 shadow-lift backdrop-blur-md" data-testid="true-price-receipt">
            <p className="text-[11px] font-medium uppercase tracking-[.4em] text-white/70">Example · 7-day group trip</p>
            <div className="mt-5 space-y-2.5 text-sm">
              <div className="flex justify-between"><span>Listed price</span><span className="font-mono">{inr(listed)}</span></div>
              {extras.map(([l, a], i) => (
                <motion.div key={l} className="flex justify-between" initial={false} animate={i < shown ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
                  <span>{l}</span><span className="font-mono text-amber">+ {inr(a)}</span>
                </motion.div>
              ))}
              <div className="!my-4 h-px bg-white/30" />
              <div className="flex items-end justify-between">
                <span className="font-elegant text-3xl">You pay</span>
                <motion.span animate={done ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.5 }} className={`text-3xl font-semibold ${done ? "text-amber" : ""}`}><Counter value={running} format={inr} /></motion.span>
              </div>
              <p className="pt-1 text-right text-[11px] text-white/60">{done ? `${inr(running - listed)} GST on top of the listing` : "checking the listing…"}</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------- how it works ----------
function How() {
  const steps = [[Search, "See the whole market", "Every group departure, Anywhere by default. No quiz, no gate."], [Scale, "Narrow it down fast", "Filters with live counts — destination, dates, budget, women-only groups, trip style and more."], [ShieldCheck, "Book with the operator", "Go straight to the operator's own page for the trip. No commission, no booking fees."]];
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const line = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  return (
    <section className="relative isolate mx-auto max-w-[1400px] px-4 pt-28 text-center sm:px-8">
      <Glow className="left-10 top-32 h-80 w-80 bg-[#22B8A7]/15" duration={21} />
      <Glow className="right-0 top-48 h-72 w-72 bg-amber/10" drift={-60} duration={26} />
      <Star size={16} delay={0.4} className="absolute right-[14%] top-24 text-white/50" />
      <Kicker className="justify-center">How it works</Kicker>
      <SplitHeading text="Three steps to your people" className="mt-3" />
      <div ref={ref} className="relative mt-12">
        {/* a route line that draws itself across the steps as you scroll */}
        <div className="absolute inset-x-[16.6%] top-7 hidden h-px bg-border md:block" />
        <motion.div style={{ scaleX: line }} className="absolute inset-x-[16.6%] top-7 hidden h-px origin-left bg-coral md:block" />
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map(([I, t, s], i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * 0.15, duration: 0.7, ease: EASE }} className="relative flex flex-col items-center">
              <motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 260, damping: 14 }}
                className="relative z-10 grid h-14 w-14 place-items-center rounded-full border border-coral bg-[#0D2A2C] text-coral shadow-[0_0_30px_rgba(255,107,74,.35)]"><I size={22} strokeWidth={1.5} /></motion.span>
              <span className="mt-5 font-elegant text-6xl text-coral/60">0{i + 1}</span>
              <p className="mt-2 text-xl font-medium">{t}</p><p className="mt-2 max-w-xs text-sm text-muted-foreground">{s}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- closing call to action ----------
function Cta({ image }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  return (
    <section className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-8">
      <div ref={ref} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-midnight px-6 py-24 text-center text-white sm:py-32">
        {image && <motion.img src={image} alt="" loading="lazy" style={{ y }} className="absolute inset-x-0 -top-[12%] h-[124%] w-full object-cover" />}
        <div className="absolute inset-0 bg-midnight/55" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(7,20,28,.75)_100%)]" />
        <Frame />
        <div className="relative z-10 flex flex-col items-center">
          <SplitHeading text="Your people are already packing." className="max-w-3xl !text-5xl sm:!text-7xl" />
          <Reveal delay={0.3}><p className="mx-auto mt-5 max-w-md text-white/80">See every departure in one place and pick the group that fits.</p></Reveal>
          <Reveal delay={0.45} className="mt-9"><EllipseLink to="/search" testId="home-browse-all" className="text-base">Browse all departures</EllipseLink></Reveal>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { data } = useQuery({ queryKey: ["home"], queryFn: () => http.get("/home").then((r) => r.data) });
  const dests = data?.destinations || [];
  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-x-clip">
        <Hero dests={dests} stats={data?.stats} />
        <Marquee dests={dests} />
        {/* the rest of the page uses the dark theme on one backdrop that shifts from night blue to deep forest and back */}
        <div className="dark bg-[linear-gradient(180deg,#0B1F2A_0%,#0C2B2A_20%,#11303B_46%,#0C2B2A_74%,#0B1F2A_100%)] text-foreground">
          <Numbers stats={data?.stats} />
          <Explore dests={dests} />
          <Trending items={data?.trending || []} />
          <Vibes counts={data?.styles} />
          <WhyTrue />
          <How />
          <Cta image={dests[Math.floor(dests.length / 3)]?.image} />
          <div className="mt-24 border-t border-white/10 [&>footer]:mt-0"><Footer /></div>
        </div>
      </div>
    </MotionConfig>
  );
}
