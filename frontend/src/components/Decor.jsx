// Shared decorative and motion pieces used across pages: reveals, stars, glows, frames and the oval link.
import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { MoveRight } from "lucide-react";
import { Counter } from "@/components/Motion";

export const EASE = [0.22, 1, 0.36, 1];

export const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay, duration: 0.7, ease: EASE }} className={className}>{children}</motion.div>
);

/** Four-point star that twinkles. */
export function Star({ size = 22, delay = 0, className = "" }) {
  return (
    <motion.svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor"
      animate={{ scale: [1, 0.55, 1], opacity: [0.75, 0.25, 0.75], rotate: [0, 45, 0] }} transition={{ duration: 4.5, delay, repeat: Infinity, ease: "easeInOut" }}>
      <path d="M12 0C12.8 7 17 11.2 24 12C17 12.8 12.8 17 12 24C11.2 17 7 12.8 0 12C7 11.2 11.2 7 12 0Z" />
    </motion.svg>
  );
}

/** Soft pool of coloured light that drifts slowly behind a section. */
export function Glow({ className = "", drift = 60, duration = 18 }) {
  return (
    <motion.span aria-hidden className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${className}`}
      animate={{ x: [0, drift, 0], y: [0, drift * 0.6, 0] }} transition={{ duration, repeat: Infinity, ease: "easeInOut" }} />
  );
}

/** Small spaced-out label above a heading. */
export const Kicker = ({ children, className = "" }) => (
  <Reveal className={`flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.38em] text-muted-foreground ${className}`}>
    <Star size={10} className="text-coral" />{children}
  </Reveal>
);

/** Heading whose words rise from behind a mask, one after another, when scrolled into view. */
export function SplitHeading({ text, className = "", as = "h2" }) {
  const Tag = motion[as];
  return (
    <Tag initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} transition={{ staggerChildren: 0.06 }} className={`font-elegant text-4xl leading-[1.05] sm:text-6xl ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="mr-[0.25em] inline-block overflow-hidden pb-[0.14em] align-bottom">
          <motion.span className="inline-block" variants={{ hidden: { y: "115%" }, show: { y: 0, transition: { duration: 0.8, ease: EASE } } }}>{w}</motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Link circled by two hand-drawn ovals that draw themselves in. */
export function EllipseLink({ to, children, testId, className = "" }) {
  const draw = (delay) => ({ initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.3, delay, ease: "easeInOut" } });
  return (
    <Link to={to} data-testid={testId} className={`group relative inline-flex items-center gap-4 px-11 py-4 text-sm font-semibold ${className}`}>
      <svg aria-hidden viewBox="0 0 260 64" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.2"
        className="absolute inset-0 h-full w-full overflow-visible transition-transform duration-500 group-hover:rotate-2 group-hover:scale-105">
        <motion.ellipse cx="130" cy="32" rx="127" ry="27" transform="rotate(-2 130 32)" vectorEffect="non-scaling-stroke" {...draw(0.1)} />
        <motion.ellipse cx="130" cy="32" rx="129" ry="23" transform="rotate(2.5 130 32)" vectorEffect="non-scaling-stroke" {...draw(0.35)} />
      </svg>
      <span className="relative">{children}</span>
      <MoveRight size={30} strokeWidth={1} className="relative transition-transform duration-300 group-hover:translate-x-2" />
    </Link>
  );
}

/** Card that tilts in 3D towards the cursor. */
export function Tilt({ children, className = "", max = 9 }) {
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 16 }), sry = useSpring(ry, { stiffness: 180, damping: 16 });
  return (
    <motion.div className={className} style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}>
      {children}
    </motion.div>
  );
}

/** Number that counts up from zero the first time it scrolls into view. */
export function CountUp({ value, format }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return <span ref={ref}><Counter value={inView ? value : 0} format={format} /></span>;
}

/** Thin white frame and stars laid over a photo; the lines draw themselves when it comes into view. */
export function Frame({ navTop = null }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const line = "absolute bg-white/25";
  const grow = (axis, delay) => ({ initial: { [axis]: 0 }, animate: { [axis]: inView ? 1 : 0 }, transition: { duration: 1.5, delay, ease: EASE } });
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden text-white xl:block">
      <motion.span className={`${line} left-[12%] top-0 h-full w-px origin-top`} {...grow("scaleY", 0)} />
      <motion.span className={`${line} right-[12%] top-0 h-full w-px origin-bottom`} {...grow("scaleY", 0.15)} />
      {navTop !== null && <motion.span className={`${line} left-[12%] right-[12%] h-px`} style={{ top: navTop }} {...grow("scaleX", 0.3)} />}
      <motion.span className={`${line} left-0 top-[70%] h-px w-[12%] origin-left`} {...grow("scaleX", 0.6)} />
      <motion.span className={`${line} right-0 top-[70%] h-px w-[12%] origin-right`} {...grow("scaleX", 0.6)} />
      <Star size={30} className="absolute left-[4%] top-[9%]" />
      <Star size={18} delay={1.4} className="absolute right-[3.5%] top-[23%]" />
      <Star size={20} delay={2.6} className="absolute left-[13.5%] bottom-[6%]" />
    </div>
  );
}
