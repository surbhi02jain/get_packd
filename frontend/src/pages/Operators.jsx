import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Globe2, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Frame, Glow, Kicker, Reveal, SplitHeading } from "@/components/Decor";
import { Counter } from "@/components/Motion";
import { InstaCount, RatingBadges } from "@/components/TripBits";
import { http } from "@/lib/api";
import { LABELS } from "@/lib/constants";
import { short } from "@/lib/format";

// the order the categories appear in on the shared operator list
const CATEGORIES = ["community", "trekking", "scuba", "women_specialist", "hostel", "aggregator", "legacy"];
const domain = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const initials = (name) => name.replace(/[&()]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function OperatorCard({ op }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }} whileHover={{ y: -5 }}>
      <Link to={`/operator/${op.id}`} data-testid={`operator-card-${op.id}`}
        className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-colors hover:border-coral/60">
        {/* light glancing across the card */}
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[520%]" />
        <div className="flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${op.departures ? "bg-coral text-white" : "bg-muted text-muted-foreground"}`}>{initials(op.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-display text-lg font-semibold leading-tight">{op.name}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[.22em] text-muted-foreground">{LABELS.op_type[op.category] || op.category}</p>
          </div>
          <ArrowUpRight size={18} className="shrink-0 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>
        <div className="mt-auto">
          {op.departures > 0
            ? <p className="text-sm"><b className="font-elegant text-3xl text-coral">{op.departures}</b> {op.departures === 1 ? "departure" : "departures"} · {op.trips} {op.trips === 1 ? "trip" : "trips"} <span className="text-muted-foreground">· from {short(op.from_price)}</span></p>
            : <p className="text-sm text-muted-foreground">{op.website ? "Trips not on getPackd yet — see their site" : "No website found yet"}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {op.website && <span className="flex min-w-0 items-center gap-1"><Globe2 size={12} className="shrink-0" /><span className="truncate">{domain(op.website)}</span></span>}
            {op.instagram && <span className="truncate">{op.instagram}</span>}
            <InstaCount handle={op.instagram} followers={op.instagram_followers} at={op.instagram_followers_at} source={op.instagram_followers_source} full plain />
            <RatingBadges ratings={op.external_ratings} plain />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Operators() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["operators"], queryFn: () => http.get("/operators").then((r) => r.data) });
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const all = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, all.filter((o) => o.category === c).length])), [all]);
  const shown = all.filter((o) => (cat === "all" || o.category === cat) && (!liveOnly || o.departures > 0) && o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const tabs = [["all", "All", all.length], ...CATEGORIES.filter((c) => counts[c]).map((c) => [c, LABELS.op_type[c] || c, counts[c]])];

  return (
    <div className="relative isolate min-h-screen overflow-x-clip">
      <Glow className="-left-40 top-[520px] h-[28rem] w-[28rem] bg-[#22B8A7]/10" duration={24} />
      <Glow className="-right-32 top-[900px] h-[26rem] w-[26rem] bg-coral/10" drift={-60} duration={28} />
      <Navbar />
      <section className="relative overflow-hidden bg-midnight text-white" data-testid="operators-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,184,167,.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,107,74,.18),transparent_55%)]" />
        <Frame />
        <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-14 pt-12 text-center sm:px-8 sm:pb-16 sm:pt-16">
          <Kicker className="justify-center !text-amber">Operators</Kicker>
          <SplitHeading as="h1" text="Every operator, in one place" className="mx-auto mt-3 max-w-4xl !text-5xl sm:!text-7xl" />
          <Reveal delay={0.25}><p className="mx-auto mt-3 max-w-xl text-white/80">The Indian companies running group trips, from creator communities to trekking specialists. We list them; we don't rate or vet them.</p></Reveal>
          <Reveal delay={0.4} className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
            {[[data?.total, "operators listed"], [data?.with_departures, "with live departures"]].map(([v, l]) => (
              <span key={l} className="flex items-baseline gap-2"><span className="font-elegant text-4xl text-amber sm:text-5xl"><Counter value={v} /></span><span className="text-[11px] uppercase tracking-[.3em] text-white/70">{l}</span></span>
            ))}
          </Reveal>
        </div>
      </section>

      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" data-testid="operator-category-tabs">
            {tabs.map(([k, label, n]) => (
              <button key={k} data-testid={`operator-tab-${k}`} onClick={() => setCat(k)} className={`relative rounded-full border px-4 py-2 text-sm transition-colors ${cat === k ? "border-coral/70 font-semibold" : "border-border/70 bg-card/70 hover:border-foreground/30"}`}>
                {cat === k && <motion.span layoutId="operator-tab-glow" className="absolute inset-0 rounded-full bg-gradient-to-br from-coral/25 to-amber/10" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                <span className="relative">{label} <span className="ml-1 font-mono text-[11px] text-muted-foreground">{n}</span></span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" data-testid="operators-live-only" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="h-4 w-4 accent-[#FF6B4A]" /> With departures only</label>
            <label className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2">
              <Search size={15} className="text-coral" />
              <input data-testid="operators-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an operator" className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
          </div>
        </div>

        <p className="mt-5 font-elegant text-3xl" data-testid="operators-count">{shown.length} {shown.length === 1 ? "operator" : "operators"}</p>
        {isError ? <p className="mt-8 text-muted-foreground">Couldn't load the operators. Is the backend running?</p>
          : isLoading ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[...Array(8)].map((_, i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}</div>
          : shown.length === 0 ? <p className="mt-8 text-muted-foreground" data-testid="operators-empty">No operator matches that.</p>
          : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="operators-grid">
              <AnimatePresence mode="popLayout">{shown.map((op) => <OperatorCard key={op.id} op={op} />)}</AnimatePresence>
            </div>
          )}
      </main>
      <Footer />
    </div>
  );
}
