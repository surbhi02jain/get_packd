import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, CalendarDays, Users, Wallet, Search, Sparkles, Loader2, X, Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { http, qs } from "@/lib/api";
import { fmtRange, fmtDay, iso, d, shortMoney, todayIso, PRICE_STEPS, stepIndex } from "@/lib/format";
import { useApp } from "@/context/AppState";
import { hidden } from "@/lib/constants";
import { Magnetic } from "./Motion";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => http.get("/meta").then((r) => r.data), staleTime: 600000 });

const FLEX = [["0", "Exact"], ["2", "±2 days"], ["month", "Whole month"], ["any", "Any time"]];
// budget presets as [from, up to]; null is open-ended
const BUDGETS = [[null, 10000], [10000, 20000], [20000, 50000], [50000, 100000], [100000, null]];
const BUDGET_TOP = PRICE_STEPS[PRICE_STEPS.length - 1];
// budgets are set in rupees (that's what the trips are priced in); with "$ USD" picked, the labels show dollars
export const budgetLabel = (lo, hi, currency = "inr") => {
  const m = (n) => shortMoney(n, currency);
  return lo && hi ? `${m(lo)}–${m(hi)}` : hi ? `Up to ${m(hi)}` : lo ? `From ${m(lo)}` : null;
};

// a phone gets one month in the calendar, so it fits on the screen
function useNarrow() {
  const q = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

// `compact`: one segment of the search pill in the Explore page's header, showing just its value (quieter when unset).
// `onClose` runs when its picker closes, however it closes (a click outside, Esc, or a pick).
function Field({ icon: Icon, label, value, testId, children, wide, open, onOpenChange, onClose, compact, muted }) {
  const [own, setOwn] = useState(false);
  const isOpen = open ?? own;
  const change = (o) => { (onOpenChange ?? setOwn)(o); if (!o) onClose?.(); };
  return (
    <Popover open={isOpen} onOpenChange={change}>
      <PopoverTrigger asChild>
        {compact ? (
          <button data-testid={testId} aria-label={`${label}: ${value}`}
            className={`min-w-0 truncate rounded-full px-3.5 py-1.5 text-sm transition-colors hover:bg-black/[.05] xl:px-4 ${muted ? "text-[#5b6066]" : "font-semibold text-[#16181b]"} ${isOpen ? "bg-black/[.05]" : ""}`}>{value}</button>
        ) : (
          <button data-testid={testId} className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-3 text-left 2xl:gap-3 2xl:px-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${wide ? "lg:flex-[1.4]" : ""}`}>
            <Icon size={18} className="shrink-0 text-coral" />
            <span className="min-w-0">
              <span className="label-mono block truncate">{label}</span>
              <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
            </span>
          </button>
        )}
      </PopoverTrigger>
      {/* stays on the screen: it flips or shrinks to the room there is, and scrolls inside when it has to */}
      <PopoverContent align={compact ? "center" : "start"} collisionPadding={12}
        className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-24px)] overflow-y-auto rounded-3xl p-4">{children}</PopoverContent>
    </Popover>
  );
}

// a women-only search: the switch, or the "Solo woman" choice this panel used to have (old links, the plain-words search)
const wantsWomenOnly = (p) => p.gender === "women_only" || String(p.as || "").split(",").includes("solo_woman");
export const travellersLabel = (n) => (n ? `${n} ${n === 1 ? "traveller" : "travellers"}` : null);

// `onLive`: on a results page, the budget and who's going apply as soon as they're set, without pressing Search.
// variant "pill": the compact search in the Explore page's header; each part opens its own picker in place, and where
// and when apply as soon as their picker closes, so there's no second search bar to open
export default function SearchBar({ initial = {}, variant = "hero", onSearch, onLive, className = "" }) {
  const nav = useNavigate();
  const { currency } = useApp();
  const narrow = useNarrow();
  const [whereOpen, setWhereOpen] = useState(false);
  // hidden for now (lib/constants.js): the travellers count, as few operators publish seats left, and the plain-words search
  const noTravellers = hidden("travellers"), noPlainWords = hidden("plainWordsSearch");
  const { data: meta } = useMeta();
  const [q, setQ] = useState(initial.q || "");
  const [range, setRange] = useState(initial.start ? { from: d(initial.start), to: d(initial.end || initial.start) } : undefined);
  const [flex, setFlex] = useState(initial.flex || "0");
  // who's going: how many of you (the seats you need, 0 for not said) and whether the group should be women-only
  const [travellers, setTravellers] = useState(+initial.seats || 0);
  const [womenOnly, setWomenOnly] = useState(wantsWomenOnly(initial));
  const [budget, setBudget] = useState(initial.max_price ? +initial.max_price : null);
  const [budgetMin, setBudgetMin] = useState(initial.min_price ? +initial.min_price : null);
  const setBudgetRange = (lo, hi) => { setBudgetMin(lo); setBudget(hi); };
  const applyBudget = (lo, hi) => { setBudgetRange(lo, hi); onLive?.({ min_price: lo, max_price: hi }); };
  // switching women-only off only clears the group make-up when this panel set it, not a "mixed" picked in the filters
  const genderPatch = (on) => (on ? { gender: "women_only" } : wantsWomenOnly(initial) ? { gender: null } : {});
  const applyTravellers = (n) => { setTravellers(n); onLive?.({ seats: n || null }); };
  const applyWomenOnly = (on) => { setWomenOnly(on); onLive?.({ ...genderPatch(on), as: null }); };
  const fromSteps = ([lo, hi]) => [PRICE_STEPS[lo] || null, PRICE_STEPS[hi] < BUDGET_TOP ? PRICE_STEPS[hi] : null];
  const [nl, setNl] = useState(false);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);

  useEffect(() => {
    setQ(initial.q || ""); setFlex(initial.flex || "0");
    setTravellers(+initial.seats || 0); setWomenOnly(wantsWomenOnly(initial));
    setBudget(initial.max_price ? +initial.max_price : null);
    setBudgetMin(initial.min_price ? +initial.min_price : null);
    setRange(initial.start ? { from: d(initial.start), to: d(initial.end || initial.start) } : undefined);
  }, [initial.q, initial.start, initial.end, initial.flex, initial.as, initial.seats, initial.gender, initial.max_price, initial.min_price]); // eslint-disable-line react-hooks/exhaustive-deps

  // places that start with what's typed come first ("kas" → Kasol), then ones that contain it
  const sugg = useMemo(() => {
    const all = meta?.suggestions || [];
    const t = q.trim().toLowerCase();
    if (!t) return all.filter((s) => s.type === "destination").slice(0, 8);
    const starts = all.filter((s) => s.label.toLowerCase().startsWith(t) || s.label.toLowerCase().split(/[\s&,-]+/).some((w) => w.startsWith(t)));
    const has = all.filter((s) => !starts.includes(s) && s.label.toLowerCase().includes(t));
    return [...starts, ...has].slice(0, 8);
  }, [meta, q]);
  const typedIsPlace = (meta?.suggestions || []).some((s) => s.label.toLowerCase() === q.trim().toLowerCase());
  // the calendar runs from today to the last departure; past days can't be picked
  const firstDay = d(meta?.date_bounds?.first || todayIso());
  const lastDay = meta?.date_bounds?.last ? d(meta.date_bounds.last) : undefined;

  const go = (patch) => {
    if (onSearch) onSearch(patch);
    else nav(`/search?${qs(patch)}`);
  };
  // the pill: where and when go to the results once their picker closes (after the state has caught up), and only
  // when they changed
  const compact = variant === "pill";
  const [commitTick, setCommitTick] = useState(0);
  const commitLater = () => setCommitTick((t) => t + 1);
  useEffect(() => {
    if (!commitTick) return;
    const now = { q: q.trim() || null, start: range?.from ? iso(range.from) : null, end: range?.from ? iso(range.to || range.from) : null, flex: range?.from ? flex : null };
    const was = { q: initial.q || null, start: initial.start || null, end: initial.end || initial.start || null, flex: initial.start ? initial.flex || "0" : null };
    if (Object.keys(now).some((k) => now[k] !== was[k])) go(now);
  }, [commitTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeWhere = () => { setWhereOpen(false); if (compact) commitLater(); };
  const submit = (where = q) => go({
    q: where || null, start: range?.from ? iso(range.from) : null, end: range?.from ? iso(range.to || range.from) : null,
    flex: range?.from ? flex : null, seats: travellers || null, ...genderPatch(womenOnly), as: null, min_price: budgetMin || null, max_price: budget || null,
  });
  const runNl = async () => {
    if (!nlText.trim()) return;
    setNlBusy(true);
    try {
      const { data } = await http.post("/nl-search", { text: nlText });
      toast.success(data.summary || "Filters applied");
      go({ q: null, start: null, end: null, flex: null, as: null, min_price: null, max_price: null, ...data.params, __replace: true });
      setNl(false);
    } catch { toast.error("Couldn't understand that — try the filters instead"); }
    setNlBusy(false);
  };

  const whenLabel = range?.from ? `${fmtRange(iso(range.from), iso(range.to || range.from))}${flex !== "0" ? ` · ${FLEX.find((f) => f[0] === flex)[1]}` : ""}` : "Any dates";
  const fitsHint = range?.from && range.to && iso(range.to) !== iso(range.from)
    ? "Trips that leave and get back within these dates" : range?.from ? "Trips leaving on this day" : "Pick the day you leave, or your first and last day off";
  const whoLabel = [travellersLabel(travellers), womenOnly ? "Women-only" : null].filter(Boolean).join(" · ") || (noTravellers ? "Anyone" : "Add travellers");
  const hero = variant === "hero";

  if (nl)
    return (
      <div className={`glass flex items-center gap-2 rounded-3xl p-2 shadow-lift ${hero ? "" : "!bg-card"}`} data-testid="nl-search-bar">
        <Sparkles size={18} className="ml-3 text-coral" />
        <input autoFocus data-testid="nl-search-input" value={nlText} onChange={(e) => setNlText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runNl()}
          placeholder="chill 5-day trip in Nov, women-only, under ₹30k" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground" />
        <button data-testid="nl-search-close" onClick={() => setNl(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Back to filters"><X size={16} /></button>
        <button data-testid="nl-search-submit" onClick={runNl} disabled={nlBusy} className="flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95">
          {nlBusy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Ask
        </button>
      </div>
    );

  const whereBody = (
    <div className="w-72 max-w-full">
      {/* Enter searches for what's typed; picking a place fills it in and closes the list */}
      <input data-testid="search-where-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Place, trek or town" aria-label="Where"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (compact) closeWhere(); else { setWhereOpen(false); submit(); } } }}
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral" />
      {q.trim() && !typedIsPlace && (
        <button data-testid="search-where-typed" onClick={() => { if (compact) closeWhere(); else { setWhereOpen(false); submit(); } }} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-muted">
          <Search size={14} className="shrink-0" /> <span className="truncate">Search “{q.trim()}”</span>
        </button>
      )}
      <button data-testid="search-where-anywhere" onClick={() => { setQ(""); closeWhere(); }} className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-muted">Anywhere – Everywhere</button>
      <div className="max-h-64 overflow-auto">
        {sugg.map((s) => (
          <button key={s.type + s.label} data-testid={`search-where-option-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => { setQ(s.value); closeWhere(); }}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
            <span>{s.label}</span><span className="truncate text-xs text-muted-foreground">{s.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
  const whenBody = (
    <>
      <Calendar mode="range" numberOfMonths={narrow ? 1 : 2} defaultMonth={range?.from || firstDay} selected={range} onSelect={setRange}
        fromDate={firstDay} toDate={lastDay} data-testid="search-when-calendar" />
      <p className="px-1 text-xs text-[#5f656b]" data-testid="search-when-hint">{fitsHint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FLEX.map(([v, l]) => (
          <button key={v} data-testid={`search-flex-${v}`} onClick={() => setFlex(v)} className={`chip border ${flex === v ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{l}</button>
        ))}
        {range && <button data-testid="search-when-clear" onClick={() => setRange(undefined)} className="chip text-muted-foreground hover:bg-muted">Clear dates</button>}
      </div>
    </>
  );
  const whoBody = (
    <div className="w-80 max-w-full">
      {!noTravellers && <div className="flex items-center justify-between gap-4 pb-4">
        <span>
          <span className="block text-sm font-semibold">Travellers</span>
          <span className="block text-xs text-muted-foreground">Just you, or you and your friends</span>
        </span>
        <span className="flex items-center gap-3">
          <button data-testid="search-travellers-minus" onClick={() => applyTravellers(Math.max(0, travellers - 1))} disabled={!travellers} aria-label="Fewer travellers"
            className="grid h-8 w-8 place-items-center rounded-full border text-foreground transition-colors hover:border-foreground disabled:opacity-30 disabled:hover:border-border"><Minus size={14} /></button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums" data-testid="search-travellers-value">{travellers || 0}</span>
          <button data-testid="search-travellers-plus" onClick={() => applyTravellers(Math.min(12, travellers + 1))} disabled={travellers >= 12} aria-label="More travellers"
            className="grid h-8 w-8 place-items-center rounded-full border text-foreground transition-colors hover:border-foreground disabled:opacity-30 disabled:hover:border-border"><Plus size={14} /></button>
        </span>
      </div>}
      <label className={`flex cursor-pointer items-center justify-between gap-4 py-4 ${noTravellers ? "" : "border-t"}`}>
        <span>
          <span className="block text-sm font-semibold">Women-only groups</span>
          <span className="block text-xs text-muted-foreground">Only trips run for women travellers</span>
        </span>
        <Switch data-testid="search-women-only-switch" checked={womenOnly} onCheckedChange={applyWomenOnly} />
      </label>
      {!noTravellers && <p className="border-t pt-3 text-xs text-muted-foreground">Trips with fewer seats left than travellers are hidden. Most operators don't list seats left; those trips stay in.</p>}
    </div>
  );
  const budgetText = budgetLabel(budgetMin, budget, currency);
  const budgetBody = (
    <div className="w-72 max-w-full">
      <p className="text-sm">True price <b>{budgetText?.replace(/^\S/, (c) => c.toLowerCase()) || "any"}</b></p>
      <Slider data-testid="search-budget-slider" className="my-4" min={0} max={PRICE_STEPS.length - 1} step={1} minStepsBetweenThumbs={1}
        value={[stepIndex(PRICE_STEPS, budgetMin || 0), stepIndex(PRICE_STEPS, budget || BUDGET_TOP)]}
        onValueChange={(v) => setBudgetRange(...fromSteps(v))} onValueCommit={(v) => onLive && applyBudget(...fromSteps(v))} />
      <div className="mb-3 flex justify-between font-mono text-xs text-muted-foreground"><span>{shortMoney(budgetMin || 0, currency)}</span><span>{budget ? shortMoney(budget, currency) : `${shortMoney(BUDGET_TOP, currency)}+`}</span></div>
      <div className="flex flex-wrap gap-2">
        {BUDGETS.map(([lo, hi]) => {
          const on = (budgetMin || null) === lo && (budget || null) === hi;
          return <button key={`${lo}-${hi}`} data-testid={`search-budget-${lo || 0}-${hi || "up"}`} onClick={() => applyBudget(lo, hi)} className={`chip border ${on ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{lo && hi ? `${shortMoney(lo, currency)}–${shortMoney(hi, currency)}` : hi ? `Under ${shortMoney(hi, currency)}` : `${shortMoney(lo, currency)}+`}</button>;
        })}
        <button data-testid="search-budget-any" onClick={() => applyBudget(null, null)} className="chip border hover:bg-muted">Any</button>
      </div>
    </div>
  );

  if (compact) {
    const whoSet = womenOnly || travellers > 0;
    const Divider = () => <span className="h-6 w-px shrink-0 bg-[#e7dece]" aria-hidden />;
    return (
      <div data-testid="search-pill" role="search"
        className={`flex min-w-0 items-center rounded-full border border-[#e7dece] bg-[#fffdf9] py-1.5 pl-1.5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_12px_rgba(0,0,0,.05)] ${className}`}>
        <Field compact label="Where" value={q ? q.replace(/\b\w/g, (c) => c.toUpperCase()) : "Anywhere"} testId="search-where-trigger" open={whereOpen} onOpenChange={setWhereOpen} onClose={commitLater}>{whereBody}</Field>
        <Divider />
        <Field compact label="When" value={whenLabel} testId="search-when-trigger" onClose={commitLater}>{whenBody}</Field>
        <Divider />
        <Field compact label="Who's going" value={whoSet ? whoLabel : "Who's going"} muted={!whoSet} testId="search-who-trigger">{whoBody}</Field>
        <Divider />
        <Field compact label="Budget" value={budgetText || "Any budget"} muted={!budgetText} testId="search-budget-trigger">{budgetBody}</Field>
        <button data-testid="search-submit-button" onClick={commitLater} aria-label="Search"
          className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral text-white transition-transform active:scale-95"><Search size={14} strokeWidth={3} /></button>
      </div>
    );
  }

  return (
    <div className={`glass flex flex-col gap-1 rounded-3xl p-2 shadow-lift lg:flex-row lg:items-center ${hero ? "" : "!bg-card"} ${className}`} data-testid="search-bar">
      <Field icon={MapPin} label="Where" value={q || "Anywhere – Everywhere"} testId="search-where-trigger" wide open={whereOpen} onOpenChange={setWhereOpen}>{whereBody}</Field>
      <div className="hidden h-8 w-px bg-border lg:block" />
      <Field icon={CalendarDays} label="When" value={whenLabel} testId="search-when-trigger">{whenBody}</Field>
      <div className="hidden h-8 w-px bg-border lg:block" />
      <Field icon={Users} label="Who's going" value={whoLabel} testId="search-who-trigger">{whoBody}</Field>
      <div className="hidden h-8 w-px bg-border lg:block" />
      <Field icon={Wallet} label="Budget" value={budgetText || "Any budget"} testId="search-budget-trigger">{budgetBody}</Field>
      <div className="flex items-center gap-1 p-1">
        {!noPlainWords && <button data-testid="nl-search-toggle" onClick={() => setNl(true)} title="Describe your trip in plain words" className="grid h-12 w-12 place-items-center rounded-2xl text-coral transition-colors hover:bg-coral/10">
          <Sparkles size={18} />
        </button>}
        <Magnetic className="flex-1">
          <button data-testid="search-submit-button" onClick={() => submit()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral/30 transition-transform hover:brightness-105 active:scale-95">
            <Search size={17} /> Search
          </button>
        </Magnetic>
      </div>
    </div>
  );
}

export { fmtDay };
