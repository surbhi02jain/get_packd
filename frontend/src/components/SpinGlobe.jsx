import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, Loader2, ArrowUpRight, Sparkles } from "lucide-react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3-geo";
import { loadLand, reducedMotion } from "@/lib/world";
import { http, qs } from "@/lib/api";
import { fmtRange, short } from "@/lib/format";
import { InkLabel, InkTitle } from "@/components/Ink";
import { SeasonPill } from "@/components/Season";

const SPIN_MS = 2800;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUDGETS = [[null, "Any budget"], [20000, "Under ₹20k"], [50000, "Under ₹50k"], [100000, "Under ₹1L"]];
const easeOut = (x) => 1 - Math.pow(1 - x, 4);

/** The next six months as "YYYY-MM". */
function nextMonths() {
  const now = new Date();
  return [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * A globe that idles slowly, and on each new `target` spins a couple of turns and eases to a stop with that place
 * in the middle, then drops a pulsing pin on it. `points` are drawn as small dots.
 */
function Globe({ points, target }) {
  const ref = useRef(null);
  const anim = useRef({ rot: [-78, -22], from: null, to: null, t0: 0, landed: null });
  useEffect(() => {
    const a = anim.current;
    if (!target) return;
    const [lam0, phi0] = a.rot;
    // land facing the viewer, after at least a turn and a half in the idle direction
    let lam1 = -target.lng;
    while (lam1 > lam0 - 540) lam1 -= 360;
    a.from = [lam0, phi0]; a.to = [lam1, Math.max(-50, Math.min(50, -target.lat))]; a.t0 = performance.now(); a.landed = null;
    if (reducedMotion()) { a.rot = a.to; a.from = null; a.landed = performance.now(); }
  }, [target]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const proj = geoOrthographic().clipAngle(90);
    const path = geoPath(proj, ctx);
    const grat = geoGraticule10();
    let land = null, raf, size = 0, alive = true, last = performance.now();
    const resize = () => {
      size = canvas.parentElement.clientWidth;
      canvas.width = size * dpr; canvas.height = size * dpr;
      canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj.scale(size / 2 - 4).translate([size / 2, size / 2]);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    loadLand().then((l) => { land = l; });
    const still = reducedMotion();
    const draw = (now) => {
      if (!alive) return;
      const a = anim.current, dt = now - last; last = now;
      if (a.from) {
        const k = Math.min(1, (now - a.t0) / SPIN_MS), e = easeOut(k);
        a.rot = [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e];
        if (k >= 1) { a.from = null; a.landed = now; a.rot = [((a.rot[0] % 360) + 360) % 360 - 360, a.rot[1]]; }
      } else if (!a.landed && !still) {
        a.rot = [a.rot[0] - dt * 0.006, a.rot[1]];
      }
      proj.rotate(a.rot);
      ctx.clearRect(0, 0, size, size);
      const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size / 2, size / 2, size / 2);
      // a paper globe with the land inked in blue
      g.addColorStop(0, "#fbf8f1"); g.addColorStop(1, "#e7e0cf");
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); path(grat); ctx.strokeStyle = "rgba(16,69,245,0.09)"; ctx.lineWidth = 0.6; ctx.stroke();
      if (land) { ctx.beginPath(); path(land); ctx.fillStyle = "rgba(16,69,245,0.16)"; ctx.fill(); ctx.strokeStyle = "rgba(16,69,245,0.5)"; ctx.stroke(); }
      const center = [-a.rot[0], -a.rot[1]];
      for (const p of points) {
        if (geoDistance([p.lng, p.lat], center) >= Math.PI / 2) continue;
        const [x, y] = proj([p.lng, p.lat]);
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fillStyle = "rgba(232,168,30,0.9)"; ctx.fill();
      }
      if (target && a.landed) {
        const [x, y] = proj([target.lng, target.lat]);
        const pulse = ((now - a.landed) % 1600) / 1600;
        ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 22, 0, Math.PI * 2); ctx.strokeStyle = `rgba(201,48,42,${0.7 * (1 - pulse)})`; ctx.lineWidth = 2; ctx.stroke();
        const drop = Math.min(1, (now - a.landed) / 350);
        ctx.beginPath(); ctx.arc(x, y - (1 - drop) * 30, 6, 0, Math.PI * 2); ctx.fillStyle = "#c9302a"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#fbf8f1"; ctx.stroke();
      }
      ctx.beginPath(); path({ type: "Sphere" }); ctx.strokeStyle = "rgba(16,69,245,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [points, target]);
  return <canvas ref={ref} data-testid="spin-globe-canvas" aria-label="Globe that spins to a destination" />;
}

export default function SpinGlobe({ dests }) {
  const months = nextMonths();
  const [month, setMonth] = useState(null);
  const [budget, setBudget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(null);
  const [miss, setMiss] = useState(false);
  const [shown, setShown] = useState(false);
  const filters = () => ({ ...(month ? { start: `${month}-01`, flex: "month" } : {}), ...(budget ? { max_price: budget } : {}) });

  const spin = async () => {
    setBusy(true); setShown(false); setMiss(false);
    try {
      const { data } = await http.get(`/search?${qs({ ...filters(), limit: 1 })}`);
      // weighted towards places with more departures, and never the same place twice running
      const places = data.map.filter((m) => m.lat || m.lng);
      if (!places.length) { setMiss(true); setPick(null); return; }
      const others = places.filter((m) => m.slug !== pick?.dest.slug);
      const pool = others.length ? others : places;
      const weights = pool.map((m) => Math.sqrt(m.count)), total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total, dest = pool[0];
      for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { dest = pool[i]; break; } }
      const trips = await http.get(`/search?${qs({ ...filters(), dest: dest.slug, sort: "cheapest", limit: 3 })}`);
      const facts = trips.data.facts || [];
      setPick({ dest, trips: trips.data.clusters.map((c) => c.lead), total: trips.data.total_departures, fact: facts[Math.floor(Math.random() * facts.length)] || null, key: Date.now() });
      setTimeout(() => setShown(true), reducedMotion() ? 0 : SPIN_MS);
    } finally { setBusy(false); }
  };

  const chip = (on) => `chip border transition-colors ${on ? "border-[#1045f5] bg-[#1045f5] text-white" : "border-[#c9cdd1] hover:bg-white/70"}`;
  const seeAll = pick ? `/search?${qs({ ...filters(), q: pick.dest.destination })}` : "#";
  return (
    <section className="relative mx-auto max-w-[1200px] px-4 pt-28 sm:px-8" data-testid="spin-globe">
      {/* phones: controls, then the globe, then the result; wide screens: controls and result left, globe right */}
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        <div>
          <InkLabel>Can't decide?</InkLabel>
          <InkTitle className="mt-4" ink="globe.">Spin the</InkTitle>
          <p className="mt-5 max-w-md text-[#5b6066]">Pick a month and a budget, give it a spin, and we'll land on a place with group trips that fit.</p>
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMonth(null)} className={chip(!month)} data-testid="spin-month-any">Any month</button>
              {months.map((m) => <button key={m} onClick={() => setMonth(m)} className={chip(month === m)} data-testid={`spin-month-${m}`}>{MONTHS[+m.slice(5) - 1]}</button>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map(([b, l]) => <button key={l} onClick={() => setBudget(b)} className={chip(budget === b)} data-testid={`spin-budget-${b || "any"}`}>{l}</button>)}
            </div>
          </div>
          <button onClick={spin} disabled={busy} data-testid="spin-button"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1045f5] px-7 py-3.5 font-medium text-white shadow-lg shadow-[#1045f5]/25 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Dices size={18} />} {pick ? "Spin again" : "Spin the globe"}
          </button>
        </div>
        <div className="mx-auto w-full max-w-[340px] sm:max-w-[520px] lg:col-start-2 lg:row-span-2 lg:row-start-1"><Globe points={dests} target={pick?.dest} /></div>
        <div className="self-start lg:min-h-[220px]">
            {miss && <p className="text-sm text-[#5b6066]" data-testid="spin-miss">Nothing fits that month and budget yet. Try another month or a bigger budget.</p>}
            <AnimatePresence mode="wait">
              {pick && shown && (
                <motion.div key={pick.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }}
                  className="rounded-sm border border-[#d8d2c4] bg-[#f6f2e9] p-5 shadow-soft" data-testid="spin-result">
                  <p className="text-[10px] uppercase tracking-[.3em] text-[#c9302a]">You're going to</p>
                  <p className="mt-1 text-5xl font-light">{pick.dest.destination}</p>
                  <p className="mt-1 text-sm text-[#5b6066]">{pick.total} departure{pick.total === 1 ? "" : "s"} · from {short(pick.dest.min_price)}</p>
                  {pick.fact && <p className="mt-3 flex gap-2 rounded-sm bg-[#f2c14e]/25 px-3 py-2 text-sm" data-testid="spin-fact"><Sparkles size={15} className="mt-0.5 shrink-0 text-[#b98a12]" /><span><b className="font-semibold">Did you know?</b> {pick.fact}</span></p>}
                  <div className="mt-4 space-y-2">
                    {pick.trips.map((c) => (
                      <Link key={c.dep_id} to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} className="flex items-center justify-between gap-3 rounded-sm bg-white/60 px-3 py-2 text-sm transition-colors hover:bg-white">
                        <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="flex flex-wrap items-center gap-2 text-xs text-[#5b6066]">{c.op.name} · {fmtRange(c.start, c.end)} <SeasonPill season={c.season} /></span></span>
                        <span className="shrink-0 font-mono">{short(c.true_price)}</span>
                      </Link>
                    ))}
                  </div>
                  <Link to={seeAll} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1045f5] hover:underline" data-testid="spin-see-all">See all {pick.dest.destination} trips <ArrowUpRight size={14} /></Link>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
