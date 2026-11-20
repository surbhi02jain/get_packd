import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Hexagon, Mountain } from "lucide-react";
import { StipplePhoto } from "./parts";

const rupees = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const searchFor = (d) => `/search?q=${encodeURIComponent(d.destination)}`;

// operator names set in a handful of different wordmark styles, like a row of client logos
const MARKS = [
  (n) => <span className="flex items-center gap-1.5 font-['Inter_Tight'] text-[20px] font-bold tracking-[-0.045em] text-[#1d2027]"><span className="h-[15px] w-[15px] rounded-full" style={{ background: "conic-gradient(from 200deg, #f5b544, #ef6f45, #57b6e6, #f5b544)" }} />{n}</span>,
  (n) => <span className="font-['Inter_Tight'] text-[20px] font-extrabold tracking-[-0.03em] text-[#7b61f0]">{n}</span>,
  (n) => <span className="font-['Newsreader'] text-[22px] tracking-[-0.01em] text-[#1d2027]">{n}</span>,
  (n) => <span className="flex items-center gap-1.5 font-['Inter_Tight'] text-[11.5px] font-semibold uppercase tracking-[.24em] text-[#2b2f36]"><Hexagon size={15} strokeWidth={1.6} />{n}</span>,
  (n) => <span className="font-['Inter_Tight'] text-[20px] font-medium lowercase tracking-[-0.04em] text-[#1d2027]">{n}</span>,
];

export function OperatorMark({ name, i, className = "" }) {
  return <span className={`whitespace-nowrap ${className}`}>{MARKS[i % MARKS.length](name)}</span>;
}

const THEMES = [
  { bg: "linear-gradient(180deg, #fbe2cc 0%, #fbeedd 45%, #f6f8e6 100%)", btn: "lp-btn-peach", brand: (n) => <span className="font-['Inter_Tight'] text-[27px] font-semibold tracking-[-0.04em] text-[#20242c]">{n}</span> },
  { bg: "linear-gradient(180deg, #b3b8f1 0%, #ccd0f3 42%, #f2f4e7 100%)", btn: "lp-btn-navy", brand: (n) => <span className="font-['Newsreader'] text-[31px] tracking-[-0.01em] text-[#20242c]">{n}</span> },
  { bg: "linear-gradient(180deg, #bfe2d6 0%, #d3ebdf 45%, #f2f8ea 100%)", btn: "lp-btn-navy", brand: (n) => <span className="flex items-center gap-2 font-['Inter_Tight'] text-[15px] font-semibold uppercase tracking-[.2em] text-[#2b3038]"><Mountain size={20} strokeWidth={1.5} />{n}</span> },
];

const PICKS = {
  spiti: "A cold desert valley of mud-brick villages, monasteries on cliff edges and some of the highest roads in the country. The road season runs roughly June to October; winter trips are for the hardy.",
  kerala: "Backwaters by houseboat, tea hills around Munnar and a long, slow coastline. Group trips here are gentle ones: more boats and homestays than summits.",
  meghalaya: "Living-root bridges, rivers so clear the boats look like they float on air, and more rain than almost anywhere. The trek down to Nongriat is the usual draw.",
  ladakh: "High passes, blue lakes and long days on the road out of Leh. The season runs roughly May to September, and good itineraries build in time to acclimatise.",
  vietnam: "From Hanoi's old quarter to Ha Long Bay and the lanes of Hoi An. Group itineraries usually travel north to south over a week or so.",
  bali: "Rice terraces around Ubud, temples, beach days and a volcano at sunrise. Most itineraries split the week between the hills and the coast.",
};

function useWidth(ref) {
  const [w, setW] = useState(1200);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Card({ d, theme, w, h, narrow, active, onPick, idx }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[6px]" style={{ background: theme.bg, boxShadow: "0 1px 0 rgba(31,40,54,.03)" }}>
      <StipplePhoto url={d.image.replace(/w=\d+/, "w=900")} seed={idx * 7 + 3} w={560} h={480}
        className={`absolute ${narrow ? "bottom-[2%] left-[6%] h-[44%] w-[88%]" : "right-[1.5%] top-[7%] h-[86%] w-[47%]"}`} />
      <div className="relative z-10 flex h-full flex-col p-[clamp(20px,2.4vw,32px)]">
        <div className="flex items-start justify-between gap-4">
          {theme.brand(d.destination)}
          <span className="mt-1 hidden font-['Newsreader'] text-[11px] text-[#6f7069] sm:block">Group Trips In {d.dtype === "domestic" ? "India" : d.country}</span>
        </div>
        <div className={narrow ? "mt-5" : "mt-auto max-w-[46%] pb-[6%]"}>
          <p className="font-['Newsreader'] text-[clamp(15px,1.25vw,18px)] leading-[1.5] text-[#2d333e]">{PICKS[d.slug]}</p>
          <p className="mt-3 font-['Newsreader'] text-[clamp(14px,1.1vw,16px)] text-[#5c616a]">— {d.count} departures, from {rupees(d.min_price)}</p>
        </div>
        <div className={narrow ? "mt-4" : "mt-auto"}>
          <Link to={searchFor(d)} tabIndex={active ? 0 : -1} onClick={(e) => { if (!active) { e.preventDefault(); onPick(); } }}
            className={`lp-btn ${theme.btn}`}>See Trips</Link>
        </div>
      </div>
    </div>
  );
}

/** Large pastel cards, one in focus with its neighbours peeking in at the sides. */
export function StoryCarousel({ dests }) {
  const cards = useMemo(() => Object.keys(PICKS).map((s) => dests.find((d) => d.slug === s)).filter((d) => d && d.image), [dests]);
  const box = useRef(null);
  const W = useWidth(box);
  const narrow = W < 768;
  const cw = narrow ? W - 40 : Math.min(1010, W * 0.7);
  const ch = narrow ? Math.min(620, cw * 1.55) : cw * 0.535;
  const gap = narrow ? 12 : 22;
  const n = cards.length;
  const [i, setI] = useState(0);
  const go = useCallback((d) => n && setI((x) => (x + d + n) % n), [n]);

  if (!n) return <div ref={box} style={{ height: ch }} />;
  return (
    <div ref={box} className="relative" onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }} data-testid="story-carousel">
      <div className="relative" style={{ height: ch }}>
        {cards.map((d, k) => {
          let off = k - i;
          if (off > n / 2) off -= n;
          if (off < -n / 2) off += n;
          const s = off === 0 ? 1 : 0.88;
          return (
            <motion.div key={d.slug} className="absolute left-1/2 top-0"
              style={{ width: cw, height: ch, marginLeft: -cw / 2, zIndex: 10 - Math.abs(off), cursor: off ? "pointer" : "default" }}
              initial={false}
              animate={{ x: off * (cw * (1 + 0.88) / 2 + gap), scale: s, opacity: Math.abs(off) > 1 ? 0 : 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.9 }}
              drag={off === 0 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18}
              onDragEnd={(_, info) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
              onClick={off ? () => go(off) : undefined}
              aria-hidden={off !== 0}
            >
              <Card d={d} theme={THEMES[k % THEMES.length]} w={cw} h={ch} narrow={narrow} active={off === 0} onPick={() => go(off)} idx={k} />
            </motion.div>
          );
        })}
        {[-1, 1].map((dir) => (
          <button key={dir} onClick={() => go(dir)} aria-label={dir < 0 ? "Previous destination" : "Next destination"}
            className="absolute top-1/2 z-20 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-[4px] bg-[#3a4a64] text-white shadow-[0_2px_0_#26324a] transition-colors hover:bg-[#2c3a52]"
            style={{ left: `calc(50% ${dir < 0 ? "-" : "+"} ${cw / 2}px - 12px)` }}>
            {dir < 0 ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-[5px]">
        {cards.map((d, k) => (
          <button key={d.slug} onClick={() => setI(k)} aria-label={`Show ${d.destination}`} className="py-2">
            <span className={`block h-[3px] rounded-full transition-all duration-500 ${k === i ? "w-[12px] bg-[#2b3240]" : "w-[3px] bg-[#b9bcb0]"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Stories({ dests, operators }) {
  return (
    <section className="relative bg-[var(--paper)] pb-[clamp(70px,9vw,120px)] pt-[clamp(56px,6vw,84px)]" data-testid="landing-stories">
      <h2 className="text-center font-['Inter_Tight'] text-[clamp(19px,1.6vw,23px)] font-normal tracking-[-0.02em] text-[#3a4250]">Already on getPackd</h2>
      <div className="mx-auto mt-7 flex max-w-[1100px] flex-wrap items-center justify-center gap-x-[clamp(28px,5vw,72px)] gap-y-5 px-4">
        {operators.slice(0, 5).map((o, i) => (
          <Link key={o.id} to={`/operator/${o.id}`} className="transition-opacity hover:opacity-60"><OperatorMark name={o.name} i={i} /></Link>
        ))}
      </div>
      <div className="mt-[clamp(36px,4vw,56px)]"><StoryCarousel dests={dests} /></div>
    </section>
  );
}
