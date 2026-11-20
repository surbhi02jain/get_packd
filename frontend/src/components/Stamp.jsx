import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * A passport-style ink stamp that thumps down: getPackd and `rim` round the edge, the place and date in the middle.
 * `sub` replaces the date line; `onView` waits to thump until the stamp scrolls into sight (the footer's does).
 * `ring`, when given, is the whole text round the edge, spaced evenly to go round exactly once (for longer words).
 */
export function PassportStamp({ destination, date, rim = "ENQUIRY SENT", ring, sub, className = "mx-auto h-44 w-44 text-coral", onView = false }) {
  const place = (destination || "Bon voyage").toUpperCase().slice(0, 14);
  const when = sub ?? (date ? `${date.slice(8, 10)} ${M[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}` : "");
  const down = { scale: 1, opacity: 1, rotate: -12 };
  return (
    <motion.svg viewBox="0 0 200 200" className={className} data-testid="passport-stamp" aria-label={`Stamped: ${rim.toLowerCase()}, ${destination}`}
      initial={{ scale: 2.4, opacity: 0, rotate: -28 }} {...(onView ? { whileInView: down, viewport: { once: true, margin: "-40px" } } : { animate: down })}
      transition={{ type: "spring", stiffness: 520, damping: 17, delay: 0.1 }}>
      <defs>
        {/* uneven ink, so it reads as a rubber stamp rather than a drawing */}
        <filter id="stamp-ink"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.25" /><feComposite in="SourceGraphic" operator="in" /></filter>
        <path id="stamp-rim" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
      </defs>
      <g filter="url(#stamp-ink)" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="92" strokeWidth="5" />
        <circle cx="100" cy="100" r="60" strokeWidth="2" />
        <text fill="currentColor" stroke="none" fontSize="13" fontWeight="700" letterSpacing="3.2" style={{ fontFamily: '"Jost", sans-serif' }}>
          {ring ? <textPath href="#stamp-rim" textLength="458" lengthAdjust="spacing">{ring}</textPath>
            : <textPath href="#stamp-rim">{`GETPACKD ✦ ${rim} ✦ GETPACKD ✦ ${rim} ✦`}</textPath>}
        </text>
        <path d="M84 72 l9 9 19-20" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="100" y="112" textAnchor="middle" fill="currentColor" stroke="none" fontSize={place.length > 10 ? 13 : 16} fontWeight="800" letterSpacing="1.5" style={{ fontFamily: '"Jost", sans-serif' }}>{place}</text>
        <text x="100" y="131" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11" fontWeight="600" letterSpacing="2" style={{ fontFamily: '"Jost", sans-serif' }}>{when}</text>
      </g>
    </motion.svg>
  );
}

const BY_CLIMATE = {
  snow: ["Thermal base layers", "Insulated down jacket", "Gloves, beanie and wool socks", "Waterproof boots with grip"],
  mountains: ["Layers you can add and take off", "Broken-in trekking shoes", "SPF 50 sunscreen and lip balm", "Sunglasses"],
  beach: ["Swimwear and a quick-dry towel", "Flip-flops", "Reef-safe sunscreen", "A dry bag for phone and cash"],
  desert: ["A scarf against sun and dust", "Sunglasses and a cap", "A warm layer for cold desert nights"],
  jungle: ["Insect repellent", "Quick-dry full-sleeve clothes"],
  city: ["Comfortable walking shoes", "A small day bag"],
};

/** A short packing list from the trip's climate and the season of its month. General advice, not the operator's list. */
export function packingList({ climate = [], season, intl }) {
  const off = season?.kind === "off" ? season.label.toLowerCase() : "";
  const items = [
    ...(intl ? ["Passport valid for 6+ months", "Forex card or some local cash", "Universal plug adapter"] : ["Photo ID (Aadhaar, licence or passport)"]),
    ...(/monsoon|rain|wet/.test(off) ? ["Rain jacket or poncho", "Rain cover for your bag"] : []),
    ...(/heat/.test(off) ? ["Light cotton clothes", "ORS or electrolyte sachets"] : []),
    ...(/winter|snow/.test(off) ? BY_CLIMATE.snow : []),
    ...climate.flatMap((c) => BY_CLIMATE[c] || []),
    "Power bank", "Refillable water bottle", "Your regular medicines",
  ];
  return [...new Set(items)].slice(0, 10);
}

export function PackingList({ items, destination, month }) {
  const [done, setDone] = useState([]);
  const toggle = (it) => setDone((d) => (d.includes(it) ? d.filter((x) => x !== it) : [...d, it]));
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Packing for ${destination}${month ? ` in ${month}` : ""}:\n${items.map((i) => `- ${i}`).join("\n")}`); toast.success("Packing list copied"); }
    catch { toast.error("Couldn't copy; select the list instead"); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6 rounded-2xl border bg-muted/40 p-4 text-left" data-testid="packing-list">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Start packing for {destination}{month ? ` in ${month}` : ""}</p>
        <button onClick={copy} className="flex items-center gap-1 text-xs underline" data-testid="packing-copy"><Copy size={12} /> Copy</button>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {items.map((it, i) => (
          <motion.li key={it} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.05 }}>
            <button onClick={() => toggle(it)} className={`flex w-full items-start gap-2 text-left text-sm ${done.includes(it) ? "text-muted-foreground line-through" : ""}`}>
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${done.includes(it) ? "border-mint bg-mint text-white" : "border-foreground/30"}`}>{done.includes(it) && <Check size={11} />}</span>{it}
            </button>
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">A general list for the place and season. Check the operator's own kit list too.</p>
    </motion.div>
  );
}
