import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { loadLand } from "@/lib/world";
import { short, fmtDay } from "@/lib/format";
import { STATUS } from "@/lib/constants";

const W = 960, H = 470;

export function MapView({ points = [], onPick }) {
  const [land, setLand] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { loadLand().then(setLand); }, []);
  const proj = useMemo(() => geoNaturalEarth1().scale(175).translate([W / 2 - 40, H / 2 + 30]), []);
  const path = useMemo(() => geoPath(proj), [proj]);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-midnight p-2 shadow-soft grain" data-testid="map-view">
      <svg viewBox={`0 0 ${W} ${H}`} className="relative z-0 w-full">
        <path d={path({ type: "Sphere" })} fill="#0F2837" />
        {land && <path d={path(land)} fill="rgba(250,246,239,.14)" stroke="rgba(250,246,239,.25)" strokeWidth=".5" />}
        {points.map((p, i) => {
          const [x, y] = proj([p.lng, p.lat]);
          const on = hover === p.slug;
          return (
            <motion.g key={p.slug} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 12 }}
              onMouseEnter={() => setHover(p.slug)} onMouseLeave={() => setHover(null)} onClick={() => onPick(p)} style={{ cursor: "pointer" }} data-testid={`map-pin-${p.slug}`}>
              <circle cx={x} cy={y} r={on ? 7 : 5} fill="#FF6B4A" stroke="#FAF6EF" strokeWidth="2" />
              <motion.g animate={{ scale: on ? 1.15 : 1 }} style={{ originX: `${x}px`, originY: `${y - 18}px` }}>
                <rect x={x - 42} y={y - 34} width="84" height="22" rx="11" fill={on ? "#FFB547" : "#FAF6EF"} />
                <text x={x} y={y - 19} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0B1F2A">{p.destination.split(" ")[0]} {short(p.min_price)}</text>
              </motion.g>
              {on && <text x={x} y={y + 20} textAnchor="middle" fontSize="11" fill="#FAF6EF">{p.count} departures · tap to filter</text>}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

const MONTHS = [[2026, 9], [2026, 10], [2026, 11], [2027, 0]];
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function CalendarView({ days = [] }) {
  const map = useMemo(() => Object.fromEntries(days.map((x) => [x.date, x])), [days]);
  const [sel, setSel] = useState(null);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div className="space-y-6" data-testid="calendar-view">
      <div className="grid gap-4 md:grid-cols-2">
        {MONTHS.map(([y, m]) => {
          const first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
          return (
            <div key={`${y}-${m}`} className="rounded-3xl bg-card p-4 shadow-soft">
              <p className="mb-2 font-display text-lg">{MN[m]} {y}</p>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <span key={i} className="label-mono">{x}</span>)}
                {[...Array(lead)].map((_, i) => <span key={"l" + i} />)}
                {[...Array(n)].map((_, i) => {
                  const key = `${y}-${pad(m + 1)}-${pad(i + 1)}`, c = map[key];
                  return (
                    <button key={key} disabled={!c} data-testid={`calendar-day-${key}`} onClick={() => setSel(key)}
                      className={`aspect-square rounded-xl p-0.5 text-xs transition-colors ${c ? "bg-coral/10 hover:bg-coral hover:text-white" : "text-muted-foreground/50"} ${sel === key ? "!bg-coral text-white" : ""}`}>
                      <span className="block font-semibold">{i + 1}</span>
                      {c && <span className="block font-mono text-[9px] leading-tight">{short(c.min_price)}<br />{c.count}×</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {sel && map[sel] && (
        <div className="rounded-3xl bg-card p-4 shadow-soft" data-testid="calendar-day-list">
          <p className="font-display text-lg">Departing {fmtDay(sel)}</p>
          <div className="mt-2 divide-y">
            {map[sel].deps.map((x) => (
              <Link key={x.dep_id} to={`/trip/${x.trip_id}?dep=${encodeURIComponent(x.dep_id)}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-coral">
                <span className="truncate">{x.title} <span className="text-muted-foreground">· {x.op} · {x.duration}D</span></span>
                <span className="flex shrink-0 items-center gap-2"><span className={`chip ${STATUS[x.status].cls}`}>{STATUS[x.status].label}</span><b className="font-mono">{short(x.price)}</b></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
