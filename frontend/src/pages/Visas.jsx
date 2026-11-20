import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, ExternalLink, FileText, Info, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Decor";
import { InkLabel, InkTitle } from "@/components/Ink";
import { http } from "@/lib/api";

export const VISA_KIND = {
  none: ["No visa", "bg-mint/15 text-emerald-800 dark:text-emerald-300"],
  free: ["Visa-free", "bg-mint/15 text-emerald-800 dark:text-emerald-300"],
  permit: ["Entry permit", "bg-sky-500/15 text-sky-800 dark:text-sky-300"],
  eta: ["Online authorisation", "bg-sky-500/15 text-sky-800 dark:text-sky-300"],
  arrival: ["Visa on arrival", "bg-[#16181b]/[.07] text-[#16181b]"],
  evisa: ["e-Visa", "bg-[#16181b]/[.07] text-[#16181b]"],
  visa: ["Visa needed", "bg-[#c9302a]/10 text-[#a3271f]"],
};
// the filter tabs group the kinds into what a traveller has to do
const GROUPS = [["all", "All", null], ["easy", "No visa needed", ["none", "free", "permit"]], ["arrival", "On arrival", ["arrival"]], ["online", "Apply online", ["eta", "evisa"]], ["embassy", "Visa from embassy / VFS", ["visa"]]];
const ORDER = Object.keys(VISA_KIND);
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const checkedOn = (iso) => (iso ? `${+iso.slice(8, 10)} ${M[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : "");

export function VisaBadge({ kind }) {
  const [label, cls] = VISA_KIND[kind] || [kind, "bg-muted"];
  return <span className={`chip ${cls}`} data-testid={`visa-kind-${kind}`}>{label}</span>;
}

function Fact({ label, children }) {
  return <div><p className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-0.5 text-sm">{children}</p></div>;
}

// `linkSelf`: on the list of every country, each card also links to the country's own page
function CountryCard({ v, open, onToggle, linkSelf = false }) {
  return (
    <motion.article layout id={v.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }} data-testid={`visa-card-${v.key}`}
      className={`scroll-mt-28 rounded-2xl border bg-card p-5 shadow-soft transition-colors ${open ? "border-coral/60" : "border-border/60"}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>{v.flag}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-semibold">{v.country}</h2><VisaBadge kind={v.kind} />{v.group && <span className="chip bg-muted text-muted-foreground" data-testid={`visa-group-${v.key}`}>🇪🇺 {v.group}</span>}</div>
          <p className="mt-1 text-sm text-muted-foreground">{v.headline}</p>
        </div>
      </div>
      {v.members && <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid={`visa-members-${v.key}`}><span className="font-semibold text-foreground">Covers:</span> {v.members.join(", ")}</p>}
      <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
        <Fact label="Stay">{v.stay}</Fact>
        <Fact label="Cost">{v.cost}</Fact>
        <Fact label="How">{v.apply}</Fact>
      </div>
      <button onClick={onToggle} data-testid={`visa-toggle-${v.key}`} aria-expanded={open}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
        <span className="flex items-center gap-2"><FileText size={15} className="text-[#16181b]" /> Documents to carry · {v.documents.length}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ul className="mt-3 space-y-1.5 text-sm">{v.documents.map((d) => <li key={d} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16181b]/60" />{d}</li>)}</ul>
            {v.notes.length > 0 && <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">{v.notes.map((n) => <li key={n} className="flex gap-2"><Info size={14} className="mt-0.5 shrink-0 text-[#5f656b]" />{n}</li>)}</ul>}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {v.official.map((o) => <a key={o.url} href={o.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-coral hover:underline">{o.label} <ExternalLink size={11} /></a>)}
        {linkSelf && <Link to={`/visas/${v.key}`} data-testid={`visa-page-link-${v.key}`} className="font-medium text-coral hover:underline">{v.country} page →</Link>}
        {v.destinations.filter((d) => d.departures > 0).map((d) => (
          <Link key={d.slug} to={`/search?q=${encodeURIComponent(d.name)}`} className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{d.departures} {d.name} departures →</Link>
        ))}
      </div>
    </motion.article>
  );
}

const useVisas = () => useQuery({ queryKey: ["visas"], queryFn: () => http.get("/visas").then((r) => r.data) });
const DISCLAIMER = "For Indian ordinary passports. getPackd isn't a visa agent and doesn't arrange visas; some operators include the visa in the trip price, so check the trip's inclusions. Always confirm on the official site linked for each country.";

/** One country's visa on a page of its own (/visas/srilanka), which a trip page's "Details" link opens. */
function OneCountry({ k }) {
  const { data, isLoading, isError } = useVisas();
  // a country, or a one-visa-many-countries card such as Schengen, which a Europe trip links to
  // the address can be written loosely: /visas/sri-lanka and /visas/Sri%20Lanka are /visas/srilanka
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const all = data ? [...data.countries, ...(data.groups || [])] : [];
  const v = all.find((c) => c.key === k) || all.find((c) => norm(c.key) === norm(k) || norm(c.country) === norm(k));
  const [open, setOpen] = useState(true);
  const name = v?.members ? `the ${v.country.replace(/\s*\(.*\)$/, "")}` : v?.country;
  return (
    <div className="relative isolate min-h-screen overflow-x-clip">
      <Navbar />
      <main id="main" className="mx-auto max-w-[760px] px-4 pb-24 pt-10 sm:px-8 sm:pt-14" data-testid="visa-country-page">
        <Link to="/visas" data-testid="visas-all-link" className="inline-flex items-center gap-1.5 text-sm text-[#5b6066] transition-colors hover:text-[#16181b]"><ArrowLeft size={15} /> All countries</Link>
        {isError ? <p className="mt-10 text-muted-foreground">Couldn't load the visa rules. Is the backend running?</p>
          : isLoading ? <div className="shimmer mt-10 h-72 rounded-2xl" />
          : v && v.key !== k ? <Navigate to={`/visas/${v.key}`} replace />
          : !v ? (
            <p className="mt-10 text-muted-foreground" data-testid="visa-country-missing">We don't have visa rules for that country yet. <Link to="/visas" className="text-coral hover:underline">See every country</Link>.</p>
          ) : (
            <>
              <div className="mt-8 text-center">
                <InkLabel>Visa for Indian passports</InkLabel>
                <InkTitle as="h1" className="mt-4" ink={`${name}.`}>What you need for</InkTitle>
                {data.checked && <Reveal delay={0.1}><p className="mt-5 text-[11px] uppercase tracking-[.14em] text-[#5f656b]">Last checked {checkedOn(data.checked)}</p></Reveal>}
              </div>
              <div className="mt-10"><CountryCard v={v} open={open} onToggle={() => setOpen((o) => !o)} /></div>
            </>
          )}
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
      </main>
      <Footer />
    </div>
  );
}

export default function Visas() {
  const { key } = useParams();
  const { hash } = useLocation();
  if (key) return <OneCountry key={key} k={key} />;
  // older links point at a country on the full list (/visas#vietnam); that country has its own page now
  if (hash.length > 1) return <Navigate to={`/visas/${hash.slice(1)}`} replace />;
  return <AllCountries />;
}

function AllCountries() {
  const { data, isLoading, isError } = useVisas();
  const [sp] = useSearchParams();
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState(() => sp.get("q") || "");
  const [open, setOpen] = useState([]);
  // easiest entry first, then A to Z
  const all = useMemo(() => [...(data?.countries || [])].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.country.localeCompare(b.country)), [data]);
  const kinds = (g) => GROUPS.find(([k]) => k === g)[2];
  // a search for "France" finds the Schengen card through its member list
  const matches = (v) => [v.country, v.group, ...(v.members || [])].some((n) => n && n.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = all.filter((v) => (group === "all" || kinds(group).includes(v.kind)) && matches(v));
  const toggle = (k) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));

  return (
    <div className="relative isolate min-h-screen overflow-x-clip">
      <Navbar />
      <section className="mx-auto max-w-[1400px] px-4 pb-4 pt-14 text-center sm:px-8 sm:pt-20" data-testid="visas-hero">
        <InkLabel>Visas</InkLabel>
        <InkTitle as="h1" className="mt-4">What you need to get in.</InkTitle>
        <Reveal delay={0.1}><p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-relaxed text-[#5b6066]">Entry rules for Indian passport holders, for every international destination on getPackd. Rules change often: check the official site before you book.</p></Reveal>
        {data?.checked && <Reveal delay={0.2}><p className="mt-5 text-[11px] uppercase tracking-[.14em] text-[#5f656b]" data-testid="visas-checked">Last checked {checkedOn(data.checked)}</p></Reveal>}
      </section>

      <main id="main" className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" data-testid="visa-group-tabs">
            {GROUPS.map(([k, label, ks]) => {
              const n = ks ? all.filter((v) => ks.includes(v.kind)).length : all.length;
              return (
                <button key={k} data-testid={`visa-tab-${k}`} onClick={() => setGroup(k)} className={`relative rounded-full border px-4 py-2 text-sm transition-colors ${group === k ? "border-coral/70 font-semibold" : "border-border/70 bg-card/70 hover:border-foreground/30"}`}>
                  {group === k && <motion.span layoutId="visa-tab-glow" className="absolute inset-0 rounded-full bg-gradient-to-br from-coral/20 to-coral/5" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                  <span className="relative">{label} <span className="ml-1 font-mono text-[11px] text-muted-foreground">{n}</span></span>
                </button>
              );
            })}
          </div>
          <label className="ml-auto flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2">
            <Search size={15} className="text-[#5f656b]" />
            <input data-testid="visas-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a country" className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </label>
        </div>

        {isError ? <p className="mt-8 text-muted-foreground">Couldn't load the visa list. Is the backend running?</p>
          : isLoading ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{[...Array(6)].map((_, i) => <div key={i} className="shimmer h-56 rounded-2xl" />)}</div>
          : shown.length === 0 ? <p className="mt-8 text-muted-foreground" data-testid="visas-empty">No country matches that.</p>
          : (
            <div className="mt-6 grid items-start gap-4 lg:grid-cols-2" data-testid="visas-grid">
              <AnimatePresence mode="popLayout">{shown.map((v) => <CountryCard key={v.key} v={v} open={open.includes(v.key)} onToggle={() => toggle(v.key)} linkSelf />)}</AnimatePresence>
            </div>
          )}
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
      </main>
      <Footer />
    </div>
  );
}
