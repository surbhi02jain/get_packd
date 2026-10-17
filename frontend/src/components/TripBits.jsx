import { Info, Check, X, CircleDashed, BadgeCheck, ShieldQuestion, Minus, Instagram } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inr, compact } from "@/lib/format";

// One checklist line: what the listing says about it, and any amount added on top of the listed price.
export function lineIcon(status, size = 14) {
  if (status === "included") return <Check size={size} className="text-mint" />;
  if (status === "partial") return <CircleDashed size={size} className="text-amber-500" />;
  if (status === "unknown") return <Minus size={size} className="text-muted-foreground" />;
  return <X size={size} className="text-coral" />;
}
export const lineNote = (l, fmt = inr) => (l.amount ? `+ ${fmt(l.amount)} est.` : l.status === "unknown" ? "check with operator" : l.status === "not_included" ? "not included" : "included");

export function TruePricePopover({ card, testId }) {
  const extra = card.true_price - card.price;
  const real = card.source === "import";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid={testId || `true-price-info-${card.dep_id}`} onClick={(e) => e.stopPropagation()} aria-label="How we calculated this"
          className="inline-grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Info size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl p-4" onClick={(e) => e.stopPropagation()} data-testid="true-price-popover">
        <p className="font-display text-lg">How we calculated this</p>
        <p className="mt-1 text-xs text-muted-foreground">{real
          ? "The listed price comes from the operator's own page. We only add 5% GST when the operator says GST is extra; everything else is shown as the operator states it."
          : "Every trip is normalised to the same checklist, from the meeting point onward. Anything excluded is estimated from our reference table."}</p>
        <div className="mt-3 space-y-1.5 text-sm">
          <Row label="Listed price" amount={inr(card.price)} />
          {card.breakdown.map((l) => (
            <div key={l.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {lineIcon(l.status)}
                {l.label}
              </span>
              <span className={`font-mono text-xs ${l.amount ? "" : "text-muted-foreground"}`}>{lineNote(l)}</span>
            </div>
          ))}
          <div className="perf my-2" />
          <Row label={<b>{real ? (extra > 0 ? "Price with GST" : "Listed price") : "True total price"}</b>} amount={<b>{inr(card.true_price)}</b>} />
          {extra > 0 && <p className="text-xs text-muted-foreground">{real ? `${inr(extra)} GST the operator lists as extra.` : `${inr(extra)} of costs the listing didn't show.`}</p>}
          {card.flights_est > 0 && <p className="text-xs text-muted-foreground">Flights to the meeting point are not included (est. {inr(card.flights_est)} return, reference only).</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const Row = ({ label, amount }) => (
  <div className="flex items-center justify-between"><span>{label}</span><span className="font-mono text-xs">{amount}</span></div>
);

export function VerifiedStamp({ status, small }) {
  // "listed" operators come from the shared operator list; Wayfind has not vetted them, so no stamp either way
  if (status === "listed") return null;
  if (status === "verified")
    return <span data-testid="verified-stamp" className={`stamp border-mint text-emerald-700 dark:text-emerald-300 ${small ? "" : "bg-emerald-50/70 dark:bg-emerald-950/40"}`}><BadgeCheck size={11} /> Verified</span>;
  return <span data-testid="unverified-stamp" className="stamp border-slate-400 text-slate-500"><ShieldQuestion size={11} /> {status === "pending" ? "Pending" : "Unverified"}</span>;
}

/** Instagram follower count for an operator: a sign of how big their audience is, not of quality. */
const SOURCES = { qoruz: "Qoruz", "instagram-api": "Instagram", manual: "entered by hand" };
const monthYear = (iso) => new Date(iso).toLocaleString("en-IN", { month: "short", year: "numeric" });
/** "as of Sep 2026 · Qoruz": when and where a follower figure comes from. */
export const followerNote = (at, source) => [at ? `as of ${monthYear(at)}` : null, SOURCES[source] ? (source === "manual" ? SOURCES[source] : `via ${SOURCES[source]}`) : null].filter(Boolean).join(" · ");

export function InstaCount({ handle, followers, at, source, full, className = "" }) {
  if (!handle || followers == null) return null;
  const note = followerNote(at, source);
  return (
    <a href={`https://www.instagram.com/${handle.replace("@", "")}/`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} data-testid="instagram-followers"
      title={`${followers.toLocaleString("en-IN")} followers on Instagram (${handle})${note ? `, ${note}` : ""}. A sign of audience size, not a rating.`}
      className={`inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-coral ${className}`}>
      <Instagram size={12} /> <b className="font-semibold text-foreground">{compact(followers)}</b>{full ? " followers" : ""}
    </a>
  );
}

export function AgeBar({ range, median }) {
  if (!range) return null;
  const pos = (a) => `${Math.max(0, Math.min(100, ((a - 18) / 55) * 100))}%`;
  return (
    <div className="w-full" title={`Ages ${range[0]}–${range[1]}, median ${median}`}>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className="absolute h-1.5 rounded-full bg-amber/80" style={{ left: pos(range[0]), width: `calc(${pos(range[1])} - ${pos(range[0])})` }} />
        <div className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-midnight dark:border-midnight dark:bg-sand" style={{ left: pos(median) }} />
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">ages {range[0]}–{range[1]} · med {median}</p>
    </div>
  );
}

export function GenderBar({ split }) {
  if (!split) return null;
  const f = Math.round(split.female * 100);
  return (
    <div className="w-full" title={`${f}% women`}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-sky-300/70">
        <div className="h-full bg-coral" style={{ width: `${f}%` }} />
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{f}% women · {100 - f}% men</p>
    </div>
  );
}

export function Donut({ value, size = 120, color = "#FF6B4A", label, sub }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#7dd3fc" strokeOpacity=".6" strokeWidth="12" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12" strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" />
      </g>
      <text x="50%" y="50%" textAnchor="middle" className="fill-current font-display text-xl">{label}</text>
      <text x="50%" y="64%" textAnchor="middle" className="fill-current text-[10px] opacity-60">{sub}</text>
    </svg>
  );
}
