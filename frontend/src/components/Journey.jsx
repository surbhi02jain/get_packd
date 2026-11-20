import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createInkWorld, zoneT } from "@/lib/inkworld";
import { Reveal } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";
import { short } from "@/lib/format";

// The journey under the hero: one ink-drawn world fixed behind the page, and five chapters scrolling over it. As you
// read down, the camera travels the road from the mountains to the backwaters, the coast and the city.
const PLACES = [
  { key: "mountains", no: "01", name: "Mountains", climate: ["mountains", "snow"], title: "Thin air, prayer flags,", ink: "and a group for the climb.",
    body: "Valleys, high passes and monastery towns. Every group departure that heads uphill, side by side.", live: "The monastery above the valley" },
  { key: "backwaters", no: "02", name: "Backwaters & forests", climate: ["jungle"], title: "Slow water, green walls,", ink: "nowhere to be.",
    body: "Backwaters, rainforests and tea hills. Houseboats, homestays and trips that take their time.", live: "A houseboat on the canal" },
  { key: "beaches", no: "03", name: "Beaches & islands", climate: ["beach"], title: "Salt, sun, and strangers", ink: "who become your crew.",
    body: "Coasts and islands at home and abroad. Beach weeks, island hops and dive trips.", live: "The lighthouse at the point" },
  { key: "cities", no: "04", name: "Cities & old towns", climate: ["city", "desert"], title: "Old streets, night markets,", ink: "and a plan someone else made.",
    body: "Capitals, old towns and desert forts. City breaks where the group sorts out the getting around.", live: "The old town from across the river" },
];
const CHAPTERS = [{ key: "prologue", no: "00", name: "What getPackd is" }, ...PLACES];
const searchFor = (d) => `/search?q=${encodeURIComponent(d.destination)}`;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

// ---------- ink drawings that slide in from the edge of the frame, one per place ----------
const wobble = "url(#ink-wobble)";
function Flags() {
  const pt = (t) => [20 + t * 560, 26 + t * 70 + Math.sin(Math.PI * t) * 70];
  const colours = ["#1045f5", "#f6c445", "#c9302a", "#fdfbf6"];
  return (
    <svg viewBox="0 0 600 220" className="w-[min(46vw,560px)]" fill="none" stroke="#1045f5" strokeWidth="1.6" filter={wobble}>
      <path d={`M${pt(0)} ${Array.from({ length: 30 }, (_, i) => `L${pt((i + 1) / 30)}`).join(" ")}`} />
      {Array.from({ length: 13 }, (_, i) => {
        const [x, y] = pt((i + 0.6) / 13);
        return <rect key={i} x={x} y={y} width="26" height="32" fill={colours[i % 4]} transform={`rotate(${(i % 3) * 4 - 4} ${x} ${y})`} />;
      })}
    </svg>
  );
}
function Frond() {
  const stem = (t) => [380 - t * 330, 380 - t * 250 - Math.sin(Math.PI * t) * 70];
  return (
    <svg viewBox="0 0 400 400" className="w-[min(34vw,400px)]" fill="none" stroke="#1045f5" strokeWidth="1.6" strokeLinecap="round" filter={wobble}>
      <path d={`M${stem(0)} ${Array.from({ length: 24 }, (_, i) => `L${stem((i + 1) / 24)}`).join(" ")}`} strokeWidth="2.4" />
      {Array.from({ length: 22 }, (_, i) => {
        const t = 0.08 + (i / 22) * 0.9, [x, y] = stem(t), len = 90 * (1 - t * 0.7);
        return [-1, 1].map((s) => <path key={`${i}${s}`} d={`M${x} ${y} Q${x - len * 0.4} ${y + s * len * 0.5 - 10} ${x - len * 0.55} ${y + s * len * 0.9 + 20}`} />);
      })}
    </svg>
  );
}
function Waves() {
  const wave = (y, a, k) => `M0 ${y} ${Array.from({ length: 60 }, (_, i) => `L${(i + 1) * 10} ${y + Math.sin((i + 1) * k) * a}`).join(" ")}`;
  return (
    <svg viewBox="0 0 600 170" className="w-[min(50vw,600px)]" fill="none" stroke="#1045f5" strokeWidth="1.6" strokeLinecap="round" filter={wobble}>
      <path d={wave(110, 9, 0.42)} /><path d={wave(134, 7, 0.5)} /><path d={wave(156, 5, 0.6)} />
      <path d="M380 40 q14 -14 26 0 q12 -14 26 0" /><path d="M450 70 q9 -9 17 0 q8 -9 17 0" />
    </svg>
  );
}
function Lights() {
  const pt = (t) => [580 - t * 560, 20 + t * 40 + Math.sin(Math.PI * t) * 80];
  return (
    <svg viewBox="0 0 600 200" className="w-[min(46vw,560px)]" fill="none" stroke="#1045f5" strokeWidth="1.6" filter={wobble}>
      <path d={`M${pt(0)} ${Array.from({ length: 30 }, (_, i) => `L${pt((i + 1) / 30)}`).join(" ")}`} />
      {Array.from({ length: 11 }, (_, i) => {
        const [x, y] = pt((i + 0.5) / 11);
        return <g key={i}><path d={`M${x} ${y} L${x} ${y + 12}`} /><circle cx={x} cy={y + 20} r="8" fill="#f6c445" /></g>;
      })}
    </svg>
  );
}
const ORNAMENTS = {
  mountains: { el: <Flags />, at: "left-0 top-0", from: { x: -60, y: -80 } },
  backwaters: { el: <Frond />, at: "bottom-0 right-0", from: { x: 80, y: 80 } },
  beaches: { el: <Waves />, at: "bottom-0 left-0", from: { x: -60, y: 70 } },
  cities: { el: <Lights />, at: "right-0 top-0", from: { x: 60, y: -80 } },
};

/** An opening in the page: the world is drawn into this box from its own camera, circling one landmark. */
function LiveWindow({ world, view, label, className = "" }) {
  const ref = useRef(null);
  useEffect(() => (world && ref.current ? world.watch(ref.current, view) : undefined), [world, view]);
  return (
    <div ref={ref} data-live-window className={`relative border border-[#16181b]/60 shadow-[0_24px_48px_-24px_rgba(22,24,27,.45)] ${className}`}>
      <span className="absolute bottom-0 left-0 flex items-center gap-2 bg-[#f6f2e9] px-3 py-1.5 text-[10px] uppercase tracking-[.3em] text-[#5b6066]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9302a]" />Live · {label}
      </span>
    </div>
  );
}

function Prologue({ stats }) {
  const steps = [
    ["See the whole market", "Every group departure from every operator we track, set to Anywhere by default. No quiz, no sign-up."],
    ["Narrow it down", "Filters with live counts: destination, dates, budget, women-only groups, trip style and more."],
    ["Book with the operator", "Go straight to the operator's own page for the trip. No commission, no booking fee."],
  ];
  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      <div className="bg-[#f6f2e9]/[.97] p-7 shadow-soft sm:p-10">
        <InkLabel>Chapter 00 — What getPackd is</InkLabel>
        <InkTitle className="mt-4" ink="one honest price.">Every group trip in one place, at</InkTitle>
        <Reveal delay={0.1}>
          <p className="mt-6 text-[17px] leading-relaxed text-[#4a4f55]">
            getPackd is a comparison site for fixed-departure group trips. We read the dates, inclusions and prices from
            {stats ? ` ${stats.operators} operators' ` : " operators' "}own websites and put them side by side, so you can find the trip that fits
            and the group that fits you, then book it directly with the operator.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 border-t border-[#d8d2c4] pt-5 text-[15px] leading-relaxed text-[#4a4f55]" data-testid="honest-price-line">
            <span className="mr-1 font-['Caveat'] text-[26px] leading-none text-[#1045f5]">One honest price.</span> Prices come straight from each operator's own page,
            checked against the same list of inclusions. The only thing we ever add is 5% GST, when the operator lists it as extra.
          </p>
        </Reveal>
      </div>
      <ol className="self-end border-t border-[#16181b]/25 bg-[#f6f2e9]/[.97] px-6 shadow-soft">
        {steps.map(([t, s], i) => (
          <li key={t} className="border-b border-[#16181b]/15 last:border-0">
            <Reveal delay={0.1 + i * 0.08} className="grid grid-cols-[3.2rem_1fr] gap-4 py-6">
              <span className="text-3xl font-light text-[#1045f5]">0{i + 1}</span>
              <span><span className="block text-lg font-medium">{t}</span><span className="mt-1 block text-[15px] text-[#5b6066]">{s}</span></span>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Place({ place, dests, world, flip }) {
  const all = dests.filter((d) => d.climate?.some((c) => place.climate.includes(c)));
  const top = [...all].sort((a, b) => b.count - a.count).slice(0, 5);
  const departures = all.reduce((n, d) => n + d.count, 0);
  const from = all.length ? Math.min(...all.map((d) => d.min_price)) : null;
  return (
    <div className={`mx-auto grid max-w-[1200px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div className="bg-[#f6f2e9]/[.97] p-7 shadow-soft sm:p-10">
        <InkLabel>Chapter {place.no} — {place.name}</InkLabel>
        <InkTitle className="mt-4" ink={place.ink}>{place.title}</InkTitle>
        <Reveal delay={0.1}><p className="mt-5 text-[16px] leading-relaxed text-[#4a4f55]">{place.body}</p></Reveal>
        <Reveal delay={0.12}>
          <dl className="mt-7 grid grid-cols-3 border-y border-[#d8d2c4] py-4">
            {[[departures.toLocaleString("en-IN"), "Departures"], [all.length, "Places"], [from ? short(from) : "–", "From"]].map(([v, l]) => (
              <div key={l}><dt className="text-[10px] uppercase tracking-[.3em] text-[#8d9296]">{l}</dt><dd className="mt-1 text-2xl font-light">{v}</dd></div>
            ))}
          </dl>
        </Reveal>
        <ol className="mt-2">
          {top.map((d, i) => (
            <li key={d.slug}>
              <Reveal delay={0.14 + i * 0.05}>
                <Link to={searchFor(d)} data-testid={`journey-${place.key}-${d.slug}`} className="group grid grid-cols-[2.2rem_1fr_auto] items-baseline gap-3 border-b border-[#e2dccd] py-3">
                  <span className="text-xs text-[#8d9296]">0{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] transition-colors group-hover:text-[#1045f5]">{d.destination}</span>
                    <span className="block text-xs text-[#8d9296]">{d.dtype === "domestic" ? "India" : d.country} · {d.count} departures</span>
                  </span>
                  <span className="font-['Caveat'] text-2xl leading-none text-[#1045f5]">{short(d.min_price)}</span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>
        <Link to={`/search?climate=${place.climate.join(",")}`} className="mt-5 inline-block text-sm font-medium text-[#1045f5] hover:underline">
          See all {departures.toLocaleString("en-IN")} departures →
        </Link>
      </div>
      <LiveWindow world={world} view={place.key} label={place.live} className="aspect-[4/3] w-full lg:aspect-[4/5]" />
    </div>
  );
}

export default function Journey({ dests, stats, onReady }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const reduced = useReducedMotion();
  const [world, setWorld] = useState(null);
  const [active, setActive] = useState(-1);
  const [progress, setProgress] = useState(0);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let w;
    try { w = createInkWorld(canvas.current, { reduced }); } catch (e) {
      console.error("Ink world could not start", e); // no WebGL: the chapters still read fine on paper
      ready.current?.();
      return undefined;
    }
    setWorld(w);
    requestAnimationFrame(() => ready.current?.());
    return () => { w.dispose(); setWorld(null); };
  }, [reduced]);

  // scroll → which chapter, how far through, and where the camera is on the road
  const sections = useRef([]);
  useEffect(() => {
    if (!world) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = root.current.getBoundingClientRect(), vh = window.innerHeight;
      const p = clamp01(-r.top / Math.max(r.height - vh, 1));
      // fade the world in as the journey arrives, and out as it leaves
      const show = Math.min(clamp01((vh - r.top) / (vh * 0.7)), clamp01(r.bottom / (vh * 0.7)));
      canvas.current.style.opacity = show;
      canvas.current.style.visibility = show > 0 ? "visible" : "hidden";
      world.setActive(show > 0);
      // each chapter's middle is where the camera reaches that place on the road
      const mids = sections.current.map((el) => clamp01((el.offsetTop + el.offsetHeight / 2 - vh / 2) / Math.max(r.height - vh, 1)));
      const at = [0, ...mids, 1], ts = [0, 0.03, ...PLACES.map((pl) => zoneT(pl.key)), 1];
      let t = 1;
      for (let i = 1; i < at.length; i++) if (p <= at[i]) { t = ts[i - 1] + ((ts[i] - ts[i - 1]) * (p - at[i - 1])) / Math.max(at[i] - at[i - 1], 1e-4); break; }
      world.setProgress(t);
      setProgress(p);
      let near = 0;
      mids.forEach((m, i) => { if (Math.abs(m - p) < Math.abs(mids[near] - p)) near = i; });
      setActive(show > 0.5 ? near : -1);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [world]);

  const ornament = ORNAMENTS[CHAPTERS[active]?.key];
  return (
    <div ref={root} className="relative" data-testid="journey">
      <div ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-0" style={{ visibility: "hidden" }} />
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="ink-wobble"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="3" /></filter>
      </svg>

      <AnimatePresence>
        {ornament && !reduced && (
          <motion.div key={CHAPTERS[active].key} className={`pointer-events-none fixed z-[5] ${ornament.at}`}
            initial={{ opacity: 0, ...ornament.from }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, ...ornament.from }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
            {ornament.el}
          </motion.div>
        )}
      </AnimatePresence>

      {/* the rail: where you are on the road */}
      <AnimatePresence>
        {active >= 0 && (
          <motion.nav initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 items-stretch gap-4 lg:flex" aria-label="Journey chapters">
            <span className="relative w-px bg-[#16181b]/20"><span className="absolute inset-x-0 top-0 bg-[#1045f5]" style={{ height: `${progress * 100}%` }} /></span>
            <ol className="flex flex-col justify-between gap-5 py-1">
              {CHAPTERS.map((c, i) => (
                <li key={c.key}>
                  <button onClick={() => sections.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    aria-label={c.name} title={c.name}
                    className={`text-[10px] tracking-[.2em] transition-colors ${i === active ? "text-[#1045f5]" : "text-[#8d9296] hover:text-[#16181b]"}`}>{c.no}</button>
                </li>
              ))}
            </ol>
          </motion.nav>
        )}
      </AnimatePresence>

      <section ref={(el) => (sections.current[0] = el)} className="relative z-10 flex min-h-[135vh] items-center py-24" data-testid="home-about">
        <Prologue stats={stats} />
      </section>
      {PLACES.map((pl, i) => (
        <section key={pl.key} ref={(el) => (sections.current[i + 1] = el)} className="relative z-10 flex min-h-[150vh] items-center py-24" data-testid={`journey-${pl.key}`}>
          <Place place={pl} dests={dests} world={world} flip={i % 2 === 1} />
        </section>
      ))}
    </div>
  );
}
