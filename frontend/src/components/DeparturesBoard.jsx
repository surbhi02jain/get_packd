import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/api";
import { short } from "@/lib/format";
import { reducedMotion } from "@/lib/world";
import { EllipseLink } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";

// A split-flap board of the soonest departures, printed in blue ink on paper tiles. Every letter flips through the
// alphabet before it settles.
const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROWS = 7;
const PAGE_MS = 9000;
const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// [header, width in letters, width on phones (0 = hidden), class that hides it below a breakpoint]
const COLS = [["Date", 6, 6, ""], ["Destination", 13, 8, ""], ["Operator", 14, 0, "hidden lg:flex"], ["Days", 3, 0, "hidden sm:flex"], ["Fare", 9, 6, ""], ["Remarks", 8, 0, "hidden md:flex"]];
// one letter tile plus the 2px gap after it, from the tablet breakpoint up
const TILE_REM = 1.375;
const PHONE_TILE_PX = 14;

const fit = (s, n) => s.toUpperCase().replace(/[^A-Z0-9 ₹,.&-]/g, "").slice(0, n).padEnd(n, " ");
const remark = (c) => (c.status === "filling" ? "FILLING" : c.seats_left != null && c.seats_left <= 5 ? `${c.seats_left} SEATS` : "ON TIME");
const rowText = (c, narrow) => [
  `${c.start.slice(8, 10)} ${M[+c.start.slice(5, 7) - 1]}`, c.destination, c.op.name, `${c.duration}D`,
  // on phones the fare is shortened, but only from ₹10k up, so ₹839 never shows as "₹1K"
  narrow && c.true_price >= 10000 ? short(c.true_price).toUpperCase() : `₹${Math.round(c.true_price).toLocaleString(narrow ? "en-US" : "en-IN", { useGrouping: !narrow })}`, remark(c),
];

function useNarrow() {
  const q = "(max-width: 639px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q), on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function Flap({ text, width, delay }) {
  const target = fit(text, width);
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (reducedMotion()) { setShown(target); return undefined; }
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      // letter k keeps flipping until its own turn comes, so the row settles left to right
      const next = [...target].map((ch, k) => (tick >= delay + k * 1.5 + 6 ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]));
      setShown(next.join(""));
      if (tick >= delay + width * 1.5 + 6) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [target, width, delay]);
  return (
    <span className="flex gap-[2px]">
      {[...shown].map((ch, k) => (
        <span key={k} className="relative grid h-6 w-3 place-items-center rounded-[2px] border border-[#e2dccd] bg-[#fdfbf6] font-mono text-[10px] font-semibold text-[#1045f5] sm:h-8 sm:w-5 sm:rounded-[3px] sm:text-[13px]">
          {ch}
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#d8d2c4]" />
        </span>
      ))}
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span className="font-mono text-2xl text-[#1045f5] tabular-nums" data-testid="board-clock">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>;
}

export default function DeparturesBoard() {
  const { data } = useQuery({ queryKey: ["board"], queryFn: () => http.get("/search?sort=soonest&limit=28").then((r) => r.data), staleTime: 300000 });
  const all = (data?.clusters || []).map((c) => c.lead).filter((c) => c.status !== "cancelled");
  const pages = Math.max(1, Math.ceil(all.length / ROWS));
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (pages < 2 || reducedMotion()) return undefined;
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);
  const narrow = useNarrow();
  const rows = all.slice(page * ROWS, page * ROWS + ROWS);
  const cols = COLS.map(([h, w, phone, cls]) => ({ h, w: narrow ? phone : w, cls: narrow ? "flex" : cls || "flex" })).map((c) => ({ ...c, show: c.w > 0 }));
  const colStyle = (c) => ({ width: narrow ? `${c.w * PHONE_TILE_PX}px` : `${c.w * TILE_REM}rem` });
  if (!all.length) return null;
  return (
    <section className="relative mx-auto max-w-[1200px] px-4 pt-28 sm:px-8" data-testid="departures-board">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><InkLabel>Leaving soon</InkLabel><InkTitle className="mt-4" ink="board.">Departures</InkTitle></div>
        <div className="text-right"><p className="text-[10px] uppercase tracking-[.3em] text-[#8d9296]">Local time</p><Clock /></div>
      </div>
      <div className="mt-10 overflow-hidden rounded-sm border border-[#d8d2c4] bg-[#f6f2e9] p-3 shadow-soft sm:p-6">
        <div className="flex gap-2 border-b border-[#d8d2c4] pb-3 sm:gap-4 text-[10px] uppercase tracking-[.3em] text-[#8d9296]">
          {cols.filter((c) => c.show).map((c) => <span key={c.h} className={`${c.cls} shrink-0`} style={colStyle(c)}>{c.h}</span>)}
        </div>
        <div className="divide-y divide-[#e6e0d2]">
          {rows.map((c, r) => (
            <Link key={`${page}-${c.dep_id}`} to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} data-testid={`board-row-${c.dep_id}`}
              className="flex gap-2 overflow-hidden py-2 transition-colors hover:bg-[#1045f5]/[.04] sm:gap-4">
              {rowText(c, narrow).map((t, k) => cols[k].show && (
                <span key={k} className={`${cols[k].cls} shrink-0`} style={colStyle(cols[k])}><Flap text={t} width={cols[k].w} delay={r * 3} /></span>
              ))}
            </Link>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-[#8d9296]">
          <span>Soonest departures from every operator · tap a row for the trip</span>
          <span className="font-mono">{page + 1}/{pages}</span>
        </div>
      </div>
      <div className="mt-6 flex justify-center"><EllipseLink to="/search?sort=soonest" testId="board-see-all" className="text-[#1045f5]">See every departure</EllipseLink></div>
    </section>
  );
}
