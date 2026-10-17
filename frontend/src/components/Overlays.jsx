import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Wand2, BellRing, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApp } from "@/context/AppState";
import { http } from "@/lib/api";
import { STYLES, LABELS } from "@/lib/constants";
import { short } from "@/lib/format";

export function CompareTray() {
  const { compare, toggleCompare, setCompare } = useApp();
  const n = compare.length;
  const ready = n >= 2;
  return (
    // the outer strip does the centring, so the slide-up animation on the tray itself can't push it off-screen
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <AnimatePresence>
        {n > 0 && (
          <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/15 bg-midnight p-3 text-sand shadow-2xl sm:flex-row sm:items-center" data-testid="compare-tray">
            <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:pl-2">
              <div>
                <p className="text-sm font-semibold">Compare trips <span className="font-mono text-xs text-amber">{n}/4</span></p>
                <p className="text-[11px] text-sand/60" data-testid="compare-tray-hint">{ready ? "See them side by side" : "Tick one more trip to compare"}</p>
              </div>
              <button data-testid="compare-tray-clear" onClick={() => setCompare([])} className="text-xs underline sm:hidden">Clear</button>
            </div>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">
              {compare.map((c) => (
                <div key={c.dep_id} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/10 py-1 pl-1 pr-2">
                  <img src={c.image} alt="" className="h-9 w-9 rounded-xl object-cover" />
                  <span className="max-w-[110px] truncate text-xs">{c.title}</span>
                  <button data-testid={`compare-tray-remove-${c.dep_id}`} onClick={() => toggleCompare(c)} aria-label={`Remove ${c.title}`} className="rounded-full p-0.5 hover:bg-white/15"><X size={14} /></button>
                </div>
              ))}
              {[...Array(4 - n)].map((_, i) => <div key={i} className="hidden h-11 w-20 shrink-0 place-items-center rounded-2xl border border-dashed border-white/20 text-[10px] text-sand/40 lg:grid">+ add</div>)}
            </div>
            <button onClick={() => setCompare([])} className="hidden shrink-0 text-xs underline sm:block">Clear</button>
            {ready ? (
              <Link to={`/compare?deps=${compare.map((c) => encodeURIComponent(c.dep_id)).join(",")}`} data-testid="compare-now-button"
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-coral/40 transition-transform hover:scale-[1.03]">
                Compare {n} side by side <ArrowRight size={16} />
              </Link>
            ) : (
              <span data-testid="compare-now-button" aria-disabled className="flex shrink-0 cursor-not-allowed items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-sand/50">Pick 1 more to compare</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SaveSearchDialog({ open, onOpenChange, params, count }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const filters = Object.fromEntries(Object.entries(params).filter(([k, v]) => v && k !== "view").map(([k, v]) => [k, String(v)]));
      await http.post("/alerts", { email, filters, label: params.q || "Anywhere" });
      localStorage.setItem("wf_email", email);
      toast.success("Alert saved — we'll email you about new departures and price drops");
      onOpenChange(false);
    } catch { toast.error("Please enter a valid email"); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl" data-testid="save-search-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Save this search</DialogTitle>
          <DialogDescription>Get an email when new departures match, or prices drop. {count} trips match right now.</DialogDescription>
        </DialogHeader>
        <input data-testid="save-search-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-2xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-coral" />
        <button data-testid="save-search-submit" disabled={busy} onClick={save} className="flex items-center justify-center gap-2 rounded-2xl bg-coral py-3 font-semibold text-white">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Notify me
        </button>
        <p className="text-xs text-muted-foreground">Alerts are saved in V1; email delivery is coming soon.</p>
      </DialogContent>
    </Dialog>
  );
}

const Q = [
  ["fq_age", "How old are you?", "number"],
  ["fq_pace", "Your ideal pace?", Object.entries(LABELS.pace)],
  ["fq_style", "What do you love? (pick any)", Object.entries(STYLES).map(([k, v]) => [k, v.label]), true],
  ["fq_budget", "Max true price you'd pay?", [[30000, "₹30k"], [60000, "₹60k"], [100000, "₹1L"], [200000, "₹2L"]]],
  ["fq_size", "Group size you enjoy?", Object.entries(LABELS.size)],
  ["fq_stay", "Where do you like to sleep?", Object.entries(LABELS.stay)],
];

export function FitQuiz({ open, onOpenChange }) {
  const { quiz, setQuiz } = useApp();
  const [a, setA] = useState(quiz || {});
  const [step, setStep] = useState(0);
  const [k, title, opts, multi] = Q[step];
  const pick = (v) => {
    if (multi) { const cur = a[k] ? a[k].split(",") : []; setA({ ...a, [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") }); }
    else setA({ ...a, [k]: String(v) });
  };
  const done = () => { setQuiz(a); onOpenChange(false); setStep(0); toast.success("Fit scores are on"); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl" data-testid="fit-quiz-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl"><Wand2 size={20} className="text-coral" /> Your Fit score</DialogTitle>
          <DialogDescription>Question {step + 1} of 6 · stays on this device</DialogDescription>
        </DialogHeader>
        <div className="h-1 overflow-hidden rounded-full bg-muted"><motion.div className="h-full bg-coral" animate={{ width: `${((step + 1) / 6) * 100}%` }} /></div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="mb-3 font-display text-xl">{title}</p>
            {opts === "number" ? (
              <input data-testid="fit-quiz-age" type="number" min={16} max={90} value={a[k] || ""} onChange={(e) => setA({ ...a, [k]: e.target.value })} className="w-full rounded-2xl border bg-background px-4 py-3" placeholder="e.g. 29" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {opts.map(([v, l]) => {
                  const on = multi ? (a[k] || "").split(",").includes(String(v)) : a[k] === String(v);
                  return <button key={v} data-testid={`fit-quiz-opt-${k}-${v}`} onClick={() => pick(v)} className={`chip border px-3 py-2 text-sm ${on ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{l}</button>;
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-between">
          <button data-testid="fit-quiz-back" disabled={!step} onClick={() => setStep(step - 1)} className="text-sm disabled:opacity-30">Back</button>
          {step < 5 ? <button data-testid="fit-quiz-next" onClick={() => setStep(step + 1)} className="rounded-2xl bg-midnight px-5 py-2.5 text-sm font-semibold text-sand dark:bg-sand dark:text-midnight">Next</button>
            : <button data-testid="fit-quiz-finish" onClick={done} className="rounded-2xl bg-coral px-5 py-2.5 text-sm font-semibold text-white">Show my Fit scores</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({ relaxations = [], update, clear }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center shadow-soft" data-testid="empty-state">
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" className="mb-4">
        <path d="M10 95 L50 35 L70 60 L88 40 L130 95 Z" fill="#FFB547" opacity=".35" />
        <path d="M40 95 L70 55 L100 95 Z" fill="#FF6B4A" opacity=".8" />
        <circle cx="108" cy="22" r="10" fill="#FFB547" />
        <path d="M5 98 H135" stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 6" strokeWidth="2" />
      </svg>
      <h3 className="font-display text-2xl">No departures match — yet</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Try one of these one-tap tweaks. Each shows how many trips it would add.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {relaxations.map((r, i) => (
          <button key={i} data-testid={`relaxation-${i}`} onClick={() => update(r.patch)} className="rounded-2xl border-2 border-dashed border-coral/50 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-coral hover:text-white">
            {r.label} <b className="ml-1">→ +{r.add} trips</b>
          </button>
        ))}
        <button data-testid="empty-clear-all" onClick={clear} className="rounded-2xl px-4 py-2.5 text-sm underline">Clear all filters</button>
      </div>
    </div>
  );
}

export const Skeletons = () => (
  <div className="space-y-4" data-testid="results-skeleton">
    {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-56 rounded-[24px]" />)}
  </div>
);

export { short };
