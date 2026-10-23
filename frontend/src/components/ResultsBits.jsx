import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LABELS } from "@/lib/constants";
import { fmtDay, fmtRange, short, monthName, iso, d } from "@/lib/format";

// Rating and verification sorts are left out: no operator has a rating yet and all are simply "listed".
const SORTS = [["best", "Best match"], ["cheapest", "Cheapest"], ["soonest", "Soonest"], ["shortest", "Shortest"]];

export function SortMenu({ sort, onChange }) {
  const label = (SORTS.find(([k]) => k === sort) || SORTS[0])[1];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-testid="sort-menu-trigger" className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted">
          <span className="text-muted-foreground">Sort:</span> {label} <ChevronDown size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SORTS.map(([k, l]) => (
          <DropdownMenuItem key={k} data-testid={`sort-option-${k}`} onClick={() => onChange(k)} className="flex items-center justify-between gap-6">
            <span>{l}</span>{(sort || "best") === k && <Check size={14} className="text-coral" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriceStrip({ data, params, update }) {
  const [mode, setMode] = useState("weeks");
  const rows = (data?.[mode] || []).filter((r) => r.count);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.min_price)), min = Math.min(...rows.map((r) => r.min_price));
  const keyOf = (r) => r.week || r.month;
  const active = (r) => mode === "weeks" ? params.start === r.week : params.flex === "month" && params.start?.startsWith(r.month);
  const pick = (r) => {
    if (mode === "weeks") { const s = d(r.week); const e = new Date(s); e.setDate(e.getDate() + 6); update({ start: r.week, end: iso(e), flex: "0" }); }
    else update({ start: `${r.month}-01`, end: null, flex: "month" });
  };
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4" data-testid="price-strip">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Cheapest departure by {mode === "weeks" ? "week" : "month"}</p>
        <div className="flex rounded-full bg-muted p-0.5 text-xs">
          {["weeks", "months"].map((m) => <button key={m} data-testid={`price-strip-mode-${m}`} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 capitalize ${mode === m ? "bg-card shadow-sm font-semibold" : ""}`}>{m}</button>)}
        </div>
      </div>
      <div className="flex h-28 items-end gap-1.5 overflow-x-auto no-scrollbar">
        {rows.map((r, i) => {
          const h = 14 + (r.min_price / max) * 56;
          const cheapest = r.min_price === min;
          return (
            <button key={keyOf(r)} data-testid={`price-strip-bar-${keyOf(r)}`} onClick={() => pick(r)} title={`${r.count} departures`} className="group flex min-w-[44px] flex-1 flex-col items-center justify-end gap-1">
              <span className={`font-mono text-[10px] ${cheapest ? "font-bold text-mint" : "text-muted-foreground"}`}>{short(r.min_price)}</span>
              <span style={{ height: h }}
                className={`w-full rounded-t-lg transition-colors ${active(r) ? "bg-coral" : cheapest ? "bg-mint" : "bg-midnight/15 group-hover:bg-coral/60 dark:bg-sand/20"}`} />
              <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">{mode === "weeks" ? fmtDay(r.week) : monthName(r.month)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SKIP = new Set(["sort", "view", "true_price", "flex", "end"]);
export function ActiveChips({ params, update, clear, preset = {} }) {
  const chips = [];
  Object.entries(params).forEach(([k, v]) => {
    if (SKIP.has(k) || !v || preset[k] === v) return;
    if (k === "q") chips.push([k, null, `“${v}”`]);
    else if (k === "start") chips.push([k, null, `${params.flex === "month" ? monthName(v.slice(0, 7)) : fmtRange(v, params.end || v)}${params.flex && !["0", "month"].includes(params.flex) ? ` ±${params.flex}` : ""}`]);
    else if (k === "min_price") chips.push([k, null, `From ${short(v)}`]);
    else if (k === "max_price") chips.push([k, null, `Up to ${short(v)}`]);
    else if (k === "seats") chips.push([k, null, `${v}+ seats`]);
    else if (k === "age_min" || k === "age_max") chips.push([k, null, `${k === "age_min" ? "Median ≥" : "Median ≤"} ${v}`]);
    else if (LABELS[k]) String(v).split(",").forEach((x) => chips.push([k, x, LABELS[k][x] || x]));
    else if (k === "country" || k === "operator") String(v).split(",").forEach((x) => chips.push([k, x, x]));
  });
  if (!chips.length) return null;
  const remove = (k, x) => {
    if (k === "start") return update({ start: null, end: null, flex: null });
    if (x === null) return update({ [k]: null });
    const next = String(params[k]).split(",").filter((y) => y !== x);
    update({ [k]: next.length ? next.join(",") : null });
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="active-chips">
      <AnimatePresence>
        {chips.map(([k, x, l]) => (
          <motion.button layout key={k + x} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
            data-testid={`active-chip-${k}-${x || "v"}`} onClick={() => remove(k, x)} className="chip border border-coral/40 bg-coral/10 text-coral hover:bg-coral hover:text-white">
            {l} <X size={12} />
          </motion.button>
        ))}
      </AnimatePresence>
      <button data-testid="clear-all-filters" onClick={clear} className="text-xs font-semibold underline underline-offset-4">Clear all</button>
    </div>
  );
}
