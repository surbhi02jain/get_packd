import { CalendarCheck, CalendarClock } from "lucide-react";
import { shortMoney } from "@/lib/format";
import { useApp } from "@/context/AppState";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TONE = {
  best: "bg-mint/15 text-emerald-800 dark:text-emerald-300",
  off: "bg-[#c9302a]/10 text-[#a3271f]",
};

/** "Best season" or the off-season reason for a departure's month; nothing for an ordinary month. */
export function SeasonPill({ season }) {
  if (!season) return null;
  const Icon = season.kind === "best" ? CalendarCheck : CalendarClock;
  return <span className={`chip ${TONE[season.kind]}`} data-testid={`season-pill-${season.kind}`}><Icon size={12} /> {season.label}</span>;
}

/** One line: "Best time: Jun–Sep · Dec–Mar: deep winter, heavy snow". */
export function seasonLine(season) {
  const parts = [];
  if (season.best_text) parts.push(`Best time: ${season.best_text}`);
  if (season.off_text) parts.push(`${season.off_text}: ${season.off_why.toLowerCase()}`);
  return parts.join(" · ");
}

export const monthKind = (season, m) => (!season ? null : season.best.includes(m) ? "best" : season.off.includes(m) ? "off" : null);

export function SeasonDot({ kind }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${kind === "best" ? "bg-mint" : kind === "off" ? "bg-[#c9302a]" : "bg-transparent"}`} />;
}

/** Jan to Dec for a destination: each month's season, and when this trip runs (departures and lowest price). */
export function SeasonStrip({ season, departures, selected }) {
  const { currency } = useApp();
  const short = (n) => shortMoney(n, currency);
  const byMonth = {};
  for (const d of departures) {
    if (d.status === "cancelled") continue;
    const m = Number(d.start.slice(5, 7));
    const cur = byMonth[m] || { count: 0, min: Infinity };
    byMonth[m] = { count: cur.count + 1, min: Math.min(cur.min, d.true_price) };
  }
  const selMonth = selected ? Number(selected.start.slice(5, 7)) : null;
  return (
    <div data-testid="season-strip">
      <p className="text-sm text-muted-foreground">{seasonLine(season)}</p>
      <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {M.map((label, i) => {
          const m = i + 1, kind = monthKind(season, m), runs = byMonth[m];
          return (
            <div key={label} data-testid={`season-month-${m}`}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center ${kind ? TONE[kind] : "bg-muted"} ${m === selMonth ? "ring-2 ring-coral" : ""}`}
              title={`${label}: ${kind === "best" ? "best season" : kind === "off" ? season.off_why.toLowerCase() : "fine to go"}${runs ? `, ${runs.count} departure${runs.count > 1 ? "s" : ""} from ${short(runs.min)}` : ""}`}>
              <span className="text-xs font-semibold">{label}</span>
              <span className="font-mono text-[10px]">{runs ? short(runs.min) : "–"}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-mint/40" /> Best season</span>
        {season.off.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#c9302a]/30" /> {season.off_why}</span>}
        <span>Prices are this trip's lowest that month · – means no departure</span>
      </div>
    </div>
  );
}
