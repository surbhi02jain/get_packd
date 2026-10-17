import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, CalendarDays, Users, Wallet, Search, Sparkles, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { http, qs } from "@/lib/api";
import { PERSONAS } from "@/lib/constants";
import { fmtRange, fmtDay, iso, d, short } from "@/lib/format";
import { Magnetic } from "./Motion";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => http.get("/meta").then((r) => r.data), staleTime: 600000 });

const FLEX = [["0", "Exact"], ["2", "±2 days"], ["month", "Whole month"], ["any", "Any time"]];
const BUDGETS = [30000, 50000, 100000, 200000];

function Field({ icon: Icon, label, value, testId, children, wide }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid={testId} className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-3 text-left 2xl:gap-3 2xl:px-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${wide ? "md:flex-[1.4]" : ""}`}>
          <Icon size={18} className="shrink-0 text-coral" />
          <span className="min-w-0">
            <span className="label-mono block truncate">{label}</span>
            <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-3xl p-4">{children}</PopoverContent>
    </Popover>
  );
}

export default function SearchBar({ initial = {}, variant = "hero", onSearch }) {
  const nav = useNavigate();
  const { data: meta } = useMeta();
  const [q, setQ] = useState(initial.q || "");
  const [range, setRange] = useState(initial.start ? { from: d(initial.start), to: d(initial.end || initial.start) } : undefined);
  const [flex, setFlex] = useState(initial.flex || "0");
  const [as, setAs] = useState(initial.as ? initial.as.split(",") : []);
  const [budget, setBudget] = useState(initial.max_price ? +initial.max_price : null);
  const [nl, setNl] = useState(false);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);

  useEffect(() => {
    setQ(initial.q || ""); setFlex(initial.flex || "0"); setAs(initial.as ? initial.as.split(",") : []);
    setBudget(initial.max_price ? +initial.max_price : null);
    setRange(initial.start ? { from: d(initial.start), to: d(initial.end || initial.start) } : undefined);
  }, [initial.q, initial.start, initial.end, initial.flex, initial.as, initial.max_price]);

  const sugg = useMemo(() => {
    const all = meta?.suggestions || [];
    const t = q.trim().toLowerCase();
    return (t ? all.filter((s) => s.label.toLowerCase().includes(t)) : all.filter((s) => s.type === "destination")).slice(0, 8);
  }, [meta, q]);

  const go = (patch) => {
    if (onSearch) onSearch(patch);
    else nav(`/search?${qs(patch)}`);
  };
  const submit = () => go({
    q: q || null, start: range?.from ? iso(range.from) : null, end: range?.from ? iso(range.to || range.from) : null,
    flex: range?.from ? flex : null, as: as.length ? as.join(",") : null, max_price: budget || null,
  });
  const runNl = async () => {
    if (!nlText.trim()) return;
    setNlBusy(true);
    try {
      const { data } = await http.post("/nl-search", { text: nlText });
      toast.success(data.summary || "Filters applied");
      go({ q: null, start: null, end: null, flex: null, as: null, max_price: null, ...data.params, __replace: true });
      setNl(false);
    } catch { toast.error("Couldn't understand that — try the filters instead"); }
    setNlBusy(false);
  };

  const whenLabel = range?.from ? `${fmtRange(iso(range.from), iso(range.to || range.from))}${flex !== "0" ? ` · ${FLEX.find((f) => f[0] === flex)[1]}` : ""}` : "Any dates";
  const asLabel = as.length ? as.map((a) => PERSONAS.find((p) => p[0] === a)?.[1]).join(", ") : "Anyone";
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

  return (
    <div className={`glass flex flex-col gap-1 rounded-3xl p-2 shadow-lift md:flex-row md:items-center ${hero ? "" : "!bg-card"}`} data-testid="search-bar">
      <Field icon={MapPin} label="Where" value={q || "Anywhere – Everywhere"} testId="search-where-trigger" wide>
        <div className="w-72">
          <input data-testid="search-where-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Country, region or city"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-coral" />
          <button data-testid="search-where-anywhere" onClick={() => setQ("")} className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-muted">Anywhere – Everywhere</button>
          <div className="max-h-64 overflow-auto">
            {sugg.map((s) => (
              <button key={s.type + s.label} data-testid={`search-where-option-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setQ(s.value)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                <span>{s.label}</span><span className="text-xs text-muted-foreground">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </Field>
      <div className="hidden h-8 w-px bg-border md:block" />
      <Field icon={CalendarDays} label="When" value={whenLabel} testId="search-when-trigger">
        <Calendar mode="range" numberOfMonths={2} defaultMonth={range?.from || new Date(2026, 10, 1)} selected={range} onSelect={setRange}
          fromDate={new Date(2026, 9, 1)} toDate={new Date(2027, 1, 28)} data-testid="search-when-calendar" />
        <div className="mt-2 flex flex-wrap gap-2">
          {FLEX.map(([v, l]) => (
            <button key={v} data-testid={`search-flex-${v}`} onClick={() => setFlex(v)} className={`chip border ${flex === v ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{l}</button>
          ))}
          {range && <button data-testid="search-when-clear" onClick={() => setRange(undefined)} className="chip text-muted-foreground hover:bg-muted">Clear dates</button>}
        </div>
      </Field>
      <div className="hidden h-8 w-px bg-border md:block" />
      <Field icon={Users} label="Travelling as" value={asLabel} testId="search-as-trigger">
        <div className="grid w-72 grid-cols-2 gap-2">
          {PERSONAS.map(([v, l]) => (
            <button key={v} data-testid={`search-as-${v}`} onClick={() => setAs((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]))}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${as.includes(v) ? "border-coral bg-coral/10 text-coral" : "hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Optional — it sets filters and shows why a trip fits you.</p>
      </Field>
      <div className="hidden h-8 w-px bg-border md:block" />
      <Field icon={Wallet} label="Budget" value={budget ? `Up to ${short(budget)}` : "Any budget"} testId="search-budget-trigger">
        <div className="w-72">
          <p className="text-sm">True price up to <b>{budget ? short(budget) : "any"}</b></p>
          <Slider data-testid="search-budget-slider" className="my-4" min={10000} max={400000} step={5000} value={[budget || 400000]} onValueChange={([v]) => setBudget(v >= 400000 ? null : v)} />
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((b) => <button key={b} data-testid={`search-budget-${b}`} onClick={() => setBudget(b)} className={`chip border ${budget === b ? "border-coral bg-coral text-white" : "hover:bg-muted"}`}>{short(b)}</button>)}
            <button data-testid="search-budget-any" onClick={() => setBudget(null)} className="chip border hover:bg-muted">Any</button>
          </div>
        </div>
      </Field>
      <div className="flex items-center gap-1 p-1">
        <button data-testid="nl-search-toggle" onClick={() => setNl(true)} title="Describe your trip in plain words" className="grid h-12 w-12 place-items-center rounded-2xl text-coral transition-colors hover:bg-coral/10">
          <Sparkles size={18} />
        </button>
        <Magnetic className="flex-1">
          <button data-testid="search-submit-button" onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral/30 transition-transform hover:brightness-105 active:scale-95">
            <Search size={17} /> Search
          </button>
        </Magnetic>
      </div>
    </div>
  );
}

export { fmtDay };
