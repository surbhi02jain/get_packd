import { MotionConfig, motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";
import { PassportStamp } from "@/components/Stamp";
import { SKETCHES, thumb } from "@/lib/sketches";

// About us, as a page of the same travel journal as the home page. It only says what the rest of the site doesn't:
// who getPackd is for, why it exists, and how the listings are kept current (the importer re-reads every operator's
// site on a schedule, IMPORT_EVERY_DAYS in the backend, 3 by default; past departures drop off; cancelled ones stay,
// marked). How search works, the honest price and what we don't do are on the home, trip and Operators pages already.

const sketch = (id) => SKETCHES.find((s) => s.id === id);
// placed so no print covers another's caption
const PRINTS = [
  { id: "kiyomizu", caption: "Kyoto", tilt: -5, className: "left-[1%] top-[5%] w-[46%] z-[1]", delay: 0.1 },
  { id: "pangong", caption: "Pangong Tso", tilt: 4, className: "right-[1%] top-0 w-[44%] z-[2]", delay: 0.25 },
  { id: "alleppey", caption: "Alleppey", tilt: -1.5, className: "left-[31.5%] top-[58%] w-[35%] z-[3] sm:top-[46%]", delay: 0.4 },
];
const FRESH = [
  ["Every 3 days", "each operator's site is read again", -3],
  ["Same day", "trips that have left drop off", 2.5],
  ["Never hidden", "cancelled dates stay, marked", -1.5],
];
const TAPE = "absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 bg-[#e9dfc6]/85 shadow-[0_1px_2px_rgba(0,0,0,.08)]";
const PRINT_SHADOW = "shadow-[0_1px_2px_rgba(60,45,20,.1),0_16px_26px_-12px_rgba(60,45,20,.4)]";

/** A photo print taped into the journal, with its place written underneath. */
function Print({ id, caption, tilt, className, delay }) {
  const s = sketch(id);
  if (!s) return null;
  return (
    <motion.figure initial={{ opacity: 0, y: 30, rotate: tilt * 2.5 }} animate={{ opacity: 1, y: 0, rotate: tilt }} whileHover={{ rotate: 0, y: -6, zIndex: 5 }}
      transition={{ type: "spring", stiffness: 150, damping: 17, delay }} className={`absolute rounded-[3px] bg-[#fffdf9] p-2 pb-10 sm:p-2.5 sm:pb-11 ${PRINT_SHADOW} ${className}`}>
      <span aria-hidden className={`${TAPE} ${tilt < 0 ? "rotate-[4deg]" : "-rotate-[3deg]"}`} />
      <img src={thumb(s.src, 700)} alt={`${s.place}${s.where ? `, ${s.where}` : ""}`} className="aspect-[4/5] w-full rounded-[2px] bg-[#e7dece] object-cover" draggable={false} />
      <figcaption className="absolute inset-x-0 bottom-1.5 text-center font-['Caveat'] text-[19px] text-[#16181b]/80 sm:bottom-2 sm:text-[21px]">{caption}</figcaption>
    </motion.figure>
  );
}

/** A manila luggage tag on a bit of string. */
function Tag({ value, label, tilt, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: -24, rotate: tilt * 4 }} whileInView={{ opacity: 1, y: 0, rotate: tilt }} viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 120, damping: 9, delay }} style={{ transformOrigin: "16px 50%" }} className="relative ml-10">
      <svg aria-hidden className="absolute -left-11 top-1/2 h-12 w-14 -translate-y-[85%]" viewBox="0 0 56 48" fill="none">
        <path d="M2 4 C 22 0, 30 34, 54 38" stroke="#9c8a63" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="relative flex min-h-[104px] w-[260px] items-center pl-11 pr-5 drop-shadow-[0_8px_10px_rgba(60,45,20,.18)]"
        style={{ background: "#ecdcb8", clipPath: "polygon(20px 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px), 0 20px)" }}>
        <span aria-hidden className="absolute left-[14px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-[#d8c08f] bg-[#f8f4ec]" />
        <div className="py-4">
          <div className="text-[26px] font-light leading-none text-[#16181b]">{value}</div>
          <div className="mt-2 whitespace-nowrap text-[13.5px] leading-snug text-[#5c513a]">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function About() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-screen overflow-x-clip bg-[#f8f4ec]">
        <Navbar />

        {/* who it's for, with three prints taped in beside it */}
        <section id="main" className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-6 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14" data-testid="about-hero">
          <div className="text-center lg:text-left">
            <InkLabel>About us</InkLabel>
            <InkTitle as="h1" className="mt-4" ink="with a group.">Made for travelling</InkTitle>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-[520px] text-[16px] leading-relaxed text-[#4a4f55] lg:mx-0">
                getPackd is for solo travellers who'd like company on the road, and for friends who'd rather someone else
                sorted the plan. A weekend trek, a week in the mountains, a festival abroad: if a group is already going,
                you should be able to find it and pick the one that suits you.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 flex items-center justify-center gap-2 font-['Caveat'] text-[28px] leading-none text-coral lg:justify-start">
                go with a group, come back with friends
                <svg aria-hidden viewBox="0 0 60 30" className="hidden h-7 w-14 lg:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 20 C 18 26, 36 24, 54 10" /><path d="M44 8 L55 9 L51 19" />
                </svg>
              </p>
            </Reveal>
          </div>
          <div className="relative mx-auto aspect-[1/1.3] w-full max-w-[500px] sm:aspect-[1/1.15]" data-testid="about-prints">
            {PRINTS.map((p) => <Print key={p.id} {...p} />)}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="absolute bottom-[4%] right-[2%] z-[4] h-28 w-28 sm:h-32 sm:w-32" style={{ rotate: "14deg" }}>
              <PassportStamp destination="India" ring="GROUP TRIPS ✦ GETPACKD ✦" sub="& BEYOND" className="h-full w-full text-[#c9302a]/80" />
            </motion.div>
          </div>
        </section>

        {/* why it exists, on a ruled index card */}
        <section className="mx-auto max-w-[1100px] px-4 pt-20 sm:px-8 sm:pt-24" data-testid="about-why">
          <motion.div initial={{ opacity: 0, y: 30, rotate: -4 }} whileInView={{ opacity: 1, y: 0, rotate: -1.2 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }} className={`relative mx-auto w-full max-w-[640px] rounded-[3px] px-7 pb-8 pl-14 sm:pl-16 sm:pr-10 ${PRINT_SHADOW}`}
            style={{ paddingTop: 31, backgroundColor: "#fffdf9", backgroundImage: "repeating-linear-gradient(transparent 0 31px, #dbe3ec 31px 32px)" }}>
            <span aria-hidden className={`${TAPE} -rotate-[2deg]`} />
            <span aria-hidden className="absolute inset-y-0 left-10 w-px bg-[#e6a6a0] sm:left-12" />
            <p className="font-['Caveat'] text-[32px] leading-[32px] text-coral">Why getPackd?</p>
            <p className="text-[15.5px] leading-[32px] text-[#3f444a]">
              Group trips are sold through Instagram pages, WhatsApp groups and dozens of small websites, and every operator
              writes their dates, prices and inclusions a different way. Comparing three trips takes a dozen tabs and a lot
              of messages. getPackd reads them all and writes them out the same way, so the comparing is done before you start.
            </p>
          </motion.div>
        </section>

        {/* how the listings stay current, on luggage tags */}
        <section className="mx-auto max-w-[1100px] px-4 pb-10 pt-24 sm:px-8 sm:pt-28" data-testid="about-fresh">
          <div className="mx-auto max-w-[820px] text-center">
            <InkLabel>Keeping it current</InkLabel>
            <InkTitle className="mt-4" ink="up to date.">How the trips stay</InkTitle>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
            {FRESH.map(([v, l, t], i) => <Tag key={v} value={v} label={l} tilt={t} delay={0.1 + i * 0.12} />)}
          </div>
        </section>
        <Footer />
      </div>
    </MotionConfig>
  );
}
