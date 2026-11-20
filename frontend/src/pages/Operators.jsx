import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Globe2, Instagram, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";
import { Counter } from "@/components/Motion";
import { RatingBadges } from "@/components/TripBits";
import { http } from "@/lib/api";
import { LABELS } from "@/lib/constants";
import { compact, money } from "@/lib/format";
import { useApp } from "@/context/AppState";

// the order the categories appear in on the shared operator list
const CATEGORIES = ["community", "trekking", "scuba", "women_specialist", "hostel", "aggregator", "legacy"];
const domain = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const initials = (name) => name.replace(/[&()]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function OperatorCard({ op }) {
  const { currency } = useApp();
  return (
    <motion.div layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }} whileHover={{ y: -5 }}>
      <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-colors hover:border-coral/60">
        {/* the whole card opens the operator's page; the website and Instagram links sit above it and go out to those sites */}
        <Link to={`/operator/${op.id}`} data-testid={`operator-card-${op.id}`} aria-label={op.name} className="absolute inset-0 rounded-2xl" />
        {/* light glancing across the card */}
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[520%]" />
        <div className="flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${op.departures ? "bg-[#16181b] text-white" : "bg-muted text-muted-foreground"}`}>{initials(op.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-display text-lg font-semibold leading-tight">{op.name}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">{LABELS.op_type[op.category] || op.category}</p>
          </div>
          <ArrowUpRight size={18} className="shrink-0 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>
        <div className="mt-auto">
          {op.departures > 0
            ? <p className="text-sm"><b className="font-elegant text-3xl text-[#16181b]">{op.departures}</b> {op.departures === 1 ? "departure" : "departures"} · {op.trips} {op.trips === 1 ? "trip" : "trips"} <span className="text-muted-foreground">· from {money(op.from_price, currency, true)}</span></p>
            : <p className="text-sm text-muted-foreground">{op.website ? "Trips not on getPackd yet — see their site" : "No website found yet"}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {op.website && <a href={op.website} target="_blank" rel="noreferrer" data-testid={`operator-card-website-${op.id}`} className="relative flex min-w-0 items-center gap-1 transition-colors hover:text-coral"><Globe2 size={12} className="shrink-0" /><span className="truncate">{domain(op.website)}</span></a>}
            {/* one Instagram link: the handle, with the follower count when we have it */}
            {op.instagram && (
              <a href={`https://www.instagram.com/${op.instagram.replace("@", "")}/`} target="_blank" rel="noreferrer" data-testid={`operator-card-instagram-${op.id}`}
                title={op.instagram_followers != null ? `${op.instagram_followers.toLocaleString("en-IN")} followers on Instagram. A sign of audience size, not a rating.` : undefined}
                className="relative flex min-w-0 items-center gap-1 transition-colors hover:text-coral">
                <Instagram size={12} className="shrink-0" /><span className="truncate">{op.instagram}</span>
                {op.instagram_followers != null && <span className="shrink-0">· <b className="font-semibold text-foreground">{compact(op.instagram_followers)}</b> followers</span>}
              </a>
            )}
            <RatingBadges ratings={op.external_ratings} plain />
          </div>
        </div>
      </div>
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
      <Navbar />
      <section className="mx-auto max-w-[1400px] px-4 pb-4 pt-14 text-center sm:px-8 sm:pt-20" data-testid="operators-hero">
        <InkLabel>Operators</InkLabel>
        <InkTitle as="h1" className="mt-4">Every operator, in one place.</InkTitle>
        <Reveal delay={0.1}><p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-relaxed text-[#5b6066]">The Indian companies running group trips, from creator communities to trekking specialists. We list them; we don't rate or vet them.</p></Reveal>
        <Reveal delay={0.2} className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
          {[[data?.total, "operators listed"], [data?.with_departures, "with live departures"]].map(([v, l]) => (
            <span key={l} className="flex items-baseline gap-2.5"><span className="text-[30px] font-light leading-none text-[#16181b]"><Counter value={v} /></span><span className="text-[11px] uppercase tracking-[.14em] text-[#5f656b]">{l}</span></span>
          ))}
        </Reveal>
      </section>

      <main id="main" className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" data-testid="operator-category-tabs">
            {tabs.map(([k, label, n]) => (
              <button key={k} data-testid={`operator-tab-${k}`} onClick={() => setCat(k)} className={`relative rounded-full border px-4 py-2 text-sm transition-colors ${cat === k ? "border-coral/70 font-semibold" : "border-border/70 bg-card/70 hover:border-foreground/30"}`}>
                {cat === k && <motion.span layoutId="operator-tab-glow" className="absolute inset-0 rounded-full bg-gradient-to-br from-coral/20 to-coral/5" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                <span className="relative">{label} <span className="ml-1 font-mono text-[11px] text-muted-foreground">{n}</span></span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" data-testid="operators-live-only" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="h-4 w-4 accent-coral" /> With departures only</label>
            <label className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2">
              <Search size={15} className="text-[#5f656b]" />
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
