import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, IndianRupee, ListChecks, Users } from "lucide-react";
import { createLoopScene } from "./loopScene";

const STEPS = [
  ["Read from the source", "Dates, prices and inclusions are read straight from each operator's own website, so every departure sits in one place."],
  ["Put side by side", "Each departure gets a true price, with what's included and what's extra added up, so trips line up like for like."],
  ["Booked with the operator", "Shortlist, compare, then go to the operator's own page to book. No payment on getPackd, and no commission."],
];

const Pill = ({ anchor, children }) => (
  <span data-anchor={anchor} className="absolute left-0 top-0 whitespace-nowrap rounded-[6px] border border-[#e4fbfa]/85 bg-[#2a3748] px-[9px] py-[2px] font-['Newsreader'] text-[clamp(12px,1vw,15px)] text-[#effcfb] opacity-0 transition-opacity duration-300">{children}</span>
);
const Icon = ({ anchor, icon: I }) => (
  <span data-anchor={anchor} className="absolute left-0 top-0 text-[#dff4f3] opacity-0"><I size={15} strokeWidth={1.4} /></span>
);
const Tag = ({ anchor, icon: I, children }) => (
  <span data-anchor={anchor} className="absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap font-['Inter_Tight'] text-[10px] font-medium uppercase tracking-[.08em] text-[#dff4f3] opacity-0"><I size={11} strokeWidth={1.6} />{children}</span>
);

export default function HowItWorks({ reduced }) {
  const section = useRef(null), canvas = useRef(null), overlay = useRef(null), scene = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let s;
    try { s = createLoopScene(canvas.current, overlay.current, { reduced }); } catch { return undefined; } // no WebGL: plain navy panel
    scene.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(canvas.current.parentElement);
    const io = new IntersectionObserver(([e]) => s.setRunning(e.isIntersecting), { rootMargin: "100px" });
    io.observe(section.current);
    const onMove = (e) => s.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove); s.dispose(); };
  }, [reduced]);

  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = section.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / total));
        scene.current?.setProgress(p);
        setStep(p < 0.35 ? 0 : p < 0.67 ? 1 : 2);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={section} className="relative h-[330vh] bg-[var(--paper)]" data-testid="landing-how">
      <div className="sticky top-0 flex h-[100svh] flex-col gap-4 px-[clamp(16px,1.6vw,24px)] pb-[clamp(16px,2vw,24px)] pt-[clamp(72px,9vh,92px)] md:flex-row md:gap-[22px]">
        <div className="flex shrink-0 flex-col justify-between md:w-[24%] md:min-w-[250px]">
          <div>
            <p className="lp-label">How It Works</p>
            <h2 className="lp-h2 mt-3 max-w-[300px] text-[#252c38]">Every group departure, on one page</h2>
          </div>
          <div className="hidden md:block">
            {STEPS.map(([title, text], i) => (
              <div key={title} className={i === step ? "my-3" : "my-1.5"}>
                <AnimatePresence initial={false} mode="popLayout">
                  {i === step ? (
                    <motion.div key="on" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="border-l-[1.5px] border-[#2b3240] pl-[14px]">
                      <p className="font-['Inter_Tight'] text-[42px] font-light leading-none tracking-[-0.04em] text-[#2b3240]">{i + 1}</p>
                      <p className="mt-5 font-['Inter_Tight'] text-[17px] font-medium tracking-[-0.02em] text-[#252c38]">{title}</p>
                      <p className="mt-2 max-w-[290px] font-['Newsreader'] text-[13.5px] leading-[1.42] text-[#545a63]">{text}</p>
                    </motion.div>
                  ) : (
                    <motion.p key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pl-[16px] font-['Newsreader'] text-[14px] text-[#b4b8ad]">{i + 1}</motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[6px] bg-[#2a3748]">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
          <div ref={overlay} className="pointer-events-none absolute inset-0">
            <Pill anchor="cube">Operators</Pill>
            <Pill anchor="sphere">getPackd</Pill>
            <Pill anchor="panels">Your shortlist</Pill>
            <Icon anchor="i-dates" icon={CalendarDays} />
            <Icon anchor="i-price" icon={IndianRupee} />
            <Icon anchor="i-group" icon={Users} />
            <Tag anchor="p-dates" icon={CalendarDays}>Dates</Tag>
            <Tag anchor="p-price" icon={IndianRupee}>True price</Tag>
            <Tag anchor="p-incl" icon={ListChecks}>Inclusions</Tag>
          </div>
        </div>

        {/* on phones the active step sits under the drawing */}
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="border-l-[1.5px] border-[#2b3240] pl-3">
              <p className="font-['Inter_Tight'] text-[15px] font-medium text-[#252c38]"><span className="mr-2 text-[#9a9f94]">{step + 1}</span>{STEPS[step][0]}</p>
              <p className="mt-1 font-['Newsreader'] text-[13.5px] leading-[1.4] text-[#545a63]">{STEPS[step][1]}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
