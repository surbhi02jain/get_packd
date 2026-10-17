import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring } from "framer-motion";

export function Counter({ value, format = (v) => Math.round(v).toLocaleString("en-IN"), testId }) {
  const [shown, setShown] = useState(value || 0);
  const prev = useRef(value || 0);
  useEffect(() => {
    const c = animate(prev.current, value || 0, { duration: 0.6, ease: "easeOut", onUpdate: setShown });
    prev.current = value || 0;
    return () => c.stop();
  }, [value]);
  return <span data-testid={testId}>{format(shown)}</span>;
}

export function Magnetic({ children, className = "", strength = 0.25 }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 }), sy = useSpring(y, { stiffness: 200, damping: 15 });
  return (
    <motion.div
      className={`inline-block ${className}`}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

export function SampleBadge({ className = "" }) {
  return (
    <span data-testid="listing-source-badge" title="Trips, dates and prices are read from each operator's own website. Check the operator's page before you book." className={`label-mono rounded-full border border-dashed border-amber-500/60 bg-amber-50 px-2 py-0.5 !text-amber-800 dark:bg-amber-950/40 dark:!text-amber-300 ${className}`}>
      Prices from operator sites
    </span>
  );
}
