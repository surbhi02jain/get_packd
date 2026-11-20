import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, SlidersHorizontal, Venus } from "lucide-react";
import { HIDDEN, STYLES } from "@/lib/constants";

// The row of trip styles under the search, like Airbnb's categories: an icon over a short label, the picked one underlined.
// Only the busiest few show, so the row stays short. Women-only groups come first, when the page gives `onWomenOnly`
// (it's a group make-up, not a style, so it sits alongside the styles rather than replacing one). On the right, one
// button opens every other filter.
const SHOWN = 6;
const WOMEN = "women-only";

export default function StyleBar({ counts = {}, active, onPick, filterCount, onFilters, womenOnly = false, onWomenOnly }) {
  const row = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  // the six styles with the most trips here, busiest first (the rest are under Filters); a picked one always shows
  const styles = Object.entries(STYLES).filter(([k]) => !HIDDEN.style.includes(k) && counts[k] > 0)
    .sort((a, b) => counts[b[0]] - counts[a[0]]).slice(0, SHOWN);
  if (active && !styles.some(([k]) => k === active) && STYLES[active]) styles.push([active, STYLES[active]]);
  const items = [["", "All trips", LayoutGrid], ...(onWomenOnly ? [[WOMEN, "Women-only", Venus]] : []),
    ...styles.map(([k, s]) => [k, s.label.replace(/ & .*/, ""), s.icon])];
  // "All trips" clears the style and women-only; the others turn their own filter on and off
  const isOn = (k) => (k === WOMEN ? womenOnly : k === "" ? !active && !womenOnly : active === k);
  const pick = (k) => {
    if (k === WOMEN) return onWomenOnly(!womenOnly);
    // one change for both, so neither overwrites the other
    if (k === "") return onPick(null, womenOnly ? { gender: null } : {});
    onPick(active === k ? null : k);
  };

  const measure = () => {
    const el = row.current;
    if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [styles.length]);
  const scroll = (dir) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.7, behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[#d8cdb9] bg-[#fffdf9] text-[#16181b] shadow-[0_1px_2px_rgba(0,0,0,.08)] transition-transform hover:scale-105";

  return (
    <div className="flex items-center gap-6" data-testid="style-bar">
      <div className="relative min-w-0 flex-1">
        {edge.left && <><span className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-16 bg-gradient-to-r from-[#f8f4ec] to-transparent" /><button aria-label="Earlier styles" onClick={() => scroll(-1)} className={`${arrow} left-0`}><ChevronLeft size={16} /></button></>}
        <div ref={row} onScroll={measure} className="flex gap-8 overflow-x-auto no-scrollbar">
          {items.map(([k, label, Icon]) => {
            const on = isOn(k);
            return (
              <button key={k || "all"} data-testid={`style-bar-${k || "all"}`} onClick={() => pick(k)} aria-pressed={on}
                className={`group flex shrink-0 flex-col items-center gap-2 border-b-2 pb-2.5 pt-1 transition-colors ${on ? "border-coral text-coral" : "border-transparent text-[#5b6066] hover:border-[#d8cdb9] hover:text-[#16181b]"}`}>
                <Icon size={24} strokeWidth={1.6} />
                <span className="whitespace-nowrap text-xs font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
        {edge.right && <><span className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-16 bg-gradient-to-l from-[#f8f4ec] to-transparent" /><button aria-label="More styles" onClick={() => scroll(1)} className={`${arrow} right-0`}><ChevronRight size={16} /></button></>}
      </div>
      {onFilters && <button data-testid="open-filters" onClick={onFilters}
        className="relative flex shrink-0 items-center gap-2 rounded-xl border border-[#e7dece] px-4 py-3.5 text-xs font-semibold text-[#16181b] transition-colors hover:border-[#16181b]">
        <SlidersHorizontal size={15} /> Filters
        {filterCount > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{filterCount}</span>}
      </button>}
    </div>
  );
}
