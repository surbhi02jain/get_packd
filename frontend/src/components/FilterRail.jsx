import { useEffect, useState } from "react";
import { ChevronDown, Minus, Plus, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { LABELS } from "@/lib/constants";
import { short } from "@/lib/format";

const SECTIONS = [
  ["Who it's for", ["audience"]], ["Group makeup", ["gender"]], ["Age band of the group", ["age"], "agerange"],
  ["Group size", ["size"], null, ["solo_many"]], ["Destination", ["dtype", "country"]], ["Climate", ["climate"]],
  ["Duration", ["dur"]], ["Budget (true price)", [], "price"], ["Trip style", ["style"]], ["Pace", ["pace"]],
  ["Difficulty", ["difficulty"]], ["Stays", ["stay"], null, ["private_room"]], ["Food", ["diet"]], ["Inclusions", ["incl"]],
  ["Safety & trust", ["trust"]], ["Visa", [], null, ["visa_easy"]], ["Seats available", [], "seats"], ["Operator type", ["op_type"]],
  ["Operator", [], "operator"],
];

const list = (params, k) => (params[k] ? String(params[k]).split(",") : []);

function Opt({ id, label, count, checked, onChange }) {
  const dis = !checked && count === 0;
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-muted ${dis ? "opacity-40" : ""}`}>
      <Checkbox data-testid={id} checked={checked} disabled={dis} onCheckedChange={onChange} />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground" data-testid={`${id}-count`}>{count ?? ""}</span>
    </label>
  );
}

function Section({ title, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b py-3">
      <button data-testid={`filter-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm font-semibold">
        {title}<ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2 space-y-0.5">{children}</div>}
    </div>
  );
}

function RangeSlider({ min, max, step, value, onCommit, fmt, testId }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value[0], value[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="px-1 pt-2">
      <Slider data-testid={testId} min={min} max={max} step={step} value={v} onValueChange={setV} onValueCommit={onCommit} />
      <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground"><span>{fmt(v[0])}</span><span>{fmt(v[1])}</span></div>
    </div>
  );
}

export default function FilterRail({ facets = {}, params, update, bounds }) {
  const [opQ, setOpQ] = useState("");
  const toggle = (k, v) => {
    const cur = list(params, k);
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    update({ [k]: next.length ? next.join(",") : null });
  };
  const group = (k) => {
    const f = facets[k] || {};
    const labels = LABELS[k];
    const keys = labels ? Object.keys(labels) : Object.keys(f);
    return keys.map((v) => (
      <Opt key={v} id={`filter-${k}-${v}`} label={labels ? labels[v] : f[v]?.label || v} count={typeof f[v] === "object" ? f[v].count : f[v] ?? 0}
        checked={list(params, k).includes(v)} onChange={() => toggle(k, v)} />
    ));
  };
  const boolRow = (k) => (
    <label key={k} className="flex items-center justify-between gap-2 px-1 py-1.5 text-sm">
      <span>{LABELS[k][1]} <span className="font-mono text-[11px] text-muted-foreground">{facets[k]?.["1"] ?? ""}</span></span>
      <Switch data-testid={`filter-${k}-switch`} checked={params[k] === "1"} onCheckedChange={(c) => update({ [k]: c ? "1" : null })} />
    </label>
  );
  const pMin = bounds?.min || 0, pMax = Math.ceil((bounds?.max || 400000) / 10000) * 10000;
  const seats = +(params.seats || 0);

  const extras = {
    agerange: (
      <div className="pt-2"><p className="text-xs text-muted-foreground">Median age of the group</p>
        <RangeSlider testId="filter-median-age-slider" min={18} max={75} step={1} value={[+(params.age_min || 18), +(params.age_max || 75)]}
          fmt={(x) => `${x} yrs`} onCommit={([a, b]) => update({ age_min: a > 18 ? a : null, age_max: b < 75 ? b : null })} /></div>
    ),
    price: (
      <div>
        <RangeSlider testId="filter-price-slider" min={0} max={pMax} step={5000} value={[+(params.min_price || 0), +(params.max_price || pMax)]}
          fmt={short} onCommit={([a, b]) => update({ min_price: a > 0 ? a : null, max_price: b < pMax ? b : null })} />
        <label className="mt-3 flex items-center justify-between px-1 text-sm">Show true price
          <Switch data-testid="filter-true-price-switch" checked={params.true_price !== "0"} onCheckedChange={(c) => update({ true_price: c ? null : "0" })} /></label>
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">Range from {short(pMin)}</p>
      </div>
    ),
    seats: (
      <div className="flex items-center gap-3 px-1">
        <span className="text-sm">I need</span>
        <button data-testid="filter-seats-minus" onClick={() => update({ seats: seats > 1 ? seats - 1 : null })} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-muted"><Minus size={14} /></button>
        <span className="w-6 text-center font-mono" data-testid="filter-seats-value">{seats || "–"}</span>
        <button data-testid="filter-seats-plus" onClick={() => update({ seats: Math.min(12, seats + 1) })} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-muted"><Plus size={14} /></button>
        <span className="text-sm">seats</span>
      </div>
    ),
    operator: (
      <div>
        <div className="mb-2 flex items-center gap-2 rounded-xl border px-2"><Search size={14} className="text-muted-foreground" />
          <input data-testid="filter-operator-search" value={opQ} onChange={(e) => setOpQ(e.target.value)} placeholder="Search operators" className="w-full bg-transparent py-1.5 text-sm outline-none" /></div>
        <div className="max-h-56 overflow-auto">
          {Object.entries(facets.operator || {}).filter(([, o]) => o.label.toLowerCase().includes(opQ.toLowerCase()))
            .concat(list(params, "operator").filter((id) => !(facets.operator || {})[id]).map((id) => [id, { label: id, count: 0 }]))
            .map(([id, o]) => <Opt key={id} id={`filter-operator-${id}`} label={o.label} count={o.count} checked={list(params, "operator").includes(id)} onChange={() => toggle("operator", id)} />)}
        </div>
      </div>
    ),
  };

  return (
    <div data-testid="filter-rail">
      {SECTIONS.map(([title, keys, extra, bools], idx) => (
        <Section key={title} title={title} defaultOpen={idx < 4 || keys.some((k) => params[k]) || (bools || []).some((k) => params[k])}>
          {keys.map((k) => <div key={k} className={k === "country" ? "mt-2 border-t pt-2" : ""}>{group(k)}</div>)}
          {(bools || []).map(boolRow)}
          {extra && extras[extra]}
        </Section>
      ))}
    </div>
  );
}
