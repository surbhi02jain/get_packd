import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Star, Users, ChevronDown, Plane, Clock, Sparkles, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/context/AppState";
import { STATUS, STYLES, LABELS } from "@/lib/constants";
import { fmtRange, fmtDay, money, short } from "@/lib/format";
import { HeartButton } from "./HeartButton";
import { TruePricePopover, VerifiedStamp, AgeBar, GenderBar, InstaCount, RatingBadges } from "./TripBits";
import { Counter } from "./Motion";

export function StatusPill({ status, seatsLeft }) {
  const s = STATUS[status];
  return <span data-testid="status-pill" className={`chip ${s.cls} ${status === "filling" && seatsLeft <= 2 ? "pulse-last" : ""}`}>{s.label}</span>;
}

function SeatsBar({ left, total, status }) {
  if (left == null) return null;
  // some operators publish seats left without the group size
  if (total == null) return <p className={`text-[11px] ${left <= 3 ? "font-semibold text-coral" : "text-muted-foreground"}`}>{left} seats left</p>;
  const pct = Math.max(4, ((total - left) / total) * 100);
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className={`h-full rounded-full ${left <= 3 ? "bg-coral" : "bg-midnight dark:bg-sand"}`} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </div>
      <p className={`mt-1 text-[11px] ${left <= 3 && status !== "cancelled" ? "font-semibold text-coral" : "text-muted-foreground"}`}>
        {status === "cancelled" ? "Departure cancelled" : `${left} of ${total} seats left`}
      </p>
    </div>
  );
}

export function FitRing({ value }) {
  const c = 2 * Math.PI * 15;
  return (
    <div className="relative h-10 w-10" data-testid="fit-ring">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="3" />
        <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - value / 100) }} viewport={{ once: true }} transition={{ duration: 1 }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold"><Counter value={value} /></span>
    </div>
  );
}

export function Price({ card, showTrue = true, big }) {
  const { currency } = useApp();
  const intl = card.dtype === "international";
  const val = showTrue ? card.true_price : card.price;
  return (
    <div>
      {showTrue && card.true_price !== card.price && <p className="font-mono text-xs text-muted-foreground line-through" data-testid="listed-price">{money(card.price, currency, intl)}</p>}
      <div className="flex items-center gap-1">
        <AnimatePresence mode="wait">
          <motion.p key={`${showTrue}-${currency}`} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0)" }} exit={{ opacity: 0, y: -8 }}
            className={`font-display font-semibold tracking-tight ${big ? "text-3xl" : "text-2xl"}`} data-testid="card-price">
            {money(val, currency, intl)}
          </motion.p>
        </AnimatePresence>
        <TruePricePopover card={card} />
      </div>
      <p className="label-mono">{!showTrue ? "Listed price" : card.source !== "import" ? "True total price" : card.true_price !== card.price ? "With 5% GST" : "Listed price"}</p>
    </div>
  );
}

export default function DepartureCard({ card, cluster, showTrue = true, showFitRing }) {
  const nav = useNavigate();
  const { compare, toggleCompare } = useApp();
  const [open, setOpen] = useState(false);
  const inCompare = compare.some((c) => c.dep_id === card.dep_id);
  const cancelled = card.status === "cancelled";
  const link = `/trip/${card.trip_id}?dep=${encodeURIComponent(card.dep_id)}`;
  const restricted = card.gender_policy === "women_only" || card.gender_policy === "men_only";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}
      data-testid={`departure-card-${card.dep_id}`}
      className={`group relative rounded-[24px] border border-border/60 bg-card shadow-soft transition-shadow hover:shadow-lift ${cancelled ? "opacity-70" : ""}`}
    >
      <div className="flex cursor-pointer flex-col md:flex-row" onClick={() => nav(link)}>
        <div className="relative h-48 overflow-hidden rounded-t-[24px] md:h-auto md:w-56 md:rounded-l-[24px] md:rounded-tr-none">
          <img src={card.image} alt={card.destination} loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight/70 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5"><StatusPill status={card.status} seatsLeft={card.seats_left} /></div>
          <HeartButton id={card.dep_id} className="absolute right-3 top-3" />
          <p className="absolute bottom-3 left-3 flex items-center gap-1 text-sm font-semibold text-white"><MapPin size={14} /> {card.destination}</p>
        </div>

        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-center gap-2">
            <Link to={`/operator/${card.op.id}`} onClick={(e) => e.stopPropagation()} data-testid={`card-operator-link-${card.dep_id}`} className="flex min-w-0 items-center gap-2 hover:underline">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-midnight font-mono text-[10px] font-bold text-sand dark:bg-sand dark:text-midnight">{card.op.initials}</span>
              <span className="truncate text-xs font-medium text-muted-foreground">{card.op.name}</span>
            </Link>
            <VerifiedStamp status={card.op.verified_status} />
            <RatingBadges ratings={card.op.ratings} />
            <InstaCount handle={card.op.instagram} followers={card.op.instagram_followers} at={card.op.instagram_followers_at} source={card.op.instagram_followers_source} />
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold leading-snug">{card.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{fmtRange(card.start, card.end)}</span>
            <span>{card.duration}D/{card.duration - 1}N</span>
            {card.max_group != null && <span className="flex items-center gap-1"><Users size={13} /> {card.min_group != null ? `${card.min_group}–${card.max_group}` : `Up to ${card.max_group}`} people</span>}
            {card.rating != null && <span className="flex items-center gap-1"><Star size={13} className="fill-amber text-amber" /> {card.rating} ({card.review_count})</span>}
          </p>
          {card.meeting_point && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" data-testid="card-meeting-point"><MapPin size={12} className="text-coral" /> Meet: {card.meeting_point}</p>}

          {card.fit_label && (
            <p data-testid="fit-chip" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Sparkles size={12} /> {card.fit_label}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.categories.slice(0, 3).map((c) => (
              <span key={c} className="chip bg-muted" style={{ color: STYLES[c]?.color }}>{STYLES[c]?.label || c}</span>
            ))}
            <span className="chip bg-muted">{LABELS.gender[card.gender_policy]}</span>
            {card.solo_ratio != null && <span className="chip bg-muted">{Math.round(card.solo_ratio * 100)}% solo</span>}
          </div>

          {(card.age_range || card.gender_split || card.seats_left != null) && (
            <div className={`mt-4 grid gap-4 ${card.age_range || card.gender_split ? "grid-cols-3" : "max-w-[220px] grid-cols-1"}`}>
              <AgeBar range={card.age_range} median={card.age_median} />
              <GenderBar split={card.gender_split} />
              <SeatsBar left={card.seats_left} total={card.seats_total} status={card.status} />
            </div>
          )}
          {restricted && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><AlertTriangle size={11} /> {card.gender_policy === "women_only" ? "Open to women travellers only" : "Open to men travellers only"}</p>}
        </div>

        <div className="ticket-cut relative flex flex-col justify-between gap-3 border-t-2 border-dashed p-5 md:w-60 md:border-l-2 md:border-t-0">
          <div className="flex items-start justify-between gap-2">
            <Price card={card} showTrue={showTrue} />
            {showFitRing && card.fit != null && <FitRing value={card.fit} />}
          </div>
          {card.flights_est > 0 && <p className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="flights-note"><Plane size={11} /> Flights not included – est. {short(card.flights_est)}</p>}
          <div className="flex items-center justify-between gap-2">
            <label onClick={(e) => e.stopPropagation()} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <Checkbox data-testid={`compare-checkbox-${card.dep_id}`} checked={inCompare} onCheckedChange={() => toggleCompare(card)} /> Compare
            </label>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground" title={card.source === "import" ? "When we last read this departure from the operator's site" : "When the operator last confirmed this departure"}><Clock size={10} /> {card.source === "import" ? (card.last_verified_days === 0 ? "read today" : `read ${card.last_verified_days}d ago`) : `verified ${card.last_verified_days}d ago`}</span>
          </div>
          <span className="rounded-2xl bg-midnight py-2.5 text-center text-sm font-semibold text-sand transition-colors group-hover:bg-coral dark:bg-sand dark:text-midnight dark:group-hover:bg-coral dark:group-hover:text-white">
            {cancelled ? "See other dates" : "View trip"}
          </span>
        </div>
      </div>

      {cluster && cluster.count > 1 && (
        <div className="border-t px-5 py-3">
          <button data-testid={`cluster-toggle-${card.trip_id}`} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm">
            <span><b>{cluster.count} departures</b> · from {short(cluster.from_price)}</span>
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex gap-2 overflow-x-auto pt-3 no-scrollbar">
                  {cluster.departures.map((dp) => (
                    <Link key={dp.dep_id} to={`/trip/${card.trip_id}?dep=${encodeURIComponent(dp.dep_id)}`} data-testid={`cluster-dep-${dp.dep_id}`}
                      className={`shrink-0 rounded-2xl border px-3 py-2 text-xs transition-colors hover:border-coral ${dp.dep_id === card.dep_id ? "border-coral bg-coral/5" : ""}`}>
                      <p className="font-semibold">{fmtDay(dp.start)}</p>
                      <p className="font-mono">{short(showTrue ? dp.true_price : dp.price)}</p>
                      <p className={dp.status === "cancelled" ? "text-rose-600" : "text-muted-foreground"}>{dp.status === "cancelled" ? "cancelled" : dp.seats_left != null ? `${dp.seats_left} left` : "open"}</p>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.article>
  );
}
