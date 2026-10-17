import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useSpring } from "framer-motion";
import { MapPin, Star, ShieldCheck, HeartPulse, UserRound, Utensils, BedDouble, ExternalLink, AlertTriangle, Flag, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadForm from "@/components/LeadForm";
import { Price, StatusPill } from "@/components/DepartureCard";
import { VerifiedStamp, AgeBar, Donut, InstaCount, lineIcon, lineNote } from "@/components/TripBits";
import { HeartButton } from "@/components/HeartButton";
import { CompareTray } from "@/components/Overlays";
import { Magnetic, SampleBadge } from "@/components/Motion";
import { http } from "@/lib/api";
import { STYLES, LABELS } from "@/lib/constants";
import { fmtRange, fmtDay, short } from "@/lib/format";

const Sec = ({ title, children, id }) => (
  <section className="rounded-[28px] bg-card p-6 shadow-soft sm:p-8" data-testid={id}>
    <h2 className="font-display text-2xl">{title}</h2><div className="mt-5">{children}</div>
  </section>
);

function Timeline({ days }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <div ref={ref} className="relative pl-10" data-testid="itinerary-timeline">
      <div className="absolute bottom-2 left-[13px] top-2 w-[3px] rounded-full bg-muted" />
      <motion.div style={{ scaleY, originY: 0 }} className="absolute bottom-2 left-[13px] top-2 w-[3px] rounded-full bg-coral" />
      {days.map((d, i) => (
        <motion.div key={d.day} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: 0.05 }} className="relative pb-7 last:pb-0">
          <span className="absolute -left-10 top-0 grid h-7 w-7 place-items-center rounded-full border-[3px] border-coral bg-card font-mono text-[11px] font-bold">{d.day}</span>
          <p className="label-mono">Day {d.day} · {d.place}</p>
          <p className="font-display text-lg">{d.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {d.stay && <span className="chip bg-muted"><BedDouble size={12} /> {d.stay}</span>}
            {d.meals?.length > 0 && <span className="chip bg-muted"><Utensils size={12} /> {d.meals.join(" · ")}</span>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}


export default function TripDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const [lead, setLead] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ["trip", id], queryFn: () => http.get(`/trips/${id}`).then((r) => r.data) });
  const deps = useMemo(() => data?.departures || [], [data]);
  const sel = useMemo(() => deps.find((x) => x.dep_id === sp.get("dep")) || deps.find((x) => x.status !== "cancelled") || deps[0], [deps, sp]);

  if (isLoading) return <div className="min-h-screen"><Navbar /><div className="mx-auto max-w-[1400px] space-y-4 p-8"><div className="shimmer h-[50vh] rounded-[28px]" /><div className="shimmer h-40 rounded-[28px]" /></div></div>;
  if (isError || !data) return <div className="min-h-screen"><Navbar /><p className="p-20 text-center" data-testid="trip-not-found">Trip not found. <Link to="/search" className="underline">Back to search</Link></p></div>;
  const { trip, operator: op, reviews, similar } = data;
  const avg = (k) => reviews.length ? (reviews.reduce((a, r) => a + r.breakdown[k], 0) / reviews.length).toFixed(1) : "–";
  const pick = (dp) => setSp({ dep: dp.dep_id }, { replace: true });
  const gp = trip.gender_policy;
  // trips read from an operator's site: show what the operator publishes and link out for the rest
  const real = trip.source === "import";
  const opLink = trip.url || op.website;
  const hasLists = (trip.inclusion_list?.length || 0) + trip.exclusions.length > 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="relative h-[62vh] min-h-[420px] overflow-hidden" data-testid="trip-hero">
        <motion.img initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.6 }} src={trip.image} alt={trip.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-[1400px] flex-col justify-end px-4 pb-10 text-sand sm:px-8">
          <div className="flex flex-wrap items-center gap-2"><SampleBadge />{trip.categories.map((c) => <span key={c} className="chip bg-white/15 backdrop-blur">{STYLES[c]?.label}</span>)}</div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-3 max-w-4xl font-display text-4xl font-semibold sm:text-5xl lg:text-6xl" data-testid="trip-title">{trip.title}</motion.h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <Link to={`/operator/${op.id}`} data-testid="trip-operator-link" className="flex items-center gap-2 hover:underline">by <b>{op.name}</b></Link>
            <VerifiedStamp status={op.verified_status} />
            <InstaCount handle={op.instagram} followers={op.instagram_followers} at={op.instagram_followers_at} source={op.instagram_followers_source} full className="!text-sm !text-sand/80 [&>b]:!text-sand" />
            {sel?.rating != null && <span className="flex items-center gap-1"><Star size={14} className="fill-amber text-amber" /> {sel.rating} · {trip.review_count} reviews</span>}
            <span>{trip.duration_days}D/{trip.duration_days - 1}N</span><span>{trip.country.join(", ")}</span>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {sel?.status === "cancelled" && (
            <div className="flex items-start gap-3 rounded-3xl border-2 border-dashed border-rose-300 bg-rose-50 p-5 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200" data-testid="cancelled-banner">
              <AlertTriangle className="shrink-0" /><div><p className="font-semibold">This departure ({fmtRange(sel.start, sel.end)}) was cancelled by the operator.</p><p className="text-sm">Pick another date below — other departures are unaffected.</p></div>
            </div>
          )}
          <Sec title="All upcoming departures" id="trip-departures">
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {deps.map((dp) => (
                <button key={dp.dep_id} data-testid={`trip-dep-${dp.dep_id}`} onClick={() => pick(dp)}
                  className={`shrink-0 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${dp.dep_id === sel?.dep_id ? "border-coral bg-coral/5" : "hover:border-foreground/30"}`}>
                  <p className="font-semibold">{fmtRange(dp.start, dp.end)}</p>
                  <p className="font-mono text-sm">{short(dp.true_price)}</p>
                  <div className="mt-1"><StatusPill status={dp.status} seatsLeft={dp.seats_left} /></div>
                </button>
              ))}
            </div>
          </Sec>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-[28px] bg-midnight p-6 text-sand grain" data-testid="meeting-point-card">
              <p className="label-mono relative z-10 !text-amber">Meeting point</p>
              <p className="relative z-10 mt-2 flex items-start gap-2 font-display text-2xl"><MapPin className="mt-1 shrink-0 text-coral" /> {trip.meeting_point || "See the operator's page"}</p>
              <p className="relative z-10 mt-3 text-sm text-sand/70">{trip.end_point ? `Trip ends at ${trip.end_point}. ` : ""}Getting to the meeting point is up to you{trip.domestic_or_international === "international" && sel?.flights_est ? ` — flights est. ${short(sel.flights_est)} return (reference only)` : ""}.</p>
            </div>
            <div className="rounded-[28px] bg-card p-6 shadow-soft" data-testid="group-composition">
              <p className="label-mono">Who's going · this departure</p>
              {sel && !sel.gender_split && (
                <div className="mt-3 space-y-2 text-sm">
                  {sel.seats_left != null && <p className="font-display text-2xl">{sel.seats_left}{sel.seats_total != null ? ` of ${sel.seats_total}` : ""} seats left</p>}
                  <p>{LABELS.gender[gp]} group{gp === "women_only" ? " — open to women travellers only" : ""}</p>
                  <p className="text-xs text-muted-foreground">{op.name} doesn't publish the age or gender mix of who has booked.</p>
                </div>
              )}
              {sel && sel.gender_split && (
                <div className="mt-3 flex items-center gap-5">
                  <Donut value={sel.gender_split.female} label={`${Math.round(sel.gender_split.female * 100)}%`} sub="women" />
                  <div className="flex-1 space-y-3 text-sm">
                    <p><b>{sel.booked}</b> booked of {sel.seats_total} · <b>{Math.round(sel.solo_ratio * 100)}%</b> solo</p>
                    <AgeBar range={sel.age_range} median={sel.age_median} />
                    <p className="text-xs text-muted-foreground">{LABELS.gender[gp]} group · age band {trip.age_band}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {trip.itinerary_days.length > 0
            ? <Sec title="Day-by-day itinerary" id="trip-itinerary"><Timeline days={trip.itinerary_days} /></Sec>
            : <Sec title="Itinerary" id="trip-itinerary">
                <p className="text-sm text-muted-foreground">The day-by-day plan is on {op.name}'s own page for this trip.</p>
                {opLink && <a href={opLink} target="_blank" rel="noreferrer" data-testid="itinerary-operator-link" className="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition-colors hover:border-coral">See the full itinerary <ExternalLink size={14} /></a>}
              </Sec>}

          <Sec title="What's included" id="trip-inclusions">
            {real && !hasLists && <p className="text-sm text-muted-foreground" data-testid="inclusions-on-operator-site">We haven't read the inclusions for this trip. {opLink && <a href={opLink} target="_blank" rel="noreferrer" className="underline">See what's included on {op.name}'s page.</a>}</p>}
            <div className={`grid gap-3 sm:grid-cols-2 ${real && !hasLists ? "hidden" : ""}`}>
              {sel?.breakdown.map((l) => (
                <div key={l.key} className="flex items-center justify-between rounded-2xl border p-3 text-sm">
                  <span className="flex items-center gap-2">{lineIcon(l.status, 16)} {l.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{lineNote(l, short)}</span>
                </div>
              ))}
            </div>
            {real && hasLists && <p className="mt-3 text-xs text-muted-foreground">Ticks and crosses reflect {op.name}'s own inclusion and exclusion lists. For anything marked "check with operator", see their page.</p>}
            {trip.inclusion_list?.length > 0 && <div className="mt-4 text-sm"><b>Included, in the operator's words:</b><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{trip.inclusion_list.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {trip.exclusions.length > 0 && (real
              ? <div className="mt-4 text-sm"><b>Not included, in the operator's words:</b><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{trip.exclusions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              : <p className="mt-4 text-sm"><b>Not included:</b> {trip.exclusions.join(" · ")}</p>)}
            {trip.stay_tier && <p className="mt-2 text-sm"><b>Stays:</b> {LABELS.stay[trip.stay_tier]} · {trip.room_sharing}{trip.private_room ? " · private room available" : ""}</p>}
            {trip.diet_options.length > 0 && <p className="mt-2 text-sm"><b>Food:</b> {trip.diet_options.map((x) => LABELS.diet[x]).join(", ")} options</p>}
          </Sec>

          {trip.leader && (
            <Sec title="Your trip leader" id="trip-leader">
              <div className="flex items-start gap-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-coral/15 text-coral"><UserRound size={28} /></span>
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-display text-xl">{trip.leader.name}{trip.women_leader && <span className="stamp border-coral text-coral" data-testid="women-leader-badge">Women leader</span>}</p>
                  <p className="text-sm text-muted-foreground">{trip.leader.years} years leading · {trip.leader.trips_led} trips led</p>
                  <p className="mt-2 text-sm">{trip.leader.bio}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{trip.leader.certs.map((c) => <span key={c} className="chip bg-muted">{c}</span>)}</div>
                </div>
              </div>
            </Sec>
          )}

          {!real && <Sec title="Safety" id="trip-safety">
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex gap-2"><ShieldCheck className="shrink-0 text-mint" size={18} /> Operator {op.verified_status === "verified" ? "verified by Wayfind (registration, GST, leaders, refunds)" : `is ${op.verified_status} — verification in progress`}</li>
              <li className="flex gap-2"><HeartPulse className="shrink-0 text-coral" size={18} /> {trip.medical_support ? "Medical kit & first-aid trained leader on trip" : "Basic first-aid kit; no dedicated medical support"}</li>
              <li className="flex gap-2"><Users className="shrink-0" size={18} /> {LABELS.gender[gp]} group{gp === "women_only" ? " — open to women travellers only" : gp === "men_only" ? " — open to men travellers only" : ""}</li>
              <li className="flex gap-2"><Flag className="shrink-0" size={18} /> Difficulty {LABELS.difficulty[trip.difficulty]} · pace {LABELS.pace[trip.pace]}{trip.senior_friendly ? " · senior friendly" : ""}{trip.kid_friendly ? " · kid friendly" : ""}</li>
            </ul>
            <p className="mt-4 rounded-2xl bg-muted p-4 text-sm"><b>Cancellation policy:</b> {trip.cancellation_policy}</p>
          </Sec>}

          {reviews.length > 0 && <Sec title={`Reviews · ${trip.review_count}`} id="trip-reviews">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {["leader", "stays", "value", "group"].map((k) => (
                <div key={k} className="rounded-2xl border p-3"><p className="label-mono">{k}</p><p className="font-display text-2xl">{avg(k)}</p>
                  <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-amber" style={{ width: `${(avg(k) / 5) * 100}%` }} /></div></div>
              ))}
            </div>
            <div className="mt-5 divide-y">
              {reviews.map((r) => (
                <div key={r.id} className="py-4"><p className="flex items-center gap-2 text-sm font-semibold">{r.author} <span className="flex items-center gap-0.5 font-mono text-xs"><Star size={12} className="fill-amber text-amber" />{r.rating}</span><span className="text-xs font-normal text-muted-foreground">{r.date}</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.text}</p></div>
              ))}
            </div>
          </Sec>}

          {similar.length > 0 && (
            <Sec title={`Other ${data.destination?.name} departures`} id="trip-similar">
              <div className="grid gap-3 sm:grid-cols-2">
                {similar.map((c) => (
                  <Link key={c.trip_id} to={`/trip/${c.trip_id}?dep=${encodeURIComponent(c.dep_id)}`} className="flex items-center justify-between rounded-2xl border p-4 transition-colors hover:border-coral">
                    <span className="min-w-0"><p className="truncate font-semibold">{c.title}</p><p className="text-xs text-muted-foreground">{c.op.name} · {fmtDay(c.start)}</p></span>
                    <b className="font-mono">{short(c.true_price)}</b>
                  </Link>
                ))}
              </div>
            </Sec>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-[28px] bg-card p-6 shadow-lift" data-testid="trip-booking-panel">
            {sel && <>
              <div className="flex items-start justify-between"><Price card={sel} big /><HeartButton id={sel.dep_id} /></div>
              <div className="perf" />
              <p className="text-sm"><b>{fmtRange(sel.start, sel.end)}</b>{sel.seats_left != null ? ` · ${sel.seats_left} seats left` : ""}</p>
              <StatusPill status={sel.status} seatsLeft={sel.seats_left} />
              {real
                ? <Magnetic className="w-full"><a href={opLink} target="_blank" rel="noreferrer" data-testid="go-to-operator-button" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral py-3.5 font-semibold text-white shadow-lg shadow-coral/30">View on {op.name} <ExternalLink size={15} /></a></Magnetic>
                : <>
                  <Magnetic className="w-full"><button data-testid="enquire-button" onClick={() => setLead(true)} className="w-full rounded-2xl bg-coral py-3.5 font-semibold text-white shadow-lg shadow-coral/30">Enquire</button></Magnetic>
                  <a href={op.website} target="_blank" rel="noreferrer" data-testid="go-to-operator-button" className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-semibold">Go to operator <ExternalLink size={14} /></a>
                </>}
              <p className="text-center text-xs text-muted-foreground">{real
                ? `No payment on Wayfind — you book with the operator. Price read from their site ${sel.last_verified_days === 0 ? "today" : `${sel.last_verified_days} days ago`}; check it there before booking.`
                : `No payment on Wayfind. Verified ${sel.last_verified_days} days ago.`}</p>
            </>}
          </div>
        </aside>
      </main>

      {sel && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-card/95 p-3 backdrop-blur lg:hidden" data-testid="mobile-enquire-bar">
          <div><p className="font-display text-xl font-semibold">{short(sel.true_price)}</p><p className="text-xs text-muted-foreground">{fmtRange(sel.start, sel.end)}{real ? "" : " · true price"}</p></div>
          {real
            ? <a href={opLink} target="_blank" rel="noreferrer" data-testid="mobile-operator-button" className="flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 font-semibold text-white">View on operator site <ExternalLink size={15} /></a>
            : <button data-testid="mobile-enquire-button" onClick={() => setLead(true)} className="rounded-2xl bg-coral px-6 py-3 font-semibold text-white">Enquire</button>}
        </div>
      )}
      <LeadForm open={lead} onOpenChange={setLead} trip={trip} departures={deps} depId={sel?.dep_id} key={sel?.dep_id} />
      <CompareTray />
      <Footer />
    </div>
  );
}
