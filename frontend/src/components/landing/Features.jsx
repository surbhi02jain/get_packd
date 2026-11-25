import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Columns3, Heart, Receipt, Search, ShieldCheck, Waypoints } from "lucide-react";
import { BookArt, CompareArt, SearchArt, ShortlistArt } from "./Blueprints";
import { Balloon, Cloud } from "./parts";

const ITEMS = [
  { title: "Search", icon: Search, bg: "#b3baf0", art: SearchArt, text: "Pick a place and a month, or leave it on Anywhere. Every operator's departures come back in one list." },
  { title: "Compare", icon: Columns3, bg: "#c6e6db", art: CompareArt, text: "Up to four trips next to each other: true price, what's included, group size and ages, and the operator behind each." },
  { title: "Shortlist", icon: Heart, bg: "#f5c6a8", art: ShortlistArt, text: "Heart the departures you like and send the list to the people you're going with." },
  { title: "Book direct", icon: ArrowUpRight, bg: "#eeedc0", art: BookArt, text: "Go to the operator's own page to book. No payment happens on getPackd, and no commission is added." },
];
const DUR = 6;

function useIsNarrow() {
  const [n, setN] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setN(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return n;
}

/** Four columns; one opens into a tall coloured card with its drawing. It moves on by itself and opens on hover. */
export function Platform({ reduced }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(false);
  const row = useRef(null);
  const narrow = useIsNarrow();

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 });
    if (row.current) io.observe(row.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (paused || !seen || reduced) return undefined;
    const t = setTimeout(() => setActive((a) => (a + 1) % ITEMS.length), DUR * 1000);
    return () => clearTimeout(t);
  }, [active, paused, seen, reduced]);

  return (
    <section className="bg-[var(--paper)] pt-[clamp(90px,10vw,140px)]" data-testid="landing-platform">
      <div className="flex flex-col gap-6 px-[clamp(16px,1.6vw,24px)] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="lp-label">The Site</p>
          <h2 className="lp-h2 mt-3">A calmer way to plan a group trip.</h2>
          <p className="lp-body mt-4 max-w-[520px] text-[14px]">getPackd is where you find, weigh up and choose the group departure that fits. Search the whole market. Compare what you'd really pay. Book with the operator.</p>
        </div>
        <Link to="/search" className="lp-btn lp-btn-navy self-start sm:self-auto">Find A Trip</Link>
      </div>

      <div ref={row} onMouseLeave={() => setPaused(false)}
        className={`mt-10 flex ${narrow ? "flex-col" : "h-[min(64vh,520px)] min-h-[440px] items-end"} ${paused ? "lp-paused" : ""}`}>
        {ITEMS.map((it, i) => {
          const on = i === active;
          const Art = it.art;
          const Icon = it.icon;
          return (
            <div key={it.title}
              onMouseEnter={() => { if (!narrow) { setActive(i); setPaused(true); } }}
              onClick={() => { setActive(i); setPaused(true); }}
              className="relative cursor-pointer overflow-hidden border-l border-[#e3e3d0] first:border-l-0"
              style={narrow
                ? { background: on ? it.bg : "linear-gradient(180deg,#f5f4e4,#f1f1dd)", borderTop: "1px solid #e3e3d0", transition: "background-color .5s" }
                : {
                  flex: on ? "0 0 38.5%" : "1 1 0",
                  height: on ? "100%" : "41%",
                  background: on ? it.bg : "linear-gradient(180deg,#f6f5e6 0%,#f2f1de 100%)",
                  transition: "flex .75s cubic-bezier(.65,0,.35,1), height .6s cubic-bezier(.65,0,.35,1), background-color .4s",
                }}
              data-testid={`feature-${i}`}
            >
              {on && <span key={`${active}-${paused}`} className="lp-progress absolute left-0 top-0 h-[2px] w-[22%] bg-[#2b3240]" style={{ "--dur": `${DUR}s` }} />}
              <div className={`flex h-full flex-col p-[10px] ${narrow && !on ? "py-4" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    {on && <Icon size={13} strokeWidth={1.6} className="mb-2 text-[#2b3240]" />}
                    <p className={`font-['Inter_Tight'] tracking-[-0.02em] text-[#20262f] ${on ? "text-[16px] font-medium" : "text-[14px]"}`}>{it.title}</p>
                  </div>
                  <span className="font-['Newsreader'] text-[9.5px] text-[#9a9d92]">{i + 1} of {ITEMS.length}</span>
                </div>
                {on && (
                  <motion.div key={it.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 }} className="flex min-h-0 flex-1 flex-col">
                    <p className="mt-1.5 max-w-[440px] font-['Newsreader'] text-[13px] leading-[1.38] text-[#3d434c]">{it.text}</p>
                    <div className={`mt-4 overflow-hidden rounded-[2px] ${narrow ? "aspect-[16/10]" : "min-h-0 flex-1"}`}><Art /></div>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const TRUST = [
  { icon: Waypoints, title: "You book with the operator", text: "No payment happens on getPackd. You go to the operator's own page and book with them directly." },
  { icon: Receipt, title: "Prices read from the source", text: "Dates and prices come from each operator's own website, with the day we last read them. Check there before you pay." },
  { icon: ShieldCheck, title: "The price, as listed", text: "Each price is written exactly as the operator lists it, with \"+ 5% GST\" when they charge it on top, and what's included beside it." },
];

export function Trust() {
  return (
    <section className="bg-[#f8f9e9]" data-testid="landing-trust">
      <div className="px-[clamp(16px,1.6vw,24px)] pb-10 pt-[clamp(70px,8vw,100px)]">
        <p className="lp-label">Built For Trust</p>
        <h2 className="lp-h2 mt-3">Real departures. Booked on your terms.</h2>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#aed3b5]/70 px-2 py-[3px] font-['Newsreader'] text-[12px] text-[#3c6847]">
          <ShieldCheck size={12} strokeWidth={1.8} /> No commission, no booking fee
        </span>
      </div>
      <div className="grid border-t border-[#e3e5cf] md:grid-cols-[21%_1fr]">
        <div className="relative min-h-[240px] overflow-hidden border-b border-[#e3e5cf] md:border-b-0 md:border-r">
          <Cloud seed={33} w={520} h={220} className="absolute bottom-[-10%] left-[-25%] w-[120%]" />
          <Balloon seed={5} className="absolute left-[24%] top-[8%] w-[46%] max-w-[170px]" />
          <Cloud seed={41} w={420} h={170} className="absolute bottom-[-6%] right-[-30%] w-[90%]" />
        </div>
        <div>
          {TRUST.map(({ icon: I, title, text }) => (
            <div key={title} className="border-b border-[#e3e5cf] px-[clamp(16px,1.4vw,20px)] py-[18px] last:border-b-0">
              <p className="flex items-center gap-3 font-['Inter_Tight'] text-[16px] font-medium tracking-[-0.02em] text-[#252c38]"><I size={14} strokeWidth={1.6} className="text-[#3a4250]" />{title}</p>
              <p className="mt-2 max-w-[560px] pl-[26px] font-['Newsreader'] text-[13.5px] leading-[1.45] text-[#565c64]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
