import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { COLLECTIONS } from "@/lib/constants";
import { Balloon, Cloud, PackMark } from "./parts";

// the operator names on navy, each in its own wordmark style
const WHITE_MARKS = [
  (n) => <span className="font-['Inter_Tight'] text-[23px] font-bold tracking-[-0.045em]">{n.toLowerCase()}</span>,
  (n) => <span className="font-['Inter_Tight'] text-[21px] font-light tracking-[-0.02em]">{n.toLowerCase()}</span>,
  (n) => <span className="font-['Inter_Tight'] text-[13px] font-semibold uppercase tracking-[.3em]">{n}</span>,
  (n) => <span className="font-['Newsreader'] text-[23px]">{n}</span>,
  (n) => <span className="flex items-center gap-1.5 font-['Inter_Tight'] text-[19px] font-semibold tracking-[-0.03em]"><span className="h-[14px] w-[14px] rounded-full border-[3px] border-current" />{n}</span>,
];

function Marquee({ operators }) {
  const list = operators.slice(0, 14);
  if (!list.length) return null;
  const row = (copy) => list.map((o, i) => (
    <Link key={`${copy}-${o.id}`} to={`/operator/${o.id}`} tabIndex={copy ? -1 : 0} aria-hidden={copy ? true : undefined}
      className="shrink-0 whitespace-nowrap px-[clamp(22px,3vw,40px)] text-white/95 transition-opacity hover:opacity-60">
      {WHITE_MARKS[i % WHITE_MARKS.length](o.name)}
    </Link>
  ));
  return (
    <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
      <div className="lp-marquee flex w-max items-center">{row(0)}{row(1)}</div>
    </div>
  );
}

const initials = (n) => n.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || n.slice(0, 2).toUpperCase();

function StatCard({ stats, operators }) {
  const deps = stats?.departures;
  const named = operators.slice(0, 2), rest = operators.slice(2, 7);
  return (
    <div className="relative mx-auto flex w-[min(1010px,calc(100vw-32px))] flex-col overflow-hidden rounded-[8px] bg-[#253042] md:h-[340px] md:flex-row">
      <div className="relative min-h-[260px] flex-1">
        <div className="absolute left-[clamp(20px,10%,110px)] top-[clamp(36px,18%,70px)] flex items-end gap-2">
          <span className="lp-num-grad font-['Inter_Tight'] text-[clamp(88px,12vw,158px)] font-light leading-[.9] tracking-[-0.06em]">{deps ? deps.toLocaleString("en-IN") : "—"}</span>
          <span className="mb-2 font-['Newsreader'] text-[11px] text-[#c9d0dc]">departures</span>
        </div>
        <Cloud seed={52} w={560} h={230} className="absolute bottom-[-14%] left-[-6%] w-[min(460px,80%)]" />
        <Balloon seed={8} className="absolute bottom-[14%] left-[46%] w-[clamp(54px,7vw,84px)]" />
      </div>
      <div className="relative z-10 flex flex-col justify-center px-[clamp(20px,4vw,40px)] pb-10 md:w-[44%] md:pb-0">
        <p className="font-['Newsreader'] text-[17px] text-[#e3e8f0]">Listed from operators like</p>
        <div className="mt-5 flex flex-wrap gap-[10px]">
          {named.map((o) => (
            <Link key={o.id} to={`/operator/${o.id}`} className="flex h-[66px] min-w-[106px] items-center justify-center rounded-[3px] border border-[#4a5a71] bg-[#2d394d] px-4 font-['Inter_Tight'] text-[15px] text-[#e7ecf3] transition-colors hover:bg-[#34425a]">{o.name}</Link>
          ))}
          {rest.map((o) => (
            <Link key={o.id} to={`/operator/${o.id}`} title={o.name} className="flex h-[66px] w-[66px] items-center justify-center rounded-[3px] border border-[#4a5a71] bg-[#2d394d] font-['Newsreader'] text-[19px] text-[#e7ecf3] transition-colors hover:bg-[#34425a]">{initials(o.name)}</Link>
          ))}
        </div>
      </div>
      <Cloud seed={61} w={420} h={170} className="pointer-events-none absolute bottom-[-12%] right-[-5%] w-[min(260px,40%)]" />
    </div>
  );
}

const NOTES = [
  ["Women-only Trips", "Collection", "/trips/women-only-trips"],
  ["Spiti Group Trips in October", "Collection", "/trips/spiti-group-trips-october"],
  ["Visa Rules, Country by Country", "Guide", "/visas"],
  ["Solo Travel for 60+", "Collection", "/trips/solo-travel-60-plus"],
].filter(([, , to]) => !to.startsWith("/trips/") || COLLECTIONS[to.slice(7)]);

export function OperatorsBlock({ stats, operators }) {
  return (
    <section className="bg-[#344860] pb-[clamp(60px,7vw,90px)] pt-[clamp(80px,9vw,120px)] text-white" data-testid="landing-operators">
      <div className="px-4 text-center">
        <p className="font-['Newsreader'] text-[12.5px] text-[#c4ccd8]">The Operators</p>
        <h2 className="mx-auto mt-3 max-w-[460px] font-['Inter_Tight'] text-[clamp(25px,2.15vw,32px)] font-medium leading-[1.12] tracking-[-0.03em]">Every operator worth comparing, in one search.</h2>
        <p className="mx-auto mt-4 max-w-[430px] font-['Newsreader'] text-[13.5px] leading-[1.45] text-[#d0d7e1]">
          {stats ? `${stats.operators} operators with departures on the site and ${stats.operators_listed} listed, ` : "Operators "}from weekend trek clubs to international tour companies.
        </p>
      </div>
      <div className="mt-[clamp(44px,5vw,70px)]"><Marquee operators={operators} /></div>
      <div className="mt-[clamp(60px,7vw,100px)]"><StatCard stats={stats} operators={operators} /></div>

      <div className="mx-auto mt-[clamp(70px,8vw,110px)] w-[min(770px,calc(100vw-32px))]">
        <p className="font-['Newsreader'] text-[12px] text-[#c4ccd8]">Field Notes</p>
        <h3 className="mt-3 font-['Inter_Tight'] text-[20px] font-normal tracking-[-0.02em]">Short lists and guides from the team</h3>
        <div className="mt-4 border-t border-[#4b5c73]">
          {NOTES.map(([title, tag, to]) => (
            <Link key={to} to={to} className="group flex items-center justify-between gap-3 border-b border-[#4b5c73] px-2 py-[10px] transition-colors hover:bg-white/[.04]">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-['Newsreader'] text-[15px] text-[#eef2f6]">
                {title}
                <span className={`rounded-full px-2 py-[2px] font-['Newsreader'] text-[10.5px] ${tag === "Guide" ? "bg-[#a9d0aa] text-[#2f5a37]" : "bg-[#c3c5ea] text-[#3e4277]"}`}>{tag}</span>
              </span>
              <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[3px] bg-[#eef0d2] text-[#2b3240] transition-transform group-hover:translate-x-0.5"><ArrowRight size={12} /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const COLS = [
  ["Navigation", [["Trips", "/search"], ["Operators", "/operators"], ["Visas", "/visas"], ["Shortlist", "/shortlist"]]],
  ["Collections", Object.entries(COLLECTIONS).slice(0, 4).map(([slug, c]) => [c.title, `/trips/${slug}`])],
  ["For Operators", [["List your departures", "/list-your-departures"], ["All operators", "/operators"]]],
];

export function Closing() {
  const end = useRef(null);
  const { scrollYProgress } = useScroll({ target: end, offset: ["start end", "end end"] });
  const rise = useTransform(scrollYProgress, [0, 1], ["38%", "0%"]);
  const front = useTransform(scrollYProgress, [0, 1], ["22%", "0%"]);
  const back = useTransform(scrollYProgress, [0, 1], ["-6%", "4%"]);
  const wordmark = "getPackd".split("");
  return (
    <>
      <section className="bg-[#f8f9eb] px-4 py-[clamp(80px,9vw,120px)] text-center" data-testid="landing-cta">
        <h2 className="font-['Inter_Tight'] text-[clamp(26px,2.3vw,34px)] font-medium tracking-[-0.03em] text-[#1f2836]">Get packed.</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link to="/search" className="lp-btn lp-btn-navy">Find A Trip</Link>
          <Link to="/list-your-departures" className="lp-btn lp-btn-peach">List Your Trips</Link>
        </div>
      </section>

      <footer className="lp-sky lp-grain relative overflow-hidden" data-testid="landing-footer">
        <div className="relative z-10 mx-[12px] grid rounded-b-[10px] bg-[#f8f9eb] sm:grid-cols-3">
          {COLS.map(([h, links]) => (
            <div key={h} className="border-[#dfe2cd] px-[clamp(16px,2.4vw,26px)] pb-10 pt-7 sm:min-h-[300px] sm:border-r sm:last:border-r-0">
              <p className="font-['Newsreader'] text-[13px] text-[#7d8278]">{h}</p>
              <div className="mt-4 space-y-[9px]">
                {links.map(([l, to]) => <Link key={l} to={to} className="block font-['Newsreader'] text-[12.5px] text-[#2a313d] transition-opacity hover:opacity-60">{l}</Link>)}
              </div>
            </div>
          ))}
        </div>
        <p className="relative z-10 mt-4 text-center font-['Newsreader'] text-[12px] text-[#5d4d47]">getPackd © 2026 · Trips, dates and prices are read from each operator's own website</p>

        <div ref={end} className="relative h-[clamp(240px,30vw,470px)]">
          <motion.div style={{ y: back }} className="absolute inset-x-0 top-[6%]">
            <Cloud seed={71} w={640} h={260} className="absolute left-[-6%] top-0 w-[30%] min-w-[200px]" />
            <Cloud seed={77} w={600} h={250} className="absolute right-[-7%] top-[-8%] w-[34%] min-w-[220px]" />
          </motion.div>
          <motion.div style={{ y: rise }} className="absolute inset-x-0 bottom-[6%] flex items-end justify-center gap-[1.6vw] px-[3vw] text-[#1f2836]">
            <PackMark className="mb-[1.8vw] h-[14vw] w-[14vw] shrink-0" stroke={2.4} />
            <span className="flex font-['Newsreader'] text-[19.5vw] font-medium leading-[.78] tracking-[-0.035em]">
              {wordmark.map((ch, i) => (
                <motion.span key={i} initial={{ y: "45%", opacity: 0 }} whileInView={{ y: "0%", opacity: 1 }} viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.9, delay: 0.25 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} className="inline-block">{ch}</motion.span>
              ))}
            </span>
          </motion.div>
          <motion.div style={{ y: front }} className="pointer-events-none absolute inset-x-0 bottom-[-4%]">
            <Cloud seed={83} w={700} h={260} className="absolute bottom-0 left-[-8%] w-[46%] min-w-[260px]" />
            <Cloud seed={89} w={640} h={240} className="absolute bottom-[-6%] left-[30%] w-[40%] min-w-[240px]" />
            <Cloud seed={97} w={620} h={250} className="absolute bottom-[4%] right-[-10%] w-[38%] min-w-[220px]" />
          </motion.div>
        </div>
      </footer>
    </>
  );
}
